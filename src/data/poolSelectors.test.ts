import { describe, expect, it } from 'vitest'
import {
  allSpecies,
  baseStageSpecies,
  evolvedSpecies,
  familiesByType,
  getSpecies,
} from './pokemon/index.ts'

const LEGENDARIES = [144, 145, 146, 150, 151]

describe('familiesByType', () => {
  it('traz a família inteira de um tipo (Charmander 4 e Charizard 6 em fire)', () => {
    const fire = familiesByType('fire')
    expect(fire).toContain(4) // Charmander
    expect(fire).toContain(6) // Charizard (fire/flying — entra pela família)
  })

  it('exclui lendários (Moltres 146 não está em fire; Mewtwo 150/Mew 151 não em psychic)', () => {
    expect(familiesByType('fire')).not.toContain(146)
    const psychic = familiesByType('psychic')
    expect(psychic).not.toContain(150)
    expect(psychic).not.toContain(151)
  })

  it('multi-tipo é a união (water+flying contém Squirtle 7 e Pidgey 16)', () => {
    const pool = familiesByType('water', 'flying')
    expect(pool).toContain(7)
    expect(pool).toContain(16)
  })

  it('vem ordenado e sem repetição', () => {
    const pool = familiesByType('poison', 'dragon')
    const sorted = [...pool].sort((a, b) => a - b)
    expect(pool).toEqual(sorted)
    expect(new Set(pool).size).toBe(pool.length)
  })
})

describe('baseStageSpecies / evolvedSpecies', () => {
  it('baseStageSpecies tem formas-base (Bulbasaur 1) e não evoluídos (Ivysaur 2)', () => {
    expect(baseStageSpecies()).toContain(1)
    expect(baseStageSpecies()).not.toContain(2)
  })

  it('evolvedSpecies é o inverso (Ivysaur 2 sim, Bulbasaur 1 não)', () => {
    expect(evolvedSpecies()).toContain(2)
    expect(evolvedSpecies()).not.toContain(1)
  })

  it('ambos excluem lendários', () => {
    for (const id of LEGENDARIES) {
      expect(baseStageSpecies(), `base não deve ter ${id}`).not.toContain(id)
      expect(evolvedSpecies(), `evoluídos não deve ter ${id}`).not.toContain(id)
    }
  })

  it('são disjuntos e cobrem todas as 146 espécies não-lendárias', () => {
    const base = new Set(baseStageSpecies())
    const evolved = new Set(evolvedSpecies())
    for (const id of base) expect(evolved.has(id)).toBe(false)
    const nonLegend = allSpecies().filter((s) => getSpecies(s.id).rarity !== 'legend')
    expect(base.size + evolved.size).toBe(nonLegend.length)
    expect(nonLegend).toHaveLength(146)
  })
})
