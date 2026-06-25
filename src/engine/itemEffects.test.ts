import { describe, expect, it } from 'vitest'
import { getSpecies } from '../data/pokemon/index.ts'
import {
  itemBattleMultiplier,
  itemMissionMultiplier,
  itemTravelSpeedMultiplier,
  notFinalEvolution,
} from './itemEffects.ts'
import { makeMon } from './testkit.ts'

// Bulbasaur (1) ainda evolui; Venusaur (3) é a forma final.
const BULBASAUR = 1
const VENUSAUR = 3

describe('itemMissionMultiplier', () => {
  it('sem itens passivos = 1', () => {
    expect(itemMissionMultiplier(makeMon({ speciesId: BULBASAUR }), [])).toBe(1)
  })

  it('Eviolite vale só para quem ainda não chegou à última evolução', () => {
    expect(getSpecies(VENUSAUR).evolvesTo).toBeNull()
    expect(notFinalEvolution(makeMon({ speciesId: BULBASAUR }))).toBe(true)
    expect(itemMissionMultiplier(makeMon({ speciesId: BULBASAUR }), ['eviolite'])).toBeCloseTo(1.1)
    expect(itemMissionMultiplier(makeMon({ speciesId: VENUSAUR }), ['eviolite'])).toBe(1)
  })

  it('Lagging Tail dá +50% a todos e é multiplicativo com Eviolite', () => {
    expect(itemMissionMultiplier(makeMon({ speciesId: VENUSAUR }), ['lagging-tail'])).toBeCloseTo(1.5)
    expect(itemMissionMultiplier(makeMon({ speciesId: BULBASAUR }), ['eviolite', 'lagging-tail'])).toBeCloseTo(1.65)
  })
})

describe('itemBattleMultiplier', () => {
  it('Thick Club vale só para o tipo Ground', () => {
    expect(itemBattleMultiplier(makeMon({ types: ['ground'] }), ['thick-club'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(makeMon({ types: ['normal'] }), ['thick-club'])).toBe(1)
  })

  it('Mystic Water vale só para o tipo Water', () => {
    expect(itemBattleMultiplier(makeMon({ types: ['water'] }), ['mystic-water'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(makeMon({ types: ['normal'] }), ['mystic-water'])).toBe(1)
  })

  it('Lagging Tail dá +50% em batalha a todos', () => {
    expect(itemBattleMultiplier(makeMon({ types: ['normal'] }), ['lagging-tail'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(makeMon({ types: ['ground'] }), ['thick-club', 'lagging-tail'])).toBeCloseTo(2.25)
  })

  it('Dragon Fang dá +50% só para o tipo Dragão', () => {
    expect(itemBattleMultiplier(makeMon({ types: ['dragon'] }), ['dragon-fang'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(makeMon({ types: ['normal', 'flying'] }), ['dragon-fang'])).toBe(1)
  })

  it('Magnet dá +50% só para o tipo Elétrico', () => {
    expect(itemBattleMultiplier(makeMon({ types: ['electric'] }), ['magnet'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(makeMon({ types: ['normal'] }), ['magnet'])).toBe(1)
  })

  it('Fossil Stone dá +50% para Pokémon fóssil (espécies 138–142)', () => {
    expect(itemBattleMultiplier(makeMon({ speciesId: 138 }), ['fossil-stone'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(makeMon({ speciesId: 142 }), ['fossil-stone'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(makeMon({ speciesId: 25 }), ['fossil-stone'])).toBe(1)
  })
})

describe('itemBattleMultiplier — boosts por tipo novos', () => {
  it('Grassy Seed: +50% para Grama', () => {
    const grass = makeMon({ speciesId: BULBASAUR, types: ['grass', 'poison'] })
    expect(itemBattleMultiplier(grass, ['grassy-seed'])).toBeCloseTo(1.5)
  })
  it('Black Sludge: +50% para Veneno', () => {
    const poison = makeMon({ speciesId: BULBASAUR, types: ['grass', 'poison'] })
    expect(itemBattleMultiplier(poison, ['black-sludge'])).toBeCloseTo(1.5)
  })
  it('não afeta tipos diferentes', () => {
    const fireMon = makeMon({ speciesId: 4, types: ['fire'] })
    expect(itemBattleMultiplier(fireMon, ['grassy-seed'])).toBe(1)
    expect(itemBattleMultiplier(fireMon, ['charcoal'])).toBeCloseTo(1.5)
  })
})

describe('itemTravelSpeedMultiplier', () => {
  it('Lagging Tail deixa 50% mais lento; sem ele = 1', () => {
    expect(itemTravelSpeedMultiplier([])).toBe(1)
    expect(itemTravelSpeedMultiplier(['lagging-tail'])).toBeCloseTo(0.5)
  })
})
