import { describe, expect, it } from 'vitest'
import { xpMultiplierLabel } from './Hearts.tsx'

describe('xpMultiplierLabel', () => {
  it('usa frações limpas nos corações inteiros', () => {
    expect(xpMultiplierLabel(0)).toBe('⅛')
    expect(xpMultiplierLabel(1)).toBe('¼')
    expect(xpMultiplierLabel(2)).toBe('½')
    expect(xpMultiplierLabel(3)).toBe('1')
    expect(xpMultiplierLabel(4)).toBe('2')
    expect(xpMultiplierLabel(5)).toBe('4')
  })

  it('usa 2 casas (vírgula) nos meios-corações', () => {
    expect(xpMultiplierLabel(2.5)).toBe('0,71')
    expect(xpMultiplierLabel(4.5)).toBe('2,83')
  })
})
