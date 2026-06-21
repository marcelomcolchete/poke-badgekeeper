import { describe, expect, it } from 'vitest'
import { makeMon } from '../engine/testkit.ts'
import {
  SECRET_KINDS, SECRET_LINES, secretLineFor, secretLevelOf, hasSecret, activeSecrets,
  type SecretId,
} from './secretAbilities.ts'

const CERULEAN_PAIRS: Record<number, readonly [SecretId, SecretId]> = {
  7: ['sa-surf', 'sa-torrent'],
  54: ['sa-surf', 'sa-cloud-nine'],
  60: ['sa-surf', 'sa-water-absorb'],
  72: ['sa-clear-body', 'sa-surf'],
  79: ['sa-regenerator', 'sa-own-tempo'],
  86: ['sa-surf', 'sa-thick-fat'],
  90: ['sa-shell-armor', 'sa-overcoat'],
  98: ['sa-dig', 'sa-shell-armor'],
  116: ['sa-surf', 'sa-sniper'],
  118: ['sa-surf', 'sa-swift-swim'],
  120: ['sa-analytic', 'sa-natural-cure'],
  124: ['sa-ice-body', 'sa-forewarn'],
  129: ['sa-surf', 'sa-moxie'],
  131: ['sa-surf', 'sa-shell-armor'],
  138: ['sa-swift-swim', 'sa-shell-armor'],
  140: ['sa-battle-armor', 'sa-swift-swim'],
  144: ['sa-fly', 'sa-pressure'],
}

describe('Linhas (pares) e níveis', () => {
  it('cada raiz mapeia para o par do spec', () => {
    for (const [root, pair] of Object.entries(CERULEAN_PAIRS)) {
      expect(secretLineFor(Number(root)), `linha ${root}`).toEqual(pair)
    }
  })

  it('formas evoluídas herdam a raiz', () => {
    expect(secretLineFor(9)).toEqual(secretLineFor(7)) // Blastoise = Squirtle
  })

  it('eeveelutions têm par próprio sem vazar', () => {
    expect(secretLineFor(134)).toEqual(['sa-surf', 'sa-water-absorb']) // Vaporeon
    expect(secretLineFor(135)).toEqual(['sa-quick-feet', 'sa-volt-absorb']) // Jolteon
    expect(secretLineFor(133)).toBeNull() // Eevee
    expect(secretLineFor(136)).toBeNull() // Flareon
  })

  it('secretLevelOf reflete slot+level dos picks', () => {
    // Squirtle (7): slot 0 = sa-surf, slot 1 = sa-torrent
    const base = makeMon({ speciesId: 7 })
    expect(secretLevelOf(base, 'sa-surf')).toBe(0)

    const l1 = makeMon({ speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] })
    expect(secretLevelOf(l1, 'sa-surf')).toBe(1)
    expect(secretLevelOf(l1, 'sa-torrent')).toBe(0)
    expect(hasSecret(l1, 'sa-surf')).toBe(true)

    const plus = makeMon({ speciesId: 7, secretPicks: [{ slot: 0, level: 2 }] })
    expect(secretLevelOf(plus, 'sa-surf')).toBe(2)

    const wide = makeMon({ speciesId: 7, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] })
    expect(secretLevelOf(wide, 'sa-surf')).toBe(1)
    expect(secretLevelOf(wide, 'sa-torrent')).toBe(1)
    expect(activeSecrets(wide)).toEqual([
      { id: 'sa-surf', level: 1 },
      { id: 'sa-torrent', level: 1 },
    ])
  })

  it('todo id das linhas existe no catálogo', () => {
    const ids = new Set(Object.values(SECRET_LINES).flat() as SecretId[])
    for (const id of ids) expect(SECRET_KINDS[id]).toBeDefined()
  })
})
