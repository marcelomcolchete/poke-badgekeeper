// Ciclo de vida da defesa de ginásio (PLAN §3.1/§4.4):
// scheduled → active → won/lost. Resolve na hora ao atribuir o esquadrão.

import type { Pokemon } from '../types/index.ts'
import type { DefenseEvent, GameState } from '../engine/state.ts'
import { canDefend, resolveDefense } from '../engine/gymDefense.ts'
import { goldForDefense } from '../engine/economy.ts'
import { findMon, replaceMon, takeRng } from './runtime.ts'

/** Promove a defesa a 'active' (símbolo no ginásio) e conta no total do dia (PLAN §3.1). */
export function spawnDefense(s: GameState, defense: DefenseEvent, nowMs: number): void {
  if (defense.status === 'scheduled' && nowMs >= defense.spawnAtMs) {
    defense.status = 'active'
    s.today.defensesTotal += 1
  }
}

/** Defesa ignorada até o timer zerar = perdida (sem ouro) — PLAN §3.1. */
export function expireDefense(defense: DefenseEvent): void {
  if (defense.status === 'active') defense.status = 'lost'
}

function squadOf(s: GameState, ids: readonly string[]): Pokemon[] {
  return ids
    .map((id) => findMon(s, id))
    .filter((p): p is Pokemon => p !== undefined && p.status === 'idle')
}

/**
 * Atribui o esquadrão (≥3 disponíveis) e resolve a cadeia de duelos 1v1 na hora.
 * Vitória rende ouro ∝ Carisma; perdedores de duelo perdem 1 HP (PLAN §4.4/§4.6).
 */
export function assignDefense(s: GameState, defenseId: string, squadIds: string[]): void {
  const defense = s.defenses.find((d) => d.id === defenseId)
  if (!defense || defense.status !== 'active') return
  const squad = squadOf(s, squadIds)
  if (!canDefend(squad)) return

  const resolution = resolveDefense(takeRng(s), squad, defense.enemies)
  for (const member of resolution.squad) {
    replaceMon(s, { ...member, status: member.currentHp <= 0 ? 'fainted' : 'idle' })
  }

  defense.squadIds = squad.map((p) => p.id)
  defense.status = resolution.won ? 'won' : 'lost'
  if (resolution.won) {
    const gold = goldForDefense(squad)
    s.gold += gold
    s.today.goldEarned += gold
    s.today.defensesWon += 1
  }
}
