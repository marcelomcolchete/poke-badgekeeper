import { describe, it, expect } from 'vitest'
import { resolveDisplayAndSprite } from './pokemonRow.ts'

describe('resolveDisplayAndSprite', () => {
  it('preserva displayName/spritePath quando a espécie já existe', () => {
    const prev = { displayName: 'Bulbasaur', spritePath: '/sprites/pokemons/gen1/1.png' }
    expect(resolveDisplayAndSprite(1, 'bulbasaur', prev)).toEqual({
      displayName: 'Bulbasaur',
      spritePath: '/sprites/pokemons/gen1/1.png',
    })
  })

  it('deriva defaults para id novo: nome capitalizado + sprite por id', () => {
    expect(resolveDisplayAndSprite(152, 'chikorita', undefined)).toEqual({
      displayName: 'Chikorita',
      spritePath: '/sprites/pokemons/gen1/152.png',
    })
  })
})
