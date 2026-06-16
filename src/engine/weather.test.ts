import { describe, expect, it } from 'vitest'
import { getCity } from '../data/cities.ts'
import { DAY_LENGTH_MS } from './constants.ts'
import {
  activePuddlesAt,
  activeRainEvent,
  blockedNodesAt,
  buildWeatherSchedule,
  isRaining,
  maxRainTimes,
  puddleLevelAt,
  rainChanceForDay,
  type PuddleSpec,
  type WeatherSchedule,
  RAIN_CHANCE_TOTAL_PERCENT,
  RAIN_EVENT_MAX_MS,
  RAIN_EVENT_MIN_MS,
  RAIN_GAP_MS,
  PUDDLE_DRY_MS_BY_LEVEL,
  PUDDLE_GROW_INTERVAL_MS,
} from './weather.ts'

const CERULEAN = getCity(1) // cidade com chuva
const PEWTER = getCity(0) // cidade sem clima
const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7)

describe('elegibilidade de clima', () => {
  it('dias 1 e 2 nunca têm chuva (schedule vazio + previsão zerada)', () => {
    for (const day of [1, 2]) {
      const s = buildWeatherSchedule(12345, day, CERULEAN)
      expect(s.rain).toEqual([])
      expect(s.forecast).toEqual({ rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0 })
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

describe('rainChanceForDay', () => {
  it('cada dia elegível (3–10) fica em [0,100] e a soma fica perto do orçamento', () => {
    for (const seed of SEEDS) {
      let sum = 0
      for (let day = 3; day <= 10; day++) {
        const c = rainChanceForDay(seed, day)
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(100)
        sum += c
      }
      // Arredondamento + clamp (cada dia ≤ 100%) podem desviar um pouco do orçamento total.
      expect(sum).toBeGreaterThan(RAIN_CHANCE_TOTAL_PERCENT - 80)
      expect(sum).toBeLessThanOrEqual(RAIN_CHANCE_TOTAL_PERCENT + 8)
    }
  })

  it('há variedade entre os dias (não é tudo igual à média)', () => {
    const values = Array.from({ length: 8 }, (_, i) => rainChanceForDay(424242, i + 3))
    expect(new Set(values).size).toBeGreaterThan(1)
  })

  it('dias < 3 → 0%', () => {
    expect(rainChanceForDay(5, 1)).toBe(0)
    expect(rainChanceForDay(5, 2)).toBe(0)
  })
})

describe('maxRainTimes', () => {
  it('+1 a cada 2 dias, capado em 4', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(maxRainTimes)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4])
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

describe('poças', () => {
  const gym = CERULEAN.siteNodes.gym
  const surf = new Set(CERULEAN.graph.surfNodes ?? [])

  it('caem em ponto real, andável, ≠ ginásio, fora da água e fora das áreas de exploração (g3x)', () => {
    for (const seed of SEEDS) {
      for (let day = 3; day <= 10; day++) {
        for (const ev of buildWeatherSchedule(seed, day, CERULEAN).rain) {
          expect(ev.puddles.length).toBeGreaterThanOrEqual(1)
          expect(ev.puddles.length).toBeLessThanOrEqual(3)
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

describe('derivações de bloqueio', () => {
  const schedule: WeatherSchedule = {
    rain: [
      {
        startMs: 5_000,
        endMs: 25_000,
        puddles: [{ node: 'h', startMs: 6_000, eventEndMs: 25_000, endMs: 27_000 }],
      },
    ],
    forecast: { rainChancePercent: 40, rainMmPerHour: 24, potentialRainCount: 2 },
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
