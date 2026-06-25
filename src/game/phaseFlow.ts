// Transição entre as fases do dia e fechamento do dia (PLAN §3/§4.7).
// MORNING (mercado) → DAY (tempo real) → SUMMARY (resumo) → próximo dia.
// A fase CAPTURE do enum fica reservada à tela de captura (Fase 4); aqui a
// captura acontece DENTRO do DAY pelos spots do mapa (§4.5).

import type { GameSpeed } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { emptyTally } from '../engine/state.ts'
import { STARS_MIN, STARS_STEP, TOTAL_DAYS } from '../engine/constants.ts'
import { ALL_DEFENSES_WON_BONUS } from '../engine/balance.ts'
import {
  applyDomainStars,
  battleStarDelta,
  dailyGoalMet,
  missionStarDelta,
  type DailyProgress,
} from '../engine/approval.ts'
import { applyHeartDelta, dailyHeartDelta, heartsOf } from '../engine/hearts.ts'
import { isFainted } from '../engine/attributes.ts'
import { buildDaySummary, toDayLog } from '../engine/daySummary.ts'
import { foldDayIntoLifetime } from '../engine/lifetime.ts'
import { secretLineFor } from '../data/secretAbilities.ts'
import { recomputeMaxHp } from '../engine/attributes.ts'
import { expireMission, freeOnReturn, resolveMissionNow } from './missionFlow.ts'
import { expireDefense } from './defenseFlow.ts'
import { setupDay, setupMorningShop } from './setup.ts'
import { findMon, replaceMon } from './runtime.ts'
import { incubateEggs } from './eggFlow.ts'
import {
  rollTheftAtDayOpen,
  resolveTheftBattle,
  completeTheftBattle,
  resolveTheftLoss,
} from './theftFlow.ts'

export function setSpeed(s: GameState, speed: GameSpeed): void {
  s.clock.speed = speed
  // Lembra a velocidade de JOGO (pausa não conta) para reabrir o próximo dia nela (setupDay).
  if (speed > 0) s.clock.daySpeed = speed
}

/** Avança a fase atual do dia (PLAN §3). */
export function advancePhase(s: GameState): void {
  switch (s.run.phase) {
    case 'MORNING':
      s.run.phase = 'DAY'
      setupDay(s)
      rollTheftAtDayOpen(s) // B1: uma rolagem por dia (arma ou dobra a chance)
      return
    case 'DAY':
      finalizeDay(s)
      return
    case 'SUMMARY':
      startNextDay(s)
      return
    default:
      return
  }
}

/** Fecha o dia: resolve pendências, ajusta estrelas e registra o histórico (PLAN §4.7). */
export function finalizeDay(s: GameState): void {
  resolveLeftovers(s)
  applyAllDefensesBonus(s)

  const missionBefore = s.approval.missionStars
  const battleBefore = s.approval.battleStars
  s.today.missionStarsBefore = missionBefore
  s.today.battleStarsBefore = battleBefore
  const normalResults = s.today.missionResults.filter((r) => r.templateId !== 'special')
  const progress: DailyProgress = {
    missionsCompleted: normalResults.filter((r) => r.success).length,
    missionsTotal: normalResults.length,
    battlesWon: s.today.defensesWon,
    battlesTotal: s.today.defensesTotal,
  }
  const missionDelta = missionStarDelta(progress)
  const battleDelta = battleStarDelta(progress)
  const missionAfter = applyDomainStars(missionBefore, missionDelta)
  const battleAfter = applyDomainStars(battleBefore, battleDelta)

  // Zerar uma trilha (a queda do dia a levaria abaixo de 0) encerra a run por reputação.
  if (missionBefore + missionDelta < STARS_MIN || battleBefore + battleDelta < STARS_MIN) {
    s.approval.missionStars = missionAfter
    s.approval.battleStars = battleAfter
    s.run.phase = 'GAMEOVER'
    s.run.gameOverReason = 'stars'
    s.clock.speed = 0
    return
  }

  s.approval.missionStars = missionAfter
  s.approval.battleStars = battleAfter
  s.approval.dailyGoalMet = dailyGoalMet(progress)

  // Penalidades da Missão Especial (A3) — aplicadas DEPOIS do desempenho normal, com piso 0 e
  // SEM game over. Não despachada (expired, time vazio) zera; despachada e falha tira 1 cheia.
  const specials = s.today.missionResults.filter((r) => r.templateId === 'special')
  const expiredSpecial = specials.some((r) => r.teamIds.length === 0 && !r.success)
  const failedSpecial = specials.some((r) => r.teamIds.length > 0 && !r.success)
  if (expiredSpecial) {
    s.approval.missionStars = STARS_MIN
  } else if (failedSpecial) {
    s.approval.missionStars = applyDomainStars(s.approval.missionStars, -STARS_STEP * 2)
  }

  const summary = buildDaySummary({
    day: s.run.day,
    missionStarsBefore: missionBefore,
    missionStarsAfter: s.approval.missionStars,
    battleStarsBefore: battleBefore,
    battleStarsAfter: battleAfter,
    missionResults: s.today.missionResults,
    defensesWon: s.today.defensesWon,
    defensesTotal: s.today.defensesTotal,
    defenseKills: s.today.defenseKills,
    goldEarned: s.today.goldEarned,
    capturedIds: s.today.capturedIds,
    roster: s.roster,
  })
  prepareSecretChoice(s, summary.mvpId)
  applyDailyHearts(s, summary.mvpId)
  s.history.push(toDayLog(summary))
  s.run.phase = 'SUMMARY'
  s.clock.speed = 0
}

/**
 * Corações do fim do dia (só o TIME; o PC não muda): cada Pokémon ganha +0,5 se sobreviveu ou
 * −0,5 se morreu, +0,5 se foi o Destaque do Dia e −0,5 se não fez nada (nenhuma missão/exploração/
 * batalha direta). Capado em [0, 5]. Aplicado antes da cura da virada do dia (lê o estado real).
 */
function applyDailyHearts(s: GameState, mvpId: string | null): void {
  const participated = new Set(s.today.activeIds)
  s.today.mvpHeartsGained = 0
  s.roster = s.roster.map((p) => {
    const delta = dailyHeartDelta({
      fainted: isFainted(p),
      participated: participated.has(p.id),
      mvp: p.id === mvpId,
    })
    const before = heartsOf(p.hearts)
    const after = applyHeartDelta(p.hearts, delta)
    // Ganho REAL do Destaque (já capado em [0,5]) para exibir no resumo do dia.
    if (p.id === mvpId) s.today.mvpHeartsGained = after - before
    return { ...p, hearts: after }
  })
}

/**
 * Destaque do Dia: REGISTRA uma escolha de Habilidade Secreta pendente (resolvida pelo jogador na
 * tela de resumo). Elegível se o MVP tem linha e ainda não usou os 2 destaques: picks vazio
 * (1º destaque) ou 1 pick no nível 1 (2º destaque). Não muta `secretPicks`.
 */
export function prepareSecretChoice(s: GameState, mvpId: string | null): void {
  s.today.secretUnlock = null
  s.today.secretChoice = null
  if (!mvpId) return
  const mon = s.roster.find((p) => p.id === mvpId)
  if (!mon || !secretLineFor(mon.speciesId)) return
  const picks = mon.secretPicks ?? []
  const eligible = picks.length === 0 || (picks.length === 1 && picks[0]?.level === 1)
  if (eligible) s.today.secretChoice = { pokemonId: mvpId }
}

/**
 * Aplica a escolha do jogador para o Pokémon em `today.secretChoice`: grava `secretPicks` e o
 * `secretUnlock` (reveal). Valida a legalidade da transição; no-op se ilegal ou sem escolha pendente.
 * - 1º destaque (picks []): `(slot, 1)` → `[{slot,1}]`, choice 'first'.
 * - 2º destaque aprofundar: `(slotAtual, 2)` → `[{slot,2}]`, choice 'deepen'.
 * - 2º destaque ampliar: `(outroSlot, 1)` → adiciona, choice 'widen'.
 */
export function chooseSecretAbility(s: GameState, slot: 0 | 1, level: 1 | 2): void {
  const pending = s.today.secretChoice
  if (!pending) return
  const mon = s.roster.find((p) => p.id === pending.pokemonId)
  if (!mon || !secretLineFor(mon.speciesId)) return
  const picks = mon.secretPicks ?? []

  let next: { slot: 0 | 1; level: 1 | 2 }[] | null = null
  let choice: 'first' | 'deepen' | 'widen' | null = null

  if (picks.length === 0) {
    // 1º destaque: só nível 1, slot 0 ou 1.
    if (level === 1) {
      next = [{ slot, level: 1 }]
      choice = 'first'
    }
  } else if (picks.length === 1 && picks[0]?.level === 1) {
    const cur = picks[0]
    if (slot === cur.slot && level === 2) {
      next = [{ slot: cur.slot, level: 2 }]
      choice = 'deepen'
    } else if (slot !== cur.slot && level === 1) {
      next = [cur, { slot, level: 1 }]
      choice = 'widen'
    }
  }

  if (!next || !choice) return // transição ilegal: mantém pendente
  s.roster = s.roster.map((p) => (p.id === mon.id ? { ...p, secretPicks: next } : p))
  s.today.secretUnlock = { pokemonId: mon.id, slot, level, choice }
  s.today.secretChoice = null
}

/** Bônus de +30% sobre o ouro de defesas se TODAS as defesas do dia foram vencidas (PLAN §4.6). */
function applyAllDefensesBonus(s: GameState): void {
  const { defensesTotal, defensesWon, defenseGold } = s.today
  if (defensesTotal === 0 || defensesWon < defensesTotal || defenseGold <= 0) return
  const bonus = Math.round(defenseGold * ALL_DEFENSES_WON_BONUS)
  s.gold += bonus
  s.today.goldEarned += bonus
}

/** Expira missões/defesas em aberto e força resolução/retorno das que estão em andamento. */
function resolveLeftovers(s: GameState): void {
  for (const mission of s.missions) {
    if (mission.status === 'scheduled' || mission.status === 'available') {
      expireMission(s, mission)
    } else if (mission.status === 'traveling' || mission.status === 'inProgress') {
      resolveMissionNow(s, mission)
      freeOnReturn(s, mission)
    } else if (mission.status === 'returning') {
      freeOnReturn(s, mission)
    }
  }
  for (const defense of s.defenses) expireDefense(defense)
  for (const traveler of [...s.captureSearches, ...s.encounters, ...s.captureReturns]) {
    const searcher = findMon(s, traveler.searcherId)
    if (searcher) replaceMon(s, { ...searcher, status: 'idle' })
  }
  s.captureSearches = []
  s.captureReturns = []
  s.encounters = []

  // Evento de Roubo Rocket pendente no fechamento: armado sem disparar fica como estava (a chance
  // segue dobrando amanhã); em fuga/graça vira perda; em batalha resolve automaticamente.
  const theft = s.theft
  if (theft) {
    if (theft.phase === 'fleeing' || theft.phase === 'atFarNode') {
      resolveTheftLoss(s)
    } else if (theft.phase === 'battle') {
      resolveTheftBattle(s)
      completeTheftBattle(s)
    }
    // 'armed' (sem alvo) e 'resolved' não exigem ação.
  }
}

/** Inicia o próximo dia (cura no Centro Pokémon, limpa eventos) ou encerra a run no dia 10. */
function startNextDay(s: GameState): void {
  // Dobra o dia que acabou de fechar no acumulador vitalício ANTES de zerar `today` (fim de jogo).
  // No dia 10 (run terminada) NÃO dobra: a tela de fim de jogo soma o dia em curso na exibição.
  if (s.run.day >= TOTAL_DAYS) return // run terminada: resultado da cidade fica na Fase 4
  s.lifetime = foldDayIntoLifetime(s.lifetime, s.today)
  s.run.day += 1
  s.run.phase = 'MORNING'
  s.rngCursor = 0
  healRoster(s)
  incubateEggs(s) // incuba/eclode ovos na virada do dia
  s.missions = []
  s.defenses = []
  s.captureSearches = []
  s.captureReturns = []
  s.encounters = []
  s.theft = undefined
  s.today = emptyTally()
  setupMorningShop(s)
  s.clock.dayElapsedMs = 0
  s.clock.speed = 0
}

/**
 * Cura todos os Pokémon (time e Computador) e os deixa disponíveis (descanso entre dias).
 * Também limpa os buffs diários de itens x_* (`dayBuffs`) e de habilidades (`secretBuffs`) e
 * recalcula o HP — o efeito só vale no dia. O PC também é curado para que um Pokémon depositado
 * machucado fique pronto ao trocar.
 */
function healRoster(s: GameState): void {
  const restore = (p: GameState['roster'][number]): GameState['roster'][number] => {
    const cleared = recomputeMaxHp({ ...p, dayBuffs: undefined, secretBuffs: undefined })
    return { ...cleared, currentHp: cleared.maxHp, status: 'idle' }
  }
  s.roster = s.roster.map(restore)
  s.box = s.box.map(restore)
}
