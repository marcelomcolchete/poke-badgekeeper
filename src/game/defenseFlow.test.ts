import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { loseRunByUndefendedGym } from './defenseFlow.ts'

describe('loseRunByUndefendedGym', () => {
  it('zera as estrelas de batalha e encerra a run com motivo gym', () => {
    const s = createInitialState(1)
    s.approval.battleStars = 5
    loseRunByUndefendedGym(s)
    expect(s.approval.battleStars).toBe(0)
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.run.gameOverReason).toBe('gym')
    expect(s.clock.speed).toBe(0)
  })
})
