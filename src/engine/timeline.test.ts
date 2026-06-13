import { describe, expect, it } from 'vitest'
import { DAY_LENGTH_MS, TOTAL_DAYS } from './constants.ts'
import { CAPTURE_SPOTS_PER_DAY, SPAWN_WINDOW_FRACTION } from './balance.ts'
import { getCity, sitesForCategory } from '../data/cities.ts'
import {
  buildDaySchedule,
  countForDay,
  defensesForDay,
  missionsForDay,
  museumDay,
} from './timeline.ts'

const PEWTER = getCity(0)
const VIRIDIAN = getCity(7) // maior fatorCidade

/** Nº esperado de missões: base do dia + 1 se hoje for o dia do museu da cidade. */
function expectedMissionCount(seed: number, day: number, city: typeof PEWTER): number {
  const extra = city.museumMissionId && museumDay(seed) === day ? 1 : 0
  return missionsForDay(day, city) + extra
}

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
    expect(sched.missions).toHaveLength(expectedMissionCount(123, 6, PEWTER))
    expect(sched.defenses).toHaveLength(defensesForDay(6, PEWTER))
    expect(sched.day).toBe(6)
  })

  it('spawns ficam na janela do dia, ordenados, em sítios válidos da categoria', () => {
    const window = DAY_LENGTH_MS * SPAWN_WINDOW_FRACTION
    const sched = buildDaySchedule(7, 9, PEWTER)
    let last = -1
    for (const slot of sched.missions) {
      expect(slot.atMs).toBeGreaterThanOrEqual(0)
      expect(slot.atMs).toBeLessThan(window)
      expect(slot.atMs).toBeGreaterThanOrEqual(last) // ordenado
      last = slot.atMs
      const siteCount = sitesForCategory(PEWTER.sites, slot.category).length
      expect(slot.siteIndex).toBeGreaterThanOrEqual(0)
      expect(slot.siteIndex).toBeLessThan(siteCount)
    }
    for (const slot of sched.defenses) {
      expect(slot.atMs).toBeGreaterThanOrEqual(0)
      expect(slot.atMs).toBeLessThan(window)
    }
  })

  it('captura escolhe 2 áreas verdes distintas e válidas', () => {
    const sched = buildDaySchedule(7, 9, PEWTER)
    expect(sched.captureSiteIndices).toHaveLength(CAPTURE_SPOTS_PER_DAY)
    expect(new Set(sched.captureSiteIndices).size).toBe(sched.captureSiteIndices.length)
    for (const i of sched.captureSiteIndices) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(PEWTER.sites.green.length)
    }
  })

  it('missão do museu surge só no dia semeado, com o template da cidade', () => {
    const mDay = museumDay(99)
    const onDay = buildDaySchedule(99, mDay, PEWTER).missions
    const museumMissions = onDay.filter((m) => m.category === 'museum')
    expect(museumMissions).toHaveLength(1)
    expect(museumMissions[0]?.templateId).toBe(PEWTER.museumMissionId)
    // Num dia diferente, não há missão de museu.
    const other = mDay === TOTAL_DAYS ? mDay - 1 : mDay + 1
    expect(buildDaySchedule(99, other, PEWTER).missions.some((m) => m.category === 'museum')).toBe(
      false,
    )
  })

  it('seeds diferentes geram agendas diferentes (em geral)', () => {
    const a = buildDaySchedule(1, 8, PEWTER)
    const b = buildDaySchedule(2, 8, PEWTER)
    expect(a.missions.map((s) => s.atMs)).not.toEqual(b.missions.map((s) => s.atMs))
  })
})
