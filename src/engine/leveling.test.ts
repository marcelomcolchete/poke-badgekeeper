import { describe, expect, it } from 'vitest'
import { LEVEL_MAX } from './constants.ts'
import { RARITY_XP_RATE } from './balance.ts'
import { createRng } from './rng.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import {
  addXp,
  allocatePoint,
  createPokemon,
  evolveOneStage,
  evolveToLevel,
  pendingPoints,
  rarityXpRate,
  totalAllocated,
  xpToNext,
} from './leveling.ts'
import { makeMon } from './testkit.ts'
import { pokemonRank, rankDistribution, RANKS } from './ranking.ts'
import { ATTR_KEYS } from '../types/index.ts'

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

  it('shiny nasce sempre rank S e com a flag', () => {
    const mon = createPokemon({ id: 's1', speciesId: 1, level: 5, rng: createRng(1), shiny: true })
    expect(mon.shiny).toBe(true)
    expect(pokemonRank(mon)).toBe('S')
  })

  it('não-shiny não ganha a flag', () => {
    const mon = createPokemon({ id: 'n1', speciesId: 1, level: 5, rng: createRng(1) })
    expect(mon.shiny).toBeUndefined()
  })

  it('é determinístico para a mesma seed', () => {
    const a = createPokemon({ id: 'x', speciesId: 7, level: 8, rng: createRng(99) })
    const b = createPokemon({ id: 'x', speciesId: 7, level: 8, rng: createRng(99) })
    expect(a.allocations).toEqual(b.allocations)
  })
})

describe('createPokemon — rank pela Percepção do explorador (searcherPerception)', () => {
  /** Frequência do rank final sobre N seeds para uma Percepção. */
  function rankFreq(perception: number, n = 20000): number[] {
    const counts = new Array(RANKS.length).fill(0)
    for (let seed = 0; seed < n; seed++) {
      const mon = createPokemon({ id: 'e', speciesId: 19, level: 1, rng: createRng(seed), searcherPerception: perception })
      counts[RANKS.indexOf(pokemonRank(mon))]++
    }
    return counts.map((c) => c / n)
  }

  it('a distribuição final do rank bate com rankDistribution (perc 60 ≈ 50% S / 40% A / 10% B)', () => {
    const freq = rankFreq(60)
    const dist = rankDistribution(60)
    for (let k = 0; k < RANKS.length; k++) expect(freq[k]).toBeCloseTo(dist[k] as number, 1)
    expect(freq[RANKS.indexOf('S')]).toBeCloseTo(0.5, 1)
  })

  it('S nunca aparece com Percepção ≤ 50', () => {
    for (let seed = 0; seed < 5000; seed++) {
      const mon = createPokemon({ id: 'e', speciesId: 19, level: 1, rng: createRng(seed), searcherPerception: 50 })
      expect(pokemonRank(mon)).not.toBe('S')
    }
  })

  it('mantém variedade entre eixos num rank intermediário', () => {
    // procura um Pokémon de rank não-extremo e confere que os IVs não são todos iguais
    let varied = false
    for (let seed = 0; seed < 200 && !varied; seed++) {
      const mon = createPokemon({ id: 'e', speciesId: 19, level: 1, rng: createRng(seed), searcherPerception: 30 })
      if (new Set(ATTR_KEYS.map((k) => mon.ivs[k])).size > 1) varied = true
    }
    expect(varied).toBe(true)
  })

  it('shiny vence a Percepção: continua sempre rank S', () => {
    const mon = createPokemon({ id: 'e', speciesId: 19, level: 1, rng: createRng(3), searcherPerception: 0, shiny: true })
    expect(pokemonRank(mon)).toBe('S')
  })

  it('é determinístico: mesma seed + Percepção → mesmos IVs (preview == captura)', () => {
    const a = createPokemon({ id: 'e', speciesId: 19, level: 4, rng: createRng(77), searcherPerception: 45 })
    const b = createPokemon({ id: 'e', speciesId: 19, level: 4, rng: createRng(77), searcherPerception: 45 })
    expect(a.ivs).toEqual(b.ivs)
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
    // XP efetivo p/ chegar ao nível 4, ajustado pela taxa de raridade da espécie.
    const need = Math.ceil((xpToNext(1) + xpToNext(2) + xpToNext(3)) / rarityXpRate(1))
    const { pokemon } = addXp(bulba, need)
    expect(pokemon.level).toBe(4)
    expect(pokemon.speciesId).toBe(2) // Bulbasaur → Ivysaur (atLevel 4)
    expect(pokemon.types).toEqual(getSpecies(2).types)
  })

  it('evolui em cadeia quando o nível cobre vários limiares', () => {
    const lvl8Bulba = createPokemon({ id: 'b', speciesId: 1, level: 8, rng: rng() })
    expect(lvl8Bulba.speciesId).toBe(1) // createPokemon não evolui sozinho
    const evolved = evolveToLevel(lvl8Bulba)
    expect(evolved.speciesId).toBe(3) // 1 → 2 → 3 (Venusaur) no nível 8 (limiares 4·8)
    expect(evolved.level).toBe(8)
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

describe('evolveOneStage (Moon Stone)', () => {
  it('evolui 1 estágio mantendo o nível, ignorando atLevel', () => {
    // Bulbasaur (1) → Ivysaur (2). Nível 1, abaixo do atLevel de evolução.
    const bulba = createPokemon({ id: 'b', speciesId: 1, level: 1, rng: createRng(1) })
    const evolved = evolveOneStage(bulba, createRng(2))
    expect(evolved.speciesId).toBe(2)
    expect(evolved.level).toBe(1)
  })

  it('espécie final retorna inalterada', () => {
    // Venusaur (3) não evolui.
    const venu = createPokemon({ id: 'v', speciesId: 3, level: 5, rng: createRng(1) })
    expect(evolveOneStage(venu, createRng(2)).speciesId).toBe(3)
  })

  it('NÃO encadeia: só um estágio por chamada', () => {
    // Charmander (4) → Charmeleon (5), não Charizard (6).
    const char = createPokemon({ id: 'c', speciesId: 4, level: 9, rng: createRng(1) })
    expect(evolveOneStage(char, createRng(2)).speciesId).toBe(5)
  })
})
