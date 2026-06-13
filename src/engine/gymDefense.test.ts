import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES } from '../types/index.ts'
import { ATTR_MAX } from './constants.ts'
import { createRng } from './rng.ts'
import type { EnemyUnit } from './gymDefense.ts'
import {
  canDefend,
  duelWinProbability,
  effectiveBattle,
  generateDefenseEnemies,
  resolveDefense,
  typeAdvantageMultiplier,
} from './gymDefense.ts'
import { fixedRng, makeAttrs, makeMon } from './testkit.ts'

describe('canDefend', () => {
  it('exige ≥1 Pokémon', () => {
    expect(canDefend([])).toBe(false)
    expect(canDefend([makeMon()])).toBe(true)
  })
})

describe('typeAdvantageMultiplier (PLAN §4.4)', () => {
  it('vantagem ×1,5 e desvantagem ×0,5', () => {
    expect(typeAdvantageMultiplier(['water'], ['fire'])).toBe(1.5)
    expect(typeAdvantageMultiplier(['fire'], ['water'])).toBe(0.5)
  })

  it('imunidade canônica conta como desvantagem (×0,5)', () => {
    // Normal não afeta Ghost (0×) → tratado como desvantagem.
    expect(typeAdvantageMultiplier(['normal'], ['ghost'])).toBe(0.5)
  })

  it('acumula contra alvo de tipo duplo', () => {
    // Rock tem vantagem contra Fire e Flying → 1,5 × 1,5.
    expect(typeAdvantageMultiplier(['rock'], ['fire', 'flying'])).toBeCloseTo(2.25, 6)
  })

  it('matchup neutro = 1', () => {
    expect(typeAdvantageMultiplier(['normal'], ['normal'])).toBe(1)
  })

  it('effectiveBattle aplica o multiplicador', () => {
    const mon = makeMon({ types: ['water'], baseAttrs: makeAttrs({ batalha: 40 }) })
    expect(effectiveBattle(mon, ['fire'])).toBeCloseTo(40 * 1.5, 6)
  })
})

describe('duelWinProbability (PLAN §4.4)', () => {
  it('vitória garantida quando ≥ oponente', () => {
    expect(duelWinProbability(80, 50)).toBe(1)
    expect(duelWinProbability(50, 50)).toBe(1)
  })

  it('proporcional abaixo e oponente nulo → 1', () => {
    expect(duelWinProbability(25, 50)).toBeCloseTo(0.5, 6)
    expect(duelWinProbability(10, 0)).toBe(1)
  })
})

describe('resolveDefense (PLAN §4.4)', () => {
  const enemiesWeak: EnemyUnit[] = [
    { battle: 10, types: ['normal'] },
    { battle: 10, types: ['normal'] },
  ]
  const enemiesStrong: EnemyUnit[] = [
    { battle: 100, types: ['normal'] },
    { battle: 100, types: ['normal'] },
    { battle: 100, types: ['normal'] },
  ]

  it('time forte vence e a frente sai ilesa', () => {
    const champ = makeMon({
      id: 'c',
      types: ['normal'],
      baseAttrs: makeAttrs({ batalha: 50, resistencia: 100 }),
    })
    const out = resolveDefense(fixedRng(0), [champ], enemiesWeak)
    expect(out.won).toBe(true)
    expect(out.duels).toHaveLength(2)
    expect(out.squad[0]?.currentHp).toBe(champ.maxHp) // vencedor não perde HP
  })

  it('cada Pokémon que perde um duelo perde 1 HP e sai; defesa perdida', () => {
    const tank = makeMon({ id: 'a', types: ['normal'], baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }) })
    const fragile = makeMon({ id: 'b', types: ['normal'], baseAttrs: makeAttrs({ batalha: 10, resistencia: 10 }) })
    const out = resolveDefense(fixedRng(0.999), [tank, fragile], enemiesStrong)
    expect(out.won).toBe(false)
    expect(out.squad[0]?.currentHp).toBe(tank.maxHp - 1) // perdeu 1 HP
    expect(out.squad[1]?.currentHp).toBe(0) // 1 HP → desmaiou
    expect(out.squad[1]?.status).toBe('fainted')
  })

  it('não muta o esquadrão de entrada e é determinística', () => {
    const squad = [makeMon({ id: 'a', baseAttrs: makeAttrs({ resistencia: 100 }) })]
    const a = resolveDefense(createRng(5), squad, enemiesStrong)
    const b = resolveDefense(createRng(5), squad, enemiesStrong)
    expect(a).toEqual(b)
    expect(squad[0]?.currentHp).toBe(squad[0]?.maxHp)
  })

  it('inimigos vazios → vitória; esquadrão vazio → derrota', () => {
    expect(resolveDefense(fixedRng(0), [makeMon()], []).won).toBe(true)
    expect(resolveDefense(fixedRng(0), [], enemiesWeak).won).toBe(false)
  })
})

describe('generateDefenseEnemies', () => {
  it('respeita o tamanho, escala com o dia e usa tipos válidos', () => {
    const typeSet = new Set<string>(POKEMON_TYPES)
    const day1 = generateDefenseEnemies(createRng(1), 1, 4)
    const day9 = generateDefenseEnemies(createRng(1), 9, 4)
    expect(day1).toHaveLength(4)
    expect(day9[0]?.battle).toBeGreaterThan(day1[0]?.battle ?? 0)
    for (const e of day1) {
      expect(e.battle).toBeLessThanOrEqual(ATTR_MAX)
      for (const t of e.types) expect(typeSet.has(t)).toBe(true)
    }
  })

  it('é determinística para a mesma seed', () => {
    expect(generateDefenseEnemies(createRng(3), 5, 3)).toEqual(
      generateDefenseEnemies(createRng(3), 5, 3),
    )
  })
})
