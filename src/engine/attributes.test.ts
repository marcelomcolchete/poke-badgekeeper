import { describe, expect, it } from 'vitest'
import { ATTR_KEYS } from '../types/index.ts'
import { ATTR_MAX, ATTR_MIN, HP_MAX, HP_MIN, NATURE_BOOSTED_PER_POINT, NATURE_REDUCED_PER_POINT, TEAM_ATTR_MAX } from './constants.ts'
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
  realPerPointGain,
  recomputeMaxHp,
  teamAxisSum,
  teamSum,
  zeroAttrs,
} from './attributes.ts'
import { makeAttrs, makeMon } from './testkit.ts'

describe('realPerPointGain — ganho real aparado pelo teto', () => {
  it('rende o +10 cheio longe do teto', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ carisma: 30 }) })
    expect(realPerPointGain(mon, 'carisma')).toBe(10)
  })

  it('apara o ganho perto do teto (59 → +1)', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ carisma: 59 }) })
    expect(realPerPointGain(mon, 'carisma')).toBe(1)
  })

  it('é 0 quando o eixo já está no máximo (60)', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ carisma: ATTR_MAX }) })
    expect(realPerPointGain(mon, 'carisma')).toBe(0)
  })
})

describe('effectiveAttr', () => {
  it('= base + alocação·10, clampado em [10, 60]', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 30 }), allocations: zeroAttrs() })
    expect(effectiveAttr(mon, 'batalha')).toBe(30)
    const buffed = makeMon({
      baseAttrs: makeAttrs({ batalha: 30 }),
      allocations: { ...zeroAttrs(), batalha: 2 },
    })
    expect(effectiveAttr(buffed, 'batalha')).toBe(50)
  })

  it('nunca sai de [10, 60]', () => {
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

  it('soma a variação de encontro (IV), podendo cair até 0', () => {
    const up = makeMon({ baseAttrs: makeAttrs({ batalha: 30 }), ivs: { ...zeroAttrs(), batalha: 10 } })
    expect(effectiveAttr(up, 'batalha')).toBe(40) // 30 + 10
    const down = makeMon({ baseAttrs: makeAttrs({ resistencia: 10 }), ivs: { ...zeroAttrs(), resistencia: -10 } })
    expect(effectiveAttr(down, 'resistencia')).toBe(0) // 10 − 10, piso 0
  })

  it('permaBonus soma ao atributo efetivo', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 30 }), permaBonus: { batalha: 5 } })
    expect(effectiveAttr(mon, 'batalha')).toBe(35)
  })

  it('permaBonus respeitado pelo teto 60', () => {
    // base=58 + permaBonus=5 → seria 63, mas clamped a 60
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 58 }), permaBonus: { batalha: 5 } })
    expect(effectiveAttr(mon, 'batalha')).toBe(60)
  })

  it('permaBonus ausente não quebra effectiveAttr', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 30 }) })
    expect(effectiveAttr(mon, 'batalha')).toBe(30)
  })
})

describe('teamAxisSum / teamSum', () => {
  it('soma por eixo, capada no teto do time (100)', () => {
    const a = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    const b = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    const c = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    expect(teamAxisSum([a, b], 'agilidade')).toBe(TEAM_ATTR_MAX) // 100 → no teto do time
    expect(teamAxisSum([a, b, c], 'agilidade')).toBe(TEAM_ATTR_MAX) // 150 → cap no teto do time
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
  it('mapeia cada 10 de Resistência em 2 de vida e respeita o piso 1', () => {
    expect(hpFromResistance(ATTR_MAX)).toBe(12) // floor(60/10) * 2
    expect(hpFromResistance(0)).toBe(HP_MIN)
    expect(hpFromResistance(10)).toBe(2) // floor(10/10) * 2
    expect(hpFromResistance(20)).toBe(4)
    for (let res = 10; res <= ATTR_MAX; res += 7) {
      const hp = hpFromResistance(res)
      expect(hp).toBeGreaterThanOrEqual(HP_MIN)
      expect(hp).toBeLessThanOrEqual(HP_MAX)
      expect(Number.isInteger(hp)).toBe(true)
    }
  })

  it('maxHpOf usa a Resistência efetiva', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }) })
    expect(maxHpOf(mon)).toBe(10) // floor(50/10) * 2
  })

  it('recomputeMaxHp acompanha a alocação em Resistência', () => {
    const mon = makeMon({
      baseAttrs: makeAttrs({ resistencia: 30 }),
      allocations: { ...zeroAttrs(), resistencia: 2 },
    })
    const fixed = recomputeMaxHp(mon)
    expect(fixed.maxHp).toBe(10) // floor((30 + 20)/10) * 2
  })
})

describe('natureza — effectiveAttr com modificador', () => {
  it('nature: null usa ATTR_PER_POINT = 10 (retrocompatibilidade)', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 20 }), allocations: { ...zeroAttrs(), batalha: 2 }, nature: null })
    expect(effectiveAttr(mon, 'batalha')).toBe(40) // 20 + 2*10
  })

  it('natureza neutra (bashful) usa ATTR_PER_POINT = 10', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 20 }), allocations: { ...zeroAttrs(), batalha: 2 }, nature: 'bashful' })
    expect(effectiveAttr(mon, 'batalha')).toBe(40) // 20 + 2*10
  })

  it('eixo favorecido usa NATURE_BOOSTED_PER_POINT = 15', () => {
    // lonely: +batalha / -carisma
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 20 }), allocations: { ...zeroAttrs(), batalha: 2 }, nature: 'lonely' })
    expect(effectiveAttr(mon, 'batalha')).toBe(20 + 2 * NATURE_BOOSTED_PER_POINT) // 50
  })

  it('eixo penalizado usa NATURE_REDUCED_PER_POINT = 5', () => {
    // lonely: +batalha / -carisma
    const mon = makeMon({ baseAttrs: makeAttrs({ carisma: 20 }), allocations: { ...zeroAttrs(), carisma: 2 }, nature: 'lonely' })
    expect(effectiveAttr(mon, 'carisma')).toBe(20 + 2 * NATURE_REDUCED_PER_POINT) // 30
  })

  it('eixos neutros da natureza continuam usando ATTR_PER_POINT = 10', () => {
    // lonely afeta batalha e carisma; os outros 4 são neutros
    const mon = makeMon({ baseAttrs: makeAttrs({ agilidade: 20 }), allocations: { ...zeroAttrs(), agilidade: 2 }, nature: 'lonely' })
    expect(effectiveAttr(mon, 'agilidade')).toBe(40) // 20 + 2*10
  })

  it('clamp ATTR_MAX é respeitado mesmo com natureza favorecida', () => {
    // base 50 + 1 ponto * 15 = 65 → clampado em 60
    const mon = makeMon({ baseAttrs: makeAttrs({ batalha: 50 }), allocations: { ...zeroAttrs(), batalha: 1 }, nature: 'lonely' })
    expect(effectiveAttr(mon, 'batalha')).toBe(ATTR_MAX)
  })

  it('clamp ATTR_MIN é respeitado mesmo com natureza penalizada', () => {
    // base 10 + 0 pontos * 5 = 10 → no mínimo
    const mon = makeMon({ baseAttrs: makeAttrs({ carisma: 10 }), allocations: zeroAttrs(), nature: 'lonely' })
    expect(effectiveAttr(mon, 'carisma')).toBe(ATTR_MIN)
  })

  it('HP máximo sobe com natureza que favorece resistencia', () => {
    // bold: +resistencia / -batalha
    const sem = makeMon({ baseAttrs: makeAttrs({ resistencia: 20 }), allocations: { ...zeroAttrs(), resistencia: 2 }, nature: null })
    const com = makeMon({ baseAttrs: makeAttrs({ resistencia: 20 }), allocations: { ...zeroAttrs(), resistencia: 2 }, nature: 'bold' })
    expect(maxHpOf(com)).toBeGreaterThan(maxHpOf(sem))
  })

  it('HP máximo cai com natureza que penaliza resistencia', () => {
    // hasty: +agilidade / -resistencia
    const sem = makeMon({ baseAttrs: makeAttrs({ resistencia: 30 }), allocations: { ...zeroAttrs(), resistencia: 2 }, nature: null })
    const com = makeMon({ baseAttrs: makeAttrs({ resistencia: 30 }), allocations: { ...zeroAttrs(), resistencia: 2 }, nature: 'hasty' })
    expect(maxHpOf(com)).toBeLessThan(maxHpOf(sem))
  })
})

describe('applyDamage / heal / isFainted', () => {
  it('dano reduz HP e desmaia ao chegar a 0 (sem mutar a entrada)', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }) }) // maxHp 10
    const hit = applyDamage(mon, 2)
    expect(hit.currentHp).toBe(8)
    expect(hit.status).toBe('idle')
    expect(mon.currentHp).toBe(10) // entrada intacta
    const ko = applyDamage(mon, 99)
    expect(ko.currentHp).toBe(0)
    expect(ko.status).toBe('fainted')
    expect(isFainted(ko)).toBe(true)
  })

  it('heal não passa do máximo nem revive (HP 0 segue 0)', () => {
    const mon = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 1 })
    expect(heal(mon, 99).currentHp).toBe(10)
    const downed = makeMon({ baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 0 })
    expect(heal(downed, 0).currentHp).toBe(0)
  })
})
