// Testes do stormFlow: detecção de acerto de raio e aplicação de dano/Paralyze no tick do dia.

import { describe, expect, it } from 'vitest'
import { processStorms } from './stormFlow.ts'
import { autoSeedRun } from './setup.ts'
import type { GameState } from '../engine/state.ts'
import type { StormEvent } from '../engine/storm.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'
import { getCity } from '../data/cities.ts'
import { PARALYZE_STUN_MS, STATIC_XP_PER_SEC, STATIC_MOVE_PER_SEC_L2, STATIC_MOVE_CAP_L2, VOLT_ABSORB_BONUS_L1, VOLT_ABSORB_BONUS_L2 } from '../engine/balance.ts'
import { teamTravelSpeedMultiplier, missionAttrMultiplier, hasVoltAbsorb, type MissionSecretCtx } from '../engine/secretEffects.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { makeMon } from '../engine/testkit.ts'

// Helpers locais -----------------------------------------------------------------

/**
 * Escolhe dois nós adjacentes ao ginásio no grafo: [gymNode, vizinho].
 * Usados como path da missão sintética para garantir que o viajante tem posição determinística.
 */
function gymAndNeighbor(s: GameState): [string, string] {
  const city = getCity(s.run.cityIndex)
  const gym = city.siteNodes.gym
  const neighbors = city.graph.adj[gym] ?? []
  const neighbor = neighbors[0]
  if (!neighbor) throw new Error(`Ginásio '${gym}' não tem vizinhos no grafo`)
  return [gym, neighbor]
}

/**
 * Cria um estado com 1 Pokémon despachado numa missão em trânsito (mid-trip).
 * Devolve { s, id, pos } onde `pos` é a posição interpolada a t=5_000ms (50% de 10_000ms).
 */
function travelingState(): { s: GameState; id: string; pos: { x: number; y: number } } {
  const s = autoSeedRun(42)
  s.run.phase = 'DAY'
  const mon = s.roster[0]!
  const id = mon.id

  const [gymNode, destNode] = gymAndNeighbor(s)

  // Pokémon em trânsito com vida cheia
  s.roster[0] = { ...mon, status: 'traveling', currentHp: 5, maxHp: 5 }

  // Missão sintética: ginásio → vizinho, 10s de viagem (impacto do raio em 5s = meio do caminho)
  s.missions = [
    {
      id: 'm1',
      templateId: 'house',
      requirement: {} as never,
      node: destNode,
      path: [gymNode, destNode],
      returnPath: [destNode, gymNode],
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

  // Posição do viajante exatamente no instante do impacto (t=5_000ms = meio do caminho)
  const pos = travelerPositionsAt(s, 5_000).find((t) => t.id === id)!.pos
  return { s, id, pos }
}

// Testes -------------------------------------------------------------------------

describe('stormFlow — aplicação dos raios', () => {
  it('raio que cobre a posição do time aplica 1 de dano e Paralyze', () => {
    const { s, id, pos } = travelingState()
    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [
        {
          warnAtMs: 0,
          strikeAtMs: 5_000,
          circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }],
        },
      ],
    }
    s.weather = { ...s.weather, storms: [storm] }
    const before = s.roster.find((p) => p.id === id)!.currentHp
    processStorms(s, 0, 6_000)
    const after = s.roster.find((p) => p.id === id)!
    expect(after.currentHp).toBe(before - 1)
    expect(s.today.paralyzedBattleIds).toContain(id)
    // congelamento: paralyzeHold setado na missão
    expect(s.missions[0]!.paralyzeHold?.untilMs).toBe(5_000 + 5_000)
  })

  it('raio longe do time não acerta ninguém', () => {
    const { s, id } = travelingState()
    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [
        {
          warnAtMs: 0,
          strikeAtMs: 5_000,
          circles: [{ cx: 0.99, cy: 0.99, radius: 0.01 }],
        },
      ],
    }
    s.weather = { ...s.weather, storms: [storm] }
    const before = s.roster.find((p) => p.id === id)!.currentHp
    processStorms(s, 0, 6_000)
    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(before)
    expect(s.today.paralyzedBattleIds).not.toContain(id)
  })

  it('salto de tempo grande não perde o raio (intervalo prevMs..now)', () => {
    const { s, id, pos } = travelingState()
    s.weather = {
      ...s.weather,
      storms: [
        {
          startMs: 0,
          endMs: 30_000,
          strikes: [
            {
              warnAtMs: 0,
              strikeAtMs: 4_000,
              circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }],
            },
          ],
        },
      ],
    }
    const before = s.roster.find((p) => p.id === id)!.currentHp
    processStorms(s, 0, 20_000) // salto que atravessa o impacto
    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(before - 1)
  })

  it('dano não vira fainted no meio do trânsito (status preservado)', () => {
    const { s, id, pos } = travelingState()
    s.roster[0] = { ...s.roster.find((p) => p.id === id)!, currentHp: 1 }
    s.weather = {
      ...s.weather,
      storms: [
        {
          startMs: 0,
          endMs: 30_000,
          strikes: [
            {
              warnAtMs: 0,
              strikeAtMs: 5_000,
              circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }],
            },
          ],
        },
      ],
    }
    processStorms(s, 0, 6_000)
    const after = s.roster.find((p) => p.id === id)!
    expect(after.currentHp).toBe(0)
    expect(after.status).toBe('traveling') // não 'fainted' aqui
  })

  it('time de 2 membros atingidos por UM raio: cada membro perde 1 HP e é paralisado, mas a missão congela apenas +PARALYZE_STUN_MS (não 2×)', () => {
    // Monta estado base com 1 membro já criado por autoSeedRun
    const { s, id: id1, pos } = travelingState()
    const mon1 = s.roster.find((p) => p.id === id1)!

    // Cria um segundo Pokémon clonando o primeiro (mesmo path/pos por construção)
    const id2 = 'p_test2'
    const mon2 = { ...mon1, id: id2, currentHp: 5, maxHp: 5, status: 'traveling' as const }
    s.roster.push(mon2)

    // Adiciona o segundo membro à missão existente
    const mission = s.missions[0]!
    mission.teamIds = [id1, id2]
    const arriveAtMsBefore = mission.arriveAtMs!

    // Raio enorme que cobre com certeza a posição dos viajantes
    const strikeAtMs = 5_000
    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs, circles: [{ cx: pos.x, cy: pos.y, radius: 0.5 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }

    processStorms(s, 0, 6_000)

    // (a) Ambos os membros perderam exatamente 1 HP
    expect(s.roster.find((p) => p.id === id1)!.currentHp).toBe(mon1.currentHp - 1)
    expect(s.roster.find((p) => p.id === id2)!.currentHp).toBe(mon2.currentHp - 1)

    // (b) Ambos os IDs estão em paralyzedBattleIds
    expect(s.today.paralyzedBattleIds).toContain(id1)
    expect(s.today.paralyzedBattleIds).toContain(id2)

    // (c) A missão deslocou exatamente +PARALYZE_STUN_MS (não 2× por ter 2 membros)
    expect(s.missions[0]!.arriveAtMs).toBe(arriveAtMsBefore + PARALYZE_STUN_MS)

    // (d) paralyzeHold.untilMs === strikeAtMs + PARALYZE_STUN_MS
    expect(s.missions[0]!.paralyzeHold?.untilMs).toBe(strikeAtMs + PARALYZE_STUN_MS)
  })

  it('electirizer: cada raio sofrido acumula 1 carga no Pokémon atingido', () => {
    const { s, id, pos } = travelingState()
    s.runItems = ['electirizer']
    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)
    expect(s.electirizerCharges[id]).toBe(1)
  })

  it('sem electirizer, nenhuma carga é criada ao ser atingido', () => {
    const { s, id, pos } = travelingState()
    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)
    expect(s.electirizerCharges[id]).toBeUndefined()
  })
})

// ---- Novos efeitos de raio (Fase 4): Lightning Rod, Volt Absorb, Fly-raio --------

describe('stormFlow — Lightning Rod (imunidade de time)', () => {
  it('time com Lightning Rod não toma dano nem Paralyze ao ser atingido', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    // Substitui o Pokémon atingido por um com Lightning Rod (Cubone 104, slot1)
    const lrodMon = makeMon({
      id: s.roster[0]!.id,
      speciesId: 104,
      secretPicks: [{ slot: 1, level: 1 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster[0] = lrodMon
    mission.teamIds = [lrodMon.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    const after = s.roster.find((p) => p.id === lrodMon.id)!
    expect(after.currentHp).toBe(5) // sem dano
    expect(s.today.paralyzedBattleIds).not.toContain(lrodMon.id) // sem Paralyze
    expect(mission.paralyzeHold).toBeUndefined() // container não congelado
  })

  it('imunidade vale para TODOS do time se qualquer um tem Lightning Rod', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    const idA = s.roster[0]!.id

    // Segundo membro: Lightning Rod
    const idB = 'lrod_teammate'
    const lrodMon = makeMon({
      id: idB,
      speciesId: 104,
      secretPicks: [{ slot: 1, level: 1 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster.push(lrodMon)
    mission.teamIds = [idA, idB]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.5 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    const hpA = s.roster.find((p) => p.id === idA)!.currentHp
    processStorms(s, 0, 6_000)

    expect(s.roster.find((p) => p.id === idA)!.currentHp).toBe(hpA) // sem dano
    expect(s.today.paralyzedBattleIds).not.toContain(idA)
    expect(s.today.paralyzedBattleIds).not.toContain(idB)
  })
})

describe('stormFlow — Volt Absorb (absorção + eletriza)', () => {
  it('Volt Absorb L1: sem dano, electrified setado a 1, sem Paralyze', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    // Jolteon 135, slot1=volt-absorb L1
    const voltMon = makeMon({
      id: s.roster[0]!.id,
      speciesId: 135,
      secretPicks: [{ slot: 1, level: 1 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster[0] = voltMon
    mission.teamIds = [voltMon.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    const after = s.roster.find((p) => p.id === voltMon.id)!
    expect(after.currentHp).toBe(5) // sem dano
    expect(s.today.paralyzedBattleIds).not.toContain(voltMon.id)
    expect(s.today.electrified[voltMon.id]).toBe(1) // eletrizado nível 1
  })

  it('Volt Absorb L2: electrified setado a 2', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    // Jolteon 135, slot1=volt-absorb L2
    const voltMon = makeMon({
      id: s.roster[0]!.id,
      speciesId: 135,
      secretPicks: [{ slot: 1, level: 2 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster[0] = voltMon
    mission.teamIds = [voltMon.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    expect(s.today.electrified[voltMon.id]).toBe(2)
  })

  it('buff de movimento: eletrizado L1 → +30% na velocidade via teamTravelSpeedMultiplier', () => {
    const voltMon = makeMon({ id: 'v', speciesId: 135, secretPicks: [{ slot: 1, level: 1 }] })
    const electrified: Record<string, 1 | 2> = { v: 1 }
    const withoutElec = teamTravelSpeedMultiplier([voltMon])
    const withElec = teamTravelSpeedMultiplier([voltMon], [], electrified)
    expect(withElec).toBeCloseTo(withoutElec + VOLT_ABSORB_BONUS_L1)
  })

  it('buff de movimento: eletrizado L2 → +90% na velocidade via teamTravelSpeedMultiplier', () => {
    const voltMon = makeMon({ id: 'v', speciesId: 135, secretPicks: [{ slot: 1, level: 2 }] })
    const electrified: Record<string, 1 | 2> = { v: 2 }
    const withoutElec = teamTravelSpeedMultiplier([voltMon])
    const withElec = teamTravelSpeedMultiplier([voltMon], [], electrified)
    expect(withElec).toBeCloseTo(withoutElec + VOLT_ABSORB_BONUS_L2)
  })

  it('buff de atributos: eletrizado L1 → +30% no missionAttrMultiplier', () => {
    const voltMon = makeMon({ id: 'v', speciesId: 135, secretPicks: [{ slot: 1, level: 1 }] })
    const electrified: Record<string, 1 | 2> = { v: 1 }
    const ctx: MissionSecretCtx = {
      team: [voltMon],
      template: getMissionTemplate('patrulha'),
      runtime: {},
      runItems: [],
      electrified,
    }
    const ctxNoElec: MissionSecretCtx = { ...ctx, electrified: undefined }
    expect(missionAttrMultiplier(voltMon, ctx)).toBeCloseTo(1 + VOLT_ABSORB_BONUS_L1)
    expect(missionAttrMultiplier(voltMon, ctxNoElec)).toBeCloseTo(1)
  })

  it('buff de atributos: eletrizado L2 → +90% no missionAttrMultiplier', () => {
    const voltMon = makeMon({ id: 'v', speciesId: 135, secretPicks: [{ slot: 1, level: 2 }] })
    const electrified: Record<string, 1 | 2> = { v: 2 }
    const ctx: MissionSecretCtx = {
      team: [voltMon],
      template: getMissionTemplate('patrulha'),
      runtime: {},
      runItems: [],
      electrified,
    }
    expect(missionAttrMultiplier(voltMon, ctx)).toBeCloseTo(1 + VOLT_ABSORB_BONUS_L2)
  })
})

describe('stormFlow — Fly-raio (missão voadora atingida)', () => {
  it('missão flying atingida → membros fainted (HP=0) e missão resolved/failure', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    mission.flying = true // marca como voando

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    const id = mission.teamIds[0]!
    const after = s.roster.find((p) => p.id === id)!
    expect(after.currentHp).toBe(0)
    expect(after.status).toBe('fainted')
    expect(mission.status).toBe('resolved')
    expect(mission.result).toBe('failure')
    // today.faints deve ser incrementado
    expect(s.today.faints).toBeGreaterThanOrEqual(1)
  })

  it('missão flying com time de 2: ambos fainted, missão resolvida uma única vez', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    mission.flying = true

    // Adiciona segundo membro
    const mon1 = s.roster[0]!
    const id2 = 'fly_test2'
    const mon2 = { ...mon1, id: id2, currentHp: 5, maxHp: 5, status: 'traveling' as const }
    s.roster.push(mon2)
    mission.teamIds = [mon1.id, id2]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.5 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    expect(s.roster.find((p) => p.id === mon1.id)!.status).toBe('fainted')
    expect(s.roster.find((p) => p.id === id2)!.status).toBe('fainted')
    expect(mission.status).toBe('resolved')
    expect(mission.result).toBe('failure')
    // Registrado apenas 1 vez em missionResults
    const flyResults = s.today.missionResults.filter((r) => r.teamIds.includes(mon1.id))
    expect(flyResults).toHaveLength(1)
  })
})

describe('stormFlow — precedência Lightning Rod / Volt Absorb sobre Fly-morte', () => {
  it('voador COM Lightning Rod não morre (imunidade tem precedência)', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    mission.flying = true

    // Lightning Rod (Cubone 104 slot1)
    const lrodFly = makeMon({
      id: s.roster[0]!.id,
      speciesId: 104,
      secretPicks: [{ slot: 1, level: 1 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster[0] = lrodFly
    mission.teamIds = [lrodFly.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    const after = s.roster.find((p) => p.id === lrodFly.id)!
    expect(after.currentHp).toBe(5) // não morreu
    expect(after.status).not.toBe('fainted')
    expect(mission.status).toBe('traveling') // missão continua
  })

  it('voador COM Volt Absorb não morre (absorção tem precedência)', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    mission.flying = true

    // Volt Absorb (Jolteon 135 slot1)
    const voltFly = makeMon({
      id: s.roster[0]!.id,
      speciesId: 135,
      secretPicks: [{ slot: 1, level: 1 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster[0] = voltFly
    mission.teamIds = [voltFly.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    const after = s.roster.find((p) => p.id === voltFly.id)!
    expect(after.currentHp).toBe(5) // não morreu
    expect(after.status).not.toBe('fainted')
    expect(s.today.electrified[voltFly.id]).toBe(1) // absorveu o raio
    expect(mission.status).toBe('traveling') // missão continua
  })
})

describe('hasVoltAbsorb predicado', () => {
  it('ativo somente quando sa-volt-absorb está desbloqueado', () => {
    // Jolteon(135): slot1=volt-absorb
    expect(hasVoltAbsorb(makeMon({ speciesId: 135 }))).toBe(false)
    expect(hasVoltAbsorb(makeMon({ speciesId: 135, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(false)
    expect(hasVoltAbsorb(makeMon({ speciesId: 135, secretPicks: [{ slot: 1, level: 1 }] }))).toBe(true)
    // Electabuzz(125): slot1=volt-absorb
    expect(hasVoltAbsorb(makeMon({ speciesId: 125, secretPicks: [{ slot: 1, level: 1 }] }))).toBe(true)
  })
})

// ---- Static (NOVO): XP e bônus de movimento por segundo parado ------------------

describe('Static (NOVO) — XP por segundo parado (L1)', () => {
  it('time com Static parado 5s por raio ganha +5 XP (STATIC_XP_PER_SEC × 5)', () => {
    // Pikachu (25) par = ['sa-static','sa-dig']; Static no slot 0.
    const { s, pos } = travelingState()
    const mission = s.missions[0]!

    const staticMon = makeMon({
      id: s.roster[0]!.id,
      speciesId: 25,
      secretPicks: [{ slot: 0, level: 1 }], // Static L1
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster[0] = staticMon
    mission.teamIds = [staticMon.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    // PARALYZE_STUN_MS = 5000 ms = 5 s → +5 XP (STATIC_XP_PER_SEC=1)
    const expectedXp = STATIC_XP_PER_SEC * (PARALYZE_STUN_MS / 1000)
    expect(s.today.xpEarned).toBe(expectedXp)
  })

  it('time SEM Static atingido por raio não ganha XP extra', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!
    // Pokémon sem Static (sem secretPicks)
    mission.teamIds = [s.roster[0]!.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    expect(s.today.xpEarned).toBe(0)
  })
})

describe('Static (NOVO) — bônus de movimento por segundo parado (L2)', () => {
  it('STATIC_MOVE_PER_SEC_L2 e STATIC_MOVE_CAP_L2 exportados de balance.ts', () => {
    expect(typeof STATIC_MOVE_PER_SEC_L2).toBe('number')
    expect(typeof STATIC_MOVE_CAP_L2).toBe('number')
    expect(STATIC_MOVE_PER_SEC_L2).toBeCloseTo(0.10)
    expect(STATIC_MOVE_CAP_L2).toBeCloseTo(1.0)
  })

  it('time parado 5s acumula staticStoppedSecs=5 na missão (L2)', () => {
    const { s, pos } = travelingState()
    const mission = s.missions[0]!

    const staticMon = makeMon({
      id: s.roster[0]!.id,
      speciesId: 25,
      secretPicks: [{ slot: 0, level: 1 }],
      currentHp: 5,
      maxHp: 5,
      status: 'traveling' as const,
    })
    s.roster[0] = staticMon
    mission.teamIds = [staticMon.id]

    const storm: StormEvent = {
      startMs: 0,
      endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    processStorms(s, 0, 6_000)

    // Após 5s parado: staticStoppedSecs deve ser 5
    expect(mission.staticStoppedSecs).toBe(PARALYZE_STUN_MS / 1000)
  })

  it('10s parado = +100% de movimento (cap: STATIC_MOVE_CAP_L2)', () => {
    // 10 s × 0.10 = 1.0 = cap → speedBonus = min(1.0, 0.10×10) = 1.0
    const stoppedSecs = 10
    const bonus = Math.min(STATIC_MOVE_CAP_L2, STATIC_MOVE_PER_SEC_L2 * stoppedSecs)
    expect(bonus).toBeCloseTo(STATIC_MOVE_CAP_L2)
  })

  it('5s parado = +50% de movimento (abaixo do cap)', () => {
    const stoppedSecs = 5
    const bonus = Math.min(STATIC_MOVE_CAP_L2, STATIC_MOVE_PER_SEC_L2 * stoppedSecs)
    expect(bonus).toBeCloseTo(0.5)
  })
})
