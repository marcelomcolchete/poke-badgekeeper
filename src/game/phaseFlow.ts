// Transição entre as fases do dia e fechamento do dia (PLAN §3/§4.7).
// MORNING (mercado) → DAY (tempo real) → SUMMARY (resumo) → próximo dia.
// A fase CAPTURE do enum fica reservada à tela de captura (Fase 4); aqui a
// captura acontece DENTRO do DAY pelos spots do mapa (§4.5).

import type { GameSpeed } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { emptyTally } from '../engine/state.ts'
import { STARS_MIN, TOTAL_DAYS } from '../engine/constants.ts'
import { ALL_DEFENSES_WON_BONUS } from '../engine/balance.ts'
import { applyApproval, approvalDelta, dailyGoalMet } from '../engine/approval.ts'
import { buildDaySummary, toDayLog } from '../engine/daySummary.ts'
import { expireMission, freeOnReturn, resolveMissionNow } from './missionFlow.ts'
import { expireDefense } from './defenseFlow.ts'
import { setupDay } from './setup.ts'
import { findMon, replaceMon } from './runtime.ts'

export function setSpeed(s: GameState, speed: GameSpeed): void {
  s.clock.speed = speed
}

/** Avança a fase atual do dia (PLAN §3). */
export function advancePhase(s: GameState): void {
  switch (s.run.phase) {
    case 'MORNING':
      s.run.phase = 'DAY'
      setupDay(s)
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

  const starsBefore = s.approval.stars
  s.today.starsBefore = starsBefore
  const completed = s.today.missionResults.filter((r) => r.success).length
  const total = s.today.missionResults.length

  // Sem estrelas e meta não batida: perder ½ estrela zeraria a reputação → game over.
  if (starsBefore + approvalDelta(completed, total) < STARS_MIN) {
    s.approval.stars = STARS_MIN
    s.run.phase = 'GAMEOVER'
    s.run.gameOverReason = 'stars'
    s.clock.speed = 0
    return
  }

  s.approval.stars = applyApproval(starsBefore, completed, total)
  s.approval.dailyGoalMet = dailyGoalMet(completed, total)

  const summary = buildDaySummary({
    day: s.run.day,
    starsBefore,
    starsAfter: s.approval.stars,
    missionResults: s.today.missionResults,
    defensesWon: s.today.defensesWon,
    defensesTotal: s.today.defensesTotal,
    goldEarned: s.today.goldEarned,
    capturedIds: s.today.capturedIds,
    roster: s.roster,
  })
  s.history.push(toDayLog(summary))
  s.run.phase = 'SUMMARY'
  s.clock.speed = 0
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
      resolveMissionNow(s, mission) // aplica o desfecho…
      freeOnReturn(s, mission) // …e traz o time de volta (fim do dia)
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
}

/** Inicia o próximo dia (cura no Centro Pokémon, limpa eventos) ou encerra a run no dia 10. */
function startNextDay(s: GameState): void {
  if (s.run.day >= TOTAL_DAYS) return // run terminada: resultado da cidade fica na Fase 4
  s.run.day += 1
  s.run.phase = 'MORNING'
  s.rngCursor = 0
  healRoster(s)
  s.missions = []
  s.defenses = []
  s.captureSearches = []
  s.captureReturns = []
  s.encounters = []
  s.today = emptyTally()
  s.clock.dayElapsedMs = 0
  s.clock.speed = 0
}

/** Cura todos os Pokémon e os deixa disponíveis (descanso entre dias). */
function healRoster(s: GameState): void {
  s.roster = s.roster.map((p) => ({ ...p, currentHp: p.maxHp, status: 'idle' }))
}
