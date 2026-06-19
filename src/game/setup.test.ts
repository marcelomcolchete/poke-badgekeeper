import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { startRun } from './setup.ts'
import { shinyFor } from '../engine/shiny.ts'
import { getCity } from '../data/cities.ts'

describe('startRun shiny', () => {
  it('o inicial é shiny exatamente quando shinyFor(pick.seed) é true', () => {
    let shinySeed = 0
    for (let seed = 1; seed < 5000; seed++) {
      if (shinyFor(seed)) {
        shinySeed = seed
        break
      }
    }
    expect(shinySeed).toBeGreaterThan(0)

    const s = createInitialState(123)
    const starter = getCity(s.run.cityIndex).starters[0]!
    startRun(s, [{ speciesId: starter.speciesId, level: starter.level, seed: shinySeed }])
    expect(s.roster[0]!.shiny).toBe(true)
  })

  it('inicial com seed não-shiny não vira shiny', () => {
    let plainSeed = 0
    for (let seed = 1; seed < 5000; seed++) {
      if (!shinyFor(seed)) {
        plainSeed = seed
        break
      }
    }
    const s = createInitialState(123)
    const starter = getCity(s.run.cityIndex).starters[0]!
    startRun(s, [{ speciesId: starter.speciesId, level: starter.level, seed: plainSeed }])
    expect(s.roster[0]!.shiny).toBeUndefined()
  })
})
