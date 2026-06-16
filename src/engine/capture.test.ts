import { describe, expect, it } from 'vitest'
import type { PokemonType } from '../types/index.ts'
import { CAPTURE_CHOICES, LEVEL_MAX, LEVEL_MIN, MAX_ROSTER_SIZE } from './constants.ts'
import { createRng } from './rng.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import {
  captureAvailable,
  captureWild,
  rollCandidates,
  rollEncounter,
  rosterIsFull,
  searchMs,
  wildLevel,
} from './capture.ts'
import { makeAttrs, makeMon } from './testkit.ts'

const GYM_TYPES: PokemonType[] = ['rock', 'water', 'grass']

/** Teto de raridade que libera TODAS as raridades (Masterball) — usado nos sorteios dos testes. */
const ALL_RARITIES = 4

function rosterOf(n: number) {
  return Array.from({ length: n }, (_, i) => makeMon({ id: `r${i}` }))
}

describe('limite de roster (PLAN §4.5)', () => {
  it('captura bloqueada com 9 Pokémon', () => {
    expect(rosterIsFull(rosterOf(MAX_ROSTER_SIZE))).toBe(true)
    expect(captureAvailable(rosterOf(MAX_ROSTER_SIZE))).toBe(false)
    expect(captureAvailable(rosterOf(MAX_ROSTER_SIZE - 1))).toBe(true)
  })
})

describe('searchMs (PLAN §4.5)', () => {
  it('mais Inteligência = busca mais rápida', () => {
    const slow = makeMon({ baseAttrs: makeAttrs({ inteligencia: 10 }) })
    const fast = makeMon({ baseAttrs: makeAttrs({ inteligencia: 50 }) })
    expect(searchMs(fast)).toBeLessThan(searchMs(slow))
  })

  it('passiva Keen Eye acelera a busca', () => {
    const base = makeMon({ baseAttrs: makeAttrs({ inteligencia: 30 }) })
    const keen = makeMon({ baseAttrs: makeAttrs({ inteligencia: 30 }), passives: ['keen-eye'] })
    expect(searchMs(keen)).toBeLessThan(searchMs(base))
  })
})

describe('wildLevel (PLAN §4.5)', () => {
  it('= dia ± 1, sempre em [1, 10]', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const day of [1, 5, 10]) {
        const level = wildLevel(createRng(seed), day)
        expect(level).toBeGreaterThanOrEqual(LEVEL_MIN)
        expect(level).toBeLessThanOrEqual(LEVEL_MAX)
        const allowed = [-1, 0, 1].map((v) => Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, day + v)))
        expect(allowed).toContain(level)
      }
    }
  })
})

describe('rollCandidates / rollEncounter (PLAN §4.5)', () => {
  it('sorteia até CAPTURE_CHOICES candidatos, todos dos tipos do ginásio e elegíveis', () => {
    for (let seed = 0; seed < 50; seed++) {
      const candidates = rollCandidates(createRng(seed), GYM_TYPES, 5, ALL_RARITIES)
      expect(candidates.length).toBeLessThanOrEqual(CAPTURE_CHOICES)
      for (const s of candidates) {
        expect(s.types.some((t) => GYM_TYPES.includes(t))).toBe(true)
        expect(5).toBeGreaterThanOrEqual(s.minWildLevel) // filtro de evolução
      }
    }
  })

  it('filtro de evolução: nível baixo não traz formas evoluídas', () => {
    // Venusaur (3) evolui no nível 6 → não aparece num sorteio de nível 3.
    for (let seed = 0; seed < 100; seed++) {
      const ids = rollCandidates(createRng(seed), GYM_TYPES, 3, ALL_RARITIES).map((s) => s.id)
      expect(ids).not.toContain(3)
    }
  })

  it('rollEncounter dá um nível por candidato e cada espécie é elegível para o SEU nível', () => {
    const enc = rollEncounter(createRng(11), GYM_TYPES, 7, ALL_RARITIES)
    expect(enc.levels).toHaveLength(enc.candidates.length)
    enc.candidates.forEach((s, i) => {
      const level = enc.levels[i]!
      expect(level).toBeGreaterThanOrEqual(LEVEL_MIN)
      expect(level).toBeLessThanOrEqual(LEVEL_MAX)
      expect(level).toBeGreaterThanOrEqual(s.minWildLevel) // elegível para o próprio nível
    })
  })
})

describe('captureWild (PLAN §4.5)', () => {
  it('adiciona o capturado ao roster (novo array)', () => {
    const roster = rosterOf(3)
    const next = captureWild({
      roster,
      species: getSpecies(7),
      level: 4,
      rng: createRng(1),
      id: 'new',
    })
    expect(next).toHaveLength(4)
    expect(next[3]?.speciesId).toBe(7)
    expect(next[3]?.level).toBe(4)
    expect(roster).toHaveLength(3) // entrada intacta
  })

  it('lança com o roster cheio', () => {
    expect(() =>
      captureWild({
        roster: rosterOf(MAX_ROSTER_SIZE),
        species: getSpecies(1),
        level: 3,
        rng: createRng(1),
        id: 'x',
      }),
    ).toThrow()
  })
})
