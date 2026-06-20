import { describe, expect, it } from 'vitest'
import { missionTravelerPos, elapsedFraction, theftPos, theftInterceptorIds } from './travelerPositions.ts'
import type { MissionInstance, TheftEvent, GameState } from './state.ts'
import type { CityGraph } from '../data/types.ts'
import { autoSeedRun } from '../game/setup.ts'
import { getCity } from '../data/cities.ts'
import { farthestNodeFrom, graphWithTunnels } from './pathfinding.ts'

const graph: CityGraph = {
  nodes: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
  adj: { a: ['b'], b: ['a'] },
  markers: {},
}

function baseMission(over: Partial<MissionInstance>): MissionInstance {
  return {
    id: 'm1', templateId: 'house', requirement: {} as never, node: 'b',
    path: ['a', 'b'], spawnAtMs: 0, expiresAtMs: 0, status: 'traveling', teamIds: ['p1'],
    acceptedAtMs: 0, arriveAtMs: 1000, resolveAtMs: null, returnEndsAtMs: null,
    result: null, pSuccess: null, ...over,
  }
}

describe('travelerPositions', () => {
  it('elapsedFraction satura em [0,1]', () => {
    expect(elapsedFraction(500, 0, 1000)).toBeCloseTo(0.5)
    expect(elapsedFraction(-100, 0, 1000)).toBe(0)
    expect(elapsedFraction(2000, 0, 1000)).toBe(1)
  })

  it('interpola a posição na ida (meio do caminho)', () => {
    const pos = missionTravelerPos(graph, baseMission({}), 500)
    expect(pos?.x).toBeCloseTo(0.5)
  })

  it('paralyzeHold tem prioridade: devolve a pos congelada enquanto now < untilMs', () => {
    const m = baseMission({ paralyzeHold: { pos: { x: 0.42, y: 0.42 }, untilMs: 800 } })
    expect(missionTravelerPos(graph, m, 500)?.x).toBeCloseTo(0.42)
    // após untilMs, volta a interpolar
    expect(missionTravelerPos(graph, m, 900)?.x).not.toBeCloseTo(0.42)
  })

  it('inProgress não aparece no mapa (null)', () => {
    expect(missionTravelerPos(graph, baseMission({ status: 'inProgress' }), 500)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Helpers para os testes de TheftEvent
// ---------------------------------------------------------------------------

function fleeingTheft(over: Partial<TheftEvent> = {}): TheftEvent {
  return {
    phase: 'fleeing',
    stolenId: 'p9',
    fromNode: 'a',
    targetNode: 'b',
    startedAtMs: 0,
    arriveAtMs: 1000,
    graceUntilMs: 6000,
    chaserIds: [],
    chaserArriveAtMs: [],
    chaserStartAtMs: [],
    trainerId: 'ROCKET_TEAM_MALE',
    enemies: [],
    ...over,
  }
}

describe('theftPos', () => {
  it('interpola fromNode→targetNode na fuga', () => {
    // graph local: a={0,0} b={1,0} — metade do tempo = x≈0.5
    const pos = theftPos(graph, fleeingTheft(), 500)
    expect(pos?.x).toBeCloseTo(0.5)
  })

  it("trava no targetNode em 'atFarNode'", () => {
    const pos = theftPos(graph, fleeingTheft({ phase: 'atFarNode' }), 5000)
    expect(pos?.x).toBeCloseTo(1)
  })

  it("retorna null em 'armed'/'battle'/'resolved'", () => {
    expect(theftPos(graph, fleeingTheft({ phase: 'armed' }), 500)).toBeNull()
    expect(theftPos(graph, fleeingTheft({ phase: 'battle' }), 500)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Helpers para chaserPositionsAt / theftInterceptorIds (usam grafo real da cidade 0)
// ---------------------------------------------------------------------------

/** Retorna o nó do ginásio e o nó mais distante no grafo da cidade corrente. */
function pickAdjacentPair(s: GameState): { from: string; target: string } {
  const city = getCity(s.run.cityIndex)
  const realGraph = graphWithTunnels(city.graph, s.today.digTunnels)
  const gym = city.siteNodes.gym
  const neighbors = city.graph.adj[gym] ?? []
  const from = neighbors[0] ?? gym
  const target = farthestNodeFrom(realGraph, gym) ?? from
  return { from, target }
}

/** Constrói um TheftEvent em 'atFarNode' com 1 perseguidor — usado como base dos testes de chaser. */
function fleeingTheftReal(
  from: string,
  target: string,
  chaserId: string,
  over: Partial<TheftEvent> = {},
): TheftEvent {
  return {
    phase: 'atFarNode',
    stolenId: 'p9',
    fromNode: from,
    targetNode: target,
    startedAtMs: 0,
    arriveAtMs: 1000,
    graceUntilMs: 60_000,
    chaserIds: [chaserId],
    chaserArriveAtMs: [2000],
    chaserStartAtMs: [0],
    trainerId: 'ROCKET_TEAM_MALE',
    enemies: [],
    ...over,
  }
}

describe('chaserPositionsAt / theftInterceptorIds', () => {
  it('perseguidor que já chegou ao destino fica em cima da Rocket (intercepta)', () => {
    const s = autoSeedRun(7)
    s.run.phase = 'DAY'
    const id = s.roster[0]!.id
    const { from, target } = pickAdjacentPair(s)
    // phase 'atFarNode': Rocket parada no target; perseguidor com arrive no passado → frac=1 → no target
    s.theft = fleeingTheftReal(from, target, id, {
      chaserStartAtMs: [0],
      chaserArriveAtMs: [1000],
    })
    const interceptors = theftInterceptorIds(s, 999_999)
    expect(interceptors).toContain(id)
  })

  it('perseguidor que mal começou está longe (não intercepta)', () => {
    const s = autoSeedRun(7)
    s.run.phase = 'DAY'
    const id = s.roster[0]!.id
    const { from, target } = pickAdjacentPair(s)
    s.theft = {
      ...fleeingTheftReal(from, target, id),
      phase: 'fleeing',
      chaserStartAtMs: [1000],
      chaserArriveAtMs: [50_000], // ainda no comecinho da jornada
      startedAtMs: 0,
      arriveAtMs: 1000, // Rocket já chegou ao destino
    }
    expect(theftInterceptorIds(s, 1100)).not.toContain(id)
  })
})
