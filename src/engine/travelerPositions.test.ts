import { describe, expect, it } from 'vitest'
import { missionTravelerPos, elapsedFraction } from './travelerPositions.ts'
import type { MissionInstance } from './state.ts'
import type { CityGraph } from '../data/types.ts'

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
