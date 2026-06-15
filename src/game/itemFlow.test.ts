import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { fixedRng, makeAttrs, makeMon } from '../engine/testkit.ts'
import { reducer } from './reducer.ts'
import { autoSeedRun } from './setup.ts'
import { startSearch } from './captureFlow.ts'
import { applyAutoItems, applyXpGains } from './itemFlow.ts'

const SEED = 12345

describe('applyAutoItems (cura/revive automáticos)', () => {
  it('Potion enche o HP de quem está ferido e consome 1 uso', () => {
    const s = createInitialState(SEED)
    s.roster = [makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 1 })]
    s.inventory = [{ itemId: 'potion', quantity: 1 }]
    applyAutoItems(s)
    expect(s.roster[0]?.currentHp).toBe(s.roster[0]?.maxHp)
    expect(s.inventory).toEqual([]) // pilha zerada some
  })

  it('Revive traz o desmaiado de volta com HP cheio (Potion não revive)', () => {
    const fainted = makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 0, status: 'fainted' })
    const withPotion = createInitialState(SEED)
    withPotion.roster = [{ ...fainted }]
    withPotion.inventory = [{ itemId: 'potion', quantity: 1 }]
    applyAutoItems(withPotion)
    expect(withPotion.roster[0]?.currentHp).toBe(0) // Potion não age em desmaiado
    expect(withPotion.inventory[0]?.quantity).toBe(1) // nada consumido

    const withRevive = createInitialState(SEED)
    withRevive.roster = [{ ...fainted }]
    withRevive.inventory = [{ itemId: 'revive', quantity: 1 }]
    applyAutoItems(withRevive)
    expect(withRevive.roster[0]?.currentHp).toBe(withRevive.roster[0]?.maxHp)
    expect(withRevive.roster[0]?.status).toBe('idle')
    expect(withRevive.inventory).toEqual([])
  })

  it('Super Potion (3 usos) cura vários Pokémon', () => {
    const s = createInitialState(SEED)
    s.roster = [
      makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 1 }),
      makeMon({ id: 'b', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 2 }),
    ]
    s.inventory = [{ itemId: 'super-potion', quantity: 3 }]
    applyAutoItems(s)
    expect(s.roster.every((p) => p.currentHp === p.maxHp)).toBe(true)
    expect(s.inventory[0]?.quantity).toBe(1) // 2 usos gastos, sobra 1
  })
})

describe('applyXpGains (Exp Share)', () => {
  it('sem Exp Share, só o recebedor ganha XP', () => {
    const s = createInitialState(SEED)
    s.roster = [makeMon({ id: 'a' }), makeMon({ id: 'b' })]
    applyXpGains(s, new Map([['a', 100]]), fixedRng(0))
    const a = s.roster.find((p) => p.id === 'a')!
    const b = s.roster.find((p) => p.id === 'b')!
    expect(a.level > 1 || a.xp > 0).toBe(true)
    expect(b.xp).toBe(0)
    expect(b.level).toBe(1)
  })

  it('com Exp Share, o resto do time ganha 5%', () => {
    const s = createInitialState(SEED)
    s.roster = [makeMon({ id: 'a' }), makeMon({ id: 'b' })]
    s.runItems = ['exp-share']
    applyXpGains(s, new Map([['a', 100]]), fixedRng(0))
    expect(s.roster.find((p) => p.id === 'b')!.xp).toBeGreaterThan(0)
  })
})

describe('mercado — efeitos de compra (reducer)', () => {
  it('x_* soma +5 ao eixo de todo o time e aumenta o HP no dia', () => {
    let s = createInitialState(SEED)
    s.gold = 1000
    s.roster = [makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 45 }) })]
    expect(s.roster[0]?.maxHp).toBe(8) // floor(45/10) * 2
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'x-RES' })
    expect(s.gold).toBe(600)
    expect(s.roster[0]?.dayBuffs?.resistencia).toBe(5)
    expect(s.roster[0]?.maxHp).toBe(10) // res 50 → 10 de HP
    expect(s.roster[0]?.currentHp).toBe(10)
  })

  it('o buff x_* some na virada do dia', () => {
    let s = createInitialState(SEED)
    s.run.phase = 'SUMMARY'
    s.run.day = 1
    s.roster = [makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 45 }), dayBuffs: { resistencia: 5 } })]
    expect(s.roster[0]?.maxHp).toBe(10)
    s = reducer(s, { type: 'ADVANCE_PHASE' }) // SUMMARY → próximo dia
    expect(s.run.day).toBe(2)
    expect(s.roster[0]?.dayBuffs).toBeUndefined()
    expect(s.roster[0]?.maxHp).toBe(8)
  })

  it('item passivo entra em runItems e não é comprado duas vezes', () => {
    let s = createInitialState(SEED)
    s.gold = 2000
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'eviolite' })
    expect(s.runItems).toContain('eviolite')
    expect(s.gold).toBe(500)
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'eviolite' }) // já possui → no-op
    expect(s.gold).toBe(500)
    expect(s.runItems.filter((i) => i === 'eviolite')).toHaveLength(1)
  })

  it('Rare Candy sobe 1 nível do Pokémon escolhido', () => {
    let s = createInitialState(SEED)
    s.gold = 1000
    s.roster = [makeMon({ id: 'a', level: 3 })]
    s = reducer(s, { type: 'USE_RARE_CANDY', pokemonId: 'a' })
    expect(s.roster[0]?.level).toBe(4)
    expect(s.gold).toBe(500)
    expect(s.today.purchasedItems).toContain('rare-candy')
  })

  it('comprar marca o slot como vendido (sem recompra no mesmo dia)', () => {
    let s = createInitialState(SEED)
    s.gold = 1000
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'potion' })
    expect(s.today.purchasedItems).toContain('potion')
    expect(s.inventory).toEqual([{ itemId: 'potion', quantity: 1 }])
    const goldAfter = s.gold
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'potion' }) // vendido → no-op
    expect(s.gold).toBe(goldAfter)
    expect(s.inventory).toEqual([{ itemId: 'potion', quantity: 1 }])
  })
})

describe('mercado — bola evolutiva (BUY_BALL)', () => {
  it('a Pokébola é grátis e sobe o ballLevel para 1', () => {
    let s = createInitialState(SEED)
    s.gold = 0 // sem ouro: a Pokébola inicial é grátis
    expect(s.run.ballLevel).toBe(0)
    s = reducer(s, { type: 'BUY_BALL' })
    expect(s.run.ballLevel).toBe(1)
    expect(s.gold).toBe(0)
    expect(s.today.purchasedItems).toContain('poke-ball')
  })

  it('a próxima bola custa 500 e não é comprada duas vezes no mesmo dia', () => {
    let s = createInitialState(SEED)
    s.run.ballLevel = 1 // já tem Pokébola → próxima é Great Ball ($500)
    s.gold = 500
    s = reducer(s, { type: 'BUY_BALL' })
    expect(s.run.ballLevel).toBe(2)
    expect(s.gold).toBe(0)
    expect(s.today.purchasedItems).toContain('great-ball')
    s = reducer(s, { type: 'BUY_BALL' }) // já comprou bola hoje → no-op
    expect(s.run.ballLevel).toBe(2)
  })

  it('sem ouro para a próxima bola é no-op', () => {
    let s = createInitialState(SEED)
    s.run.ballLevel = 1
    s.gold = 100 // < 500
    s = reducer(s, { type: 'BUY_BALL' })
    expect(s.run.ballLevel).toBe(1)
    expect(s.gold).toBe(100)
  })

  it('no topo (Masterball) BUY_BALL é no-op', () => {
    let s = createInitialState(SEED)
    s.run.ballLevel = 4
    s.gold = 5000
    s = reducer(s, { type: 'BUY_BALL' })
    expect(s.run.ballLevel).toBe(4)
    expect(s.gold).toBe(5000)
  })
})

describe('mercado da manhã (oferta fixa do dia)', () => {
  it('a virada do dia gera 5 itens, zera os vendidos e exclui passivos possuídos', () => {
    let s = createInitialState(SEED)
    s.run.phase = 'SUMMARY'
    s.run.day = 1
    s.runItems = ['eviolite']
    s.today.purchasedItems = ['potion'] // sobra do dia anterior
    s = reducer(s, { type: 'ADVANCE_PHASE' }) // SUMMARY → próxima manhã
    expect(s.run.day).toBe(2)
    expect(s.today.shopOffer).toHaveLength(5)
    expect(s.today.shopOffer).not.toContain('eviolite')
    expect(s.today.purchasedItems).toEqual([])
  })
})

describe('Fast Ball', () => {
  it('torna a busca de captura instantânea ao chegar na área', () => {
    const base = autoSeedRun(SEED)
    base.captureSpots = ['c']
    base.captureSpotSpawnsAtMs = [0]

    const normal = autoSeedRun(SEED)
    normal.captureSpots = ['c']
    normal.captureSpotSpawnsAtMs = [0]
    startSearch(normal, normal.roster[0]!.id, 0)
    const slow = normal.captureSearches[0]!
    expect(slow.readyAtMs).toBeGreaterThan(slow.arriveAtMs)

    const fast = autoSeedRun(SEED)
    fast.captureSpots = ['c']
    fast.captureSpotSpawnsAtMs = [0]
    fast.runItems = ['fast-ball']
    startSearch(fast, fast.roster[0]!.id, 0)
    const quick = fast.captureSearches[0]!
    expect(quick.readyAtMs).toBe(quick.arriveAtMs)
  })
})
