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
    missionStarsBefore: 2,
    missionStarsAfter: 2.5,
    battleStarsBefore: 1,
    battleStarsAfter: 1.5,
    missionResults: results,
    defensesWon: 1,
    defensesTotal: 2,
    defenseKills: [],
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

  it('MVP é quem somou mais feitos (missões + derrotas)', () => {
    const s = buildDaySummary(baseInput())
    expect(s.mvpId).toBe('a') // 'a' em 2 sucessos, 'b' em 1, 'c' só na falha
    expect(s.mvpMissions).toBe(2)
    expect(s.mvpDefeats).toBe(0)
  })

  it('derrotas em defesa contam para o MVP e desempatam por missões', () => {
    const s = buildDaySummary({
      ...baseInput(),
      // 'b' tem 1 missão; com 3 derrotas soma 4 feitos e ultrapassa 'a' (2 missões).
      defenseKills: [
        { defeaterId: 'b' },
        { defeaterId: 'b' },
        { defeaterId: 'b' },
        { defeaterId: 'a' },
      ],
    })
    expect(s.mvpId).toBe('b')
    expect(s.mvpMissions).toBe(1)
    expect(s.mvpDefeats).toBe(3)
  })

  it('sem missões nem derrotas → MVP null', () => {
    const s = buildDaySummary({
      ...baseInput(),
      missionResults: [{ templateId: 'x', success: false, teamIds: ['z'] }],
      defenseKills: [],
    })
    expect(s.mvpId).toBeNull()
    expect(s.mvpMissions).toBe(0)
    expect(s.mvpDefeats).toBe(0)
    expect(s.missionsCompleted).toBe(0)
  })

  it('preserva as estrelas (missões/batalhas) antes/depois', () => {
    const s = buildDaySummary(baseInput())
    expect(s.missionStarsBefore).toBe(2)
    expect(s.missionStarsAfter).toBe(2.5)
    expect(s.battleStarsBefore).toBe(1)
    expect(s.battleStarsAfter).toBe(1.5)
  })
})

describe('toDayLog', () => {
  it('extrai o registro enxuto do histórico', () => {
    const log = toDayLog(buildDaySummary(baseInput()))
    expect(log).toEqual({
      day: 3,
      missionStarsAfter: 2.5,
      battleStarsAfter: 1.5,
      goldEarned: 250,
      captured: 1,
    })
  })
})
