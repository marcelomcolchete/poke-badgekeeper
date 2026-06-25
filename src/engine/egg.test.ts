import { describe, it, expect } from 'vitest'
import { createRng } from './rng.ts'
import { hatchEgg, rollEggRankIndex } from './egg.ts'
import { baseStageSpecies, getSpecies } from '../data/pokemon/index.ts'
import { pokemonRankIndex } from './ranking.ts'

describe('rollEggRankIndex', () => {
  it('retorna 4 (B), 5 (A) ou 6 (S)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const idx = rollEggRankIndex(createRng(seed))
      expect([4, 5, 6]).toContain(idx)
    }
  })
})

describe('hatchEgg', () => {
  it('gera um Pokémon de 1º estágio (não evoluído)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const mon = hatchEgg(createRng(seed), `p${seed}`, [])
      // Espécie base: nenhuma forma evolui PARA ela (é forma inicial).
      expect(getSpecies(mon.speciesId)).toBeDefined()
      expect(baseStageSpecies()).toContain(mon.speciesId)
      expect(mon.level).toBe(1)
    }
  })
  it('shiny sempre nasce rank S', () => {
    // Com Shiny Charm a chance é alta (20%); procura um shiny e confirma rank S.
    let found = false
    for (let seed = 0; seed < 500 && !found; seed++) {
      const mon = hatchEgg(createRng(seed), 'p', ['shiny-charm'])
      if (mon.shiny) {
        found = true
        expect(pokemonRankIndex(mon)).toBe(6)
      }
    }
    expect(found).toBe(true)
  })
})
