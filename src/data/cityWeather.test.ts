import { describe, expect, it } from 'vitest'
import { cityHasHeat, cityHasRain, cityHasStorm, cityHasSnow, cityHasSand, cityHeatChance, cityRainChance, cityStormChance, citySnowChance, citySandChance, getCityWeather } from './cityWeather.ts'

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

describe('cityWeather — Calor (Celadon)', () => {
  it('Celadon (índice 3) tem calor, chuva e tempestade', () => {
    expect(cityHasHeat(3)).toBe(true)
    expect(cityHasRain(3)).toBe(true)
    expect(cityHasStorm(3)).toBe(true)
  })

  it('Celadon (3): fórmulas do pedido', () => {
    expect(cityHeatChance(3)).toEqual({ pisoBase: 20, pisoPorDia: 1, teto: 50 })
    expect(cityRainChance(3)).toEqual({ pisoBase: 10, pisoPorDia: 1, teto: 40 })
    expect(cityStormChance(3)).toEqual({ pisoBase: 5, pisoPorDia: 1, teto: 20 })
  })

  it('Celadon lista os efeitos na ordem calor → chuva → tempestade', () => {
    expect(getCityWeather(3)!.effects.map((e) => e.kind)).toEqual(['heat', 'rain', 'storm'])
  })

  it('cidades sem calor retornam null/false', () => {
    expect(cityHasHeat(1)).toBe(false)
    expect(cityHeatChance(2)).toBeNull()
  })
})

describe('cityWeather — Nevasca e Tempestade de areia (cidades novas)', () => {
  it('Fuchsia (4): chuva, sandstorm, calor — nessa ordem', () => {
    expect(getCityWeather(4)!.effects.map((e) => e.kind)).toEqual(['rain', 'sandstorm', 'heat'])
    expect(cityRainChance(4)).toEqual({ pisoBase: 20, pisoPorDia: 1, teto: 50 })
    expect(citySandChance(4)).toEqual({ pisoBase: 15, pisoPorDia: 1, teto: 45 })
    expect(cityHeatChance(4)).toEqual({ pisoBase: 12, pisoPorDia: 1, teto: 35 })
  })

  it('Saffron (5): snowstorm dominante, depois chuva e tempestade', () => {
    expect(getCityWeather(5)!.effects.map((e) => e.kind)).toEqual(['snowstorm', 'rain', 'storm'])
    expect(citySnowChance(5)).toEqual({ pisoBase: 25, pisoPorDia: 1, teto: 60 })
    expect(cityRainChance(5)).toEqual({ pisoBase: 12, pisoPorDia: 1, teto: 40 })
    expect(cityStormChance(5)).toEqual({ pisoBase: 8, pisoPorDia: 1, teto: 30 })
  })

  it('Cinnabar (6): calor dominante, tempestade e sandstorm', () => {
    expect(getCityWeather(6)!.effects.map((e) => e.kind)).toEqual(['heat', 'storm', 'sandstorm'])
    expect(cityHeatChance(6)).toEqual({ pisoBase: 30, pisoPorDia: 1, teto: 65 })
    expect(citySandChance(6)).toEqual({ pisoBase: 10, pisoPorDia: 1, teto: 35 })
  })

  it('Viridian (7): sandstorm dominante + chuva/tempestade/snowstorm', () => {
    expect(getCityWeather(7)!.effects.map((e) => e.kind)).toEqual(['sandstorm', 'rain', 'storm', 'snowstorm'])
    expect(cityHasSnow(7)).toBe(true)
    expect(cityHasSand(7)).toBe(true)
    expect(citySandChance(7)).toEqual({ pisoBase: 25, pisoPorDia: 1, teto: 60 })
    expect(citySnowChance(7)).toEqual({ pisoBase: 8, pisoPorDia: 1, teto: 28 })
  })

  it('Pewter (0) permanece sem clima; Cerulean (1) sem nevasca/areia', () => {
    expect(getCityWeather(0)).toBeNull()
    expect(cityHasSnow(1)).toBe(false)
    expect(cityHasSand(1)).toBe(false)
    expect(citySnowChance(1)).toBeNull()
    expect(citySandChance(2)).toBeNull()
  })
})
