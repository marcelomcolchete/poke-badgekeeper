// Efeitos de itens que tocam o GameState durante o dia (PLAN — Sistema de Itens):
//  - applyXpGains: aplica XP por Pokémon e distribui o Exp Share (5% ao resto do time).
// A cura/revive (Potion/Revive…) é 100% MANUAL: o jogador clica no item e escolhe o alvo
// (ou o time inteiro), tratada em marketFlow.applyItem.

import type { GameState } from '../engine/state.ts'
import type { Rng } from '../engine/rng.ts'
import { EXP_SHARE_RATE } from '../engine/balance.ts'
import { addXp } from '../engine/leveling.ts'
import { findMon, replaceMon } from './runtime.ts'

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
