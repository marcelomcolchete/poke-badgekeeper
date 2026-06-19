// Testes do stormFlow: detecção de acerto de raio e aplicação de dano/Paralyze no tick do dia.

import { describe, expect, it } from 'vitest'
import { processStorms } from './stormFlow.ts'
import { autoSeedRun } from './setup.ts'
import type { GameState } from '../engine/state.ts'
import type { StormEvent } from '../engine/storm.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'
import { getCity } from '../data/cities.ts'

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
})
