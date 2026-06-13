// Nome de exibição (apelido com fallback para a espécie) e símbolo de sexo.
// Tolerante a saves/objetos antigos sem os campos (gender/nickname ausentes).

import type { Gender, Pokemon } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'

/** Nome a exibir: apelido do jogador, ou o nome da espécie quando não houver. */
export function displayNameOf(pokemon: Pokemon): string {
  const nick = pokemon.nickname?.trim()
  return nick ? nick : getSpecies(pokemon.speciesId).displayName
}

/** Símbolo Vênus/Marte; string vazia para sem gênero ou dado ausente. */
export function genderSymbol(gender: Gender | undefined): string {
  if (gender === 'male') return '♂'
  if (gender === 'female') return '♀'
  return ''
}

/** Cor do símbolo de sexo (azul macho / rosa fêmea). */
export function genderColor(gender: Gender | undefined): string {
  if (gender === 'male') return '#4f86d6'
  if (gender === 'female') return '#d65f9a'
  return 'inherit'
}
