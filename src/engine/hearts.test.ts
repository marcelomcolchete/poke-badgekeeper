import { describe, expect, it } from 'vitest'
import { applyHeartDelta, dailyHeartDelta, heartsOf, heartXpMultiplier } from './hearts.ts'

describe('heartsOf — corações efetivos', () => {
  it('ausente = 2 (padrão de novos Pokémon); capa em [0,5]', () => {
    expect(heartsOf(undefined)).toBe(2)
    expect(heartsOf(3.5)).toBe(3.5)
    expect(heartsOf(-1)).toBe(0)
    expect(heartsOf(9)).toBe(5)
  })
})

describe('heartXpMultiplier — +10% por coração, teto +50%', () => {
  it('escala linear até 5 corações', () => {
    expect(heartXpMultiplier(0)).toBe(1)
    expect(heartXpMultiplier(2)).toBeCloseTo(1.2)
    expect(heartXpMultiplier(5)).toBeCloseTo(1.5)
    expect(heartXpMultiplier(undefined)).toBeCloseTo(1.2) // padrão 2
  })

  it('não passa de +50% mesmo acima do teto', () => {
    expect(heartXpMultiplier(99)).toBeCloseTo(1.5)
  })
})

describe('dailyHeartDelta — fim do dia', () => {
  it('sobreviveu e participou → +0,5', () => {
    expect(dailyHeartDelta({ fainted: false, participated: true, mvp: false })).toBe(0.5)
  })

  it('destaque do dia soma +0,5 ao bônus de sobrevivência', () => {
    expect(dailyHeartDelta({ fainted: false, participated: true, mvp: true })).toBe(1)
  })

  it('sobreviveu mas não fez nada → 0 (½ ganho − ½ por ociosidade)', () => {
    expect(dailyHeartDelta({ fainted: false, participated: false, mvp: false })).toBe(0)
  })

  it('morreu → −0,5', () => {
    expect(dailyHeartDelta({ fainted: true, participated: true, mvp: false })).toBe(-0.5)
  })
})

describe('applyHeartDelta — clamp [0,5] em passos de 0,5', () => {
  it('não passa dos limites', () => {
    expect(applyHeartDelta(5, 1)).toBe(5)
    expect(applyHeartDelta(0, -0.5)).toBe(0)
    expect(applyHeartDelta(2, 0.5)).toBe(2.5)
    expect(applyHeartDelta(undefined, 0.5)).toBe(2.5) // base 2
  })
})
