// Rolagem determinística de shiny (1%). Decidida FORA de createPokemon e passada como flag,
// preservando as sequências de RNG existentes. Pré-aviso no mapa e captura usam o MESMO cálculo.

import { createRng, deriveSeed, type Rng } from './rng.ts'
import { CAPTURE_CHOICES, SHINY_CHANCE, SHINY_SEED_SALT } from './constants.ts'

/** Consome 1 saque do RNG: true se o Pokémon é shiny. */
export function rollShiny(rng: Rng): boolean {
  return rng.next() < SHINY_CHANCE
}

/** Shiny determinístico a partir de partes de seed (sal dedicado embutido). */
export function shinyFor(...parts: number[]): boolean {
  return rollShiny(createRng(deriveSeed(SHINY_SEED_SALT, ...parts)))
}

/** True se algum dos CAPTURE_CHOICES candidatos do spot (no dia) for shiny — pré-aviso no mapa. */
export function spotHasShiny(seed: number, day: number, spotIndex: number): boolean {
  for (let slot = 0; slot < CAPTURE_CHOICES; slot++) {
    if (shinyFor(seed, day, spotIndex, slot)) return true
  }
  return false
}
