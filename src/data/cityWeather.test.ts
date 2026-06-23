import { describe, expect, it } from 'vitest'
import { cityHasRain, cityHasStorm, cityRainChance, cityStormChance, getCityWeather } from './cityWeather.ts'

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

describe('cityWeather — fórmula de chance por cidade/efeito', () => {
  it('Cerulean (1): chuva 40/1/70, sem tempestade', () => {
    expect(cityRainChance(1)).toEqual({ pisoBase: 40, pisoPorDia: 1, teto: 70 })
    expect(cityStormChance(1)).toBeNull()
  })

  it('Vermilion (2): chuva 15/2/60 e tempestade 20/1/50', () => {
    expect(cityRainChance(2)).toEqual({ pisoBase: 15, pisoPorDia: 2, teto: 60 })
    expect(cityStormChance(2)).toEqual({ pisoBase: 20, pisoPorDia: 1, teto: 50 })
  })

  it('cidade sem clima (0): ambos null', () => {
    expect(cityRainChance(0)).toBeNull()
    expect(cityStormChance(0)).toBeNull()
  })
})
