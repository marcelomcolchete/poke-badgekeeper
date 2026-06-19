import { describe, expect, it } from 'vitest'
import {
  pointInCircle,
  resolveStrikeCircles,
  type StrikeCircle,
  buildStorms,
  maxStormTimes,
  strikeCountForDay,
  activeStormAt,
  isStorming,
} from './storm.ts'
import type { CityData } from '../data/types.ts'
import type { RainEvent } from './weather.ts'
import { STRIKE_RADIUS, STRIKE_RADIUS_ON_WATER, STRIKE_SECONDARY_RADIUS } from './balance.ts'

// Cidade mínima de teste: 3 pontos numa linha horizontal + um ponto de água (surf).
function testCity(): CityData {
  return {
    index: 99,
    name: 'Test',
    primaryType: 'electric',
    secondaryType: 'dragon',
    starters: [],
    mapImage: '',
    coverImage: '',
    mapW: 1920,
    mapH: 1080,
    graph: {
      nodes: {
        a: { x: 0.1, y: 0.5 },
        b: { x: 0.15, y: 0.5 }, // ~5% da largura à direita de 'a' (dentro de 0,09)
        c: { x: 0.9, y: 0.5 }, // longe
        w: { x: 0.16, y: 0.5 }, // água, dentro de 0,09 de 'a'
      },
      adj: { a: ['b'], b: ['a'], c: [], w: [] },
      markers: {},
      surfNodes: ['w'],
    },
    siteNodes: { gym: 'a', center: 'b', mart: 'b', museum: ['c'], houses: ['b'], green: ['c'] },
    trainers: [],
  }
}

describe('storm — agendamento', () => {
  it('strikeCountForDay escala com o dia até o cap ⌊pool/4⌋', () => {
    // pool 20 → cap 5. Dia 3 = piso 1; dia 10 = cap 5.
    expect(strikeCountForDay(3, 20)).toBe(1)
    expect(strikeCountForDay(10, 20)).toBe(5)
    expect(strikeCountForDay(10, 20)).toBeLessThanOrEqual(Math.floor(20 / 4))
    // pool minúsculo → cap 0.
    expect(strikeCountForDay(10, 2)).toBe(0)
  })

  it('maxStormTimes cresce +1 a cada 2 dias, cap 4', () => {
    expect(maxStormTimes(2)).toBe(0)
    expect(maxStormTimes(3)).toBe(1)
    expect(maxStormTimes(10)).toBe(4)
  })

  it('é determinístico: mesmo seed/dia → mesmo schedule', () => {
    const a = buildStorms(123, 8, testCity(), [])
    const b = buildStorms(123, 8, testCity(), [])
    expect(a).toEqual(b)
  })

  it('acopla uma tempestade a CADA evento de chuva, dentro da janela', () => {
    const rain: RainEvent[] = [{ startMs: 50_000, endMs: 90_000, puddles: [] }]
    // chance 0 zera as PRÓPRIAS; só sobram as acopladas (1 por chuva).
    const storms = buildStorms(1, 5, testCity(), rain, -1000)
    const coupled = storms.filter((s) => s.startMs >= 50_000 && s.endMs <= 90_000 + 30_000)
    expect(coupled.length).toBeGreaterThanOrEqual(1)
    const s = coupled[0]!
    expect(s.startMs).toBeGreaterThanOrEqual(50_000)
    expect(s.startMs).toBeLessThanOrEqual(90_000)
  })

  it('activeStormAt/isStorming refletem a janela', () => {
    const storms = [{ startMs: 1_000, endMs: 2_000, strikes: [] }]
    expect(isStorming(storms, 1_500)).toBe(true)
    expect(isStorming(storms, 2_500)).toBe(false)
    expect(activeStormAt(storms, 1_500)?.startMs).toBe(1_000)
  })
})

describe('storm — geometria', () => {
  const noRain: RainEvent[] = []

  it('pointInCircle respeita o aspecto 16:9 (raio = fração da largura)', () => {
    const circle: StrikeCircle = { cx: 0.5, cy: 0.5, radius: STRIKE_RADIUS }
    expect(pointInCircle(circle, { x: 0.5, y: 0.5 })).toBe(true)
    expect(pointInCircle(circle, { x: 0.5 + STRIKE_RADIUS - 0.001, y: 0.5 })).toBe(true)
    expect(pointInCircle(circle, { x: 0.5 + STRIKE_RADIUS + 0.01, y: 0.5 })).toBe(false)
  })

  it('centro fora da água + água dentro do raio → primário 0,09 + secundário 0,045', () => {
    const circles = resolveStrikeCircles('a', 0, testCity(), noRain)
    expect(circles).toHaveLength(2)
    expect(circles[0]?.radius).toBe(STRIKE_RADIUS)
    expect(circles[1]?.radius).toBe(STRIKE_SECONDARY_RADIUS)
    // O secundário nasce no ponto de água 'w'.
    expect(circles[1]?.cx).toBeCloseTo(0.16)
  })

  it('centro JÁ na água → raio único 0,15, sem secundário', () => {
    const circles = resolveStrikeCircles('w', 0, testCity(), noRain)
    expect(circles).toHaveLength(1)
    expect(circles[0]?.radius).toBe(STRIKE_RADIUS_ON_WATER)
  })

  it('sem água por perto → só o primário', () => {
    const circles = resolveStrikeCircles('c', 0, testCity(), noRain)
    expect(circles).toHaveLength(1)
    expect(circles[0]?.radius).toBe(STRIKE_RADIUS)
  })

  it('uma poça ativa conta como água para o encadeamento', () => {
    const rain: RainEvent[] = [
      { startMs: 0, endMs: 10_000, puddles: [{ node: 'b', startMs: 0, eventEndMs: 10_000, endMs: 11_000 }] },
    ]
    // Centro 'a', poça em 'b' (dentro de 0,09): secundário a partir de 'b'.
    const circles = resolveStrikeCircles('a', 5_000, testCity(), rain)
    expect(circles.some((c) => c.radius === STRIKE_SECONDARY_RADIUS && Math.abs(c.cx - 0.15) < 1e-6)).toBe(true)
  })
})
