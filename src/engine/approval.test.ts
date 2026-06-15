import { describe, expect, it } from 'vitest'
import { STARS_MAX, STARS_MIN } from './constants.ts'
import type { DailyProgress } from './approval.ts'
import {
  applyApproval,
  approvalDelta,
  battleGoal,
  dailyGoal,
  dailyGoalMet,
  dailyPerfect,
  isHired,
  missionGoal,
} from './approval.ts'

/** Atalho para montar um progresso do dia (defaults: nada a cobrar). */
function progress(p: Partial<DailyProgress>): DailyProgress {
  return {
    missionsCompleted: 0,
    missionsTotal: 0,
    battlesWon: 0,
    battlesTotal: 0,
    ...p,
  }
}

describe('dailyGoal / missionGoal / battleGoal (PLAN §4.7)', () => {
  it('meta é uma fração do total, mínimo 1 quando há itens', () => {
    expect(dailyGoal(0)).toBe(0)
    expect(dailyGoal(1)).toBe(1)
    expect(dailyGoal(5)).toBeGreaterThanOrEqual(1)
    expect(dailyGoal(5)).toBeLessThanOrEqual(5)
  })

  it('missões e batalhas compartilham a mesma curva de meta', () => {
    expect(missionGoal(5)).toBe(battleGoal(5))
    expect(missionGoal(4)).toBe(dailyGoal(4))
  })
})

describe('dailyGoalMet — exige AMBAS as metas (PLAN §4.7)', () => {
  it('cumprida só quando missões E batalhas batem a meta', () => {
    const mg = missionGoal(4)
    const bg = battleGoal(4)
    expect(dailyGoalMet(progress({ missionsCompleted: mg, missionsTotal: 4, battlesWon: bg, battlesTotal: 4 }))).toBe(true)
    // missões batidas, batalhas não → não cumprida
    expect(dailyGoalMet(progress({ missionsCompleted: mg, missionsTotal: 4, battlesWon: 0, battlesTotal: 4 }))).toBe(false)
    // batalhas batidas, missões não → não cumprida
    expect(dailyGoalMet(progress({ missionsCompleted: 0, missionsTotal: 4, battlesWon: bg, battlesTotal: 4 }))).toBe(false)
  })

  it('domínio sem itens é cumprido de graça', () => {
    expect(dailyGoalMet(progress({}))).toBe(true) // nada a fazer
    expect(dailyGoalMet(progress({ missionsCompleted: missionGoal(4), missionsTotal: 4 }))).toBe(true) // só missões
  })
})

describe('dailyPerfect — exige 100% nas DUAS frentes (PLAN §4.7)', () => {
  it('perfeito só com todas as missões E todas as batalhas', () => {
    expect(dailyPerfect(progress({ missionsCompleted: 4, missionsTotal: 4, battlesWon: 3, battlesTotal: 3 }))).toBe(true)
    expect(dailyPerfect(progress({ missionsCompleted: 4, missionsTotal: 4, battlesWon: 2, battlesTotal: 3 }))).toBe(false)
    expect(dailyPerfect(progress({ missionsCompleted: 3, missionsTotal: 4, battlesWon: 3, battlesTotal: 3 }))).toBe(false)
  })
})

describe('approvalDelta (PLAN §4.7)', () => {
  it('tudo 100% nas duas frentes → +1,0', () => {
    expect(approvalDelta(progress({ missionsCompleted: 5, missionsTotal: 5, battlesWon: 2, battlesTotal: 2 }))).toBe(1)
  })

  it('ambas as metas batidas (mas não tudo) → +0,5', () => {
    const mg = missionGoal(5)
    const bg = battleGoal(5)
    // metas batidas sem 100% em nenhuma das duas
    expect(approvalDelta(progress({ missionsCompleted: mg, missionsTotal: 5, battlesWon: bg, battlesTotal: 5 }))).toBe(0.5)
  })

  it('100% nas missões mas batalhas só na meta → ainda +0,5 (não perfeito)', () => {
    const bg = battleGoal(5)
    expect(approvalDelta(progress({ missionsCompleted: 5, missionsTotal: 5, battlesWon: bg, battlesTotal: 5 }))).toBe(0.5)
  })

  it('faltou bater alguma meta → −0,5', () => {
    expect(approvalDelta(progress({ missionsCompleted: 0, missionsTotal: 5 }))).toBe(-0.5)
    // missões ok, batalhas abaixo da meta
    expect(approvalDelta(progress({ missionsCompleted: 5, missionsTotal: 5, battlesWon: 0, battlesTotal: 5 }))).toBe(-0.5)
  })

  it('sem missões e sem batalhas → 0', () => {
    expect(approvalDelta(progress({}))).toBe(0)
  })
})

describe('applyApproval (PLAN §4.7)', () => {
  it('mantém as estrelas em [0, 5] e em passos de 0,5', () => {
    expect(applyApproval(STARS_MIN, progress({ missionsCompleted: 0, missionsTotal: 5 }))).toBe(STARS_MIN) // não cai abaixo de 0
    expect(applyApproval(STARS_MAX, progress({ missionsCompleted: 5, missionsTotal: 5 }))).toBe(STARS_MAX) // não passa de 5
    const mid = applyApproval(3, progress({ missionsCompleted: missionGoal(5), missionsTotal: 5 }))
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
