import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'
import { SHINY_CHANCE } from './constants.ts'
import { rollShiny, shinyFor, spotHasShiny } from './shiny.ts'

describe('rollShiny', () => {
  it('é true quando o próximo float fica abaixo de SHINY_CHANCE', () => {
    const lo = { next: () => SHINY_CHANCE / 2 } as unknown as Parameters<typeof rollShiny>[0]
    const hi = { next: () => SHINY_CHANCE + 0.01 } as unknown as Parameters<typeof rollShiny>[0]
    expect(rollShiny(lo)).toBe(true)
    expect(rollShiny(hi)).toBe(false)
  })

  it('a frequência sobre muitos seeds fica perto de 1%', () => {
    let hits = 0
    const N = 20000
    for (let i = 0; i < N; i++) if (rollShiny(createRng(i))) hits++
    const rate = hits / N
    expect(rate).toBeGreaterThan(0.005)
    expect(rate).toBeLessThan(0.02)
  })
})

describe('shinyFor', () => {
  it('é determinístico para as mesmas partes', () => {
    expect(shinyFor(123, 4, 5)).toBe(shinyFor(123, 4, 5))
  })

  it('encontra ao menos um seed shiny e um não-shiny', () => {
    const results = Array.from({ length: 500 }, (_, i) => shinyFor(i))
    expect(results).toContain(true)
    expect(results).toContain(false)
  })
})

describe('spotHasShiny', () => {
  it('é true sse qualquer slot do spot for shiny', () => {
    let found = false
    for (let day = 1; day <= 30 && !found; day++) {
      for (let spot = 0; spot < 8 && !found; spot++) {
        const has = spotHasShiny(777, day, spot)
        const anySlot = shinyFor(777, day, spot, 0) || shinyFor(777, day, spot, 1)
        expect(has).toBe(anySlot)
        if (has) found = true
      }
    }
    expect(found).toBe(true)
  })
})
