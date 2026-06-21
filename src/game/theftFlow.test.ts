import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import {
  eligibleTheftTargets,
  rollTheftAtDayOpen,
  spawnTheft,
  dispatchTheftChasers,
  processTheft,
  resolveTheftBattle,
  completeTheftBattle,
  resolveTheftLoss,
} from './theftFlow.ts'
import { heartsOf } from '../engine/hearts.ts'
import { THEFT_CHANCE_START } from '../engine/balance.ts'
import { makeMon } from '../engine/testkit.ts'
import { zeroAttrs } from '../engine/attributes.ts'
import type { GameState } from '../engine/state.ts'
import { createInitialState } from '../engine/state.ts'

const zero = zeroAttrs()

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

describe('processTheft — fuga e chegada', () => {
  it("fleeing → atFarNode quando now ≥ arriveAtMs", () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' })]
    spawnTheft(s, 0)
    const arrive = s.theft!.arriveAtMs
    processTheft(s, arrive + 1)
    expect(s.theft!.phase).toBe('atFarNode')
  })

  it("atFarNode → resolved (perda) quando a graça expira sem interceptação", () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'p2', status: 'idle' })]
    spawnTheft(s, 0)
    const grace = s.theft!.graceUntilMs
    const heartsBefore = heartsOf(s.roster.find((p) => p.id === 'p2')!.hearts)
    processTheft(s, grace + 1)
    expect(s.theft!.phase).toBe('resolved')
    expect(s.roster.find((p) => p.id === 'p1')).toBeUndefined() // removido
    expect(heartsOf(s.roster.find((p) => p.id === 'p2')!.hearts)).toBe(heartsBefore - 1) // −1 coração (B7)
  })
})

describe('dispatchTheftChasers', () => {
  it('despacha no máx. 3 idle e marca defending', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle' }), // será o alvo
      makeMon({ id: 'c1', status: 'idle' }),
      makeMon({ id: 'c2', status: 'idle' }),
      makeMon({ id: 'c3', status: 'idle' }),
      makeMon({ id: 'c4', status: 'idle' }),
    ]
    spawnTheft(s, 0)
    dispatchTheftChasers(s, ['c1', 'c2', 'c3', 'c4'])
    expect(s.theft!.chaserIds.length).toBe(3)
    expect(s.roster.find((p) => p.id === 'c1')!.status).toBe('defending')
  })
})

describe('resolveTheftBattle', () => {
  it('vitória recupera o Pokémon (idle, mesmo HP) e reseta a perseguição', () => {
    const s = dayState()
    s.run.day = 1
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle', currentHp: 3, maxHp: 3 }), // alvo (HP 3)
      makeMon({ id: 'c1', status: 'idle', baseAttrs: { ...zero, batalha: 60 } }),
    ]
    spawnTheft(s, 0)
    s.theft!.enemies = [{ battle: 1, types: ['normal'] }] // garante vitória do c1
    dispatchTheftChasers(s, ['c1'])
    s.theft!.phase = 'battle'
    resolveTheftBattle(s)
    expect(s.theft!.won).toBe(true)
    const recovered = s.roster.find((p) => p.id === 'p1')!
    expect(recovered.status).toBe('idle')
    expect(recovered.currentHp).toBe(3) // mesmo HP
  })

  it('derrota: resolveTheftBattle não finaliza ainda (mon presente, fase battle)', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle' }),
      makeMon({ id: 'c1', status: 'idle', baseAttrs: { ...zero, batalha: 1 } }),
    ]
    spawnTheft(s, 0)
    s.theft!.enemies = [{ battle: 60, types: ['normal'] }] // c1 perde
    dispatchTheftChasers(s, ['c1'])
    s.theft!.phase = 'battle'
    resolveTheftBattle(s)
    // Após resolveTheftBattle isolado: derrota gravada mas mon ainda presente (UI anima a batalha).
    expect(s.theft!.won).toBe(false)
    expect(s.theft!.resolved).toBe(true)
    expect(s.theft!.phase).toBe('battle') // ainda na fase battle (não resolved)
    expect(s.roster.find((p) => p.id === 'p1')).toBeDefined() // mon ainda presente
  })

  it('derrota: completeTheftBattle finaliza — remove mon e tira 1 coração do roster', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle' }),
      makeMon({ id: 'c1', status: 'idle', baseAttrs: { ...zero, batalha: 1 } }),
    ]
    spawnTheft(s, 0)
    s.theft!.enemies = [{ battle: 60, types: ['normal'] }] // c1 perde
    dispatchTheftChasers(s, ['c1'])
    s.theft!.phase = 'battle'
    const before = heartsOf(s.roster.find((p) => p.id === 'c1')!.hearts)
    resolveTheftBattle(s)
    completeTheftBattle(s) // finaliza a perda após animação
    expect(s.theft!.won).toBe(false)
    expect(s.theft!.phase).toBe('resolved')
    expect(s.roster.find((p) => p.id === 'p1')).toBeUndefined() // removido
    expect(heartsOf(s.roster.find((p) => p.id === 'c1')!.hearts)).toBe(before - 1) // −1 coração (B7)
  })
})

describe('resolveTheftLoss', () => {
  it('remove o Pokémon roubado e tira 1 coração dos restantes, fase resolved', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'p2', status: 'idle' })]
    spawnTheft(s, 0)
    const before = heartsOf(s.roster.find((p) => p.id === 'p2')!.hearts)
    resolveTheftLoss(s)
    expect(s.theft!.phase).toBe('resolved')
    expect(s.roster.find((p) => p.id === 'p1')).toBeUndefined()
    expect(heartsOf(s.roster.find((p) => p.id === 'p2')!.hearts)).toBe(before - 1) // −1 coração (B7)
  })
})

describe('completeTheftBattle', () => {
  it('após vitória: aplica XP e marca resolved', () => {
    const s = dayState()
    s.run.day = 1
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle', currentHp: 3, maxHp: 3 }),
      makeMon({ id: 'c1', status: 'idle', baseAttrs: { ...zero, batalha: 60 } }),
    ]
    spawnTheft(s, 0)
    s.theft!.enemies = [{ battle: 1, types: ['normal'] }]
    dispatchTheftChasers(s, ['c1'])
    s.theft!.phase = 'battle'
    resolveTheftBattle(s)
    expect(s.theft!.won).toBe(true) // pré-condição
    completeTheftBattle(s)
    expect(s.theft!.phase).toBe('resolved')
  })
})

describe('completeTheftBattle — derrotas da Rocket no Destaque', () => {
  it('registra um defenseKill por duelo vencido (defeaterId + speciesId)', () => {
    const s = createInitialState(1)
    s.theft = {
      phase: 'battle',
      won: true,
      resolved: true,
      trainerId: 'ROCKET',
      stolenId: undefined,
      chaserIds: ['a', 'b'],
      chaserArriveAtMs: [],
      chaserStartAtMs: [],
      targetNode: 'g',
      enemies: [
        { battle: 10, speciesId: 19, types: ['normal'] },
        { battle: 12, speciesId: 16, types: ['normal'] },
      ],
      duels: [
        { yourId: 'a', youWon: true },
        { yourId: 'b', youWon: true },
      ],
      xpSeed: 1,
    } as unknown as typeof s.theft

    completeTheftBattle(s)

    expect(s.today.defenseKills).toHaveLength(2)
    expect(s.today.defenseKills[0]).toMatchObject({ defeaterId: 'a', speciesId: 19 })
    expect(s.today.defenseKills[1]).toMatchObject({ defeaterId: 'b', speciesId: 16 })
  })
})
