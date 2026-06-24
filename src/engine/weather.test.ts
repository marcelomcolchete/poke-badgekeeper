import { describe, expect, it } from 'vitest'
import { getCity } from '../data/cities.ts'
import { DAY_LENGTH_MS } from './constants.ts'
import {
  activePuddlesAt,
  activeRainEvent,
  blockedNodesAt,
  buildWeatherSchedule,
  emptyWeatherSchedule,
  isRaining,
  maxRainTimes,
  puddleLevelAt,
  rainAtLeastOnceChance,
  rainChanceForDay,
  weatherChanceForDay,
  type PuddleSpec,
  type WeatherSchedule,
  RAIN_EVENT_MAX_MS,
  RAIN_EVENT_MIN_MS,
  RAIN_GAP_MS,
  PUDDLE_DRY_MS_BY_LEVEL,
  PUDDLE_GROW_INTERVAL_MS,
  puddleCountRange,
} from './weather.ts'

const CERULEAN = getCity(1) // cidade com chuva
const PEWTER = getCity(0) // cidade sem clima
const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7)

describe('elegibilidade de clima', () => {
  it('dias 1 e 2 nunca têm chuva (schedule vazio + previsão zerada)', () => {
    for (const day of [1, 2]) {
      const s = buildWeatherSchedule(12345, day, CERULEAN)
      expect(s.rain).toEqual([])
      expect(s.forecast).toEqual({ rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 0, potentialHeatCount: 0, snowstormChancePercent: 0, potentialSnowstormCount: 0, sandstormChancePercent: 0, potentialSandstormCount: 0 })
    }
  })

  it('cidade sem clima (Pewter) nunca tem chuva, mesmo em dias avançados', () => {
    for (const day of [3, 5, 10]) {
      expect(buildWeatherSchedule(999, day, PEWTER).rain).toEqual([])
    }
  })
})

describe('determinismo', () => {
  it('mesma (seed, dia, cidade) → schedule idêntico', () => {
    const a = buildWeatherSchedule(777, 8, CERULEAN)
    const b = buildWeatherSchedule(777, 8, CERULEAN)
    expect(a).toEqual(b)
  })

  it('seeds diferentes produzem previsões variadas (não é constante)', () => {
    const chances = SEEDS.map((s) => buildWeatherSchedule(s, 7, CERULEAN).forecast.rainChancePercent)
    expect(new Set(chances).size).toBeGreaterThan(1)
  })
})

describe('rainChanceForDay (fórmula por cidade)', () => {
  it('Cerulean: chance do dia fica em [piso(dia), teto] e é estável por (seed,dia)', () => {
    for (const seed of SEEDS) {
      for (let day = 3; day <= 10; day++) {
        const lo = Math.min(40 + day, 70)
        const c = rainChanceForDay(seed, day, 1)
        expect(c).toBeGreaterThanOrEqual(lo)
        expect(c).toBeLessThanOrEqual(70)
        expect(rainChanceForDay(seed, day, 1)).toBe(c) // estável
      }
    }
  })

  it('regime do infinito: piso encosta no teto (Cerulean dia 30+ → 70)', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(rainChanceForDay(seed, 30, 1)).toBe(70)
      expect(rainChanceForDay(seed, 50, 1)).toBe(70)
    }
  })

  it('funciona além do dia 10 (não zera como o modelo antigo)', () => {
    expect(rainChanceForDay(424242, 15, 1)).toBeGreaterThan(0)
  })

  it('há variedade entre os dias (não é tudo igual)', () => {
    const values = Array.from({ length: 8 }, (_, i) => rainChanceForDay(424242, i + 3, 1))
    expect(new Set(values).size).toBeGreaterThan(1)
  })

  it('dias < 3 → 0%; cidade sem chuva (Pewter=0) → 0%', () => {
    expect(rainChanceForDay(5, 1, 1)).toBe(0)
    expect(rainChanceForDay(5, 2, 1)).toBe(0)
    expect(rainChanceForDay(5, 7, 0)).toBe(0)
  })
})

describe('weatherChanceForDay (genérica)', () => {
  it('faixa colapsa quando piso ≥ teto (sempre o teto)', () => {
    const f = { pisoBase: 100, pisoPorDia: 0, teto: 50 }
    for (const seed of SEEDS.slice(0, 5)) expect(weatherChanceForDay(seed, 7, f, 0xabc)).toBe(50)
  })
})

describe('maxRainTimes', () => {
  it('+1 a cada 3 dias, capado em 6', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(maxRainTimes)).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3])
    expect(maxRainTimes(18)).toBe(6)
    expect(maxRainTimes(30)).toBe(6) // teto segura no infinito
  })

  it('nº de chuvas que ocorrem nunca passa o teto do dia', () => {
    for (const seed of SEEDS) {
      for (let day = 3; day <= 10; day++) {
        expect(buildWeatherSchedule(seed, day, CERULEAN).rain.length).toBeLessThanOrEqual(maxRainTimes(day))
      }
    }
  })
})

describe('eventos de chuva', () => {
  it('não se sobrepõem, respeitam o gap, cabem no dia e duram 10–30s', () => {
    for (const seed of SEEDS) {
      for (let day = 3; day <= 10; day++) {
        const { rain } = buildWeatherSchedule(seed, day, CERULEAN)
        for (let i = 0; i < rain.length; i++) {
          const ev = rain[i]!
          expect(ev.startMs).toBeGreaterThanOrEqual(0)
          expect(ev.endMs).toBeLessThanOrEqual(DAY_LENGTH_MS)
          const duration = ev.endMs - ev.startMs
          expect(duration).toBeGreaterThanOrEqual(RAIN_EVENT_MIN_MS)
          expect(duration).toBeLessThanOrEqual(RAIN_EVENT_MAX_MS)
          if (i > 0) expect(ev.startMs).toBeGreaterThanOrEqual(rain[i - 1]!.endMs + RAIN_GAP_MS)
        }
      }
    }
  })

  it('em algum seed/dia chove de fato (o gerador não está morto)', () => {
    const anyRain = SEEDS.some((s) => buildWeatherSchedule(s, 10, CERULEAN).rain.length > 0)
    expect(anyRain).toBe(true)
  })
})

describe('puddleCountRange (quantidade por chuva escala com o pool)', () => {
  it('max = ⌊n/4⌋ e min = max(0, ⌊n/4⌋ − 3)', () => {
    expect(puddleCountRange(20)).toEqual({ min: 2, max: 5 }) // Cerulean
    expect(puddleCountRange(12)).toEqual({ min: 0, max: 3 }) // ⌊12/4⌋=3 → 3-3<0 → min 0
    expect(puddleCountRange(28)).toEqual({ min: 4, max: 7 })
  })

  it('pool pequeno (ou vazio) → 0 poças possíveis', () => {
    expect(puddleCountRange(0)).toEqual({ min: 0, max: 0 })
    expect(puddleCountRange(3)).toEqual({ min: 0, max: 0 }) // ⌊3/4⌋=0
    expect(puddleCountRange(7)).toEqual({ min: 0, max: 1 })
  })
})

describe('poças', () => {
  const gym = CERULEAN.siteNodes.gym
  const surf = new Set(CERULEAN.graph.surfNodes ?? [])
  // Pool de pontos onde uma poça pode cair (espelha puddleNodePool): andáveis, ≠ ginásio, fora da
  // água e fora das áreas de exploração (g3x). A quantidade por chuva escala com seu tamanho.
  const poolSize = Object.keys(CERULEAN.graph.nodes).filter(
    (id) => id !== gym && !surf.has(id) && !/^g\d/.test(id),
  ).length
  const range = puddleCountRange(poolSize) // Cerulean: pool 20 → 2–5

  it('quantidade por chuva escala com o pool (Cerulean: 2–5)', () => {
    expect(range).toEqual({ min: 2, max: 5 })
  })

  it('caem em ponto real, andável, ≠ ginásio, fora da água e fora das áreas de exploração (g3x)', () => {
    for (const seed of SEEDS) {
      for (let day = 3; day <= 10; day++) {
        for (const ev of buildWeatherSchedule(seed, day, CERULEAN).rain) {
          expect(ev.puddles.length).toBeGreaterThanOrEqual(range.min)
          expect(ev.puddles.length).toBeLessThanOrEqual(range.max)
          for (const p of ev.puddles) {
            expect(CERULEAN.graph.nodes[p.node]).toBeDefined()
            expect(p.node).not.toBe(gym)
            expect(surf.has(p.node)).toBe(false)
            expect(/^g\d/.test(p.node)).toBe(false)
          }
        }
      }
    }
  })
})

describe('puddleLevelAt', () => {
  // Poça nasce em 0, chuva longa o bastante para atingir o nível 3 (parametrizado pelo intervalo
  // de crescimento, então o teste vale mesmo se o intervalo mudar).
  const grow = PUDDLE_GROW_INTERVAL_MS
  const spec: PuddleSpec = { node: 'h', startMs: 0, eventEndMs: 3 * grow, endMs: 0 }
  // nível no fim = 1 + floor(3*grow / grow) = 4 → cap 3; seca em PUDDLE_DRY[3] = 5s.
  spec.endMs = spec.eventEndMs + PUDDLE_DRY_MS_BY_LEVEL[3]!

  it('0 antes de surgir e após secar', () => {
    expect(puddleLevelAt(spec, -1)).toBe(0)
    expect(puddleLevelAt(spec, spec.endMs)).toBe(0)
    expect(puddleLevelAt(spec, spec.endMs + 1)).toBe(0)
  })

  it('cresce +1 a cada intervalo de chuva, capado em 3', () => {
    expect(puddleLevelAt(spec, 0)).toBe(1)
    expect(puddleLevelAt(spec, grow)).toBe(2)
    expect(puddleLevelAt(spec, 2 * grow)).toBe(3)
    expect(puddleLevelAt(spec, spec.eventEndMs - 1)).toBe(3) // não passa de 3
  })

  it('durante a secagem (após o fim da chuva) ainda bloqueia, com nível travado', () => {
    expect(puddleLevelAt(spec, spec.eventEndMs + 1)).toBe(3) // entre eventEnd e end → nível final
    expect(puddleLevelAt(spec, spec.endMs - 1)).toBe(3)
  })
})

describe('Cloud Nine (extraChancePercent em buildWeatherSchedule)', () => {
  it('soma os pontos percentuais à chance do dia, com teto de 100', () => {
    const seed = 7777
    const day = 7
    const base = buildWeatherSchedule(seed, day, CERULEAN, 0).forecast.rainChancePercent
    const boosted = buildWeatherSchedule(seed, day, CERULEAN, 25).forecast.rainChancePercent
    expect(boosted).toBe(Math.min(100, base + 25))
    expect(buildWeatherSchedule(seed, day, CERULEAN, 200).forecast.rainChancePercent).toBe(100)
  })

  it('não cria chuva em dia 1-2 nem em cidade sem chuva, mesmo com bônus alto', () => {
    expect(buildWeatherSchedule(1, 1, CERULEAN, 100).rain).toEqual([])
    expect(buildWeatherSchedule(1, 5, PEWTER, 100).rain).toEqual([])
  })
})

describe('derivações de bloqueio', () => {
  const schedule: WeatherSchedule = {
    rain: [
      {
        startMs: 5_000,
        endMs: 25_000,
        puddles: [{ node: 'h', startMs: 6_000, eventEndMs: 25_000, endMs: 27_000 }],
      },
    ],
    storms: [],
    heat: [],
    snow: [], sand: [], forecast: { rainChancePercent: 40, rainMmPerHour: 24, potentialRainCount: 2, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 0, potentialHeatCount: 0, snowstormChancePercent: 0, potentialSnowstormCount: 0, sandstormChancePercent: 0, potentialSandstormCount: 0 },
  }

  it('activeRainEvent/isRaining seguem a janela do evento', () => {
    expect(isRaining(schedule, 4_999)).toBe(false)
    expect(isRaining(schedule, 5_000)).toBe(true)
    expect(isRaining(schedule, 24_999)).toBe(true)
    expect(isRaining(schedule, 25_000)).toBe(false) // chuva parou (poça ainda seca até 27s)
    expect(activeRainEvent(schedule, 10_000)).toBe(schedule.rain[0])
  })

  it('blockedNodesAt e activePuddlesAt refletem as poças ativas', () => {
    expect(blockedNodesAt(schedule, 5_999).size).toBe(0) // poça ainda não surgiu
    expect(blockedNodesAt(schedule, 10_000).has('h')).toBe(true)
    expect(blockedNodesAt(schedule, 26_000).has('h')).toBe(true) // secando, ainda bloqueia
    expect(blockedNodesAt(schedule, 27_000).size).toBe(0) // secou
    const active = activePuddlesAt(schedule, 10_000)
    expect(active).toHaveLength(1)
    expect(active[0]!.node).toBe('h')
    expect(active[0]!.level).toBeGreaterThan(0)
  })
})

describe('rainAtLeastOnceChance (chance de ao menos uma pancada)', () => {
  it('combina chance por pancada com a quantidade de pancadas', () => {
    expect(rainAtLeastOnceChance(60, 3)).toBe(94) // 1 - 0.4^3 = 0.936 -> 94
    expect(rainAtLeastOnceChance(50, 2)).toBe(75) // 1 - 0.5^2 = 0.75 -> 75
  })

  it('chance 0 ou 0 pancadas → 0%', () => {
    expect(rainAtLeastOnceChance(0, 3)).toBe(0)
    expect(rainAtLeastOnceChance(80, 0)).toBe(0)
  })

  it('chance 100 com ao menos 1 pancada → 100%', () => {
    expect(rainAtLeastOnceChance(100, 1)).toBe(100)
    expect(rainAtLeastOnceChance(100, 4)).toBe(100)
  })

  it('uma única pancada devolve a própria chance (arredondada)', () => {
    expect(rainAtLeastOnceChance(37, 1)).toBe(37)
  })
})

describe('emptyWeatherSchedule (calor)', () => {
  it('emptyWeatherSchedule inclui heat vazio e previsão de calor zerada', () => {
    const s = emptyWeatherSchedule()
    expect(s.heat).toEqual([])
    expect(s.forecast.heatChancePercent).toBe(0)
    expect(s.forecast.potentialHeatCount).toBe(0)
  })
})
