import { describe, expect, it } from 'vitest'
import { cityHasRain, cityHasStorm, getCityWeather } from './cityWeather.ts'

describe('cityWeather — Tempestade', () => {
  it('Vermilion (índice 2) tem chuva E tempestade', () => {
    expect(cityHasRain(2)).toBe(true)
    expect(cityHasStorm(2)).toBe(true)
  })

  it('Cerulean (índice 1) tem chuva mas não tempestade', () => {
    expect(cityHasRain(1)).toBe(true)
    expect(cityHasStorm(1)).toBe(false)
  })

  it('cidade sem clima não tem nenhum efeito', () => {
    expect(getCityWeather(0)).toBeNull()
    expect(cityHasStorm(0)).toBe(false)
  })
})
