import { describe, expect, it } from 'vitest'
import { previewPokemon } from './preview.ts'
import { pokemonRank } from '../../engine/ranking.ts'

describe('previewPokemon shiny', () => {
  it('preview shiny é rank S e carrega a flag', () => {
    const mon = previewPokemon(1, 5, { seed: 42, shiny: true })
    expect(mon.shiny).toBe(true)
    expect(pokemonRank(mon)).toBe('S')
  })

  it('sem shiny, não marca a flag', () => {
    expect(previewPokemon(1, 5, { seed: 42 }).shiny).toBeUndefined()
  })
})
