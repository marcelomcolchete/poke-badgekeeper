// Missões: probabilidade de sucesso (interseção de hexágonos), resolução, dano em
// falha, tempos de viagem/execução e geração de instância (PLAN §4.2/§4.3).

import type { AttrKey, Attrs, MissionCategory, Pokemon } from '../types/index.ts'
import { ATTR_KEYS } from '../types/index.ts'
import type { Rng } from './rng.ts'
import type { MissionTemplate, CityGraph } from '../data/types.ts'
import { getMissionTemplate, templatesForCategory } from '../data/missionTemplates.ts'
import type { MissionInstance } from './state.ts'
import { pathDistance, shortestPath } from './pathfinding.ts'
import { MIN_FAILURE_DAMAGE, TEAM_ATTR_MAX } from './constants.ts'
import {
  AGILITY_TIME_REDUCTION_PER_POINT,
  INT_TIME_REDUCTION_PER_POINT,
  MISSION_DAY_DIVISOR,
  MISSION_DAY_SCALE,
  MISSION_TIME_FLOOR,
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
  hexagonArea,
  isFainted,
  teamAxisSum,
  teamSum,
  zeroAttrs,
} from './attributes.ts'
import {
  damageTaken,
  teamFlies,
  teamSecretSum,
  type MissionSecretCtx,
} from './secretEffects.ts'
import { clamp } from './math.ts'

/** Termo do dia somado às faixas-base (principal/secundário): SCALE · dia / DIVISOR. */
function dayTerm(day: number): number {
  return (MISSION_DAY_SCALE * day) / MISSION_DAY_DIVISOR
}

/** Valor de um eixo principal: rand(20..30) + termo do dia, com teto TEAM_ATTR_MAX (70). */
function principalValue(rng: Rng, day: number): number {
  return clamp(
    Math.round(rng.int(MISSION_PRINCIPAL_MIN, MISSION_PRINCIPAL_MAX) + dayTerm(day)),
    0,
    TEAM_ATTR_MAX,
  )
}

/** Valor de um eixo secundário: rand(10..20) + termo do dia, com teto TEAM_ATTR_MAX (70). */
function secondaryValue(rng: Rng, day: number): number {
  return clamp(
    Math.round(rng.int(MISSION_SECONDARY_MIN, MISSION_SECONDARY_MAX) + dayTerm(day)),
    0,
    TEAM_ATTR_MAX,
  )
}

/** Valor de um eixo "resto" (nem principal, nem secundário): rand(5..20). */
function restValue(rng: Rng): number {
  return clamp(rng.int(MISSION_REST_MIN, MISSION_REST_MAX), 0, TEAM_ATTR_MAX)
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
      // "Mega": o eixo soma principal + secundário (com teto TEAM_ATTR_MAX → ~70).
      out[primary] = clamp(principalValue(rng, day) + secondaryValue(rng, day), 0, TEAM_ATTR_MAX)
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
  if (template.gen === 'special5') {
    // Museu (#5): pelo menos UM dos 5 eixos principais obrigatoriamente no máximo (70).
    out[axes[rng.int(0, principals - 1)] as AttrKey] = TEAM_ATTR_MAX
  }
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

/**
 * Igual à anterior, mas a soma do time inclui os multiplicadores de Habilidade Secreta
 * (Rivalidade, Rock Head, Shell Armor, Battle Armor). Usada no despacho real e no preview.
 */
export function missionSuccessProbabilityCtx(ctx: MissionSecretCtx, requirement: Attrs): number {
  const requiredArea = hexagonArea(requirement)
  if (requiredArea <= 0) return 1
  const intersection = hexagonArea(axisMin(teamSecretSum(ctx), requirement))
  return clamp(intersection / requiredArea, 0, 1)
}

/** Dano em falha = max(1, round((1 − P)·perigo)) — PLAN §4.2 (fallback; o dia define o dano real). */
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
  /** P_sucesso já calculado (com multiplicadores de habilidade); omitir = calcula sem eles. */
  pSuccessOverride?: number,
  /** Dano fixo por falha (dano do dia). Omitir = cai na fórmula antiga (perigo × falha). */
  damageOverride?: number,
): MissionOutcome {
  const pSuccess = pSuccessOverride ?? missionSuccessProbability(team, requirement)
  if (rng.bool(pSuccess)) {
    return { success: true, pSuccess, team: [...team], faintedIds: [] }
  }
  const damage = damageOverride ?? missionFailureDamage(pSuccess, danger)
  // Weak Armor dobra o dano recebido; Shell Armor reduz para 1.
  const updated = team.map((p) => applyDamage(p, damageTaken(p, damage)))
  return {
    success: false,
    pSuccess,
    team: updated,
    faintedIds: updated.filter(isFainted).map((p) => p.id),
  }
}

/**
 * Fator de tempo de viagem pela Agilidade total do time (PLAN §4.3): −1%/ponto, soma capada
 * em 70 → piso de 0,3 (10 → 0,90; 70 → 0,30, redução máx. 70%). Run Away reduz mais; Fly zera
 * (tratado em graphTravelMs). Devolve o multiplicador a aplicar sobre o tempo-base de deslocamento.
 */
export function agilityTravelFactor(team: readonly Pokemon[]): number {
  const agility = teamAxisSum(team, 'agilidade') // 0–70 (já capado em TEAM_ATTR_MAX)
  let factor = clamp(1 - agility * AGILITY_TIME_REDUCTION_PER_POINT, MISSION_TIME_FLOOR, 1)
  if (team.some((p) => p.passives.includes('run-away'))) factor *= RUN_AWAY_TRAVEL_FACTOR
  return factor
}

/**
 * Tempo de UM trecho (ida) do ginásio até o ponto: distância × ms/unidade × fator de
 * Agilidade ÷ velocidade de habilidade (Sand Rush/Weak Armor). O voo (Fly, só sozinho) NÃO
 * acelera o passo: ele encurta o CAMINHO (linha reta, ver travelRoute) e o tempo cai junto.
 */
export function graphTravelMs(
  distance: number,
  team: readonly Pokemon[],
  speedMult = 1,
): number {
  return (distance * TRAVEL_MS_PER_DISTANCE * agilityTravelFactor(team)) / Math.max(speedMult, 0.0001)
}

/**
 * Rota de deslocamento do time do ginásio até um ponto (PLAN §4.3 — Fly):
 * - Voando (Fly + sozinho): liga ginásio→ponto em LINHA RETA (path `[gym, node]`). A
 *   distância vira a reta 16:9-corrigida — bem menor que o caminho andado → tempo bem menor,
 *   mas não-zero (velocidade normal).
 * - Senão: menor caminho no grafo (Dijkstra).
 * Devolve a flag de voo (símbolo no mapa), o caminho (animação) e a distância (tempo).
 */
export function travelRoute(
  graph: CityGraph,
  gym: string,
  node: string,
  team: readonly Pokemon[],
): { flying: boolean; path: string[]; distance: number } {
  const flying = teamFlies(team)
  const path = flying ? [gym, node] : shortestPath(graph, gym, node)
  return { flying, path, distance: pathDistance(graph, path) }
}

/**
 * Tempo de execução parado no local pela Inteligência total do time (PLAN §4.3): −1%/ponto,
 * soma capada em 70 → piso de 0,3 (70 de Inteligência reduz 70% do tempo de execução).
 */
export function executionMs(team: readonly Pokemon[], baseExecutionMs: number): number {
  const intelligence = teamAxisSum(team, 'inteligencia') // 0–70 (já capado em TEAM_ATTR_MAX)
  const factor = clamp(1 - intelligence * INT_TIME_REDUCTION_PER_POINT, MISSION_TIME_FLOOR, 1)
  return baseExecutionMs * factor
}

/** Duração total = ida + volta (deslocamento) + execução no local — PLAN §4.3. */
export function missionDurationMs(
  team: readonly Pokemon[],
  distance: number,
  template: MissionTemplate,
  speedMult = 1,
): number {
  return 2 * graphTravelMs(distance, team, speedMult) + executionMs(team, template.baseExecutionMs)
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
  /** Template fixo (Equipe Rocket); ausente = sorteia da categoria. */
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
    category: spec.category,
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
