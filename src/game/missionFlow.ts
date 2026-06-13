// Ciclo de vida da missão na orquestração (PLAN §3.1/§4.2/§4.3):
// scheduled → available → traveling → inProgress → resolved (success/failure/expired).

import type { Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { GameState, MissionInstance } from '../engine/state.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { MAX_DISPATCH, MIN_DISPATCH } from '../engine/constants.ts'
import { CATEGORY_RULES, MISSION_XP_REWARD, type CategoryRules } from '../engine/balance.ts'
import {
  effectiveRequirement,
  executionMs,
  missionSuccessProbability,
  resolveMission,
  travelMs,
} from '../engine/missions.ts'
import { addXp } from '../engine/leveling.ts'
import { findMon, replaceMon, settleFaint, takeRng } from './runtime.ts'

function rulesFor(template: MissionTemplate): CategoryRules {
  return CATEGORY_RULES[template.category]
}

/** Promove a missão a 'available' quando o relógio atinge o spawn (PLAN §3.1). */
export function promoteMission(mission: MissionInstance, nowMs: number): void {
  if (mission.status === 'scheduled' && nowMs >= mission.spawnAtMs) mission.status = 'available'
}

/** Expira uma missão não aceita a tempo (oportunidade perdida) — PLAN §3.1. */
export function expireMission(s: GameState, mission: MissionInstance): void {
  mission.status = 'resolved'
  mission.result = 'expired'
  s.today.missionResults.push({ templateId: mission.templateId, success: false, teamIds: [] })
}

function teamOf(s: GameState, ids: readonly string[]): Pokemon[] {
  return ids.map((id) => findMon(s, id)).filter((p): p is Pokemon => p !== undefined)
}

/** Aceita a missão e despacha o time: calcula viagem/execução e ocupa os Pokémon (PLAN §4.3). */
export function acceptMission(s: GameState, missionId: string, teamIds: string[]): void {
  const mission = s.missions.find((m) => m.id === missionId)
  if (!mission || mission.status !== 'available') return
  const team = teamOf(s, teamIds).filter((p) => p.status === 'idle')
  if (team.length < MIN_DISPATCH || team.length > MAX_DISPATCH) return

  const template = getMissionTemplate(mission.templateId)
  const now = s.clock.dayElapsedMs
  const travel = travelMs(team, template.baseTravelMs)
  const execution = executionMs(team, template.baseExecutionMs)

  mission.teamIds = team.map((p) => p.id)
  mission.status = 'traveling'
  mission.travelEndsAtMs = now + travel
  mission.resolveAtMs = now + travel + execution
  mission.pSuccess = missionSuccessProbability(team, effectiveRequirement(template, rulesFor(template)))
  for (const p of team) replaceMon(s, { ...p, status: 'traveling' })
}

/** Transições por tempo: traveling→inProgress→resolução (PLAN §4.3). */
export function advanceMission(s: GameState, mission: MissionInstance, nowMs: number): void {
  if (mission.resolveAtMs !== null && nowMs >= mission.resolveAtMs) {
    resolveMissionNow(s, mission)
    return
  }
  if (
    mission.status === 'traveling' &&
    mission.travelEndsAtMs !== null &&
    nowMs >= mission.travelEndsAtMs
  ) {
    mission.status = 'inProgress'
    for (const p of teamOf(s, mission.teamIds)) replaceMon(s, { ...p, status: 'onMission' })
  }
}

/** Resolve a missão (Bernoulli semeado), aplica HP/XP/evolução e libera o time (PLAN §4.2). */
export function resolveMissionNow(s: GameState, mission: MissionInstance): void {
  const template = getMissionTemplate(mission.templateId)
  const rules = rulesFor(template)
  const team = teamOf(s, mission.teamIds)
  const outcome = resolveMission(takeRng(s), team, template, rules)
  for (const member of outcome.team) freeAfterMission(s, member, outcome.success, rules)
  if (outcome.success) applyMissionRewards(s, template, rules)

  mission.status = 'resolved'
  mission.result = outcome.success ? 'success' : 'failure'
  s.today.missionResults.push({
    templateId: mission.templateId,
    success: outcome.success,
    teamIds: mission.teamIds,
  })
}

/** Recompensas de sucesso por categoria: ouro (mart) e passiva concedida (museu). */
function applyMissionRewards(s: GameState, template: MissionTemplate, rules: CategoryRules): void {
  if (rules.goldOnSuccess > 0) {
    s.gold += rules.goldOnSuccess
    s.today.goldEarned += rules.goldOnSuccess
  }
  if (template.grantsPassive && !s.runItems.includes(template.grantsPassive)) {
    s.runItems.push(template.grantsPassive)
  }
}

/**
 * Aplica XP (só em sucesso), cura o time se a categoria curar (Centro Pokémon) e
 * devolve o Pokémon ao roster — vivo fica idle; desmaiado pode reviver via Fossil.
 */
function freeAfterMission(
  s: GameState,
  member: Pokemon,
  success: boolean,
  rules: CategoryRules,
): void {
  let mon = success ? addXp(member, MISSION_XP_REWARD).pokemon : member
  if (success && rules.healOnSuccess) mon = { ...mon, currentHp: mon.maxHp }
  replaceMon(s, settleFaint(s, mon))
}
