// Posição dos Pokémon "em trânsito" no mapa (PLAN §3.1), pura e compartilhada entre a UI
// (CityMap) e a aplicação dos raios da Tempestade (game/stormFlow). É a ÚNICA fonte de verdade:
// o que o jogador vê é exatamente o que o raio acerta. Honra paralyzeHold (congelamento) e
// weatherHold (poça), reroutePath e mão única.

import type { MapPos, Pokemon } from '../types/index.ts'
import type { CityGraph } from '../data/types.ts'
import type { CaptureReturn, CaptureSearch, GameState, MissionInstance, TheftEvent } from './state.ts'
import { getCity } from '../data/cities.ts'
import { graphWithTunnels, pointAlongPath, segmentLength, shortestPath } from './pathfinding.ts'
import { clamp } from './math.ts'
import { weatherTravelFraction } from './rainSpeed.ts'
import type { WeatherSchedule } from './weather.ts'
import { THEFT_INTERCEPT_DISTANCE } from './balance.ts'
import { MAP_ASPECT_W } from './constants.ts'

/** Fração [0,1] do tempo decorrido entre dois instantes (start→end). */
export function elapsedFraction(now: number, start: number, end: number): number {
  return end > start ? clamp((now - start) / (end - start), 0, 1) : 1
}

/** Contexto de clima/time de uma perna em trânsito: torna a POSIÇÃO do sprite ciente do clima. */
export interface TravelWeatherCtx {
  schedule: WeatherSchedule
  team: readonly Pokemon[]
  runItems: readonly string[]
  electrified?: Record<string, 1 | 2>
}

/**
 * Fração de DISTÂNCIA percorrida numa perna [start, end] em `now`. Com contexto de clima, integra a
 * velocidade (lento no calor, normal depois) para o sprite voltar à velocidade original quando o
 * calor acaba; sem contexto, cai no linear de `elapsedFraction`.
 */
function travelFraction(
  now: number,
  start: number,
  end: number,
  ctx: TravelWeatherCtx | undefined,
): number {
  if (!ctx) return elapsedFraction(now, start, end)
  return weatherTravelFraction(ctx.schedule, start, end, now, ctx.team, ctx.runItems, ctx.electrified)
}

/** Posição congelada por paralisia (Paralyze) em `now`, ou null se não há hold ativo. */
function paralyzePos(
  hold: { pos: MapPos; untilMs: number } | undefined,
  now: number,
): MapPos | null {
  return hold && now < hold.untilMs ? { ...hold.pos } : null
}

/** Posição do time de uma missão em deslocamento (ida/volta), ou null (no local/parada). */
export function missionTravelerPos(
  graph: CityGraph,
  m: MissionInstance,
  now: number,
  ctx?: TravelWeatherCtx,
): MapPos | null {
  if (m.path.length === 0) return null
  const frozen = paralyzePos(m.paralyzeHold, now)
  if (frozen) return frozen
  if (m.weatherHold && now < m.weatherHold.untilMs) {
    const held = graph.nodes[m.weatherHold.node]
    if (held) return { ...held }
  }
  if (m.status === 'traveling' && m.acceptedAtMs !== null && m.arriveAtMs !== null) {
    const out = m.reroutePath ?? m.path
    return pointAlongPath(graph, out, travelFraction(now, m.acceptedAtMs, m.arriveAtMs, ctx))
  }
  if (m.status === 'returning' && m.resolveAtMs !== null && m.returnEndsAtMs !== null) {
    const back = m.reroutePath ?? m.returnPath ?? [...m.path].reverse()
    return pointAlongPath(graph, back, travelFraction(now, m.resolveAtMs, m.returnEndsAtMs, ctx))
  }
  return null
}

/** Posição de um procurador a caminho (fase 'traveling'), ou null (já procurando/no local). */
export function searchTravelerPos(
  graph: CityGraph,
  c: CaptureSearch,
  now: number,
  ctx?: TravelWeatherCtx,
): MapPos | null {
  if (c.phase !== 'traveling') return null
  const frozen = paralyzePos(c.paralyzeHold, now)
  if (frozen) return frozen
  if (c.weatherHold && now < c.weatherHold.untilMs) {
    const held = graph.nodes[c.weatherHold.node]
    if (held) return { ...held }
  }
  const out = c.reroutePath ?? c.path
  return pointAlongPath(graph, out, travelFraction(now, c.departAtMs, c.arriveAtMs, ctx))
}

/** Posição de um procurador voltando ao ginásio. */
export function returnTravelerPos(
  graph: CityGraph,
  r: CaptureReturn,
  now: number,
  ctx?: TravelWeatherCtx,
): MapPos {
  const frozen = paralyzePos(r.paralyzeHold, now)
  if (frozen) return frozen
  if (r.weatherHold && now < r.weatherHold.untilMs) {
    const held = graph.nodes[r.weatherHold.node]
    if (held) return { ...held }
  }
  const back = r.reroutePath ?? (r.path[0] === r.node ? r.path : [...r.path].reverse())
  return pointAlongPath(graph, back, travelFraction(now, r.departAtMs, r.arriveAtMs, ctx))
}

/**
 * Posição da Rocket em `now` (Feature B): interpola fromNode→targetNode pelo menor caminho
 * enquanto foge; trava no targetNode na janela de graça. Null fora da fuga (armada/batalha/feito).
 */
export function theftPos(graph: CityGraph, theft: TheftEvent, now: number): MapPos | null {
  if (theft.phase === 'fleeing') {
    const path = shortestPath(graph, theft.fromNode, theft.targetNode)
    if (path.length === 0) return null
    return pointAlongPath(graph, path, elapsedFraction(now, theft.startedAtMs, theft.arriveAtMs))
  }
  if (theft.phase === 'atFarNode') {
    const node = graph.nodes[theft.targetNode]
    return node ? { ...node } : null
  }
  return null
}

/**
 * Posições dos perseguidores em `now`: cada um segue o menor caminho do GINÁSIO ao targetNode
 * (destino conhecido da Rocket), avançando pela fração de tempo da SUA perna (chaserStartAtMs →
 * chaserArriveAtMs). Modelo persistível por timers (não por posição). Lista vazia sem perseguição.
 */
export function chaserPositionsAt(s: GameState, now: number): { id: string; pos: MapPos }[] {
  const theft = s.theft
  if (!theft || theft.chaserIds.length === 0) return []
  if (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode') return []
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const gym = city.siteNodes.gym
  const path = shortestPath(graph, gym, theft.targetNode)
  if (path.length === 0) return []
  const out: { id: string; pos: MapPos }[] = []
  for (let i = 0; i < theft.chaserIds.length; i++) {
    const id = theft.chaserIds[i] as string
    const start = theft.chaserStartAtMs[i] ?? theft.startedAtMs
    const arrive = theft.chaserArriveAtMs[i] ?? theft.arriveAtMs
    out.push({ id, pos: pointAlongPath(graph, path, elapsedFraction(now, start, arrive)) })
  }
  return out
}

/** Perseguidores cuja posição está a < THEFT_INTERCEPT_DISTANCE da Rocket em `now`. */
export function theftInterceptorIds(s: GameState, now: number): string[] {
  const theft = s.theft
  if (!theft) return []
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const rocket = theftPos(graph, theft, now)
  if (!rocket) return []
  const hit: string[] = []
  for (const { id, pos } of chaserPositionsAt(s, now)) {
    if (segmentLength(rocket, pos) < THEFT_INTERCEPT_DISTANCE * MAP_ASPECT_W) hit.push(id)
  }
  return hit
}

/** Monta o contexto de clima de uma perna a partir do estado, para os Pokémon `ids` em trânsito. */
export function travelCtxFor(s: GameState, ids: readonly string[]): TravelWeatherCtx {
  const team = ids
    .map((id) => s.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  return { schedule: s.weather, team, runItems: s.runItems, electrified: s.today.electrified }
}

/** Posições de TODOS os Pokémon visíveis no mapa em `now` (um item por Pokémon). */
export function travelerPositionsAt(s: GameState, now: number): { id: string; pos: MapPos }[] {
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const out: { id: string; pos: MapPos }[] = []
  for (const m of s.missions) {
    const pos = missionTravelerPos(graph, m, now, travelCtxFor(s, m.teamIds))
    if (pos) for (const id of m.teamIds) out.push({ id, pos })
  }
  for (const c of s.captureSearches) {
    const pos = searchTravelerPos(graph, c, now, travelCtxFor(s, [c.searcherId]))
    if (pos) out.push({ id: c.searcherId, pos })
  }
  for (const r of s.captureReturns) {
    out.push({ id: r.searcherId, pos: returnTravelerPos(graph, r, now, travelCtxFor(s, [r.searcherId])) })
  }
  return out
}
