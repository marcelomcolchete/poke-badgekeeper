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

// Mapas pai→filho e filho→pai derivados das evoluções, para expandir uma linha inteira
// a partir de qualquer um dos seus membros (data/trainers usa "linha evolutiva do X").
const EVO_PARENT = new Map<number, number>()
const EVO_CHILDREN = new Map<number, number[]>()
for (const step of EVOLUTIONS) {
  EVO_PARENT.set(step.to, step.from)
  const kids = EVO_CHILDREN.get(step.from)
  if (kids) kids.push(step.to)
  else EVO_CHILDREN.set(step.from, [step.to])
}

/**
 * Linha evolutiva inteira que contém `speciesId` (sobe até a forma-base e desce por todos
 * os ramos — Eevee inclui todas as eeveeluções). Ids ordenados; útil para montar elencos
 * de treinadores por família (PLAN §4.4).
 */
export function evolutionFamily(speciesId: number): number[] {
  let root = speciesId
  while (EVO_PARENT.has(root)) root = EVO_PARENT.get(root) as number
  const out: number[] = []
  const stack = [root]
  while (stack.length > 0) {
    const id = stack.pop() as number
    if (out.includes(id)) continue
    out.push(id)
    for (const child of EVO_CHILDREN.get(id) ?? []) stack.push(child)
  }
  return out.sort((a, b) => a - b)
}

/**
 * Cadeia evolutiva LINEAR em ORDEM (forma-base → … → forma final) a partir de qualquer membro.
 * Sobe até a raiz e desce sempre pela PRIMEIRA evolução de cada estágio — em ramos (Eevee)
 * segue só o primeiro filho. Diferente de evolutionFamily (que ordena por id, sem ordem de
 * evolução). Usado para evoluir o líder rival conforme o dia (PLAN §4.4).
 */
export function evolutionChain(speciesId: number): number[] {
  let id = speciesId
  while (EVO_PARENT.has(id)) id = EVO_PARENT.get(id) as number
  const chain = [id]
  for (;;) {
    const kids = EVO_CHILDREN.get(id)
    if (!kids || kids.length === 0) break
    id = kids[0] as number
    chain.push(id)
  }
  return chain
}

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
 * Pool capturável de uma área: todas as espécies dos tipos do ginásio (qualquer nível),
 * deduplicadas e ordenadas por id — base da Pokédex da Área de Captura.
 */
export function capturePool(types: readonly PokemonType[]): Species[] {
  const byId = new Map<number, Species>()
  for (const type of types) {
    for (const species of speciesByType(type)) byId.set(species.id, species)
  }
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/**
 * Espécies de um tipo elegíveis como selvagem no nível dado: o filtro de evolução
 * exige `nível ≥ minWildLevel` (PLAN §4.5).
 */
export function wildCandidates(type: PokemonType, level: number): Species[] {
  return speciesByType(type).filter((s) => level >= s.minWildLevel)
}

export { POKEMON }
