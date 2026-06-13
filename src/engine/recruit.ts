// Sorteios do início de jogo (PLAN §3): tipos extras do ginásio e recrutas nível 1.
// Puro/determinístico (RNG semeado). O fluxo interativo (duas rodadas) é da UI (Fase 4).

import type { PokemonType } from '../types/index.ts'
import { POKEMON_TYPES } from '../types/index.ts'
import type { Species } from '../data/types.ts'
import { wildCandidates } from '../data/pokemon/index.ts'
import type { Rng } from './rng.ts'
import { DRAFT_CHOICES, LEVEL_MIN } from './constants.ts'
import { pickByRarity } from './rarity.ts'

/** Sorteia 3 tipos distintos, excluindo os já definidos (primário/escolhidos) — PLAN §3. */
export function rollTypeChoices(rng: Rng, exclude: readonly PokemonType[]): PokemonType[] {
  return rng.shuffle(POKEMON_TYPES.filter((t) => !exclude.includes(t))).slice(0, DRAFT_CHOICES)
}

/** Sorteia 3 recrutas nível 1 (formas-base) do tipo escolhido, ponderados por raridade — PLAN §3/§4.5. */
export function rollRecruitChoices(rng: Rng, type: PokemonType): Species[] {
  const pool = wildCandidates(type, LEVEL_MIN)
  if (pool.length === 0) return []
  return Array.from({ length: DRAFT_CHOICES }, () => pickByRarity(rng, pool))
}
