// Núcleo PURO da Tempestade de areia (Sandstorm, 5º efeito). A agenda é só janelas (como o Calor);
// o desvio por "ponto perdido" é resolvido no runtime (game/sandFlow.ts). Semeada por SAND_SEED_SALT.

import type { CityData, CityGraph } from '../data/types.ts'
import type { Pokemon } from '../types/index.ts'
import { createRng, deriveSeed, type Rng } from './rng.ts'
import { DAY_LENGTH_MS, SAND_SEED_SALT, SAND_CHANCE_SALT } from './constants.ts'
import { SAND_EVENT_MIN_MS, SAND_EVENT_MAX_MS, SAND_GAP_MS } from './balance.ts'
import { clamp } from './math.ts'
import { weatherChanceForDay, maxRainTimes, WEATHER_FIRST_ELIGIBLE_DAY } from './weather.ts'
import { cityHasSand, citySandChance } from '../data/cityWeather.ts'
import { shortestPath } from './pathfinding.ts'

/** Uma janela de tempestade de areia: intervalo [startMs, endMs]. */
export interface SandEvent {
  startMs: number
  endMs: number
}

/** Teto de janelas de areia por dia: espelha a curva da chuva. */
export function maxSandTimes(day: number): number {
  return maxRainTimes(day)
}

/** Chance de areia (%) do dia na cidade. 0 se dia < 3 ou se a cidade não tem o efeito. */
export function sandChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = citySandChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, SAND_CHANCE_SALT)
}

/**
 * Janelas de areia do dia (não-sobrepostas, duração 30–60s, folga SAND_GAP_MS), cada uma ocorrendo
 * por sorteio vs a chance do dia. RNG próprio (SAND_SEED_SALT) — não toca o cursor da run.
 */
export function buildSand(
  seed: number,
  day: number,
  city: CityData,
  extraChancePercent = 0,
  maxEvents?: number,
): SandEvent[] {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY || !cityHasSand(city.index)) return []
  const hasCap = maxEvents !== undefined
  const chance = clamp(sandChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
  const maxTimes = hasCap ? Math.min(maxSandTimes(day), maxEvents!) : maxSandTimes(day)
  const rng = createRng(deriveSeed(seed, day, SAND_SEED_SALT))
  const events: SandEvent[] = []
  let cursor = 0
  for (let i = 0; i < maxTimes; i++) {
    const remainingAfter = maxTimes - 1 - i
    const duration = rng.int(SAND_EVENT_MIN_MS, SAND_EVENT_MAX_MS)
    const reserve = remainingAfter * (SAND_EVENT_MIN_MS + SAND_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - SAND_GAP_MS - reserve
    if (latestStart < cursor) break
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    if (rng.bool(chance / 100)) events.push({ startMs: start, endMs: end })
    cursor = end + SAND_GAP_MS
  }
  return events
}

/** Janela de areia ATIVA em `now`, ou null. */
export function activeSandAt(events: readonly SandEvent[], now: number): SandEvent | null {
  for (const e of events) if (now >= e.startMs && now < e.endMs) return e
  return null
}

/** Há tempestade de areia em `now`? (selo/efeitos/som seguem isto.) */
export function isSanding(events: readonly SandEvent[], now: number): boolean {
  return activeSandAt(events, now) !== null
}

/**
 * Sorteia um nó "perdido" andável e alcançável a partir de `originNode`, `≠ origem` e `≠ destino`.
 * Alcançável = `shortestPath(origin→node)` não-vazio no grafo dado (já filtrado pelo chamador para
 * o time — water edges entram só quando o time surfa). Para voadores o chamador interpola retas
 * entre origem→perdido→destino (Fly ignora arestas), mas o ponto perdido continua sendo um nó
 * concreto do mapa. Determinístico: usa o `rng` passado. Retorna null se não houver candidato.
 */
export function pickLostNode(
  rng: Rng,
  graph: CityGraph,
  originNode: string,
  destNode: string,
  _team: readonly Pokemon[],
  _runItems: readonly string[],
): string | null {
  const candidates = Object.keys(graph.nodes).filter(
    (n) => n !== originNode && n !== destNode && shortestPath(graph, originNode, n).length > 0,
  )
  if (candidates.length === 0) return null
  return rng.pick(candidates)
}
