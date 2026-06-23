// Tempo de viagem PURO sob clima — generaliza chuva (Swift Swim acelera) e Calor (slowdown −80%,
// salvo imunes; Chlorophyll acelera). O tempo de uma perna é a integral de uma velocidade em DEGRAU
// sobre a UNIÃO das janelas de chuva e calor. Sem efeito relevante → tempo linear de graphTravelMs.

import type { Pokemon } from '../types/index.ts'
import { SWIFT_SWIM_RAIN_BONUS, HEAT_SLOW_FACTOR } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import {
  teamHasSwiftSwim,
  teamTravelSpeedMultiplier,
  teamImmuneToHeat,
  teamHeatSpeedBonus,
} from './secretEffects.ts'
import type { WeatherSchedule } from './weather.ts'

/** Trecho de velocidade constante a partir de `start` até `end`, com flags de chuva/calor. */
interface SpeedSegment {
  start: number
  end: number
  raining: boolean
  hot: boolean
}

/** Bordas da união das janelas de chuva e calor (≥ startMs), com flags por trecho + cauda base infinita. */
function speedSegments(schedule: WeatherSchedule, startMs: number): SpeedSegment[] {
  const bounds = new Set<number>([startMs])
  for (const ev of schedule.rain) {
    if (ev.endMs > startMs) { bounds.add(Math.max(ev.startMs, startMs)); bounds.add(ev.endMs) }
  }
  for (const ev of schedule.heat) {
    if (ev.endMs > startMs) { bounds.add(Math.max(ev.startMs, startMs)); bounds.add(ev.endMs) }
  }
  const sorted = [...bounds].filter((b) => b >= startMs).sort((a, b) => a - b)
  const segs: SpeedSegment[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!
    const end = sorted[i + 1]!
    const mid = (start + end) / 2
    segs.push({
      start,
      end,
      raining: schedule.rain.some((ev) => mid >= ev.startMs && mid < ev.endMs),
      hot: schedule.heat.some((ev) => mid >= ev.startMs && mid < ev.endMs),
    })
  }
  const tail = sorted.length > 0 ? sorted[sorted.length - 1]! : startMs
  segs.push({ start: tail, end: Number.POSITIVE_INFINITY, raining: false, hot: false })
  return segs
}

/** Velocidade INSTANTÂNEA do time em `nowMs` (base × fator calor + bônus chlorophyll + bônus swift swim). */
export function instantWeatherSpeed(
  schedule: WeatherSchedule,
  nowMs: number,
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
  electrified?: Record<string, 1 | 2>,
): number {
  const base = teamTravelSpeedMultiplier(team, runItems, electrified)
  const hot = schedule.heat.some((ev) => nowMs >= ev.startMs && nowMs < ev.endMs)
  const raining = schedule.rain.some((ev) => nowMs >= ev.startMs && nowMs < ev.endMs)
  const immune = teamImmuneToHeat(team)
  const rate =
    base * (hot && !immune ? HEAT_SLOW_FACTOR : 1) +
    (hot ? teamHeatSpeedBonus(team) : 0) +
    (raining && teamHasSwiftSwim(team) ? SWIFT_SWIM_RAIN_BONUS : 0)
  return Math.max(rate, 0.0001)
}

/**
 * Duração (ms de jogo) de uma perna de `distance` começando em `startMs`, integrando o clima
 * (Swift Swim na chuva, slowdown/Chlorophyll no calor). Sem efeito relevante → tempo linear.
 */
export function weatherTravelMs(
  schedule: WeatherSchedule,
  startMs: number,
  distance: number,
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
  electrified?: Record<string, 1 | 2>,
): number {
  const baseMult = teamTravelSpeedMultiplier(team, runItems, electrified)
  const need = graphTravelMs(distance, team, 1)
  if (need <= 0) return 0
  const swiftActive = teamHasSwiftSwim(team) && schedule.rain.length > 0
  const immune = teamImmuneToHeat(team)
  const heatBonus = teamHeatSpeedBonus(team)
  const heatActive = schedule.heat.length > 0 && (!immune || heatBonus > 0)
  if (!swiftActive && !heatActive) {
    return need / Math.max(baseMult, 0.0001)
  }
  let remaining = need
  for (const seg of speedSegments(schedule, startMs)) {
    const heatFactor = seg.hot && !immune ? HEAT_SLOW_FACTOR : 1
    const rate = Math.max(
      baseMult * heatFactor +
        (seg.hot ? heatBonus : 0) +
        (seg.raining && teamHasSwiftSwim(team) ? SWIFT_SWIM_RAIN_BONUS : 0),
      0.0001,
    )
    const capacity = (seg.end - seg.start) * rate
    if (capacity >= remaining) return seg.start - startMs + remaining / rate
    remaining -= capacity
  }
  return need / Math.max(baseMult, 0.0001)
}
