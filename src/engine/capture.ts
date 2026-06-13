// Captura: busca por Percepção, nível do selvagem (dia ± 1), sorteio de 3 candidatos
// com filtro de evolução e teto de 6 no roster (PLAN §4.5).

import type { Pokemon, PokemonType } from '../types/index.ts'
import type { Rng } from './rng.ts'
import type { Species } from '../data/types.ts'
import { wildCandidates } from '../data/pokemon/index.ts'
import {
  CAPTURE_CHOICES,
  LEVEL_MAX,
  LEVEL_MIN,
  MAX_ROSTER_SIZE,
  SPECIES_BASE_MAX,
  WILD_LEVEL_VARIANCE,
} from './constants.ts'
import { BASE_SEARCH_MS, KEEN_EYE_SEARCH_FACTOR } from './balance.ts'
import { createPokemon } from './leveling.ts'
import { pickByRarity } from './rarity.ts'
import { effectiveAttr } from './attributes.ts'
import { clamp } from './math.ts'

export function rosterIsFull(roster: readonly Pokemon[]): boolean {
  return roster.length >= MAX_ROSTER_SIZE
}

/** Com o roster cheio (6), a captura fica bloqueada (PLAN §4.5). */
export function captureAvailable(roster: readonly Pokemon[]): boolean {
  return !rosterIsFull(roster)
}

/** Tempo de busca: baseBusca / (1 + Percepção/50); Keen Eye acelera. Percepção não muda o nível. */
export function searchMs(searcher: Pokemon): number {
  const perception = effectiveAttr(searcher, 'percepcao')
  const factor = searcher.passives.includes('keen-eye') ? KEEN_EYE_SEARCH_FACTOR : 1
  return (BASE_SEARCH_MS / (1 + perception / SPECIES_BASE_MAX)) * factor
}

/** Nível do selvagem = dia ± 1, limitado a [1, 10] (PLAN §4.5). */
export function wildLevel(rng: Rng, day: number): number {
  const variance = rng.int(-WILD_LEVEL_VARIANCE, WILD_LEVEL_VARIANCE)
  return clamp(day + variance, LEVEL_MIN, LEVEL_MAX)
}

/** Espécies elegíveis dos tipos do ginásio no nível dado (filtro de evolução já aplicado). */
function candidatePool(gymTypes: readonly PokemonType[], level: number): Species[] {
  const byId = new Map<number, Species>()
  for (const type of gymTypes) {
    for (const species of wildCandidates(type, level)) byId.set(species.id, species)
  }
  return [...byId.values()]
}

function rollOne(rng: Rng, gymTypes: readonly PokemonType[], level: number): Species | null {
  const type = rng.pick(gymTypes)
  const byType = wildCandidates(type, level)
  if (byType.length > 0) return pickByRarity(rng, byType)
  const pool = candidatePool(gymTypes, level)
  return pool.length > 0 ? pickByRarity(rng, pool) : null
}

/** Sorteia 3 candidatos dos tipos do ginásio (podem repetir espécies do roster) — PLAN §4.5. */
export function rollCandidates(
  rng: Rng,
  gymTypes: readonly PokemonType[],
  level: number,
): Species[] {
  const out: Species[] = []
  for (let i = 0; i < CAPTURE_CHOICES; i++) {
    const species = rollOne(rng, gymTypes, level)
    if (species) out.push(species)
  }
  return out
}

export interface Encounter {
  level: number
  candidates: Species[]
}

/** Um encontro: nível (dia ± 1) e os 3 candidatos para escolher (PLAN §4.5). */
export function rollEncounter(rng: Rng, gymTypes: readonly PokemonType[], day: number): Encounter {
  const level = wildLevel(rng, day)
  return { level, candidates: rollCandidates(rng, gymTypes, level) }
}

export interface CaptureSpec {
  roster: readonly Pokemon[]
  species: Species
  level: number
  rng: Rng
  id: string
}

/** Captura o candidato escolhido, devolvendo o NOVO roster. Lança se já houver 6 (PLAN §4.5). */
export function captureWild(spec: CaptureSpec): Pokemon[] {
  if (rosterIsFull(spec.roster)) throw new Error('Roster cheio (máx. 6)')
  const caught = createPokemon({
    id: spec.id,
    speciesId: spec.species.id,
    level: spec.level,
    rng: spec.rng,
  })
  return [...spec.roster, caught]
}
