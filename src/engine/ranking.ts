// Ranking F–S derivado da variação de encontro (IV) de cada eixo (PLAN §4.1).
// Puro e determinístico: depende só de p.ivs. Cada eixo tem um rank pela tabela
// abaixo; o rank do Pokémon é a MÉDIA dos 6 ranks, arredondada ao mais próximo.
//
//   F: −10 a −8   E: −7 a −5   D: −4 a −2   C: −1 a 1   B: 2 a 4   A: 5 a 7   S: 8 a 10

import { ATTR_KEYS, type Pokemon } from '../types/index.ts'
import { ATTR_MAX, IV_MAX, IV_MIN } from './constants.ts'
import type { Rng } from './rng.ts'
import { average, clamp } from './math.ts'

/** Ranks do pior (F) ao melhor (S); o índice no array é o "valor" do rank. */
export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const

export type Rank = (typeof RANKS)[number]

/** Tamanho da faixa de IV de um rank (faixas de 3 em 3 sobre [−10, +10]). */
const IV_PER_RANK = 3

/**
 * Quantos pontos de Percepção valem 1 rank: ATTR_MAX (60) repartido entre F→S (6 saltos) = 10.
 * É só a ESCALA — a Percepção entra contínua (ver `perceptionRankCenter`), então cada ponto conta.
 */
const PERCEPTION_PER_RANK = ATTR_MAX / (RANKS.length - 1)

/** Dispersão (em ranks) do sorteio em torno do centro: cada eixo cai em centro ± esta faixa. */
const RANK_SPREAD = 1.5

/** Índice do rank (0=F … 6=S) para uma variação (IV) de eixo. Faixas de 3 em 3. */
export function rankIndexForIv(iv: number): number {
  const clamped = clamp(iv, IV_MIN, IV_MAX)
  return clamp(Math.floor((clamped - IV_MIN) / IV_PER_RANK), 0, RANKS.length - 1)
}

/**
 * Centro CONTÍNUO de rank (0=F … 6=S) que a Percepção do EXPLORADOR mira no encontro: quanto
 * maior a Percepção, melhor o rank que tende a surgir. Diferente da janela em degraus antiga,
 * cada ponto de Percepção conta — centro = percepcao/10, então 11 e 19 já miram ranks diferentes.
 *   perc 0→F(0)  10→E(1)  20→D(2)  30→C(3)  40→B(4)  50→A(5)  60→S(6)  (valores fracionários entre eles).
 */
export function perceptionRankCenter(perception: number): number {
  return clamp(perception / PERCEPTION_PER_RANK, 0, RANKS.length - 1)
}

/** IV aleatório cujo rank é exatamente `idx` (0=F … 6=S): faixa de 3 em 3 a partir de IV_MIN. */
export function ivForRankIndex(rng: Rng, idx: number): number {
  const lo = clamp(IV_MIN + idx * IV_PER_RANK, IV_MIN, IV_MAX)
  const hi = clamp(IV_MIN + idx * IV_PER_RANK + (IV_PER_RANK - 1), IV_MIN, IV_MAX)
  return rng.int(lo, hi)
}

/**
 * IV de UM eixo sorteado em torno do centro contínuo de rank (Percepção). O rank do eixo é
 * round(centro + U), U uniforme em [−RANK_SPREAD, +RANK_SPREAD]; depois sorteia um IV nessa faixa.
 * Como o rank do Pokémon é a MÉDIA dos 6 eixos, o resultado acompanha o centro de forma suave —
 * cada ponto de Percepção desloca a curva inteira. Consome 2 saques do RNG (preview = captura).
 */
export function ivForRankCenter(rng: Rng, center: number): number {
  const idx = clamp(Math.round(center + rng.float(-RANK_SPREAD, RANK_SPREAD)), 0, RANKS.length - 1)
  return ivForRankIndex(rng, idx)
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
