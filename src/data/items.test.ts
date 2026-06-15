import { describe, expect, it } from 'vitest'
import {
  CITY_ITEM_IDS,
  GLOBAL_ITEM_IDS,
  ITEMS,
  MANDATORY_ITEM_IDS,
  SHOP_SIZE,
  getDailyShop,
  getItem,
} from './items.ts'

describe('catálogo de itens', () => {
  it('ids únicos e sprite no padrão /sprites/itens/<id>.png', () => {
    const ids = ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of ITEMS) {
      expect(item.sprite).toBe(`/sprites/itens/${item.id}.png`)
      expect(item.price).toBeGreaterThan(0)
      expect(['consumable', 'passive']).toContain(item.type)
    }
  })

  it('itens passivos têm effect.kind "passive" (vão para runItems)', () => {
    for (const id of ['exp-share', 'fast-ball', 'eviolite', 'lagging-tail', 'thick-club']) {
      expect(getItem(id).effect.kind).toBe('passive')
    }
  })
})

describe('getDailyShop', () => {
  it('oferece 3 itens distintos, com ao menos 1 obrigatório', () => {
    for (let day = 1; day <= 10; day++) {
      for (const seed of [1, 42, 777, 9000]) {
        const shop = getDailyShop(seed, day, 0)
        expect(shop).toHaveLength(SHOP_SIZE)
        expect(new Set(shop).size).toBe(SHOP_SIZE)
        expect(shop.some((id) => MANDATORY_ITEM_IDS.includes(id))).toBe(true)
      }
    }
  })

  it('é determinístico por (seed, dia, cidade)', () => {
    expect(getDailyShop(123, 3, 0)).toEqual(getDailyShop(123, 3, 0))
    // Dias diferentes tendem a diferir (não é garantia absoluta, mas serve de sanidade).
    expect(getDailyShop(123, 3, 0)).not.toEqual(getDailyShop(123, 4, 0))
  })

  it('só oferece os extras de Pewter na cidade 0', () => {
    const pewterOnly = CITY_ITEM_IDS[0] ?? []
    // Em qualquer outra cidade, os itens exclusivos de Pewter nunca aparecem.
    for (let seed = 0; seed < 80; seed++) {
      const shop = getDailyShop(seed, 1, 1)
      for (const id of shop) expect(GLOBAL_ITEM_IDS).toContain(id)
      expect(pewterOnly.some((id) => shop.includes(id))).toBe(false)
    }
    // Em Pewter, ao varrer seeds, pelo menos um extra acaba aparecendo.
    const seen = new Set<string>()
    for (let seed = 0; seed < 200; seed++) for (const id of getDailyShop(seed, 1, 0)) seen.add(id)
    expect(pewterOnly.some((id) => seen.has(id))).toBe(true)
  })
})
