// Ranking F–S derivado da variação de encontro (IV) de cada eixo (PLAN §4.1).
// Puro e determinístico: depende só de p.ivs. Cada eixo tem um rank pela tabela
// abaixo; o rank do Pokémon é a MÉDIA dos 6 ranks, arredondada ao mais próximo.
//
//   F: −10 a −8   E: −7 a −5   D: −4 a −2   C: −1 a 1   B: 2 a 4   A: 5 a 7   S: 8 a 10

import { ATTR_KEYS, type Pokemon } from '../types/index.ts'
import { IV_MAX, IV_MIN } from './constants.ts'
import { average, clamp } from './math.ts'

/** Ranks do pior (F) ao melhor (S); o índice no array é o "valor" do rank. */
export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const

export type Rank = (typeof RANKS)[number]

/** Índice do rank (0=F … 6=S) para uma variação (IV) de eixo. Faixas de 3 em 3. */
export function rankIndexForIv(iv: number): number {
  const clamped = clamp(iv, IV_MIN, IV_MAX)
  return clamp(Math.floor((clamped - IV_MIN) / 3), 0, RANKS.length - 1)
}

/** Rank (F–S) de um único eixo a partir da sua variação. */
export function attrRank(iv: number): Rank {
  return RANKS[rankIndexForIv(iv)] as Rank
}

/** Índice do rank geral: média dos índices dos 6 eixos, ao mais próximo. */
export function pokemonRankIndex(p: Pokemon): number {
  const indices = ATTR_KEYS.map((k) => rankIndexForIv(p.ivs?.[k] ?? 0))
  return clamp(Math.round(average(indices)), 0, RANKS.length - 1)
}

/** Rank geral (F–S) do Pokémon, somando a qualidade de todos os atributos. */
export function pokemonRank(p: Pokemon): Rank {
  return RANKS[pokemonRankIndex(p)] as Rank
}
