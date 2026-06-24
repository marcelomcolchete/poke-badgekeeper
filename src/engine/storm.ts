// Núcleo PURO do efeito climático Tempestade (2º efeito, após a Chuva). O schedule é semeado
// (STORM_SEED_SALT) e pré-computado em setupDay, então a presença/área de qualquer raio em
// qualquer instante é FUNÇÃO PURA de `now` (como as poças). A detecção de acerto e a aplicação
// de dano/Paralyze ficam no runtime (game/stormFlow.ts), pois dependem da posição dos Pokémon.
//
// Geometria do raio (ver docs/superpowers/specs/2026-06-19-efeito-tempestade-design.md):
// - raio padrão STRIKE_RADIUS (fração da largura); se o CENTRO já é água, vira único
//   STRIKE_RADIUS_ON_WATER; senão, cada ponto de água DENTRO do primário gera um secundário
//   STRIKE_SECONDARY_RADIUS (sem encadear adiante).

import type { MapPos } from '../types/index.ts'
import type { CityData } from '../data/types.ts'
import { createRng, deriveSeed, type Rng } from './rng.ts'
import { DAY_LENGTH_MS, TOTAL_DAYS, STORM_SEED_SALT, STORM_CHANCE_SALT, MAP_ASPECT_W } from './constants.ts'
import { clamp, lerp } from './math.ts'
import { segmentLength } from './pathfinding.ts'
import { weatherChanceForDay, puddleLevelAt, puddleNodePool, type RainEvent, WEATHER_FIRST_ELIGIBLE_DAY, maxRainTimes } from './weather.ts'
import type { WeatherSchedule } from './weather.ts'
import { buildWeatherSchedule } from './weather.ts'
import { cityHasStorm, cityStormChance, cityHasHeat, cityHasSnow, cityHasSand } from '../data/cityWeather.ts'
import { buildHeat, heatChanceForDay, maxHeatTimes } from './heat.ts'
import { buildSnow, snowChanceForDay, maxSnowTimes } from './snow.ts'
import { buildSand, sandChanceForDay, maxSandTimes } from './sand.ts'
import {
  STRIKE_RADIUS,
  STRIKE_RADIUS_ON_WATER,
  STRIKE_SECONDARY_RADIUS,
  STORM_EVENT_MIN_MS,
  STORM_EVENT_MAX_MS,
  STORM_GAP_MS,
  STRIKE_WARNING_MS,
  STRIKE_MIN_PER_STORM,
} from './balance.ts'

/** Um círculo do efeito do raio: centro (coords normalizadas) + raio (fração da largura). */
export interface StrikeCircle {
  cx: number
  cy: number
  radius: number
}

/** Um raio: aviso (vermelho), impacto (amarelo) e os círculos atingidos no impacto. */
export interface Strike {
  warnAtMs: number
  strikeAtMs: number
  circles: StrikeCircle[]
}

/** Um evento de tempestade: janela [start, end] e os raios que caem nela. */
export interface StormEvent {
  startMs: number
  endMs: number
  strikes: Strike[]
}

/** Um ponto está dentro do círculo? Usa a distância 16:9-corrigida (raio = fração da largura). */
export function pointInCircle(circle: StrikeCircle, p: MapPos): boolean {
  return segmentLength({ x: circle.cx, y: circle.cy }, p) <= circle.radius * MAP_ASPECT_W
}

/** Pontos de água em `nowMs`: surfNodes (fixos) + poças ativas da chuva nesse instante. */
export function waterNodesAt(
  city: CityData,
  rainEvents: readonly RainEvent[],
  nowMs: number,
): Set<string> {
  const water = new Set<string>(city.graph.surfNodes ?? [])
  for (const ev of rainEvents) {
    for (const p of ev.puddles) {
      if (puddleLevelAt(p, nowMs) > 0) water.add(p.node)
    }
  }
  return water
}

// ---- Agendamento da Tempestade ---------------------------------------------------------

/** Teto de tempestades PRÓPRIAS por dia (espelha a chuva): +1 a cada 2 dias, cap 4. */
export function maxStormTimes(day: number): number {
  return maxRainTimes(day) // mesma curva da chuva
}

/** Chance de tempestade (%) do dia na cidade. 0 se dia < 3 ou se a cidade não tem tempestade. */
export function stormChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = cityStormChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, STORM_CHANCE_SALT)
}

/** Quantos raios numa tempestade: escala com o dia (piso STRIKE_MIN_PER_STORM) até ⌊pool/4⌋. */
export function strikeCountForDay(day: number, poolSize: number): number {
  const cap = Math.floor(poolSize / 4)
  if (cap <= 0) return 0
  const progress = clamp((day - WEATHER_FIRST_ELIGIBLE_DAY) / (TOTAL_DAYS - WEATHER_FIRST_ELIGIBLE_DAY), 0, 1)
  return clamp(Math.round(lerp(STRIKE_MIN_PER_STORM, cap, progress)), 0, cap)
}

/** Pontos onde uma poça pode cair — base do cap de raios (andáveis, exceto ginásio/surf/exploração). */
function stormPoolSize(city: CityData): number {
  return puddleNodePool(city).length
}

/** Cria os raios de UMA tempestade [start, end]: count escala com o dia; cada raio sorteia centro/tempo. */
function rollStrikes(
  rng: Rng,
  city: CityData,
  rainEvents: readonly RainEvent[],
  day: number,
  start: number,
  end: number,
): Strike[] {
  const count = strikeCountForDay(day, stormPoolSize(city))
  if (count === 0) return []
  const ids = Object.keys(city.graph.nodes)
  if (ids.length === 0) return []
  const strikes: Strike[] = []
  for (let k = 0; k < count; k++) {
    const center = rng.pick(ids)
    const warnAtMs = rng.int(start, end)
    const strikeAtMs = warnAtMs + STRIKE_WARNING_MS
    strikes.push({ warnAtMs, strikeAtMs, circles: resolveStrikeCircles(center, strikeAtMs, city, rainEvents) })
  }
  strikes.sort((a, b) => a.strikeAtMs - b.strikeAtMs)
  return strikes
}

/**
 * Agenda das tempestades do dia: as PRÓPRIAS (janelas não-sobrepostas, cada uma ocorre por
 * chance) + uma ACOPLADA dentro da janela de cada evento de chuva (poças → água p/ encadear).
 * Reprodutível por (seed, day, city, rainEvents). `extraChancePercent` permite testes/ajustes.
 * `maxTotalStorms` (undefined = sem cap; 0+ = teto do TOTAL de tempestades, próprias + acopladas).
 * Quando ativo, próprias recebem prioridade; acopladas preenchem o restante do orçamento.
 */
export function buildStorms(
  seed: number,
  day: number,
  city: CityData,
  rainEvents: readonly RainEvent[],
  extraChancePercent = 0,
  maxTotalStorms?: number,
): StormEvent[] {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY) return []
  const hasCap = maxTotalStorms !== undefined
  const rng = createRng(deriveSeed(seed, day, STORM_SEED_SALT))
  const chance = clamp(stormChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
  // Quando há cap total, as próprias recebem no máximo maxTotalStorms slots.
  const maxOwnSlots = hasCap ? Math.min(maxStormTimes(day), maxTotalStorms!) : maxStormTimes(day)
  const storms: StormEvent[] = []

  // Próprias: mesma estrutura de janelas da chuva (duração 15–30s, folga STORM_GAP_MS).
  let cursor = 0
  for (let i = 0; i < maxOwnSlots; i++) {
    const remainingAfter = maxOwnSlots - 1 - i
    const duration = rng.int(STORM_EVENT_MIN_MS, STORM_EVENT_MAX_MS)
    const reserve = remainingAfter * (STORM_EVENT_MIN_MS + STORM_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - STORM_GAP_MS - reserve
    if (latestStart < cursor) break
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    if (rng.bool(chance / 100)) {
      storms.push({ startMs: start, endMs: end, strikes: rollStrikes(rng, city, rainEvents, day, start, end) })
    }
    cursor = end + STORM_GAP_MS
  }

  // Acopladas: uma tempestade DENTRO da janela de cada chuva (15–30s, encaixada).
  // Quando há cap total, respeitamos o orçamento restante (próprias têm precedência).
  for (const rain of rainEvents) {
    if (hasCap && storms.length >= maxTotalStorms!) break
    const window = rain.endMs - rain.startMs
    const duration = Math.min(rng.int(STORM_EVENT_MIN_MS, STORM_EVENT_MAX_MS), window)
    const latestStart = Math.max(rain.startMs, rain.endMs - duration)
    const start = rng.int(rain.startMs, latestStart)
    const end = start + duration
    storms.push({ startMs: start, endMs: end, strikes: rollStrikes(rng, city, rainEvents, day, start, end) })
  }

  storms.sort((a, b) => a.startMs - b.startMs)
  return storms
}

/** Tempestade ATIVA em `nowMs`, ou null. */
export function activeStormAt(storms: readonly StormEvent[], nowMs: number): StormEvent | null {
  for (const s of storms) if (nowMs >= s.startMs && nowMs < s.endMs) return s
  return null
}

/** Está em tempestade em `nowMs`? (selo/efeitos seguem isto.) */
export function isStorming(storms: readonly StormEvent[], nowMs: number): boolean {
  return activeStormAt(storms, nowMs) !== null
}

// ---- Derivações de runtime -------------------------------------------------------------

export type StrikePhase = 'warning' | 'striking'

/** Quanto tempo o círculo amarelo do impacto fica visível (animação) após cair. */
const STRIKE_FLASH_MS = 600

/** Círculos visíveis em `nowMs`: em aviso (vermelho) ou no flash do impacto (amarelo). */
export function activeStrikeCirclesAt(
  storms: readonly StormEvent[],
  nowMs: number,
): { phase: StrikePhase; circles: StrikeCircle[] }[] {
  const out: { phase: StrikePhase; circles: StrikeCircle[] }[] = []
  for (const storm of storms) {
    for (const strike of storm.strikes) {
      if (nowMs >= strike.warnAtMs && nowMs < strike.strikeAtMs) {
        out.push({ phase: 'warning', circles: strike.circles })
      } else if (nowMs >= strike.strikeAtMs && nowMs < strike.strikeAtMs + STRIKE_FLASH_MS) {
        out.push({ phase: 'striking', circles: strike.circles })
      }
    }
  }
  return out
}

/** Raios cujo impacto cai em (prevMs, nowMs] — robusto a saltos grandes de tempo (x3/aba oculta). */
export function strikesResolvingBetween(
  storms: readonly StormEvent[],
  prevMs: number,
  nowMs: number,
): Strike[] {
  const out: Strike[] = []
  for (const storm of storms) {
    for (const strike of storm.strikes) {
      if (strike.strikeAtMs > prevMs && strike.strikeAtMs <= nowMs) out.push(strike)
    }
  }
  return out
}

/**
 * Schedule climático completo do dia (chuva + tempestade + calor), reprodutível por (seed, day, city).
 * A tempestade só entra se a cidade a tem; o calor só entra se a cidade o tem.
 * Orçamento (Own Tempo): chuva → tempestade → calor.
 *
 * @param extraRainChancePercent - pp delta aplicado à chance de chuva (positivo = mais chuva).
 * @param extraStormChancePercent - pp delta aplicado à chance de tempestade (negativo = menos).
 * @param extraHeatChancePercent - pp delta aplicado à chance de calor.
 * @param maxWeatherEvents - teto de eventos climáticos TOTAIS do dia (Own Tempo). Se informado (>0),
 *   as chuvas recebem slots primeiro até o limite; as tempestades usam o restante; o calor usa
 *   o restante após chuva+tempestade. 0 = sem cap.
 */
export function buildDayWeather(
  seed: number,
  day: number,
  city: CityData,
  extraRainChancePercent = 0,
  extraStormChancePercent = 0,
  extraHeatChancePercent = 0,
  extraSnowChancePercent = 0,
  extraSandChancePercent = 0,
  maxWeatherEvents = 0,
): WeatherSchedule {
  // Orçamento (Own Tempo) — precedência: chuva → tempestade → calor → nevasca → areia.
  // Cada efeito recebe o teto restante após os anteriores (undefined = sem cap; número = cap, 0 ok).
  const cap = (used: number): number | undefined =>
    maxWeatherEvents > 0 ? Math.max(0, maxWeatherEvents - used) : undefined

  let w = buildWeatherSchedule(seed, day, city, extraRainChancePercent, maxWeatherEvents > 0 ? maxWeatherEvents : 0)

  if (cityHasStorm(city.index)) {
    const storms = buildStorms(seed, day, city, w.rain, extraStormChancePercent, cap(w.rain.length))
    w = {
      ...w,
      storms,
      forecast: {
        ...w.forecast,
        stormChancePercent: clamp(stormChanceForDay(seed, day, city.index) + extraStormChancePercent, 0, 100),
        potentialStormCount: maxStormTimes(day),
      },
    }
  }

  if (cityHasHeat(city.index)) {
    const heat = buildHeat(seed, day, city, extraHeatChancePercent, cap(w.rain.length + w.storms.length))
    w = {
      ...w,
      heat,
      forecast: {
        ...w.forecast,
        heatChancePercent: clamp(heatChanceForDay(seed, day, city.index) + extraHeatChancePercent, 0, 100),
        potentialHeatCount: maxHeatTimes(day),
      },
    }
  }

  if (cityHasSnow(city.index)) {
    const snow = buildSnow(seed, day, city, extraSnowChancePercent, cap(w.rain.length + w.storms.length + w.heat.length))
    w = {
      ...w,
      snow,
      forecast: {
        ...w.forecast,
        snowstormChancePercent: clamp(snowChanceForDay(seed, day, city.index) + extraSnowChancePercent, 0, 100),
        potentialSnowstormCount: maxSnowTimes(day),
      },
    }
  }

  if (cityHasSand(city.index)) {
    const sand = buildSand(seed, day, city, extraSandChancePercent, cap(w.rain.length + w.storms.length + w.heat.length + w.snow.length))
    w = {
      ...w,
      sand,
      forecast: {
        ...w.forecast,
        sandstormChancePercent: clamp(sandChanceForDay(seed, day, city.index) + extraSandChancePercent, 0, 100),
        potentialSandstormCount: maxSandTimes(day),
      },
    }
  }

  return w
}

// ---- Geometria do raio -----------------------------------------------------------------

/**
 * Círculos de UM raio centrado em `center`, no instante `strikeAtMs`:
 * - centro é água → único STRIKE_RADIUS_ON_WATER;
 * - senão → primário STRIKE_RADIUS + um secundário STRIKE_SECONDARY_RADIUS por ponto de água
 *   dentro do primário (sem encadear adiante).
 */
export function resolveStrikeCircles(
  center: string,
  strikeAtMs: number,
  city: CityData,
  rainEvents: readonly RainEvent[],
): StrikeCircle[] {
  const pos = city.graph.nodes[center]
  if (!pos) return []
  const water = waterNodesAt(city, rainEvents, strikeAtMs)
  if (water.has(center)) {
    return [{ cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS_ON_WATER }]
  }
  const primary: StrikeCircle = { cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS }
  const circles: StrikeCircle[] = [primary]
  for (const node of water) {
    const wp = city.graph.nodes[node]
    if (wp && pointInCircle(primary, wp)) {
      circles.push({ cx: wp.x, cy: wp.y, radius: STRIKE_SECONDARY_RADIUS })
    }
  }
  return circles
}
