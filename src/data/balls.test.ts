import { describe, expect, it } from 'vitest'
import type { PokemonType } from '../types/index.ts'
import { RARITIES } from '../types/index.ts'
import { createRng } from '../engine/rng.ts'
import { rollEncounter } from '../engine/capture.ts'
import { rankDistribution, RANKS } from '../engine/ranking.ts'
import { damageForDay } from '../engine/constants.ts'
import { getSpecies } from './pokemon/index.ts'
import { BALLS, currentBall, maxRarityIndexForBall, nextBall } from './balls.ts'

describe('bolas — progressão e teto de raridade', () => {
  it('nextBall avança Pokébola → … → Masterball e para no topo', () => {
    expect(nextBall(0)?.id).toBe('poke-ball')
    expect(nextBall(1)?.id).toBe('great-ball')
    expect(nextBall(2)?.id).toBe('ultra-ball')
    expect(nextBall(3)?.id).toBe('master-ball')
    expect(nextBall(4)).toBeNull() // já no topo
  })

  it('preço crescente por nível: 200 → 400 → 800 → 1600', () => {
    expect(BALLS.map((b) => b.price)).toEqual([200, 400, 800, 1600])
  })

  it('currentBall reflete a bola possuída (null no nível 0)', () => {
    expect(currentBall(0)).toBeNull()
    expect(currentBall(1)?.id).toBe('poke-ball')
    expect(currentBall(4)?.id).toBe('master-ball')
  })

  it('o teto de raridade sobe a cada nível de bola', () => {
    expect(maxRarityIndexForBall(0)).toBe(RARITIES.indexOf('common'))
    expect(maxRarityIndexForBall(1)).toBe(RARITIES.indexOf('uncommon'))
    expect(maxRarityIndexForBall(2)).toBe(RARITIES.indexOf('rare'))
    expect(maxRarityIndexForBall(3)).toBe(RARITIES.indexOf('epic'))
    expect(maxRarityIndexForBall(4)).toBe(RARITIES.indexOf('legend'))
  })
})

describe('exploração — encontros respeitam o teto da bola', () => {
  const GYM_TYPES: PokemonType[] = ['rock', 'water', 'grass']

  it('sem bola (maxRarityIndex 0) só aparecem Pokémon Comuns', () => {
    for (let seed = 0; seed < 60; seed++) {
      const enc = rollEncounter(createRng(seed), GYM_TYPES, 5, 0)
      for (const s of enc.candidates) expect(s.rarity).toBe('common')
    }
  })

  it('Masterball (teto 4) libera raridades acima de Comum em algum sorteio', () => {
    let sawAboveCommon = false
    for (let seed = 0; seed < 80; seed++) {
      const enc = rollEncounter(createRng(seed), GYM_TYPES, 9, 4)
      if (enc.candidates.some((s) => RARITIES.indexOf(s.rarity) > 0)) sawAboveCommon = true
    }
    expect(sawAboveCommon).toBe(true)
  })
})

describe('Percepção → distribuição de rank do encontro', () => {
  const probS = (perc: number) => rankDistribution(perc)[RANKS.indexOf('S')] as number

  it('Percepção maior empurra a massa para ranks melhores (perc 60 ≈ 50% S)', () => {
    expect(probS(60)).toBeCloseTo(0.5, 2)
    expect(rankDistribution(0)[RANKS.indexOf('F')]).toBeCloseTo(1, 10)
  })

  it('S só é possível acima de 50 de Percepção', () => {
    expect(probS(50)).toBe(0)
    expect(probS(51)).toBeGreaterThan(0)
  })
})

describe('dano por dia (batalha e falha de missão)', () => {
  it('+1 a cada 2 dias: 1-2→1, 3-4→2, 9-10→5, sem teto', () => {
    expect([1, 2].map(damageForDay)).toEqual([1, 1])
    expect([3, 4].map(damageForDay)).toEqual([2, 2])
    expect([9, 10].map(damageForDay)).toEqual([5, 5])
    expect(damageForDay(11)).toBe(6)
    expect(damageForDay(20)).toBe(10)
  })

  it('dia ≤ 1 tem piso de dano 1', () => {
    expect(damageForDay(1)).toBe(1)
    expect(damageForDay(0)).toBe(1)
  })
})

// Sanidade: getSpecies existe para todas as bolas? (apenas garante que o módulo de espécies carrega.)
it('módulo de espécies disponível para os encontros', () => {
  expect(getSpecies(1).id).toBe(1)
})
