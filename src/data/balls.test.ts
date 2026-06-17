import { describe, expect, it } from 'vitest'
import type { PokemonType } from '../types/index.ts'
import { RARITIES } from '../types/index.ts'
import { createRng } from '../engine/rng.ts'
import { rollEncounter } from '../engine/capture.ts'
import { perceptionRankCenter } from '../engine/ranking.ts'
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

  it('Pokébola inicial é grátis; as demais custam 500', () => {
    expect(BALLS[0]?.price).toBe(0)
    for (const ball of BALLS.slice(1)) expect(ball.price).toBe(500)
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

describe('Percepção → centro de rank do encontro', () => {
  it('mapeia Percepção em centro contínuo de rank (0=F … 6=S)', () => {
    expect(perceptionRankCenter(0)).toBe(0) // F
    expect(perceptionRankCenter(10)).toBe(1) // E
    expect(perceptionRankCenter(30)).toBe(3) // C
    expect(perceptionRankCenter(50)).toBe(5) // A
    expect(perceptionRankCenter(60)).toBe(6) // S
  })

  it('cada ponto de Percepção conta (não anda só de 10 em 10)', () => {
    expect(perceptionRankCenter(11)).toBeCloseTo(1.1)
    expect(perceptionRankCenter(19)).toBeCloseTo(1.9)
    expect(perceptionRankCenter(11)).not.toBe(perceptionRankCenter(19))
  })

  it('clampa nas pontas (não passa de S nem abaixo de F)', () => {
    expect(perceptionRankCenter(-5)).toBe(0)
    expect(perceptionRankCenter(80)).toBe(6)
  })
})

describe('dano por dia (batalha e falha de missão)', () => {
  it('1-3 → 1, 4-6 → 2, 7-9 → 3, 10 → 4', () => {
    expect([1, 2, 3].map(damageForDay)).toEqual([1, 1, 1])
    expect([4, 5, 6].map(damageForDay)).toEqual([2, 2, 2])
    expect([7, 8, 9].map(damageForDay)).toEqual([3, 3, 3])
    expect(damageForDay(10)).toBe(4)
  })
})

// Sanidade: getSpecies existe para todas as bolas? (apenas garante que o módulo de espécies carrega.)
it('módulo de espécies disponível para os encontros', () => {
  expect(getSpecies(1).id).toBe(1)
})
