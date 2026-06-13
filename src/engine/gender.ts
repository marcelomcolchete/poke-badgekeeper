// Sorteio de sexo do Pokémon a partir da taxa da espécie (PLAN §4.5).
// gender_rate = oitavos-fêmea da PokéAPI: 0 = 100% macho, 8 = 100% fêmea,
// -1 = sem gênero. Determinístico via Rng semeado (nunca Math.random).

import type { Gender } from '../types/index.ts'
import type { Rng } from './rng.ts'
import { GENDER_RATE } from '../data/pokemon/genders.generated.ts'

/** Oitavos-fêmea da espécie (-1 = sem gênero). Espécie desconhecida → sem gênero. */
export function genderRateOf(speciesId: number): number {
  return GENDER_RATE[speciesId] ?? -1
}

/** Sorteia o sexo respeitando a proporção do jogo original (fêmea com prob. rate/8). */
export function rollGender(rng: Rng, speciesId: number): Gender {
  const rate = genderRateOf(speciesId)
  if (rate < 0) return 'genderless'
  return rng.int(1, 8) <= rate ? 'female' : 'male'
}
