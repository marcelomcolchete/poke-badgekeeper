// Ranking F–S derivado da variação de encontro (IV) de cada eixo (PLAN §4.1).
// Puro e determinístico: depende só de p.ivs. Cada eixo tem um rank pela tabela
// abaixo; o rank do Pokémon é a MÉDIA dos 6 ranks, arredondada ao mais próximo.
//
//   F: −10 a −8   E: −7 a −5   D: −4 a −2   C: −1 a 1   B: 2 a 4   A: 5 a 7   S: 8 a 10

import { ATTR_KEYS, type Pokemon } from '../types/index.ts'
import { IV_MAX, IV_MIN } from './constants.ts'
import type { Rng } from './rng.ts'
import { average, clamp } from './math.ts'

/** Ranks do pior (F) ao melhor (S); o índice no array é o "valor" do rank. */
export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const

export type Rank = (typeof RANKS)[number]

/** Tamanho da faixa de IV de um rank (faixas de 3 em 3 sobre [−10, +10]). */
const IV_PER_RANK = 3

/** Índice do rank (0=F … 6=S) para uma variação (IV) de eixo. Faixas de 3 em 3. */
export function rankIndexForIv(iv: number): number {
  const clamped = clamp(iv, IV_MIN, IV_MAX)
  return clamp(Math.floor((clamped - IV_MIN) / IV_PER_RANK), 0, RANKS.length - 1)
}

/**
 * Janela de rank (índices min/max, 0=F … 6=S) que a Percepção do EXPLORADOR libera no
 * encontro: quanto maior a Percepção, maior a chance de surgirem Pokémon de rank melhor.
 *   ≤10 → F,E   ≤20 → E,D,C   ≤30 → D,C,B   ≤40 → C,B,A   ≤50 → B,A,S   >50 → A,S
 */
export function perceptionRankWindow(perception: number): [number, number] {
  if (perception <= 10) return [0, 1]
  if (perception <= 20) return [1, 3]
  if (perception <= 30) return [2, 4]
  if (perception <= 40) return [3, 5]
  if (perception <= 50) return [4, 6]
  return [5, 6]
}

/** IV aleatório cujo rank é exatamente `idx` (0=F … 6=S): faixa de 3 em 3 a partir de IV_MIN. */
export function ivForRankIndex(rng: Rng, idx: number): number {
  const lo = clamp(IV_MIN + idx * IV_PER_RANK, IV_MIN, IV_MAX)
  const hi = clamp(IV_MIN + idx * IV_PER_RANK + (IV_PER_RANK - 1), IV_MIN, IV_MAX)
  return rng.int(lo, hi)
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
