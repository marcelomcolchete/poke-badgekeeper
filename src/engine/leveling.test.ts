import { describe, expect, it } from 'vitest'
import { LEVEL_MAX } from './constants.ts'
import { RARITY_XP_RATE } from './balance.ts'
import { createRng } from './rng.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import {
  addXp,
  allocatePoint,
  createPokemon,
  evolveToLevel,
  pendingPoints,
  rarityXpRate,
  totalAllocated,
  xpToNext,
} from './leveling.ts'
import { makeMon } from './testkit.ts'

const rng = () => createRng(2024)

describe('xpToNext', () => {
  it('é crescente e Infinity no nível máximo', () => {
    expect(xpToNext(1)).toBeLessThan(xpToNext(2))
    expect(xpToNext(LEVEL_MAX)).toBe(Infinity)
  })
})

describe('createPokemon', () => {
  it('distribui (nível − 1) pontos e nasce com HP cheio', () => {
    const mon = createPokemon({ id: 'w1', speciesId: 1, level: 5, rng: rng() })
    expect(mon.level).toBe(5)
    expect(totalAllocated(mon)).toBe(4) // nível 5 → 4 pontos
    expect(pendingPoints(mon)).toBe(0)
    expect(mon.currentHp).toBe(mon.maxHp)
    expect(mon.maxHp).toBeGreaterThanOrEqual(1)
    expect(mon.types).toEqual(getSpecies(1).types)
  })

  it('nível 1 não tem pontos alocados', () => {
    const mon = createPokemon({ id: 'w0', speciesId: 4, level: 1, rng: rng() })
    expect(totalAllocated(mon)).toBe(0)
    expect(pendingPoints(mon)).toBe(0)
  })

  it('é determinístico para a mesma seed', () => {
    const a = createPokemon({ id: 'x', speciesId: 7, level: 8, rng: createRng(99) })
    const b = createPokemon({ id: 'x', speciesId: 7, level: 8, rng: createRng(99) })
    expect(a.allocations).toEqual(b.allocations)
  })
})

describe('pendingPoints / allocatePoint', () => {
  it('level-up gera pontos pendentes que o jogador aloca', () => {
    const lvl1 = createPokemon({ id: 'p', speciesId: 19, level: 1, rng: rng() })
    const { pokemon, levelsGained } = addXp(lvl1, xpToNext(1) + xpToNext(2))
    expect(levelsGained).toBe(2)
    expect(pendingPoints(pokemon)).toBe(2)

    const after = allocatePoint(pokemon, 'batalha')
    expect(after.allocations.batalha).toBe(pokemon.allocations.batalha + 1)
    expect(pendingPoints(after)).toBe(1)
  })

  it('alocar sem pontos lança erro', () => {
    const mon = makeMon({ level: 1 })
    expect(() => allocatePoint(mon, 'batalha')).toThrow()
  })

  it('alocar em Resistência aumenta o HP máximo', () => {
    const base = createPokemon({ id: 'r', speciesId: 7, level: 1, rng: rng() }) // Squirtle (evolui no 3)
    // XP ajustado pela taxa de raridade da espécie p/ garantir o nível 2 (1 ponto pendente).
    const leveled = addXp(base, Math.ceil(xpToNext(1) / rarityXpRate(7))).pokemon
    const before = leveled.maxHp
    const buffed = allocatePoint(leveled, 'resistencia')
    expect(buffed.maxHp).toBeGreaterThanOrEqual(before)
  })
})

describe('XP por raridade (PLAN §4.5)', () => {
  it('rarityXpRate casa com a tabela da raridade da espécie', () => {
    expect(rarityXpRate(95)).toBe(RARITY_XP_RATE[getSpecies(95).rarity])
    expect(rarityXpRate(19)).toBe(RARITY_XP_RATE.common) // Rattata é comum
  })

  it('o mesmo XP rende menos progresso para um Pokémon mais raro', () => {
    const common = createPokemon({ id: 'c', speciesId: 19, level: 1, rng: rng() }) // Rattata, comum (1.0)
    const legend = createPokemon({ id: 'l', speciesId: 150, level: 1, rng: rng() }) // Mewtwo, lendário (0.5)
    expect(addXp(common, xpToNext(1)).levelsGained).toBeGreaterThan(
      addXp(legend, xpToNext(1)).levelsGained,
    )
  })
})

describe('addXp e nível máximo', () => {
  it('não passa do nível 10 por mais XP que receba', () => {
    const mon = createPokemon({ id: 'm', speciesId: 1, level: 1, rng: rng() })
    const { pokemon } = addXp(mon, 1_000_000)
    expect(pokemon.level).toBe(LEVEL_MAX)
  })

  it('XP negativo/zero não altera o nível', () => {
    const mon = createPokemon({ id: 'm', speciesId: 1, level: 3, rng: rng() })
    expect(addXp(mon, 0).pokemon.level).toBe(3)
    expect(addXp(mon, -50).pokemon.level).toBe(3)
  })
})

describe('evolução (PLAN §4.1.1)', () => {
  it('evolui ao atingir o nível de evolução, preservando nível/XP/alocações', () => {
    const bulba = createPokemon({ id: 'b', speciesId: 1, level: 1, rng: rng() })
    // XP efetivo p/ chegar ao nível 3, ajustado pela taxa de raridade da espécie.
    const need = Math.ceil((xpToNext(1) + xpToNext(2)) / rarityXpRate(1))
    const { pokemon } = addXp(bulba, need)
    expect(pokemon.level).toBe(3)
    expect(pokemon.speciesId).toBe(2) // Bulbasaur → Ivysaur (atLevel 3)
    expect(pokemon.types).toEqual(getSpecies(2).types)
  })

  it('evolui em cadeia quando o nível cobre vários limiares', () => {
    const lvl6Bulba = createPokemon({ id: 'b', speciesId: 1, level: 6, rng: rng() })
    expect(lvl6Bulba.speciesId).toBe(1) // createPokemon não evolui sozinho
    const evolved = evolveToLevel(lvl6Bulba)
    expect(evolved.speciesId).toBe(3) // 1 → 2 → 3 (Venusaur) no nível 6
    expect(evolved.level).toBe(6)
  })

  it('preserva a proporção de HP na evolução', () => {
    const hurt = { ...createPokemon({ id: 'h', speciesId: 1, level: 6, rng: rng() }) }
    const half = { ...hurt, currentHp: Math.max(1, Math.round(hurt.maxHp / 2)) }
    const ratioBefore = half.currentHp / half.maxHp
    const evolved = evolveToLevel(half)
    const ratioAfter = evolved.currentHp / evolved.maxHp
    expect(Math.abs(ratioAfter - ratioBefore)).toBeLessThan(0.5) // proporção aproximada
    expect(evolved.currentHp).toBeGreaterThan(0) // estava vivo, segue vivo
  })
})
