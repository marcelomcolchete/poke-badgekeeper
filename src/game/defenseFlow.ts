// Ciclo de vida da defesa de ginásio (PLAN §3.1/§4.4):
// scheduled → active → won/lost. Resolve na hora ao atribuir o esquadrão.

import type { Pokemon } from '../types/index.ts'
import type { DefenseEvent, GameState } from '../engine/state.ts'
import { canDefend, gymWinXp, resolveDefense, type DefenseResolution } from '../engine/gymDefense.ts'
import {
  hasBattleArmor,
  hasShellArmor,
  hasWeakArmor,
  STURDY_SPENT_PASSIVE,
  sturdyAvailable,
  sturdyPerGame,
} from '../engine/secretEffects.ts'
import { goldForDefense } from '../engine/economy.ts'
import { addXp } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
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

/**
 * Atualiza o estado diário das Habilidades Secretas após uma BATALHA (defesa de ginásio ou
 * Equipe Rocket). Chamado DEPOIS de gravar o esquadrão (a marca persistente do Sturdy precisa
 * do indivíduo já atualizado em estado):
 *  - Battle Armor: bônus na próxima missão, só para quem REALMENTE lutou um duelo (venceu ou perdeu).
 *  - Weak Armor: ativa o bônus de velocidade de quem tomou dano.
 *  - Shell Armor: quem perdeu ≥1 duelo anulou dano → debuff de velocidade na próxima missão.
 *  - Sturdy usado: per-dia no runtime; per-jogo (Bronze) grava a passiva no indivíduo.
 */
export function applyBattleSecretRuntime(
  s: GameState,
  before: readonly Pokemon[],
  resolution: DefenseResolution,
): void {
  const post = new Map(resolution.squad.map((p) => [p.id, p]))
  const fought = new Set(resolution.duels.map((d) => d.yourId))
  const lostDuel = new Set(resolution.duels.filter((d) => !d.youWon).map((d) => d.yourId))
  for (const p of before) {
    const rt = (s.today.secretRuntime[p.id] ??= {})
    if (hasBattleArmor(p) && fought.has(p.id)) rt.battleArmorPending = true
    if (hasWeakArmor(p)) {
      const after = post.get(p.id)
      if (after && after.currentHp < p.currentHp) rt.weakArmorActive = true
    }
    if (hasShellArmor(p) && lostDuel.has(p.id)) rt.shellArmorSlow = true
  }
  // Consome o Sturdy gasto no escopo certo (per-jogo na passiva, per-dia no runtime).
  for (const id of resolution.sturdyUsedIds) {
    const mon = before.find((p) => p.id === id)
    if (mon && sturdyPerGame(mon)) {
      const cur = findMon(s, id)
      if (cur && !cur.passives.includes(STURDY_SPENT_PASSIVE)) {
        replaceMon(s, { ...cur, passives: [...cur.passives, STURDY_SPENT_PASSIVE] })
      }
    } else {
      ;(s.today.secretRuntime[id] ??= {}).sturdyUsed = true
    }
  }
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

  // Sturdy disponível para quem tem a habilidade e ainda não usou (escopo por jogo/dia).
  const sturdyAvailableIds = new Set(
    squad.filter((p) => sturdyAvailable(p, s.today.secretRuntime)).map((p) => p.id),
  )
  const resolution = resolveDefense(takeRng(s), squad, defense.enemies, { sturdyAvailableIds })

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
  for (const member of resolution.squad) replaceMon(s, settleFaint(member))
  applyBattleSecretRuntime(s, squad, resolution)

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
 * Conclui a defesa ao FIM da animação: aplica o XP de cada vitória (0,5 × poder do
 * desafiante derrotado, teto 30), podendo subir nível/evoluir — o level-up só "aparece"
 * agora (PLAN §4.4, ajuste). Idempotente: só aplica uma vez (xpApplied).
 */
export function completeDefense(s: GameState, defenseId: string): void {
  const defense = s.defenses.find((d) => d.id === defenseId)
  if (!defense || defense.xpApplied) return
  if (defense.status !== 'won' && defense.status !== 'lost') return

  // Percorre os duelos na ordem (mesmo padrão de assignDefense): cada vitória rende XP
  // proporcional ao poder do desafiante daquele índice. Acumula o XP por Pokémon.
  const xpById = new Map<string, number>()
  let theirs = 0
  for (const duel of defense.duels) {
    if (!duel.youWon) continue
    const enemy = defense.enemies[theirs]
    if (enemy) xpById.set(duel.yourId, (xpById.get(duel.yourId) ?? 0) + gymWinXp(enemy.battle))
    theirs += 1
  }

  const evoRng = createRng(defense.xpSeed ?? 0)
  for (const [id, xp] of xpById) {
    const mon = findMon(s, id)
    if (!mon || xp <= 0) continue
    replaceMon(s, addXp(mon, xp, evoRng).pokemon)
    s.today.xpEarned += xp
  }
  defense.xpApplied = true
}
