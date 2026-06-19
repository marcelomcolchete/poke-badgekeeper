import { describe, expect, it } from 'vitest'
import { getSpecies, pokemonSpritePath } from './index.ts'

describe('pokemonSpritePath', () => {
  it('usa a sprite normal quando não é shiny', () => {
    expect(pokemonSpritePath({ speciesId: 1 })).toBe(getSpecies(1).spritePath)
    expect(pokemonSpritePath({ speciesId: 1, shiny: false })).toBe(getSpecies(1).spritePath)
  })

  it('usa a sprite shiny quando shiny', () => {
    expect(pokemonSpritePath({ speciesId: 25, shiny: true })).toBe('/sprites/pokemons/gen1/shiny/25.png')
    expect(pokemonSpritePath({ speciesId: 25, shiny: true })).toBe(getSpecies(25).shinySpritePath)
  })
})
