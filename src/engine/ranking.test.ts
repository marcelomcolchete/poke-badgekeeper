import { describe, expect, it } from 'vitest'
import { IV_MAX, IV_MIN } from './constants.ts'
import {
  attrRank,
  ivForRankCenter,
  perceptionRankCenter,
  pokemonRank,
  pokemonRankIndex,
  rankIndexForIv,
  RANKS,
} from './ranking.ts'
import { createRng } from './rng.ts'
import { makeAttrs, makeMon } from './testkit.ts'
import { mapAttrs } from './attributes.ts'

describe('rankIndexForIv / attrRank', () => {
  it('mapeia as faixas exatas da tabela F–S', () => {
    const cases: Array<[number, string]> = [
      [-10, 'F'], [-8, 'F'],
      [-7, 'E'], [-5, 'E'],
      [-4, 'D'], [-2, 'D'],
      [-1, 'C'], [0, 'C'], [1, 'C'],
      [2, 'B'], [4, 'B'],
      [5, 'A'], [7, 'A'],
      [8, 'S'], [10, 'S'],
    ]
    for (const [iv, rank] of cases) {
      expect(attrRank(iv)).toBe(rank)
    }
  })

  it('clampa variações fora do intervalo de IV', () => {
    expect(attrRank(IV_MIN - 5)).toBe('F')
    expect(attrRank(IV_MAX + 5)).toBe('S')
    expect(rankIndexForIv(IV_MIN)).toBe(0)
    expect(rankIndexForIv(IV_MAX)).toBe(RANKS.length - 1)
  })
})

describe('pokemonRank — média dos eixos', () => {
  it('todos os eixos no piso → F; no teto → S', () => {
    expect(pokemonRank(makeMon({ ivs: makeAttrs({}, IV_MIN) }))).toBe('F')
    expect(pokemonRank(makeMon({ ivs: makeAttrs({}, IV_MAX) }))).toBe('S')
  })

  it('IVs zerados (saves migrados) caem no rank neutro C', () => {
    expect(pokemonRank(makeMon())).toBe('C')
  })

  it('3 eixos S + um A + um B + um C → rank A (mais próximo)', () => {
    // índices: S=6,S=6,S=6, A=5, B=4, C=3 → média 5 → A
    const ivs = {
      batalha: 9, // S
      inteligencia: 9, // S
      carisma: 9, // S
      agilidade: 6, // A
      resistencia: 3, // B
      percepcao: 0, // C
    }
    expect(pokemonRank(makeMon({ ivs }))).toBe('A')
  })
})

describe('ivForRankCenter — Percepção empurra o rank de forma contínua', () => {
  /** Rank-índice médio de N Pokémon gerados em torno de um centro de rank. */
  function avgRankIndex(center: number, seeds = 200): number {
    let sum = 0
    for (let seed = 0; seed < seeds; seed++) {
      const rng = createRng(seed)
      const ivs = mapAttrs(() => ivForRankCenter(rng, center))
      sum += pokemonRankIndex(makeMon({ ivs }))
    }
    return sum / seeds
  }

  it('centro maior → rank médio maior', () => {
    const low = avgRankIndex(perceptionRankCenter(10)) // E
    const mid = avgRankIndex(perceptionRankCenter(30)) // C
    const high = avgRankIndex(perceptionRankCenter(50)) // A
    expect(low).toBeLessThan(mid)
    expect(mid).toBeLessThan(high)
  })

  it('cada ponto de Percepção desloca o rank médio (11 < 19)', () => {
    expect(avgRankIndex(perceptionRankCenter(11))).toBeLessThan(
      avgRankIndex(perceptionRankCenter(19)),
    )
  })

  it('o centro fica perto do rank médio resultante', () => {
    const center = perceptionRankCenter(40) // B (índice 4)
    expect(avgRankIndex(center)).toBeCloseTo(center, 0)
  })
})
