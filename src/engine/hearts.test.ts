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

describe('heartXpMultiplier — curva 2^(c−3)', () => {
  it('bate exato nos 6 pontos inteiros', () => {
    expect(heartXpMultiplier(0)).toBeCloseTo(1 / 8)
    expect(heartXpMultiplier(1)).toBeCloseTo(1 / 4)
    expect(heartXpMultiplier(2)).toBeCloseTo(1 / 2)
    expect(heartXpMultiplier(3)).toBeCloseTo(1)
    expect(heartXpMultiplier(4)).toBeCloseTo(2)
    expect(heartXpMultiplier(5)).toBeCloseTo(4)
  })

  it('padrão (ausente = 2 corações) rende metade da XP', () => {
    expect(heartXpMultiplier(undefined)).toBeCloseTo(1 / 2)
  })

  it('interpola os meios-corações geometricamente', () => {
    expect(heartXpMultiplier(2.5)).toBeCloseTo(Math.SQRT1_2) // ≈0,707
    expect(heartXpMultiplier(4.5)).toBeCloseTo(2 * Math.SQRT2) // ≈2,83
  })

  it('satura no teto de 5 corações (×4) acima do limite', () => {
    expect(heartXpMultiplier(99)).toBeCloseTo(4)
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
