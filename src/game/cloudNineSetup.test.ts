import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { setupDay } from './setup.ts'

/** Estado em Cerulean (dia 7) com um roster dado, pronto para setupDay. */
function dayState(mons: ReturnType<typeof createPokemon>[]) {
  const s = createInitialState(123)
  s.run.cityIndex = 1
  s.run.day = 7
  s.roster = mons
  return s
}

describe('Cloud Nine no setupDay', () => {
  it('cada portador L1 soma +10pp à chance de chuva do dia', () => {
    const noCN = dayState([createPokemon({ id: 'p1', speciesId: 19, level: 5, rng: createRng(1) })])
    setupDay(noCN)
    const cn = dayState([createPokemon({ id: 'p1', speciesId: 54 /* Psyduck */, level: 5, rng: createRng(1) })])
    // Psyduck (54) par = ['sa-surf','sa-cloud-nine']; Cloud Nine no slot 1.
    cn.roster[0] = { ...cn.roster[0]!, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }
    setupDay(cn)
    expect(cn.weather.forecast.rainChancePercent).toBe(
      Math.min(100, noCN.weather.forecast.rainChancePercent + 10),
    )
  })

  it('dois portadores L1 somam +20pp (acumula por portador)', () => {
    const noCN = dayState([createPokemon({ id: 'p1', speciesId: 19, level: 5, rng: createRng(1) })])
    setupDay(noCN)
    const two = dayState([
      { ...createPokemon({ id: 'p1', speciesId: 54, level: 5, rng: createRng(1) }), secretPicks: [{ slot: 0, level: 1 as const }, { slot: 1, level: 1 as const }] },
      { ...createPokemon({ id: 'p2', speciesId: 54, level: 5, rng: createRng(2) }), secretPicks: [{ slot: 0, level: 1 as const }, { slot: 1, level: 1 as const }] },
    ])
    setupDay(two)
    expect(two.weather.forecast.rainChancePercent).toBe(
      Math.min(100, noCN.weather.forecast.rainChancePercent + 20),
    )
  })
})
