// Núcleo PURO do efeito climático Calor (3º efeito, após Chuva e Tempestade). A agenda é semeada
// (HEAT_SEED_SALT) e pré-computada em setupDay, então a presença de calor em qualquer instante é
// FUNÇÃO PURA de `now`. O efeito (−80% de velocidade de viagem) vive no integrador weatherTravelMs
// (engine/rainSpeed.ts), que aplica o degrau sobre as janelas de calor.

import type { CityData } from '../data/types.ts'
import { createRng, deriveSeed } from './rng.ts'
import { DAY_LENGTH_MS, HEAT_SEED_SALT, HEAT_CHANCE_SALT } from './constants.ts'
import { HEAT_EVENT_MIN_MS, HEAT_EVENT_MAX_MS, HEAT_GAP_MS } from './balance.ts'
import { clamp } from './math.ts'
import { weatherChanceForDay, maxRainTimes, WEATHER_FIRST_ELIGIBLE_DAY } from './weather.ts'
import type { HeatEvent } from './weather.ts'
import { cityHasHeat, cityHeatChance } from '../data/cityWeather.ts'

/** Teto de janelas de calor por dia: espelha a curva da chuva. */
export function maxHeatTimes(day: number): number {
  return maxRainTimes(day)
}

/** Chance de calor (%) do dia na cidade. 0 se dia < 3 ou se a cidade não tem calor. */
export function heatChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = cityHeatChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, HEAT_CHANCE_SALT)
}

/**
 * Janelas de calor do dia (não-sobrepostas, duração 30–60s, folga HEAT_GAP_MS), cada uma ocorrendo
 * por sorteio vs a chance do dia. RNG próprio (HEAT_SEED_SALT) — não toca o cursor da run.
 * `maxEvents` undefined = sem cap; número = cap do TOTAL de janelas (0 permitido → nenhuma).
 */
export function buildHeat(
  seed: number,
  day: number,
  city: CityData,
  extraChancePercent = 0,
  maxEvents?: number,
): HeatEvent[] {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY || !cityHasHeat(city.index)) return []
  const hasCap = maxEvents !== undefined
  const chance = clamp(heatChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
  const maxTimes = hasCap ? Math.min(maxHeatTimes(day), maxEvents!) : maxHeatTimes(day)
  const rng = createRng(deriveSeed(seed, day, HEAT_SEED_SALT))
  const events: HeatEvent[] = []
  let cursor = 0
  for (let i = 0; i < maxTimes; i++) {
    const remainingAfter = maxTimes - 1 - i
    const duration = rng.int(HEAT_EVENT_MIN_MS, HEAT_EVENT_MAX_MS)
    const reserve = remainingAfter * (HEAT_EVENT_MIN_MS + HEAT_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - HEAT_GAP_MS - reserve
    if (latestStart < cursor) break
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    if (rng.bool(chance / 100)) events.push({ startMs: start, endMs: end })
    cursor = end + HEAT_GAP_MS
  }
  return events
}

/** Janela de calor ATIVA em `now`, ou null. */
export function activeHeatAt(events: readonly HeatEvent[], now: number): HeatEvent | null {
  for (const e of events) if (now >= e.startMs && now < e.endMs) return e
  return null
}

/** Está quente em `now`? (selo/efeitos/som seguem isto.) */
export function isHot(events: readonly HeatEvent[], now: number): boolean {
  return activeHeatAt(events, now) !== null
}
