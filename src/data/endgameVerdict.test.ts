import { describe, it, expect } from 'vitest'
import {
  BADGE_COLORS,
  BADGE_LABELS,
  CITY_SPEECHES,
  GYM_SPEECHES,
  gymLeaderFor,
  starBucket,
} from './endgameVerdict.ts'

describe('starBucket', () => {
  it('abaixo de 1 estrela → 0 (Horrível)', () => {
    expect(starBucket(0)).toBe(0)
    expect(starBucket(0.9)).toBe(0)
  })
  it('faixas intermediárias usam o piso', () => {
    expect(starBucket(1)).toBe(1)
    expect(starBucket(2.5)).toBe(2)
    expect(starBucket(3)).toBe(3)
    expect(starBucket(4.9)).toBe(4)
  })
  it('Perfeito (5) só com 5,0 cravado', () => {
    expect(starBucket(5)).toBe(5)
    expect(starBucket(4.99)).toBe(4)
  })
  it('fixa fora da faixa em [0,5]', () => {
    expect(starBucket(-1)).toBe(0)
    expect(starBucket(7)).toBe(5)
  })
})

describe('gymLeaderFor', () => {
  it('mapeia cada cidade de Kanto ao seu líder', () => {
    expect(gymLeaderFor(0).name).toBe('Brock')
    expect(gymLeaderFor(1).name).toBe('Misty')
    expect(gymLeaderFor(2).name).toBe('Lt. Surge')
    expect(gymLeaderFor(3).name).toBe('Erika')
    expect(gymLeaderFor(4).name).toBe('Koga')
    expect(gymLeaderFor(5).name).toBe('Sabrina')
    expect(gymLeaderFor(6).name).toBe('Blaine')
    expect(gymLeaderFor(7).name).toBe('Giovanni')
  })
  it('cada líder tem um sprite gen3', () => {
    for (let i = 0; i < 8; i++) {
      expect(gymLeaderFor(i).sprite).toMatch(/\/sprites\/trainers\/gen3\/.+\.png$/)
    }
  })
  it('índice fora da faixa cai no fallback genérico', () => {
    expect(gymLeaderFor(99).name).toBe('Líder do Ginásio')
  })
})

describe('conjuntos de veredito', () => {
  it('têm 6 entradas (buckets 0–5)', () => {
    expect(BADGE_LABELS).toHaveLength(6)
    expect(BADGE_COLORS).toHaveLength(6)
    expect(GYM_SPEECHES).toHaveLength(6)
    expect(CITY_SPEECHES).toHaveLength(6)
  })
})
