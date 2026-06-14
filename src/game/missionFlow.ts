// Ciclo de vida da missão na orquestração (PLAN §3.1/§4.2/§4.3):
// scheduled → available → traveling (ida) → inProgress (execução no local) →
// returning (volta ao ginásio) → resolved (success/failure/expired).
// O desfecho é aplicado ao TERMINAR a execução; o time só fica 'idle' ao VOLTAR.

import type { Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { GameState, MissionInstance, MissionStatus } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { MAX_DISPATCH, MIN_DISPATCH } from '../engine/constants.ts'
import {
  CATEGORY_RULES,
  MISSION_XP_REWARD,
  RETURN_SPEED_BONUS_ON_SUCCESS,
  type CategoryRules,
} from '../engine/balance.ts'
import {
  effectiveRequirement,
  executionMs,
  graphTravelMs,
  missionSuccessProbability,
  resolveMission,
} from '../engine/missions.ts'
import { pathDistance, shortestPath } from '../engine/pathfinding.ts'
import { addXp } from '../engine/leveling.ts'
import { createRng, type Rng } from '../engine/rng.ts'
import { findMon, replaceMon, settleFaint, takeRng } from './runtime.ts'

function rulesFor(template: MissionTemplate): CategoryRules {
  return CATEGORY_RULES[template.category]
}

/** Status que "ocupam" um ponto do mapa (já visível ou com time em trânsito/ação). */
const OCCUPYING_STATUSES: MissionStatus[] = ['available', 'traveling', 'inProgress', 'returning']

/** Há outra missão ocupando este ponto do grafo? — PLAN §3.1 (#4). */
function nodeOccupied(s: GameState, node: string, exceptId: string): boolean {
  return s.missions.some(
    (m) => m.id !== exceptId && m.node === node && OCCUPYING_STATUSES.includes(m.status),
  )
}

/**
 * Promove a missão a 'available' quando o relógio atinge o spawn (PLAN §3.1), desde que o
 * ponto esteja livre. Se houver outra missão ocupando o mesmo ponto, adia o surgimento
 * deslizando a janela (preserva a duração) até liberar — não nascem duas no mesmo lugar (#4).
 */
export function promoteMission(s: GameState, mission: MissionInstance, nowMs: number): void {
  if (mission.status !== 'scheduled' || nowMs < mission.spawnAtMs) return
  if (nodeOccupied(s, mission.node, mission.id)) {
    const lifetime = mission.expiresAtMs - mission.spawnAtMs
    mission.spawnAtMs = nowMs
    mission.expiresAtMs = nowMs + lifetime
    return
  }
  mission.status = 'available'
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
 * Aplica o desfecho NO LOCAL (Bernoulli semeado): só HP/dano, ouro/passiva e registra o
 * resultado. O XP e a cura ficam para a VOLTA — o Pokémon "só sobe de nível ao chegar ao
 * ginásio" (§4.1, ajuste). Em sucesso, a volta é 50% mais rápida (§4.3, ajuste). O time
 * continua ocupado ('returning') até chegar de volta ao ginásio (§4.2).
 */
export function resolveMissionNow(s: GameState, mission: MissionInstance): void {
  const template = getMissionTemplate(mission.templateId)
  const rules = rulesFor(template)
  const team = teamOf(s, mission.teamIds)
  const outcome = resolveMission(takeRng(s), team, template, rules)
  // Aplica só o dano (HP) agora; XP/cura/evolução são adiados para freeOnReturn.
  for (const member of outcome.team) {
    replaceMon(s, { ...member, status: 'returning' })
  }
  // Seed de evolução sorteado AGORA (mantém o cursor do RNG estável); usado só na volta.
  mission.xpSeed = takeRng(s).int(0, 0x7fffffff)
  if (outcome.success) applyMissionRewards(s, template, rules)

  mission.status = 'returning'
  mission.result = outcome.success ? 'success' : 'failure'
  if (outcome.success) speedUpReturn(mission)
  s.today.missionResults.push({
    templateId: mission.templateId,
    success: outcome.success,
    teamIds: mission.teamIds,
  })
}

/** Encurta o trecho de volta em sucesso: time volta animado, 50% mais rápido (§4.3, ajuste). */
function speedUpReturn(mission: MissionInstance): void {
  if (mission.resolveAtMs === null || mission.returnEndsAtMs === null) return
  const returnLeg = mission.returnEndsAtMs - mission.resolveAtMs
  mission.returnEndsAtMs = mission.resolveAtMs + returnLeg / RETURN_SPEED_BONUS_ON_SUCCESS
}

/**
 * Libera o time ao chegar de volta ao ginásio: aplica o XP/cura adiados (o level-up só
 * "aparece" aqui), depois vivo→idle e desmaiado→fainted (ou revive) — §4.1 (ajuste).
 */
export function freeOnReturn(s: GameState, mission: MissionInstance): void {
  const template = getMissionTemplate(mission.templateId)
  const rules = rulesFor(template)
  const success = mission.result === 'success'
  const evoRng = createRng(mission.xpSeed ?? 0) // mesma sequência sorteada ao resolver
  for (const member of teamOf(s, mission.teamIds)) {
    replaceMon(s, settleFaint(s, applyOutcome(member, success, rules, evoRng)))
    if (success) s.today.xpEarned += MISSION_XP_REWARD // XP do dia (relatório)
  }
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
 * Efeitos aplicados na VOLTA ao ginásio: XP (só em sucesso, pode subir nível/evoluir) e
 * cura se a categoria curar (Centro Pokémon). O status final é definido por settleFaint.
 */
function applyOutcome(
  member: Pokemon,
  success: boolean,
  rules: CategoryRules,
  rng: Rng,
): Pokemon {
  let mon = success ? addXp(member, MISSION_XP_REWARD, rng).pokemon : member
  if (success && rules.healOnSuccess) mon = { ...mon, currentHp: mon.maxHp }
  return mon
}
