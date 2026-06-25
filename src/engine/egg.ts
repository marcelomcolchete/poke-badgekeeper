// Eclosão do Poke Egg: sorteia rank-alvo (40% B / 35% A / 25% S; shiny → S),
// escolhe uma espécie de 1º estágio e cria o Pokémon nível 1 nesse rank.
import type { Pokemon } from '../types/index.ts'
import type { Rng } from './rng.ts'
import { createPokemon } from './leveling.ts'
import { baseStageSpecies } from '../data/pokemon/index.ts'
import { rollShiny, shinyChance } from './shiny.ts'
import { LEVEL_MIN } from './constants.ts'

/** Rank-alvo do ovo: 40% B (4), 35% A (5), 25% S (6). */
export function rollEggRankIndex(rng: Rng): number {
  const r = rng.next()
  if (r < 0.4) return 4
  if (r < 0.75) return 5
  return 6
}

/** Choca um ovo num Pokémon de 1º estágio no rank sorteado (shiny → rank S). */
export function hatchEgg(rng: Rng, id: string, runItems: readonly string[]): Pokemon {
  const shiny = rollShiny(rng, shinyChance(runItems))
  const rankIndex = shiny ? 6 : rollEggRankIndex(rng)
  const speciesId = rng.pick(baseStageSpecies())
  return createPokemon({ id, speciesId, level: LEVEL_MIN, rng, rankCenter: rankIndex, shiny })
}
