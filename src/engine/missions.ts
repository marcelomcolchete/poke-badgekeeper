// Missões: probabilidade de sucesso (interseção de hexágonos), resolução, dano em
// falha, tempos de viagem/execução e geração de instância (PLAN §4.2/§4.3).

import type { AttrKey, Attrs, MissionCategory, Pokemon } from '../types/index.ts'
import { ATTR_KEYS } from '../types/index.ts'
import type { Rng } from './rng.ts'
import type { MissionTemplate, CityGraph } from '../data/types.ts'
import { getMissionTemplate, templatesForCategory } from '../data/missionTemplates.ts'
import type { MissionInstance } from './state.ts'
import {
  graphWithoutSurf,
  pathDistance,
  pathUsesSurf,
  shortestPath,
  surfTravelDistance,
} from './pathfinding.ts'
import { MIN_FAILURE_DAMAGE, TEAM_ATTR_MAX } from './constants.ts'
import {
  AGILITY_TIME_REDUCTION_PER_POINT,
  INT_TIME_REDUCTION_PER_POINT,
  MISSION_DAY_DIVISOR,
  MISSION_DAY_SCALE,
  MISSION_TIME_FLOOR,
  MISSION_PRINCIPAL_MAX,
  MISSION_PRINCIPAL_MIN,
  MISSION_REST_DAY_PIVOT,
  MISSION_REST_DAY_SLOPE,
  MISSION_REST_MAX,
  MISSION_REST_MIN,
  MISSION_SECONDARY_MAX,
  MISSION_SECONDARY_MIN,
  RUN_AWAY_TRAVEL_FACTOR,
  SPECIAL2_PRINCIPALS,
  SPECIAL2_SECONDARIES,
  SPECIAL5_PRINCIPALS,
  SPECIAL5_SECONDARIES,
  TRAVEL_MS_PER_DISTANCE,
} from './balance.ts'
import {
  applyDamage,
  axisMin,
  hexagonArea,
  isFainted,
  mapAttrs,
  teamAxisSum,
  teamSum,
  zeroAttrs,
} from './attributes.ts'
import { missionTypeItemMultiplier } from './itemEffects.ts'
import {
  damageTaken,
  leafGuardAbsorberId,
  teamFlies,
  teamHasVitalSpirit,
  teamSecretSum,
  teamSnipes,
  teamSurfs,
  type MissionSecretCtx,
} from './secretEffects.ts'
import { clamp } from './math.ts'

/** Termo do dia somado às faixas-base (principal/secundário): SCALE · dia / DIVISOR. */
function dayTerm(day: number): number {
  return (MISSION_DAY_SCALE * day) / MISSION_DAY_DIVISOR
}

/** Valor de um eixo principal: rand(20..30) + termo do dia, com teto TEAM_ATTR_MAX (100). */
function principalValue(rng: Rng, day: number): number {
  return clamp(
    Math.round(rng.int(MISSION_PRINCIPAL_MIN, MISSION_PRINCIPAL_MAX) + dayTerm(day)),
    0,
    TEAM_ATTR_MAX,
  )
}

/** Valor de um eixo secundário: rand(10..20) + termo do dia, com teto TEAM_ATTR_MAX (100). */
function secondaryValue(rng: Rng, day: number): number {
  return clamp(
    Math.round(rng.int(MISSION_SECONDARY_MIN, MISSION_SECONDARY_MAX) + dayTerm(day)),
    0,
    TEAM_ATTR_MAX,
  )
}

/** Termo do dia do resto: SLOPE · (dia − PIVOT). Negativo antes do pivô, ~0 no pivô. */
function restDayTerm(day: number): number {
  return MISSION_REST_DAY_SLOPE * (day - MISSION_REST_DAY_PIVOT)
}

/**
 * Valor de um eixo "resto" (nem principal, nem secundário): rand(5..20) + termo do dia do
 * resto, com teto TEAM_ATTR_MAX (100). Evolui muito devagar: abaixo de 5–20 nos primeiros
 * dias, na faixa-base no dia 6, subindo de leve depois.
 */
function restValue(rng: Rng, day: number): number {
  return clamp(
    Math.round(rng.int(MISSION_REST_MIN, MISSION_REST_MAX) + restDayTerm(day)),
    0,
    TEAM_ATTR_MAX,
  )
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
 * Especiais: special2 = 2 princ + 1 sec (distintos); special5 = 4 princ + 2 sec, e um
 * secundário pode coincidir com um principal (vira "mega" naquele eixo).
 */
export function generateRequirement(
  rng: Rng,
  day: number,
  template: MissionTemplate,
): GeneratedRequirement {
  const out = zeroAttrs()
  for (const key of ATTR_KEYS) out[key] = restValue(rng, day)

  if (template.gen === 'normal') {
    const primary = template.primaryAttr as AttrKey
    const secondary = rng.pick(ATTR_KEYS)
    if (secondary === primary) {
      // "Mega": o eixo soma principal + secundário (com teto TEAM_ATTR_MAX → ~100).
      out[primary] = clamp(principalValue(rng, day) + secondaryValue(rng, day), 0, TEAM_ATTR_MAX)
    } else {
      out[primary] = principalValue(rng, day)
      out[secondary] = secondaryValue(rng, day)
    }
    return { requirement: out, secondaryAttr: secondary }
  }

  // special5 (Missão Especial): 4 principais + 2 secundários sorteados entre TODOS os eixos
  // (distintos entre si). Um secundário que cai num eixo principal vira "mega" (principal +
  // secundário no mesmo eixo, capado no teto do time). Sobram 0..2 eixos no "resto".
  if (template.gen === 'special5') {
    const principalAxes = rng.shuffle(ATTR_KEYS).slice(0, SPECIAL5_PRINCIPALS)
    const principalSet = new Set(principalAxes)
    for (const ax of principalAxes) out[ax as AttrKey] = principalValue(rng, day)
    const secAxes = rng.shuffle(ATTR_KEYS).slice(0, SPECIAL5_SECONDARIES) // sorteio independente sobre todos os 6 eixos → secundário pode cair em principal (mega) ou eixo livre
    for (const ax of secAxes) {
      out[ax as AttrKey] = principalSet.has(ax)
        ? clamp(out[ax as AttrKey] + secondaryValue(rng, day), 0, TEAM_ATTR_MAX) // mega
        : secondaryValue(rng, day)
    }
    return { requirement: out, secondaryAttr: null }
  }

  // special2 (pokecenter/pokemart): 2 principais + 1 secundário, todos distintos (sem mega).
  const axes = rng.shuffle(ATTR_KEYS)
  let i = 0
  for (let k = 0; k < SPECIAL2_PRINCIPALS; k++, i++) out[axes[i] as AttrKey] = principalValue(rng, day)
  for (let k = 0; k < SPECIAL2_SECONDARIES; k++, i++) out[axes[i] as AttrKey] = secondaryValue(rng, day)
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
  const summed = teamSecretSum(ctx)
  // Lentes de cidade: +50% de poder do time no tipo de missão correspondente.
  const typeMult = missionTypeItemMultiplier(ctx.template.id, ctx.runItems)
  const boosted = typeMult === 1 ? summed : mapAttrs((k) => summed[k] * typeMult)
  const intersection = hexagonArea(axisMin(boosted, requirement))
  const base = clamp(intersection / requiredArea, 0, 1)
  return teamHasVitalSpirit(ctx.team) ? 1 - (1 - base) ** 2 : base
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
  // Leaf Guard (L1+): numa falha, só o portador-absorvedor (maior vida) toma o dano; os demais 0.
  const absorberId = leafGuardAbsorberId(team)
  // Weak Armor dobra o dano recebido; Shell Armor reduz para 1.
  const updated = team.map((p) => {
    const raw = absorberId === null || p.id === absorberId ? damage : 0
    return applyDamage(p, damageTaken(p, raw))
  })
  return {
    success: false,
    pSuccess,
    team: updated,
    faintedIds: updated.filter(isFainted).map((p) => p.id),
  }
}

/**
 * Fator de tempo de viagem pela Agilidade total do time (PLAN §4.3): −1%/ponto, soma capada
 * em 100 → piso de 0,3 (10 → 0,90; 70 → 0,30, redução máx. 70%). Run Away reduz mais; Fly zera
 * (tratado em graphTravelMs). Devolve o multiplicador a aplicar sobre o tempo-base de deslocamento.
 */
export function agilityTravelFactor(team: readonly Pokemon[]): number {
  const agility = teamAxisSum(team, 'agilidade') // 0–100 (já capado em TEAM_ATTR_MAX)
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
 * Rota de deslocamento do time do ginásio até um ponto (PLAN §4.3 — Fly/Surf/Sniper):
 * - Voando (Fly + sozinho / Fly+): liga ginásio→ponto em LINHA RETA (path `[gym, node]`).
 * - Sniper (sozinho): atua do ginásio — distância 0 (instantâneo), ignora o bloqueio de água.
 * - Surfando (Surf + sozinho / Surf+): menor caminho no grafo COMPLETO (água liberada); a
 *   distância usa o bônus de água (arestas de água custam metade → +100% de velocidade).
 * - Senão: menor caminho num grafo SEM os pontos de água (intransponíveis). Destinos só
 *   acessíveis por água ficam inalcançáveis (path `[]`).
 * Devolve as flags (voo/surf — símbolos no mapa), o caminho (animação) e a distância (tempo).
 */
export function travelRoute(
  graph: CityGraph,
  gym: string,
  node: string,
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
): { flying: boolean; surfing: boolean; path: string[]; distance: number } {
  if (teamFlies(team, runItems)) {
    const path = [gym, node]
    return { flying: true, surfing: false, path, distance: pathDistance(graph, path) }
  }
  if (teamSnipes(team)) {
    return { flying: false, surfing: false, path: [gym, node], distance: 0 }
  }
  const surfs = teamSurfs(team, runItems)
  const nav = surfs ? graph : graphWithoutSurf(graph)
  const path = shortestPath(nav, gym, node)
  const surfing = surfs && pathUsesSurf(graph, path)
  const distance = surfing ? surfTravelDistance(graph, path) : pathDistance(nav, path)
  return { flying: false, surfing, path, distance }
}

/**
 * Tempo de execução parado no local pela Inteligência total do time (PLAN §4.3): −1%/ponto,
 * soma capada em 100 → piso de 0,3 (70 de Inteligência reduz 70% do tempo de execução).
 */
export function executionMs(team: readonly Pokemon[], baseExecutionMs: number): number {
  const intelligence = teamAxisSum(team, 'inteligencia') // 0–100 (já capado em TEAM_ATTR_MAX)
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
