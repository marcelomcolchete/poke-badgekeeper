import { describe, expect, it } from 'vitest'
import type { MissionResultLog } from './daySummary.ts'
import { buildDaySummary, toDayLog } from './daySummary.ts'
import { makeAttrs, makeMon } from './testkit.ts'

const results: MissionResultLog[] = [
  { templateId: 'patrol', success: true, teamIds: ['a', 'b'] },
  { templateId: 'rescue', success: true, teamIds: ['a'] },
  { templateId: 'brawl', success: false, teamIds: ['c'] },
]

function baseInput() {
  const alive = makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }) })
  const downed = makeMon({ id: 'c', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 0, status: 'fainted' })
  return {
    day: 3,
    starsBefore: 2,
    starsAfter: 2.5,
    missionResults: results,
    defensesWon: 1,
    defensesTotal: 2,
    goldEarned: 250,
    capturedIds: ['new1'],
    roster: [alive, downed],
  }
}

describe('buildDaySummary', () => {
  it('conta missões, defesas, capturas e baixas', () => {
    const s = buildDaySummary(baseInput())
    expect(s.missionsCompleted).toBe(2)
    expect(s.missionsFailed).toBe(1)
    expect(s.missionsTotal).toBe(3)
    expect(s.defensesWon).toBe(1)
    expect(s.defensesTotal).toBe(2)
    expect(s.captured).toBe(1)
    expect(s.fainted).toBe(1)
    expect(s.available).toBe(1)
  })

  it('MVP é quem concluiu mais missões (só conta sucesso)', () => {
    const s = buildDaySummary(baseInput())
    expect(s.mvpId).toBe('a') // 'a' em 2 sucessos, 'b' em 1, 'c' só na falha
    expect(s.mvpMissions).toBe(2)
  })

  it('sem missões concluídas → MVP null', () => {
    const s = buildDaySummary({
      ...baseInput(),
      missionResults: [{ templateId: 'x', success: false, teamIds: ['z'] }],
    })
    expect(s.mvpId).toBeNull()
    expect(s.mvpMissions).toBe(0)
    expect(s.missionsCompleted).toBe(0)
  })

  it('preserva as estrelas antes/depois', () => {
    const s = buildDaySummary(baseInput())
    expect(s.starsBefore).toBe(2)
    expect(s.starsAfter).toBe(2.5)
  })
})

describe('toDayLog', () => {
  it('extrai o registro enxuto do histórico', () => {
    const log = toDayLog(buildDaySummary(baseInput()))
    expect(log).toEqual({ day: 3, starsAfter: 2.5, goldEarned: 250, captured: 1 })
  })
})
