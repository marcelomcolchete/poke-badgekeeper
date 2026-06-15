// Mercado e ajustes do jogador (PLAN — Sistema de Itens): comprar itens (cura/revive,
// buffs diários x_*, passivos da run, Rare Candy) e alocar o ponto de um level-up.
// Os efeitos de cura/revive disparam sozinhos (itemFlow.applyAutoItems); os passivos vivem
// em s.runItems e são lidos pela engine; os buffs x_* entram em pokemon.dayBuffs.

import type { AttrKey, Attrs, Pokemon } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { getItem } from '../data/items.ts'
import { canAfford } from '../engine/economy.ts'
import { LEVEL_MAX } from '../engine/constants.ts'
import { heal, recomputeMaxHp } from '../engine/attributes.ts'
import { allocatePoint as engineAllocate, evolveToLevel, pendingPoints } from '../engine/leveling.ts'
import { findMon, replaceMon, takeRng } from './runtime.ts'

/** Compra no mercado (sem ouro suficiente → no-op) — ramifica pelo efeito do item. */
export function buyItem(s: GameState, itemId: string, quantity = 1): void {
  const item = getItem(itemId)
  if (quantity <= 0) return
  const effect = item.effect

  switch (effect.kind) {
    case 'autoPotion':
    case 'autoRevive': {
      // Cada compra adiciona `uses` cargas ao inventário (Super Potion/Max Revive = 3).
      if (!canAfford(s.gold, item, quantity)) return
      s.gold -= item.price * quantity
      addCharges(s, itemId, effect.uses * quantity)
      return
    }
    case 'statBuff': {
      // Buff diário: +amount no eixo para TODO o time (afeta inclusive o HP); some de manhã.
      if (!canAfford(s.gold, item, quantity)) return
      s.gold -= item.price * quantity
      applyStatBuff(s, effect.attr, effect.amount * quantity)
      return
    }
    case 'passive': {
      // Item da run: efeito permanente em s.runItems. Já possui = não cobra/não duplica.
      if (s.runItems.includes(itemId)) return
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      s.runItems = [...s.runItems, itemId]
      return
    }
    case 'rareCandy':
      // Precisa de um alvo escolhido na compra → tratado por useRareCandy (ação dedicada).
      return
  }
}

/** Adiciona `uses` cargas (usos) de um item de cura/revive ao inventário. */
function addCharges(s: GameState, itemId: string, uses: number): void {
  const stack = s.inventory.find((i) => i.itemId === itemId)
  if (stack) stack.quantity += uses
  else s.inventory = [...s.inventory, { itemId, quantity: uses }]
}

/** Aplica +amount num eixo a todo o roster (dayBuffs) e recalcula o HP (enche, é de manhã). */
function applyStatBuff(s: GameState, attr: AttrKey, amount: number): void {
  s.roster = s.roster.map((p) => {
    const dayBuffs: Partial<Attrs> = { ...p.dayBuffs, [attr]: (p.dayBuffs?.[attr] ?? 0) + amount }
    const buffed = recomputeMaxHp({ ...p, dayBuffs })
    return { ...buffed, currentHp: buffed.maxHp }
  })
}

/**
 * Rare Candy: na compra, o Pokémon escolhido sobe 1 nível (evolui/recalcula HP se for o caso).
 * Sem ouro, alvo inexistente ou já no nível máximo → no-op (a UI também bloqueia o alvo no teto).
 */
export function useRareCandy(s: GameState, pokemonId: string): void {
  const item = getItem('rare-candy')
  const mon = findMon(s, pokemonId)
  if (!mon || mon.level >= LEVEL_MAX || !canAfford(s.gold, item)) return
  s.gold -= item.price
  const rng = takeRng(s)
  const leveled = recomputeMaxHp(evolveToLevel({ ...mon, level: mon.level + 1 }, rng))
  replaceMon(s, leveled)
}

function consumeItem(s: GameState, itemId: string): boolean {
  const stack = s.inventory.find((i) => i.itemId === itemId)
  if (!stack || stack.quantity <= 0) return false
  s.inventory = s.inventory
    .map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
    .filter((i) => i.quantity > 0)
  return true
}

/** Uso MANUAL de um item de cura/revive num Pokémon (cura/revive ao máximo) — PLAN §4.6. */
export function applyItem(s: GameState, itemId: string, targetId: string): void {
  const target = findMon(s, targetId)
  if (!target) return
  const next = applyItemEffect(itemId, target)
  if (!next) return // item desconhecido ou efeito inválido (ex.: Potion em desmaiado)
  if (!consumeItem(s, itemId)) return
  replaceMon(s, next)
}

function applyItemEffect(itemId: string, target: Pokemon): Pokemon | null {
  const effect = getItem(itemId).effect
  switch (effect.kind) {
    case 'autoPotion':
      return target.currentHp > 0 ? heal(target, target.maxHp) : null
    case 'autoRevive':
      return target.currentHp <= 0 ? { ...target, currentHp: target.maxHp, status: 'idle' } : null
    default:
      return null // demais itens não são "usados" manualmente
  }
}

/** Aloca o ponto pendente de um level-up no atributo escolhido (PLAN §4.1). */
export function allocatePoint(s: GameState, pokemonId: string, attr: AttrKey): void {
  const mon = findMon(s, pokemonId)
  if (!mon || pendingPoints(mon) <= 0) return
  replaceMon(s, engineAllocate(mon, attr))
}
