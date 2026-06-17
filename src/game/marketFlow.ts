// Mercado e ajustes do jogador (PLAN — Sistema de Itens): comprar itens (cura/revive,
// buffs diários x_*, passivos da run, Rare Candy, Premier/Fossil) e alocar o ponto de um
// level-up. A cura/revive é USADA manualmente (applyItem: escopo single/team); os passivos
// vivem em s.runItems e são lidos pela engine; os buffs x_* entram em pokemon.dayBuffs.

import type { AttrKey, Attrs, Pokemon } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { getItem } from '../data/items.ts'
import { nextBall } from '../data/balls.ts'
import { canAfford } from '../engine/economy.ts'
import { LEVEL_MAX } from '../engine/constants.ts'
import { heal, recomputeMaxHp } from '../engine/attributes.ts'
import { rosterIsFull } from '../engine/capture.ts'
import { RANKS } from '../engine/ranking.ts'
import {
  allocatePoint as engineAllocate,
  createPokemon,
  evolveToLevel,
  pendingPoints,
} from '../engine/leveling.ts'
import { findMon, replaceMon, takeId, takeRng } from './runtime.ts'

/** Espécies fósseis sorteadas pela Fossil Stone (Omanyte/Omastar/Kabuto/Kabutops/Aerodactyl). */
const FOSSIL_SPECIES_IDS = [138, 139, 140, 141, 142]

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
    case 'fossilStone': {
      // Gera um Pokémon fóssil aleatório (nível 1, rank F–S sorteado) no time ou no PC.
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      grantFossil(s)
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
    case 'rareCandy':
      // Precisa de um alvo escolhido na compra → tratado por useRareCandy (ação dedicada).
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
  const leveled = recomputeMaxHp(evolveToLevel({ ...mon, level: mon.level + 1 }, rng))
  replaceMon(s, leveled)
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

/** Fossil Stone: cria um Pokémon fóssil aleatório (nível 1, rank F–S) no time (ou no PC se cheio). */
function grantFossil(s: GameState): void {
  const rng = takeRng(s)
  const speciesId = rng.pick(FOSSIL_SPECIES_IDS)
  // Rank sorteado uniformemente de F (0) a S (RANKS.length − 1) vira o centro de rank dos IVs.
  const rankCenter = rng.int(0, RANKS.length - 1)
  const id = takeId(s, 'p')
  const mon = createPokemon({ id, speciesId, level: 1, rng, rankCenter })
  if (rosterIsFull(s.roster)) s.box = [...s.box, mon]
  else s.roster = [...s.roster, mon]
  if (!s.caughtSpecies.includes(speciesId)) s.caughtSpecies = [...s.caughtSpecies, speciesId]
}

/** Aloca o ponto pendente de um level-up no atributo escolhido (PLAN §4.1). */
export function allocatePoint(s: GameState, pokemonId: string, attr: AttrKey): void {
  const mon = findMon(s, pokemonId)
  if (!mon || pendingPoints(mon) <= 0) return
  replaceMon(s, engineAllocate(mon, attr))
}
