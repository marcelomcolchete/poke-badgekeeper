import { describe, expect, it } from 'vitest'
import { makeMon } from '../engine/testkit.ts'
import { secretLevelOf } from '../data/secretAbilities.ts'
import { prepareSecretChoice, chooseSecretAbility } from './phaseFlow.ts'
import { createInitialState, type GameState } from '../engine/state.ts'

function stateWith(mon: ReturnType<typeof makeMon>): GameState {
  const s = createInitialState(1)
  s.roster = [mon]
  return s
}

describe('prepareSecretChoice', () => {
  it('Destaque sem picks → escolha pendente (1º destaque), sem mutar picks', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 })) // Squirtle [surf, torrent]
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toEqual({ pokemonId: 'p1' })
    expect(s.today.secretUnlock).toBeNull()
    expect(s.roster[0]!.secretPicks ?? []).toEqual([])
  })

  it('Destaque com 1 pick nível 1 → escolha pendente (2º destaque)', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toEqual({ pokemonId: 'p1' })
  })

  it('Destaque já com 2 picks → sem escolha', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }))
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toBeNull()
  })

  it('Destaque com 1 pick nível 2 → sem escolha', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 2 }] }))
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toBeNull()
  })

  it('sem MVP ou sem linha → sem escolha', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 19 })) // Rattata: sem linha secreta
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toBeNull()
    prepareSecretChoice(s, null)
    expect(s.today.secretChoice).toBeNull()
  })
})

describe('chooseSecretAbility', () => {
  it('1º destaque: escolhe slot 1 → nível 1, reveal choice=first', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 }))
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 1, 1)
    expect(s.roster[0]!.secretPicks).toEqual([{ slot: 1, level: 1 }])
    expect(s.today.secretUnlock).toMatchObject({ pokemonId: 'p1', slot: 1, level: 1, choice: 'first' })
    expect(s.today.secretChoice).toBeNull()
  })

  it('2º destaque aprofundar: mesmo slot → nível 2, choice=deepen', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 0, 2)
    expect(s.roster[0]!.secretPicks).toEqual([{ slot: 0, level: 2 }])
    expect(s.today.secretUnlock).toMatchObject({ slot: 0, level: 2, choice: 'deepen' })
  })

  it('2º destaque ampliar: outro slot → nível 1, choice=widen', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 1, 1)
    expect(secretLevelOf(s.roster[0]!, 'sa-surf')).toBe(1)
    expect(secretLevelOf(s.roster[0]!, 'sa-torrent')).toBe(1)
    expect(s.today.secretUnlock).toMatchObject({ slot: 1, level: 1, choice: 'widen' })
  })

  it('rejeita escolha ilegal (sem escolha pendente, ou transição inválida)', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 }))
    // sem secretChoice pendente
    chooseSecretAbility(s, 0, 1)
    expect(s.roster[0]!.secretPicks ?? []).toEqual([])
    // pendente, mas tentar nível 2 no 1º destaque (ilegal)
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 0, 2)
    expect(s.roster[0]!.secretPicks ?? []).toEqual([])
    expect(s.today.secretChoice).toEqual({ pokemonId: 'p1' }) // permanece pendente
  })
})
