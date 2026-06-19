// Ranking F–S derivado da variação de encontro (IV) de cada eixo (PLAN §4.1).
// Puro e determinístico: depende só de p.ivs. Cada eixo tem um rank pela tabela
// abaixo; o rank do Pokémon é a MÉDIA dos 6 ranks, arredondada ao mais próximo.
//
//   F: −10 a −8   E: −7 a −5   D: −4 a −2   C: −1 a 1   B: 2 a 4   A: 5 a 7   S: 8 a 10

import { ATTR_KEYS, type Pokemon } from '../types/index.ts'
import { IV_MAX, IV_MIN } from './constants.ts'
import type { Rng } from './rng.ts'
import { PERCEPTION_PER_RANK, RANK_GAP_KNOTS, TARGET_RANK_SWAP_ROUNDS } from './balance.ts'
import { average, clamp } from './math.ts'

/** Ranks do pior (F) ao melhor (S); o índice no array é o "valor" do rank. */
export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const

export type Rank = (typeof RANKS)[number]

/** Tamanho da faixa de IV de um rank (faixas de 3 em 3 sobre [−10, +10]). */
const IV_PER_RANK = 3

/** Dispersão (em ranks) do sorteio em torno do centro: cada eixo cai em centro ± esta faixa. */
const RANK_SPREAD = 1.5

/** Índice do rank (0=F … 6=S) para uma variação (IV) de eixo. Faixas de 3 em 3. */
export function rankIndexForIv(iv: number): number {
  const clamped = clamp(iv, IV_MIN, IV_MAX)
  return clamp(Math.floor((clamped - IV_MIN) / IV_PER_RANK), 0, RANKS.length - 1)
}

/**
 * Peso da curva de janela para um `gap = c − k` (quão abaixo/acima do alcance está o rank k),
 * interpolando linearmente os knots de `RANK_GAP_KNOTS`. Fora do intervalo coberto pelos knots
 * o peso é 0 — daí a janela curta abaixo do alcance e a pequena ultrapassagem acima.
 */
function gapWeight(gap: number): number {
  const knots = RANK_GAP_KNOTS
  const first = knots[0]!
  const last = knots[knots.length - 1]!
  if (gap <= first[0] || gap >= last[0]) return 0
  for (let i = 0; i < knots.length - 1; i++) {
    const [g0, w0] = knots[i]!
    const [g1, w1] = knots[i + 1]!
    if (gap >= g0 && gap <= g1) return w0 + ((gap - g0) / (g1 - g0)) * (w1 - w0)
  }
  return 0
}

/**
 * Distribuição (probabilidades por rank, índice 0=F … 6=S) do rank-alvo de um encontro pela
 * Percepção do EXPLORADOR. `c = percepcao / PERCEPTION_PER_RANK` é o alcance contínuo (cada ponto
 * conta), e cada rank recebe `gapWeight(c − k)` normalizado. Calibrada para perc 60 → 50% S /
 * 40% A / 10% B e S só possível acima de 50 de Percepção (ver `balance.ts`).
 */
export function rankDistribution(perception: number): number[] {
  const c = clamp(perception / PERCEPTION_PER_RANK, 0, RANKS.length - 1)
  const weights = RANKS.map((_, k) => gapWeight(c - k))
  const total = weights.reduce((sum, w) => sum + w, 0)
  return total > 0 ? weights.map((w) => w / total) : weights
}

/** Sorteia o índice de rank-alvo (0=F … 6=S) pela distribuição da Percepção. Consome 1 saque. */
export function sampleTargetRank(rng: Rng, perception: number): number {
  const dist = rankDistribution(perception)
  let ticket = rng.next()
  for (let k = 0; k < dist.length; k++) {
    ticket -= dist[k] as number
    if (ticket < 0) return k
  }
  return dist.length - 1
}

/**
 * 6 índices de rank de eixo cuja SOMA é `6 × target` — logo a média (e o `pokemonRank`, que é o
 * round da média) fica cravada no rank-alvo. Parte de todos os eixos em `target` e aplica trocas
 * +1/−1 entre pares (soma preservada, valores em [F, S]) só para dar variedade; alvos extremos
 * (F/S) não têm para onde variar e saem uniformes. Consome `2 × TARGET_RANK_SWAP_ROUNDS` saques.
 */
export function targetRankAxes(rng: Rng, target: number): number[] {
  const n = ATTR_KEYS.length
  const top = RANKS.length - 1
  const axes = new Array<number>(n).fill(clamp(target, 0, top))
  for (let m = 0; m < TARGET_RANK_SWAP_ROUNDS; m++) {
    const i = rng.int(0, n - 1)
    const j = rng.int(0, n - 1)
    if (i !== j && (axes[i] as number) < top && (axes[j] as number) > 0) {
      axes[i] = (axes[i] as number) + 1
      axes[j] = (axes[j] as number) - 1
    }
  }
  return axes
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
