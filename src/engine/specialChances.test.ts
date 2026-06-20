import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'
import { rollSpecialMissions } from './timeline.ts'
import {
  SPECIAL_CHANCE_GROWTH_MAX,
  SPECIAL_CHANCE_GROWTH_MIN,
  SPECIAL_CHANCE_MAX,
  SPECIAL_CHANCE_START,
} from './balance.ts'

describe('rollSpecialMissions', () => {
  it('chance 100% sempre acerta e reseta o local para START', () => {
    const r = rollSpecialMissions(createRng(1), [100])
    expect(r.hits).toEqual([0])
    expect(r.nextChances).toEqual([SPECIAL_CHANCE_START])
  })

  it('miss faz a chance crescer entre GROWTH_MIN e GROWTH_MAX pontos (cap 100)', () => {
    // chance 1% → quase sempre erra; o crescimento fica na faixa esperada.
    for (let seed = 1; seed <= 50; seed++) {
      const r = rollSpecialMissions(createRng(seed), [SPECIAL_CHANCE_START])
      if (r.hits.length === 0) {
        const grown = r.nextChances[0] as number
        expect(grown).toBeGreaterThanOrEqual(SPECIAL_CHANCE_START + SPECIAL_CHANCE_GROWTH_MIN)
        expect(grown).toBeLessThanOrEqual(SPECIAL_CHANCE_START + SPECIAL_CHANCE_GROWTH_MAX)
      } else {
        expect(r.nextChances[0]).toBe(SPECIAL_CHANCE_START)
      }
    }
  })

  it('o crescimento nunca passa do teto SPECIAL_CHANCE_MAX', () => {
    const r = rollSpecialMissions(createRng(3), [99])
    // 99 + (5..15) seria > 100; se errar, fica capado em 100.
    expect((r.nextChances[0] as number)).toBeLessThanOrEqual(SPECIAL_CHANCE_MAX)
  })

  it('cada local é independente (lista de chances vira lista do mesmo tamanho)', () => {
    const r = rollSpecialMissions(createRng(7), [100, 1])
    expect(r.nextChances).toHaveLength(2)
    expect(r.hits).toContain(0) // o de 100% acerta
    expect(r.nextChances[0]).toBe(SPECIAL_CHANCE_START)
  })

  it('lista vazia → sem hits, sem chances', () => {
    expect(rollSpecialMissions(createRng(1), [])).toEqual({ hits: [], nextChances: [] })
  })
})
