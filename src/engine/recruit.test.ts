import { describe, expect, it } from 'vitest'
import type { PokemonType } from '../types/index.ts'
import { createRng } from './rng.ts'
import { rollRecruitChoices, rollTypeChoices } from './recruit.ts'

describe('rollTypeChoices (PLAN §3)', () => {
  it('sorteia 3 tipos distintos sem os excluídos', () => {
    const exclude: PokemonType[] = ['rock']
    for (let seed = 0; seed < 50; seed++) {
      const choices = rollTypeChoices(createRng(seed), exclude)
      expect(choices).toHaveLength(3)
      expect(new Set(choices).size).toBe(3) // distintos
      for (const t of choices) expect(exclude).not.toContain(t)
    }
  })

  it('é determinística para a mesma seed', () => {
    expect(rollTypeChoices(createRng(7), [])).toEqual(rollTypeChoices(createRng(7), []))
  })
})

describe('rollRecruitChoices (PLAN §3)', () => {
  it('traz 3 recrutas nível 1 do tipo escolhido', () => {
    for (let seed = 0; seed < 50; seed++) {
      const choices = rollRecruitChoices(createRng(seed), 'water')
      expect(choices).toHaveLength(3)
      for (const s of choices) {
        expect(s.types).toContain('water')
        expect(s.minWildLevel).toBe(1) // forma-base elegível no nível 1
      }
    }
  })
})
