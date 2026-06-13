import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { makeMon } from '../engine/testkit.ts'
import { settleFaint } from './runtime.ts'

describe('settleFaint (Fossil — PLAN §4.6 / #5)', () => {
  it('vivo vira idle; sem Fossil, desmaiado fica fainted', () => {
    const s = createInitialState(1)
    expect(settleFaint(s, makeMon({ currentHp: 2, maxHp: 3 })).status).toBe('idle')
    const out = settleFaint(s, makeMon({ currentHp: 0, maxHp: 3 }))
    expect(out.status).toBe('fainted')
    expect(s.today.fossilUsed).toBe(false)
  })

  it('com Fossil, o 1º desmaio do dia revive com HP cheio (1×/dia)', () => {
    const s = createInitialState(1)
    s.runItems = ['fossil']

    const first = settleFaint(s, makeMon({ id: 'a', currentHp: 0, maxHp: 4 }))
    expect(first.status).toBe('idle')
    expect(first.currentHp).toBe(4)
    expect(s.today.fossilUsed).toBe(true)

    // O segundo desmaio do mesmo dia já não é revivido.
    const second = settleFaint(s, makeMon({ id: 'b', currentHp: 0, maxHp: 4 }))
    expect(second.status).toBe('fainted')
  })
})
