// Missão Especial da Cidade (Feature A): conclusão paga 5× o pool de XP direto, SEM batalha.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createMissionInstance } from '../engine/missions.ts'
import { zeroAttrs } from '../engine/attributes.ts'
import { createRng } from '../engine/rng.ts'
import { MISSION_XP_POOL, SPECIAL_XP_MULTIPLIER } from '../engine/balance.ts'
import { makeMon } from '../engine/testkit.ts'
import { freeOnReturn, resolveMissionNow } from './missionFlow.ts'
import type { GameState } from '../engine/state.ts'

/** Estado com 1 Missão Especial 'inProgress', time despachado e exigência trivial (sucesso certo). */
function specialState(): GameState {
  const s = createInitialState(1)
  s.run.day = 5
  s.roster = [makeMon({ id: 'p1', status: 'onMission', baseAttrs: { ...zeroAttrs(), batalha: 50 } })]
  const mission = createMissionInstance({
    id: 'm1',
    rng: createRng(1),
    day: 5,
    category: 'special',
    node: 'd',
    spawnAtMs: 0,
    lifetimeMs: 40_000,
    templateId: 'special',
  })
  mission.teamIds = ['p1']
  mission.status = 'inProgress'
  mission.requirement = zeroAttrs() // P_sucesso = 1
  s.missions = [mission]
  return s
}

describe('Missão Especial', () => {
  it('ao concluir vai direto para returning (sem status battle)', () => {
    const s = specialState()
    resolveMissionNow(s, s.missions[0]!)
    const m = s.missions[0]!
    expect(m.status).toBe('returning')
    expect(m.result).toBe('success')
  })

  it('paga 5× o pool de XP (time de 1 leva tudo), aplicado na volta', () => {
    const s = specialState()
    resolveMissionNow(s, s.missions[0]!)
    const m = s.missions[0]!
    expect(m.xpAwards?.['p1']).toBe(MISSION_XP_POOL * SPECIAL_XP_MULTIPLIER)
    const before = s.today.xpEarned
    freeOnReturn(s, m)
    expect(m.status).toBe('resolved')
    expect(s.today.xpEarned).toBe(before + MISSION_XP_POOL * SPECIAL_XP_MULTIPLIER)
  })
})
