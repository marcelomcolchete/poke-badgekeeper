import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { applySpore, autoSeedRun, setupDay, startRun } from './setup.ts'
import { setSpeed } from './phaseFlow.ts'
import { shinyFor } from '../engine/shiny.ts'
import { getCity } from '../data/cities.ts'
import { makeAttrs, makeMon } from '../engine/testkit.ts'

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

describe('applySpore', () => {
  it('grava secretBuffs (não dayBuffs) e recalcula HP no início do dia (L2 = 3 eixos)', () => {
    const s = autoSeedRun(1)
    // Oddish(43): slot1 = sa-spore L2; resistência alta para o buff poder mexer no maxHp.
    s.roster = [makeMon({ id: 'p', speciesId: 43, baseAttrs: makeAttrs({ resistencia: 50 }, 30), secretPicks: [{ slot: 1, level: 2 }] })]
    const before = s.roster[0]!.maxHp
    applySpore(s)
    const after = s.roster[0]!
    expect(Object.keys(after.secretBuffs ?? {}).length).toBe(3)
    expect(after.dayBuffs, 'Spore não escreve em dayBuffs (não vira item na barra)').toBeUndefined()
    expect(after.currentHp).toBe(after.maxHp) // começa o dia cheio
    expect(after.maxHp).toBeGreaterThanOrEqual(before) // resistência buffada pode subir o HP
  })

  it('não altera Pokémon sem Spore', () => {
    const s = autoSeedRun(1)
    s.roster = [makeMon({ id: 'p', speciesId: 1, baseAttrs: makeAttrs() })]
    applySpore(s)
    expect(s.roster[0]!.secretBuffs).toBeUndefined()
    expect(s.roster[0]!.dayBuffs).toBeUndefined()
  })
})

describe('velocidade do relógio entre dias', () => {
  it('setSpeed lembra a velocidade de jogo (1/2/3) mas ignora a pausa (0)', () => {
    const s = autoSeedRun(1)
    setSpeed(s, 3)
    expect(s.clock.daySpeed).toBe(3)
    setSpeed(s, 0) // pausa não sobrescreve a preferência
    expect(s.clock.daySpeed).toBe(3)
  })

  it('setupDay reabre o relógio na velocidade do dia anterior', () => {
    const s = autoSeedRun(1)
    setSpeed(s, 3)
    setupDay(s)
    expect(s.clock.speed).toBe(3)
  })

  it('setupDay cai em 1× quando nunca houve velocidade de jogo (1º dia)', () => {
    const s = autoSeedRun(1)
    setupDay(s)
    expect(s.clock.speed).toBe(1)
  })
})
