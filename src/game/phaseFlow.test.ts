import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import type { MissionResultLog } from '../engine/state.ts'
import { finalizeDay } from './phaseFlow.ts'

const FAIL: MissionResultLog = { templateId: 't', success: false, teamIds: [] }
const WIN: MissionResultLog = { templateId: 't', success: true, teamIds: ['a'] }

function dayWith(stars: number, results: MissionResultLog[]) {
  const s = createInitialState(1)
  s.run.phase = 'DAY'
  s.approval.stars = stars
  s.today.missionResults = results
  return s
}

describe('finalizeDay — estrelas e game over (PLAN §4.7)', () => {
  it('1 estrela e meta não batida cai para 0,5 (não trava no mínimo)', () => {
    const s = dayWith(1, [FAIL])
    finalizeDay(s)
    expect(s.approval.stars).toBe(0.5)
    expect(s.run.phase).toBe('SUMMARY')
  })

  it('0 estrelas e meta não batida encerra a run (GAMEOVER por estrelas)', () => {
    const s = dayWith(0, [FAIL])
    finalizeDay(s)
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.run.gameOverReason).toBe('stars')
    expect(s.approval.stars).toBe(0)
  })

  it('0 estrelas mas meta batida sobe e o dia segue para o resumo', () => {
    const s = dayWith(0, [WIN])
    finalizeDay(s)
    expect(s.run.phase).toBe('SUMMARY')
    expect(s.approval.stars).toBeGreaterThan(0)
  })
})
