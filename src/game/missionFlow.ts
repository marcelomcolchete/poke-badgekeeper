// Ciclo de vida da missão na orquestração (PLAN §3.1/§4.2/§4.3):
// scheduled → available → traveling → inProgress → resolved (success/failure/expired).

import type { Pokemon } from '../types/index.ts'
import type { GameState, MissionInstance } from '../engine/state.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { MAX_DISPATCH, MIN_DISPATCH } from '../engine/constants.ts'
import { MISSION_XP_REWARD } from '../engine/balance.ts'
import {
  executionMs,
  missionSuccessProbability,
  resolveMission,
  travelMs,
} from '../engine/missions.ts'
import { addXp } from '../engine/leveling.ts'
import { findMon, replaceMon, takeRng } from './runtime.ts'

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
  mission.pSuccess = missionSuccessProbability(team, template.requirement)
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
  const team = teamOf(s, mission.teamIds)
  const outcome = resolveMission(takeRng(s), team, template)
  for (const member of outcome.team) freeAfterMission(s, member, outcome.success)

  mission.status = 'resolved'
  mission.result = outcome.success ? 'success' : 'failure'
  s.today.missionResults.push({
    templateId: mission.templateId,
    success: outcome.success,
    teamIds: mission.teamIds,
  })
}

/** Aplica XP (só em sucesso) e devolve o Pokémon ao roster como idle ou desmaiado. */
function freeAfterMission(s: GameState, member: Pokemon, success: boolean): void {
  const withXp = success ? addXp(member, MISSION_XP_REWARD).pokemon : member
  const status = withXp.currentHp <= 0 ? 'fainted' : 'idle'
  replaceMon(s, { ...withXp, status })
}
