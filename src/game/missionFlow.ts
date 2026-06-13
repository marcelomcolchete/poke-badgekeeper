// Ciclo de vida da missão na orquestração (PLAN §3.1/§4.2/§4.3):
// scheduled → available → traveling (ida) → inProgress (execução no local) →
// returning (volta ao ginásio) → resolved (success/failure/expired).
// O desfecho é aplicado ao TERMINAR a execução; o time só fica 'idle' ao VOLTAR.

import type { Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { GameState, MissionInstance } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { MAX_DISPATCH, MIN_DISPATCH } from '../engine/constants.ts'
import { CATEGORY_RULES, MISSION_XP_REWARD, type CategoryRules } from '../engine/balance.ts'
import {
  effectiveRequirement,
  executionMs,
  graphTravelMs,
  missionSuccessProbability,
  resolveMission,
} from '../engine/missions.ts'
import { pathDistance, shortestPath } from '../engine/pathfinding.ts'
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

/**
 * Aceita a missão e despacha o time: traça o menor caminho ginásio→ponto, calcula a
 * viagem (ida e volta) e a execução, e ocupa os Pokémon como 'traveling' (PLAN §4.3).
 */
export function acceptMission(s: GameState, missionId: string, teamIds: string[]): void {
  const mission = s.missions.find((m) => m.id === missionId)
  if (!mission || mission.status !== 'available') return
  const team = teamOf(s, teamIds).filter((p) => p.status === 'idle')
  if (team.length < MIN_DISPATCH || team.length > MAX_DISPATCH) return

  const city = getCity(s.run.cityIndex)
  const template = getMissionTemplate(mission.templateId)
  const now = s.clock.dayElapsedMs
  const path = shortestPath(city.graph, city.siteNodes.gym, mission.node)
  const oneWay = graphTravelMs(pathDistance(city.graph, path), team)
  const execution = executionMs(team, template.baseExecutionMs)

  mission.teamIds = team.map((p) => p.id)
  mission.path = path
  mission.status = 'traveling'
  mission.acceptedAtMs = now
  mission.arriveAtMs = now + oneWay
  mission.resolveAtMs = now + oneWay + execution
  mission.returnEndsAtMs = now + oneWay + execution + oneWay
  mission.pSuccess = missionSuccessProbability(team, effectiveRequirement(template, rulesFor(template)))
  for (const p of team) replaceMon(s, { ...p, status: 'traveling' })
}

/**
 * Transições por tempo, em cascata (um tick grande pode atravessar várias fases):
 * traveling→inProgress→returning→resolved (PLAN §4.3).
 */
export function advanceMission(s: GameState, mission: MissionInstance, nowMs: number): void {
  if (mission.status === 'traveling' && mission.arriveAtMs !== null && nowMs >= mission.arriveAtMs) {
    mission.status = 'inProgress'
    for (const p of teamOf(s, mission.teamIds)) replaceMon(s, { ...p, status: 'onMission' })
  }
  if (mission.status === 'inProgress' && mission.resolveAtMs !== null && nowMs >= mission.resolveAtMs) {
    resolveMissionNow(s, mission)
  }
  if (
    mission.status === 'returning' &&
    mission.returnEndsAtMs !== null &&
    nowMs >= mission.returnEndsAtMs
  ) {
    freeOnReturn(s, mission)
  }
}

/**
 * Aplica o desfecho NO LOCAL (Bernoulli semeado): HP/XP/cura/ouro/passiva e registra o
 * resultado. O time continua ocupado ('returning') até chegar de volta ao ginásio (§4.2).
 */
export function resolveMissionNow(s: GameState, mission: MissionInstance): void {
  const template = getMissionTemplate(mission.templateId)
  const rules = rulesFor(template)
  const team = teamOf(s, mission.teamIds)
  const outcome = resolveMission(takeRng(s), team, template, rules)
  for (const member of outcome.team) replaceMon(s, applyOutcome(member, outcome.success, rules))
  if (outcome.success) applyMissionRewards(s, template, rules)

  mission.status = 'returning'
  mission.result = outcome.success ? 'success' : 'failure'
  s.today.missionResults.push({
    templateId: mission.templateId,
    success: outcome.success,
    teamIds: mission.teamIds,
  })
}

/** Libera o time ao chegar de volta ao ginásio: vivo→idle, desmaiado→fainted (ou revive). */
export function freeOnReturn(s: GameState, mission: MissionInstance): void {
  for (const member of teamOf(s, mission.teamIds)) replaceMon(s, settleFaint(s, member))
  mission.status = 'resolved'
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
 * Efeitos no Pokémon ao terminar a execução: XP (só em sucesso) e cura se a categoria
 * curar (Centro Pokémon). Mantém-no ocupado ('returning') — a liberação é na volta.
 */
function applyOutcome(member: Pokemon, success: boolean, rules: CategoryRules): Pokemon {
  let mon = success ? addXp(member, MISSION_XP_REWARD).pokemon : member
  if (success && rules.healOnSuccess) mon = { ...mon, currentHp: mon.maxHp }
  return { ...mon, status: 'returning' }
}
