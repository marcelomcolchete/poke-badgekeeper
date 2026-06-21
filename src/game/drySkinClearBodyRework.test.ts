// Fase 4 — Task 8: Dry Skin (NOVO) + Clear Body rework (L1=paralyze immunity, L2=debuff clamp).
// TDD: RED → GREEN.

import { describe, expect, it } from 'vitest'
import { createInitialState, type MissionInstance } from '../engine/state.ts'
import { makeMon } from '../engine/testkit.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { acceptMission } from './missionFlow.ts'
import { processStorms } from './stormFlow.ts'
import { autoSeedRun } from './setup.ts'
import {
  hasDrySkin,
  missionAttrMultiplier,
  missionEffectBreakdown,
  type MissionSecretCtx,
} from '../engine/secretEffects.ts'
import {
  DRY_SKIN_RAIN_HEAL_FRAC,
  DRY_SKIN_MISSION_BONUS_L2,
  HUSTLE_MISSION_MULT_L1,
} from '../engine/balance.ts'
import type { WeatherSchedule } from '../engine/weather.ts'
import type { StormEvent } from '../engine/storm.ts'
import { getCity } from '../data/cities.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'

// ---- Weather fixtures --------------------------------------------------------

const rainAllDay: WeatherSchedule = {
  rain: [{ startMs: 0, endMs: 200_000, puddles: [] }],
  storms: [],
  forecast: {
    rainChancePercent: 100,
    rainMmPerHour: 30,
    potentialRainCount: 1,
    stormChancePercent: 0,
    potentialStormCount: 0,
  },
}

const drySchedule: WeatherSchedule = {
  rain: [],
  storms: [],
  forecast: {
    rainChancePercent: 0,
    rainMmPerHour: 0,
    potentialRainCount: 0,
    stormChancePercent: 0,
    potentialStormCount: 0,
  },
}

// ---- Mission helpers ---------------------------------------------------------

const PALESTRA = getMissionTemplate('palestra')

function ctxOf(
  team: ReturnType<typeof makeMon>[],
  opts: Partial<MissionSecretCtx> = {},
): MissionSecretCtx {
  return { team, template: PALESTRA, runtime: {}, runItems: [], ...opts }
}

/** Estado mínimo em Cerulean (cityIndex=1). */
function ceruleanState() {
  const s = createInitialState(1)
  s.run.cityIndex = 1
  s.run.phase = 'DAY'
  return s
}

function availableMission(id: string, node: string): MissionInstance {
  return {
    id,
    templateId: 'palestra',
    requirement: { batalha: 0, inteligencia: 0, carisma: 0, agilidade: 0, resistencia: 0, percepcao: 0 },
    node,
    path: [],
    spawnAtMs: 0,
    expiresAtMs: 999_999,
    status: 'available',
    teamIds: [],
    acceptedAtMs: null,
    arriveAtMs: null,
    resolveAtMs: null,
    returnEndsAtMs: null,
    result: null,
    pSuccess: null,
  }
}

// ---- Storm helper (mirrors stormFlow.test.ts travelingState) -----------------

function travelingStateWithMon(
  secretPicks: { slot: 0 | 1; level: 1 | 2 }[],
  speciesId: number,
): { s: ReturnType<typeof autoSeedRun>; id: string; pos: { x: number; y: number } } {
  const s = autoSeedRun(42)
  s.run.phase = 'DAY'
  const base = s.roster[0]!
  const id = base.id

  const city = getCity(s.run.cityIndex)
  const gym = city.siteNodes.gym
  const neighbors = city.graph.adj[gym] ?? []
  const neighbor = neighbors[0]
  if (!neighbor) throw new Error(`Gym '${gym}' has no neighbors`)

  s.roster[0] = makeMon({
    id,
    speciesId,
    secretPicks,
    currentHp: 5,
    maxHp: 5,
    status: 'traveling' as const,
  })

  s.missions = [
    {
      id: 'm1',
      templateId: 'house',
      requirement: {} as never,
      node: neighbor,
      path: [gym, neighbor],
      returnPath: [neighbor, gym],
      spawnAtMs: 0,
      expiresAtMs: 999_999,
      status: 'traveling',
      teamIds: [id],
      acceptedAtMs: 0,
      arriveAtMs: 10_000,
      resolveAtMs: 20_000,
      returnEndsAtMs: 30_000,
      result: null,
      pSuccess: null,
    },
  ]

  const pos = travelerPositionsAt(s, 5_000).find((t) => t.id === id)!.pos
  return { s, id, pos }
}

function strikeAtPos(pos: { x: number; y: number }, strikeAtMs = 5_000): StormEvent {
  return {
    startMs: 0,
    endMs: 30_000,
    strikes: [{ warnAtMs: 0, strikeAtMs, circles: [{ cx: pos.x, cy: pos.y, radius: 0.3 }] }],
  }
}

// =============================================================================
// Dry Skin
// =============================================================================

// Jynx(124): slot0=dry-skin, slot1=forewarn

describe('hasDrySkin predicado', () => {
  it('retorna true para Jynx com dry-skin desbloqueado (slot0)', () => {
    const jynx = makeMon({ id: 'j', speciesId: 124, secretPicks: [{ slot: 0, level: 1 }] })
    expect(hasDrySkin(jynx)).toBe(true)
  })

  it('retorna false quando dry-skin não desbloqueado', () => {
    const jynx = makeMon({ id: 'j', speciesId: 124, secretPicks: [] })
    expect(hasDrySkin(jynx)).toBe(false)
  })
})

describe('Dry Skin — cura ao sair em missão na chuva', () => {
  it('L1: cura ceil(25% maxHp) ao despachar enquanto chove', () => {
    const maxHp = 10
    // ceil(0.25 × 10) = 3
    const expectedHeal = Math.ceil(DRY_SKIN_RAIN_HEAL_FRAC * maxHp)
    const jynx = makeMon({
      id: 'ds1',
      speciesId: 124,
      secretPicks: [{ slot: 0, level: 1 }],
      maxHp,
      currentHp: 4,
    })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...jynx }]
    s.weather = rainAllDay
    s.clock = { ...s.clock, dayElapsedMs: 5_000 }
    const mission = availableMission('m1', city.siteNodes.gym)
    s.missions = [mission]

    acceptMission(s, 'm1', ['ds1'])

    const updated = s.roster.find((r) => r.id === 'ds1')!
    expect(updated.currentHp).toBe(Math.min(maxHp, 4 + expectedHeal))
  })

  it('L1: cura não ultrapassa maxHp', () => {
    const jynx = makeMon({
      id: 'ds2',
      speciesId: 124,
      secretPicks: [{ slot: 0, level: 1 }],
      maxHp: 10,
      currentHp: 9,
    })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...jynx }]
    s.weather = rainAllDay
    s.clock = { ...s.clock, dayElapsedMs: 5_000 }
    const mission = availableMission('m2', city.siteNodes.gym)
    s.missions = [mission]

    acceptMission(s, 'm2', ['ds2'])

    const updated = s.roster.find((r) => r.id === 'ds2')!
    expect(updated.currentHp).toBe(10)
  })

  it('L1: SEM chuva → nenhuma cura extra (permanece com HP original)', () => {
    const jynx = makeMon({
      id: 'ds3',
      speciesId: 124,
      secretPicks: [{ slot: 0, level: 1 }],
      maxHp: 10,
      currentHp: 4,
    })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...jynx }]
    s.weather = drySchedule
    s.clock = { ...s.clock, dayElapsedMs: 5_000 }
    const mission = availableMission('m3', city.siteNodes.gym)
    s.missions = [mission]

    acceptMission(s, 'm3', ['ds3'])

    const updated = s.roster.find((r) => r.id === 'ds3')!
    expect(updated.currentHp).toBe(4)
  })

  it('L2: também cura ceil(25% maxHp) na chuva', () => {
    const maxHp = 8
    const expectedHeal = Math.ceil(DRY_SKIN_RAIN_HEAL_FRAC * maxHp)
    const jynx = makeMon({
      id: 'ds4',
      speciesId: 124,
      secretPicks: [{ slot: 0, level: 2 }],
      maxHp,
      currentHp: 2,
    })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...jynx }]
    s.weather = rainAllDay
    s.clock = { ...s.clock, dayElapsedMs: 5_000 }
    const mission = availableMission('m4', city.siteNodes.gym)
    s.missions = [mission]

    acceptMission(s, 'm4', ['ds4'])

    const updated = s.roster.find((r) => r.id === 'ds4')!
    expect(updated.currentHp).toBe(Math.min(maxHp, 2 + expectedHeal))
  })
})

describe('Dry Skin L2 — bônus de atributo de missão na chuva (+25%)', () => {
  it('L2: +25% de atributos na chuva', () => {
    const jynx = makeMon({ id: 'ds5', speciesId: 124, secretPicks: [{ slot: 0, level: 2 }] })
    const ctx = ctxOf([jynx], { weather: rainAllDay, nowMs: 5_000 })
    expect(missionAttrMultiplier(jynx, ctx)).toBeCloseTo(1 + DRY_SKIN_MISSION_BONUS_L2)
  })

  it('L2: SEM bônus quando não está chovendo', () => {
    const jynx = makeMon({ id: 'ds6', speciesId: 124, secretPicks: [{ slot: 0, level: 2 }] })
    const ctx = ctxOf([jynx], { weather: drySchedule, nowMs: 5_000 })
    expect(missionAttrMultiplier(jynx, ctx)).toBeCloseTo(1.0)
  })

  it('L1: NÃO ganha o bônus de atributo (apenas L2)', () => {
    const jynx = makeMon({ id: 'ds7', speciesId: 124, secretPicks: [{ slot: 0, level: 1 }] })
    const ctx = ctxOf([jynx], { weather: rainAllDay, nowMs: 5_000 })
    expect(missionAttrMultiplier(jynx, ctx)).toBeCloseTo(1.0)
  })

  it('L2: sem ctx.weather/nowMs → sem bônus (guarda call sites antigos)', () => {
    const jynx = makeMon({ id: 'ds8', speciesId: 124, secretPicks: [{ slot: 0, level: 2 }] })
    const ctx = ctxOf([jynx])
    expect(missionAttrMultiplier(jynx, ctx)).toBeCloseTo(1.0)
  })
})

// =============================================================================
// Clear Body rework
// =============================================================================

// Tentacool(72): slot0=clear-body, slot1=surf

describe('Clear Body rework — L1 NÃO anula debuff de atributo (apenas L2 anula)', () => {
  it('L1: Hustle ainda aplica penalidade (mult < 1 não é clampado)', () => {
    // Nidoran♀(29): slot1=hustle
    const nido = makeMon({
      id: 'n',
      speciesId: 29,
      secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }],
      gender: 'female' as const,
    })
    // Clear Body L1
    const tentacool = makeMon({ id: 't', speciesId: 72, secretPicks: [{ slot: 0, level: 1 }] })
    // Com Clear Body L1 no time, a penalidade do Hustle do Nidoran deve CONTINUAR aplicando
    expect(missionAttrMultiplier(nido, ctxOf([nido, tentacool]))).toBeCloseTo(
      HUSTLE_MISSION_MULT_L1,
    )
  })

  it('L2: Hustle é anulado (mult clampado a 1)', () => {
    const nido = makeMon({
      id: 'n2',
      speciesId: 29,
      secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }],
      gender: 'female' as const,
    })
    // Clear Body L2
    const tentacool = makeMon({ id: 't2', speciesId: 72, secretPicks: [{ slot: 0, level: 2 }] })
    expect(missionAttrMultiplier(nido, ctxOf([nido, tentacool]))).toBe(1)
  })

  it('L2 sozinho (sem aliados): não muda mult=1 (neutro)', () => {
    const tentacool = makeMon({ id: 't3', speciesId: 72, secretPicks: [{ slot: 0, level: 2 }] })
    expect(missionAttrMultiplier(tentacool, ctxOf([tentacool]))).toBe(1)
  })
})

describe('Clear Body rework — L1 imunidade ao Paralyze do raio', () => {
  it('L1: time com Clear Body não é paralisado nem perde HP no raio', () => {
    const { s, id, pos } = travelingStateWithMon([{ slot: 0, level: 1 }], 72 /* Tentacool */)
    s.weather = { ...s.weather, storms: [strikeAtPos(pos)] }
    const hpBefore = s.roster.find((p) => p.id === id)!.currentHp

    processStorms(s, 0, 6_000)

    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(hpBefore) // sem dano
    expect(s.today.paralyzedBattleIds).not.toContain(id) // sem Paralyze
    expect(s.missions[0]!.paralyzeHold).toBeUndefined() // container não congelado
  })

  it('L2: team com Clear Body L2 também é imune ao Paralyze', () => {
    const { s, id, pos } = travelingStateWithMon([{ slot: 0, level: 2 }], 72 /* Tentacool */)
    s.weather = { ...s.weather, storms: [strikeAtPos(pos)] }
    const hpBefore = s.roster.find((p) => p.id === id)!.currentHp

    processStorms(s, 0, 6_000)

    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(hpBefore)
    expect(s.today.paralyzedBattleIds).not.toContain(id)
  })

  it('sem Clear Body: o raio aplica dano e Paralyze normalmente', () => {
    // Tentacool sem secretPicks → sem Clear Body
    const { s, id, pos } = travelingStateWithMon([], 72)
    s.weather = { ...s.weather, storms: [strikeAtPos(pos)] }
    const hpBefore = s.roster.find((p) => p.id === id)!.currentHp

    processStorms(s, 0, 6_000)

    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(hpBefore - 1)
    expect(s.today.paralyzedBattleIds).toContain(id)
  })

  it('imunidade vale para TODOS do time se qualquer membro tem Clear Body L1', () => {
    const { s, pos } = travelingStateWithMon([], 72) // Tentacool sem CB
    const mission = s.missions[0]!
    const idA = s.roster[0]!.id

    // Segundo membro: Clear Body L1
    const cbMon = makeMon({
      id: 'cb_teammate',
      speciesId: 72,
      secretPicks: [{ slot: 0, level: 1 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster.push(cbMon)
    mission.teamIds = [idA, cbMon.id]

    s.weather = { ...s.weather, storms: [strikeAtPos(pos)] }
    const hpA = s.roster.find((p) => p.id === idA)!.currentHp

    processStorms(s, 0, 6_000)

    expect(s.roster.find((p) => p.id === idA)!.currentHp).toBe(hpA) // sem dano
    expect(s.today.paralyzedBattleIds).not.toContain(idA)
    expect(s.today.paralyzedBattleIds).not.toContain(cbMon.id)
  })
})

describe('missionEffectBreakdown — Clear Body L1 não aparece como info sem debuff L2', () => {
  it('Clear Body L1 com perda de atributo no time: NÃO aparece como "info" (L1 não anula debuff)', () => {
    // Nidoran♀(29) slot1=hustle L1 → mult < 1
    const nido = makeMon({
      id: 'nb1',
      speciesId: 29,
      secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }],
      gender: 'female' as const,
    })
    const tentacool = makeMon({ id: 'tb1', speciesId: 72, secretPicks: [{ slot: 0, level: 1 }] })
    // Patrulha: Analytic tem penalidade
    const ctx = ctxOf([nido, tentacool])
    const entries = missionEffectBreakdown(ctx)
    // Clear Body L1 não deve aparecer como "info" (pois não anula debuffs)
    expect(entries.find((e) => e.id === 'clear-body')).toBeUndefined()
  })

  it('Clear Body L2 com perda de atributo no time: APARECE como "info" (L2 anula debuff)', () => {
    const nido = makeMon({
      id: 'nb2',
      speciesId: 29,
      secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }],
      gender: 'female' as const,
    })
    const tentacool = makeMon({ id: 'tb2', speciesId: 72, secretPicks: [{ slot: 0, level: 2 }] })
    const ctx = ctxOf([nido, tentacool])
    const entries = missionEffectBreakdown(ctx)
    const cbEntry = entries.find((e) => e.id === 'clear-body')
    expect(cbEntry).toBeDefined()
    expect(cbEntry?.direction).toBe('info')
  })
})
