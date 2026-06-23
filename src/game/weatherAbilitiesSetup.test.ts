// TDD tests for Cloud Nine (revised), Overcoat, Own Tempo weather effects (Phase 4, Task 5).
// Cloud Nine: +10pp rain / −10pp storm per holder (L1); +20pp / −20pp (L2). Accumulates.
// Overcoat: −10pp (L1) / −20pp (L2) to ANY weather (rain AND storm). Accumulates.
// Own Tempo: caps weather events to 2 (L1) / 1 (L2). Non-stacking: strictest (lowest) cap.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { setupDay } from './setup.ts'
import { buildDayWeather, stormChanceForDay } from '../engine/storm.ts'
import { getCity } from '../data/cities.ts'

/** Estado em Cerulean (dia 7) com um roster dado, pronto para setupDay. */
function dayState(mons: ReturnType<typeof createPokemon>[]) {
  const s = createInitialState(123)
  s.run.cityIndex = 1 // Cerulean (has rain)
  s.run.day = 7
  s.roster = mons
  return s
}

/** Estado em Vermilion (dia 7) com um roster dado, pronto para setupDay. */
function stormDayState(mons: ReturnType<typeof createPokemon>[]) {
  const s = createInitialState(123)
  s.run.cityIndex = 2 // Vermilion (has storm)
  s.run.day = 7
  s.roster = mons
  return s
}

/** Creates a pokemon with specific secret picks by species */
function monWith(id: string, speciesId: number, slot: 0 | 1, level: 1 | 2): ReturnType<typeof createPokemon> {
  return {
    ...createPokemon({ id, speciesId, level: 5, rng: createRng(1) }),
    secretPicks: [{ slot, level }],
  }
}

/** Psyduck (54): pair = ['sa-surf','sa-cloud-nine']. Cloud Nine at slot 1. */
function cloudNineMon(id: string, level: 1 | 2 = 1) {
  return monWith(id, 54, 1, level)
}

/** Shellder (90): pair = ['sa-shell-armor','sa-overcoat']. Overcoat at slot 1. */
function overcoatMon(id: string, level: 1 | 2 = 1) {
  return monWith(id, 90, 1, level)
}

/** Slowpoke (79): pair = ['sa-regenerator','sa-own-tempo']. Own Tempo at slot 1. */
function ownTempoMon(id: string, level: 1 | 2 = 1) {
  return monWith(id, 79, 1, level)
}

/** Rattata (19): no secret abilities relevant to weather. */
function plainMon(id: string) {
  return createPokemon({ id, speciesId: 19, level: 5, rng: createRng(1) })
}

// ---- Cloud Nine (revised) ---------------------------------------------------------------

describe('Cloud Nine — rain +pp / storm −pp (setup)', () => {
  it('L1 holder: rain chance +10pp vs baseline', () => {
    const noCN = dayState([plainMon('p1')])
    setupDay(noCN)
    const cn = dayState([cloudNineMon('p1', 1)])
    setupDay(cn)
    const expected = Math.min(100, noCN.weather.forecast.rainChancePercent + 10)
    expect(cn.weather.forecast.rainChancePercent).toBe(expected)
  })

  it('L2 holder: rain chance +20pp vs baseline', () => {
    const noCN = dayState([plainMon('p1')])
    setupDay(noCN)
    const cn = dayState([cloudNineMon('p1', 2)])
    setupDay(cn)
    const expected = Math.min(100, noCN.weather.forecast.rainChancePercent + 20)
    expect(cn.weather.forecast.rainChancePercent).toBe(expected)
  })

  it('2 L1 holders: rain +20pp (accumulates)', () => {
    const noCN = dayState([plainMon('p1')])
    setupDay(noCN)
    const two = dayState([cloudNineMon('p1', 1), cloudNineMon('p2', 1)])
    setupDay(two)
    const expected = Math.min(100, noCN.weather.forecast.rainChancePercent + 20)
    expect(two.weather.forecast.rainChancePercent).toBe(expected)
  })

  it('L1 holder: storm chance −10pp vs baseline in Vermilion', () => {
    const seed = 123
    const day = 7
    const baseStorm = stormChanceForDay(seed, day, 2)
    const noOC = stormDayState([plainMon('p1')])
    setupDay(noOC)
    const cn = stormDayState([cloudNineMon('p1', 1)])
    setupDay(cn)
    const expected = Math.max(0, Math.min(100, baseStorm - 10))
    expect(cn.weather.forecast.stormChancePercent).toBe(expected)
  })

  it('L2 holder: storm chance −20pp in Vermilion', () => {
    const seed = 123
    const day = 7
    const baseStorm = stormChanceForDay(seed, day, 2)
    const cn = stormDayState([cloudNineMon('p1', 2)])
    setupDay(cn)
    const expected = Math.max(0, Math.min(100, baseStorm - 20))
    expect(cn.weather.forecast.stormChancePercent).toBe(expected)
  })
})

describe('Cloud Nine — via buildDayWeather directly', () => {
  it('rainDelta +10 applied, stormDelta −10 applied (L1)', () => {
    const city = getCity(2) // Vermilion
    const seed = 777
    const day = 8
    const base = buildDayWeather(seed, day, city, 0, 0)
    const withCN = buildDayWeather(seed, day, city, 10, -10)
    expect(withCN.forecast.rainChancePercent).toBe(Math.min(100, base.forecast.rainChancePercent + 10))
    expect(withCN.forecast.stormChancePercent).toBe(Math.max(0, base.forecast.stormChancePercent - 10))
  })
})

// ---- Overcoat ---------------------------------------------------------------------------

describe('Overcoat — −pp to rain AND storm', () => {
  it('L1 holder: rain chance −10pp in Cerulean', () => {
    const noCN = dayState([plainMon('p1')])
    setupDay(noCN)
    const oc = dayState([overcoatMon('p1', 1)])
    setupDay(oc)
    const expected = Math.max(0, noCN.weather.forecast.rainChancePercent - 10)
    expect(oc.weather.forecast.rainChancePercent).toBe(expected)
  })

  it('L2 holder: rain chance −20pp', () => {
    const noCN = dayState([plainMon('p1')])
    setupDay(noCN)
    const oc = dayState([overcoatMon('p1', 2)])
    setupDay(oc)
    const expected = Math.max(0, noCN.weather.forecast.rainChancePercent - 20)
    expect(oc.weather.forecast.rainChancePercent).toBe(expected)
  })

  it('2 L1 holders: rain −20pp (accumulates)', () => {
    const noCN = dayState([plainMon('p1')])
    setupDay(noCN)
    const two = dayState([overcoatMon('p1', 1), overcoatMon('p2', 1)])
    setupDay(two)
    const expected = Math.max(0, noCN.weather.forecast.rainChancePercent - 20)
    expect(two.weather.forecast.rainChancePercent).toBe(expected)
  })

  it('L1 holder: storm chance −10pp in Vermilion', () => {
    const seed = 123
    const day = 7
    const baseStorm = stormChanceForDay(seed, day, 2)
    const noOC = stormDayState([plainMon('p1')])
    setupDay(noOC)
    const oc = stormDayState([overcoatMon('p1', 1)])
    setupDay(oc)
    const expected = Math.max(0, Math.min(100, baseStorm - 10))
    expect(oc.weather.forecast.stormChancePercent).toBe(expected)
  })

  it('L2 holder: storm chance −20pp in Vermilion', () => {
    const seed = 123
    const day = 7
    const baseStorm = stormChanceForDay(seed, day, 2)
    const oc = stormDayState([overcoatMon('p1', 2)])
    setupDay(oc)
    const expected = Math.max(0, Math.min(100, baseStorm - 20))
    expect(oc.weather.forecast.stormChancePercent).toBe(expected)
  })
})

// ---- Own Tempo — event cap --------------------------------------------------------------

describe('Own Tempo — event cap (non-stacking)', () => {
  it('L1 holder: at most 2 weather events total (rain+storm) in Vermilion day 9', () => {
    // Day 9: maxRainTimes=3, maxStormTimes=3 without cap
    const s = stormDayState([ownTempoMon('p1', 1)])
    s.run.day = 9
    setupDay(s)
    const totalEvents = s.weather.rain.length + s.weather.storms.length
    expect(totalEvents).toBeLessThanOrEqual(2)
  })

  it('L2 holder: at most 1 weather event total (rain+storm) in Vermilion day 9', () => {
    const s = stormDayState([ownTempoMon('p1', 2)])
    s.run.day = 9
    setupDay(s)
    const totalEvents = s.weather.rain.length + s.weather.storms.length
    expect(totalEvents).toBeLessThanOrEqual(1)
  })

  it('L1 + L2 holders: non-stacking — uses strictest (L2 → cap 1)', () => {
    const s = stormDayState([ownTempoMon('p1', 1), ownTempoMon('p2', 2)])
    s.run.day = 9
    setupDay(s)
    const totalEvents = s.weather.rain.length + s.weather.storms.length
    expect(totalEvents).toBeLessThanOrEqual(1)
  })

  it('no Own Tempo: events not artificially capped (can have up to maxRainTimes+maxStormTimes)', () => {
    // Just checks that buildDayWeather without cap can produce more events on the right seed
    // Uses multiple seeds to find one that has > 2 events
    const city = getCity(2) // Vermilion
    let foundMultiple = false
    for (let seed = 100; seed < 200; seed++) {
      const w = buildDayWeather(seed, 9, city, 0, 0)
      if (w.rain.length + w.storms.length > 2) {
        foundMultiple = true
        break
      }
    }
    expect(foundMultiple).toBe(true)
  })
})

// ---- buildDayWeather signature checks ---------------------------------------------------

describe('buildDayWeather with deltas and cap', () => {
  it('is deterministic with new params', () => {
    const city = getCity(2)
    const a = buildDayWeather(42, 8, city, 10, -10, 2)
    const b = buildDayWeather(42, 8, city, 10, -10, 2)
    expect(a).toEqual(b)
  })

  it('maxWeatherEvents=1 caps total rain+storm to 1', () => {
    const city = getCity(2) // Vermilion
    // Try many seeds to ensure the cap actually works
    for (let seed = 1; seed <= 20; seed++) {
      const w = buildDayWeather(seed, 9, city, 0, 0, 1)
      expect(w.rain.length + w.storms.length).toBeLessThanOrEqual(1)
    }
  })

  it('maxWeatherEvents=2 caps total rain+storm to 2', () => {
    const city = getCity(2)
    for (let seed = 1; seed <= 20; seed++) {
      const w = buildDayWeather(seed, 9, city, 0, 0, 2)
      expect(w.rain.length + w.storms.length).toBeLessThanOrEqual(2)
    }
  })
})
