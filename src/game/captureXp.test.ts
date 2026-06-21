import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { makeMon } from '../engine/testkit.ts'
import { capturePick, captureDismiss } from './captureFlow.ts'
import { EXPLORATION_XP } from '../engine/balance.ts'

function withEncounter() {
  const s = createInitialState(1)
  const searcher = makeMon({ id: 's1' })
  s.roster = [searcher]
  s.encounters = [
    {
      searcherId: 's1',
      spotIndex: 0,
      level: 3,
      candidateSpeciesIds: [19],
      candidateLevels: [3],
      candidateSeeds: [1],
      candidateShiny: [false],
      searcherPerception: 0,
    },
  ] as unknown as typeof s.encounters
  return s
}

describe('exploração dá XP ao explorador (item 6)', () => {
  it('recusar (captureDismiss) credita 100 XP ao explorador', () => {
    const s = withEncounter()
    s.today.xpEarned = 0
    captureDismiss(s, 's1')
    expect(s.today.xpEarned).toBe(EXPLORATION_XP)
  })

  it('capturar (capturePick) credita 100 XP ao explorador', () => {
    const s = withEncounter()
    s.today.xpEarned = 0
    capturePick(s, 's1', 0)
    expect(s.today.xpEarned).toBe(EXPLORATION_XP)
  })
})
