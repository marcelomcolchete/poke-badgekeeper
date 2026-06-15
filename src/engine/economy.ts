// Economia: ouro por defesa vencida (∝ Carisma) e compra no mercado (PLAN §4.6).

import type { Pokemon } from '../types/index.ts'
import type { ItemData } from '../data/types.ts'
import type { ItemStack } from './state.ts'
import { getItem } from '../data/items.ts'
import { ATTR_MAX } from './constants.ts'
import { GOLD_BASE_PER_DEFENSE } from './balance.ts'
import { effectiveAttr } from './attributes.ts'
import { average } from './math.ts'

/** Ouro de uma defesa vencida = ouroBase · (1 + médiaCarisma/60) — PLAN §4.6. */
export function goldForDefense(squad: readonly Pokemon[]): number {
  const avgCharisma = average(squad.map((p) => effectiveAttr(p, 'carisma')))
  return Math.round(GOLD_BASE_PER_DEFENSE * (1 + avgCharisma / ATTR_MAX))
}

/**
 * Ouro de uma missão Pokémart escalado pelo Carisma do time: base · (1 + médiaCarisma/60),
 * chegando a 2× com média 60. Sem participantes, devolve a base.
 */
export function goldForMart(team: readonly Pokemon[], base: number): number {
  if (team.length === 0) return base
  const avgCharisma = average(team.map((p) => effectiveAttr(p, 'carisma')))
  return Math.round(base * (1 + avgCharisma / ATTR_MAX))
}

/** Soma do ouro de todas as defesas vencidas no dia (cada uma com seu esquadrão). */
export function totalDefenseGold(squads: readonly (readonly Pokemon[])[]): number {
  return squads.reduce((sum, squad) => sum + goldForDefense(squad), 0)
}

export function canAfford(gold: number, item: ItemData, quantity = 1): boolean {
  return gold >= item.price * quantity
}

export interface PurchaseResult {
  gold: number
  inventory: ItemStack[]
}

/**
 * Compra `quantity` de um item: debita o ouro e empilha no inventário.
 * Lança se não houver ouro suficiente (chame canAfford antes) — PLAN §4.6.
 */
export function buyItem(
  gold: number,
  inventory: readonly ItemStack[],
  itemId: string,
  quantity = 1,
): PurchaseResult {
  const item = getItem(itemId)
  if (!canAfford(gold, item, quantity)) throw new Error('Ouro insuficiente')
  return {
    gold: gold - item.price * quantity,
    inventory: addToInventory(inventory, itemId, quantity),
  }
}

function addToInventory(
  inventory: readonly ItemStack[],
  itemId: string,
  quantity: number,
): ItemStack[] {
  const exists = inventory.some((stack) => stack.itemId === itemId)
  if (exists) {
    return inventory.map((stack) =>
      stack.itemId === itemId ? { ...stack, quantity: stack.quantity + quantity } : stack,
    )
  }
  return [...inventory, { itemId, quantity }]
}
