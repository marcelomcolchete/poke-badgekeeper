import { describe, expect, it } from 'vitest'
import type { Attrs } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import { createRng } from './rng.ts'
import {
  createMissionInstance,
  executionMs,
  missionDurationMs,
  missionFailureDamage,
  missionSuccessProbability,
  resolveMission,
  travelMs,
} from './missions.ts'
import { fixedRng, makeAttrs, makeMon } from './testkit.ts'

function template(requirement: Attrs, danger = 4): MissionTemplate {
  return {
    id: 'tpl',
    name: 'Teste',
    themeIcon: '❓',
    requirement,
    baseTravelMs: 20_000,
    baseExecutionMs: 30_000,
    danger,
  }
}

describe('missionSuccessProbability (PLAN §4.2)', () => {
  it('time que cobre todos os eixos da exigência → 1', () => {
    const team = [makeMon({ baseAttrs: makeAttrs({}, 50) })]
    expect(missionSuccessProbability(team, makeAttrs({}, 40))).toBe(1)
  })

  it('time vazio contra exigência positiva → 0', () => {
    expect(missionSuccessProbability([], makeAttrs({}, 50))).toBe(0)
  })

  it('exigência nula → 1', () => {
    const team = [makeMon()]
    expect(missionSuccessProbability(team, makeAttrs({}, 0))).toBe(1)
  })

  it('fica sempre em [0, 1]', () => {
    const team = [makeMon({ baseAttrs: makeAttrs({}, 30) })]
    const p = missionSuccessProbability(team, makeAttrs({}, 80))
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(1)
  })

  it('recompensa o FORMATO: time do eixo certo supera time desbalanceado', () => {
    const req = makeAttrs({ inteligencia: 80, agilidade: 80 }, 10)
    const rightShape = [makeMon({ baseAttrs: makeAttrs({ inteligencia: 50, agilidade: 50 }, 10) })]
    const wrongShape = [makeMon({ baseAttrs: makeAttrs({ batalha: 50, resistencia: 50 }, 10) })]
    expect(missionSuccessProbability(rightShape, req)).toBeGreaterThan(
      missionSuccessProbability(wrongShape, req),
    )
  })

  it('soma do time é capada em 100 por eixo', () => {
    const big = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }), allocations: undefined })
    const team = [big, big, big] // 3×50 = 150 → cap 100
    const req = makeAttrs({ agilidade: 100 }, 10)
    // Com cap em 100 e exigência 100, o eixo agilidade fica saturado (min = 100).
    expect(missionSuccessProbability(team, req)).toBeGreaterThan(0)
  })
})

describe('missionFailureDamage (PLAN §4.2)', () => {
  it('mínimo de 1 mesmo com P alto', () => {
    expect(missionFailureDamage(0.99, 5)).toBe(1)
    expect(missionFailureDamage(1, 5)).toBe(1)
  })

  it('cresce conforme a falha é mais provável', () => {
    expect(missionFailureDamage(0.2, 10)).toBeGreaterThan(missionFailureDamage(0.8, 10))
  })
})

describe('resolveMission (PLAN §4.2)', () => {
  it('sucesso garantido (P=1) não altera o time', () => {
    const team = [makeMon({ baseAttrs: makeAttrs({}, 50) })]
    const out = resolveMission(fixedRng(0), team, template(makeAttrs({}, 40)))
    expect(out.success).toBe(true)
    expect(out.faintedIds).toEqual([])
    expect(out.team[0]?.currentHp).toBe(team[0]?.currentHp)
  })

  it('falha aplica dano e marca desmaiados (HP→0)', () => {
    const weak = makeMon({ id: 'w', baseAttrs: makeAttrs({}, 10) }) // hp 1
    const out = resolveMission(fixedRng(0.999), [weak], template(makeAttrs({}, 100), 5))
    expect(out.success).toBe(false)
    expect(out.team[0]?.currentHp).toBe(0)
    expect(out.faintedIds).toEqual(['w'])
  })

  it('não muta o time de entrada', () => {
    const weak = makeMon({ id: 'w', baseAttrs: makeAttrs({}, 10) })
    resolveMission(fixedRng(0.999), [weak], template(makeAttrs({}, 100), 5))
    expect(weak.currentHp).toBe(weak.maxHp)
  })
})

describe('tempos de viagem/execução (PLAN §4.3)', () => {
  it('mais Agilidade = menos viagem', () => {
    const slow = [makeMon({ baseAttrs: makeAttrs({ agilidade: 10 }) })]
    const fast = [makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })]
    expect(travelMs(fast, 20_000)).toBeLessThan(travelMs(slow, 20_000))
  })

  it('passiva Fly zera a viagem', () => {
    const flyer = [makeMon({ passives: ['fly'] })]
    expect(travelMs(flyer, 20_000)).toBe(0)
  })

  it('passiva Run Away reduz a viagem', () => {
    const base = [makeMon({ baseAttrs: makeAttrs({ agilidade: 30 }) })]
    const runner = [makeMon({ baseAttrs: makeAttrs({ agilidade: 30 }), passives: ['run-away'] })]
    expect(travelMs(runner, 20_000)).toBeLessThan(travelMs(base, 20_000))
  })

  it('mais Inteligência = menos execução; duração é a soma', () => {
    const dumb = [makeMon({ baseAttrs: makeAttrs({ inteligencia: 10 }) })]
    const smart = [makeMon({ baseAttrs: makeAttrs({ inteligencia: 50 }) })]
    expect(executionMs(smart, 30_000)).toBeLessThan(executionMs(dumb, 30_000))
    const tpl = template(makeAttrs({}, 20))
    expect(missionDurationMs(smart, tpl)).toBeCloseTo(
      travelMs(smart, tpl.baseTravelMs) + executionMs(smart, tpl.baseExecutionMs),
      6,
    )
  })
})

describe('createMissionInstance (PLAN §3.1)', () => {
  it('é determinística e respeita âncora/timer', () => {
    const anchors = [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }]
    const spec = {
      id: 'm1',
      rng: createRng(7),
      anchors,
      anchorIndex: 1,
      spawnAtMs: 5_000,
      lifetimeMs: 20_000,
    }
    const inst = createMissionInstance({ ...spec, rng: createRng(7) })
    const same = createMissionInstance({ ...spec, rng: createRng(7) })
    expect(inst).toEqual(same)
    expect(inst.pos).toEqual(anchors[1])
    expect(inst.expiresAtMs).toBe(25_000)
    expect(inst.status).toBe('available')
    expect(inst.teamIds).toEqual([])
  })
})
