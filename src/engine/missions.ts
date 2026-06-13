// Missões: probabilidade de sucesso (interseção de hexágonos), resolução, dano em
// falha, tempos de viagem/execução e geração de instância (PLAN §4.2/§4.3).

import type { Attrs, MissionCategory, Pokemon } from '../types/index.ts'
import { ATTR_KEYS } from '../types/index.ts'
import type { Rng } from './rng.ts'
import type { MissionTemplate } from '../data/types.ts'
import { getMissionTemplate, templatesForCategory } from '../data/missionTemplates.ts'
import type { MissionInstance } from './state.ts'
import { ATTR_MAX, MIN_FAILURE_DAMAGE, SPECIES_BASE_MAX } from './constants.ts'
import {
  AGILITY_TIME_REDUCTION_PER_POINT,
  RUN_AWAY_TRAVEL_FACTOR,
  TRAVEL_MS_PER_DISTANCE,
  type CategoryRules,
} from './balance.ts'
import {
  applyDamage,
  axisMin,
  effectiveAttr,
  hexagonArea,
  isFainted,
  teamAxisSum,
  teamSum,
} from './attributes.ts'
import { average, clamp } from './math.ts'

/** Regra neutra (sem ajuste de dificuldade/efeitos) — padrão de resolveMission. */
export const NEUTRAL_RULES: CategoryRules = {
  reqMult: 1,
  dangerMult: 1,
  healOnSuccess: false,
  goldOnSuccess: 0,
}

/** Exigência escalada pela regra da categoria (clamp 0–100 por eixo). */
export function effectiveRequirement(template: MissionTemplate, rules: CategoryRules): Attrs {
  const out = {} as Attrs
  for (const key of ATTR_KEYS) {
    out[key] = clamp(Math.round(template.requirement[key] * rules.reqMult), 0, ATTR_MAX)
  }
  return out
}

/** Perigo (dano em falha) escalado pela regra da categoria, mínimo 1. */
export function effectiveDanger(template: MissionTemplate, rules: CategoryRules): number {
  return Math.max(MIN_FAILURE_DAMAGE, Math.round(template.danger * rules.dangerMult))
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
 * Sorteio de Bernoulli com P_sucesso; em falha, cada Pokémon perde HP inteiro.
 * `rules` ajusta exigência/perigo pela categoria (padrão neutro p/ compatibilidade).
 */
export function resolveMission(
  rng: Rng,
  team: readonly Pokemon[],
  template: MissionTemplate,
  rules: CategoryRules = NEUTRAL_RULES,
): MissionOutcome {
  const pSuccess = missionSuccessProbability(team, effectiveRequirement(template, rules))
  if (rng.bool(pSuccess)) {
    return { success: true, pSuccess, team: [...team], faintedIds: [] }
  }
  const damage = missionFailureDamage(pSuccess, effectiveDanger(template, rules))
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
 * Cria a instância de missão (template + ponto + timer) agendada para o dia.
 * Nasce 'scheduled'; o relógio a promove a 'available' no spawnAtMs (PLAN §3.1).
 */
export function createMissionInstance(spec: MissionInstanceSpec): MissionInstance {
  const template = spec.templateId
    ? getMissionTemplate(spec.templateId)
    : rollMissionTemplate(spec.rng, spec.category)
  return {
    id: spec.id,
    templateId: template.id,
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
