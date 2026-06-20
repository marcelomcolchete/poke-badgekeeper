import { describe, expect, it } from 'vitest'
import { DAY_LENGTH_MS, DAY_SEGMENTS, TOTAL_DAYS } from './constants.ts'
import {
  CAPTURE_SPOTS_PER_DAY,
  DAY1_FIRST_MISSION_DELAY_MS,
  MISSIONS_PER_DAY,
  SPAWN_WINDOW_FRACTION,
} from './balance.ts'
import { getCity, nodesForCategory } from '../data/cities.ts'
import { buildDaySchedule, defensesForDay, missionsForDay } from './timeline.ts'

const PEWTER = getCity(0)
const SEGMENT_MS = DAY_LENGTH_MS / DAY_SEGMENTS
/** Maior horário possível de surgimento: início do último momento + janela dele. */
const LATEST_SPAWN = (DAY_SEGMENTS - 1) * SEGMENT_MS + SEGMENT_MS * SPAWN_WINDOW_FRACTION

/** Quantos eventos caem em cada um dos 3 momentos do dia. */
function countsPerSegment(times: number[]): number[] {
  const counts = Array.from({ length: DAY_SEGMENTS }, () => 0)
  for (const at of times) {
    const seg = Math.min(DAY_SEGMENTS - 1, Math.floor(at / SEGMENT_MS))
    counts[seg] = (counts[seg] ?? 0) + 1
  }
  return counts
}

describe('missionsForDay (tabela fixa) e defensesForDay (fórmula ceil(dia/2))', () => {
  it('missões seguem a tabela fixa, igual para todas as cidades', () => {
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      expect(missionsForDay(day)).toBe(MISSIONS_PER_DAY[day - 1])
    }
    expect(missionsForDay(1)).toBe(3)
    expect(missionsForDay(10)).toBe(8)
  })

  it('defesas = ceil(dia/2): dia 10=5, 20=10, 30=15, sem teto', () => {
    expect(defensesForDay(1)).toBe(1)
    expect(defensesForDay(5)).toBe(3)
    expect(defensesForDay(10)).toBe(5)
    expect(defensesForDay(20)).toBe(10)
    expect(defensesForDay(30)).toBe(15)
  })

  it('defesas crescem monotonicamente com o dia', () => {
    for (let day = 2; day <= 40; day++) {
      expect(defensesForDay(day)).toBeGreaterThanOrEqual(defensesForDay(day - 1))
    }
    expect(defensesForDay(40)).toBeGreaterThan(defensesForDay(10))
  })
})

describe('buildDaySchedule (PLAN §3.1/§4.8)', () => {
  it('é determinística para o mesmo seed/dia', () => {
    expect(buildDaySchedule(123, 4, PEWTER)).toEqual(buildDaySchedule(123, 4, PEWTER))
  })

  it('quantidade casa com missionsForDay/defensesForDay', () => {
    const sched = buildDaySchedule(123, 6, PEWTER)
    expect(sched.missions).toHaveLength(missionsForDay(6))
    expect(sched.defenses).toHaveLength(defensesForDay(6))
    expect(sched.day).toBe(6)
  })

  it('spawns ficam na janela do dia, ordenados, em sítios válidos da categoria', () => {
    const sched = buildDaySchedule(7, 9, PEWTER)
    let last = -1
    for (const slot of sched.missions) {
      expect(slot.atMs).toBeGreaterThanOrEqual(0)
      expect(slot.atMs).toBeLessThanOrEqual(LATEST_SPAWN)
      expect(slot.atMs).toBeGreaterThanOrEqual(last) // ordenado
      last = slot.atMs
      const siteCount = nodesForCategory(PEWTER.siteNodes, slot.category).length
      expect(slot.siteIndex).toBeGreaterThanOrEqual(0)
      expect(slot.siteIndex).toBeLessThan(siteCount)
    }
    for (const slot of sched.defenses) {
      expect(slot.atMs).toBeGreaterThanOrEqual(0)
      expect(slot.atMs).toBeLessThanOrEqual(LATEST_SPAWN)
    }
  })

  it('missões e defesas se distribuem igualmente entre os 3 momentos (diferença ≤ 1)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const day of [1, 4, 7, 10]) {
        const sched = buildDaySchedule(seed, day, PEWTER)
        for (const times of [
          sched.missions.map((m) => m.atMs),
          sched.defenses.map((d) => d.atMs),
        ]) {
          const counts = countsPerSegment(times)
          expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('áreas verdes são só captura: nenhuma missão do dia nasce no sítio verde (freeArea)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (let day = 1; day <= TOTAL_DAYS; day++) {
        const cats = buildDaySchedule(seed, day, PEWTER).missions.map((m) => m.category)
        expect(cats).not.toContain('freeArea')
      }
    }
  })

  it('Pokecenter (center) e Pokemart (mart) aparecem no máximo 1×/dia cada', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (let day = 1; day <= TOTAL_DAYS; day++) {
        const cats = buildDaySchedule(seed, day, PEWTER).missions.map((m) => m.category)
        expect(cats.filter((c) => c === 'center').length).toBeLessThanOrEqual(1)
        expect(cats.filter((c) => c === 'mart').length).toBeLessThanOrEqual(1)
      }
    }
  })

  it('captura escolhe CAPTURE_SPOTS_PER_DAY áreas verdes distintas e válidas, com horário', () => {
    const sched = buildDaySchedule(7, 9, PEWTER)
    expect(sched.captureSiteIndices).toHaveLength(CAPTURE_SPOTS_PER_DAY)
    expect(new Set(sched.captureSiteIndices).size).toBe(sched.captureSiteIndices.length)
    expect(sched.captureSpawnsAtMs).toHaveLength(sched.captureSiteIndices.length)
    for (const i of sched.captureSiteIndices) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(PEWTER.siteNodes.green.length)
    }
    for (const at of sched.captureSpawnsAtMs) expect(at).toBeGreaterThanOrEqual(0)
  })

  it('no dia 1 a captura surge no início (0) e a 1ª missão só após o atraso de respiro', () => {
    const sched = buildDaySchedule(7, 1, PEWTER)
    for (const at of sched.captureSpawnsAtMs) expect(at).toBe(0)
    if (sched.missions.length > 0) {
      expect(sched.missions[0]?.atMs).toBeGreaterThanOrEqual(DAY1_FIRST_MISSION_DELAY_MS)
    }
  })

  it('buildDaySchedule não injeta especiais (isso é responsabilidade do setupDay)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (let day = 1; day <= TOTAL_DAYS; day++) {
        const cats = buildDaySchedule(seed, day, PEWTER).missions.map((m) => m.category)
        expect(cats).not.toContain('special')
      }
    }
  })

  it('seeds diferentes geram agendas diferentes (em geral)', () => {
    const a = buildDaySchedule(1, 8, PEWTER)
    const b = buildDaySchedule(2, 8, PEWTER)
    expect(a.missions.map((s) => s.atMs)).not.toEqual(b.missions.map((s) => s.atMs))
  })
})
