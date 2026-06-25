import { describe, expect, it } from 'vitest'
import { makeMon } from './testkit.ts'
import { graphTravelMs } from './missions.ts'
import { SWIFT_SWIM_RAIN_BONUS, HEAT_SLOW_FACTOR } from './balance.ts'
import { weatherTravelMs, instantWeatherSpeed, weatherTravelFraction } from './rainSpeed.ts'
import { teamTravelSpeedMultiplier } from './secretEffects.ts'
import { emptyWeatherSchedule, type WeatherSchedule } from './weather.ts'

// Omanyte (138) par = ['sa-swift-swim','sa-shell-armor']; Swift Swim no slot 0. Mesma espécie sem habilidade = base.
const swimmer = () => makeMon({ speciesId: 138, secretPicks: [{ slot: 0, level: 1 }] })
const plain = () => makeMon({ speciesId: 138, secretPicks: [] })

// Bulbasaur(1) Chlorophyll slot 0; Tentacool(72) Clear Body slot 0; Pidgey(16) sem habilidade.
const chloro = () => makeMon({ speciesId: 1, secretPicks: [{ slot: 0, level: 1 }] })
const clearBody = () => makeMon({ speciesId: 72, secretPicks: [{ slot: 0, level: 1 }] })
const noone = () => makeMon({ speciesId: 16, secretPicks: [] })

const DIST = 100

/** Chuva cobrindo um intervalo [0, endMs] (sem poças — só a janela do evento). */
function rainUntil(endMs: number): WeatherSchedule {
  return {
    rain: [{ startMs: 0, endMs, puddles: [] }],
    storms: [],
    heat: [],
    snow: [], sand: [], forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 0, potentialHeatCount: 0, snowstormChancePercent: 0, potentialSnowstormCount: 0, sandstormChancePercent: 0, potentialSandstormCount: 0 },
  }
}

/** Calor cobrindo [0, endMs]. */
function heatUntil(endMs: number): WeatherSchedule {
  return {
    rain: [], storms: [], heat: [{ startMs: 0, endMs }],
    snow: [], sand: [], forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 100, potentialHeatCount: 1, snowstormChancePercent: 0, potentialSnowstormCount: 0, sandstormChancePercent: 0, potentialSandstormCount: 0 },
  }
}

describe('weatherTravelMs — Swift Swim (regressão)', () => {
  it('sem chuva → idêntico ao tempo linear (graphTravelMs com a base)', () => {
    const team = [swimmer()]
    expect(weatherTravelMs(emptyWeatherSchedule(), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, 1), // base = 1 (HP cheio, sem Fly/Lagging)
    )
  })

  it('time SEM Swift Swim ignora a chuva', () => {
    const team = [plain()]
    expect(weatherTravelMs(rainUntil(1_000_000), 0, DIST, team)).toBeCloseTo(graphTravelMs(DIST, team, 1))
  })

  it('chuva o trajeto todo → velocidade ×3 (1/3 do tempo)', () => {
    const team = [swimmer()]
    expect(weatherTravelMs(rainUntil(1_000_000), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, 1 + SWIFT_SWIM_RAIN_BONUS),
    )
  })

  it('chuva parcial → ×3 enquanto chove, base depois', () => {
    const team = [swimmer()]
    const need = graphTravelMs(DIST, team, 1) // "progresso" total a multiplicador 1
    const rainMs = Math.floor(need / 10) // chuva curta: cabe inteira no início (need > 3·rainMs)
    // Durante a chuva cobre rainMs·3 do progresso; o resto a ×1. Tempo = rainMs + (need − 3·rainMs).
    expect(weatherTravelMs(rainUntil(rainMs), 0, DIST, team)).toBeCloseTo(need - 2 * rainMs)
  })

  it('distância zero → tempo zero (ex.: Sniper)', () => {
    expect(weatherTravelMs(rainUntil(1_000_000), 0, 0, [swimmer()])).toBe(0)
  })

  it('sem chuva com multiplicador base ≠ 1 (Weak Armor) → ainda igual ao linear', () => {
    // Onix (95) par = ['sa-sturdy','sa-weak-armor']; Weak Armor no slot 1. Com HP faltante, base > 1 —
    // o fast-path (sem chuva) deve bater com graphTravelMs usando esse base.
    const team = [makeMon({ speciesId: 95, secretPicks: [{ slot: 1, level: 1 }], maxHp: 10, currentHp: 7 })]
    const baseMult = teamTravelSpeedMultiplier(team, [])
    expect(baseMult).toBeGreaterThan(1) // garante que o caso realmente testa base ≠ 1
    expect(weatherTravelMs(emptyWeatherSchedule(), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, baseMult),
    )
  })
})

describe('weatherTravelMs — Calor', () => {
  it('time normal: calor o trajeto todo → ×0.2 (5× o tempo linear)', () => {
    const team = [noone()]
    const need = graphTravelMs(DIST, team, 1)
    expect(weatherTravelMs(heatUntil(1_000_000), 0, DIST, team)).toBeCloseTo(need / HEAT_SLOW_FACTOR)
  })
  it('imune (Clear Body): calor não afeta → tempo linear', () => {
    const team = [clearBody()]
    expect(weatherTravelMs(heatUntil(1_000_000), 0, DIST, team)).toBeCloseTo(graphTravelMs(DIST, team, 1))
  })
  it('Chlorophyll: imune + bônus → ×(1+2)=×3 (1/3 do tempo)', () => {
    const team = [chloro()]
    expect(weatherTravelMs(heatUntil(1_000_000), 0, DIST, team)).toBeCloseTo(graphTravelMs(DIST, team, 3))
  })
  it('calor parcial (time normal): ×0.2 enquanto quente, base depois', () => {
    const team = [noone()]
    const need = graphTravelMs(DIST, team, 1)
    const hotMs = Math.floor(need / 10) // janela curta no início
    // Durante o calor cobre hotMs·0.2 do progresso; resto a ×1. Tempo = hotMs + (need − 0.2·hotMs).
    expect(weatherTravelMs(heatUntil(hotMs), 0, DIST, team)).toBeCloseTo(need + 0.8 * hotMs)
  })
})

describe('weatherTravelFraction — posição visual sob calor', () => {
  const team = [noone()]
  const need = graphTravelMs(DIST, team, 1)

  it('sem clima → fração linear no tempo', () => {
    expect(weatherTravelFraction(emptyWeatherSchedule(), 0, need, need / 2, team)).toBeCloseTo(0.5)
  })

  it('chega a 1 exatamente na chegada (extremos sincronizados)', () => {
    const hotMs = Math.floor(need / 10)
    const arrive = need + 0.8 * hotMs // = weatherTravelMs(heatUntil(hotMs), ...)
    expect(weatherTravelFraction(heatUntil(hotMs), 0, arrive, 0, team)).toBeCloseTo(0)
    expect(weatherTravelFraction(heatUntil(hotMs), 0, arrive, arrive, team)).toBeCloseTo(1)
  })

  it('a velocidade volta ao normal quando o calor acaba (anda mais depois que durante)', () => {
    const hotMs = Math.floor(need / 10)
    const arrive = need + 0.8 * hotMs
    const dt = Math.floor(hotMs / 2)
    // Progresso de distância numa mesma janela dt: durante o calor (×0.2) vs logo após (×1).
    const duringHeat = weatherTravelFraction(heatUntil(hotMs), 0, arrive, dt, team)
    const afterStart = weatherTravelFraction(heatUntil(hotMs), 0, arrive, hotMs, team)
    const afterEnd = weatherTravelFraction(heatUntil(hotMs), 0, arrive, hotMs + dt, team)
    expect(afterEnd - afterStart).toBeGreaterThan(duringHeat)
  })
})

describe('instantWeatherSpeed', () => {
  it('time normal quente → base × 0.2', () => {
    const team = [noone()]
    expect(instantWeatherSpeed(heatUntil(1000), 500, team)).toBeCloseTo(teamTravelSpeedMultiplier(team, []) * HEAT_SLOW_FACTOR)
  })
  it('fora do calor → base', () => {
    const team = [noone()]
    expect(instantWeatherSpeed(heatUntil(1000), 2000, team)).toBeCloseTo(teamTravelSpeedMultiplier(team, []))
  })
})
