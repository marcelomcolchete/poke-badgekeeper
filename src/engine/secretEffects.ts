// Efeitos das Habilidades Secretas (linhas de Pedra/Ground) — ponto único da engine.
// Cada efeito é amarrado pelo id da passiva e só vale se ela estiver DESBLOQUEADA
// (gravada em pokemon.passives). A INTENSIDADE escala com o nível (1=Bronze, 2=Prata,
// 3=Ouro), lido de pokemon.secretLevel via secretLevelOf. Funções puras; o estado diário
// (flags) vem do `SecretRuntime` por Pokémon (s.today.secretRuntime), atualizado pelos fluxos.

import type { AttrKey, Attrs, Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { SecretRuntime } from './state.ts'
import { secretAbilityFor, secretLevelOf } from '../data/secretAbilities.ts'
import { TEAM_ATTR_MAX } from './constants.ts'
import {
  BATTLE_ARMOR_MISSION_MULT_BY_LEVEL,
  FLY_SPEED_BONUS_BY_LEVEL,
  FLY_TEAM_LEVEL,
  RIVALRY_ATTR_PER_ALLY_BY_LEVEL,
  RIVALRY_BATTLE_BONUS_BY_LEVEL,
  ROCK_HEAD_ESCORT_MULT_BY_LEVEL,
  ROCK_HEAD_STUDY_MULT_BY_LEVEL,
  ROLLOUT_BATTLE_BONUS_BY_LEVEL,
  SHELL_ARMOR_SLOW_BY_LEVEL,
  STURDY_FULL_HEAL_LEVEL,
  WEAK_ARMOR_DAMAGE_MULT,
  WEAK_ARMOR_SPEED_BONUS_BY_LEVEL,
} from './balance.ts'
import { effectiveAttr, mapAttrs } from './attributes.ts'

export type SecretRuntimeMap = Record<string, SecretRuntime>

/** Ids das habilidades por efeito (uma linha = um id; Weak Armor e Rivalidade são de duas linhas). */
const WEAK_ARMOR_IDS = new Set(['secret-onix', 'secret-kabuto'])
const RIVALRY_IDS = new Set(['secret-nidoran-f', 'secret-nidoran-m'])

/** Lê uma tupla [Bronze, Prata, Ouro] no nível dado (1..3), com clamp defensivo. */
function byLevel<T>(tuple: readonly T[], level: number): T {
  const i = Math.min(tuple.length, Math.max(1, level)) - 1
  return tuple[i] as T
}

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
export function hasShellArmor(p: Pokemon): boolean {
  return activeSecretId(p) === 'secret-omanyte'
}
export function hasRollout(p: Pokemon): boolean {
  return activeSecretId(p) === 'secret-sandshrew'
}
export function hasRivalry(p: Pokemon): boolean {
  return RIVALRY_IDS.has(activeSecretId(p) ?? '')
}

/** Sturdy de nível Ouro recupera TODA a vida (em vez de ficar com 1) ao salvar do desmaio. */
export function sturdyHealsFull(p: Pokemon): boolean {
  return hasSturdy(p) && secretLevelOf(p) >= STURDY_FULL_HEAL_LEVEL
}

/** Flag persistente (em passives) que marca o Sturdy de nível Bronze já gasto na RUN. */
export const STURDY_SPENT_PASSIVE = 'sturdy-spent'

/** Sturdy nível Bronze tem escopo 1× por JOGO (persistente); níveis 2–3 são 1× por DIA. */
export function sturdyPerGame(p: Pokemon): boolean {
  return hasSturdy(p) && secretLevelOf(p) === 1
}

/** O Sturdy deste Pokémon ainda pode ser usado? (respeita o escopo por jogo/por dia). */
export function sturdyAvailable(p: Pokemon, runtime: SecretRuntimeMap): boolean {
  if (!hasSturdy(p)) return false
  return sturdyPerGame(p)
    ? !p.passives.includes(STURDY_SPENT_PASSIVE)
    : !runtime[p.id]?.sturdyUsed
}

// ---- Combate: bônus de Batalha por habilidade ----

/** Rollout: bônus de Batalha GANHO por cada Pokémon derrotado no duelo (0 sem a habilidade). */
export function rolloutBonusPerWin(p: Pokemon): number {
  return hasRollout(p) ? byLevel(ROLLOUT_BATTLE_BONUS_BY_LEVEL, secretLevelOf(p)) : 0
}

/** Rivalidade (nv2+): bônus de Batalha contra um oponente do mesmo gênero (0 caso contrário). */
export function rivalryBattleBonus(p: Pokemon): number {
  return hasRivalry(p) ? byLevel(RIVALRY_BATTLE_BONUS_BY_LEVEL, secretLevelOf(p)) : 0
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
 * Rivalidade (+X% por aliado do mesmo gênero), Rock Head (+ escolta / − ensino) e Battle
 * Armor (próxima missão após batalhar). Multiplicativos entre si (na prática uma linha tem
 * só uma habilidade). Tudo escala com o nível.
 */
export function missionAttrMultiplier(p: Pokemon, ctx: MissionSecretCtx): number {
  const id = activeSecretId(p)
  if (!id) return 1
  const level = secretLevelOf(p)
  let mult = 1
  if (RIVALRY_IDS.has(id)) {
    const allies = ctx.team.filter((o) => o.id !== p.id && o.gender === p.gender).length
    mult *= 1 + byLevel(RIVALRY_ATTR_PER_ALLY_BY_LEVEL, level) * allies
  }
  if (id === 'secret-rhyhorn') {
    if (ctx.template.id === 'escolta') mult *= byLevel(ROCK_HEAD_ESCORT_MULT_BY_LEVEL, level)
    else if (ctx.template.id === 'ensino') mult *= byLevel(ROCK_HEAD_STUDY_MULT_BY_LEVEL, level)
  }
  if (id === 'secret-cubone' && ctx.runtime[p.id]?.battleArmorPending) {
    mult *= byLevel(BATTLE_ARMOR_MISSION_MULT_BY_LEVEL, level)
  }
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

/** Este Pokémon é um voador? (passiva Fly do museu OU Aerodactyl desbloqueado). */
function isFlyer(p: Pokemon): boolean {
  return p.passives.includes('fly') || activeSecretId(p) === 'secret-aerodactyl'
}

/** O time tem um voador? */
export function teamHasFly(team: readonly Pokemon[]): boolean {
  return team.some(isFlyer)
}

/** Maior nível de Fly entre os voadores do time (passiva 'fly' do museu conta como nível 1). */
function teamFlyLevel(team: readonly Pokemon[]): number {
  let level = 0
  for (const p of team) {
    if (activeSecretId(p) === 'secret-aerodactyl') level = Math.max(level, secretLevelOf(p))
    else if (p.passives.includes('fly')) level = Math.max(level, 1)
  }
  return level
}

/**
 * O time VOA nesta tarefa? Voa em linha reta do ginásio até o ponto (caminho bem menor).
 * Por padrão o voador precisa estar SOZINHO; a partir do nível Ouro (FLY_TEAM_LEVEL) do
 * Aerodactyl o voo funciona com o time inteiro.
 */
export function teamFlies(team: readonly Pokemon[]): boolean {
  if (!teamHasFly(team)) return false
  return team.length === 1 || teamFlyLevel(team) >= FLY_TEAM_LEVEL
}

/**
 * Multiplicador de VELOCIDADE do time na viagem (≥1 = mais rápido, <1 = mais lento):
 * Weak Armor (+ bônus por nível se já tomou dano), Fly (+ bônus por nível ao voar) e o
 * debuff do Shell Armor (− por nível na missão seguinte a anular dano). O tempo de viagem
 * é dividido por este valor.
 */
export function teamTravelSpeedMultiplier(
  team: readonly Pokemon[],
  runtime: SecretRuntimeMap,
): number {
  let speed = 1
  for (const p of team) {
    if (hasWeakArmor(p) && runtime[p.id]?.weakArmorActive) {
      speed += byLevel(WEAK_ARMOR_SPEED_BONUS_BY_LEVEL, secretLevelOf(p))
    }
    if (hasShellArmor(p) && runtime[p.id]?.shellArmorSlow) {
      speed -= byLevel(SHELL_ARMOR_SLOW_BY_LEVEL, secretLevelOf(p))
    }
  }
  if (teamFlies(team)) speed += byLevel(FLY_SPEED_BONUS_BY_LEVEL, teamFlyLevel(team))
  return Math.max(speed, 0.0001)
}

// ---- Combate: dano recebido ----

/**
 * Multiplicador de dano RECEBIDO por este Pokémon: Shell Armor anula (×0), Weak Armor dobra
 * (×2). Vale tanto em batalhas quanto no dano de missões fracassadas.
 */
export function combatDamageMultiplier(p: Pokemon): number {
  if (hasShellArmor(p)) return 0
  if (hasWeakArmor(p)) return WEAK_ARMOR_DAMAGE_MULT
  return 1
}
