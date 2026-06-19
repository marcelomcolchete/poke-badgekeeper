// Efeitos dos itens PASSIVOS (run-wide) sobre missões e batalhas — ponto único da engine.
// Os ids ativos vivem em s.runItems; aqui só funções PURAS que traduzem esses ids em
// multiplicadores por Pokémon. Os buffs diários (x_*) NÃO passam por aqui: entram direto no
// effectiveAttr via pokemon.dayBuffs.

import type { Pokemon } from '../types/index.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import {
  DRAGON_FANG_BATTLE_MULT,
  EVIOLITE_MISSION_MULT,
  FOSSIL_STONE_BATTLE_MULT,
  LAGGING_TAIL_BATTLE_MULT,
  LAGGING_TAIL_MISSION_MULT,
  LAGGING_TAIL_TRAVEL_MULT,
  MAGNET_BATTLE_MULT,
  MYSTIC_WATER_BATTLE_MULT,
  THICK_CLUB_BATTLE_MULT,
} from './balance.ts'

/** Espécies fósseis (Omanyte/Omastar/Kabuto/Kabutops/Aerodactyl) — alvo da Fossil Stone. */
const FOSSIL_SPECIES_IDS = [138, 139, 140, 141, 142]

/** O time possui um item passivo da run? */
export function hasRunItem(runItems: readonly string[], id: string): boolean {
  return runItems.includes(id)
}

/** Este Pokémon é um fóssil? (Fossil Stone). */
export function isFossilSpecies(speciesId: number): boolean {
  return FOSSIL_SPECIES_IDS.includes(speciesId)
}

/** Este Pokémon ainda NÃO chegou à última evolução? (Eviolite). */
export function notFinalEvolution(p: Pokemon): boolean {
  return getSpecies(p.speciesId).evolvesTo !== null
}

/**
 * Multiplicador de atributos NA MISSÃO vindo de itens passivos (1 = sem efeito):
 *  - Eviolite: +10% se o Pokémon ainda evolui.
 *  - Lagging Tail: +50% para todos.
 */
export function itemMissionMultiplier(p: Pokemon, runItems: readonly string[]): number {
  let mult = 1
  if (hasRunItem(runItems, 'eviolite') && notFinalEvolution(p)) mult *= EVIOLITE_MISSION_MULT
  if (hasRunItem(runItems, 'lagging-tail')) mult *= LAGGING_TAIL_MISSION_MULT
  return mult
}

/**
 * Multiplicador de Batalha vindo de itens passivos (1 = sem efeito):
 *  - Thick Club: +50% para Pokémon do tipo Ground.
 *  - Mystic Water: +50% para Pokémon do tipo Water.
 *  - Dragon Fang: +50% para Pokémon do tipo Dragão.
 *  - Magnet: +50% para Pokémon do tipo Elétrico.
 *  - Fossil Stone: +50% para Pokémon fósseis (espécies 138–142).
 *  - Lagging Tail: +50% para todos.
 */
export function itemBattleMultiplier(p: Pokemon, runItems: readonly string[]): number {
  let mult = 1
  if (hasRunItem(runItems, 'thick-club') && p.types.includes('ground')) {
    mult *= THICK_CLUB_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'mystic-water') && p.types.includes('water')) {
    mult *= MYSTIC_WATER_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'dragon-fang') && p.types.includes('dragon')) {
    mult *= DRAGON_FANG_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'magnet') && p.types.includes('electric')) {
    mult *= MAGNET_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'fossil-stone') && isFossilSpecies(p.speciesId)) {
    mult *= FOSSIL_STONE_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'lagging-tail')) mult *= LAGGING_TAIL_BATTLE_MULT
  return mult
}

/** Multiplicador de VELOCIDADE de viagem vindo de itens (Lagging Tail deixa 50% mais lento). */
export function itemTravelSpeedMultiplier(runItems: readonly string[]): number {
  return hasRunItem(runItems, 'lagging-tail') ? LAGGING_TAIL_TRAVEL_MULT : 1
}
