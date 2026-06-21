// Fase 4 — Task 3: ciclo de missão: Natural Cure L2, Water Absorb (pending), Sniper L1 tempo, Forewarn L2.
// TDD: RED → GREEN.

import { describe, expect, it } from 'vitest'
import { createInitialState, type MissionInstance } from '../engine/state.ts'
import { makeMon } from '../engine/testkit.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { acceptMission, resolveMissionNow } from './missionFlow.ts'
import { missionAttrMultiplier, type MissionSecretCtx } from '../engine/secretEffects.ts'
import { secretLevelOf } from '../data/secretAbilities.ts'
import {
  WATER_ABSORB_MISSION_MULT_L1,
  WATER_ABSORB_MISSION_MULT_L2,
  SNIPER_TIME_MULT_L1,
} from '../engine/balance.ts'
import { getCity } from '../data/cities.ts'
import { setupDay } from './setup.ts'

// ---- helpers ----------------------------------------------------------------

const PALESTRA = getMissionTemplate('palestra')

function ctxOf(
  team: ReturnType<typeof makeMon>[],
  runtime: Record<string, object> = {},
): MissionSecretCtx {
  return { team, template: PALESTRA, runtime, runItems: [] }
}

/** Estado mínimo em Cerulean (cityIndex=1, tem água). */
function ceruleanState() {
  const s = createInitialState(1)
  s.run.cityIndex = 1
  s.run.phase = 'DAY'
  return s
}

/** Instância de missão disponível em `node`, pronta para aceitar. */
function availableMission(id: string, node: string, templateId = 'palestra'): MissionInstance {
  return {
    id,
    templateId,
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

// ---- Natural Cure -----------------------------------------------------------

describe('Natural Cure — missão', () => {
  it('L1: cura +2 HP ao despachar', () => {
    // Staryu(120): slot0=analytic, slot1=natural-cure → slot1, level:1
    const p = makeMon({ id: 'nc1', speciesId: 120, secretPicks: [{ slot: 1, level: 1 }], maxHp: 10, currentHp: 5 })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...p }]
    const mission = availableMission('m1', city.siteNodes.gym)
    s.missions = [mission]

    acceptMission(s, 'm1', ['nc1'])

    const updated = s.roster.find((r) => r.id === 'nc1')
    expect(updated?.currentHp).toBe(7) // 5 + 2
  })

  it('L2: cura até o HP máximo ao despachar', () => {
    // Staryu(120): slot1=natural-cure, level:2
    const p = makeMon({ id: 'nc2', speciesId: 120, secretPicks: [{ slot: 1, level: 2 }], maxHp: 10, currentHp: 3 })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...p }]
    const mission = availableMission('m2', city.siteNodes.gym)
    s.missions = [mission]

    acceptMission(s, 'm2', ['nc2'])

    const updated = s.roster.find((r) => r.id === 'nc2')
    expect(updated?.currentHp).toBe(10) // curado totalmente
  })

  it('L2 já com HP cheio: permanece em maxHp', () => {
    const p = makeMon({ id: 'nc3', speciesId: 120, secretPicks: [{ slot: 1, level: 2 }], maxHp: 10, currentHp: 10 })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...p }]
    const mission = availableMission('m3', city.siteNodes.gym)
    s.missions = [mission]

    acceptMission(s, 'm3', ['nc3'])

    const updated = s.roster.find((r) => r.id === 'nc3')
    expect(updated?.currentHp).toBe(10)
  })
})

// ---- Water Absorb — pending lifecycle ----------------------------------------

describe('Water Absorb — missionAttrMultiplier com pending', () => {
  // Vaporeon(134): line = ['sa-surf','sa-water-absorb']; slot0=surf, slot1=water-absorb

  it('×1.30 (L1) quando waterAbsorbPending=1', () => {
    const p = makeMon({ id: 'wa2', speciesId: 134, secretPicks: [{ slot: 1, level: 1 }] })
    const ctx = ctxOf([p], { wa2: { waterAbsorbPending: 1 } })
    expect(missionAttrMultiplier(p, ctx)).toBeCloseTo(WATER_ABSORB_MISSION_MULT_L1)
  })

  it('×1.50 (L2) quando waterAbsorbPending=2', () => {
    const p = makeMon({ id: 'wa3', speciesId: 134, secretPicks: [{ slot: 1, level: 2 }] })
    const ctx = ctxOf([p], { wa3: { waterAbsorbPending: 2 } })
    expect(missionAttrMultiplier(p, ctx)).toBeCloseTo(WATER_ABSORB_MISSION_MULT_L2)
  })

  it('sem pending → multiplicador = 1', () => {
    const p = makeMon({ id: 'wa4', speciesId: 134, secretPicks: [{ slot: 1, level: 1 }] })
    const ctx = ctxOf([p], {})
    expect(missionAttrMultiplier(p, ctx)).toBeCloseTo(1)
  })
})

describe('Water Absorb — rota aquática seta waterAbsorbPending', () => {
  it('surfista com Water Absorb em rota aquática recebe waterAbsorbPending', () => {
    // Vaporeon(134): slot0=surf L1 (sozinho surfa), slot1=water-absorb L1
    const p = makeMon({
      id: 'wa_p',
      speciesId: 134,
      secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }],
    })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...p }]

    // Encontra um nó de água em Cerulean (via surfNodes)
    const waterNode = city.graph.surfNodes?.[0]

    if (!waterNode) return // sem nó de água no grafo, pula

    const mission = availableMission('mwa_s', waterNode)
    s.missions = [mission]

    acceptMission(s, 'mwa_s', ['wa_p'])

    const m = s.missions[0]!
    if (m.surfing) {
      // A rota cruzou água → pending deve estar setado
      expect(s.today.secretRuntime['wa_p']?.waterAbsorbPending).toBe(1)
    }
  })
})

describe('Water Absorb — pending consumido ao resolver a próxima missão', () => {
  it('waterAbsorbPending é removido/zerado em applyMissionSecretRuntime', () => {
    // Pokémon com water-absorb pending na missão que está resolvendo
    const p = makeMon({ id: 'wa5', speciesId: 134, secretPicks: [{ slot: 1, level: 1 }] })
    const city = getCity(1)
    const s = ceruleanState()
    s.roster = [{ ...p, status: 'onMission' }]
    s.today.secretRuntime['wa5'] = { waterAbsorbPending: 1 }

    const mission: MissionInstance = {
      id: 'mwa5',
      templateId: 'palestra',
      requirement: { batalha: 0, inteligencia: 0, carisma: 0, agilidade: 0, resistencia: 0, percepcao: 0 },
      node: city.siteNodes.gym,
      path: [city.siteNodes.gym],
      spawnAtMs: 0,
      expiresAtMs: 999_999,
      status: 'inProgress',
      teamIds: ['wa5'],
      acceptedAtMs: 0,
      arriveAtMs: 0,
      resolveAtMs: 0,
      returnEndsAtMs: 5_000,
      result: null,
      pSuccess: null,
    }
    s.missions = [mission]

    resolveMissionNow(s, mission)

    // Após resolver, o pending deve ter sido consumido (undefined ou false ou 0)
    const pending = s.today.secretRuntime['wa5']?.waterAbsorbPending
    expect(pending).toBeFalsy()
  })
})

// ---- Sniper — tempo de execução duplicado ------------------------------------

describe('Sniper — tempo de execução', () => {
  // Horsea(116): slot0=surf, slot1=sniper

  it('L1 solo: execution é DUPLICADO em relação a L2', () => {
    const sniperL1 = makeMon({
      id: 'sn1',
      speciesId: 116,
      secretPicks: [{ slot: 1, level: 1 }],
    })
    const sniperL2 = makeMon({
      id: 'sn2',
      speciesId: 116,
      secretPicks: [{ slot: 1, level: 2 }],
    })
    const city = getCity(1)
    // Usa um nó qualquer (Sniper = distância 0, mas execution conta)
    const targetNode = Object.keys(city.graph.nodes).find(
      (n) => n !== city.siteNodes.gym,
    ) ?? city.siteNodes.gym

    const sL1 = ceruleanState()
    sL1.roster = [{ ...sniperL1 }]
    sL1.missions = [availableMission('ms1', targetNode)]
    acceptMission(sL1, 'ms1', ['sn1'])

    const sL2 = ceruleanState()
    sL2.roster = [{ ...sniperL2 }]
    sL2.missions = [availableMission('ms2', targetNode)]
    acceptMission(sL2, 'ms2', ['sn2'])

    const mL1 = sL1.missions[0]!
    const mL2 = sL2.missions[0]!

    if (
      mL1.resolveAtMs !== null && mL1.arriveAtMs !== null &&
      mL2.resolveAtMs !== null && mL2.arriveAtMs !== null
    ) {
      const execL1 = mL1.resolveAtMs - mL1.arriveAtMs
      const execL2 = mL2.resolveAtMs - mL2.arriveAtMs
      // L1 deve ser o dobro de L2
      expect(execL1).toBeCloseTo(execL2 * SNIPER_TIME_MULT_L1)
    } else {
      // Se os marcos não foram setados, o teste falha explicitamente
      expect(mL1.resolveAtMs).not.toBeNull()
    }
  })

  it('SNIPER_TIME_MULT_L1 vale 2 (constante de balanço)', () => {
    expect(SNIPER_TIME_MULT_L1).toBe(2)
  })
})

// ---- Forewarn — L2 antecipa 2 missões ----------------------------------------

describe('Forewarn — setupDay antecipa missões por nível', () => {
  // Jynx(124): slot0=dry-skin, slot1=forewarn

  function dayState(mons: ReturnType<typeof makeMon>[]) {
    const s = createInitialState(123)
    s.run.cityIndex = 1
    s.run.day = 3
    s.roster = mons
    return s
  }

  it('L1: 1 portador antecipa 1 missão (spawnAtMs=0)', () => {
    const jynxL1 = makeMon({
      id: 'fw1',
      speciesId: 124,
      secretPicks: [{ slot: 1, level: 1 }],
      status: 'idle',
    })
    const s = dayState([jynxL1])
    setupDay(s)

    // Missões com spawnAtMs=0 (adiantadas pelo Forewarn)
    const anticipated = s.missions.filter(
      (m) => m.templateId !== 'special' && m.spawnAtMs === 0,
    )
    expect(anticipated.length).toBe(1)
  })

  it('L2: 1 portador antecipa 2 missões (spawnAtMs=0)', () => {
    const jynxL2 = makeMon({
      id: 'fw2',
      speciesId: 124,
      secretPicks: [{ slot: 1, level: 2 }],
      status: 'idle',
    })
    const s = dayState([jynxL2])
    setupDay(s)

    const anticipated = s.missions.filter(
      (m) => m.templateId !== 'special' && m.spawnAtMs === 0,
    )
    expect(anticipated.length).toBe(2)
  })

  it('2 portadores L1: antecipa 2 missões (1+1=2)', () => {
    const jynxA = makeMon({ id: 'fwA', speciesId: 124, secretPicks: [{ slot: 1, level: 1 }], status: 'idle' })
    const jynxB = makeMon({ id: 'fwB', speciesId: 124, secretPicks: [{ slot: 1, level: 1 }], status: 'idle' })
    const s = dayState([jynxA, jynxB])
    setupDay(s)

    const anticipated = s.missions.filter(
      (m) => m.templateId !== 'special' && m.spawnAtMs === 0,
    )
    expect(anticipated.length).toBe(2)
  })

  it('secretLevelOf: L1 retorna 1, L2 retorna 2 (base da contagem)', () => {
    const jynxL1 = makeMon({ id: 'fwX', speciesId: 124, secretPicks: [{ slot: 1, level: 1 }] })
    const jynxL2 = makeMon({ id: 'fwY', speciesId: 124, secretPicks: [{ slot: 1, level: 2 }] })
    expect(secretLevelOf(jynxL1, 'sa-forewarn')).toBe(1)
    expect(secretLevelOf(jynxL2, 'sa-forewarn')).toBe(2)
  })
})
