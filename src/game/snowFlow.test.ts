// Testes do snowFlow: acúmulo de stacks, slowdown, freeze, dano, morte voadora, thaw e Clear Body.

import { describe, expect, it } from 'vitest'
import { processSnow } from './snowFlow.ts'
import { autoSeedRun } from './setup.ts'
import type { GameState, MissionInstance } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { makeMon } from '../engine/testkit.ts'
import type { SnowEvent } from '../engine/snow.ts'

function gymAndNeighbor(s: GameState): [string, string] {
  const city = getCity(s.run.cityIndex)
  const gym = city.siteNodes.gym
  const neighbor = (city.graph.adj[gym] ?? [])[0]
  if (!neighbor) throw new Error('ginásio sem vizinhos')
  return [gym, neighbor]
}

/** Estado com uma missão LONGA em trânsito (fica 'traveling') e uma janela de nevasca. */
function snowState(opts: { window: SnowEvent; flying?: boolean; clearBody?: boolean; hp?: number }): {
  s: GameState
  mission: MissionInstance
  id: string
} {
  const s = autoSeedRun(42)
  s.run.phase = 'DAY'
  const hp = opts.hp ?? 5
  const mon = opts.clearBody
    ? makeMon({ id: 'cb', speciesId: 72, secretPicks: [{ slot: 0, level: 1 }], maxHp: hp, currentHp: hp }) // Tentacool: slot0=clear-body
    : { ...s.roster[0]!, maxHp: hp, currentHp: hp }
  const id = mon.id
  s.roster[0] = { ...mon, status: 'traveling' }
  const [gym, dest] = gymAndNeighbor(s)
  const mission: MissionInstance = {
    id: 'm1',
    templateId: 'house',
    requirement: {} as never,
    node: dest,
    path: [gym, dest],
    returnPath: [dest, gym],
    flying: opts.flying,
    spawnAtMs: 0,
    expiresAtMs: 999_999,
    status: 'traveling',
    teamIds: [id],
    acceptedAtMs: 0,
    arriveAtMs: 1_000_000,
    resolveAtMs: 2_000_000,
    returnEndsAtMs: 3_000_000,
    result: null,
    pSuccess: null,
  }
  s.missions = [mission]
  s.weather = { ...s.weather, snow: [opts.window] }
  return { s, mission, id }
}

describe('snowFlow', () => {
  it('2s viajando sob nevasca → 1 stack e a perna fica mais longa', () => {
    const { s, mission } = snowState({ window: { startMs: 0, endMs: 1_000_000 } })
    processSnow(s, 0, 2_000)
    expect(mission.snow?.stacks).toBe(1)
    expect(mission.arriveAtMs!).toBeGreaterThan(1_000_000)
  })

  it('10s acumulados → 5 stacks → congela (paralyzeHold setado)', () => {
    const { s, mission } = snowState({ window: { startMs: 0, endMs: 1_000_000 } })
    processSnow(s, 0, 10_000)
    expect(mission.snow?.stacks).toBe(5)
    expect(mission.snow?.frozenAtMs).toBe(10_000)
    expect(mission.paralyzeHold).toBeTruthy()
  })

  it('congelado terrestre perde 1 HP a cada 2s; sobreviventes seguem (missão não falha)', () => {
    const { s, mission, id } = snowState({ window: { startMs: 0, endMs: 1_000_000 }, hp: 5 })
    processSnow(s, 0, 10_000) // congela
    processSnow(s, 10_000, 14_000) // 2 drenos de 2s
    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(3)
    expect(mission.status).toBe('traveling') // sobreviventes seguem
  })

  it('voador morre ao congelar: time desmaia e a missão falha', () => {
    const { s, mission, id } = snowState({ window: { startMs: 0, endMs: 1_000_000 }, flying: true })
    processSnow(s, 0, 10_000)
    expect(mission.status).toBe('resolved')
    expect(mission.result).toBe('failure')
    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(0)
  })

  it('descongela 2s após a janela acabar (zera snow e paralyzeHold)', () => {
    const { s, mission } = snowState({ window: { startMs: 0, endMs: 50_000 } })
    processSnow(s, 0, 10_000) // congela; thawAtMs = 50_000 + 2_000
    expect(mission.snow?.thawAtMs).toBe(52_000)
    processSnow(s, 10_000, 52_001) // passou do thaw
    expect(mission.snow).toBeUndefined()
    expect(mission.paralyzeHold).toBeUndefined()
  })

  it('Clear Body → imune (sem stacks/freeze)', () => {
    const { s, mission } = snowState({ window: { startMs: 0, endMs: 1_000_000 }, clearBody: true })
    processSnow(s, 0, 10_000)
    expect(mission.snow).toBeUndefined()
    expect(mission.paralyzeHold).toBeUndefined()
  })

  it('robusto a saltos: um único tick grande já congela', () => {
    const { s, mission } = snowState({ window: { startMs: 0, endMs: 1_000_000 } })
    processSnow(s, 0, 20_000)
    expect(mission.snow?.stacks).toBe(5)
    expect(mission.snow?.frozenAtMs).toBe(20_000)
  })
})
