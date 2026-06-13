import { describe, expect, it } from 'vitest'
import { STARS_MAX, STARS_MIN } from './constants.ts'
import {
  applyApproval,
  approvalDelta,
  dailyGoalMet,
  isHired,
  missionGoal,
} from './approval.ts'

describe('missionGoal / dailyGoalMet (PLAN §4.7)', () => {
  it('meta é uma fração das missões, mínimo 1 quando há missões', () => {
    expect(missionGoal(0)).toBe(0)
    expect(missionGoal(1)).toBe(1)
    expect(missionGoal(5)).toBeGreaterThanOrEqual(1)
    expect(missionGoal(5)).toBeLessThanOrEqual(5)
  })

  it('meta cumprida quando completadas ≥ meta', () => {
    const goal = missionGoal(5)
    expect(dailyGoalMet(goal, 5)).toBe(true)
    expect(dailyGoalMet(goal - 1, 5)).toBe(false)
    expect(dailyGoalMet(0, 0)).toBe(true) // sem missões, sem cobrança
  })
})

describe('approvalDelta (PLAN §4.7)', () => {
  it('todas as missões → +1,0', () => {
    expect(approvalDelta(5, 5)).toBe(1)
  })

  it('cumpriu a meta (mas não todas) → +0,5', () => {
    const total = 5
    const goal = missionGoal(total)
    expect(approvalDelta(goal, total)).toBe(0.5)
  })

  it('abaixo da meta → −0,5', () => {
    expect(approvalDelta(0, 5)).toBe(-0.5)
  })

  it('sem missões → 0', () => {
    expect(approvalDelta(0, 0)).toBe(0)
  })
})

describe('applyApproval (PLAN §4.7)', () => {
  it('mantém as estrelas em [1, 5] e em passos de 0,5', () => {
    expect(applyApproval(STARS_MIN, 0, 5)).toBe(STARS_MIN) // não cai abaixo de 1
    expect(applyApproval(STARS_MAX, 5, 5)).toBe(STARS_MAX) // não passa de 5
    const mid = applyApproval(3, missionGoal(5), 5)
    expect(mid).toBe(3.5)
    expect((mid * 2) % 1).toBe(0) // múltiplo de 0,5
  })
})

describe('isHired (PLAN §4.7)', () => {
  it('efetivado apenas com mais de 3 estrelas', () => {
    expect(isHired(3)).toBe(false)
    expect(isHired(3.5)).toBe(true)
    expect(isHired(5)).toBe(true)
  })
})
