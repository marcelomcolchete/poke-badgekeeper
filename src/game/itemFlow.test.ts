import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import { fixedRng, makeAttrs, makeMon } from '../engine/testkit.ts'
import { reducer } from './reducer.ts'
import { autoSeedRun } from './setup.ts'
import { startSearch } from './captureFlow.ts'
import { applyXpGains } from './itemFlow.ts'

const SEED = 12345

describe('uso MANUAL de cura/revive (USE_ITEM)', () => {
  it('Potion (single) enche o HP do alvo ferido e consome 1 uso', () => {
    let s = createInitialState(SEED)
    s.roster = [makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 1 })]
    s.inventory = [{ itemId: 'potion', quantity: 1 }]
    s = reducer(s, { type: 'USE_ITEM', itemId: 'potion', targetId: 'a' })
    expect(s.roster[0]?.currentHp).toBe(s.roster[0]?.maxHp)
    expect(s.inventory).toEqual([]) // pilha zerada some
  })

  it('Potion não age em desmaiado (nem consome); Revive (single) traz de volta', () => {
    const fainted = makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 0, status: 'fainted' })
    let withPotion = createInitialState(SEED)
    withPotion.roster = [{ ...fainted }]
    withPotion.inventory = [{ itemId: 'potion', quantity: 1 }]
    withPotion = reducer(withPotion, { type: 'USE_ITEM', itemId: 'potion', targetId: 'a' })
    expect(withPotion.roster[0]?.currentHp).toBe(0) // Potion não age em desmaiado
    expect(withPotion.inventory[0]?.quantity).toBe(1) // nada consumido

    let withRevive = createInitialState(SEED)
    withRevive.roster = [{ ...fainted }]
    withRevive.inventory = [{ itemId: 'revive', quantity: 1 }]
    withRevive = reducer(withRevive, { type: 'USE_ITEM', itemId: 'revive', targetId: 'a' })
    expect(withRevive.roster[0]?.currentHp).toBe(withRevive.roster[0]?.maxHp)
    expect(withRevive.roster[0]?.status).toBe('idle')
    expect(withRevive.inventory).toEqual([])
  })

  it('Super Potion (team) cura o time inteiro com 1 uso', () => {
    let s = createInitialState(SEED)
    s.roster = [
      makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 1 }),
      makeMon({ id: 'b', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 2 }),
    ]
    s.inventory = [{ itemId: 'super-potion', quantity: 1 }]
    s = reducer(s, { type: 'USE_ITEM', itemId: 'super-potion', targetId: '' })
    expect(s.roster.every((p) => p.currentHp === p.maxHp)).toBe(true)
    expect(s.inventory).toEqual([]) // uso único consumido
  })

  it('Max Revive (team) revive o time inteiro com 1 uso', () => {
    let s = createInitialState(SEED)
    s.roster = [
      makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 0, status: 'fainted' }),
      makeMon({ id: 'b', baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 0, status: 'fainted' }),
    ]
    s.inventory = [{ itemId: 'max-revive', quantity: 1 }]
    s = reducer(s, { type: 'USE_ITEM', itemId: 'max-revive', targetId: '' })
    expect(s.roster.every((p) => p.currentHp === p.maxHp && p.status === 'idle')).toBe(true)
    expect(s.inventory).toEqual([])
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
    expect(s.gold).toBe(1500) // 2000 − 500
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'eviolite' }) // já possui → no-op
    expect(s.gold).toBe(1500)
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
  it('a Pokébola custa 200 e sobe o ballLevel para 1', () => {
    let s = createInitialState(SEED)
    s.gold = 200
    expect(s.run.ballLevel).toBe(0)
    s = reducer(s, { type: 'BUY_BALL' })
    expect(s.run.ballLevel).toBe(1)
    expect(s.gold).toBe(0)
    expect(s.today.purchasedItems).toContain('poke-ball')
  })

  it('a próxima bola (Great Ball) custa 400 e não é comprada duas vezes no mesmo dia', () => {
    let s = createInitialState(SEED)
    s.run.ballLevel = 1 // já tem Pokébola → próxima é Great Ball ($400)
    s.gold = 400
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
    s.gold = 100 // < 400 (Great Ball)
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

describe('Premier Ball (sobe a bola de graça)', () => {
  it('do nível 0 leva à Pokébola (nível 1) cobrando só os 100', () => {
    let s = createInitialState(SEED)
    s.gold = 100
    expect(s.run.ballLevel).toBe(0)
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'premier-ball' })
    expect(s.run.ballLevel).toBe(1)
    expect(s.gold).toBe(0)
    expect(s.today.purchasedItems).toContain('premier-ball')
  })

  it('na Masterball (nível 4) é no-op', () => {
    let s = createInitialState(SEED)
    s.run.ballLevel = 4
    s.gold = 100
    s = reducer(s, { type: 'BUY_ITEM', itemId: 'premier-ball' })
    expect(s.run.ballLevel).toBe(4)
    expect(s.gold).toBe(100)
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

describe('Everstone', () => {
  it('dobra o XP e impede a evolução natural', () => {
    const base = createPokemon({ id: 'p1', speciesId: 1, level: 5, rng: createRng(1) }) // Bulbasaur evolui no 16
    const s = createInitialState(1)
    s.roster = [base]
    s.runItems = ['everstone']
    applyXpGains(s, new Map([['p1', 100000]]), createRng(1))
    // Subiu de nível (XP dobrado) mas NÃO evoluiu (continua Bulbasaur, speciesId 1).
    expect(s.roster[0]!.level).toBeGreaterThan(5)
    expect(s.roster[0]!.speciesId).toBe(1)
  })
  it('sem Everstone, evolui normalmente', () => {
    const base = createPokemon({ id: 'p1', speciesId: 1, level: 5, rng: createRng(1) })
    const s = createInitialState(1)
    s.roster = [base]
    applyXpGains(s, new Map([['p1', 100000]]), createRng(1))
    expect(getSpecies(s.roster[0]!.speciesId).evolvesTo === null || s.roster[0]!.speciesId !== 1).toBe(true)
  })
})

describe('Moon Stone (evolui ignorando o nível)', () => {
  it('evolui um Pokémon do time e cobra 700', () => {
    let s = createInitialState(SEED)
    s.gold = 700
    s.roster = [makeMon({ id: 'a', speciesId: 1, level: 1 })] // Bulbasaur
    s = reducer(s, { type: 'USE_MOON_STONE', pokemonId: 'a' })
    expect(s.roster[0]!.speciesId).toBe(2) // Ivysaur
    expect(s.gold).toBe(0)
  })

  it('evolui um Pokémon da caixa', () => {
    let s = createInitialState(SEED)
    s.gold = 700
    s.box = [makeMon({ id: 'bx', speciesId: 4, level: 1 })] // Charmander
    s = reducer(s, { type: 'USE_MOON_STONE', pokemonId: 'bx' })
    expect(s.box[0]!.speciesId).toBe(5) // Charmeleon
    expect(s.gold).toBe(0)
  })

  it('sem ouro é no-op', () => {
    let s = createInitialState(SEED)
    s.gold = 100
    s.roster = [makeMon({ id: 'a', speciesId: 1, level: 1 })]
    s = reducer(s, { type: 'USE_MOON_STONE', pokemonId: 'a' })
    expect(s.roster[0]!.speciesId).toBe(1)
    expect(s.gold).toBe(100)
  })
})
