// Missões: probabilidade de sucesso (interseção de hexágonos), resolução, dano em
// falha, tempos de viagem/execução e geração de instância (PLAN §4.2/§4.3).

import type { MapPos, Pokemon } from '../types/index.ts'
import type { Attrs } from '../types/index.ts'
import type { Rng } from './rng.ts'
import type { MissionTemplate } from '../data/types.ts'
import { MISSION_TEMPLATES } from '../data/missionTemplates.ts'
import type { MissionInstance } from './state.ts'
import { MIN_FAILURE_DAMAGE, SPECIES_BASE_MAX } from './constants.ts'
import { RUN_AWAY_TRAVEL_FACTOR } from './balance.ts'
import { applyDamage, axisMin, effectiveAttr, hexagonArea, isFainted, teamSum } from './attributes.ts'
import { average, clamp } from './math.ts'

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

/** Sorteio de Bernoulli com P_sucesso; em falha, cada Pokémon perde HP inteiro. */
export function resolveMission(
  rng: Rng,
  team: readonly Pokemon[],
  template: MissionTemplate,
): MissionOutcome {
  const pSuccess = missionSuccessProbability(team, template.requirement)
  if (rng.bool(pSuccess)) {
    return { success: true, pSuccess, team: [...team], faintedIds: [] }
  }
  const damage = missionFailureDamage(pSuccess, template.danger)
  const updated = team.map((p) => applyDamage(p, damage))
  return {
    success: false,
    pSuccess,
    team: updated,
    faintedIds: updated.filter(isFainted).map((p) => p.id),
  }
}

/** Tempo de viagem: baseViagem / (1 + médiaAgilidade/50); Fly zera, Run Away reduz (PLAN §4.3). */
export function travelMs(team: readonly Pokemon[], baseTravelMs: number): number {
  if (team.some((p) => p.passives.includes('fly'))) return 0
  const reduction = team.some((p) => p.passives.includes('run-away')) ? RUN_AWAY_TRAVEL_FACTOR : 1
  const avgAgility = average(team.map((p) => effectiveAttr(p, 'agilidade')))
  return (baseTravelMs / (1 + avgAgility / SPECIES_BASE_MAX)) * reduction
}

/** Tempo de execução: baseExecução / (1 + médiaInteligência/50) — PLAN §4.3. */
export function executionMs(team: readonly Pokemon[], baseExecutionMs: number): number {
  const avgIntelligence = average(team.map((p) => effectiveAttr(p, 'inteligencia')))
  return baseExecutionMs / (1 + avgIntelligence / SPECIES_BASE_MAX)
}

export function missionDurationMs(team: readonly Pokemon[], template: MissionTemplate): number {
  return travelMs(team, template.baseTravelMs) + executionMs(team, template.baseExecutionMs)
}

export function rollMissionTemplate(rng: Rng): MissionTemplate {
  return rng.pick(MISSION_TEMPLATES)
}

export interface MissionInstanceSpec {
  id: string
  rng: Rng
  anchors: readonly MapPos[]
  anchorIndex: number
  spawnAtMs: number
  lifetimeMs: number
}

/** Cria a instância de missão (template + âncora + timer) para o mapa do dia (PLAN §3.1). */
export function createMissionInstance(spec: MissionInstanceSpec): MissionInstance {
  const template = rollMissionTemplate(spec.rng)
  const anchorCount = spec.anchors.length
  const pos = anchorCount > 0 ? spec.anchors[spec.anchorIndex % anchorCount] : undefined
  return {
    id: spec.id,
    templateId: template.id,
    pos: pos ? { ...pos } : { x: 0.5, y: 0.5 },
    expiresAtMs: spec.spawnAtMs + spec.lifetimeMs,
    status: 'available',
    teamIds: [],
  }
}
