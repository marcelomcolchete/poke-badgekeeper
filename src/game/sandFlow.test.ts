// Testes do sandFlow: desvio por ponto aleatório na ida/volta, recálculo ao acabar, fly e capturas.

import { describe, expect, it } from 'vitest'
import { applySandDetours } from './sandFlow.ts'
import { autoSeedRun } from './setup.ts'
import type { GameState, MissionInstance, CaptureSearch } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import type { SandEvent } from '../engine/sand.ts'

const VIRIDIAN = 7

function gymAndNeighbor(cityIndex: number): [string, string] {
  const city = getCity(cityIndex)
  const gym = city.siteNodes.gym
  const neighbor = (city.graph.adj[gym] ?? [])[0]
  if (!neighbor) throw new Error('ginásio sem vizinhos')
  return [gym, neighbor]
}

function sandMissionState(opts: { sand: SandEvent[]; flying?: boolean }): { s: GameState; mission: MissionInstance } {
  const s = autoSeedRun(42)
  s.run.phase = 'DAY'
  s.run.cityIndex = VIRIDIAN
  const id = s.roster[0]!.id
  s.roster[0] = { ...s.roster[0]!, status: 'traveling' }
  const [gym, dest] = gymAndNeighbor(VIRIDIAN)
  const mission: MissionInstance = {
    id: 'm1', templateId: 'house', requirement: {} as never, node: dest,
    path: [gym, dest], returnPath: [dest, gym], flying: opts.flying,
    spawnAtMs: 0, expiresAtMs: 999_999, status: 'traveling', teamIds: [id],
    acceptedAtMs: 0, arriveAtMs: 100_000, resolveAtMs: 200_000, returnEndsAtMs: 300_000,
    result: null, pSuccess: null,
  }
  s.missions = [mission]
  s.weather = { ...s.weather, sand: opts.sand }
  return { s, mission }
}

describe('sandFlow', () => {
  it('sai sob sandstorm → desvia por um ponto aleatório (reroutePath passa pelo lostNode) e atrasa', () => {
    const { s, mission } = sandMissionState({ sand: [{ startMs: 0, endMs: 100_000 }] })
    applySandDetours(s, 1)
    expect(mission.sandDetour).toBeTruthy()
    expect(mission.reroutePath).toContain(mission.sandDetour!.lostNode)
    expect(mission.arriveAtMs!).toBeGreaterThan(100_000) // perna mais longa
  })

  it('sandstorm acaba no meio → recalcula reto e limpa o desvio', () => {
    const { s, mission } = sandMissionState({ sand: [{ startMs: 0, endMs: 100_000 }] })
    applySandDetours(s, 1) // estabelece o desvio
    const [gym, dest] = gymAndNeighbor(VIRIDIAN)
    s.weather = { ...s.weather, sand: [] } // sandstorm acabou
    applySandDetours(s, 50)
    expect(mission.sandDetour).toBeUndefined()
    expect(mission.reroutePath).toEqual([gym, dest]) // reto de novo
  })

  it('fly também desvia (passa pelo lostNode)', () => {
    const { s, mission } = sandMissionState({ sand: [{ startMs: 0, endMs: 100_000 }], flying: true })
    applySandDetours(s, 1)
    expect(mission.sandDetour).toBeTruthy()
    expect(mission.reroutePath).toContain(mission.sandDetour!.lostNode)
  })

  it('lostNode é determinístico (mesma seed/perna)', () => {
    const a = sandMissionState({ sand: [{ startMs: 0, endMs: 100_000 }] })
    applySandDetours(a.s, 1)
    const b = sandMissionState({ sand: [{ startMs: 0, endMs: 100_000 }] })
    applySandDetours(b.s, 1)
    expect(a.mission.sandDetour!.lostNode).toBe(b.mission.sandDetour!.lostNode)
  })

  it('busca de captura também desvia', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'DAY'
    s.run.cityIndex = VIRIDIAN
    const id = s.roster[0]!.id
    const [gym, dest] = gymAndNeighbor(VIRIDIAN)
    const search: CaptureSearch = {
      searcherId: id, spotIndex: 0, node: dest, path: [gym, dest], phase: 'traveling',
      departAtMs: 0, arriveAtMs: 100_000, readyAtMs: 200_000,
    }
    s.captureSearches = [search]
    s.weather = { ...s.weather, sand: [{ startMs: 0, endMs: 100_000 }] }
    applySandDetours(s, 1)
    expect(search.sandDetour).toBeTruthy()
    expect(search.reroutePath).toContain(search.sandDetour!.lostNode)
  })
})
