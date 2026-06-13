import { describe, expect, it } from 'vitest'
import { getItem } from '../data/items.ts'
import { buyItem, canAfford, goldForDefense, totalDefenseGold } from './economy.ts'
import { makeAttrs, makeMon } from './testkit.ts'

describe('goldForDefense (PLAN §4.6)', () => {
  it('cresce com a média de Carisma do esquadrão', () => {
    const low = [makeMon({ baseAttrs: makeAttrs({ carisma: 10 }) })]
    const high = [makeMon({ baseAttrs: makeAttrs({ carisma: 50 }) })]
    expect(goldForDefense(high)).toBeGreaterThan(goldForDefense(low))
  })

  it('Carisma 50 → 1,5× a base; é inteiro', () => {
    const squad = [makeMon({ baseAttrs: makeAttrs({ carisma: 50 }) })]
    const gold = goldForDefense(squad)
    expect(gold).toBe(150) // 100 · (1 + 50/100)
    expect(Number.isInteger(gold)).toBe(true)
  })

  it('totalDefenseGold soma as defesas vencidas', () => {
    const a = [makeMon({ baseAttrs: makeAttrs({ carisma: 50 }) })]
    const b = [makeMon({ baseAttrs: makeAttrs({ carisma: 50 }) })]
    expect(totalDefenseGold([a, b])).toBe(goldForDefense(a) + goldForDefense(b))
    expect(totalDefenseGold([])).toBe(0)
  })
})

describe('mercado (PLAN §4.6)', () => {
  const potion = getItem('potion') // 200

  it('canAfford respeita preço × quantidade', () => {
    expect(canAfford(200, potion)).toBe(true)
    expect(canAfford(199, potion)).toBe(false)
    expect(canAfford(400, potion, 2)).toBe(true)
    expect(canAfford(399, potion, 2)).toBe(false)
  })

  it('buyItem debita o ouro e empilha no inventário', () => {
    const first = buyItem(1000, [], 'potion')
    expect(first.gold).toBe(800)
    expect(first.inventory).toEqual([{ itemId: 'potion', quantity: 1 }])

    const second = buyItem(first.gold, first.inventory, 'potion', 2)
    expect(second.gold).toBe(400)
    expect(second.inventory).toEqual([{ itemId: 'potion', quantity: 3 }])
  })

  it('itens diferentes viram pilhas separadas', () => {
    const out = buyItem(2000, [{ itemId: 'potion', quantity: 1 }], 'revive')
    expect(out.inventory).toHaveLength(2)
  })

  it('lança ao comprar sem ouro e não muta o inventário', () => {
    const inv = [{ itemId: 'potion', quantity: 1 }]
    expect(() => buyItem(10, inv, 'potion')).toThrow()
    expect(inv).toEqual([{ itemId: 'potion', quantity: 1 }])
  })
})
