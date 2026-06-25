import { describe, it, expect } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { EGG_INCUBATION_DAYS } from '../engine/constants.ts'
import { incubateEggs } from './eggFlow.ts'

describe('incubateEggs', () => {
  it('avança a incubação e eclode no 3º dia, indo pro time quando há vaga', () => {
    const s = createInitialState(1)
    s.eggs = [{ id: 'egg1', daysElapsed: 0 }]
    incubateEggs(s) // 1/3
    expect(s.eggs[0]!.daysElapsed).toBe(1)
    incubateEggs(s) // 2/3
    incubateEggs(s) // choca
    expect(s.eggs).toHaveLength(0)
    expect(s.roster).toHaveLength(1)
    expect(s.pendingHatches).toHaveLength(1)
    expect(s.pendingHatches[0]!.toTeam).toBe(true)
  })
  it('vai pro PC quando o time está cheio', () => {
    const s = createInitialState(1)
    // Time cheio (6 placeholders mínimos via createPokemon seria ideal; aqui foca na regra de vaga).
    s.roster = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}` } as never))
    s.eggs = [{ id: 'egg1', daysElapsed: EGG_INCUBATION_DAYS - 1 }]
    incubateEggs(s)
    expect(s.box).toHaveLength(1)
    expect(s.pendingHatches[0]!.toTeam).toBe(false)
  })
})
