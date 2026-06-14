// Missões: probabilidade de sucesso (interseção de hexágonos), resolução, dano em
// falha, tempos de viagem/execução e geração de instância (PLAN §4.2/§4.3).

import type { AttrKey, Attrs, MissionCategory, Pokemon } from '../types/index.ts'
import { ATTR_KEYS } from '../types/index.ts'
import type { Rng } from './rng.ts'
import type { MissionTemplate } from '../data/types.ts'
import { getMissionTemplate, templatesForCategory } from '../data/missionTemplates.ts'
import type { MissionInstance } from './state.ts'
import { ATTR_MAX, MIN_FAILURE_DAMAGE, SPECIES_BASE_MAX } from './constants.ts'
import {
  AGILITY_TIME_REDUCTION_PER_POINT,
  MISSION_DAY_DIVISOR,
  MISSION_DAY_SCALE,
  MISSION_PRINCIPAL_MAX,
  MISSION_PRINCIPAL_MIN,
  MISSION_REST_MAX,
  MISSION_REST_MIN,
  MISSION_SECONDARY_MAX,
  MISSION_SECONDARY_MIN,
  RUN_AWAY_TRAVEL_FACTOR,
  SPECIAL2_PRINCIPALS,
  SPECIAL2_SECONDARIES,
  SPECIAL5_PRINCIPALS,
  TRAVEL_MS_PER_DISTANCE,
} from './balance.ts'
import {
  applyDamage,
  axisMin,
  effectiveAttr,
  hexagonArea,
  isFainted,
  teamAxisSum,
  teamSum,
  zeroAttrs,
} from './attributes.ts'
import { average, clamp } from './math.ts'

/** Termo do dia somado às faixas-base (principal/secundário): SCALE · dia / DIVISOR. */
function dayTerm(day: number): number {
  return (MISSION_DAY_SCALE * day) / MISSION_DAY_DIVISOR
}

/** Valor de um eixo principal: rand(20..30) + termo do dia, com teto ATTR_MAX. */
function principalValue(rng: Rng, day: number): number {
  return clamp(
    Math.round(rng.int(MISSION_PRINCIPAL_MIN, MISSION_PRINCIPAL_MAX) + dayTerm(day)),
    0,
    ATTR_MAX,
  )
}

/** Valor de um eixo secundário: rand(10..20) + termo do dia, com teto ATTR_MAX. */
function secondaryValue(rng: Rng, day: number): number {
  return clamp(
    Math.round(rng.int(MISSION_SECONDARY_MIN, MISSION_SECONDARY_MAX) + dayTerm(day)),
    0,
    ATTR_MAX,
  )
}

/** Valor de um eixo "resto" (nem principal, nem secundário): rand(5..20). */
function restValue(rng: Rng): number {
  return clamp(rng.int(MISSION_REST_MIN, MISSION_REST_MAX), 0, ATTR_MAX)
}

export interface GeneratedRequirement {
  requirement: Attrs
  /** Atributo secundário das normais (subtipo); igual ao principal = "mega". Null nas especiais. */
  secondaryAttr: AttrKey | null
}

/**
 * Gera a exigência da missão escalando com o dia (rebalanceamento). Todo eixo começa em
 * "resto" (5..20) e os escolhidos recebem principal/secundário. Normais: principal no
 * primaryAttr + 1 secundário sorteado (se coincidir, vira "mega" = principal+secundário).
 * Especiais: eixos sorteados (special2 = 2 princ + 1 sec; special5 = 5 princ).
 */
export function generateRequirement(
  rng: Rng,
  day: number,
  template: MissionTemplate,
): GeneratedRequirement {
  const out = zeroAttrs()
  for (const key of ATTR_KEYS) out[key] = restValue(rng)

  if (template.gen === 'normal') {
    const primary = template.primaryAttr as AttrKey
    const secondary = rng.pick(ATTR_KEYS)
    if (secondary === primary) {
      // "Mega": o eixo soma principal + secundário (com teto ATTR_MAX → ~60).
      out[primary] = clamp(principalValue(rng, day) + secondaryValue(rng, day), 0, ATTR_MAX)
    } else {
      out[primary] = principalValue(rng, day)
      out[secondary] = secondaryValue(rng, day)
    }
    return { requirement: out, secondaryAttr: secondary }
  }

  // Especiais: sorteia os eixos principais/secundários sem repetição.
  const principals = template.gen === 'special5' ? SPECIAL5_PRINCIPALS : SPECIAL2_PRINCIPALS
  const secondaries = template.gen === 'special5' ? 0 : SPECIAL2_SECONDARIES
  const axes = rng.shuffle(ATTR_KEYS)
  let i = 0
  for (let k = 0; k < principals; k++, i++) out[axes[i] as AttrKey] = principalValue(rng, day)
  for (let k = 0; k < secondaries; k++, i++) out[axes[i] as AttrKey] = secondaryValue(rng, day)
  return { requirement: out, secondaryAttr: null }
}

/**
 * P_sucesso = área(interseção) / área(exigência), em [0, 1] (PLAN §4.2).
 * A soma do time já entra capada em 100 por eixo (teamSum). Exigência nula → 1.
 */
export function missionSuccessProbability(team: readonly Pokemon[], requirement: Attrs): number {
  const requiredArea = hexagonArea(requirement)
  if (requiredArea <= 0) return 1
  const intersection = hexagonArea(axisMin(teamSum(team), requirement))
  return clamp(intersection / requiredArea, 0, 1)
}

/** Dano em falha = max(1, round((1 − P)·perigo)) — PLAN §4.2. */
export function missionFailureDamage(pSuccess: number, danger: number): number {
  return Math.max(MIN_FAILURE_DAMAGE, Math.round((1 - pSuccess) * danger))
}

export interface MissionOutcome {
  success: boolean
  pSuccess: number
  /** Time com HP atualizado (igual à entrada em caso de sucesso). */
  team: Pokemon[]
  faintedIds: string[]
}

/**
 * Sorteio de Bernoulli com P_sucesso (sobre a exigência gravada na instância); em falha,
 * cada Pokémon perde HP inteiro proporcional ao perigo da missão.
 */
export function resolveMission(
  rng: Rng,
  team: readonly Pokemon[],
  requirement: Attrs,
  danger: number,
): MissionOutcome {
  const pSuccess = missionSuccessProbability(team, requirement)
  if (rng.bool(pSuccess)) {
    return { success: true, pSuccess, team: [...team], faintedIds: [] }
  }
  const damage = missionFailureDamage(pSuccess, danger)
  const updated = team.map((p) => applyDamage(p, damage))
  return {
    success: false,
    pSuccess,
    team: updated,
    faintedIds: updated.filter(isFainted).map((p) => p.id),
  }
}

/**
 * Fator de tempo de viagem pela Agilidade total do time (PLAN §4.3): −0,5%/ponto, soma
 * capada em 100 → piso de 0,5 (10 → 0,95; 100 → 0,5). Run Away reduz mais; Fly zera (tratado
 * em graphTravelMs). Devolve o multiplicador a aplicar sobre o tempo-base de deslocamento.
 */
export function agilityTravelFactor(team: readonly Pokemon[]): number {
  const agility = teamAxisSum(team, 'agilidade') // 0–100 (já capado)
  let factor = clamp(1 - agility * AGILITY_TIME_REDUCTION_PER_POINT, 0.5, 1)
  if (team.some((p) => p.passives.includes('run-away'))) factor *= RUN_AWAY_TRAVEL_FACTOR
  return factor
}

/**
 * Tempo de UM trecho (ida) do ginásio até a missão: distância-do-grafo × ms/unidade ×
 * fator de Agilidade. Fly torna a viagem instantânea (PLAN §4.3).
 */
export function graphTravelMs(distance: number, team: readonly Pokemon[]): number {
  if (team.some((p) => p.passives.includes('fly'))) return 0
  return distance * TRAVEL_MS_PER_DISTANCE * agilityTravelFactor(team)
}

/** Tempo de execução parado no local: baseExecução / (1 + médiaInteligência/50) — PLAN §4.3. */
export function executionMs(team: readonly Pokemon[], baseExecutionMs: number): number {
  const avgIntelligence = average(team.map((p) => effectiveAttr(p, 'inteligencia')))
  return baseExecutionMs / (1 + avgIntelligence / SPECIES_BASE_MAX)
}

/** Duração total = ida + volta (deslocamento) + execução no local — PLAN §4.3. */
export function missionDurationMs(
  team: readonly Pokemon[],
  distance: number,
  template: MissionTemplate,
): number {
  return 2 * graphTravelMs(distance, team) + executionMs(team, template.baseExecutionMs)
}

/** Sorteia um template da categoria (cada categoria tem ≥1 template). */
export function rollMissionTemplate(rng: Rng, category: MissionCategory): MissionTemplate {
  return rng.pick(templatesForCategory(category))
}

export interface MissionInstanceSpec {
  id: string
  rng: Rng
  /** Dia atual — escala a exigência gerada (rebalanceamento). */
  day: number
  /** Categoria sorteada — define de qual pool tirar o template. */
  category: MissionCategory
  /** Ponto do grafo (já resolvido) onde a missão surge. */
  node: string
  spawnAtMs: number
  lifetimeMs: number
  /** Template fixo (museu); ausente = sorteia da categoria. */
  templateId?: string
}

/**
 * Cria a instância de missão (template + exigência gerada + ponto + timer) agendada para o
 * dia. Nasce 'scheduled'; o relógio a promove a 'available' no spawnAtMs (PLAN §3.1).
 */
export function createMissionInstance(spec: MissionInstanceSpec): MissionInstance {
  const template = spec.templateId
    ? getMissionTemplate(spec.templateId)
    : rollMissionTemplate(spec.rng, spec.category)
  const { requirement, secondaryAttr } = generateRequirement(spec.rng, spec.day, template)
  return {
    id: spec.id,
    templateId: template.id,
    requirement,
    secondaryAttr,
    node: spec.node,
    path: [],
    spawnAtMs: spec.spawnAtMs,
    expiresAtMs: spec.spawnAtMs + spec.lifetimeMs,
    status: 'scheduled',
    teamIds: [],
    acceptedAtMs: null,
    arriveAtMs: null,
    resolveAtMs: null,
    returnEndsAtMs: null,
    result: null,
    pSuccess: null,
  }
}
