// Ciclo de vida da missão na orquestração (PLAN §3.1/§4.2/§4.3):
// scheduled → available → traveling (ida) → inProgress (execução no local) →
// returning (volta ao ginásio) → resolved (success/failure/expired).
// O desfecho é aplicado ao TERMINAR a execução; o time só fica 'idle' ao VOLTAR.

import type { Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { GameState, MissionInstance, MissionStatus } from '../engine/state.ts'
import { markActive } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { damageForDay, MAX_DISPATCH, MIN_DISPATCH } from '../engine/constants.ts'
import {
  MISSION_XP_POOL,
  NATURAL_CURE_MISSION_HEAL,
  RETURN_SPEED_BONUS_ON_SUCCESS,
  SPECIAL_XP_MULTIPLIER,
  SWIFT_SWIM_RAIN_BONUS,
  WATER_ABSORB_XP,
} from '../engine/balance.ts'
import { goldForMart } from '../engine/economy.ts'
import {
  executionMs,
  missionSuccessProbabilityCtx,
  resolveMission,
  travelRoute,
} from '../engine/missions.ts'
import {
  hasNaturalCure,
  hasWaterAbsorb,
  sturdyAvailable,
  teamHasSwiftSwim,
  teamSurfs,
  teamTravelSpeedMultiplier,
  type MissionSecretCtx,
} from '../engine/secretEffects.ts'
import { rainTravelMs } from '../engine/rainSpeed.ts'
import { isRaining } from '../engine/weather.ts'
import { graphWithTunnels, pathUsesSurf } from '../engine/pathfinding.ts'
import { planWeatherLeg } from '../engine/weatherTravel.ts'
import { createRng } from '../engine/rng.ts'
import { applyXpGains } from './itemFlow.ts'
import { findMon, replaceMon, settleFaintTracked, takeRng } from './runtime.ts'

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

  // Electirizer: fixa (e consome) as cargas acumuladas dos membros despachados — bônus desta missão.
  const charges = (s.electirizerCharges ??= {})
  const electirizerBonus: Record<string, number> = {}
  for (const p of team) {
    if (charges[p.id]) {
      electirizerBonus[p.id] = charges[p.id]!
      delete charges[p.id]
    }
  }

  const city = getCity(s.run.cityIndex)
  const template = getMissionTemplate(mission.templateId)
  const now = s.clock.dayElapsedMs
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  // Ida e VOLTA calculadas separadamente: com arestas de mão única (ex.: k→t) a volta NÃO é o
  // reverso da ida (PLAN §3.1). Em grafos simétricos as duas rotas/distâncias coincidem.
  const outbound = travelRoute(graph, city.siteNodes.gym, mission.node, team, s.runItems)
  // Inalcançável (a rota cruzaria a água e o time não consegue surfar): não despacha — a UI
  // já bloqueia, mas a guarda evita uma viagem instantânea por engano. Voo/Sniper nunca dão [].
  if (outbound.path.length === 0) return
  const inbound = travelRoute(graph, mission.node, city.siteNodes.gym, team, s.runItems)
  const outMs = rainTravelMs(s.weather, now, outbound.distance, team, s.runItems)
  const execution = executionMs(team, template.baseExecutionMs)
  const ctx: MissionSecretCtx = {
    team,
    template,
    runtime: s.today.secretRuntime,
    runItems: s.runItems,
    electirizerBonus,
  }

  mission.teamIds = team.map((p) => p.id)
  if (Object.keys(electirizerBonus).length > 0) mission.electirizerBonus = electirizerBonus
  for (const p of team) markActive(s.today, p.id) // participação do dia (corações)
  mission.path = outbound.path
  mission.returnPath = inbound.path
  mission.flying = outbound.flying
  mission.surfing = outbound.surfing
  mission.status = 'traveling'
  mission.acceptedAtMs = now
  mission.arriveAtMs = now + outMs
  mission.resolveAtMs = mission.arriveAtMs + execution
  mission.returnEndsAtMs =
    mission.resolveAtMs + rainTravelMs(s.weather, mission.resolveAtMs, inbound.distance, team, s.runItems)
  mission.pSuccess = missionSuccessProbabilityCtx(ctx, mission.requirement)
  // Natural Cure: recupera vida ao sair em missão (cap em maxHp); demais só viajam.
  for (const p of team) {
    const healed = hasNaturalCure(p)
      ? Math.min(p.maxHp, p.currentHp + NATURAL_CURE_MISSION_HEAL)
      : p.currentHp
    replaceMon(s, { ...p, currentHp: healed, status: 'traveling' })
  }
  // Water Absorb: a rota passa pela água → cada portador ganha XP na hora.
  if (pathUsesSurf(graph, outbound.path)) {
    const gains = new Map(
      team.filter(hasWaterAbsorb).map((p) => [p.id, WATER_ABSORB_XP] as const),
    )
    if (gains.size > 0) applyXpGains(s, gains, takeRng(s))
  }
}

/**
 * Desloca os marcos da missão por `deltaMs` (atraso de poça embutido). `shiftStart` translada a
 * janela INTEIRA da perna (início + fim) — usado na ESPERA, em que o sprite fica parado por
 * `deltaMs` e a fração de progresso (now − início)/(fim − início) precisa retomar de onde congelou.
 * Sem `shiftStart`, só estica o fim — usado no DESVIO, em que o caminho fica mais longo mas o
 * sprite segue andando (o início da perna continua válido).
 */
export function shiftMissionTimestamps(
  mission: MissionInstance,
  fromLeg: 'out' | 'back',
  deltaMs: number,
  shiftStart = false,
): void {
  if (deltaMs <= 0) return
  if (fromLeg === 'out') {
    if (shiftStart && mission.acceptedAtMs !== null) mission.acceptedAtMs += deltaMs
    if (mission.arriveAtMs !== null) mission.arriveAtMs += deltaMs
    if (mission.resolveAtMs !== null) mission.resolveAtMs += deltaMs
  } else if (shiftStart && mission.resolveAtMs !== null) {
    mission.resolveAtMs += deltaMs
  }
  if (mission.returnEndsAtMs !== null) mission.returnEndsAtMs += deltaMs
  mission.weatherDelayMs = (mission.weatherDelayMs ?? 0) + deltaMs
}

/**
 * Clima (poças): para um time que NÃO surfa nem voa, faz a missão em trânsito desviar de poças
 * ativas na rota ou, sem alternativa seca, esperar no ponto anterior até a poça secar. Resolvido
 * em granularidade de ponto a cada tick; tudo determinístico (poça = função pura de `now`).
 */
export function applyWeatherHold(s: GameState, mission: MissionInstance, nowMs: number): void {
  if (s.weather.rain.length === 0) return
  if (mission.flying) return
  const team = teamOf(s, mission.teamIds)
  if (team.length === 0 || teamSurfs(team, s.runItems)) return

  // Espera em andamento: fica parado até a poça secar; só então reavalia.
  if (mission.weatherHold) {
    if (nowMs < mission.weatherHold.untilMs) return
    mission.weatherHold = undefined
  }

  const traveling = mission.status === 'traveling'
  const legStart = traveling ? mission.acceptedAtMs : mission.resolveAtMs
  const legEnd = traveling ? mission.arriveAtMs : mission.returnEndsAtMs
  if (legStart === null || legEnd === null) return
  const baseLeg = traveling
    ? mission.reroutePath ?? mission.path
    : mission.reroutePath ?? mission.returnPath ?? [...mission.path].reverse()

  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  // Velocidade efetiva AGORA (base + Swift Swim se chovendo). O extraMs do desvio é LINEAR a essa
  // taxa instantânea, enquanto a chegada-base veio do integrador (rainSpeed) — aproximação
  // consciente: como o sprite interpola linear em [legStart, arriveAtMs], os extremos não
  // dessincronizam (ver "Notas de implementação" no plano da feature).
  const speedMult =
    teamTravelSpeedMultiplier(team, s.runItems) +
    (teamHasSwiftSwim(team) && isRaining(s.weather, nowMs) ? SWIFT_SWIM_RAIN_BONUS : 0)
  const plan = planWeatherLeg({
    graph,
    weather: s.weather,
    baseLeg,
    legStart,
    legEnd,
    nowMs,
    team,
    speedMult,
  })
  if (plan.kind === 'reroute') {
    mission.reroutePath = plan.reroutePath
    shiftMissionTimestamps(mission, traveling ? 'out' : 'back', plan.extraMs)
  } else if (plan.kind === 'wait') {
    mission.weatherHold = { node: plan.node, untilMs: plan.untilMs }
    // Espera: translada a janela inteira (início + fim) para o progresso retomar do ponto congelado.
    shiftMissionTimestamps(mission, traveling ? 'out' : 'back', plan.extraMs, true)
  }
}

/**
 * Transições por tempo, em cascata (um tick grande pode atravessar várias fases):
 * traveling→inProgress→returning→resolved (PLAN §4.3).
 */
export function advanceMission(s: GameState, mission: MissionInstance, nowMs: number): void {
  if (mission.status === 'traveling' || mission.status === 'returning') {
    applyWeatherHold(s, mission, nowMs)
  }
  if (mission.status === 'traveling' && mission.arriveAtMs !== null && nowMs >= mission.arriveAtMs) {
    mission.status = 'inProgress'
    mission.reroutePath = undefined // a ida acabou; a volta replaneja do zero
    mission.weatherHold = undefined
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
  const ctx: MissionSecretCtx = {
    team,
    template,
    runtime: s.today.secretRuntime,
    runItems: s.runItems,
    electirizerBonus: mission.electirizerBonus,
  }
  const pSuccess = missionSuccessProbabilityCtx(ctx, mission.requirement)
  const outcome = resolveMission(
    takeRng(s),
    team,
    mission.requirement,
    template.danger,
    pSuccess,
    damageForDay(s.run.day),
  )
  // Habilidades Secretas: consome o Battle Armor pendente (valeu para esta missão).
  applyMissionSecretRuntime(s, team)

  // Aplica só o dano (HP) agora; XP/cura/evolução são adiados para freeOnReturn.
  // Sturdy: salva do desmaio em missão (1×/dia) — fica com 1 de vida.
  const sturdyIds = new Set(
    team.filter((p) => sturdyAvailable(p, s.today.secretRuntime)).map((p) => p.id),
  )
  for (const member of outcome.team) {
    let mon = member
    if (mon.currentHp <= 0 && sturdyIds.has(mon.id)) {
      mon = { ...mon, currentHp: 1 }
      ;(s.today.secretRuntime[mon.id] ??= {}).sturdyUsed = true
    }
    replaceMon(s, { ...mon, status: 'returning' })
  }
  // Seed de evolução sorteado AGORA (mantém o cursor do RNG estável); usado só na volta.
  mission.xpSeed = takeRng(s).int(0, 0x7fffffff)
  if (outcome.success) {
    // Pool de XP dividido entre os participantes; a Missão Especial paga SPECIAL_XP_MULTIPLIER×.
    const pool = template.id === 'special' ? MISSION_XP_POOL * SPECIAL_XP_MULTIPLIER : MISSION_XP_POOL
    const share = team.length > 0 ? Math.floor(pool / team.length) : 0
    mission.xpAwards = Object.fromEntries(team.map((p) => [p.id, share]))
    applyMissionRewards(s, template, team)
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
  const team = teamOf(s, mission.teamIds)
  const evoRng = createRng(mission.xpSeed ?? 0) // mesma sequência sorteada ao resolver
  if (success) {
    // XP do pool por participante + distribuição do Exp Share ao resto do time.
    const gains = new Map(team.map((p) => [p.id, mission.xpAwards?.[p.id] ?? 0]))
    applyXpGains(s, gains, evoRng)
    for (const xp of gains.values()) s.today.xpEarned += xp // relatório — soma dos shares = pool
  }
  // Status final (e cura do Pokecenter) por participante, relendo do roster pós-XP.
  for (const member of team) {
    let mon = findMon(s, member.id) ?? member
    if (success && template.healOnSuccess) mon = { ...mon, currentHp: mon.maxHp }
    replaceMon(s, settleFaintTracked(s, mon))
  }
  mission.status = 'resolved'
}

/**
 * Atualiza o estado diário das Habilidades Secretas após resolver a missão: consome o Battle
 * Armor pendente (o bônus de atributos valeu para ESTA missão). Weak Armor deriva a velocidade do
 * HP faltante e Shell Armor não tem debuff de velocidade — nada a re-armar aqui.
 */
function applyMissionSecretRuntime(s: GameState, before: readonly Pokemon[]): void {
  for (const p of before) {
    const rt = s.today.secretRuntime[p.id]
    if (rt?.battleArmorPending) rt.battleArmorPending = false
  }
}

/** Recompensas de sucesso do template: ouro (Pokemart), escalado pelo Carisma do time (até 2×). */
function applyMissionRewards(s: GameState, template: MissionTemplate, team: readonly Pokemon[]): void {
  if (template.goldOnSuccess) {
    const gold = goldForMart(team, template.goldOnSuccess)
    s.gold += gold
    s.today.goldEarned += gold
  }
}

