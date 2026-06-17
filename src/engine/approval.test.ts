import { describe, expect, it } from 'vitest'
import { STARS_MAX, STARS_MIN } from './constants.ts'
import type { DailyProgress } from './approval.ts'
import {
  applyDomainStars,
  averageStars,
  battleGoal,
  battleStarDelta,
  dailyGoal,
  dailyGoalMet,
  dailyPerfect,
  domainStarDelta,
  isHired,
  minGoal,
  missionGoal,
  missionStarDelta,
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

describe('dailyGoal / missionGoal / battleGoal', () => {
  it('meta é metade do total (arredonda p/ cima), mínimo 1 quando há itens', () => {
    expect(dailyGoal(0)).toBe(0)
    expect(dailyGoal(1)).toBe(1)
    expect(dailyGoal(4)).toBe(2)
    expect(dailyGoal(5)).toBe(3)
  })

  it('missões e batalhas compartilham a mesma curva', () => {
    expect(missionGoal(5)).toBe(battleGoal(5))
    expect(missionGoal(4)).toBe(dailyGoal(4))
  })
})

describe('minGoal — meta mínima é ¼ do total (floor, pode ser 0)', () => {
  it('floor(total/4)', () => {
    expect(minGoal(0)).toBe(0)
    expect(minGoal(3)).toBe(0)
    expect(minGoal(4)).toBe(1)
    expect(minGoal(8)).toBe(2)
  })
})

describe('domainStarDelta — 4 faixas por trilha', () => {
  it('total 8: tudo +1, meta +0,5, ≥mínima −0,5, abaixo −1', () => {
    // dailyGoal(8)=4, minGoal(8)=2
    expect(domainStarDelta(8, 8)).toBe(1)
    expect(domainStarDelta(4, 8)).toBe(0.5)
    expect(domainStarDelta(7, 8)).toBe(0.5)
    expect(domainStarDelta(2, 8)).toBe(-0.5)
    expect(domainStarDelta(3, 8)).toBe(-0.5)
    expect(domainStarDelta(1, 8)).toBe(-1)
    expect(domainStarDelta(0, 8)).toBe(-1)
  })

  it('meta mínima 0 → nunca perde 1 estrela inteira', () => {
    // total 1: dailyGoal=1, minGoal=0
    expect(domainStarDelta(1, 1)).toBe(1)
    expect(domainStarDelta(0, 1)).toBe(-0.5)
    // total 3: dailyGoal=2, minGoal=0
    expect(domainStarDelta(0, 3)).toBe(-0.5)
  })

  it('domínio sem itens → 0', () => {
    expect(domainStarDelta(0, 0)).toBe(0)
  })
})

describe('missionStarDelta / battleStarDelta — trilhas independentes', () => {
  it('cada trilha olha só o seu domínio', () => {
    const p = progress({
      missionsCompleted: 5,
      missionsTotal: 5,
      battlesWon: 0,
      battlesTotal: 4,
    })
    expect(missionStarDelta(p)).toBe(1) // tudo nas missões
    expect(battleStarDelta(p)).toBe(-1) // 0 de 4 (abaixo da mínima 1)
  })
})

describe('applyDomainStars — clamp [0,5] em passos de 0,5', () => {
  it('não passa dos limites', () => {
    expect(applyDomainStars(STARS_MIN, -1)).toBe(STARS_MIN)
    expect(applyDomainStars(STARS_MAX, 1)).toBe(STARS_MAX)
    expect(applyDomainStars(3, 0.5)).toBe(3.5)
  })
})

describe('dailyGoalMet / dailyPerfect — selo do resumo', () => {
  it('met exige bater AS DUAS metas', () => {
    const mg = missionGoal(4)
    const bg = battleGoal(4)
    expect(dailyGoalMet(progress({ missionsCompleted: mg, missionsTotal: 4, battlesWon: bg, battlesTotal: 4 }))).toBe(true)
    expect(dailyGoalMet(progress({ missionsCompleted: mg, missionsTotal: 4, battlesWon: 0, battlesTotal: 4 }))).toBe(false)
  })

  it('perfect exige 100% nas duas frentes', () => {
    expect(dailyPerfect(progress({ missionsCompleted: 4, missionsTotal: 4, battlesWon: 3, battlesTotal: 3 }))).toBe(true)
    expect(dailyPerfect(progress({ missionsCompleted: 4, missionsTotal: 4, battlesWon: 2, battlesTotal: 3 }))).toBe(false)
  })
})

describe('averageStars / isHired — média ≥ 3', () => {
  it('média das duas trilhas', () => {
    expect(averageStars(2, 4)).toBe(3)
    expect(averageStars(5, 0)).toBe(2.5)
  })

  it('efetivado quando a média é ≥ 3', () => {
    expect(isHired(3, 3)).toBe(true)
    expect(isHired(2, 4)).toBe(true) // média 3
    expect(isHired(2, 3)).toBe(false) // média 2,5
    expect(isHired(5, 1)).toBe(true) // média 3
  })
})
