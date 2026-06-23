import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { getCity } from '../data/cities.ts'
import { graphWithoutSurf, shortestPath } from '../engine/pathfinding.ts'
import { DAY_LENGTH_MS } from '../engine/constants.ts'
import type { WeatherSchedule } from '../engine/weather.ts'
import { startSearch } from './captureFlow.ts'

const CERULEAN = getCity(1)
const DRY = graphWithoutSurf(CERULEAN.graph)

const rainAllDay: WeatherSchedule = {
  rain: [{ startMs: 0, endMs: DAY_LENGTH_MS, puddles: [] }],
  storms: [],
  heat: [],
  forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 0, potentialHeatCount: 0 },
}

// Área de grama alcançável a pé a partir do ginásio.
const gym = CERULEAN.siteNodes.gym
const spot = Object.keys(CERULEAN.graph.nodes).find((n) => shortestPath(DRY, gym, n).length >= 3)!

// Omanyte (138) par = ['sa-swift-swim','sa-shell-armor']; Swift Swim no slot 0.
function searchState(hasSwiftSwim: boolean) {
  const s = createInitialState(1)
  s.run.cityIndex = 1
  s.weather = rainAllDay
  const mon = createPokemon({ id: 'p1', speciesId: 138 /* Omanyte */, level: 10, rng: createRng(1) })
  s.roster = [{
    ...mon,
    secretPicks: hasSwiftSwim ? [{ slot: 0, level: 1 as const }] : [],
    status: 'idle',
  }]
  s.captureSpots = [spot]
  s.captureSpotSpawnsAtMs = [0]
  return s
}

describe('Swift Swim acelera a exploração sob chuva', () => {
  it('explorador com Swift Swim chega antes na área', () => {
    const withSS = searchState(true)
    startSearch(withSS, 'p1', 0)
    const plain = searchState(false)
    startSearch(plain, 'p1', 0)

    const swiftArrive = withSS.captureSearches[0]!.arriveAtMs
    const plainArrive = plain.captureSearches[0]!.arriveAtMs
    expect(swiftArrive).toBeGreaterThan(0)
    expect(swiftArrive).toBeLessThan(plainArrive)
    expect(swiftArrive).toBeCloseTo(plainArrive / 3, 0)
  })
})
