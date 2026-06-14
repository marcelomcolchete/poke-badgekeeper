// Ciclo de vida da defesa de ginásio (PLAN §3.1/§4.4):
// scheduled → active → won/lost. Resolve na hora ao atribuir o esquadrão.

import type { Pokemon } from '../types/index.ts'
import type { DefenseEvent, GameState } from '../engine/state.ts'
import { canDefend, resolveDefense } from '../engine/gymDefense.ts'
import { goldForDefense } from '../engine/economy.ts'
import { addXp } from '../engine/leveling.ts'
import { GYM_WIN_XP } from '../engine/balance.ts'
import { findMon, replaceMon, settleFaint, takeRng } from './runtime.ts'

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

/**
 * Derrota imediata: deixar o timer de uma defesa ATIVA zerar sem nem lutar encerra a
 * run na hora, independente do dia e da reputação. Congela o relógio e vai a GAMEOVER.
 */
export function loseRunByUndefendedGym(s: GameState): void {
  s.run.phase = 'GAMEOVER'
  s.run.gameOverReason = 'gym'
  s.clock.speed = 0
}

function squadOf(s: GameState, ids: readonly string[]): Pokemon[] {
  return ids
    .map((id) => findMon(s, id))
    .filter((p): p is Pokemon => p !== undefined && p.status === 'idle')
}

/**
 * Atribui o esquadrão (≥1 disponível) e resolve a cadeia de duelos 1v1 na hora.
 * Vitória rende ouro ∝ Carisma; perdedores de duelo perdem 1 HP (PLAN §4.4/§4.6).
 */
export function assignDefense(s: GameState, defenseId: string, squadIds: string[]): void {
  const defense = s.defenses.find((d) => d.id === defenseId)
  if (!defense || defense.status !== 'active') return
  const squad = squadOf(s, squadIds)
  if (!canDefend(squad)) return

  const resolution = resolveDefense(takeRng(s), squad, defense.enemies)

  // Quantos duelos cada Pokémon venceu — cada vitória rende um pouco de XP (PLAN §4.4).
  // E registra o desafiante derrotado (defeaterId + espécie) para o MVP/relatório.
  const winsById = new Map<string, number>()
  let theirs = 0
  for (const duel of resolution.duels) {
    if (duel.youWon) {
      winsById.set(duel.yourId, (winsById.get(duel.yourId) ?? 0) + 1)
      s.today.defenseKills.push({
        defeaterId: duel.yourId,
        speciesId: defense.enemies[theirs]?.speciesId,
      })
      theirs += 1
    }
  }

  for (const member of resolution.squad) {
    const wins = winsById.get(member.id) ?? 0
    // XP aplicado já aqui (a defesa resolve toda de uma vez): o level-up só "aparece" ao final.
    const leveled = wins > 0 ? addXp(member, wins * GYM_WIN_XP, takeRng(s)).pokemon : member
    if (wins > 0) s.today.xpEarned += wins * GYM_WIN_XP
    replaceMon(s, settleFaint(s, leveled))
  }

  defense.squadIds = squad.map((p) => p.id)
  defense.duels = resolution.duels
  defense.status = resolution.won ? 'won' : 'lost'

  // Ouro é pago por participar da batalha, vencendo OU perdendo (PLAN §4.6, ajuste).
  const gold = goldForDefense(squad)
  s.gold += gold
  s.today.goldEarned += gold
  s.today.defenseGold += gold
  if (resolution.won) s.today.defensesWon += 1
  else s.today.defensesLost += 1
}
