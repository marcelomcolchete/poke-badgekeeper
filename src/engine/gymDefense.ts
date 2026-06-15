// Defesa de ginásio: cadeia de duelos 1v1 só com Batalha, com buff/debuff de tipo
// (PLAN §4.4). A tabela de tipos (data/typeChart) serve apenas para classificar
// vantagem/desvantagem; o efeito é ×1,5 por vantagem e ×0,5 por desvantagem.

import type { EnemyUnit, Pokemon, PokemonType } from '../types/index.ts'
import { POKEMON_TYPES } from '../types/index.ts'
import type { Rng } from './rng.ts'

export type { EnemyUnit }
import { singleTypeMultiplier } from '../data/typeChart.ts'
import { speciesByType } from '../data/pokemon/index.ts'
import {
  ATTR_EFFECTIVE_MIN,
  ATTR_MAX,
  HP_LOSS_PER_DEFENSE_LOSS,
  IV_MAX,
  IV_MIN,
  MIN_DEFENSE_SQUAD,
  TOTAL_DAYS,
  TYPE_ADVANTAGE_MULT,
  TYPE_DISADVANTAGE_MULT,
} from './constants.ts'
import {
  ENEMY_BASE_BATTLE,
  ENEMY_BATTLE_PER_DAY,
  ENEMY_SQUAD_DAY1,
  ENEMY_SQUAD_DAY10,
  ENEMY_SQUAD_JITTER_FROM_DAY,
  GYM_XP_CAP_PER_WIN,
  GYM_XP_PER_BATTLE_POWER,
} from './balance.ts'
import { applyDamage, effectiveAttr } from './attributes.ts'
import { combatDamageMultiplier, hasSturdy } from './secretEffects.ts'
import { clamp, lerp } from './math.ts'

/** ≥1 Pokémon disponível para abrir uma defesa (PLAN §4.4). */
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

/**
 * XP por duelo vencido = 0,5 × poder de Batalha do desafiante derrotado, com teto de 30
 * (§4.4, ajuste). Recompensa derrubar inimigos mais fortes; desafiantes fracos rendem pouco.
 */
export function gymWinXp(enemyBattle: number): number {
  return Math.min(GYM_XP_CAP_PER_WIN, Math.round(GYM_XP_PER_BATTLE_POWER * enemyBattle))
}

/**
 * Tamanho do esquadrão inimigo escalando com o dia (PLAN §4.8): interpola 1→6 ao longo
 * dos 10 dias; do dia 5 em diante sorteia centro..centro+1. Dia 1 = 1; dia 10 = 6.
 */
export function enemySquadSizeForDay(rng: Rng, day: number): number {
  const t = clamp((day - 1) / (TOTAL_DAYS - 1), 0, 1)
  const center = clamp(Math.round(lerp(ENEMY_SQUAD_DAY1, ENEMY_SQUAD_DAY10, t)), ENEMY_SQUAD_DAY1, ENEMY_SQUAD_DAY10)
  const hi = day >= ENEMY_SQUAD_JITTER_FROM_DAY ? Math.min(center + 1, ENEMY_SQUAD_DAY10) : center
  return rng.int(center, hi)
}

/**
 * Inimigos efêmeros da defesa (PLAN §4.4/§4.8). Cada desafiante tem o SEU próprio poder
 * de Batalha: a Batalha-base da espécie sorteada, escalada pelo dia, com variação de ±10
 * (como os IVs do jogador) — então dois invasores da mesma espécie ainda diferem.
 */
export function generateDefenseEnemies(rng: Rng, day: number, size: number): EnemyUnit[] {
  const dayBonus = ENEMY_BATTLE_PER_DAY * (day - 1)
  return Array.from({ length: size }, () => {
    const type = rng.pick(POKEMON_TYPES)
    const pool = speciesByType(type)
    const species = pool.length > 0 ? rng.pick(pool) : null
    const base = species ? species.baseAttrs.batalha : ENEMY_BASE_BATTLE
    const battle = clamp(base + dayBonus + rng.int(IV_MIN, IV_MAX), ATTR_EFFECTIVE_MIN, ATTR_MAX)
    return {
      battle,
      types: species ? [...species.types] : [type],
      speciesId: species?.id,
    }
  })
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
  /** Pokémon que usaram o Sturdy nesta batalha (não desmaiaram) — consome o 1×/dia. */
  sturdyUsedIds: string[]
}

export interface ResolveDefenseOpts {
  /** Pokémon (ids) que ainda têm o Sturdy disponível hoje (consome ao usar, 1×/dia). */
  sturdyAvailableIds?: ReadonlySet<string>
}

/**
 * Cadeia de duelos 1v1: a frente de cada lado se enfrenta; o perdedor perde 1 HP e
 * sai (entra o próximo). Acaba quando um lado fica sem Pokémon. Você vence se zerar
 * o adversário antes do seu (PLAN §4.4). Habilidades Secretas: Weak Armor dobra o dano
 * recebido; Sturdy (1×/dia) impede o desmaio, deixando 1 de vida.
 */
export function resolveDefense(
  rng: Rng,
  squad: readonly Pokemon[],
  enemies: readonly EnemyUnit[],
  opts: ResolveDefenseOpts = {},
): DefenseResolution {
  const result = squad.map((p) => ({ ...p }))
  const duels: DuelLog[] = []
  const sturdyUsed = new Set<string>()
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
      const loss = HP_LOSS_PER_DEFENSE_LOSS * combatDamageMultiplier(you)
      const wouldFaint = you.currentHp - loss <= 0
      const canSturdy =
        wouldFaint &&
        hasSturdy(you) &&
        !sturdyUsed.has(you.id) &&
        (opts.sturdyAvailableIds?.has(you.id) ?? false)
      if (canSturdy) {
        result[yours] = { ...you, currentHp: 1, status: 'idle' } // não desmaia: fica com 1
        sturdyUsed.add(you.id)
      } else {
        result[yours] = applyDamage(you, loss)
      }
      yours += 1
    }
  }
  return { won: theirs >= enemies.length, squad: result, duels, sturdyUsedIds: [...sturdyUsed] }
}
