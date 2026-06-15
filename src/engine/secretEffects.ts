// Efeitos das Habilidades Secretas (linhas de Pedra/Ground) — ponto único da engine.
// Cada efeito é amarrado pelo id da passiva e só vale se ela estiver DESBLOQUEADA
// (gravada em pokemon.passives). Funções puras; o estado diário (stacks/flags) vem do
// `SecretRuntime` por Pokémon (s.today.secretRuntime), atualizado pela camada de fluxo.

import type { AttrKey, Attrs, Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { SecretRuntime } from './state.ts'
import { secretAbilityFor } from '../data/secretAbilities.ts'
import { TEAM_ATTR_MAX } from './constants.ts'
import {
  BATTLE_ARMOR_MISSION_MULT,
  RIVALRY_ATTR_MULT,
  ROCK_HEAD_ESCORT_MULT,
  SAND_RUSH_SPEED_PER_STACK,
  SHELL_ARMOR_ESCORT_MULT,
  SHELL_ARMOR_PATROL_MULT,
  WEAK_ARMOR_DAMAGE_MULT,
  WEAK_ARMOR_SPEED_BONUS,
} from './balance.ts'
import { effectiveAttr, mapAttrs } from './attributes.ts'

export type SecretRuntimeMap = Record<string, SecretRuntime>

/** Ids das habilidades por efeito (uma linha = um id; Weak Armor é de duas linhas). */
const WEAK_ARMOR_IDS = new Set(['secret-onix', 'secret-kabuto'])

/** Id da Habilidade Secreta ATIVA (desbloqueada) deste Pokémon, ou null. */
export function activeSecretId(p: Pokemon): string | null {
  const ability = secretAbilityFor(p.speciesId)
  return ability && p.passives.includes(ability.id) ? ability.id : null
}

export function hasWeakArmor(p: Pokemon): boolean {
  return WEAK_ARMOR_IDS.has(activeSecretId(p) ?? '')
}
export function hasSturdy(p: Pokemon): boolean {
  return activeSecretId(p) === 'secret-geodude'
}
export function hasBattleArmor(p: Pokemon): boolean {
  return activeSecretId(p) === 'secret-cubone'
}
export function hasDig(p: Pokemon): boolean {
  return activeSecretId(p) === 'secret-diglett'
}

// ---- Missões: multiplicador de atributos por Pokémon (vantagem da passiva) ----

/** Contexto da missão usado pelos multiplicadores por Pokémon. */
export interface MissionSecretCtx {
  team: readonly Pokemon[]
  template: MissionTemplate
  runtime: SecretRuntimeMap
}

/**
 * Multiplicador de TODOS os atributos deste Pokémon na missão (1 = sem efeito):
 * Rivalidade (aliado do mesmo gênero), Rock Head (escolta), Shell Armor (escolta/patrulha)
 * e Battle Armor (próxima missão após defender). Multiplicativos entre si (não se sobrepõem
 * na prática: uma linha tem só uma habilidade).
 */
export function missionAttrMultiplier(p: Pokemon, ctx: MissionSecretCtx): number {
  const id = activeSecretId(p)
  if (!id) return 1
  let mult = 1
  if (id === 'secret-nidoran-f' || id === 'secret-nidoran-m') {
    if (ctx.team.some((o) => o.id !== p.id && o.gender === p.gender)) mult *= RIVALRY_ATTR_MULT
  }
  if (id === 'secret-rhyhorn' && ctx.template.id === 'escolta') mult *= ROCK_HEAD_ESCORT_MULT
  if (id === 'secret-omanyte') {
    if (ctx.template.id === 'escolta') mult *= SHELL_ARMOR_ESCORT_MULT
    else if (ctx.template.id === 'patrulha') mult *= SHELL_ARMOR_PATROL_MULT
  }
  if (id === 'secret-cubone' && ctx.runtime[p.id]?.battleArmorPending) mult *= BATTLE_ARMOR_MISSION_MULT
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

/** O time viaja instantâneo? (passiva Fly do museu OU Aerodactyl desbloqueado). */
export function teamHasFly(team: readonly Pokemon[]): boolean {
  return team.some((p) => p.passives.includes('fly') || activeSecretId(p) === 'secret-aerodactyl')
}

/**
 * Multiplicador de VELOCIDADE do time na viagem (≥1 = mais rápido): Sand Rush (+25%×stacks)
 * e Weak Armor (+50% se já tomou dano hoje). O tempo de viagem é dividido por este valor.
 */
export function teamTravelSpeedMultiplier(
  team: readonly Pokemon[],
  runtime: SecretRuntimeMap,
): number {
  let speed = 1
  for (const p of team) {
    const id = activeSecretId(p)
    if (id === 'secret-sandshrew') {
      speed += SAND_RUSH_SPEED_PER_STACK * (runtime[p.id]?.sandRushStacks ?? 0)
    }
    if (WEAK_ARMOR_IDS.has(id ?? '') && runtime[p.id]?.weakArmorActive) {
      speed += WEAK_ARMOR_SPEED_BONUS
    }
  }
  return speed
}

// ---- Combate: dano recebido ----

/** Multiplicador de dano RECEBIDO por este Pokémon (Weak Armor dobra). */
export function combatDamageMultiplier(p: Pokemon): number {
  return hasWeakArmor(p) ? WEAK_ARMOR_DAMAGE_MULT : 1
}
