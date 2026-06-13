// Mercado e ajustes do jogador (PLAN §4.6/§4.1): comprar/usar itens e alocar
// o ponto de um level-up. Efeitos de itens passivos (Quick Claw…) ficam p/ a Fase 5.

import type { AttrKey, Pokemon } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { getItem } from '../data/items.ts'
import { buyItem as engineBuyItem, canAfford } from '../engine/economy.ts'
import { POTION_HEAL, REVIVE_HP_FRACTION, SUPER_POTION_HEAL } from '../engine/balance.ts'
import { HP_MIN } from '../engine/constants.ts'
import { heal } from '../engine/attributes.ts'
import { allocatePoint as engineAllocate, pendingPoints } from '../engine/leveling.ts'
import { clamp } from '../engine/math.ts'
import { findMon, replaceMon } from './runtime.ts'

/** Compra no mercado (sem ouro suficiente → no-op) — PLAN §4.6. */
export function buyItem(s: GameState, itemId: string, quantity = 1): void {
  const item = getItem(itemId)
  if (quantity <= 0 || !canAfford(s.gold, item, quantity)) return
  const result = engineBuyItem(s.gold, s.inventory, itemId, quantity)
  s.gold = result.gold
  s.inventory = result.inventory
}

function consumeItem(s: GameState, itemId: string): boolean {
  const stack = s.inventory.find((i) => i.itemId === itemId)
  if (!stack || stack.quantity <= 0) return false
  s.inventory = s.inventory
    .map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
    .filter((i) => i.quantity > 0)
  return true
}

/** Aplica o efeito de um item usável a um Pokémon do roster (Potion/Revive…) — PLAN §4.6. */
export function applyItem(s: GameState, itemId: string, targetId: string): void {
  const target = findMon(s, targetId)
  if (!target) return
  const next = applyItemEffect(itemId, target)
  if (!next) return // item desconhecido ou efeito inválido (ex.: Potion em desmaiado)
  if (!consumeItem(s, itemId)) return
  replaceMon(s, next)
}

function applyItemEffect(itemId: string, target: Pokemon): Pokemon | null {
  switch (itemId) {
    case 'potion':
      return target.currentHp > 0 ? heal(target, POTION_HEAL) : null
    case 'super-potion':
      return target.currentHp > 0 ? heal(target, SUPER_POTION_HEAL) : null
    case 'revive':
      return target.currentHp <= 0 ? revive(target) : null
    default:
      return null // itens passivos não são "usados" aqui
  }
}

function revive(target: Pokemon): Pokemon {
  const currentHp = clamp(Math.round(target.maxHp * REVIVE_HP_FRACTION), HP_MIN, target.maxHp)
  return { ...target, currentHp, status: 'idle' }
}

/** Aloca o ponto pendente de um level-up no atributo escolhido (PLAN §4.1). */
export function allocatePoint(s: GameState, pokemonId: string, attr: AttrKey): void {
  const mon = findMon(s, pokemonId)
  if (!mon || pendingPoints(mon) <= 0) return
  replaceMon(s, engineAllocate(mon, attr))
}
