import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'
import { SHINY_CHANCE, SHINY_CHARM_BONUS } from './constants.ts'
import { rollShiny, shinyChance, shinyFor, shinyForChance, spotHasShiny } from './shiny.ts'

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

describe('shiny charm', () => {
  it('shinyChance soma +19% quando o item está na run', () => {
    expect(shinyChance([])).toBeCloseTo(SHINY_CHANCE)
    expect(shinyChance(['shiny-charm'])).toBeCloseTo(SHINY_CHANCE + 0.19)
    expect(shinyChance(['shiny-charm'])).toBeCloseTo(0.2)
  })

  it('é monotônico: tudo que era shiny a 1% segue shiny a 5%', () => {
    const base = SHINY_CHANCE
    const boosted = SHINY_CHANCE + SHINY_CHARM_BONUS
    for (let i = 0; i < 2000; i++) {
      if (shinyForChance(base, i)) expect(shinyForChance(boosted, i)).toBe(true)
    }
  })

  it('a chance maior produz MAIS shinies no agregado', () => {
    let lo = 0
    let hi = 0
    for (let i = 0; i < 5000; i++) {
      if (shinyForChance(SHINY_CHANCE, i)) lo++
      if (shinyForChance(SHINY_CHANCE + SHINY_CHARM_BONUS, i)) hi++
    }
    expect(hi).toBeGreaterThan(lo)
  })
})
