// Aplicação da Tempestade de areia (Sandstorm) no runtime: quem SAI em viagem sob sandstorm não vai
// direto — primeiro passa por um ponto aleatório do mapa ("perdido") e só então segue ao destino
// (reusa o mecanismo de `reroutePath` das poças). Se a sandstorm acaba no meio, recalcula reto da
// posição atual ao destino. Vale para missões (ida/volta), buscas e retornos de captura, e fly.

import type { Pokemon } from '../types/index.ts'
import type { CityGraph } from '../data/types.ts'
import type { GameState } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { graphWithTunnels, shortestPath, pathDistance } from '../engine/pathfinding.ts'
import { nodeIndexAtFraction } from '../engine/weatherTravel.ts'
import { graphTravelMs } from '../engine/missions.ts'
import { instantWeatherSpeed } from '../engine/rainSpeed.ts'
import { isSanding, pickLostNode } from '../engine/sand.ts'
import { createRng, deriveSeed } from '../engine/rng.ts'
import { SAND_SEED_SALT } from '../engine/constants.ts'
import { clamp } from '../engine/math.ts'
import { containerTeamIds } from './containers.ts'
import { findMon } from './runtime.ts'

/** Hash numérico estável de um id (para semear o sorteio do ponto perdido por perna). */
function hashId(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h >>> 0
}

interface SandTarget {
  reroutePath?: string[]
  sandDetour?: { lostNode: string }
  flying?: boolean
}

/**
 * Planeja e aplica a areia para UMA perna em trânsito. `applyShift(delta)` desloca o fim da perna e
 * seus marcos a jusante (pode ser negativo ao encurtar). `setReroute(path)` grava o caminho real.
 */
function applySandLeg(
  s: GameState,
  now: number,
  ct: SandTarget,
  primaryId: string,
  graph: CityGraph,
  base: readonly string[],
  start: number,
  end: number,
  legTag: number,
  applyShift: (deltaMs: number) => void,
  setReroute: (path: string[]) => void,
): void {
  if (base.length < 2 || end <= start) return
  const team: Pokemon[] = containerTeamIds(s, primaryId)
    .map((id) => findMon(s, id))
    .filter((p): p is Pokemon => p !== undefined)
  const speedMult = instantWeatherSpeed(s.weather, now, team, s.runItems, s.today.electrified)
  const frac = clamp((now - start) / (end - start), 0, 1)
  const here = nodeIndexAtFraction(graph, base, frac)
  const fromNode = base[here] as string
  const dest = base[base.length - 1] as string
  const sanding = isSanding(s.weather.sand, now)

  // Sandstorm acabou no meio de um desvio → recalcula reto da posição atual ao destino.
  if (ct.sandDetour && !sanding) {
    const straight = ct.flying ? [fromNode, dest] : shortestPath(graph, fromNode, dest)
    if (straight.length > 1) {
      const deltaDist = pathDistance(graph, straight) - pathDistance(graph, base.slice(here))
      applyShift(graphTravelMs(deltaDist, team, speedMult))
      setReroute([...base.slice(0, here + 1), ...straight.slice(1)])
    }
    ct.sandDetour = undefined
    return
  }

  // Saiu em viagem sob sandstorm (início da perna) → desvia por um ponto aleatório.
  if (sanding && !ct.sandDetour && frac < 0.05) {
    const rng = createRng(deriveSeed(s.run.seed, hashId(primaryId) ^ legTag, SAND_SEED_SALT))
    const lost = pickLostNode(rng, graph, fromNode, dest, team, s.runItems)
    if (!lost) return
    const toLost = ct.flying ? [fromNode, lost] : shortestPath(graph, fromNode, lost)
    const lostToDest = ct.flying ? [lost, dest] : shortestPath(graph, lost, dest)
    if (toLost.length < 2 || lostToDest.length < 2) return
    const detourRem = [...toLost, ...lostToDest.slice(1)]
    const extraDist = Math.max(0, pathDistance(graph, detourRem) - pathDistance(graph, base.slice(here)))
    applyShift(graphTravelMs(extraDist, team, speedMult))
    setReroute([...base.slice(0, here + 1), ...detourRem.slice(1)])
    ct.sandDetour = { lostNode: lost }
  }
}

/** Aplica a areia a TODOS os viajantes no tick (missões ida/volta, buscas e retornos de captura). */
export function applySandDetours(s: GameState, now: number): void {
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)

  for (const m of s.missions) {
    if (m.status === 'traveling' && m.acceptedAtMs !== null && m.arriveAtMs !== null) {
      const base = m.reroutePath ?? m.path
      applySandLeg(s, now, m, m.teamIds[0] ?? '', graph, base, m.acceptedAtMs, m.arriveAtMs, 1,
        (d) => { if (m.arriveAtMs !== null) m.arriveAtMs += d; if (m.resolveAtMs !== null) m.resolveAtMs += d; if (m.returnEndsAtMs !== null) m.returnEndsAtMs += d },
        (p) => { m.reroutePath = p })
    } else if (m.status === 'returning' && m.resolveAtMs !== null && m.returnEndsAtMs !== null) {
      const base = m.reroutePath ?? m.returnPath ?? [...m.path].reverse()
      applySandLeg(s, now, m, m.teamIds[0] ?? '', graph, base, m.resolveAtMs, m.returnEndsAtMs, 2,
        (d) => { if (m.returnEndsAtMs !== null) m.returnEndsAtMs += d },
        (p) => { m.reroutePath = p })
    }
  }

  for (const c of s.captureSearches) {
    if (c.phase !== 'traveling') continue
    const base = c.reroutePath ?? c.path
    applySandLeg(s, now, c, c.searcherId, graph, base, c.departAtMs, c.arriveAtMs, 3,
      (d) => { c.arriveAtMs += d; c.readyAtMs += d },
      (p) => { c.reroutePath = p })
  }

  for (const r of s.captureReturns) {
    const base = r.reroutePath ?? (r.path[0] === r.node ? r.path : [...r.path].reverse())
    applySandLeg(s, now, r, r.searcherId, graph, base, r.departAtMs, r.arriveAtMs, 4,
      (d) => { r.arriveAtMs += d },
      (p) => { r.reroutePath = p })
  }
}
