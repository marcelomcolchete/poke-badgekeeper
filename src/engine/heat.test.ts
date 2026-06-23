import { describe, expect, it } from 'vitest'
import { getCity } from '../data/cities.ts'
import { DAY_LENGTH_MS } from './constants.ts'
import { HEAT_EVENT_MIN_MS, HEAT_EVENT_MAX_MS, HEAT_GAP_MS } from './balance.ts'
import { buildHeat, heatChanceForDay, maxHeatTimes, isHot, activeHeatAt } from './heat.ts'
import { maxRainTimes } from './weather.ts'

const CELADON = getCity(3)

describe('heat — chance do dia', () => {
  it('Celadon: chance fica em [20+dia, 50] e colapsa no teto quando 20+dia ≥ 50', () => {
    const c = heatChanceForDay(123, 5, 3)
    expect(c).toBeGreaterThanOrEqual(25)
    expect(c).toBeLessThanOrEqual(50)
    expect(heatChanceForDay(123, 40, 3)).toBe(50) // 20+40 ≥ 50 → trava no teto
  })
  it('cidade sem calor → 0', () => {
    expect(heatChanceForDay(123, 5, 1)).toBe(0)
  })
  it('dias < 3 → 0', () => {
    expect(heatChanceForDay(123, 2, 3)).toBe(0)
  })
})

describe('heat — quantidade/curva', () => {
  it('maxHeatTimes espelha a curva da chuva', () => {
    for (const d of [3, 6, 9, 18, 30]) expect(maxHeatTimes(d)).toBe(maxRainTimes(d))
  })
})

describe('heat — buildHeat', () => {
  it('chance 100% (extra) → janelas não-sobrepostas, 30–60s, dentro do dia', () => {
    const events = buildHeat(7, 9, CELADON, 100)
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      const dur = e.endMs - e.startMs
      expect(dur).toBeGreaterThanOrEqual(HEAT_EVENT_MIN_MS)
      expect(dur).toBeLessThanOrEqual(HEAT_EVENT_MAX_MS)
      expect(e.startMs).toBeGreaterThanOrEqual(0)
      expect(e.endMs).toBeLessThanOrEqual(DAY_LENGTH_MS)
    }
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.startMs).toBeGreaterThanOrEqual(events[i - 1]!.endMs + HEAT_GAP_MS)
    }
  })
  it('chance −100% (extra) → nenhuma janela ocorre', () => {
    expect(buildHeat(7, 9, CELADON, -100)).toEqual([])
  })
  it('maxEvents = 0 → cap zero (sem janelas), distinto de "sem cap"', () => {
    expect(buildHeat(7, 9, CELADON, 100, 0)).toEqual([])
  })
  it('determinístico por (seed, dia, cidade)', () => {
    expect(buildHeat(7, 9, CELADON, 100)).toEqual(buildHeat(7, 9, CELADON, 100))
  })
})

describe('heat — isHot/activeHeatAt', () => {
  it('isHot true dentro da janela, false fora', () => {
    const events = [{ startMs: 1000, endMs: 2000 }]
    expect(isHot(events, 1500)).toBe(true)
    expect(isHot(events, 2000)).toBe(false)
    expect(activeHeatAt(events, 1500)).toEqual({ startMs: 1000, endMs: 2000 })
    expect(activeHeatAt(events, 0)).toBeNull()
  })
})
