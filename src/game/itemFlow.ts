// Efeitos de itens que tocam o GameState durante o dia (PLAN — Sistema de Itens):
//  - applyAutoItems: cura/revive automáticos (consomem cargas do inventário) após cada
//    desfecho que mexe em HP (missão/batalha).
//  - applyXpGains: aplica XP por Pokémon e distribui o Exp Share (5% ao resto do time).

import type { GameState } from '../engine/state.ts'
import type { Rng } from '../engine/rng.ts'
import { EXP_SHARE_RATE } from '../engine/balance.ts'
import { addXp } from '../engine/leveling.ts'
import { findMon, replaceMon } from './runtime.ts'

/** Ids que compartilham o "pool" de cura (Potion) e o de revive. */
const HEAL_ITEM_IDS = ['potion', 'super-potion']
const REVIVE_ITEM_IDS = ['revive', 'max-revive']

/** Consome 1 carga (uso) de uma família de itens do inventário; false se não havia nenhuma. */
function consumeCharge(s: GameState, familyIds: readonly string[]): boolean {
  for (const stack of s.inventory) {
    if (familyIds.includes(stack.itemId) && stack.quantity > 0) {
      stack.quantity -= 1
      return true
    }
  }
  return false
}

/**
 * Dispara os itens de cura/revive automáticos sobre o roster (PLAN — Itens). Chamado após
 * aplicar dano de missão/batalha:
 *  - Revive/Max Revive: cada Pokémon DESMAIADO volta com todo o HP (1 carga por Pokémon).
 *  - Potion/Super Potion: cada Pokémon VIVO e ferido enche o HP (mais ferido primeiro).
 * Cada item de cura/revive guarda no inventário a quantidade de USOS restantes.
 */
export function applyAutoItems(s: GameState): void {
  // Revives primeiro (trazem desmaiados de volta antes de gastar Potions).
  for (;;) {
    const fainted = s.roster.find((p) => p.currentHp <= 0)
    if (!fainted || !consumeCharge(s, REVIVE_ITEM_IDS)) break
    replaceMon(s, {
      ...fainted,
      currentHp: fainted.maxHp,
      status: fainted.status === 'fainted' ? 'idle' : fainted.status,
    })
  }
  // Potions: enche o HP de quem está vivo e ferido, começando pelo mais machucado.
  for (;;) {
    const damaged = s.roster
      .filter((p) => p.currentHp > 0 && p.currentHp < p.maxHp)
      .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0]
    if (!damaged || !consumeCharge(s, HEAL_ITEM_IDS)) break
    replaceMon(s, { ...damaged, currentHp: damaged.maxHp })
  }
  // Remove pilhas zeradas (mantém o inventário enxuto).
  s.inventory = s.inventory.filter((stack) => stack.quantity > 0)
}

/**
 * Aplica ganhos de XP por Pokémon e, se o time tem Exp Share, distribui 5% da XP de CADA
 * recebedor ao resto do roster. Acumula tudo ANTES de aplicar (evita usar snapshots já
 * desatualizados pelo addXp anterior). O `rng` semeia as evoluções de forma determinística.
 */
export function applyXpGains(s: GameState, baseGains: Map<string, number>, rng: Rng): void {
  const total = new Map(baseGains)
  if (s.runItems.includes('exp-share')) {
    for (const [id, xp] of baseGains) {
      if (xp <= 0) continue
      const share = Math.floor(xp * EXP_SHARE_RATE)
      if (share <= 0) continue
      for (const p of s.roster) {
        if (p.id === id) continue
        total.set(p.id, (total.get(p.id) ?? 0) + share)
      }
    }
  }
  for (const [id, xp] of total) {
    if (xp <= 0) continue
    const mon = findMon(s, id)
    if (mon) replaceMon(s, addXp(mon, xp, rng).pokemon)
  }
}
