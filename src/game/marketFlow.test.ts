import { describe, it, expect } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { effectiveAttr } from '../engine/attributes.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { buyItem, applyItem } from './marketFlow.ts'
import { buyItem as buyItem2 } from './marketFlow.ts'

function stateWithMon() {
  const s = createInitialState(1)
  const mon = createPokemon({ id: 'p1', speciesId: 1, level: 5, rng: createRng(1) })
  s.roster = [{ ...mon, currentHp: 1 }]
  s.gold = 1000
  return s
}

describe('Poke Egg', () => {
  it('compra adiciona um ovo incubando com daysElapsed 0', () => {
    const s = createInitialState(1)
    s.gold = 1000
    buyItem2(s, 'poke-egg')
    expect(s.eggs).toHaveLength(1)
    expect(s.eggs[0]!.daysElapsed).toBe(0)
    expect(s.gold).toBe(500)
  })
})

describe('air-balloon', () => {
  it('compra fixa usos em [20,30] e adiciona à run', () => {
    const s = createInitialState(1)
    s.gold = 2000
    buyItem(s, 'air-balloon')
    expect(s.runItems).toContain('air-balloon')
    expect(s.airBalloon!.usesLeft).toBeGreaterThanOrEqual(20)
    expect(s.airBalloon!.usesLeft).toBeLessThanOrEqual(30)
  })
})

describe('berry (petaya = batalha)', () => {
  it('compra vai pro inventário e o uso cura 25% + dá +2 permanente de batalha', () => {
    const s = stateWithMon()
    const before = effectiveAttr(s.roster[0]!, 'batalha')
    buyItem(s, 'petaya-berry')
    expect(s.inventory.find((i) => i.itemId === 'petaya-berry')?.quantity).toBe(1)
    applyItem(s, 'petaya-berry', 'p1')
    expect(effectiveAttr(s.roster[0]!, 'batalha')).toBe(before + 2)
    expect(s.roster[0]!.currentHp).toBeGreaterThan(1) // curou
    expect(s.inventory.find((i) => i.itemId === 'petaya-berry')).toBeUndefined() // consumiu
  })
})
