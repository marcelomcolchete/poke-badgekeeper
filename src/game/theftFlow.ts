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
import { generateDefenseEnemies, rollSquadSize } from '../engine/gymDefense.ts'
import { rollNextTheftChance, theftFleeMs } from '../engine/theft.ts'
import { THEFT_CHANCE_START, THEFT_GRACE_MS } from '../engine/balance.ts'
import { replaceMon, takeRng } from './runtime.ts'

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
