// Bolas (item evolutivo do mercado): cada nível libera UMA raridade a mais nos encontros
// da exploração. Pokébola → Greatball → Ultraball → Masterball. A Pokébola (primeiro nível,
// que libera os "Incomum") é grátis; as demais custam 500. O nível possuído vive em
// run.ballLevel (0 = nenhuma) e sobe ao comprar a próxima bola no mercado.

import type { Rarity } from '../types/index.ts'
import { RARITIES } from '../types/index.ts'

export interface BallDef {
  /** Nível desta bola (1 = Pokébola … 4 = Masterball) — igual ao run.ballLevel após comprá-la. */
  level: number
  id: string
  name: string
  sprite: string
  /** Preço no mercado: Pokébola grátis (0); as demais 500. */
  price: number
  /** Raridade MÁXIMA liberada nos encontros enquanto esta é a bola atual. */
  ceiling: Rarity
}

const sprite = (id: string): string => `/sprites/itens/${id}.png`

/** Preço padrão das evoluções da bola (a Pokébola inicial é grátis). */
export const BALL_PRICE = 500

export const BALLS: BallDef[] = [
  { level: 1, id: 'poke-ball', name: 'Pokébola', sprite: sprite('poke-ball'), price: 0, ceiling: 'uncommon' },
  { level: 2, id: 'great-ball', name: 'Great Ball', sprite: sprite('great-ball'), price: BALL_PRICE, ceiling: 'rare' },
  { level: 3, id: 'ultra-ball', name: 'Ultra Ball', sprite: sprite('ultra-ball'), price: BALL_PRICE, ceiling: 'epic' },
  { level: 4, id: 'master-ball', name: 'Master Ball', sprite: sprite('master-ball'), price: BALL_PRICE, ceiling: 'legend' },
]

/** Nível máximo (Masterball) — atingi-lo libera todas as raridades. */
export const BALL_MAX_LEVEL = BALLS.length

/** Nomes de raridade em PT para descrições da loja/Pokédex. */
export const RARITY_LABEL_PT: Record<Rarity, string> = {
  common: 'Comuns',
  uncommon: 'Incomuns',
  rare: 'Raros',
  epic: 'Épicos',
  legend: 'Lendários',
}

/** Próxima bola comprável dado o nível atual; null se já no topo (Masterball). */
export function nextBall(ballLevel: number): BallDef | null {
  return BALLS[ballLevel] ?? null
}

/** Bola atualmente possuída (null no nível 0, antes da Pokébola). */
export function currentBall(ballLevel: number): BallDef | null {
  return ballLevel >= 1 ? BALLS[ballLevel - 1] ?? null : null
}

/**
 * Índice da raridade MÁXIMA liberada hoje pelo nível de bola (0 = só Comum). Usado para
 * filtrar os encontros e as silhuetas da Pokédex da área.
 */
export function maxRarityIndexForBall(ballLevel: number): number {
  const ball = currentBall(ballLevel)
  return ball ? RARITIES.indexOf(ball.ceiling) : RARITIES.indexOf('common')
}
