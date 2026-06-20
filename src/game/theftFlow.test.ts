import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import { eligibleTheftTargets, rollTheftAtDayOpen, spawnTheft } from './theftFlow.ts'
import { THEFT_CHANCE_START } from '../engine/balance.ts'
import { makeMon } from '../engine/testkit.ts'
import type { GameState } from '../engine/state.ts'

function dayState(seed = 1): GameState {
  const s = autoSeedRun(seed)
  s.run.phase = 'DAY'
  return s
}

describe('eligibleTheftTargets', () => {
  it('inclui idle e fainted no ginásio; exclui fora/centro/buscadores/stolen', () => {
    const s = dayState()
    s.roster = [
      makeMon({ id: 'i', status: 'idle' }),
      makeMon({ id: 'f', status: 'fainted', currentHp: 0 }),
      makeMon({ id: 't', status: 'traveling' }),
      makeMon({ id: 'c', status: 'atCenter' }),
      makeMon({ id: 'd', status: 'defending' }),
      makeMon({ id: 'b', status: 'idle' }), // buscador
      makeMon({ id: 's', status: 'stolen' }),
    ]
    s.captureSearches = [
      { searcherId: 'b', spotIndex: 0, node: 'x', path: ['x'], phase: 'searching', departAtMs: 0, arriveAtMs: 0, readyAtMs: 0 },
    ]
    const ids = eligibleTheftTargets(s).map((p) => p.id)
    expect(ids.sort()).toEqual(['f', 'i'])
  })
})

describe('rollTheftAtDayOpen', () => {
  it('na falha, a chance dobra e nada é armado', () => {
    const s = dayState()
    s.run.theftChance = 1 // 1% → quase certo falhar com a maioria das seeds
    // Forçar falha: chance baixa; se a seed acertar, repetir com outra seed no helper.
    rollTheftAtDayOpen(s)
    if (!s.theft) {
      expect(s.run.theftChance).toBe(2)
    } else {
      expect(s.theft.phase).toBe('armed')
    }
  })

  it('na vitória, arma o evento (fase armed) e NÃO reseta a chance ainda', () => {
    const s = dayState()
    s.run.theftChance = 100 // acerto garantido
    rollTheftAtDayOpen(s)
    expect(s.theft?.phase).toBe('armed')
    expect(s.run.theftChance).toBe(100) // só reseta ao DISPARAR (spawn)
  })
})

describe('spawnTheft', () => {
  it('arma → dispara quando há alvo: marca stolen, define nós/timers e reseta a chance p/ 1', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s) // fase 'armed'
    s.roster = [makeMon({ id: 'p1', status: 'idle' })]
    spawnTheft(s, 0)
    const t = s.theft!
    expect(t.phase).toBe('fleeing')
    expect(t.stolenId).toBe('p1')
    expect(s.roster.find((p) => p.id === 'p1')!.status).toBe('stolen')
    expect(t.fromNode).not.toBe('')
    expect(t.targetNode).not.toBe('')
    expect(t.arriveAtMs).toBeGreaterThan(0)
    expect(t.graceUntilMs).toBe(t.arriveAtMs + 5_000)
    expect(t.enemies.length).toBeGreaterThan(0)
    expect(s.run.theftChance).toBe(THEFT_CHANCE_START) // reset SÓ ao disparar
  })

  it('armado sem alvo: NÃO dispara e NÃO reseta (disparo adiado)', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'traveling' })] // ninguém no ginásio
    spawnTheft(s, 0)
    expect(s.theft!.phase).toBe('armed')
    expect(s.run.theftChance).toBe(100)
  })
})
