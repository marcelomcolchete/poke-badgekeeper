// Núcleo PURO da Nevasca (Snowstorm, 4º efeito). A agenda é só janelas (como o Calor) — toda a
// mecânica de stacks/freeze/dano vive no runtime (game/snowFlow.ts). Semeada por SNOW_SEED_SALT,
// pré-computada em setupDay; a presença de nevasca em qualquer instante é função pura de `now`.

import type { CityData } from '../data/types.ts'
import { createRng, deriveSeed } from './rng.ts'
import { DAY_LENGTH_MS, SNOW_SEED_SALT, SNOW_CHANCE_SALT } from './constants.ts'
import { SNOW_EVENT_MIN_MS, SNOW_EVENT_MAX_MS, SNOW_GAP_MS } from './balance.ts'
import { clamp } from './math.ts'
import { weatherChanceForDay, maxRainTimes, WEATHER_FIRST_ELIGIBLE_DAY } from './weather.ts'
import { cityHasSnow, citySnowChance } from '../data/cityWeather.ts'

/** Uma janela de nevasca: intervalo [startMs, endMs] (sem sub-objetos). */
export interface SnowEvent {
  startMs: number
  endMs: number
}

/** Teto de janelas de nevasca por dia: espelha a curva da chuva. */
export function maxSnowTimes(day: number): number {
  return maxRainTimes(day)
}

/** Chance de nevasca (%) do dia na cidade. 0 se dia < 3 ou se a cidade não tem nevasca. */
export function snowChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = citySnowChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, SNOW_CHANCE_SALT)
}

/**
 * Janelas de nevasca do dia (não-sobrepostas, duração 40–70s, folga SNOW_GAP_MS), cada uma
 * ocorrendo por sorteio vs a chance do dia. RNG próprio (SNOW_SEED_SALT) — não toca o cursor da run.
 * `maxEvents` undefined = sem cap; número = cap do TOTAL de janelas (0 permitido → nenhuma).
 */
export function buildSnow(
  seed: number,
  day: number,
  city: CityData,
  extraChancePercent = 0,
  maxEvents?: number,
): SnowEvent[] {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY || !cityHasSnow(city.index)) return []
  const hasCap = maxEvents !== undefined
  const chance = clamp(snowChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
  const maxTimes = hasCap ? Math.min(maxSnowTimes(day), maxEvents!) : maxSnowTimes(day)
  const rng = createRng(deriveSeed(seed, day, SNOW_SEED_SALT))
  const events: SnowEvent[] = []
  let cursor = 0
  for (let i = 0; i < maxTimes; i++) {
    const remainingAfter = maxTimes - 1 - i
    const duration = rng.int(SNOW_EVENT_MIN_MS, SNOW_EVENT_MAX_MS)
    const reserve = remainingAfter * (SNOW_EVENT_MIN_MS + SNOW_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - SNOW_GAP_MS - reserve
    if (latestStart < cursor) break
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    if (rng.bool(chance / 100)) events.push({ startMs: start, endMs: end })
    cursor = end + SNOW_GAP_MS
  }
  return events
}

/** Janela de nevasca ATIVA em `now`, ou null. */
export function activeSnowAt(events: readonly SnowEvent[], now: number): SnowEvent | null {
  for (const e of events) if (now >= e.startMs && now < e.endMs) return e
  return null
}

/** Está nevando em `now`? (selo/efeitos/som seguem isto.) */
export function isSnowing(events: readonly SnowEvent[], now: number): boolean {
  return activeSnowAt(events, now) !== null
}

/**
 * Soma dos ms em (fromMs, toMs] que caem dentro de alguma janela de nevasca. Robusto a saltos
 * grandes de tempo (x3/aba oculta): o runtime usa isto para acumular a exposição que gera os stacks.
 */
export function snowExposureMs(events: readonly SnowEvent[], fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0
  let total = 0
  for (const e of events) {
    const lo = Math.max(fromMs, e.startMs)
    const hi = Math.min(toMs, e.endMs)
    if (hi > lo) total += hi - lo
  }
  return total
}

/** Fim (endMs) da janela de nevasca ativa em `now`, ou null se não há nevasca ativa. */
export function snowWindowEndAt(events: readonly SnowEvent[], now: number): number | null {
  const e = activeSnowAt(events, now)
  return e ? e.endMs : null
}
