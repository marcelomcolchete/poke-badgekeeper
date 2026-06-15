import { describe, expect, it } from 'vitest'
import { makeMon } from '../engine/testkit.ts'
import { settleFaint } from './runtime.ts'

describe('settleFaint', () => {
  it('vivo vira idle; desmaiado (HP ≤ 0) fica fainted', () => {
    expect(settleFaint(makeMon({ currentHp: 2, maxHp: 3 })).status).toBe('idle')
    expect(settleFaint(makeMon({ currentHp: 0, maxHp: 3 })).status).toBe('fainted')
  })
})
