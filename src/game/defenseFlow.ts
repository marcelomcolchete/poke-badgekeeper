// Ciclo de vida da defesa de ginásio (PLAN §3.1/§4.4):
// scheduled → active → won/lost. Resolve na hora ao atribuir o esquadrão.

import type { Pokemon } from '../types/index.ts'
import type { DefenseEvent, GameState } from '../engine/state.ts'
import { canDefend, resolveDefense } from '../engine/gymDefense.ts'
import { goldForDefense } from '../engine/economy.ts'
import { addXp } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
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
 * Atribui o esquadrão (≥1 disponível) e resolve a cadeia de duelos 1v1 na hora: aplica HP
 * (perdedor de duelo perde 1), ouro (∝ Carisma) e registra os desafiantes derrotados. O
 * XP/level-up das vitórias é ADIADO para o fim da animação (completeDefense) — PLAN §4.4/§4.6.
 */
export function assignDefense(s: GameState, defenseId: string, squadIds: string[]): void {
  const defense = s.defenses.find((d) => d.id === defenseId)
  if (!defense || defense.status !== 'active') return
  const squad = squadOf(s, squadIds)
  if (!canDefend(squad)) return

  const resolution = resolveDefense(takeRng(s), squad, defense.enemies)

  // Registra o desafiante derrotado (defeaterId + espécie) para o MVP/relatório.
  let theirs = 0
  for (const duel of resolution.duels) {
    if (duel.youWon) {
      s.today.defenseKills.push({
        defeaterId: duel.yourId,
        speciesId: defense.enemies[theirs]?.speciesId,
      })
      theirs += 1
    }
  }

  // HP/desmaio aplicados já (a batalha acontece agora); o XP fica para completeDefense.
  for (const member of resolution.squad) replaceMon(s, settleFaint(s, member))

  defense.squadIds = squad.map((p) => p.id)
  defense.duels = resolution.duels
  defense.status = resolution.won ? 'won' : 'lost'
  // Seed de evolução sorteado agora (cursor do RNG estável); usado ao aplicar o XP depois.
  defense.xpSeed = takeRng(s).int(0, 0x7fffffff)
  defense.xpApplied = false

  // Ouro é pago por participar da batalha, vencendo OU perdendo (PLAN §4.6, ajuste).
  const gold = goldForDefense(squad)
  s.gold += gold
  s.today.goldEarned += gold
  s.today.defenseGold += gold
  if (resolution.won) s.today.defensesWon += 1
  else s.today.defensesLost += 1
}

/**
 * Conclui a defesa ao FIM da animação: aplica o XP de cada vitória (1 duelo vencido =
 * GYM_WIN_XP), podendo subir nível/evoluir — o level-up só "aparece" agora (PLAN §4.4,
 * ajuste). Idempotente: só aplica uma vez (xpApplied).
 */
export function completeDefense(s: GameState, defenseId: string): void {
  const defense = s.defenses.find((d) => d.id === defenseId)
  if (!defense || defense.xpApplied) return
  if (defense.status !== 'won' && defense.status !== 'lost') return

  const winsById = new Map<string, number>()
  for (const duel of defense.duels) {
    if (duel.youWon) winsById.set(duel.yourId, (winsById.get(duel.yourId) ?? 0) + 1)
  }

  const evoRng = createRng(defense.xpSeed ?? 0)
  for (const [id, wins] of winsById) {
    const mon = findMon(s, id)
    if (!mon || wins <= 0) continue
    replaceMon(s, addXp(mon, wins * GYM_WIN_XP, evoRng).pokemon)
    s.today.xpEarned += wins * GYM_WIN_XP
  }
  defense.xpApplied = true
}
