// Sorteio ponderado por raridade (PLAN §4.5): Common 40 / Uncommon 30 / Rare 15 /
// Epic 10 / Legend 5. Mais raro = menos provável de aparecer no sorteio.

import type { Rarity } from '../types/index.ts'
import { RARITIES } from '../types/index.ts'
import type { Rng } from './rng.ts'
import { RARITY_DRAW_WEIGHT } from './balance.ts'

/** Sorteia uma raridade pelos pesos, restrita às presentes em `available`. */
export function pickRarity(rng: Rng, available: ReadonlySet<Rarity>): Rarity | null {
  const pool = RARITIES.filter((r) => available.has(r))
  if (pool.length === 0) return null
  const total = pool.reduce((sum, r) => sum + RARITY_DRAW_WEIGHT[r], 0)
  let ticket = rng.float(0, total)
  for (const r of pool) {
    ticket -= RARITY_DRAW_WEIGHT[r]
    if (ticket <= 0) return r
  }
  return pool[pool.length - 1] ?? null
}

/** Escolhe um item ponderando pela raridade: rola a raridade, depois sorteia entre as dela. */
export function pickByRarity<T extends { rarity: Rarity }>(rng: Rng, items: readonly T[]): T {
  const available = new Set(items.map((i) => i.rarity))
  const rarity = pickRarity(rng, available)
  const matching = rarity ? items.filter((i) => i.rarity === rarity) : items
  return rng.pick(matching.length > 0 ? matching : items)
}
