import { describe, expect, it } from 'vitest'
import { makeMon } from '../engine/testkit.ts'
import { secretLevelOf } from '../data/secretAbilities.ts'
import { unlockSecretAbility } from './phaseFlow.ts'
import { createInitialState } from '../engine/state.ts'

function stateWith(mon: ReturnType<typeof makeMon>) {
  const s = createInitialState(1)
  s.roster = [mon]
  return s
}

describe('unlockSecretAbility (fundação)', () => {
  it('1º destaque grava slot 0 nível 1', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 })) // Squirtle: [surf, torrent]
    unlockSecretAbility(s, 'p1')
    const mon = s.roster[0]!
    expect(secretLevelOf(mon, 'sa-surf')).toBe(1)
    expect(s.today.secretUnlock).toMatchObject({ pokemonId: 'p1', slot: 0, level: 1 })
  })

  it('2º destaque (widen) entra na outra no nível 1', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    unlockSecretAbility(s, 'p1')
    const mon = s.roster[0]!
    expect(secretLevelOf(mon, 'sa-surf')).toBe(1)
    expect(secretLevelOf(mon, 'sa-torrent')).toBe(1)
  })

  it('trava no 2º destaque (não há 3º)', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }))
    unlockSecretAbility(s, 'p1')
    expect(s.roster[0]!.secretPicks).toHaveLength(2)
    expect(s.today.secretUnlock).toBeNull()
  })
})
