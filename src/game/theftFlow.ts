// Orquestração do Evento de Roubo Rocket (Feature B). Espelha defenseFlow/rocketFlow: rolagem no
// dia-aberto, spawn com DISPARO ADIADO (espera um alvo no ginásio), avanço da fuga/perseguição no
// tick e resolução da batalha de resgate (reusa resolveDefense). O relógio CORRE concorrente
// durante a fuga; a batalha de resgate é modal e pausa o relógio (set speed 0), igual à defesa.

import type { Pokemon } from '../types/index.ts'
import type { TrainerId } from '../types/index.ts'
import type { GameState, TheftEvent } from '../engine/state.ts'
import { ROCKET_TRAINER_IDS } from '../types/index.ts'
import { getCity } from '../data/cities.ts'
import { getTrainer } from '../data/trainers.ts'
import { graphWithTunnels, shortestPath, pathDistance, farthestNodeFrom } from '../engine/pathfinding.ts'
import { generateDefenseEnemies, rollSquadSize, resolveDefense, gymWinXp, canDefend } from '../engine/gymDefense.ts'
import { applyBattleSecretRuntime } from './defenseFlow.ts'
import { sturdyAvailable } from '../engine/secretEffects.ts'
import { applyXpGains } from './itemFlow.ts'
import { applyHeartDelta } from '../engine/hearts.ts'
import { settleFaintTracked, findMon, replaceMon, takeRng } from './runtime.ts'
import { createRng } from '../engine/rng.ts'
import { damageForDay } from '../engine/constants.ts'
import { graphTravelMs } from '../engine/missions.ts'
import { theftInterceptorIds } from '../engine/travelerPositions.ts'
import { THEFT_CHASERS_MAX, THEFT_XP_MULTIPLIER, THEFT_CHANCE_START, THEFT_GRACE_MS } from '../engine/balance.ts'
import { markActive } from '../engine/state.ts'
import { rollNextTheftChance, theftFleeMs } from '../engine/theft.ts'

/** Status que põem o Pokémon FORA do ginásio (não roubável). Espelha AWAY_STATUSES do dayClock. */
export const AWAY_FROM_GYM_STATUSES: ReadonlySet<Pokemon['status']> = new Set([
  'traveling',
  'onMission',
  'returning',
  'defending',
  'atCenter',
  'stolen',
])

/** Ids ocupados em exploração/captura (buscando, voltando ou em encontro) — fora do ginásio. */
function captureBusyIds(s: GameState): Set<string> {
  const ids = new Set<string>()
  for (const c of s.captureSearches) ids.add(c.searcherId)
  for (const r of s.captureReturns) ids.add(r.searcherId)
  for (const e of s.encounters) ids.add(e.searcherId)
  return ids
}

/**
 * Pokémon roubáveis = presentes no ginásio: idle OU derrotado (fainted), e NÃO fora (viajando/
 * em missão/voltando/defendendo/no Centro/já roubado) nem buscando captura. (B2.)
 */
export function eligibleTheftTargets(s: GameState): Pokemon[] {
  const busy = captureBusyIds(s)
  return s.roster.filter(
    (p) => (p.status === 'idle' || p.status === 'fainted') && !AWAY_FROM_GYM_STATUSES.has(p.status) && !busy.has(p.id),
  )
}

/** Esqueleto de um evento 'armed' (sem alvo/nós/timers ainda). */
function armedTheft(trainerId: TrainerId): TheftEvent {
  return {
    phase: 'armed',
    stolenId: null,
    fromNode: '',
    targetNode: '',
    startedAtMs: -1,
    arriveAtMs: -1,
    graceUntilMs: -1,
    chaserIds: [],
    chaserArriveAtMs: [],
    chaserStartAtMs: [],
    trainerId,
    enemies: [],
  }
}

/**
 * Rolagem ÚNICA no início do dia (B1): acerta → arma o evento (fase 'armed', sem alvo); erra →
 * run.theftChance DOBRA. A chance só reseta ao DISPARAR de fato (spawnTheft). No máx. 1×/dia.
 */
export function rollTheftAtDayOpen(s: GameState): void {
  if (s.theft) return // já existe evento hoje (idempotente)
  const rng = takeRng(s)
  const hit = rng.bool(s.run.theftChance / 100)
  if (!hit) {
    s.run.theftChance = rollNextTheftChance(s.run.theftChance)
    return
  }
  // Treinador Rocket sorteado já aqui (estável para o evento do dia).
  const trainerId = rng.pick(ROCKET_TRAINER_IDS)
  s.theft = armedTheft(trainerId)
}

/**
 * Dispara o roubo quando há alvo elegível (B2/B3): escolhe um alvo aleatório → 'stolen', define o
 * nó de spawn (adjacente ao ginásio) e o destino (nó mais distante por caminho), arma timers de
 * fuga (theftFleeMs) e a janela de graça, gera o esquadrão (dimensionado pelo dia) e RESETA a
 * chance p/ 1. Sem alvo, NÃO dispara nem reseta (disparo adiado).
 */
export function spawnTheft(s: GameState, now: number): void {
  const theft = s.theft
  if (!theft || theft.phase !== 'armed') return
  const targets = eligibleTheftTargets(s)
  if (targets.length === 0) return // disparo adiado — espera um alvo

  const rng = takeRng(s)
  const target = rng.pick(targets)
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const gym = city.siteNodes.gym

  // Nó de spawn: um vizinho do ginásio (adjacente). Fallback = o próprio ginásio.
  const neighbors = (graph.adj[gym] ?? []).filter((n) => graph.nodes[n])
  const fromNode = neighbors.length > 0 ? rng.pick(neighbors) : gym
  // Destino: nó mais distante do ginásio por distância de caminho.
  const targetNode = farthestNodeFrom(graph, gym) ?? fromNode

  const path = shortestPath(graph, fromNode, targetNode)
  const distance = pathDistance(graph, path)
  const flee = theftFleeMs(distance)
  const arriveAtMs = now + Math.max(1, Math.round(flee))

  // Esquadrão de resgate: igual à defesa de ginásio (tamanho pelo dia + inimigos + medalhas).
  const trainer = getTrainer(theft.trainerId)
  const size = rollSquadSize(rng, s.run.day)
  const enemies = generateDefenseEnemies(rng, trainer, size, s.run.day)

  replaceMon(s, { ...target, status: 'stolen' })
  s.theft = {
    ...theft,
    phase: 'fleeing',
    stolenId: target.id,
    fromNode,
    targetNode,
    startedAtMs: now,
    arriveAtMs,
    graceUntilMs: arriveAtMs + THEFT_GRACE_MS,
    enemies,
  }
  // A chance só zera quando o roubo DISPARA (B1).
  s.run.theftChance = THEFT_CHANCE_START
}

// ─── Parte 2: tick, dispatch e resolução da batalha de resgate (Task 7) ───────

/** Libera os perseguidores (voltam a idle) e zera a lista — fim da perseguição. */
function releaseChasers(s: GameState): void {
  const theft = s.theft
  if (!theft) return
  for (const id of theft.chaserIds) {
    const mon = findMon(s, id)
    if (mon && mon.status === 'defending') replaceMon(s, { ...mon, status: 'idle' })
  }
  s.theft = { ...s.theft!, chaserIds: [], chaserArriveAtMs: [], chaserStartAtMs: [] }
}

/** Tira 1 coração de TODO o roster (desfecho de falha — B7). */
function allRosterMinusOneHeart(s: GameState): void {
  s.roster = s.roster.map((p) => ({ ...p, hearts: applyHeartDelta(p.hearts, -1) }))
}

/**
 * Desfecho de FALHA (perda da batalha OU fuga na janela de graça — B7): remove o Pokémon roubado
 * do roster e tira 1 coração de todo o resto. Reseta a perseguição e marca 'resolved'.
 */
export function resolveTheftLoss(s: GameState): void {
  const theft = s.theft
  if (!theft || theft.phase === 'resolved') return
  releaseChasers(s)
  if (theft.stolenId) s.roster = s.roster.filter((p) => p.id !== theft.stolenId)
  allRosterMinusOneHeart(s)
  s.theft = { ...s.theft!, phase: 'resolved', won: false, resolved: true }
}

/** Entra na batalha de resgate: pausa o relógio (modal) e muda a fase p/ 'battle'. */
export function enterTheftBattle(s: GameState): void {
  const theft = s.theft
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return
  s.theft = { ...theft, phase: 'battle' }
  s.clock.speed = 0
}

/**
 * Avança o evento de roubo no tick (concorrente com o dia):
 * - 'armed': tenta disparar (spawnTheft) — disparo adiado até haver alvo.
 * - 'fleeing': se um perseguidor interceptou → batalha; senão, ao chegar ao destino → 'atFarNode'.
 * - 'atFarNode': interceptou na graça → batalha; graça expirou → perda.
 */
export function processTheft(s: GameState, now: number): void {
  const theft = s.theft
  if (!theft) return
  if (theft.phase === 'armed') {
    spawnTheft(s, now)
    return
  }
  if (theft.phase === 'fleeing') {
    if (theftInterceptorIds(s, now).length > 0) {
      enterTheftBattle(s)
      return
    }
    if (now >= theft.arriveAtMs) {
      s.theft = { ...theft, phase: 'atFarNode' }
      // Cascata: se a graça também já expirou neste mesmo tick, resolve logo.
      if (now >= theft.graceUntilMs) {
        resolveTheftLoss(s)
        return
      }
    }
    return
  }
  if (theft.phase === 'atFarNode') {
    if (theftInterceptorIds(s, now).length > 0) {
      enterTheftBattle(s)
      return
    }
    if (now >= theft.graceUntilMs) resolveTheftLoss(s)
  }
}

/**
 * Despacha até THEFT_CHASERS_MAX Pokémon idle atrás da Rocket (B4). Cada perseguidor recebe o seu
 * tempo de chegada ao destino (pela própria velocidade via graphTravelMs), gravado em paralelo a
 * chaserIds. Sai do ginásio como 'defending' (ocupado) e conta como participante do dia.
 */
export function dispatchTheftChasers(s: GameState, chaserIds: readonly string[]): void {
  const theft = s.theft
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return
  const now = s.clock.dayElapsedMs
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const gym = city.siteNodes.gym
  const distance = pathDistance(graph, shortestPath(graph, gym, theft.targetNode))

  const picked: string[] = []
  const arriveAt: number[] = []
  const startAt: number[] = []
  for (const id of chaserIds) {
    if (picked.length >= THEFT_CHASERS_MAX) break
    if (theft.chaserIds.includes(id)) continue
    const mon = findMon(s, id)
    if (!mon || mon.status !== 'idle') continue
    const travel = graphTravelMs(distance, [mon], 1)
    picked.push(id)
    startAt.push(now)
    arriveAt.push(now + Math.max(1, Math.round(travel)))
    replaceMon(s, { ...mon, status: 'defending' })
    markActive(s.today, id)
  }
  if (picked.length === 0) return
  s.theft = {
    ...theft,
    chaserIds: [...theft.chaserIds, ...picked],
    chaserArriveAtMs: [...theft.chaserArriveAtMs, ...arriveAt],
    chaserStartAtMs: [...theft.chaserStartAtMs, ...startAt],
  }
}

/**
 * Resolve a batalha de resgate (cadeia de duelos 1v1; reusa resolveDefense — perseguidores tomam
 * dano/desmaiam). Vitória: recupera o Pokémon roubado (idle, MESMO HP); derrota: resolveTheftLoss.
 * Idempotente (não resolve duas vezes). O XP é APLICADO em completeTheftBattle.
 */
export function resolveTheftBattle(s: GameState): void {
  const theft = s.theft
  if (!theft || theft.phase !== 'battle' || theft.resolved) return
  const squad = theft.chaserIds
    .map((id) => findMon(s, id))
    .filter((p): p is Pokemon => p !== undefined)
  // Sem perseguidor disponível: trata como derrota (ninguém para lutar).
  if (!canDefend(squad)) {
    resolveTheftLoss(s)
    return
  }
  for (const p of squad) markActive(s.today, p.id)
  const sturdyAvailableIds = new Set(
    squad.filter((p) => sturdyAvailable(p, s.today.secretRuntime)).map((p) => p.id),
  )
  const resolution = resolveDefense(takeRng(s), squad, theft.enemies, {
    sturdyAvailableIds,
    runItems: s.runItems,
    damagePerLoss: damageForDay(s.run.day),
    paralyzedIds: new Set(s.today.paralyzedBattleIds),
  })
  for (const member of resolution.squad) replaceMon(s, settleFaintTracked(s, member))
  applyBattleSecretRuntime(s, squad, resolution)

  if (resolution.won) {
    // Recupera o Pokémon roubado: volta a idle mantendo o HP que tinha (desmaiado continua KO).
    const stolenId = theft.stolenId
    const stolen = stolenId ? s.roster.find((p) => p.id === stolenId) : undefined
    if (stolen) {
      replaceMon(s, { ...stolen, status: stolen.currentHp > 0 ? 'idle' : 'fainted' })
    }
    s.theft = {
      ...theft,
      phase: 'battle',
      duels: resolution.duels,
      won: true,
      resolved: true,
      xpSeed: takeRng(s).int(0, 0x7fffffff),
    }
  } else {
    // Derrota: grava o log de duelos e marca resolved=true, mas MANTÉM fase 'battle' para a UI
    // animar a batalha. A finalização (remoção do mon + corações) ocorre em completeTheftBattle.
    s.theft = { ...theft, phase: 'battle', duels: resolution.duels, won: false, resolved: true }
  }
}

/**
 * Conclui a batalha de resgate ao fim da animação: vitória → aplica 3× XP por duelo vencido,
 * libera perseguidores e marca 'resolved'; derrota → chama resolveTheftLoss (remove mon + −1 coração
 * + resolved). Simétrico: tanto vitória quanto derrota finalizam aqui, após a UI animar. Idempotente.
 */
export function completeTheftBattle(s: GameState): void {
  const theft = s.theft
  if (!theft || theft.phase === 'resolved') return
  if (theft.won === false && theft.resolved) {
    // Derrota confirmada: finaliza a perda agora (após animação da batalha).
    resolveTheftLoss(s)
    return
  }
  if (theft.won && theft.duels) {
    const xpById = new Map<string, number>()
    let theirs = 0
    for (const duel of theft.duels) {
      if (!duel.youWon) continue
      const enemy = theft.enemies[theirs]
      if (enemy) {
        const base = gymWinXp(enemy.battle) * THEFT_XP_MULTIPLIER
        xpById.set(duel.yourId, (xpById.get(duel.yourId) ?? 0) + base)
        // Conta a vitória contra a Rocket como "derrotado" do dia (Destaque + miniaturas).
        s.today.defenseKills.push({
          defeaterId: duel.yourId,
          speciesId: enemy.speciesId,
          enemyBattle: enemy.battle,
          enemyMedal: enemy.medal,
          enemyTypes: enemy.types,
        })
      }
      theirs += 1
    }
    applyXpGains(s, xpById, createRng(theft.xpSeed ?? 0))
    for (const xp of xpById.values()) s.today.xpEarned += xp
  }
  releaseChasers(s)
  s.theft = { ...s.theft!, phase: 'resolved', resolved: true }
}
