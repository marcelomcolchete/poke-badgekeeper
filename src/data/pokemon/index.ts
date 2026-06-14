// Espécies da Gen 1: base gerada + evolução resolvida (PLAN §4.1.1).

import type { PokemonType } from '../../types/index.ts'
import type { Species } from '../types.ts'
import { SPECIES_BASE } from './species.generated.ts'
import { EVOLUTIONS } from './evolutions.generated.ts'
import { MIN_WILD_LEVEL } from './minWildLevels.generated.ts'

function buildSpecies(): Map<number, Species> {
  // Agrupa os passos por origem: uma espécie pode ter vários alvos (ex.: Eevee).
  const evolvesTo = new Map<number, { ids: number[]; atLevel: number }>()
  for (const step of EVOLUTIONS) {
    const existing = evolvesTo.get(step.from)
    if (existing) existing.ids.push(step.to)
    else evolvesTo.set(step.from, { ids: [step.to], atLevel: step.atLevel })
  }

  const map = new Map<number, Species>()
  for (const base of SPECIES_BASE) {
    map.set(base.id, {
      ...base,
      evolvesTo: evolvesTo.get(base.id) ?? null,
      minWildLevel: MIN_WILD_LEVEL[base.id] ?? 1,
    })
  }
  return map
}

const POKEMON: Map<number, Species> = buildSpecies()

/** Espécie por id (lança se inexistente — id inválido é erro de programação). */
export function getSpecies(id: number): Species {
  const species = POKEMON.get(id)
  if (!species) throw new Error(`Espécie ${id} não encontrada`)
  return species
}

export function allSpecies(): Species[] {
  return [...POKEMON.values()]
}

/** Espécies que têm o tipo dado (primário ou secundário). */
export function speciesByType(type: PokemonType): Species[] {
  return allSpecies().filter((s) => s.types.includes(type))
}

/**
 * Espécies de um tipo elegíveis como selvagem no nível dado: o filtro de evolução
 * exige `nível ≥ minWildLevel` (PLAN §4.5).
 */
export function wildCandidates(type: PokemonType, level: number): Species[] {
  return speciesByType(type).filter((s) => level >= s.minWildLevel)
}

export { POKEMON }
