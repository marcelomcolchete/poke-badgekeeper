import { describe, expect, it } from 'vitest'
import { makeMon } from './testkit.ts'
import { graphTravelMs } from './missions.ts'
import { SWIFT_SWIM_RAIN_BONUS } from './balance.ts'
import { rainTravelMs } from './rainSpeed.ts'
import { teamTravelSpeedMultiplier } from './secretEffects.ts'
import { emptyWeatherSchedule, type WeatherSchedule } from './weather.ts'

// Omanyte (138): Swift Swim na posição 1 (sem Surf na linha). Mesma espécie sem habilidade = base.
const swimmer = () => makeMon({ speciesId: 138, secretCount: 1 })
const plain = () => makeMon({ speciesId: 138, secretCount: 0 })
const DIST = 100

/** Chuva cobrindo um intervalo [0, endMs] (sem poças — só a janela do evento). */
function rainUntil(endMs: number): WeatherSchedule {
  return {
    rain: [{ startMs: 0, endMs, puddles: [] }],
    storms: [],
    forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1, stormChancePercent: 0, potentialStormCount: 0 },
  }
}

describe('rainTravelMs', () => {
  it('sem chuva → idêntico ao tempo linear (graphTravelMs com a base)', () => {
    const team = [swimmer()]
    expect(rainTravelMs(emptyWeatherSchedule(), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, 1), // base = 1 (HP cheio, sem Fly/Lagging)
    )
  })

  it('time SEM Swift Swim ignora a chuva', () => {
    const team = [plain()]
    expect(rainTravelMs(rainUntil(1_000_000), 0, DIST, team)).toBeCloseTo(graphTravelMs(DIST, team, 1))
  })

  it('chuva o trajeto todo → velocidade ×3 (1/3 do tempo)', () => {
    const team = [swimmer()]
    expect(rainTravelMs(rainUntil(1_000_000), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, 1 + SWIFT_SWIM_RAIN_BONUS),
    )
  })

  it('chuva parcial → ×3 enquanto chove, base depois', () => {
    const team = [swimmer()]
    const need = graphTravelMs(DIST, team, 1) // "progresso" total a multiplicador 1
    const rainMs = Math.floor(need / 10) // chuva curta: cabe inteira no início (need > 3·rainMs)
    // Durante a chuva cobre rainMs·3 do progresso; o resto a ×1. Tempo = rainMs + (need − 3·rainMs).
    expect(rainTravelMs(rainUntil(rainMs), 0, DIST, team)).toBeCloseTo(need - 2 * rainMs)
  })

  it('distância zero → tempo zero (ex.: Sniper)', () => {
    expect(rainTravelMs(rainUntil(1_000_000), 0, 0, [swimmer()])).toBe(0)
  })

  it('sem chuva com multiplicador base ≠ 1 (Weak Armor) → ainda igual ao linear', () => {
    // Omanyte (138) secretCount 3: tem Swift Swim E Weak Armor. Com HP faltante, base > 1 —
    // o fast-path (sem chuva) deve bater com graphTravelMs usando esse base.
    const team = [makeMon({ speciesId: 138, secretCount: 3, maxHp: 10, currentHp: 7 })]
    const baseMult = teamTravelSpeedMultiplier(team, [])
    expect(baseMult).toBeGreaterThan(1) // garante que o caso realmente testa base ≠ 1
    expect(rainTravelMs(emptyWeatherSchedule(), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, baseMult),
    )
  })
})
