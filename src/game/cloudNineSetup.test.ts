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
  it('cada portador soma +25pp à chance de chuva do dia', () => {
    const noCN = dayState([createPokemon({ id: 'p1', speciesId: 19, level: 5, rng: createRng(1) })])
    setupDay(noCN)
    const cn = dayState([createPokemon({ id: 'p1', speciesId: 54 /* Psyduck */, level: 5, rng: createRng(1) })])
    cn.roster[0] = { ...cn.roster[0]!, secretCount: 3 } // Cloud Nine desbloqueado (posição 3 da linha)
    setupDay(cn)
    expect(cn.weather.forecast.rainChancePercent).toBe(
      Math.min(100, noCN.weather.forecast.rainChancePercent + 25),
    )
  })

  it('dois portadores somam +50pp (acumula por portador)', () => {
    const noCN = dayState([createPokemon({ id: 'p1', speciesId: 19, level: 5, rng: createRng(1) })])
    setupDay(noCN)
    const two = dayState([
      { ...createPokemon({ id: 'p1', speciesId: 54, level: 5, rng: createRng(1) }), secretCount: 3 },
      { ...createPokemon({ id: 'p2', speciesId: 54, level: 5, rng: createRng(2) }), secretCount: 3 },
    ])
    setupDay(two)
    expect(two.weather.forecast.rainChancePercent).toBe(
      Math.min(100, noCN.weather.forecast.rainChancePercent + 50),
    )
  })
})
