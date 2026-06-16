// Núcleo PURO dos efeitos climáticos (1º efeito: Chuva). Tudo é semeado por
// deriveSeed(seed, …, WEATHER_SEED_SALT) e pré-computado no início do dia (setupDay), então a
// presença de qualquer poça em qualquer instante é uma FUNÇÃO PURA de `now` — o que mantém o
// replaneja/espera das missões determinístico e barato (ver game/missionFlow.ts).
//
// Modelo da chuva (Cerulean):
// - Cada dia tem uma % de CHANCE (somando ~400% nos dias 3–10, variada e reproduzível).
// - maxTimes(dia) chuvas POTENCIAIS são agendadas em janelas que não se sobrepõem; cada uma
//   OCORRE se um sorteio vs a chance do dia passar. Dias 1 e 2 nunca têm clima.
// - Cada chuva dura 30–50s e cria 1–3 poças em segundos aleatórios. A poça nasce nível 1 e
//   cresce +1 a cada 10s de chuva (cap 3). Ao acabar a chuva ela seca (1s/3s/5s por nível) e some.
//   Enquanto seca, ainda BLOQUEIA (funciona como ponto de água até desaparecer).

import type { CityData } from '../data/types.ts'
import { createRng, deriveSeed, type Rng } from './rng.ts'
import { DAY_LENGTH_MS, TOTAL_DAYS, WEATHER_SEED_SALT } from './constants.ts'
import { cityHasRain } from '../data/cityWeather.ts'
import { clamp } from './math.ts'

// ---- Constantes estruturais da chuva ---------------------------------------------------

/** Primeiro dia em que pode haver clima (dias 1 e 2 nunca têm). */
export const WEATHER_FIRST_ELIGIBLE_DAY = 3
/** Orçamento de chance somado entre os 8 dias elegíveis (3–10). */
export const RAIN_CHANCE_TOTAL_PERCENT = 400
/** Duração de um evento de chuva (ms de jogo). */
export const RAIN_EVENT_MIN_MS = 30_000
export const RAIN_EVENT_MAX_MS = 50_000
/** Folga mínima entre o fim de uma chuva e o início da próxima (nunca chove duas vezes ao mesmo tempo). */
export const RAIN_GAP_MS = 4_000
/** Quantidade de poças por evento de chuva. */
export const PUDDLES_PER_EVENT_MIN = 1
export const PUDDLES_PER_EVENT_MAX = 3
/** Níveis da poça (pequeno/médio/grande). */
export const PUDDLE_LEVEL_MIN = 1
export const PUDDLE_LEVEL_MAX = 3
/** A cada 10s de chuva a poça sobe um nível. */
export const PUDDLE_GROW_INTERVAL_MS = 10_000
/** Tempo de secagem após a chuva acabar, por nível [_, pequeno, médio, grande] (ms). */
export const PUDDLE_DRY_MS_BY_LEVEL = [0, 1_000, 3_000, 5_000] as const

// ---- Tipos do schedule -----------------------------------------------------------------

/** Uma poça concreta: ponto, quando surge, fim do evento (para o nível travar) e quando seca de vez. */
export interface PuddleSpec {
  /** Ponto do grafo onde a poça caiu (andável, ≠ ginásio, fora dos surfNodes). */
  node: string
  /** Instante (ms de jogo) em que a poça surge = começa a bloquear. */
  startMs: number
  /** Fim do evento de chuva — daqui em diante o nível trava e a poça começa a secar. */
  eventEndMs: number
  /** Instante em que a poça seca de vez e some (= eventEndMs + secagem do nível final). */
  endMs: number
}

/** Um evento de chuva: janela [startMs, endMs] e as poças que ele cria. */
export interface RainEvent {
  startMs: number
  endMs: number
  puddles: PuddleSpec[]
}

/** Previsão do dia exibida na manhã (acima do mercado). */
export interface WeatherForecast {
  /** Chance de chuva do dia (0–100). */
  rainChancePercent: number
  /** Quantidade de chuva em mm/h (cosmético, derivado da chance). 0 se sem chuva possível. */
  rainMmPerHour: number
  /** Quantas chuvas PODEM cair hoje (0–4). */
  potentialRainCount: number
}

/** Agenda climática do dia, pré-computada em setupDay e guardada em s.weather. */
export interface WeatherSchedule {
  /** Eventos de chuva que de fato ocorrem hoje (ordenados por startMs). Vazio se não chove. */
  rain: RainEvent[]
  forecast: WeatherForecast
}

/** Schedule vazio (dias 1–2, cidades sem clima, estado inicial e migração de save). */
export function emptyWeatherSchedule(): WeatherSchedule {
  return { rain: [], forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0 } }
}

// ---- Tabelas determinísticas -----------------------------------------------------------

/** Teto de chuvas potenciais por dia. */
export const RAIN_MAX_TIMES_CAP = 4

/** Quantas chuvas potenciais no dia: +1 a cada 2 dias, capado em 4 (dia 3-4→1 … 9-10→4). */
export function maxRainTimes(day: number): number {
  return clamp(Math.floor((day - 1) / 2), 0, RAIN_MAX_TIMES_CAP)
}

/**
 * Chance de chuva (%) de cada dia elegível (3–10), com pesos sorteados na MESMA stream da run
 * (estável e variada), normalizados para somar ~200% e limitados a [0,100]. Dias < 3 → 0.
 */
export function rainChanceForDay(seed: number, day: number): number {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY) return 0
  const rng = createRng(deriveSeed(seed, WEATHER_SEED_SALT))
  const firstDay = WEATHER_FIRST_ELIGIBLE_DAY
  const lastDay = TOTAL_DAYS
  const span = lastDay - firstDay + 1
  // Pesos em [0.5, 1.5] garantem variedade sem extremos; normalizados para o orçamento total.
  const weights = Array.from({ length: span }, () => 0.5 + rng.next())
  const sum = weights.reduce((a, b) => a + b, 0)
  const idx = day - firstDay
  const raw = (weights[idx] ?? 0) * (RAIN_CHANCE_TOTAL_PERCENT / sum)
  return clamp(Math.round(raw), 0, 100)
}

// ---- Geração da agenda ------------------------------------------------------------------

/** Pontos onde poças podem cair: andáveis, exceto o ginásio, os surfNodes e os nós de exploração (g3x). */
function puddleNodePool(city: CityData): string[] {
  const surf = new Set(city.graph.surfNodes ?? [])
  const gym = city.siteNodes.gym
  return Object.keys(city.graph.nodes).filter(
    (id) => id !== gym && !surf.has(id) && !/^g\d/.test(id),
  )
}

/** Nível da poça no fim do evento (trava o tamanho da secagem). */
function levelAtRainEnd(spec: PuddleSpec): number {
  return clamp(
    PUDDLE_LEVEL_MIN + Math.floor((spec.eventEndMs - spec.startMs) / PUDDLE_GROW_INTERVAL_MS),
    PUDDLE_LEVEL_MIN,
    PUDDLE_LEVEL_MAX,
  )
}

/** Cria as 1–3 poças de um evento de chuva [start, end]. */
function rollPuddles(rng: Rng, pool: string[], start: number, end: number): PuddleSpec[] {
  if (pool.length === 0) return []
  const count = rng.int(PUDDLES_PER_EVENT_MIN, PUDDLES_PER_EVENT_MAX)
  const puddles: PuddleSpec[] = []
  for (let k = 0; k < count; k++) {
    const node = rng.pick(pool)
    const startMs = rng.int(start, end)
    const spec: PuddleSpec = { node, startMs, eventEndMs: end, endMs: end }
    spec.endMs = end + PUDDLE_DRY_MS_BY_LEVEL[levelAtRainEnd(spec)]!
    puddles.push(spec)
  }
  return puddles
}

/**
 * Agenda climática completa do dia, reprodutível por (seed, day, cidade). Usa RNG PRÓPRIO
 * (WEATHER_SEED_SALT) — não toca o cursor de RNG da run (missões/captura/defesa intactas).
 */
export function buildWeatherSchedule(seed: number, day: number, city: CityData): WeatherSchedule {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY || !cityHasRain(city.index)) {
    return emptyWeatherSchedule()
  }
  const chance = rainChanceForDay(seed, day)
  const maxTimes = maxRainTimes(day)
  const forecast: WeatherForecast = {
    rainChancePercent: chance,
    rainMmPerHour: chance === 0 ? 0 : Math.round(20 + (chance / 100) * 10),
    potentialRainCount: maxTimes,
  }

  const rng = createRng(deriveSeed(seed, day, WEATHER_SEED_SALT))
  const pool = puddleNodePool(city)
  const rain: RainEvent[] = []
  let cursor = 0
  for (let i = 0; i < maxTimes; i++) {
    const remainingAfter = maxTimes - 1 - i
    const duration = rng.int(RAIN_EVENT_MIN_MS, RAIN_EVENT_MAX_MS)
    // Reserva espaço mínimo para as chuvas seguintes (cada uma precisa de MIN + GAP).
    const reserve = remainingAfter * (RAIN_EVENT_MIN_MS + RAIN_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - RAIN_GAP_MS - reserve
    if (latestStart < cursor) break // não cabe mais nenhuma chuva no dia
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    const occurs = rng.bool(chance / 100)
    if (occurs) rain.push({ startMs: start, endMs: end, puddles: rollPuddles(rng, pool, start, end) })
    cursor = end + RAIN_GAP_MS
  }
  rain.sort((a, b) => a.startMs - b.startMs)
  return { rain, forecast }
}

// ---- Derivações puras (consumidas pela UI e pelo missionFlow) --------------------------

/** Evento de chuva ATIVO em `nowMs` (a chuva em si, ignorando a secagem das poças), ou null. */
export function activeRainEvent(schedule: WeatherSchedule, nowMs: number): RainEvent | null {
  for (const ev of schedule.rain) {
    if (nowMs >= ev.startMs && nowMs < ev.endMs) return ev
  }
  return null
}

/** Está chovendo em `nowMs`? (Som e selo seguem isto.) */
export function isRaining(schedule: WeatherSchedule, nowMs: number): boolean {
  return activeRainEvent(schedule, nowMs) !== null
}

/** Nível (1–3) da poça em `nowMs`, ou 0 se ainda não surgiu / já secou. */
export function puddleLevelAt(spec: PuddleSpec, nowMs: number): number {
  if (nowMs < spec.startMs || nowMs >= spec.endMs) return 0
  const elapsedRef = nowMs <= spec.eventEndMs ? nowMs : spec.eventEndMs
  return clamp(
    PUDDLE_LEVEL_MIN + Math.floor((elapsedRef - spec.startMs) / PUDDLE_GROW_INTERVAL_MS),
    PUDDLE_LEVEL_MIN,
    PUDDLE_LEVEL_MAX,
  )
}

/** Conjunto de pontos INTRANSPONÍVEIS por quem não surfa em `nowMs` (poças ativas). */
export function blockedNodesAt(schedule: WeatherSchedule, nowMs: number): Set<string> {
  const blocked = new Set<string>()
  for (const ev of schedule.rain) {
    for (const p of ev.puddles) {
      if (puddleLevelAt(p, nowMs) > 0) blocked.add(p.node)
    }
  }
  return blocked
}

/** Poças visíveis em `nowMs` (para a sobreposição do mapa): ponto + nível atual. */
export function activePuddlesAt(schedule: WeatherSchedule, nowMs: number): { node: string; level: number }[] {
  const out: { node: string; level: number }[] = []
  for (const ev of schedule.rain) {
    for (const p of ev.puddles) {
      const level = puddleLevelAt(p, nowMs)
      if (level > 0) out.push({ node: p.node, level })
    }
  }
  return out
}
