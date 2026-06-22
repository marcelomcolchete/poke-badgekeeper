import { describe, expect, it } from 'vitest'
import type { GameState } from '../engine/state.ts'
import { createInitialState } from '../engine/state.ts'
import { assignDefense, penalizeUndefendedGym } from './defenseFlow.ts'
import { makeAttrs, makeMon } from '../engine/testkit.ts'
import type { EnemyUnit } from '../engine/gymDefense.ts'
import type { DefenseEvent } from '../engine/state.ts'
import { STARS_STEP } from '../engine/constants.ts'

describe('penalizeUndefendedGym', () => {
  it('tira 1 estrela cheia, exclui a defesa do ratio e NÃO encerra a run se sobrar estrela', () => {
    const s = createInitialState(1)
    s.approval.battleStars = 5
    s.today.defensesTotal = 2
    s.clock.speed = 1
    penalizeUndefendedGym(s)
    expect(s.approval.battleStars).toBe(4)
    expect(s.today.defensesTotal).toBe(1)
    expect(s.run.phase).not.toBe('GAMEOVER')
    expect(s.clock.speed).toBe(1)
  })

  it('chegar a 0 estrelas encerra a run com motivo gym e congela o relógio', () => {
    const s = createInitialState(1)
    s.approval.battleStars = STARS_STEP * 2 // exatamente 1 estrela cheia
    s.today.defensesTotal = 1
    s.clock.speed = 1
    penalizeUndefendedGym(s)
    expect(s.approval.battleStars).toBe(0)
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.run.gameOverReason).toBe('gym')
    expect(s.clock.speed).toBe(0)
  })
})

describe('assignDefense — propagação de permaBonus (Moxie)', () => {
  function makeState(over: Partial<GameState> = {}): GameState {
    return {
      ...createInitialState(1),
      run: { cityIndex: 0, day: 1, seed: 1, phase: 'DAY', ballLevel: 0, theftChance: 1, specialChances: [] },
      gym: { types: ['normal'] },
      ...over,
    }
  }

  it('permaBonus do Moxie é propagado do squad para o roster após assignDefense', () => {
    // Gyarados (130) com Moxie L1 (slot 1). Vence 2 inimigos fracos.
    const gyara = makeMon({
      id: 'g',
      speciesId: 130,
      secretPicks: [{ slot: 1, level: 1 }],
      types: ['normal'],
      baseAttrs: makeAttrs({ batalha: 50, resistencia: 100 }),
    })
    const defense: DefenseEvent = {
      id: 'def1',
      pos: { x: 0.5, y: 0.5 },
      spawnAtMs: 0,
      expiresAtMs: 40_000,
      status: 'active',
      trainerId: 'YOUNGSTER',
      squadIds: [],
      enemies: [
        { battle: 1, types: ['normal'] },
        { battle: 1, types: ['normal'] },
      ] as EnemyUnit[],
      duels: [],
    }
    const s = makeState({ roster: [gyara], defenses: [defense] })
    s.today.defensesTotal = 1
    assignDefense(s, 'def1', ['g'])
    const updated = s.roster.find((p) => p.id === 'g')
    // 2 vitórias → permaBonus.batalha deve ser 2
    expect(updated?.permaBonus?.batalha).toBe(2)
  })
})
