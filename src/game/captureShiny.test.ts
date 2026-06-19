import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import { readySearch, capturePick } from './captureFlow.ts'
import { shinyFor } from '../engine/shiny.ts'

/** Prepara um estado com um search pronto num spot e dispara o encontro. */
function encounterAt(seed: number, day: number, spotIndex: number) {
  const s = autoSeedRun(seed)
  s.run.day = day
  s.gym.types = ['water'] // pool não-vazio garantido
  s.captureSpots = ['gym']
  const searcher = s.roster[0]!
  const search = {
    searcherId: searcher.id,
    spotIndex,
    node: 'gym',
    path: ['gym'],
    flying: false,
    surfing: false,
    phase: 'searching' as const,
    departAtMs: 0,
    arriveAtMs: 0,
    readyAtMs: 0,
  }
  s.captureSearches = [search]
  readySearch(s, search)
  return s
}

describe('captura shiny', () => {
  it('grava candidateShiny coerente com shinyFor(seed, day, spot, slot)', () => {
    const seed = 777
    const day = 3
    const spot = 0
    const s = encounterAt(seed, day, spot)
    const enc = s.encounters[0]!
    expect(enc.candidateShiny).toBeDefined()
    enc.candidateShiny!.forEach((flag, i) => {
      expect(flag).toBe(shinyFor(seed, day, spot, i))
    })
  })

  it('capturar um candidato shiny produz um Pokémon shiny', () => {
    let s = encounterAt(1, 3, 0)
    let i = 0
    for (let seed = 1; seed < 5000; seed++) {
      s = encounterAt(seed, 3, 0)
      const idx = s.encounters[0]!.candidateShiny!.findIndex(Boolean)
      if (idx >= 0) {
        i = idx
        break
      }
    }
    const searcherId = s.encounters[0]!.searcherId
    capturePick(s, searcherId, i)
    const caught = [...s.roster, ...s.box].find((p) => p.shiny)
    expect(caught).toBeDefined()
  })
})
