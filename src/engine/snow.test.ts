import { describe, it, expect } from 'vitest'
import { getCity } from '../data/cities.ts'
import {
  buildSnow,
  isSnowing,
  snowExposureMs,
  snowChanceForDay,
  maxSnowTimes,
  snowWindowEndAt,
  activeSnowAt,
} from './snow.ts'

describe('snow schedule', () => {
  it('chance bate com a fórmula de Saffron {25,1,60}', () => {
    const c = snowChanceForDay(123, 5, 5)
    expect(c).toBeGreaterThanOrEqual(30) // piso dia 5 = 25 + 1·5 = 30
    expect(c).toBeLessThanOrEqual(60)
  })

  it('chance 0 fora de cidade com nevasca / dia < 3', () => {
    expect(snowChanceForDay(1, 5, 1)).toBe(0) // Cerulean não tem nevasca
    expect(snowChanceForDay(1, 2, 5)).toBe(0) // dia 2 nunca tem clima
  })

  it('maxSnowTimes = curva da chuva', () => {
    expect(maxSnowTimes(3)).toBe(1)
    expect(maxSnowTimes(9)).toBe(3)
    expect(maxSnowTimes(30)).toBe(6)
  })

  it('é determinístico e gera janelas não-sobrepostas com duração 40–70s', () => {
    const city = getCity(5)
    const a = buildSnow(7, 9, city)
    const b = buildSnow(7, 9, city)
    expect(a).toEqual(b)
    for (let i = 0; i < a.length; i++) {
      const dur = a[i]!.endMs - a[i]!.startMs
      expect(dur).toBeGreaterThanOrEqual(40_000)
      expect(dur).toBeLessThanOrEqual(70_000)
      if (i > 0) expect(a[i]!.startMs).toBeGreaterThanOrEqual(a[i - 1]!.endMs)
    }
  })

  it('cidade sem nevasca → vazio', () => {
    expect(buildSnow(7, 9, getCity(1))).toEqual([])
  })

  it('isSnowing / activeSnowAt', () => {
    const events = [{ startMs: 1000, endMs: 3000 }]
    expect(isSnowing(events, 2000)).toBe(true)
    expect(isSnowing(events, 3000)).toBe(false)
    expect(activeSnowAt(events, 1500)).toEqual({ startMs: 1000, endMs: 3000 })
  })

  it('snowExposureMs soma a interseção com as janelas (robusto a saltos)', () => {
    const events = [
      { startMs: 1000, endMs: 3000 },
      { startMs: 5000, endMs: 6000 },
    ]
    expect(snowExposureMs(events, 0, 10000)).toBe(3000) // 2000 + 1000
    expect(snowExposureMs(events, 2000, 5500)).toBe(1500) // 1000 + 500
    expect(snowExposureMs(events, 3000, 5000)).toBe(0) // no gap
    expect(snowExposureMs(events, 100, 100)).toBe(0)
  })

  it('snowWindowEndAt devolve o fim da janela ativa, ou null', () => {
    const events = [{ startMs: 1000, endMs: 3000 }]
    expect(snowWindowEndAt(events, 2000)).toBe(3000)
    expect(snowWindowEndAt(events, 4000)).toBeNull()
  })
})
