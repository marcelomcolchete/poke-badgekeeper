import { describe, expect, it } from 'vitest'
import { ATTR_KEYS } from '../types/index.ts'
import type { CityGraph, MissionTemplate } from '../data/types.ts'
import { TEAM_ATTR_MAX } from './constants.ts'
import { createRng } from './rng.ts'
import { NORMAL_TEMPLATES, POKECENTER_TEMPLATE, SPECIAL_TEMPLATE } from '../data/missionTemplates.ts'
import {
  agilityTravelFactor,
  createMissionInstance,
  executionMs,
  generateRequirement,
  graphTravelMs,
  missionDurationMs,
  missionFailureDamage,
  missionSuccessProbability,
  missionSuccessProbabilityCtx,
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

  it('soma do time é capada no teto do time (100) por eixo', () => {
    const big = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }), allocations: undefined })
    const team = [big, big, big] // 3×50 = 150 → cap 100
    const req = makeAttrs({ agilidade: 100 }, 10)
    // Com a soma capada em 100, o eixo agilidade cobre 100 da exigência (min = 100).
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

  it('todo eixo fica em [0, 100]', () => {
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

  it('resto evolui com o dia: abaixo de 5–20 cedo, na faixa-base no dia 6, sobe devagar', () => {
    // Seed não-mega (secundário ≠ principal) → sobram eixos "resto" limpos p/ inspecionar.
    let seed = 1
    while (generateRequirement(createRng(seed), 6, patrulha).secondaryAttr === 'batalha') seed++
    const secondary = generateRequirement(createRng(seed), 6, patrulha).secondaryAttr
    const day1 = generateRequirement(createRng(seed), 1, patrulha).requirement
    const day6 = generateRequirement(createRng(seed), 6, patrulha).requirement
    const day15 = generateRequirement(createRng(seed), 15, patrulha).requirement
    const restAxes = ATTR_KEYS.filter((k) => k !== 'batalha' && k !== secondary)
    expect(restAxes.length).toBeGreaterThan(0)
    for (const r of restAxes) {
      // No dia 6 o termo é zero → cai exatamente na faixa-base 5–20.
      expect(day6[r]).toBeGreaterThanOrEqual(5)
      expect(day6[r]).toBeLessThanOrEqual(20)
      expect(day1[r]).toBeLessThan(day6[r]) // primeiros dias abaixo da faixa-base
      expect(day15[r]).toBeGreaterThan(day6[r]) // evolução lenta e contínua depois
    }
  })

  it('mega: secundário sorteado igual ao principal concentra tudo num eixo (~100)', () => {
    // Varre seeds até cair no caso mega (secondaryAttr === principal). No dia 20 o
    // principal + secundário satura no teto do time (100).
    let mega: ReturnType<typeof generateRequirement> | null = null
    for (let seed = 1; seed <= 200 && !mega; seed++) {
      const g = generateRequirement(createRng(seed), 20, patrulha)
      if (g.secondaryAttr === 'batalha') mega = g
    }
    expect(mega).not.toBeNull()
    expect(mega?.requirement.batalha).toBe(TEAM_ATTR_MAX) // principal + secundário no dia 20 satura em 100
  })

  it('special5 (Missão Especial): 4 principais + 2 secundários, com mega possível', () => {
    let sawMega = false
    for (let seed = 1; seed <= 40; seed++) {
      const { requirement, secondaryAttr } = generateRequirement(createRng(seed), 3, SPECIAL_TEMPLATE)
      expect(secondaryAttr).toBeNull()
      // 4 principais sempre presentes (no dia 3 o principal cai em 30..40).
      expect(ATTR_KEYS.filter((k) => requirement[k] >= 30).length).toBeGreaterThanOrEqual(4)
      // Entre 4 e 6 eixos reforçados (>=20): 0..2 sobram no "resto" conforme quantos viram mega.
      const loaded = ATTR_KEYS.filter((k) => requirement[k] >= 20).length
      expect(loaded).toBeGreaterThanOrEqual(4)
      expect(loaded).toBeLessThanOrEqual(6)
      // Dia 3 não satura nenhum eixo no teto do time.
      expect(ATTR_KEYS.every((k) => requirement[k] < TEAM_ATTR_MAX)).toBe(true)
      // Mega = principal + secundário no mesmo eixo → no dia 3 passa de 40 (acima do principal puro).
      if (ATTR_KEYS.some((k) => requirement[k] > 40)) sawMega = true
    }
    expect(sawMega, 'a coincidência principal×secundário (mega) ocorre em alguns sorteios').toBe(true)
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

  it('Agilidade reduz 1%/ponto: 10 → 0,90; soma capada no teto (100) → piso 0,30', () => {
    const agi10 = [makeMon({ baseAttrs: makeAttrs({ agilidade: 10 }) })]
    expect(agilityTravelFactor(agi10)).toBeCloseTo(0.9, 5)
    const fifty = makeMon({ baseAttrs: makeAttrs({ agilidade: 50 }) })
    expect(agilityTravelFactor([fifty, fifty])).toBeCloseTo(0.3, 5) // soma 100 → piso 0,30 (−70%)
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

  it('Inteligência reduz até −70% (piso 0,30) com a soma no teto', () => {
    const fifty = makeMon({ baseAttrs: makeAttrs({ inteligencia: 50 }) })
    expect(executionMs([fifty, fifty], 30_000)).toBeCloseTo(9_000, 5) // soma 100 → piso 0,30 (−70%)
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

  it('usa templateId fixo quando informado (Missão Especial)', () => {
    const inst = createMissionInstance({
      id: 'm2',
      rng: createRng(1),
      day: 5,
      category: 'special',
      node: 'd',
      spawnAtMs: 0,
      lifetimeMs: 20_000,
      templateId: 'special',
    })
    expect(inst.templateId).toBe('special')
  })
})

describe('missionSuccessProbabilityCtx — Vital Spirit', () => {
  // Exigência com dois eixos adjacentes (área de hexágono > 0) e time abaixo dela.
  const req = makeAttrs({ batalha: 40, inteligencia: 40 })
  const lowAttrs = makeAttrs({ batalha: 10, inteligencia: 10 })

  it('dobra a chance ao falhar: efetiva = 1 − (1 − p)²', () => {
    // Electabuzz (125) par = ['sa-vital-spirit','sa-volt-absorb']; Vital Spirit no slot 0.
    const electa = makeMon({ id: 'e', speciesId: 125, secretPicks: [{ slot: 0, level: 1 }], baseAttrs: lowAttrs })
    const base = missionSuccessProbability([electa], req)
    expect(base).toBeGreaterThan(0)
    expect(base).toBeLessThan(1)
    const ctx = { team: [electa], template: template(), runtime: {}, runItems: [] }
    expect(missionSuccessProbabilityCtx(ctx, req)).toBeCloseTo(1 - (1 - base) ** 2, 6)
  })

  it('sem Vital Spirit, a chance não muda', () => {
    const plain = makeMon({ id: 'p', baseAttrs: lowAttrs })
    const ctx = { team: [plain], template: template(), runtime: {}, runItems: [] }
    expect(missionSuccessProbabilityCtx(ctx, req)).toBeCloseTo(missionSuccessProbability([plain], req), 6)
  })
})

describe('Leaf Guard L1 — dano de missão', () => {
  const reqHigh = makeAttrs({}, 100) // exigência alta; pSuccessOverride=0 força a falha
  // Tangela(114): par = ['sa-regenerator','sa-leaf-guard'] → Leaf Guard slot 1.
  it('com 1 portador, só ele perde vida (dano normal)', () => {
    const guard = makeMon({ id: 'g', speciesId: 114, types: ['grass'], baseAttrs: makeAttrs({ resistencia: 50 }), secretPicks: [{ slot: 1, level: 1 }] })
    const ally = makeMon({ id: 'a', speciesId: 1, types: ['grass'], baseAttrs: makeAttrs({ resistencia: 50 }) })
    const out = resolveMission(fixedRng(1), [guard, ally], reqHigh, 4, 0, 3)
    const g = out.team.find((p) => p.id === 'g')!
    const a = out.team.find((p) => p.id === 'a')!
    expect(g.maxHp - g.currentHp).toBe(3) // absorvedor toma o dano normal (3)
    expect(a.currentHp).toBe(a.maxHp) // aliado intacto
  })

  it('com 2 portadores, só o de maior vida absorve', () => {
    const low = makeMon({ id: 'low', speciesId: 114, baseAttrs: makeAttrs({ resistencia: 50 }), currentHp: 4, secretPicks: [{ slot: 1, level: 1 }] })
    const high = makeMon({ id: 'high', speciesId: 114, baseAttrs: makeAttrs({ resistencia: 50 }), secretPicks: [{ slot: 1, level: 1 }] })
    const out = resolveMission(fixedRng(1), [low, high], reqHigh, 4, 0, 3)
    expect(out.team.find((p) => p.id === 'low')!.currentHp).toBe(4) // intacto
    const h = out.team.find((p) => p.id === 'high')!
    expect(h.maxHp - h.currentHp).toBe(3) // o de maior vida absorve
  })

  it('sem portador, o dano é distribuído como antes', () => {
    const a = makeMon({ id: 'a', speciesId: 1, baseAttrs: makeAttrs({ resistencia: 50 }) })
    const b = makeMon({ id: 'b', speciesId: 1, baseAttrs: makeAttrs({ resistencia: 50 }) })
    const out = resolveMission(fixedRng(1), [a, b], reqHigh, 4, 0, 3)
    expect(out.team.every((p) => p.maxHp - p.currentHp === 3)).toBe(true)
  })
})
