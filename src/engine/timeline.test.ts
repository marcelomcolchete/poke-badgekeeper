import { describe, expect, it } from 'vitest'
import { DAY_LENGTH_MS, TOTAL_DAYS } from './constants.ts'
import { SPAWN_WINDOW_FRACTION } from './balance.ts'
import { getCity } from '../data/cities.ts'
import {
  buildDaySchedule,
  countForDay,
  defensesForDay,
  missionsForDay,
} from './timeline.ts'

const PEWTER = getCity(0)
const VIRIDIAN = getCity(7) // maior fatorCidade

describe('countForDay (PLAN §4.8)', () => {
  it('interpola min→max ao longo dos dias (não decrescente)', () => {
    let prev = -1
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const n = countForDay(day, 3, 8, 1)
      expect(n).toBeGreaterThanOrEqual(prev)
      prev = n
    }
    expect(countForDay(1, 3, 8, 1)).toBe(3)
    expect(countForDay(TOTAL_DAYS, 3, 8, 1)).toBe(8)
  })

  it('fatorCidade aumenta a contagem', () => {
    expect(missionsForDay(TOTAL_DAYS, VIRIDIAN)).toBeGreaterThan(missionsForDay(TOTAL_DAYS, PEWTER))
  })

  it('mais perto do dia 10 = mais missões e mais defesas', () => {
    expect(missionsForDay(10, PEWTER)).toBeGreaterThan(missionsForDay(1, PEWTER))
    expect(defensesForDay(10, PEWTER)).toBeGreaterThanOrEqual(defensesForDay(1, PEWTER))
  })
})

describe('buildDaySchedule (PLAN §3.1/§4.8)', () => {
  it('é determinística para o mesmo seed/dia', () => {
    expect(buildDaySchedule(123, 4, PEWTER)).toEqual(buildDaySchedule(123, 4, PEWTER))
  })

  it('quantidade casa com missionsForDay/defensesForDay', () => {
    const sched = buildDaySchedule(123, 6, PEWTER)
    expect(sched.missions).toHaveLength(missionsForDay(6, PEWTER))
    expect(sched.defenses).toHaveLength(defensesForDay(6, PEWTER))
    expect(sched.day).toBe(6)
  })

  it('spawns ficam na janela do dia, ordenados, com âncoras válidas', () => {
    const window = DAY_LENGTH_MS * SPAWN_WINDOW_FRACTION
    const sched = buildDaySchedule(7, 9, PEWTER)
    const anchorCount = PEWTER.missionAnchors.length
    let last = -1
    for (const slot of sched.missions) {
      expect(slot.atMs).toBeGreaterThanOrEqual(0)
      expect(slot.atMs).toBeLessThan(window)
      expect(slot.atMs).toBeGreaterThanOrEqual(last) // ordenado
      last = slot.atMs
      expect(slot.anchorIndex).toBeGreaterThanOrEqual(0)
      expect(slot.anchorIndex).toBeLessThan(anchorCount)
    }
    for (const slot of sched.defenses) {
      expect(slot.anchorIndex).toBe(0) // defesa surge no ginásio
    }
  })

  it('seeds diferentes geram agendas diferentes (em geral)', () => {
    const a = buildDaySchedule(1, 8, PEWTER)
    const b = buildDaySchedule(2, 8, PEWTER)
    expect(a.missions.map((s) => s.atMs)).not.toEqual(b.missions.map((s) => s.atMs))
  })
})
