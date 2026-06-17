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

  it('exclui passivos já possuídos da pool (1×/run)', () => {
    const owned = ['eviolite', 'lagging-tail', 'thick-club', 'exp-share', 'fast-ball']
    for (let seed = 0; seed < 80; seed++) {
      const shop = getDailyShop(seed, 1, 0, owned)
      expect(shop).toHaveLength(SHOP_SIZE)
      for (const id of owned) expect(shop).not.toContain(id)
    }
  })

  it('extras de cidade só aparecem na própria cidade', () => {
    const pewterOnly = CITY_ITEM_IDS[0] ?? []
    const ceruleanOnly = CITY_ITEM_IDS[1] ?? []
    // Cidade 2 (Vermilion) não tem extras: só itens globais aparecem.
    for (let seed = 0; seed < 80; seed++) {
      const shop = getDailyShop(seed, 1, 2)
      for (const id of shop) expect(GLOBAL_ITEM_IDS).toContain(id)
    }
    // Os extras de Cerulean nunca aparecem em Pewter, e vice-versa.
    const pewterSeen = new Set<string>()
    const ceruleanSeen = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      for (const id of getDailyShop(seed, 1, 0)) pewterSeen.add(id)
      for (const id of getDailyShop(seed, 1, 1)) ceruleanSeen.add(id)
    }
    expect(ceruleanOnly.some((id) => pewterSeen.has(id))).toBe(false)
    expect(pewterOnly.some((id) => ceruleanSeen.has(id))).toBe(false)
    // Em cada cidade, ao varrer seeds, pelo menos um extra próprio acaba aparecendo.
    expect(pewterOnly.some((id) => pewterSeen.has(id))).toBe(true)
    expect(ceruleanOnly.some((id) => ceruleanSeen.has(id))).toBe(true)
  })
})
