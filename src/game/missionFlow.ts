// Ciclo de vida da missão na orquestração (PLAN §3.1/§4.2/§4.3):
// scheduled → available → traveling (ida) → inProgress (execução no local) →
// returning (volta ao ginásio) → resolved (success/failure/expired).
// O desfecho é aplicado ao TERMINAR a execução; o time só fica 'idle' ao VOLTAR.

import type { Pokemon, TrainerId } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { GameState, MissionInstance, MissionStatus } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { getTrainer } from '../data/trainers.ts'
import { MAX_DISPATCH, MIN_DISPATCH } from '../engine/constants.ts'
import {
  MISSION_XP_POOL,
  RETURN_SPEED_BONUS_ON_SUCCESS,
  ROCKET_GOLD_BONUS,
  ROCKET_XP_MULTIPLIER,
} from '../engine/balance.ts'
import {
  enemySquadSizeForDay,
  generateDefenseEnemies,
  resolveDefense,
} from '../engine/gymDefense.ts'
import { goldForDefense } from '../engine/economy.ts'
import {
  executionMs,
  graphTravelMs,
  missionSuccessProbabilityCtx,
  resolveMission,
  type MissionOutcome,
} from '../engine/missions.ts'
import {
  activeSecretId,
  hasSturdy,
  hasWeakArmor,
  teamTravelSpeedMultiplier,
  type MissionSecretCtx,
} from '../engine/secretEffects.ts'
import { graphWithTunnel, pathDistance, shortestPath } from '../engine/pathfinding.ts'
import { addXp } from '../engine/leveling.ts'
import { createRng, type Rng } from '../engine/rng.ts'
import { findMon, replaceMon, settleFaint, takeRng } from './runtime.ts'

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
  const graph = graphWithTunnel(city.graph, s.today.digTunnel)
  const path = shortestPath(graph, city.siteNodes.gym, mission.node)
  const speedMult = teamTravelSpeedMultiplier(team, s.today.secretRuntime)
  const oneWay = graphTravelMs(pathDistance(graph, path), team, speedMult)
  const execution = executionMs(team, template.baseExecutionMs)
  const ctx: MissionSecretCtx = { team, template, runtime: s.today.secretRuntime }

  mission.teamIds = team.map((p) => p.id)
  mission.path = path
  mission.status = 'traveling'
  mission.acceptedAtMs = now
  mission.arriveAtMs = now + oneWay
  mission.resolveAtMs = now + oneWay + execution
  mission.returnEndsAtMs = now + oneWay + execution + oneWay
  mission.pSuccess = missionSuccessProbabilityCtx(ctx, mission.requirement)
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
  const team = teamOf(s, mission.teamIds)
  const ctx: MissionSecretCtx = { team, template, runtime: s.today.secretRuntime }
  const pSuccess = missionSuccessProbabilityCtx(ctx, mission.requirement)
  const outcome = resolveMission(takeRng(s), team, mission.requirement, template.danger, pSuccess)
  // Habilidades Secretas: atualiza stacks (Sand Rush), ativa Weak Armor e consome Battle Armor.
  applyMissionSecretRuntime(s, team, outcome)

  // Equipe Rocket: cumprir a parte de atributos NÃO dá recompensa — o time fica no local
  // para BATALHAR (status 'battle'). Recompensas só na vitória (PLAN — Rocket Team). Falhar
  // a parte de atributos cai no caminho normal de derrota (sem batalha).
  if (template.isRocket && outcome.success) {
    setupRocketBattle(s, mission, team)
    return
  }

  // Aplica só o dano (HP) agora; XP/cura/evolução são adiados para freeOnReturn.
  for (const member of outcome.team) {
    replaceMon(s, { ...member, status: 'returning' })
  }
  // Seed de evolução sorteado AGORA (mantém o cursor do RNG estável); usado só na volta.
  mission.xpSeed = takeRng(s).int(0, 0x7fffffff)
  if (outcome.success) {
    // Pool de XP da missão dividido igualmente entre os participantes (aplicado na volta).
    const share = team.length > 0 ? Math.floor(MISSION_XP_POOL / team.length) : 0
    mission.xpAwards = Object.fromEntries(team.map((p) => [p.id, share]))
    applyMissionRewards(s, template)
  }

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
  const success = mission.result === 'success'
  const evoRng = createRng(mission.xpSeed ?? 0) // mesma sequência sorteada ao resolver
  for (const member of teamOf(s, mission.teamIds)) {
    const xp = success ? (mission.xpAwards?.[member.id] ?? 0) : 0
    replaceMon(s, settleFaint(applyOutcome(member, xp, success, template, evoRng)))
    if (success) s.today.xpEarned += xp // XP do dia (relatório) — soma dos shares = pool
  }
  mission.status = 'resolved'
}

/**
 * Atualiza o estado diário das Habilidades Secretas após resolver a missão:
 * Sand Rush acumula/zera os stacks; Weak Armor ativa o buff de velocidade ao tomar dano;
 * Battle Armor é consumido (valeu para esta missão).
 */
function applyMissionSecretRuntime(
  s: GameState,
  before: readonly Pokemon[],
  outcome: MissionOutcome,
): void {
  const post = new Map(outcome.team.map((p) => [p.id, p]))
  for (const p of before) {
    const rt = (s.today.secretRuntime[p.id] ??= {})
    if (activeSecretId(p) === 'secret-sandshrew') {
      rt.sandRushStacks = outcome.success ? (rt.sandRushStacks ?? 0) + 1 : 0
    }
    if (hasWeakArmor(p)) {
      const after = post.get(p.id)
      if (after && after.currentHp < p.currentHp) rt.weakArmorActive = true
    }
    if (rt.battleArmorPending) rt.battleArmorPending = false
  }
}

/** Recompensas de sucesso do template: ouro (Pokemart). */
function applyMissionRewards(s: GameState, template: MissionTemplate): void {
  if (template.goldOnSuccess) {
    s.gold += template.goldOnSuccess
    s.today.goldEarned += template.goldOnSuccess
  }
}

/**
 * Efeitos aplicados na VOLTA ao ginásio: XP (só em sucesso — o share do pool deste
 * Pokémon, pode subir nível/evoluir) e cura se o template curar (Pokecenter). O status
 * final é definido por settleFaint.
 */
function applyOutcome(
  member: Pokemon,
  xp: number,
  success: boolean,
  template: MissionTemplate,
  rng: Rng,
): Pokemon {
  let mon = success ? addXp(member, xp, rng).pokemon : member
  if (success && template.healOnSuccess) mon = { ...mon, currentHp: mon.maxHp }
  return mon
}

// ---- Equipe Rocket (batalha após a parte de atributos) — PLAN — Rocket Team ----

/**
 * Monta a batalha da Equipe Rocket após cumprir a parte de atributos: sorteia o treinador
 * (masculino/feminino) e o esquadrão inimigo (mesma quantidade por dia que a defesa de
 * ginásio, com um desafiante em destaque). O time fica 'onMission' aguardando o jogador
 * clicar em "Batalhar" — sem recompensa ainda, só na vitória.
 */
function setupRocketBattle(s: GameState, mission: MissionInstance, team: readonly Pokemon[]): void {
  const trainerId: TrainerId = takeRng(s).bool(0.5) ? 'ROCKET_TEAM_MALE' : 'ROCKET_TEAM_FEMALE'
  const size = enemySquadSizeForDay(s.run.day)
  const enemies = generateDefenseEnemies(takeRng(s), getTrainer(trainerId), size)
  mission.rocket = { trainerId, enemies, resolved: false }
  mission.status = 'battle'
  mission.result = 'success'
  for (const p of team) replaceMon(s, { ...p, status: 'onMission' })
}

/**
 * Resolve a batalha da Equipe Rocket (cadeia de duelos 1v1, time na ORDEM em que foi
 * despachado): aplica HP/desmaio e registra o log. Ouro e 3× XP ficam para
 * completeRocketBattle — só vêm na vitória. Idempotente (rocket.resolved).
 */
export function resolveRocketBattle(s: GameState, missionId: string): void {
  const mission = s.missions.find((m) => m.id === missionId)
  if (!mission?.rocket || mission.rocket.resolved) return
  const team = teamOf(s, mission.teamIds) // ordem do despacho preservada
  const sturdyAvailableIds = new Set(
    team.filter((p) => hasSturdy(p) && !s.today.secretRuntime[p.id]?.sturdyUsed).map((p) => p.id),
  )
  const resolution = resolveDefense(takeRng(s), team, mission.rocket.enemies, { sturdyAvailableIds })
  for (const id of resolution.sturdyUsedIds) (s.today.secretRuntime[id] ??= {}).sturdyUsed = true
  // Atualiza Weak Armor de quem tomou dano (velocidade nas próximas missões do dia).
  const post = new Map(resolution.squad.map((p) => [p.id, p]))
  for (const p of team) {
    if (hasWeakArmor(p)) {
      const after = post.get(p.id)
      if (after && after.currentHp < p.currentHp) (s.today.secretRuntime[p.id] ??= {}).weakArmorActive = true
    }
  }
  // Registra os desafiantes derrotados (MVP/relatório).
  let theirs = 0
  for (const duel of resolution.duels) {
    if (duel.youWon) {
      s.today.defenseKills.push({
        defeaterId: duel.yourId,
        speciesId: mission.rocket.enemies[theirs]?.speciesId,
      })
      theirs += 1
    }
  }
  for (const member of resolution.squad) replaceMon(s, settleFaint(member))
  mission.rocket.duels = resolution.duels
  mission.rocket.won = resolution.won
  mission.rocket.resolved = true
  mission.rocket.xpSeed = takeRng(s).int(0, 0x7fffffff)
}

/**
 * Conclui a batalha Rocket ao fim da animação: na VITÓRIA aplica ouro-bônus + 3× o pool de
 * XP normal (pode subir nível/evoluir) e marca a missão como sucesso; na derrota, sem
 * recompensa. Em ambos os casos a missão é resolvida e o resultado entra no relatório.
 * Idempotente (rocket.rewardApplied).
 */
export function completeRocketBattle(s: GameState, missionId: string): void {
  const mission = s.missions.find((m) => m.id === missionId)
  if (!mission?.rocket || mission.rocket.rewardApplied) return
  const won = mission.rocket.won === true
  const team = teamOf(s, mission.teamIds)
  if (won) {
    const pool = MISSION_XP_POOL * ROCKET_XP_MULTIPLIER
    const share = team.length > 0 ? Math.floor(pool / team.length) : 0
    mission.xpAwards = Object.fromEntries(team.map((p) => [p.id, share]))
    const evoRng = createRng(mission.rocket.xpSeed ?? 0)
    for (const member of team) {
      replaceMon(s, addXp(member, share, evoRng).pokemon)
      s.today.xpEarned += share
    }
    const gold = goldForDefense(team) + ROCKET_GOLD_BONUS
    s.gold += gold
    s.today.goldEarned += gold
  }
  mission.result = won ? 'success' : 'failure'
  mission.status = 'resolved'
  mission.rocket.rewardApplied = true
  s.today.missionResults.push({
    templateId: mission.templateId,
    success: won,
    teamIds: mission.teamIds,
  })
}

/** Não despachar ninguém para a missão Rocket encerra a run na hora (como ginásio indefeso). */
export function loseRunByRocket(s: GameState): void {
  s.run.phase = 'GAMEOVER'
  s.run.gameOverReason = 'rocket'
  s.clock.speed = 0
}
