// Mercado e ajustes do jogador (PLAN — Sistema de Itens): comprar itens (cura/revive,
// buffs diários x_*, passivos da run, Rare Candy, Premier/Fossil) e alocar o ponto de um
// level-up. A cura/revive é USADA manualmente (applyItem: escopo single/team); os passivos
// vivem em s.runItems e são lidos pela engine; os buffs x_* entram em pokemon.dayBuffs.

import type { AttrKey, Attrs, Pokemon } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { getItem } from '../data/items.ts'
import { nextBall } from '../data/balls.ts'
import { applyGoldBonus, canAfford } from '../engine/economy.ts'
import { LEVEL_MAX } from '../engine/constants.ts'
import { heal, recomputeMaxHp } from '../engine/attributes.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import {
  allocatePoint as engineAllocate,
  evolveOneStage,
  evolveToLevel,
  pendingPoints,
} from '../engine/leveling.ts'
import { findMon, replaceMon, takeId, takeRng } from './runtime.ts'

/** Marca um item como vendido hoje (vira "VENDIDO" no mercado — 1 compra por slot/dia). */
function markSold(s: GameState, itemId: string): void {
  if (!s.today.purchasedItems.includes(itemId)) {
    s.today.purchasedItems = [...s.today.purchasedItems, itemId]
  }
}

/** Compra no mercado (sem ouro suficiente → no-op) — ramifica pelo efeito do item. */
export function buyItem(s: GameState, itemId: string, quantity = 1): void {
  const item = getItem(itemId)
  if (quantity <= 0) return
  // Cada slot do mercado só pode ser comprado uma vez por dia.
  if (s.today.purchasedItems.includes(itemId)) return
  const effect = item.effect

  switch (effect.kind) {
    case 'heal':
    case 'revive': {
      // Cada compra adiciona `uses` cargas ao inventário; o item é USADO manualmente depois.
      if (!canAfford(s.gold, item, quantity)) return
      s.gold -= item.price * quantity
      addCharges(s, itemId, effect.uses * quantity)
      markSold(s, itemId)
      return
    }
    case 'premierBall': {
      // Sobe 1 nível a bola atual de graça (nível 0 → Pokébola). Cobra só o preço da Premier.
      if (!nextBall(s.run.ballLevel)) return // já na Masterball
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      s.run.ballLevel += 1
      markSold(s, itemId)
      return
    }
    case 'statBuff': {
      // Buff diário: +amount no eixo para TODO o time (afeta inclusive o HP); some de manhã.
      if (!canAfford(s.gold, item, quantity)) return
      s.gold -= item.price * quantity
      applyStatBuff(s, effect.attr, effect.amount * quantity)
      markSold(s, itemId)
      return
    }
    case 'passive': {
      // Item da run: efeito permanente em s.runItems. Já possui = não cobra/não duplica.
      if (s.runItems.includes(itemId)) return
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      s.runItems = [...s.runItems, itemId]
      markSold(s, itemId)
      return
    }
    case 'instantGold': {
      // Big Nugget: paga na hora (×1.5 com Amulet Coin). Preço normalmente 0.
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      s.gold += applyGoldBonus(effect.amount, s.runItems)
      markSold(s, itemId)
      return
    }
    case 'berry': {
      if (!canAfford(s.gold, item, quantity)) return
      s.gold -= item.price * quantity
      addCharges(s, itemId, quantity)
      markSold(s, itemId)
      return
    }
    case 'egg': {
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      ;(s.eggs ??= []).push({ id: takeId(s, 'egg'), daysElapsed: 0 })
      markSold(s, itemId)
      return
    }
    case 'rareCandy':
      // Precisa de um alvo escolhido na compra → tratado por useRareCandy (ação dedicada).
      return
    case 'moonStone':
      // Precisa de um alvo escolhido na compra → tratado por useMoonStone (ação dedicada).
      return
  }
}

/**
 * Compra a próxima bola (Pokébola grátis → Greatball → Ultraball → Masterball): sobe
 * run.ballLevel, debita o ouro (a Pokébola inicial é grátis) e marca o slot como vendido
 * hoje. Já no topo (Masterball), sem ouro ou já comprada hoje → no-op.
 */
export function buyBall(s: GameState): void {
  const ball = nextBall(s.run.ballLevel)
  if (!ball) return
  if (s.today.purchasedItems.includes(ball.id)) return
  if (s.gold < ball.price) return
  s.gold -= ball.price
  s.run.ballLevel += 1
  markSold(s, ball.id)
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
  if (s.today.purchasedItems.includes(item.id)) return // já comprado hoje
  if (!mon || mon.level >= LEVEL_MAX || !canAfford(s.gold, item)) return
  s.gold -= item.price
  const rng = takeRng(s)
  const leveled = recomputeMaxHp(evolveToLevel({ ...mon, level: mon.level + 1 }, rng, s.runItems.includes('everstone')))
  replaceMon(s, leveled)
  markSold(s, item.id)
}

/**
 * Moon Stone: evolui o Pokémon escolhido (time OU caixa) um estágio, ignorando o nível (sorteia o
 * ramo). Sem ouro, alvo inexistente, que não evolui, ou já comprado hoje → no-op (a UI bloqueia).
 */
export function useMoonStone(s: GameState, pokemonId: string): void {
  const item = getItem('moon-stone')
  if (s.runItems.includes('everstone')) return // Everstone impede toda evolução
  if (s.today.purchasedItems.includes(item.id)) return
  const fromRoster = s.roster.find((p) => p.id === pokemonId)
  const target = fromRoster ?? s.box.find((p) => p.id === pokemonId)
  if (!target || getSpecies(target.speciesId).evolvesTo === null || !canAfford(s.gold, item)) return
  s.gold -= item.price
  const evolved = evolveOneStage(target, takeRng(s))
  if (fromRoster) s.roster = s.roster.map((p) => (p.id === pokemonId ? evolved : p))
  else s.box = s.box.map((p) => (p.id === pokemonId ? evolved : p))
  markSold(s, item.id)
}

function consumeItem(s: GameState, itemId: string): boolean {
  const stack = s.inventory.find((i) => i.itemId === itemId)
  if (!stack || stack.quantity <= 0) return false
  s.inventory = s.inventory
    .map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
    .filter((i) => i.quantity > 0)
  return true
}

/**
 * Uso MANUAL de um item de cura/revive (PLAN §4.6). Escopo `single`: cura/revive o Pokémon
 * escolhido (`targetId`); escopo `team`: aplica no time inteiro de uma vez (`targetId` ignorado).
 * Consome 1 carga só se algo de fato mudou (não desperdiça num time já cheio de HP/sem desmaiados).
 */
export function applyItem(s: GameState, itemId: string, targetId: string): void {
  const effect = getItem(itemId).effect
  if (effect.kind === 'berry') {
    const target = findMon(s, targetId)
    if (!target || target.currentHp <= 0) return // não usa em desmaiado
    if (!consumeItem(s, itemId)) return
    const attr = effect.attr
    const bumped = recomputeMaxHp({
      ...target,
      permaBonus: { ...target.permaBonus, [attr]: (target.permaBonus?.[attr] ?? 0) + effect.statAmount },
    })
    const restored = heal(bumped, Math.ceil(bumped.maxHp * effect.healPct))
    replaceMon(s, restored)
    return
  }
  if (effect.kind !== 'heal' && effect.kind !== 'revive') return
  if (effect.scope === 'team') {
    if (!applyTeamItem(s, effect.kind)) return
    consumeItem(s, itemId)
    return
  }
  const target = findMon(s, targetId)
  if (!target) return
  const next = singleItemEffect(effect.kind, target)
  if (!next) return // efeito inválido (ex.: Potion em desmaiado / Revive em vivo)
  if (!consumeItem(s, itemId)) return
  replaceMon(s, next)
}

/** Cura (enche o HP de quem está vivo e ferido) ou revive um único Pokémon; null se nada a fazer. */
function singleItemEffect(kind: 'heal' | 'revive', target: Pokemon): Pokemon | null {
  if (kind === 'heal') {
    return target.currentHp > 0 && target.currentHp < target.maxHp ? heal(target, target.maxHp) : null
  }
  return target.currentHp <= 0 ? { ...target, currentHp: target.maxHp, status: 'idle' } : null
}

/** Aplica cura/revive no TIME inteiro; retorna se algum Pokémon foi de fato afetado. */
function applyTeamItem(s: GameState, kind: 'heal' | 'revive'): boolean {
  let changed = false
  s.roster = s.roster.map((p) => {
    if (kind === 'heal' && p.currentHp > 0 && p.currentHp < p.maxHp) {
      changed = true
      return heal(p, p.maxHp)
    }
    if (kind === 'revive' && p.currentHp <= 0) {
      changed = true
      return { ...p, currentHp: p.maxHp, status: 'idle' }
    }
    return p
  })
  return changed
}

/** Aloca o ponto pendente de um level-up no atributo escolhido (PLAN §4.1). */
export function allocatePoint(s: GameState, pokemonId: string, attr: AttrKey): void {
  const mon = findMon(s, pokemonId)
  if (!mon || pendingPoints(mon) <= 0) return
  replaceMon(s, engineAllocate(mon, attr))
}
