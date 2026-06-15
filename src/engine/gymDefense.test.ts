import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES } from '../types/index.ts'
import { ATTR_MAX, DEFENSE_SQUAD_BY_DAY } from './constants.ts'
import { DEFENSE_BUFF_BATTLE } from './balance.ts'
import { createRng } from './rng.ts'
import { getTrainer } from '../data/trainers.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import type { EnemyUnit } from './gymDefense.ts'
import {
  canDefend,
  duelWinProbability,
  effectiveBattle,
  enemySquadSizeForDay,
  generateDefenseEnemies,
  gymWinXp,
  resolveDefense,
  trainerSquadSpecies,
  typeAdvantageMultiplier,
} from './gymDefense.ts'
import { fixedRng, makeAttrs, makeMon } from './testkit.ts'

describe('canDefend', () => {
  it('exige ≥1 Pokémon', () => {
    expect(canDefend([])).toBe(false)
    expect(canDefend([makeMon()])).toBe(true)
  })
})

describe('gymWinXp (PLAN §4.4, ajuste)', () => {
  it('rende 0,5 de XP por ponto de poder do desafiante', () => {
    expect(gymWinXp(20)).toBe(10)
    expect(gymWinXp(40)).toBe(20)
  })

  it('teto de 30 (poder máximo capado em ATTR_MAX = 60 → 0,5×60 = 30)', () => {
    expect(gymWinXp(ATTR_MAX)).toBe(30)
    expect(gymWinXp(200)).toBe(30)
  })

  it('arredonda o valor parcial', () => {
    expect(gymWinXp(15)).toBe(8) // 7,5 → 8
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
    // HP mínimo agora é 2 (resistência mínima 10); 1 HP exige override para testar o desmaio.
    const fragile = makeMon({ id: 'b', types: ['normal'], baseAttrs: makeAttrs({ batalha: 10, resistencia: 10 }), currentHp: 1 })
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

describe('trainerSquadSpecies (PLAN §4.4)', () => {
  it('elenco roster só sorteia espécies da lista da classe (com repetição)', () => {
    const youngster = getTrainer('YOUNGSTER')
    const pool = new Set(youngster.pool.kind === 'roster' ? youngster.pool.speciesIds : [])
    const squad = trainerSquadSpecies(createRng(1), youngster, 6)
    expect(squad).toHaveLength(6)
    for (const id of squad) expect(pool.has(id)).toBe(true)
  })

  it('rival põe o líder fixo na frente e no máx. 1 lendário no time', () => {
    const red = getTrainer('RED') // líder = Charmander (4)
    for (let seed = 0; seed < 30; seed++) {
      const squad = trainerSquadSpecies(createRng(seed), red, 6)
      expect(squad).toHaveLength(6)
      expect(squad[0]).toBe(4)
      const legendaries = squad.filter((id) => getSpecies(id).rarity === 'legend')
      expect(legendaries.length).toBeLessThanOrEqual(1)
    }
  })
})

describe('generateDefenseEnemies', () => {
  it('respeita o tamanho, usa o elenco do treinador e a Batalha-base ±10 (exceto o destaque)', () => {
    const typeSet = new Set<string>(POKEMON_TYPES)
    const brock = getTrainer('BROCK')
    const enemies = generateDefenseEnemies(createRng(1), brock, 6)
    expect(enemies).toHaveLength(6)
    for (const e of enemies) {
      expect(e.battle).toBeGreaterThanOrEqual(0)
      const base = getSpecies(e.speciesId as number).baseAttrs.batalha
      // O destaque ganha +15 (pode passar do teto normal); os demais ficam em base ±10 e ≤ teto.
      if (e.buffed) {
        expect(e.battle - base).toBeLessThanOrEqual(10 + DEFENSE_BUFF_BATTLE)
      } else {
        expect(e.battle).toBeLessThanOrEqual(ATTR_MAX)
        expect(Math.abs(e.battle - base)).toBeLessThanOrEqual(10)
      }
      for (const t of e.types) expect(typeSet.has(t)).toBe(true)
    }
  })

  it('exatamente um desafiante sai em destaque (+15 de Batalha e medalha)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const enemies = generateDefenseEnemies(createRng(seed), getTrainer('BROCK'), 4)
      expect(enemies.filter((e) => e.buffed).length).toBe(1)
    }
  })

  it('cada desafiante tem o seu próprio poder de batalha (não são todos iguais)', () => {
    const enemies = generateDefenseEnemies(createRng(1), getTrainer('BROCK'), 6)
    expect(new Set(enemies.map((e) => e.battle)).size).toBeGreaterThan(1)
  })

  it('é determinística para a mesma seed', () => {
    expect(generateDefenseEnemies(createRng(3), getTrainer('HIKER'), 3)).toEqual(
      generateDefenseEnemies(createRng(3), getTrainer('HIKER'), 3),
    )
  })

  it('atribui uma espécie a cada invasor (para exibir na batalha)', () => {
    for (const e of generateDefenseEnemies(createRng(7), getTrainer('LASS'), 4)) {
      expect(typeof e.speciesId).toBe('number')
    }
  })
})

describe('enemySquadSizeForDay (PLAN §4.4)', () => {
  it('segue a tabela fixa por dia (1→6)', () => {
    expect(enemySquadSizeForDay(1)).toBe(1)
    expect(enemySquadSizeForDay(2)).toBe(2)
    expect(enemySquadSizeForDay(5)).toBe(3)
    expect(enemySquadSizeForDay(7)).toBe(5)
    expect(enemySquadSizeForDay(9)).toBe(6)
    expect(enemySquadSizeForDay(10)).toBe(6)
  })

  it('casa com a constante DEFENSE_SQUAD_BY_DAY', () => {
    for (let day = 1; day <= 10; day++) {
      expect(enemySquadSizeForDay(day)).toBe(DEFENSE_SQUAD_BY_DAY[day])
    }
  })
})
