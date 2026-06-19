// Posição dos Pokémon "em trânsito" no mapa (PLAN §3.1), pura e compartilhada entre a UI
// (CityMap) e a aplicação dos raios da Tempestade (game/stormFlow). É a ÚNICA fonte de verdade:
// o que o jogador vê é exatamente o que o raio acerta. Honra paralyzeHold (congelamento) e
// weatherHold (poça), reroutePath e mão única.

import type { MapPos } from '../types/index.ts'
import type { CityGraph } from '../data/types.ts'
import type { CaptureReturn, CaptureSearch, GameState, MissionInstance } from './state.ts'
import { getCity } from '../data/cities.ts'
import { graphWithTunnels, pointAlongPath } from './pathfinding.ts'
import { clamp } from './math.ts'

/** Fração [0,1] do tempo decorrido entre dois instantes (start→end). */
export function elapsedFraction(now: number, start: number, end: number): number {
  return end > start ? clamp((now - start) / (end - start), 0, 1) : 1
}

/** Posição congelada por paralisia (Paralyze) em `now`, ou null se não há hold ativo. */
function paralyzePos(
  hold: { pos: MapPos; untilMs: number } | undefined,
  now: number,
): MapPos | null {
  return hold && now < hold.untilMs ? { ...hold.pos } : null
}

/** Posição do time de uma missão em deslocamento (ida/volta), ou null (no local/parada). */
export function missionTravelerPos(graph: CityGraph, m: MissionInstance, now: number): MapPos | null {
  if (m.path.length === 0) return null
  const frozen = paralyzePos(m.paralyzeHold, now)
  if (frozen) return frozen
  if (m.weatherHold && now < m.weatherHold.untilMs) {
    const held = graph.nodes[m.weatherHold.node]
    if (held) return { ...held }
  }
  if (m.status === 'traveling' && m.acceptedAtMs !== null && m.arriveAtMs !== null) {
    const out = m.reroutePath ?? m.path
    return pointAlongPath(graph, out, elapsedFraction(now, m.acceptedAtMs, m.arriveAtMs))
  }
  if (m.status === 'returning' && m.resolveAtMs !== null && m.returnEndsAtMs !== null) {
    const back = m.reroutePath ?? m.returnPath ?? [...m.path].reverse()
    return pointAlongPath(graph, back, elapsedFraction(now, m.resolveAtMs, m.returnEndsAtMs))
  }
  return null
}

/** Posição de um procurador a caminho (fase 'traveling'), ou null (já procurando/no local). */
export function searchTravelerPos(graph: CityGraph, c: CaptureSearch, now: number): MapPos | null {
  if (c.phase !== 'traveling') return null
  const frozen = paralyzePos(c.paralyzeHold, now)
  if (frozen) return frozen
  if (c.weatherHold && now < c.weatherHold.untilMs) {
    const held = graph.nodes[c.weatherHold.node]
    if (held) return { ...held }
  }
  const out = c.reroutePath ?? c.path
  return pointAlongPath(graph, out, elapsedFraction(now, c.departAtMs, c.arriveAtMs))
}

/** Posição de um procurador voltando ao ginásio. */
export function returnTravelerPos(graph: CityGraph, r: CaptureReturn, now: number): MapPos {
  const frozen = paralyzePos(r.paralyzeHold, now)
  if (frozen) return frozen
  if (r.weatherHold && now < r.weatherHold.untilMs) {
    const held = graph.nodes[r.weatherHold.node]
    if (held) return { ...held }
  }
  const back = r.reroutePath ?? (r.path[0] === r.node ? r.path : [...r.path].reverse())
  return pointAlongPath(graph, back, elapsedFraction(now, r.departAtMs, r.arriveAtMs))
}

/** Posições de TODOS os Pokémon visíveis no mapa em `now` (um item por Pokémon). */
export function travelerPositionsAt(s: GameState, now: number): { id: string; pos: MapPos }[] {
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const out: { id: string; pos: MapPos }[] = []
  for (const m of s.missions) {
    const pos = missionTravelerPos(graph, m, now)
    if (pos) for (const id of m.teamIds) out.push({ id, pos })
  }
  for (const c of s.captureSearches) {
    const pos = searchTravelerPos(graph, c, now)
    if (pos) out.push({ id: c.searcherId, pos })
  }
  for (const r of s.captureReturns) {
    out.push({ id: r.searcherId, pos: returnTravelerPos(graph, r, now) })
  }
  return out
}
