import { describe, expect, it } from 'vitest'
import { IV_MAX, IV_MIN } from './constants.ts'
import {
  attrRank,
  ivForRankCenter,
  pokemonRank,
  pokemonRankIndex,
  rankDistribution,
  rankIndexForIv,
  RANKS,
  sampleTargetRank,
  targetRankAxes,
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

describe('ivForRankCenter — centro empurra o rank de forma contínua (usado no Fossil Stone)', () => {
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
    const low = avgRankIndex(1) // E
    const mid = avgRankIndex(3) // C
    const high = avgRankIndex(5) // A
    expect(low).toBeLessThan(mid)
    expect(mid).toBeLessThan(high)
  })

  it('o centro fica perto do rank médio resultante', () => {
    expect(avgRankIndex(4)).toBeCloseTo(4, 0) // B
  })
})

const RI = (r: string) => RANKS.indexOf(r as (typeof RANKS)[number])

describe('rankDistribution — Percepção define a distribuição do rank-alvo', () => {
  it('soma 1 e perc 0 → 100% F', () => {
    const d = rankDistribution(0)
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(d[RI('F')]).toBeCloseTo(1, 10)
  })

  it('perc 60 (teto) → ≈ 50% S / 40% A / 10% B, nada abaixo de B', () => {
    const d = rankDistribution(60)
    expect(d[RI('S')]).toBeCloseTo(0.5, 2)
    expect(d[RI('A')]).toBeCloseTo(0.4, 2)
    expect(d[RI('B')]).toBeCloseTo(0.1, 2)
    expect(d[RI('C')]).toBe(0)
    expect(d[RI('D')]).toBe(0)
  })

  it('S só é possível acima de 50 (perc ≤ 50 → P(S) = 0; perc 51 → P(S) > 0)', () => {
    expect(rankDistribution(49)[RI('S')]).toBe(0)
    expect(rankDistribution(50)[RI('S')]).toBe(0)
    expect(rankDistribution(51)[RI('S')]).toBeGreaterThan(0)
  })

  it('é monotônica: o rank médio não decresce com a Percepção, e perc 1 já desloca perc 0', () => {
    const meanRank = (p: number) =>
      rankDistribution(p).reduce((sum, prob, k) => sum + prob * k, 0)
    for (let p = 1; p <= 60; p++) {
      expect(meanRank(p)).toBeGreaterThanOrEqual(meanRank(p - 1))
    }
    expect(meanRank(1)).toBeGreaterThan(meanRank(0))
  })
})

describe('sampleTargetRank — sorteia o rank-alvo pela distribuição', () => {
  it('a frequência sobre N seeds bate com rankDistribution (perc 60)', () => {
    const N = 20000
    const counts = new Array(RANKS.length).fill(0)
    for (let seed = 0; seed < N; seed++) counts[sampleTargetRank(createRng(seed), 60)]++
    const d = rankDistribution(60)
    for (let k = 0; k < RANKS.length; k++) {
      expect(counts[k] / N).toBeCloseTo(d[k] as number, 1)
    }
  })

  it('nunca devolve S para Percepção ≤ 50', () => {
    for (let seed = 0; seed < 5000; seed++) {
      expect(sampleTargetRank(createRng(seed), 50)).toBeLessThan(RI('S'))
    }
  })
})

describe('targetRankAxes — eixos cravam a média no rank-alvo, com variedade', () => {
  it('a soma dos ranks dos eixos é 6 × alvo (média = alvo) para qualquer alvo', () => {
    for (let target = 0; target < RANKS.length; target++) {
      for (let seed = 0; seed < 50; seed++) {
        const axes = targetRankAxes(createRng(seed), target)
        expect(axes).toHaveLength(6)
        expect(axes.reduce((a, b) => a + b, 0)).toBe(6 * target)
      }
    }
  })

  it('alvo intermediário gera variedade entre eixos; alvos extremos (F/S) ficam uniformes', () => {
    const mid = targetRankAxes(createRng(7), RI('C'))
    expect(new Set(mid).size).toBeGreaterThan(1)
    expect(targetRankAxes(createRng(7), RI('S'))).toEqual(new Array(6).fill(RI('S')))
    expect(targetRankAxes(createRng(7), RI('F'))).toEqual(new Array(6).fill(RI('F')))
  })
})
