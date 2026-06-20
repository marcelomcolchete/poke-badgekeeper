// Time de fuga PURO da Rocket (agilidade efetiva THEFT_FLEE_AGILITY): um único Pokémon sintético
// usado só para alimentar a curva de graphTravelMs (agilityTravelFactor). Isolado aqui para
// theft.ts não importar testkit (fora do bundle) nem montar Pokémon inline.

import type { Pokemon } from '../types/index.ts'
import { THEFT_FLEE_AGILITY } from './balance.ts'

/** Um "time" de 1 Pokémon com agilidade = THEFT_FLEE_AGILITY e o resto neutro (sem passivas). */
export function makeFleeTeam(): Pokemon[] {
  const zero = {
    batalha: 0,
    inteligencia: 0,
    carisma: 0,
    agilidade: 0,
    resistencia: 0,
    percepcao: 0,
  }
  const mon: Pokemon = {
    id: '__rocket_flee__',
    speciesId: 1,
    level: 1,
    xp: 0,
    types: ['normal'],
    baseAttrs: { ...zero, agilidade: THEFT_FLEE_AGILITY },
    ivs: { ...zero },
    allocations: { ...zero },
    currentHp: 1,
    maxHp: 1,
    status: 'idle',
    passives: [],
    gender: 'genderless',
    nickname: null,
    nature: null,
  }
  return [mon]
}
