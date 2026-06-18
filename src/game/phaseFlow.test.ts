import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import type { MissionResultLog } from '../engine/state.ts'
import { finalizeDay } from './phaseFlow.ts'

const FAIL: MissionResultLog = { templateId: 't', success: false, teamIds: [] }
const WIN: MissionResultLog = { templateId: 't', success: true, teamIds: ['a'] }

/** Dia só com missões (sem batalhas): a trilha de batalhas fica intocada (delta 0). */
function dayWith(missionStars: number, results: MissionResultLog[]) {
  const s = createInitialState(1)
  s.run.phase = 'DAY'
  s.approval.missionStars = missionStars
  s.today.missionResults = results
  return s
}

describe('finalizeDay — estrelas de missões e game over (PLAN §4.7)', () => {
  it('1 estrela e meta não batida cai para 0,5 (abaixo da meta, mas ≥ mínima)', () => {
    const s = dayWith(1, [FAIL])
    finalizeDay(s)
    expect(s.approval.missionStars).toBe(0.5)
    expect(s.run.phase).toBe('SUMMARY')
  })

  it('0 estrelas e meta não batida zeraria a trilha → GAMEOVER por estrelas', () => {
    const s = dayWith(0, [FAIL])
    finalizeDay(s)
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.run.gameOverReason).toBe('stars')
    expect(s.approval.missionStars).toBe(0)
  })

  it('0 estrelas mas tudo cumprido sobe e o dia segue para o resumo', () => {
    const s = dayWith(0, [WIN])
    finalizeDay(s)
    expect(s.run.phase).toBe('SUMMARY')
    expect(s.approval.missionStars).toBeGreaterThan(0)
    // Sem batalhas hoje → trilha de batalhas intocada (continua em 1).
    expect(s.approval.battleStars).toBe(1)
  })
})
