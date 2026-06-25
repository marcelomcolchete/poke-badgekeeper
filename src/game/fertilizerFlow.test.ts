import { describe, it, expect } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { findItem } from '../data/items.ts'
import { grantDailyBerry } from './fertilizerFlow.ts'

const BERRY_IDS = ['petaya-berry', 'leppa-berry', 'golden-nanab-berry', 'aguav-berry', 'sitrus-berry', 'rawst-berry']

describe('grantDailyBerry (fertilizer)', () => {
  it('sem fertilizer não dá berry', () => {
    const s = createInitialState(1)
    grantDailyBerry(s)
    expect(s.inventory).toHaveLength(0)
  })
  it('com fertilizer adiciona 1 berry aleatória ao inventário', () => {
    const s = createInitialState(1)
    s.runItems = ['fertilizer']
    grantDailyBerry(s)
    expect(s.inventory).toHaveLength(1)
    expect(BERRY_IDS).toContain(s.inventory[0]!.itemId)
    expect(findItem(s.inventory[0]!.itemId)?.effect.kind).toBe('berry')
  })
})
