import { describe, expect, it } from 'vitest'
import { rollNextTheftChance, theftFleeMs, theftChanceLabel } from './theft.ts'
import { THEFT_CHANCE_MAX, THEFT_FLEE_AGILITY } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import { makeMon, makeAttrs } from './testkit.ts'

describe('theft — chance', () => {
  it('dobra 1→2→4→…→64', () => {
    expect(rollNextTheftChance(1)).toBe(2)
    expect(rollNextTheftChance(32)).toBe(64)
  })
  it('satura em THEFT_CHANCE_MAX (64→100, 100→100)', () => {
    expect(rollNextTheftChance(64)).toBe(THEFT_CHANCE_MAX)
    expect(rollNextTheftChance(100)).toBe(THEFT_CHANCE_MAX)
  })
})

describe('theft — tempo de fuga', () => {
  it('usa a curva de viagem com agilidade efetiva 10 (= um mon com agilidade 10, sozinho)', () => {
    const flee = makeMon({ id: 'rkt', baseAttrs: makeAttrs({ agilidade: THEFT_FLEE_AGILITY }, 0) })
    // graphTravelMs aplica agilityTravelFactor = clamp(1 - 10*0.01, 0.3, 1) = 0.90.
    expect(theftFleeMs(0.5)).toBeCloseTo(graphTravelMs(0.5, [flee], 1), 5)
  })
  it('distância 0 → tempo 0', () => {
    expect(theftFleeMs(0)).toBe(0)
  })
})

describe('theftChanceLabel — B9', () => {
  it('mapeia os buckets da sequência 1→…→100', () => {
    expect(theftChanceLabel(1).label).toBe('Muito Improvável')
    expect(theftChanceLabel(4).label).toBe('Muito Improvável')
    expect(theftChanceLabel(8).label).toBe('Improvável')
    expect(theftChanceLabel(16).label).toBe('Possível')
    expect(theftChanceLabel(32).label).toBe('Provável')
    expect(theftChanceLabel(64).label).toBe('Muito Provável')
    expect(theftChanceLabel(100).label).toBe('Inevitável')
  })
  it('azul no piso, vermelho no teto (rampa 5 paradas)', () => {
    expect(theftChanceLabel(1).color).toBe('#3b82f6') // azul
    expect(theftChanceLabel(100).color).toBe('#e23b3b') // vermelho
  })
  it('tinta legível por luminância (meio claro → tinta escura; teto → tinta clara)', () => {
    expect(theftChanceLabel(100).ink).toBe('#ffffff')
    expect(theftChanceLabel(50).ink).toBe('#1a1a1a')
  })
  it('é robusto a valores intermediários (5, 50, 80)', () => {
    expect(theftChanceLabel(5).label).toBe('Improvável') // 4 < 5 ≤ 8
    expect(theftChanceLabel(50).label).toBe('Muito Provável') // 32 < 50 ≤ 64
    expect(theftChanceLabel(80).label).toBe('Inevitável') // 64 < 80 ≤ 100
  })
})
