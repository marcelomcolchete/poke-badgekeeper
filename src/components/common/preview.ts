// Pokémon "de preview" (alocações zeradas, HP cheio) para mostrar cartas na UI
// sem consumir RNG — determinístico. No nível 1 bate exatamente com o real.

import type { Pokemon } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { maxHpOf, zeroAttrs } from '../../engine/attributes.ts'

export function previewPokemon(speciesId: number, level: number): Pokemon {
  const species = getSpecies(speciesId)
  const draft: Pokemon = {
    id: `preview-${speciesId}`,
    speciesId,
    level,
    xp: 0,
    types: [...species.types],
    baseAttrs: { ...species.baseAttrs },
    allocations: zeroAttrs(),
    currentHp: 0,
    maxHp: 0,
    status: 'idle',
    passives: [],
    // Preview de candidato: o sexo só é sorteado de fato na captura.
    gender: 'genderless',
    nickname: null,
  }
  const maxHp = maxHpOf(draft)
  return { ...draft, maxHp, currentHp: maxHp }
}
