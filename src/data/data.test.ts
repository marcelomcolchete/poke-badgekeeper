import { describe, expect, it } from 'vitest'
import { ATTR_KEYS, POKEMON_TYPES, RARITIES } from '../types/index.ts'
import type { Attrs } from '../types/index.ts'
import {
  LEVEL_MAX,
  LEVEL_MIN,
  SPECIES_BASE_MAX,
  SPECIES_BASE_MIN,
} from '../engine/constants.ts'
import { allSpecies, getSpecies, wildCandidates } from './pokemon/index.ts'
import { singleTypeMultiplier, typeMultiplier } from './typeChart.ts'
import { CITIES } from './cities.ts'
import { ITEMS } from './items.ts'
import { MISSION_TEMPLATES } from './missionTemplates.ts'
import { PASSIVES } from './passives.ts'

const TYPE_SET = new Set<string>(POKEMON_TYPES)
const RARITY_SET = new Set<string>(RARITIES)
const attrTotal = (a: Attrs): number => ATTR_KEYS.reduce((sum, k) => sum + a[k], 0)

describe('espécies da Gen 1', () => {
  const species = allSpecies()

  it('tem exatamente as 151 espécies (ids 1..151)', () => {
    expect(species).toHaveLength(151)
    const ids = new Set(species.map((s) => s.id))
    for (let id = 1; id <= 151; id++) expect(ids.has(id)).toBe(true)
  })

  it('cada espécie tem 1–2 tipos válidos', () => {
    for (const s of species) {
      expect(s.types.length).toBeGreaterThanOrEqual(1)
      expect(s.types.length).toBeLessThanOrEqual(2)
      for (const t of s.types) expect(TYPE_SET.has(t)).toBe(true)
    }
  })

  it('atributos base completos e no intervalo 10–50', () => {
    for (const s of species) {
      for (const key of ATTR_KEYS) {
        const v = s.baseAttrs[key]
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(SPECIES_BASE_MIN)
        expect(v).toBeLessThanOrEqual(SPECIES_BASE_MAX)
      }
    }
  })

  it('evolução é consistente (alvo existe, níveis na escala 1–10)', () => {
    for (const s of species) {
      expect(s.minWildLevel).toBeGreaterThanOrEqual(LEVEL_MIN)
      expect(s.minWildLevel).toBeLessThanOrEqual(LEVEL_MAX)
      if (s.evolvesTo) {
        expect(() => getSpecies(s.evolvesTo!.id)).not.toThrow()
        expect(s.evolvesTo.atLevel).toBeGreaterThanOrEqual(LEVEL_MIN)
        expect(s.evolvesTo.atLevel).toBeLessThanOrEqual(LEVEL_MAX)
      }
    }
  })

  it('Charmander (4) evolui em Charmeleon (5)', () => {
    expect(getSpecies(4).evolvesTo?.id).toBe(5)
  })

  it('toda espécie tem raridade válida', () => {
    for (const s of species) expect(RARITY_SET.has(s.rarity)).toBe(true)
  })

  it('a forma evoluída sempre tem total de atributos maior que a anterior (§4.1)', () => {
    for (const s of species) {
      if (!s.evolvesTo) continue
      const evolved = getSpecies(s.evolvesTo.id)
      expect(attrTotal(evolved.baseAttrs)).toBeGreaterThan(attrTotal(s.baseAttrs))
    }
  })

  it('wildCandidates filtra por nível de evolução', () => {
    // Venusaur (3) só surge a partir do nível em que evolui → fora de um sorteio nível baixo.
    const venusaurLevel = getSpecies(3).minWildLevel
    const low = wildCandidates('grass', venusaurLevel - 1).map((s) => s.id)
    expect(low).not.toContain(3)
    const high = wildCandidates('grass', venusaurLevel).map((s) => s.id)
    expect(high).toContain(3)
  })
})

describe('tabela de tipos (Gen 1)', () => {
  it('matchups canônicos conhecidos', () => {
    expect(singleTypeMultiplier('water', 'fire')).toBe(2)
    expect(singleTypeMultiplier('fire', 'water')).toBe(0.5)
    expect(singleTypeMultiplier('electric', 'ground')).toBe(0)
    expect(singleTypeMultiplier('normal', 'ghost')).toBe(0)
    expect(singleTypeMultiplier('ghost', 'psychic')).toBe(0) // quirk Gen 1
    expect(singleTypeMultiplier('normal', 'normal')).toBe(1)
  })

  it('multiplicador de tipo duplo é o produto dos eixos', () => {
    // Rock 2× contra Fire e 2× contra Flying → Charizard (fire/flying) = 4×.
    expect(typeMultiplier('rock', ['fire', 'flying'])).toBe(4)
  })
})

describe('cidades, itens, missões, passivas', () => {
  it('8 cidades com índices 0..7 e inicial válido', () => {
    expect(CITIES).toHaveLength(8)
    CITIES.forEach((c, i) => {
      expect(c.index).toBe(i)
      expect(TYPE_SET.has(c.primaryType)).toBe(true)
      expect(() => getSpecies(c.starterSpeciesId)).not.toThrow()
    })
  })

  it('listas não-vazias com ids únicos', () => {
    for (const list of [ITEMS, MISSION_TEMPLATES, PASSIVES]) {
      expect(list.length).toBeGreaterThan(0)
      const ids = list.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('exigências de missão ficam em 0–100', () => {
    for (const tpl of MISSION_TEMPLATES) {
      for (const key of ATTR_KEYS) {
        expect(tpl.requirement[key]).toBeGreaterThanOrEqual(0)
        expect(tpl.requirement[key]).toBeLessThanOrEqual(100)
      }
    }
  })

  it('grafo de cada cidade: adjacência simétrica e sítios válidos (ginásio = j)', () => {
    for (const c of CITIES) {
      const { nodes, adj } = c.graph
      for (const [id, neighbors] of Object.entries(adj)) {
        for (const n of neighbors) {
          expect(nodes[n], `${id}→${n} aponta para ponto inexistente`).toBeDefined()
          expect(adj[n], `aresta ${id}–${n} não é simétrica`).toContain(id)
        }
      }
      const sn = c.siteNodes
      expect(sn.gym).toBe('j')
      for (const id of [sn.gym, sn.center, sn.mart, sn.museum, ...sn.houses, ...sn.green]) {
        expect(nodes[id], `sítio ${id} fora do grafo`).toBeDefined()
      }
    }
  })
})
