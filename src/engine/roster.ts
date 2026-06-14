// Ordem de exibição do roster (sidebar e seletores de missão/defesa): primeiro os
// DISPONÍVEIS (idle), depois por qualidade decrescente — facilita escolher quem mandar.
//
//   0. derrotado (desmaiado) SEMPRE por último
//   1. disponível (idle) antes de ocupado
//   2. nível mais alto
//   3. rank mais alto (F→S)
//   4. raridade mais alta (comum→lendário)
//   5. total de atributos efetivos
//   6. nº da Pokédex (espécie) crescente — desempate estável

import { ATTR_KEYS, RARITIES, type Pokemon } from '../types/index.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import { effectiveAttr } from './attributes.ts'
import { pokemonRankIndex } from './ranking.ts'

/** Pokémon livre para receber uma ordem agora (não está em missão/defesa/caça/centro). */
export function isAvailable(p: Pokemon): boolean {
  return p.status === 'idle'
}

/** Soma dos 6 atributos efetivos — critério de desempate "força bruta" do Pokémon. */
function totalAttrs(p: Pokemon): number {
  return ATTR_KEYS.reduce((sum, k) => sum + effectiveAttr(p, k), 0)
}

/** Índice de raridade (0=comum … 4=lendário); quanto maior, mais raro. */
function rarityIndex(p: Pokemon): number {
  return RARITIES.indexOf(getSpecies(p.speciesId).rarity)
}

/** Comparador da ordem de exibição (ver topo do arquivo). */
export function compareRoster(a: Pokemon, b: Pokemon): number {
  // Derrotados (desmaiados) sempre no fim, independentemente do resto.
  const aFaint = a.currentHp <= 0
  const bFaint = b.currentHp <= 0
  if (aFaint !== bFaint) return aFaint ? 1 : -1
  const availDiff = Number(isAvailable(b)) - Number(isAvailable(a))
  if (availDiff !== 0) return availDiff
  if (b.level !== a.level) return b.level - a.level
  const rankDiff = pokemonRankIndex(b) - pokemonRankIndex(a)
  if (rankDiff !== 0) return rankDiff
  const rarityDiff = rarityIndex(b) - rarityIndex(a)
  if (rarityDiff !== 0) return rarityDiff
  const totalDiff = totalAttrs(b) - totalAttrs(a)
  if (totalDiff !== 0) return totalDiff
  return a.speciesId - b.speciesId
}

/** Cópia do roster ordenada para exibição (não muta o original). */
export function sortRoster(roster: readonly Pokemon[]): Pokemon[] {
  return [...roster].sort(compareRoster)
}
