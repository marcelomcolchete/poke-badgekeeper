import { describe, expect, it } from 'vitest'
import { ATTR_KEYS } from '../types/index.ts'
import type { CityGraph, MissionTemplate } from '../data/types.ts'
import { TEAM_ATTR_MAX } from './constants.ts'
import { createRng } from './rng.ts'
import { NORMAL_TEMPLATES, POKECENTER_TEMPLATE, ROCKET_TEAM_TEMPLATE } from '../data/missionTemplates.ts'
import {
  agilityTravelFactor,
  createMissionInstance,
  executionMs,
  generateRequirement,
  graphTravelMs,
  missionDurationMs,
  missionFailureDamage,
  missionSuccessProbability,
  resolveMission,
  travelRoute,
} from './missions.ts'
import { fixedRng, makeAttrs, makeMon } from './testkit.ts'

function template(danger = 4): MissionTemplate {
  return {
    id: 'tpl',
    name: 'Teste',
    themeIcon: '❓',
    gen: 'normal',
    primaryAttr: 'batalha',
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

  it('soma do time é capada no teto do time (70) por eixo', () => {
    const big = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }), allocations: undefined })
    const team = [big, big, big] // 3×50 = 150 → cap 70
    const req = makeAttrs({ agilidade: 100 }, 10)
    // Com a soma capada em 70, o eixo agilidade cobre 70 da exigência (min = 70).
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
    const out = resolveMission(fixedRng(0), team, makeAttrs({}, 40), 4)
    expect(out.success).toBe(true)
    expect(out.faintedIds).toEqual([])
    expect(out.team[0]?.currentHp).toBe(team[0]?.currentHp)
  })

  it('falha aplica dano e marca desmaiados (HP→0)', () => {
    const weak = makeMon({ id: 'w', baseAttrs: makeAttrs({}, 10) }) // hp 1
    const out = resolveMission(fixedRng(0.999), [weak], makeAttrs({}, 100), 5)
    expect(out.success).toBe(false)
    expect(out.team[0]?.currentHp).toBe(0)
    expect(out.faintedIds).toEqual(['w'])
  })

  it('não muta o time de entrada', () => {
    const weak = makeMon({ id: 'w', baseAttrs: makeAttrs({}, 10) })
    resolveMission(fixedRng(0.999), [weak], makeAttrs({}, 100), 5)
    expect(weak.currentHp).toBe(weak.maxHp)
  })
})

describe('generateRequirement (rebalanceamento)', () => {
  const patrulha = NORMAL_TEMPLATES[0] as MissionTemplate // primaryAttr 'batalha'

  it('é determinística (mesmo seed + dia + template)', () => {
    const a = generateRequirement(createRng(42), 5, patrulha)
    const b = generateRequirement(createRng(42), 5, patrulha)
    expect(a).toEqual(b)
  })

  it('todo eixo fica em [0, 70]', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { requirement } = generateRequirement(createRng(seed), 7, patrulha)
      for (const key of ATTR_KEYS) {
        expect(requirement[key]).toBeGreaterThanOrEqual(0)
        expect(requirement[key]).toBeLessThanOrEqual(TEAM_ATTR_MAX)
      }
    }
  })

  it('normal: o atributo principal é o mais exigido', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { requirement } = generateRequirement(createRng(seed), 4, patrulha)
      const max = Math.max(...ATTR_KEYS.map((k) => requirement[k]))
      expect(requirement.batalha).toBe(max)
    }
  })

  it('escala com o dia: principal cresce do dia 1 ao dia 9', () => {
    // Usa um seed NÃO-mega (senão o dia 1 poderia já saturar em 60 e empatar).
    let seed = 1
    while (generateRequirement(createRng(seed), 5, patrulha).secondaryAttr === 'batalha') seed++
    const day1 = generateRequirement(createRng(seed), 1, patrulha).requirement.batalha
    const day9 = generateRequirement(createRng(seed), 9, patrulha).requirement.batalha
    expect(day9).toBeGreaterThan(day1)
  })

  it('mega: secundário sorteado igual ao principal concentra tudo num eixo (~70)', () => {
    // Varre seeds até cair no caso mega (secondaryAttr === principal).
    let mega: ReturnType<typeof generateRequirement> | null = null
    for (let seed = 1; seed <= 200 && !mega; seed++) {
      const g = generateRequirement(createRng(seed), 8, patrulha)
      if (g.secondaryAttr === 'batalha') mega = g
    }
    expect(mega).not.toBeNull()
    expect(mega?.requirement.batalha).toBe(TEAM_ATTR_MAX) // principal + secundário no dia 8 satura em 70
  })

  it('special5 (Equipe Rocket): 5 eixos principais + 1 resto e ao menos um no máximo (70)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { requirement, secondaryAttr } = generateRequirement(createRng(seed), 3, ROCKET_TEAM_TEMPLATE)
      expect(secondaryAttr).toBeNull()
      // Principal (dia≥1) sempre > 20; resto sempre ≤ 20 → contagem separa os dois grupos.
      const principals = ATTR_KEYS.filter((k) => requirement[k] > 20).length
      expect(principals).toBe(5)
      // Regra Rocket: pelo menos um dos 5 principais obrigatoriamente no teto.
      expect(ATTR_KEYS.some((k) => requirement[k] === TEAM_ATTR_MAX)).toBe(true)
    }
  })

  it('special2 (pokecenter): ao menos 2 eixos principais e sem subtipo', () => {
    const { requirement, secondaryAttr } = generateRequirement(createRng(3), 4, POKECENTER_TEMPLATE)
    expect(secondaryAttr).toBeNull()
    expect(ATTR_KEYS.filter((k) => requirement[k] > 20).length).toBeGreaterThanOrEqual(2)
  })
})

describe('tempos de viagem/execução (PLAN §4.3)', () => {
  it('mais Agilidade total = menos tempo de viagem', () => {
    const slow = [makeMon({ baseAttrs: makeAttrs({ agilidade: 10 }) })]
    const fast = [makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })]
    expect(graphTravelMs(10, fast)).toBeLessThan(graphTravelMs(10, slow))
  })

  it('Agilidade reduz 1%/ponto: 10 → 0,90; soma capada no teto (70) → piso 0,30', () => {
    const agi10 = [makeMon({ baseAttrs: makeAttrs({ agilidade: 10 }) })]
    expect(agilityTravelFactor(agi10)).toBeCloseTo(0.9, 5)
    const fifty = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    expect(agilityTravelFactor([fifty, fifty])).toBeCloseTo(0.3, 5) // soma 100 → cap 70 → −70%
  })

  it('Fly (sozinho) voa em linha reta: caminho mais curto que o do grafo, mas não-zero', () => {
    // L-shape: andando g→m→n (25); reta g→n (~18,36) é menor, mas continua > 0.
    const graph: CityGraph = {
      nodes: { g: { x: 0, y: 0 }, m: { x: 1, y: 0 }, n: { x: 1, y: 1 } },
      adj: { g: ['m'], m: ['g', 'n'], n: ['m'] },
      markers: {},
    }
    const flyer = makeMon({ id: 'f', passives: ['fly'] })
    const walker = makeMon({ id: 'w' })

    const flown = travelRoute(graph, 'g', 'n', [flyer])
    expect(flown.flying).toBe(true)
    expect(flown.path).toEqual(['g', 'n'])

    const walked = travelRoute(graph, 'g', 'n', [walker])
    expect(walked.flying).toBe(false)
    expect(walked.path).toEqual(['g', 'm', 'n'])

    expect(flown.distance).toBeGreaterThan(0)
    expect(flown.distance).toBeLessThan(walked.distance)
    expect(graphTravelMs(flown.distance, [flyer])).toBeLessThan(graphTravelMs(walked.distance, [walker]))
  })

  it('Fly acompanhado NÃO voa (exige estar sozinho): usa o caminho do grafo', () => {
    const graph: CityGraph = {
      nodes: { g: { x: 0, y: 0 }, m: { x: 1, y: 0 }, n: { x: 1, y: 1 } },
      adj: { g: ['m'], m: ['g', 'n'], n: ['m'] },
      markers: {},
    }
    const flyer = makeMon({ id: 'f', passives: ['fly'] })
    const other = makeMon({ id: 'o' })
    const route = travelRoute(graph, 'g', 'n', [flyer, other])
    expect(route.flying).toBe(false)
    expect(route.path).toEqual(['g', 'm', 'n'])
  })

  it('passiva Run Away reduz a viagem', () => {
    const base = [makeMon({ baseAttrs: makeAttrs({ agilidade: 30 }) })]
    const runner = [makeMon({ baseAttrs: makeAttrs({ agilidade: 30 }), passives: ['run-away'] })]
    expect(graphTravelMs(10, runner)).toBeLessThan(graphTravelMs(10, base))
  })

  it('mais Inteligência = menos execução', () => {
    const dumb = [makeMon({ baseAttrs: makeAttrs({ inteligencia: 10 }) })]
    const smart = [makeMon({ baseAttrs: makeAttrs({ inteligencia: 50 }) })]
    expect(executionMs(smart, 30_000)).toBeLessThan(executionMs(dumb, 30_000))
  })

  it('duração = ida + volta (deslocamento) + execução', () => {
    const team = [makeMon({ baseAttrs: makeAttrs({ agilidade: 30, inteligencia: 30 }) })]
    const tpl = template()
    expect(missionDurationMs(team, 8, tpl)).toBeCloseTo(
      2 * graphTravelMs(8, team) + executionMs(team, tpl.baseExecutionMs),
      6,
    )
  })
})

describe('createMissionInstance (PLAN §3.1)', () => {
  it('é determinística e respeita ponto/timer', () => {
    const spec = {
      id: 'm1',
      day: 1,
      category: 'freeArea' as const,
      node: 'q',
      spawnAtMs: 5_000,
      lifetimeMs: 20_000,
    }
    const inst = createMissionInstance({ ...spec, rng: createRng(7) })
    const same = createMissionInstance({ ...spec, rng: createRng(7) })
    expect(inst).toEqual(same)
    expect(inst.node).toBe('q')
    expect(inst.path).toEqual([])
    expect(inst.spawnAtMs).toBe(5_000)
    expect(inst.expiresAtMs).toBe(25_000)
    expect(inst.status).toBe('scheduled')
    expect(inst.teamIds).toEqual([])
  })

  it('usa templateId fixo quando informado (missão Equipe Rocket)', () => {
    const inst = createMissionInstance({
      id: 'm2',
      rng: createRng(1),
      day: 5,
      category: 'rocket',
      node: 'd',
      spawnAtMs: 0,
      lifetimeMs: 20_000,
      templateId: 'rocket',
    })
    expect(inst.templateId).toBe('rocket')
  })
})
