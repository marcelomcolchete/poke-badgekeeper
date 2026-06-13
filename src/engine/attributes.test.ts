import { describe, expect, it } from 'vitest'
import { ATTR_KEYS } from '../types/index.ts'
import { ATTR_MAX, ATTR_MIN, HP_MAX, HP_MIN } from './constants.ts'
import {
  applyDamage,
  axisMin,
  effectiveAttr,
  effectiveAttrs,
  heal,
  hexagonArea,
  hpFromResistance,
  isFainted,
  maxHpOf,
  recomputeMaxHp,
  teamAxisSum,
  teamSum,
  zeroAttrs,
} from './attributes.ts'
import { makeAttrs, makeMon } from './testkit.ts'

describe('effectiveAttr', () => {
  it('= base + alocação·10, clampado em [10, 100]', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 30 }), allocations: zeroAttrs() })
    expect(effectiveAttr(mon, 'batalha')).toBe(30)
    const buffed = makeMon({
      baseAttrs: makeAttrs({ batalha: 30 }),
      allocations: { ...zeroAttrs(), batalha: 3 },
    })
    expect(effectiveAttr(buffed, 'batalha')).toBe(60)
  })

  it('nunca sai de [10, 100]', () => {
    const maxed = makeMon({
      baseAttrs: makeAttrs({ batalha: 50 }),
      allocations: { ...zeroAttrs(), batalha: 9 },
    })
    expect(effectiveAttr(maxed, 'batalha')).toBe(ATTR_MAX)
    const floored = makeMon({ baseAttrs: makeAttrs({ percepcao: 10 }) })
    expect(effectiveAttr(floored, 'percepcao')).toBeGreaterThanOrEqual(ATTR_MIN)
  })

  it('effectiveAttrs cobre os 6 eixos no intervalo', () => {
    const attrs = effectiveAttrs(makeMon())
    for (const k of ATTR_KEYS) {
      expect(attrs[k]).toBeGreaterThanOrEqual(ATTR_MIN)
      expect(attrs[k]).toBeLessThanOrEqual(ATTR_MAX)
    }
  })
})

describe('teamAxisSum / teamSum', () => {
  it('soma por eixo, capada em 100', () => {
    const a = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    const b = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    const c = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    expect(teamAxisSum([a, b], 'agilidade')).toBe(100)
    expect(teamAxisSum([a, b, c], 'agilidade')).toBe(100) // 150 → cap 100
  })

  it('time vazio soma 0', () => {
    for (const k of ATTR_KEYS) expect(teamAxisSum([], k)).toBe(0)
    const sum = teamSum([])
    for (const k of ATTR_KEYS) expect(sum[k]).toBe(0)
  })
})

describe('hexagonArea / axisMin', () => {
  it('é monotônica: hexágono maior tem área maior', () => {
    const small = hexagonArea(makeAttrs({}, 30))
    const big = hexagonArea(makeAttrs({}, 60))
    expect(big).toBeGreaterThan(small)
  })

  it('área de um hexágono nulo é 0', () => {
    expect(hexagonArea(zeroAttrs())).toBe(0)
  })

  it('área de hexágono regular r = 6·(0.5·sin60·r²)', () => {
    const r = 40
    const expected = 6 * 0.5 * Math.sin(Math.PI / 3) * r * r
    expect(hexagonArea(makeAttrs({}, r))).toBeCloseTo(expected, 6)
  })

  it('axisMin pega o menor por eixo', () => {
    const a = makeAttrs({ batalha: 80, carisma: 10 })
    const b = makeAttrs({ batalha: 30, carisma: 90 })
    const m = axisMin(a, b)
    expect(m.batalha).toBe(30)
    expect(m.carisma).toBe(10)
  })

  it('interseção ≤ qualquer um dos hexágonos', () => {
    const team = makeAttrs({ batalha: 90, agilidade: 20 })
    const req = makeAttrs({ batalha: 30, agilidade: 70 })
    const inter = hexagonArea(axisMin(team, req))
    expect(inter).toBeLessThanOrEqual(hexagonArea(req))
    expect(inter).toBeLessThanOrEqual(hexagonArea(team))
  })
})

describe('HP derivado da Resistência', () => {
  it('mapeia 100→10 e 10→1, no intervalo 1–10', () => {
    expect(hpFromResistance(100)).toBe(HP_MAX)
    expect(hpFromResistance(10)).toBe(HP_MIN)
    for (let res = 10; res <= 100; res += 7) {
      const hp = hpFromResistance(res)
      expect(hp).toBeGreaterThanOrEqual(HP_MIN)
      expect(hp).toBeLessThanOrEqual(HP_MAX)
      expect(Number.isInteger(hp)).toBe(true)
    }
  })

  it('maxHpOf usa a Resistência efetiva', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }) })
    expect(maxHpOf(mon)).toBe(5)
  })

  it('recomputeMaxHp acompanha a alocação em Resistência', () => {
    const mon = makeMon({
      baseAttrs: makeAttrs({ resistencia: 30 }),
      allocations: { ...zeroAttrs(), resistencia: 4 },
    })
    const fixed = recomputeMaxHp(mon)
    expect(fixed.maxHp).toBe(7) // (30 + 40)/10 = 7
  })
})

describe('applyDamage / heal / isFainted', () => {
  it('dano reduz HP e desmaia ao chegar a 0 (sem mutar a entrada)', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }) }) // maxHp 5
    const hit = applyDamage(mon, 2)
    expect(hit.currentHp).toBe(3)
    expect(hit.status).toBe('idle')
    expect(mon.currentHp).toBe(5) // entrada intacta
    const ko = applyDamage(mon, 99)
    expect(ko.currentHp).toBe(0)
    expect(ko.status).toBe('fainted')
    expect(isFainted(ko)).toBe(true)
  })

  it('heal não passa do máximo nem revive (HP 0 segue 0)', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 1 })
    expect(heal(mon, 99).currentHp).toBe(5)
    const downed = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 0 })
    expect(heal(downed, 0).currentHp).toBe(0)
  })
})
