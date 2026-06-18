import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES } from '../types/index.ts'
import { ATTR_MAX, DEFENSE_SQUAD_BY_DAY } from './constants.ts'
import { DEFENSE_MEDAL_BATTLE } from './balance.ts'
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
  medalChancesForDay,
  resolveDefense,
  rollMedalForDay,
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

describe('resolveDefense — Habilidades Secretas', () => {
  const oneStrong: EnemyUnit[] = [{ battle: 100, types: ['normal'] }]

  it('Explosion: ao perder, derrota o inimigo e a batalha é vencida mesmo perdendo o duelo', () => {
    // Geodude (74) com secretCount 2 = [Sturdy, Explosion]; Sturdy não está disponível (sem opts).
    const geo = makeMon({
      id: 'g', speciesId: 74, secretCount: 2, types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const out = resolveDefense(fixedRng(0.999), [geo], oneStrong)
    expect(out.duels).toHaveLength(1)
    expect(out.duels[0]?.youWon).toBe(false)
    expect(out.won).toBe(true) // a explosão levou o inimigo junto
    expect(out.squad[0]?.currentHp).toBeLessThan(geo.currentHp) // perdeu metade da vida
    expect(out.squad[0]?.currentHp).toBeGreaterThan(0) // sobreviveu (vida alta)
  })

  it('Explosion como último Pokémon que desmaia ainda vence (KO mútuo)', () => {
    const geo = makeMon({
      id: 'g', speciesId: 74, secretCount: 2, types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }), currentHp: 2,
    })
    const out = resolveDefense(fixedRng(0.999), [geo], oneStrong)
    expect(out.won).toBe(true)
    expect(out.squad[0]?.status).toBe('fainted')
  })

  it('Lightning Rod: contra inimigo Elétrico, o portador assume a frente', () => {
    const front = makeMon({ id: 'a', types: ['normal'], baseAttrs: makeAttrs({ batalha: 50 }) })
    const rod = makeMon({ id: 'b', speciesId: 111, secretCount: 1, types: ['ground'], baseAttrs: makeAttrs({ batalha: 50 }) })
    const electric: EnemyUnit[] = [{ battle: 10, types: ['electric'] }]
    const out = resolveDefense(fixedRng(0), [front, rod], electric)
    expect(out.duels[0]?.yourId).toBe('b') // o portador atraiu o duelo
  })

  it('Lightning Rod não troca a frente contra inimigo não-Elétrico', () => {
    const front = makeMon({ id: 'a', types: ['normal'], baseAttrs: makeAttrs({ batalha: 50 }) })
    const rod = makeMon({ id: 'b', speciesId: 111, secretCount: 1, types: ['ground'], baseAttrs: makeAttrs({ batalha: 50 }) })
    const out = resolveDefense(fixedRng(0), [front, rod], oneStrong)
    expect(out.duels[0]?.yourId).toBe('a')
  })

  it('Static: ao perder um duelo, paralisa o inimigo (Batalha ×0,5) nos duelos seguintes', () => {
    // Pikachu (25) secretCount 1 = [Static]. Bate fraco e tanque (sobrevive e passa a vez).
    const pika = makeMon({
      id: 'p', speciesId: 25, secretCount: 1, types: ['electric'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const next = makeMon({
      id: 'n', types: ['normal'], baseAttrs: makeAttrs({ batalha: 50, resistencia: 100 }),
    })
    const enemy: EnemyUnit[] = [{ battle: 100, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0.999), [pika, next], enemy)
    expect(out.duels[0]?.yourId).toBe('p')
    expect(out.duels[0]?.youWon).toBe(false)
    expect(out.duels[1]?.yourId).toBe('n')
    // Inimigo paralisado: enemyEff = 100 × 0,5 = 50.
    const expected = duelWinProbability(effectiveBattle(next, ['normal']), 50)
    expect(out.duels[1]?.pWin).toBeCloseTo(expected, 6)
  })

  it('sem Static, o inimigo não é paralisado (Batalha cheia no duelo seguinte)', () => {
    const plain = makeMon({
      id: 'p', types: ['normal'], baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const next = makeMon({
      id: 'n', types: ['normal'], baseAttrs: makeAttrs({ batalha: 50, resistencia: 100 }),
    })
    const enemy: EnemyUnit[] = [{ battle: 100, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0.999), [plain, next], enemy)
    expect(out.duels[1]?.yourId).toBe('n')
    const expected = duelWinProbability(effectiveBattle(next, ['normal']), 100)
    expect(out.duels[1]?.pWin).toBeCloseTo(expected, 6)
  })

  it('Reckless: ao perder, tenta de novo sem passar a vez (até desmaiar)', () => {
    // Rhyhorn (111) secretCount 3 = [Lightning Rod, Rock Head, Reckless].
    const rhy = makeMon({
      id: 'r', speciesId: 111, secretCount: 3, types: ['ground'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const out = resolveDefense(fixedRng(0.999), [rhy], oneStrong)
    expect(out.duels.length).toBeGreaterThan(1) // várias retentativas
    expect(out.duels.every((d) => d.yourId === 'r')).toBe(true) // sempre o mesmo lutador
    expect(out.squad[0]?.status).toBe('fainted')
    expect(out.won).toBe(false)
  })

  it('Shell Armor reduz o dano de cada derrota a 1', () => {
    // Omanyte (138) secretCount 2 = [Swift Swim, Shell Armor].
    const oma = makeMon({
      id: 'o', speciesId: 138, secretCount: 2, types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const out = resolveDefense(fixedRng(0.999), [oma], oneStrong, { damagePerLoss: 4 })
    expect(out.squad[0]?.currentHp).toBe(oma.maxHp - 1) // dano 4 vira 1
  })

  it('Sturdy salva do desmaio (1 HP) quando disponível', () => {
    const geo = makeMon({
      id: 'g', speciesId: 74, secretCount: 1, types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 10 }), currentHp: 1,
    })
    const out = resolveDefense(fixedRng(0.999), [geo], oneStrong, {
      sturdyAvailableIds: new Set(['g']),
    })
    expect(out.squad[0]?.currentHp).toBe(1) // não desmaiou
    expect(out.sturdyUsedIds).toContain('g')
  })
})

describe('resolveDefense — Habilidades de Cerulean', () => {
  it('Thick Fat: vantagem de Batalha (×1,5) contra oponente do tipo Gelo', () => {
    // Seel (86) secretCount 3 = [Surf, Ice Body, Thick Fat]. Tipo neutro p/ isolar o efeito.
    const seel = makeMon({ id: 's', speciesId: 86, secretCount: 3, types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const plain = makeMon({ id: 'p', types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const ice: EnemyUnit[] = [{ battle: 40, types: ['ice'] }]
    expect(resolveDefense(fixedRng(1), [seel], ice).duels[0]?.pWin).toBeCloseTo(0.75) // 30/40
    expect(resolveDefense(fixedRng(1), [plain], ice).duels[0]?.pWin).toBeCloseTo(0.5) // 20/40
  })

  it('Pressure: reduz a Batalha do oponente enfrentado em 25%', () => {
    // Articuno (144) secretCount 3 = [Fly, Fly+, Pressure]. Tipo neutro p/ isolar.
    const arti = makeMon({ id: 'a', speciesId: 144, secretCount: 3, types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const plain = makeMon({ id: 'p', types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const foe: EnemyUnit[] = [{ battle: 40, types: ['normal'] }]
    expect(resolveDefense(fixedRng(1), [arti], foe).duels[0]?.pWin).toBeCloseTo(20 / 30) // inimigo 40→30
    expect(resolveDefense(fixedRng(1), [plain], foe).duels[0]?.pWin).toBeCloseTo(0.5) // 20/40
  })

  it('Moxie: +1 de Batalha por inimigo derrotado na sequência', () => {
    // Magikarp (129) secretCount 2 = [Surf, Moxie]. Vence os dois (fixedRng 0).
    const gyara = makeMon({ id: 'g', speciesId: 129, secretCount: 2, types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const foes: EnemyUnit[] = [{ battle: 30, types: ['normal'] }, { battle: 30, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0), [gyara], foes)
    expect(out.duels[0]?.pWin).toBeCloseTo(20 / 30) // 1ª luta: sem bônus
    expect(out.duels[1]?.pWin).toBeCloseTo(21 / 30) // 2ª luta: +1 do 1º abate
  })

  it('Regenerator: recupera 1 de vida por inimigo derrotado', () => {
    // Slowpoke (79) secretCount 1 = [Regenerator]. Vence os dois sem tomar dano.
    const slow = makeMon({ id: 's', speciesId: 79, secretCount: 1, types: ['normal'], baseAttrs: makeAttrs({ batalha: 50, resistencia: 100 }), currentHp: 5 })
    const foes: EnemyUnit[] = [{ battle: 10, types: ['normal'] }, { battle: 10, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0), [slow], foes)
    expect(out.won).toBe(true)
    expect(out.squad[0]?.currentHp).toBe(7) // 5 + 1 por abate (2 abates)
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
  it('respeita o tamanho, usa o elenco do treinador e a Batalha-base ±10 (+ bônus de medalha)', () => {
    const typeSet = new Set<string>(POKEMON_TYPES)
    const brock = getTrainer('BROCK')
    // Dia alto p/ exercitar os dois ramos: invasores com e sem medalha.
    const enemies = generateDefenseEnemies(createRng(1), brock, 6, 10)
    expect(enemies).toHaveLength(6)
    for (const e of enemies) {
      expect(e.battle).toBeGreaterThanOrEqual(0)
      const base = getSpecies(e.speciesId as number).baseAttrs.batalha
      // Sem medalha: base ±10 e ≤ teto. Com medalha: o bônus do tier soma sobre essa faixa.
      const bonus = e.medal ? DEFENSE_MEDAL_BATTLE[e.medal] : 0
      if (!e.medal) expect(e.battle).toBeLessThanOrEqual(ATTR_MAX)
      expect(e.battle - base - bonus).toBeGreaterThanOrEqual(-10)
      expect(e.battle - base - bonus).toBeLessThanOrEqual(10)
      for (const t of e.types) expect(typeSet.has(t)).toBe(true)
    }
  })

  it('no dia 1 nenhum invasor sai com medalha', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const enemies = generateDefenseEnemies(createRng(seed), getTrainer('BROCK'), 6, 1)
      expect(enemies.every((e) => e.medal === undefined)).toBe(true)
    }
  })

  it('a partir do dia de abertura aparecem medalhas (bônus de Batalha por tier)', () => {
    let withMedal = 0
    for (let seed = 1; seed <= 40; seed++) {
      for (const e of generateDefenseEnemies(createRng(seed), getTrainer('BROCK'), 6, 10)) {
        if (!e.medal) continue
        withMedal++
        const base = getSpecies(e.speciesId as number).baseAttrs.batalha
        // O bônus do tier está embutido na Batalha (faixa base ±10 + bônus).
        expect(e.battle).toBeGreaterThanOrEqual(base - 10 + DEFENSE_MEDAL_BATTLE[e.medal])
      }
    }
    expect(withMedal).toBeGreaterThan(0)
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

  it('sorteia o sexo de cada desafiante (exibido na foto)', () => {
    for (const e of generateDefenseEnemies(createRng(7), getTrainer('LASS'), 4)) {
      expect(['male', 'female', 'genderless']).toContain(e.gender)
    }
  })
})

describe('enemySquadSizeForDay (PLAN §4.4)', () => {
  it('segue a tabela fixa por dia (1→6)', () => {
    expect(enemySquadSizeForDay(1)).toBe(1)
    expect(enemySquadSizeForDay(2)).toBe(2)
    expect(enemySquadSizeForDay(5)).toBe(4)
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

describe('medalhas dos invasores', () => {
  it('respeita os dias de abertura (Bronze d2, Prata d6, Ouro d10) e zero no dia 1', () => {
    const d1 = medalChancesForDay(1)
    expect(d1.bronze).toBe(0)
    expect(d1.silver).toBe(0)
    expect(d1.gold).toBe(0)
    expect(medalChancesForDay(2).bronze).toBeGreaterThan(0)
    expect(medalChancesForDay(5).silver).toBe(0)
    expect(medalChancesForDay(6).silver).toBeGreaterThan(0)
    expect(medalChancesForDay(9).gold).toBe(0)
    expect(medalChancesForDay(10).gold).toBeGreaterThan(0)
  })

  it('as chances acumuladas são ordenadas (bronze ≥ prata ≥ ouro) e batem 100% no dia 30', () => {
    for (let day = 1; day <= 30; day++) {
      const { bronze, silver, gold } = medalChancesForDay(day)
      expect(bronze).toBeGreaterThanOrEqual(silver)
      expect(silver).toBeGreaterThanOrEqual(gold)
    }
    const d30 = medalChancesForDay(30)
    expect(d30.bronze).toBe(1)
    expect(d30.silver).toBe(1)
    expect(d30.gold).toBe(1)
    // Modo infinito: além do dia 30 segura em 100% (todo invasor sai Ouro).
    expect(medalChancesForDay(45).gold).toBe(1)
  })

  it('no dia 1 nunca sorteia medalha; no dia 30 sempre Ouro', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(rollMedalForDay(createRng(seed), 1)).toBeNull()
      expect(rollMedalForDay(createRng(seed), 30)).toBe('gold')
    }
  })
})
