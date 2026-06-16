// Efeitos das Habilidades Secretas — ponto único da engine. Cada efeito é amarrado pelo id da
// habilidade e só vale se ela estiver DESBLOQUEADA no indivíduo (data/secretAbilities.ts →
// hasSecret, derivado de pokemon.secretCount + a linha). Um Pokémon pode ter até três ativas ao
// mesmo tempo, e os efeitos se acumulam. Funções puras; o estado diário (flags) vem do
// `SecretRuntime` por Pokémon (s.today.secretRuntime), atualizado pelos fluxos.

import type { Attrs, AttrKey, Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { SecretRuntime } from './state.ts'
import { hasSecret } from '../data/secretAbilities.ts'
import { TEAM_ATTR_MAX } from './constants.ts'
import {
  BATTLE_ARMOR_MISSION_MULT,
  EXPLOSION_SELF_DAMAGE_FRACTION,
  FLY_SPEED_BONUS,
  HUSTLE_BATTLE_BONUS,
  HUSTLE_MISSION_MULT,
  RIVALRY_ATTR_PER_ALLY,
  RIVALRY_BATTLE_BONUS,
  ROCK_HEAD_ESCORT_MULT,
  ROCK_HEAD_STUDY_MULT,
  ROLLOUT_BATTLE_BONUS,
  SHELL_ARMOR_DAMAGE,
  WEAK_ARMOR_DAMAGE_MULT,
  WEAK_ARMOR_SPEED_PER_MISSING_HP,
} from './balance.ts'
import { effectiveAttr, mapAttrs } from './attributes.ts'
import { itemMissionMultiplier, itemTravelSpeedMultiplier } from './itemEffects.ts'

export type SecretRuntimeMap = Record<string, SecretRuntime>

// ---- Predicados por habilidade (cada um independente; o Pokémon pode ter várias) ----

export function hasWeakArmor(p: Pokemon): boolean {
  return hasSecret(p, 'sa-weak-armor')
}
export function hasSturdy(p: Pokemon): boolean {
  return hasSecret(p, 'sa-sturdy')
}
export function hasBattleArmor(p: Pokemon): boolean {
  return hasSecret(p, 'sa-battle-armor')
}
export function hasDig(p: Pokemon): boolean {
  return hasSecret(p, 'sa-dig')
}
export function hasDigPlus(p: Pokemon): boolean {
  return hasSecret(p, 'sa-dig-plus')
}
export function hasShellArmor(p: Pokemon): boolean {
  return hasSecret(p, 'sa-shell-armor')
}
export function hasRollout(p: Pokemon): boolean {
  return hasSecret(p, 'sa-rollout')
}
export function hasRivalry(p: Pokemon): boolean {
  return hasSecret(p, 'sa-rivalry')
}
export function hasHustle(p: Pokemon): boolean {
  return hasSecret(p, 'sa-hustle')
}
export function hasExplosion(p: Pokemon): boolean {
  return hasSecret(p, 'sa-explosion')
}
export function hasLightningRod(p: Pokemon): boolean {
  return hasSecret(p, 'sa-lightning-rod')
}
export function hasReckless(p: Pokemon): boolean {
  return hasSecret(p, 'sa-reckless')
}
export function hasSandRush(p: Pokemon): boolean {
  return hasSecret(p, 'sa-sand-rush')
}
export function hasSwiftSwim(p: Pokemon): boolean {
  return hasSecret(p, 'sa-swift-swim')
}

/** O Sturdy deste Pokémon ainda pode ser usado hoje? (1×/dia). */
export function sturdyAvailable(p: Pokemon, runtime: SecretRuntimeMap): boolean {
  return hasSturdy(p) && !runtime[p.id]?.sturdyUsed
}

// ---- Combate: bônus de Batalha por habilidade ----

/** Rollout: bônus de Batalha GANHO por cada Pokémon derrotado no duelo (0 sem a habilidade). */
export function rolloutBonusPerWin(p: Pokemon): number {
  return hasRollout(p) ? ROLLOUT_BATTLE_BONUS : 0
}

/** Rivalidade: bônus de Batalha contra um oponente do mesmo gênero (0 caso contrário). */
export function rivalryBattleBonus(p: Pokemon): number {
  return hasRivalry(p) ? RIVALRY_BATTLE_BONUS : 0
}

/** Hustle: bônus de Batalha em batalhas Pokémon (0 sem a habilidade). */
export function hustleBattleBonus(p: Pokemon): number {
  return hasHustle(p) ? HUSTLE_BATTLE_BONUS : 0
}

/** Explosion: dano que o portador inflige a SI ao explodir = metade da vida máxima (arred. p/ cima). */
export function explosionSelfDamage(p: Pokemon): number {
  return Math.ceil(p.maxHp * EXPLOSION_SELF_DAMAGE_FRACTION)
}

// ---- Missões: multiplicador de atributos por Pokémon (vantagem da passiva) ----

/** Contexto da missão usado pelos multiplicadores por Pokémon. */
export interface MissionSecretCtx {
  team: readonly Pokemon[]
  template: MissionTemplate
  runtime: SecretRuntimeMap
  /** Itens passivos da run (Eviolite/Lagging Tail…) — entram no multiplicador de atributos. */
  runItems: readonly string[]
}

/**
 * Multiplicador de TODOS os atributos deste Pokémon na missão (1 = sem efeito). Combina, de forma
 * MULTIPLICATIVA, todas as habilidades ativas do Pokémon: Rivalidade (+10% por aliado do mesmo
 * gênero), Rock Head (+ escolta / − ensino), Battle Armor (próxima missão após batalhar) e Hustle
 * (−10% em missões). Itens passivos (Eviolite/Lagging Tail) entram na base.
 */
export function missionAttrMultiplier(p: Pokemon, ctx: MissionSecretCtx): number {
  let mult = itemMissionMultiplier(p, ctx.runItems)
  if (hasRivalry(p)) {
    const allies = ctx.team.filter((o) => o.id !== p.id && o.gender === p.gender).length
    mult *= 1 + RIVALRY_ATTR_PER_ALLY * allies
  }
  if (hasSecret(p, 'sa-rock-head')) {
    if (ctx.template.id === 'escolta') mult *= ROCK_HEAD_ESCORT_MULT
    else if (ctx.template.id === 'ensino') mult *= ROCK_HEAD_STUDY_MULT
  }
  if (hasBattleArmor(p) && ctx.runtime[p.id]?.battleArmorPending) mult *= BATTLE_ARMOR_MISSION_MULT
  if (hasHustle(p)) mult *= HUSTLE_MISSION_MULT
  return mult
}

/** Algum Pokémon do time tem efeito de atributo ativo nesta missão? (radar indica a passiva). */
export function teamHasAttrBoost(ctx: MissionSecretCtx): boolean {
  return ctx.team.some((p) => missionAttrMultiplier(p, ctx) !== 1)
}

/** Soma do time num eixo COM os multiplicadores de habilidade, capada em TEAM_ATTR_MAX (70). */
export function teamSecretAxisSum(key: AttrKey, ctx: MissionSecretCtx): number {
  const total = ctx.team.reduce(
    (sum, p) => sum + effectiveAttr(p, key) * missionAttrMultiplier(p, ctx),
    0,
  )
  return Math.min(total, TEAM_ATTR_MAX)
}

/** Soma do time (todos os eixos) com os multiplicadores de habilidade — base do hexágono. */
export function teamSecretSum(ctx: MissionSecretCtx): Attrs {
  return mapAttrs((k) => teamSecretAxisSum(k, ctx))
}

// ---- Viagem: velocidade do time e voo ----

/** Este Pokémon é um voador? (passiva Fly do museu OU Aerodactyl com Fly/Fly+ desbloqueado). */
function isFlyer(p: Pokemon): boolean {
  return p.passives.includes('fly') || hasSecret(p, 'sa-fly') || hasSecret(p, 'sa-fly-plus')
}

/** O time tem um voador? */
export function teamHasFly(team: readonly Pokemon[]): boolean {
  return team.some(isFlyer)
}

/**
 * O time VOA nesta tarefa? Voa em linha reta do ginásio até o ponto (caminho bem menor). Por
 * padrão o voador precisa estar SOZINHO; com Fly+ (sa-fly-plus) o voo funciona com o time inteiro.
 */
export function teamFlies(team: readonly Pokemon[]): boolean {
  if (!teamHasFly(team)) return false
  return team.length === 1 || team.some((p) => hasSecret(p, 'sa-fly-plus'))
}

/**
 * Multiplicador de VELOCIDADE do time na viagem (≥1 = mais rápido, <1 = mais lento):
 * Weak Armor (+20% por ponto de HP faltante de quem tem a habilidade), Fly (+ bônus ao voar) e o
 * item Lagging Tail (mais lento). O tempo de viagem é dividido por este valor.
 */
export function teamTravelSpeedMultiplier(
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
): number {
  let speed = 1
  for (const p of team) {
    if (hasWeakArmor(p)) {
      const missing = Math.max(0, p.maxHp - p.currentHp)
      speed += WEAK_ARMOR_SPEED_PER_MISSING_HP * missing
    }
  }
  if (teamFlies(team)) speed += FLY_SPEED_BONUS
  // Lagging Tail: time mais lento nas viagens de missão (multiplicativo sobre a velocidade).
  speed *= itemTravelSpeedMultiplier(runItems)
  return Math.max(speed, 0.0001)
}

// ---- Combate: dano recebido ----

/**
 * Dano que este Pokémon REALMENTE recebe a partir de um dano bruto: Shell Armor reduz para 1
 * (qualquer dano vira 1), Weak Armor dobra. Shell Armor tem precedência se o Pokémon tiver ambos.
 * Vale tanto em batalhas quanto no dano de missões fracassadas.
 */
export function damageTaken(p: Pokemon, raw: number): number {
  if (raw <= 0) return 0
  if (hasShellArmor(p)) return SHELL_ARMOR_DAMAGE
  if (hasWeakArmor(p)) return raw * WEAK_ARMOR_DAMAGE_MULT
  return raw
}
