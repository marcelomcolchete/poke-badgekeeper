// Testes do stormFlow: detecção de acerto de raio e aplicação de dano/Paralyze no tick do dia.

import { describe, expect, it } from 'vitest'
import { processStorms } from './stormFlow.ts'
import { autoSeedRun } from './setup.ts'
import type { GameState } from '../engine/state.ts'
import type { StormEvent } from '../engine/storm.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'
import { getCity } from '../data/cities.ts'
import { PARALYZE_STUN_MS } from '../engine/balance.ts'

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
