// Defesa de ginásio: cadeia de duelos 1v1 só com Batalha, com buff/debuff de tipo
// (PLAN §4.4). A tabela de tipos (data/typeChart) serve apenas para classificar
// vantagem/desvantagem; o efeito é ×1,5 por vantagem e ×0,5 por desvantagem.

import type { Pokemon, PokemonType } from '../types/index.ts'
import { POKEMON_TYPES } from '../types/index.ts'
import type { Rng } from './rng.ts'
import { singleTypeMultiplier } from '../data/typeChart.ts'
import {
  ATTR_MAX,
  HP_LOSS_PER_DEFENSE_LOSS,
  MIN_DEFENSE_SQUAD,
  TYPE_ADVANTAGE_MULT,
  TYPE_DISADVANTAGE_MULT,
} from './constants.ts'
import { ENEMY_BASE_BATTLE, ENEMY_BATTLE_PER_DAY } from './balance.ts'
import { applyDamage, effectiveAttr } from './attributes.ts'
import { clamp } from './math.ts'

/** ≥3 Pokémon disponíveis para abrir uma defesa (PLAN §4.4). */
export function canDefend(squad: readonly Pokemon[]): boolean {
  return squad.length >= MIN_DEFENSE_SQUAD
}

/**
 * Multiplicador de tipo na defesa: ×1,5 por par com vantagem, ×0,5 por par com
 * desvantagem (inclui imunidades canônicas, tratadas como desvantagem) — PLAN §4.4.
 */
export function typeAdvantageMultiplier(
  attackerTypes: readonly PokemonType[],
  defenderTypes: readonly PokemonType[],
): number {
  let multiplier = 1
  for (const attacker of attackerTypes) {
    for (const defender of defenderTypes) {
      const canonical = singleTypeMultiplier(attacker, defender)
      if (canonical > 1) multiplier *= TYPE_ADVANTAGE_MULT
      else if (canonical < 1) multiplier *= TYPE_DISADVANTAGE_MULT
    }
  }
  return multiplier
}

/** Batalha efetiva = Batalha · multiplicador de tipo contra os tipos do oponente. */
export function effectiveBattle(attacker: Pokemon, defenderTypes: readonly PokemonType[]): number {
  return effectiveAttr(attacker, 'batalha') * typeAdvantageMultiplier(attacker.types, defenderTypes)
}

/** P(vitória) = clamp(suaBatalhaEf / batalhaEf_oponente, 0, 1) — PLAN §4.4. */
export function duelWinProbability(attackerBattleEff: number, defenderBattleEff: number): number {
  if (defenderBattleEff <= 0) return 1
  return clamp(attackerBattleEff / defenderBattleEff, 0, 1)
}

export interface EnemyUnit {
  battle: number
  types: PokemonType[]
}

/** Inimigos efêmeros da defesa, com Batalha escalando pelo dia (PLAN §4.4/§4.8). */
export function generateDefenseEnemies(rng: Rng, day: number, size: number): EnemyUnit[] {
  const battle = Math.min(ENEMY_BASE_BATTLE + ENEMY_BATTLE_PER_DAY * (day - 1), ATTR_MAX)
  return Array.from({ length: size }, () => ({
    battle,
    types: [rng.pick(POKEMON_TYPES)],
  }))
}

export interface DuelLog {
  yourId: string
  youWon: boolean
  pWin: number
}

export interface DefenseResolution {
  won: boolean
  /** Esquadrão com HP atualizado: quem PERDE um duelo perde 1 HP e sai (PLAN §4.4). */
  squad: Pokemon[]
  duels: DuelLog[]
}

/**
 * Cadeia de duelos 1v1: a frente de cada lado se enfrenta; o perdedor perde 1 HP e
 * sai (entra o próximo). Acaba quando um lado fica sem Pokémon. Você vence se zerar
 * o adversário antes do seu (PLAN §4.4).
 */
export function resolveDefense(
  rng: Rng,
  squad: readonly Pokemon[],
  enemies: readonly EnemyUnit[],
): DefenseResolution {
  const result = squad.map((p) => ({ ...p }))
  const duels: DuelLog[] = []
  let yours = 0
  let theirs = 0
  while (yours < result.length && theirs < enemies.length) {
    const you = result[yours] as Pokemon
    const enemy = enemies[theirs] as EnemyUnit
    const yourEff = effectiveBattle(you, enemy.types)
    const enemyEff = enemy.battle * typeAdvantageMultiplier(enemy.types, you.types)
    const pWin = duelWinProbability(yourEff, enemyEff)
    const youWon = rng.bool(pWin)
    duels.push({ yourId: you.id, youWon, pWin })
    if (youWon) {
      theirs += 1 // o inimigo perde e sai; você permanece na frente
    } else {
      result[yours] = applyDamage(you, HP_LOSS_PER_DEFENSE_LOSS)
      yours += 1
    }
  }
  return { won: theirs >= enemies.length, squad: result, duels }
}
