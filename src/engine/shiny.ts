// Rolagem determinística de shiny. Decidida FORA de createPokemon e passada como flag,
// preservando as sequências de RNG existentes. Pré-aviso no mapa e captura usam o MESMO cálculo.
// A chance é parametrizável (Shiny Charm soma +4%); o mesmo saque de RNG é comparado a um limiar
// maior → MONOTÔNICO (comprar o charm nunca "des-shinya" nada).

import { createRng, deriveSeed, type Rng } from './rng.ts'
import { CAPTURE_CHOICES, SHINY_CHANCE, SHINY_CHARM_BONUS, SHINY_SEED_SALT } from './constants.ts'

/** Consome 1 saque do RNG: true se o Pokémon é shiny (chance default = SHINY_CHANCE). */
export function rollShiny(rng: Rng, chance: number = SHINY_CHANCE): boolean {
  return rng.next() < chance
}

/** Shiny determinístico com chance explícita, a partir de partes de seed (sal dedicado embutido). */
export function shinyForChance(chance: number, ...parts: number[]): boolean {
  return rollShiny(createRng(deriveSeed(SHINY_SEED_SALT, ...parts)), chance)
}

/** Shiny determinístico (chance base). Mantido para os call sites sem itens. */
export function shinyFor(...parts: number[]): boolean {
  return shinyForChance(SHINY_CHANCE, ...parts)
}

/** True se algum dos CAPTURE_CHOICES candidatos do spot for shiny, com a chance dada. */
export function spotHasShinyChance(
  chance: number,
  seed: number,
  day: number,
  spotIndex: number,
): boolean {
  for (let slot = 0; slot < CAPTURE_CHOICES; slot++) {
    if (shinyForChance(chance, seed, day, spotIndex, slot)) return true
  }
  return false
}

/** Pré-aviso no mapa com a chance base (sem itens). */
export function spotHasShiny(seed: number, day: number, spotIndex: number): boolean {
  return spotHasShinyChance(SHINY_CHANCE, seed, day, spotIndex)
}

/** Chance efetiva de shiny dados os itens da run (Shiny Charm soma SHINY_CHARM_BONUS). */
export function shinyChance(runItems: readonly string[]): number {
  return SHINY_CHANCE + (runItems.includes('shiny-charm') ? SHINY_CHARM_BONUS : 0)
}
