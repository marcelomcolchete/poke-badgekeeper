// Tempo de viagem PURO sob chuva. O Swift Swim dá +200% de velocidade (×3) ENQUANTO chove.
// Como a agenda de chuva do dia é determinística e conhecida no despacho, o tempo de uma perna é
// a integral de uma velocidade em DEGRAU (base fora da chuva, base+bônus durante) sobre as janelas
// de chuva. Quem não tem Swift Swim no time — ou em dia/cidade sem chuva — cai no tempo linear de
// graphTravelMs (a integral vira uma reta). A integral do multiplicador ao longo do tempo deve
// igualar o "progresso necessário" = graphTravelMs(distance, team, 1).

import type { Pokemon } from '../types/index.ts'
import { SWIFT_SWIM_RAIN_BONUS } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import { teamHasSwiftSwim, teamTravelSpeedMultiplier } from './secretEffects.ts'
import type { WeatherSchedule } from './weather.ts'

/** Trecho de velocidade constante a partir de `start` até `end` (chovendo ou não). */
interface SpeedSegment {
  start: number
  end: number
  raining: boolean
}

/** Segmentos de velocidade constante a partir de `startMs` (rain já é ordenado e sem sobreposição). */
function speedSegments(schedule: WeatherSchedule, startMs: number): SpeedSegment[] {
  const segs: SpeedSegment[] = []
  let cursor = startMs
  for (const ev of schedule.rain) {
    if (ev.endMs <= startMs) continue
    const rainStart = Math.max(ev.startMs, startMs)
    if (rainStart > cursor) segs.push({ start: cursor, end: rainStart, raining: false })
    segs.push({ start: rainStart, end: ev.endMs, raining: true })
    cursor = ev.endMs
  }
  // Cauda seca "infinita": garante que o laço sempre consome o progresso restante.
  segs.push({ start: cursor, end: Number.POSITIVE_INFINITY, raining: false })
  return segs
}

/**
 * Duração (ms de jogo) de uma perna de `distance` começando em `startMs`, considerando o Swift
 * Swim do time durante a chuva. Sem swimmer ou sem chuva → idêntico a graphTravelMs(distance,
 * team, baseMult) (linear).
 * @param electrified Pokémon eletrizados (Volt Absorb) — id → nível; afeta o multiplicador base.
 */
export function rainTravelMs(
  schedule: WeatherSchedule,
  startMs: number,
  distance: number,
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
  electrified?: Record<string, 1 | 2>,
): number {
  const baseMult = teamTravelSpeedMultiplier(team, runItems, electrified)
  const need = graphTravelMs(distance, team, 1) // progresso total a multiplicador 1
  if (need <= 0) return 0
  // Sem swimmer ou sem chuva → tempo linear. (Chuvas totalmente no passado também caem no
  // laço abaixo e retornam o mesmo: speedSegments só gera a cauda seca a partir de startMs.)
  if (!teamHasSwiftSwim(team) || schedule.rain.length === 0) {
    return need / Math.max(baseMult, 0.0001)
  }
  let remaining = need
  for (const seg of speedSegments(schedule, startMs)) {
    const rate = Math.max(baseMult + (seg.raining ? SWIFT_SWIM_RAIN_BONUS : 0), 0.0001)
    const capacity = (seg.end - seg.start) * rate // Infinity no trecho seco final
    if (capacity >= remaining) return seg.start - startMs + remaining / rate
    remaining -= capacity
  }
  return need / Math.max(baseMult, 0.0001) // inalcançável (cauda infinita); satisfaz o tipo
}
