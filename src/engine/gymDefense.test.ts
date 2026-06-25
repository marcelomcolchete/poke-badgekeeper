import { describe, expect, it } from 'vitest'
import { POKEMON_TYPES } from '../types/index.ts'
import { ATTR_MAX } from './constants.ts'
import { DEFENSE_MEDAL_BATTLE, PARALYZE_BATTLE_MULT } from './balance.ts'
import { createRng } from './rng.ts'
import { getTrainer } from '../data/trainers.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import type { EnemyUnit } from './gymDefense.ts'
import {
  canDefend,
  duelWinProbability,
  effectiveBattle,
  generateDefenseEnemies,
  gymWinXp,
  medalChancesForDay,
  resolveDefense,
  rollMedalForDay,
  rollSquadSize,
  squadSizeRange,
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

describe('gymWinXp — poder de Batalha cheio do desafiante derrotado', () => {
  it('rende a Batalha cheia (sem ×0,5, sem teto)', () => {
    expect(gymWinXp(20)).toBe(20)
    expect(gymWinXp(40)).toBe(40)
    expect(gymWinXp(90)).toBe(90)
  })

  it('não satura em valores altos', () => {
    expect(gymWinXp(200)).toBe(200)
  })

  it('arredonda valores fracionários', () => {
    expect(gymWinXp(15.4)).toBe(15)
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
    // Geodude (74) par = ['sa-sturdy','sa-explosion']; slot 0=Sturdy, slot 1=Explosion. Sturdy não está disponível (sem opts).
    const geo = makeMon({
      id: 'g', speciesId: 74, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }], types: ['rock'],
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
      id: 'g', speciesId: 74, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }], types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }), currentHp: 2,
    })
    const out = resolveDefense(fixedRng(0.999), [geo], oneStrong)
    expect(out.won).toBe(true)
    expect(out.squad[0]?.status).toBe('fainted')
  })

  it('Lightning Rod: contra inimigo Elétrico, o portador assume a frente', () => {
    const front = makeMon({ id: 'a', types: ['normal'], baseAttrs: makeAttrs({ batalha: 50 }) })
    // Cubone (104) par = ['sa-battle-armor','sa-lightning-rod']; Lightning Rod no slot 1.
    const rod = makeMon({ id: 'b', speciesId: 104, secretPicks: [{ slot: 1, level: 1 }], types: ['ground'], baseAttrs: makeAttrs({ batalha: 50 }) })
    const electric: EnemyUnit[] = [{ battle: 10, types: ['electric'] }]
    const out = resolveDefense(fixedRng(0), [front, rod], electric)
    expect(out.duels[0]?.yourId).toBe('b') // o portador atraiu o duelo
  })

  it('Lightning Rod não troca a frente contra inimigo não-Elétrico', () => {
    const front = makeMon({ id: 'a', types: ['normal'], baseAttrs: makeAttrs({ batalha: 50 }) })
    // Cubone (104) par = ['sa-battle-armor','sa-lightning-rod']; Lightning Rod no slot 1.
    const rod = makeMon({ id: 'b', speciesId: 104, secretPicks: [{ slot: 1, level: 1 }], types: ['ground'], baseAttrs: makeAttrs({ batalha: 50 }) })
    const out = resolveDefense(fixedRng(0), [front, rod], oneStrong)
    expect(out.duels[0]?.yourId).toBe('a')
  })

  it('Static (NOVO): ao perder um duelo, NÃO paralisa mais o inimigo na batalha', () => {
    // Pikachu (25) par = ['sa-static','sa-dig']; Static no slot 0.
    // O Static novo não tem mais efeito de batalha — o inimigo luta com Batalha cheia.
    const pika = makeMon({
      id: 'p', speciesId: 25, secretPicks: [{ slot: 0, level: 1 }], types: ['electric'],
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
    // Inimigo NÃO paralisado: enemyEff = 100 (batalha cheia, não ×0,5).
    const expected = duelWinProbability(effectiveBattle(next, ['normal']), 100)
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
    // Rhyhorn (111) par = ['sa-rock-head','sa-reckless']; Reckless no slot 1.
    const rhy = makeMon({
      id: 'r', speciesId: 111, secretPicks: [{ slot: 1, level: 1 }], types: ['ground'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const out = resolveDefense(fixedRng(0.999), [rhy], oneStrong)
    expect(out.duels.length).toBeGreaterThan(1) // várias retentativas
    expect(out.duels.every((d) => d.yourId === 'r')).toBe(true) // sempre o mesmo lutador
    expect(out.squad[0]?.status).toBe('fainted')
    expect(out.won).toBe(false)
  })

  it('Shell Armor L1 reduz o dano de cada derrota a ceil(raw/2)', () => {
    // Omanyte (138) par = ['sa-swift-swim','sa-shell-armor']; Shell Armor no slot 1 L1.
    const oma = makeMon({
      id: 'o', speciesId: 138, secretPicks: [{ slot: 1, level: 1 }], types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const out = resolveDefense(fixedRng(0.999), [oma], oneStrong, { damagePerLoss: 4 })
    expect(out.squad[0]?.currentHp).toBe(oma.maxHp - 2) // dano 4 → ceil(4/2) = 2
  })

  it('Sturdy salva do desmaio (1 HP) quando disponível', () => {
    // Geodude (74) par = ['sa-sturdy','sa-explosion']; Sturdy no slot 0.
    const geo = makeMon({
      id: 'g', speciesId: 74, secretPicks: [{ slot: 0, level: 1 }], types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 10 }), currentHp: 1,
    })
    const out = resolveDefense(fixedRng(0.999), [geo], oneStrong, {
      sturdyAvailableIds: new Set(['g']),
    })
    expect(out.squad[0]?.currentHp).toBe(1) // não desmaiou
    expect(out.sturdyUsedIds).toContain('g')
  })

  it('Sturdy+ (L2): sobrevive a múltiplas quedas fatais sem token diário', () => {
    // Geodude (74) par = ['sa-sturdy','sa-explosion']; Sturdy no slot 0, NÍVEL 2.
    // currentHp=1 força que cada derrota seria fatal.
    // Usamos 3 inimigos fracos: o pokemon perde todos os 3 duelos mas sobrevive com 1 HP em cada.
    const geo = makeMon({
      id: 'g', speciesId: 74, secretPicks: [{ slot: 0, level: 2 }], types: ['rock'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 10 }), currentHp: 1,
    })
    const threeStrong: EnemyUnit[] = [
      { battle: 100, types: ['normal'] },
      { battle: 100, types: ['normal'] },
      { battle: 100, types: ['normal'] },
    ]
    // Sem sturdyAvailableIds (sem token diário): L1 não salvaria, L2 deve salvar TODOS.
    const out = resolveDefense(fixedRng(0.999), [geo], threeStrong)
    // O pokemon perde todos os 3 duelos (passa a vez cada vez) e fica com 1 HP em todos.
    expect(out.squad[0]?.currentHp).toBe(1) // nunca desmaiou
    expect(out.squad[0]?.status).not.toBe('fainted')
    // Todos os duelos foram do mesmo Pokémon (sempre na frente, sobrevivendo com 1 HP).
    expect(out.duels.every((d) => d.yourId === 'g')).toBe(true)
    // sturdyUsedIds NÃO deve conter 'g' (L2 não consome o token).
    expect(out.sturdyUsedIds).not.toContain('g')
    // Com 3 inimigos e sem ajuda, a defesa é perdida (só 1 Pokémon no squad).
    expect(out.won).toBe(false)
  })

  it('Explosion+ (L2): ao perder um duelo, derrota TODOS os inimigos restantes', () => {
    // Voltorb (100) par = ['sa-explosion','sa-rollout']; Explosion no slot 0, NÍVEL 2.
    const voltorb = makeMon({
      id: 'v', speciesId: 100, secretPicks: [{ slot: 0, level: 2 }], types: ['electric'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }),
    })
    const threeStrong: EnemyUnit[] = [
      { battle: 100, types: ['normal'] },
      { battle: 100, types: ['normal'] },
      { battle: 100, types: ['normal'] },
    ]
    // fixedRng(0.999) → perde o duelo; Explosion+ deve derrotar TODOS os 3 inimigos.
    const out = resolveDefense(fixedRng(0.999), [voltorb], threeStrong)
    expect(out.won).toBe(true) // todos os inimigos derrotados
    expect(out.duels).toHaveLength(1) // só um duelo aconteceu
    expect(out.duels[0]?.youWon).toBe(false)
    // O Pokémon tomou dano total (toda a vida) — pode ter sido salvo por Sturdy+ se aplicável,
    // mas aqui não tem Sturdy, então desmaia.
    expect(out.squad[0]?.status).toBe('fainted')
  })

  it('Reckless+ (L2): na retentativa toma metade do dano L1', () => {
    // Rhyhorn (111) par = ['sa-rock-head','sa-reckless']; Reckless no slot 1, NÍVEL 2.
    const damagePerLoss = 2
    const maxHp = 20
    const rhy = makeMon({
      id: 'r', speciesId: 111, secretPicks: [{ slot: 1, level: 2 }], types: ['ground'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }), maxHp, currentHp: maxHp,
    })
    // Um único inimigo forte: o pokemon perde exatamente 1 duelo, sobrevive, e retenta.
    // Para controlar: vence no 2º duelo (rng alterna, mas usamos um truque).
    // Usamos fixedRng(0.999) → perde sempre; vamos checar que na 1ª retentativa o dano é ceil(loss/2).
    // loss = damageTaken(rhy, damagePerLoss) = 2 (sem Shell Armor); ceil(2/2)=1.
    // Então: 1ª derrota → dano=1 (metade); continua tentando.
    // Verificamos apenas que o HP após a 1ª retentativa é maxHp - 1 (não maxHp - 2).
    // Para observar só a primeira derrota, usamos 1 inimigo e capturamos HP após 1ª retentativa.
    // Porém com fixedRng(0.999) vai perder todas → eventualmente desmaia. Checamos via múltiplas perdas.
    // Cada perda custa ceil(2/2)=1 HP. maxHp=20, então 20 derrotas antes de desmaiar.
    const out = resolveDefense(fixedRng(0.999), [rhy], oneStrong, { damagePerLoss })
    // Com L2 (dano=1 por tentativa) e maxHp=20, o pokemon perde 20 duelos antes de desmaiar.
    expect(out.duels.length).toBe(maxHp) // 20 tentativas
    expect(out.squad[0]?.status).toBe('fainted')
    // Compara com L1 (dano=2): teria desmaiado em 10 tentativas.
    const rhyL1 = makeMon({
      id: 'r2', speciesId: 111, secretPicks: [{ slot: 1, level: 1 }], types: ['ground'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }), maxHp, currentHp: maxHp,
    })
    const outL1 = resolveDefense(fixedRng(0.999), [rhyL1], oneStrong, { damagePerLoss })
    expect(outL1.duels.length).toBe(maxHp / damagePerLoss) // 10 tentativas com L1
  })

  it('Vital Spirit+ (L2): ao perder um duelo, tenta de novo SEM perder HP', () => {
    // Electabuzz (125) par = ['sa-vital-spirit','sa-volt-absorb']; Vital Spirit no slot 0, NÍVEL 2.
    const maxHp = 10
    const elec = makeMon({
      id: 'e', speciesId: 125, secretPicks: [{ slot: 0, level: 2 }], types: ['electric'],
      baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }), maxHp, currentHp: maxHp,
    })
    // fixedRng(0.999) perde todos os duelos mas nunca perde HP.
    // Como nunca desmaia e há um inimigo, o loop continuaria infinitamente → o guard vai quebrar.
    // Portanto testamos com um inimigo que VENCE depois de N tentativas usando rng variável.
    // Usamos um rng que devolve 0.999 nas N-1 primeiras chamadas e 0 na enésima.
    let callCount = 0
    const nLosses = 5
    const alternatingRng = {
      next: () => 0,
      int: (min: number) => min,
      float: () => 0,
      bool: (p = 0.5) => {
        callCount++
        // Perde nas primeiras nLosses chamadas, vence na enésima.
        return callCount > nLosses ? 0 < p : 0.999 < p
      },
      pick: <T>(items: readonly T[]): T => items[0] as T,
      shuffle: <T>(items: readonly T[]): T[] => [...items],
      state: () => 0,
    }
    const out = resolveDefense(alternatingRng, [elec], oneStrong)
    expect(out.won).toBe(true) // venceu após retentativas
    // HP deve ser o mesmo que o inicial (zero dano durante as perdas).
    expect(out.squad[0]?.currentHp).toBe(maxHp)
    // Todos os duelos foram do mesmo Pokémon.
    expect(out.duels.every((d) => d.yourId === 'e')).toBe(true)
  })
})

describe('resolveDefense — Habilidades de Cerulean', () => {
  it('Thick Fat L2: auto-vence duelos contra oponente do tipo Gelo (pWin=1)', () => {
    // Seel (86) par = ['sa-surf','sa-thick-fat']; Thick Fat no slot 1, NÍVEL 2.
    // Mesmo com batalha fraca (10 vs 100), o auto-win garante pWin=1.
    const seelL2 = makeMon({ id: 's', speciesId: 86, secretPicks: [{ slot: 1, level: 2 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 10, resistencia: 100 }) })
    const ice: EnemyUnit[] = [{ battle: 100, types: ['ice'] }]
    // fixedRng(0.999) → normalmente perderia (pWin << 1), mas auto-win força pWin=1 e youWon=true.
    const out = resolveDefense(fixedRng(0.999), [seelL2], ice)
    expect(out.duels[0]?.pWin).toBe(1)
    expect(out.duels[0]?.youWon).toBe(true)
    expect(out.won).toBe(true)
  })

  it('Thick Fat L1: sem efeito de batalha (pWin idêntico a um Pokémon sem a habilidade)', () => {
    // Seel (86) Thick Fat L1 — inerte, sem bônus de batalha vs Gelo.
    const seelL1 = makeMon({ id: 's', speciesId: 86, secretPicks: [{ slot: 1, level: 1 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const plain = makeMon({ id: 'p', types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const ice: EnemyUnit[] = [{ battle: 40, types: ['ice'] }]
    const pWinL1 = resolveDefense(fixedRng(1), [seelL1], ice).duels[0]?.pWin
    const pWinPlain = resolveDefense(fixedRng(1), [plain], ice).duels[0]?.pWin
    expect(pWinL1).toBeCloseTo(pWinPlain ?? 0) // 20/40 = 0.5, sem bônus
  })

  it('Pressure L1: reduz a Batalha de TODOS os inimigos em 15% (início do combate, squad-wide)', () => {
    // Articuno (144) par = ['sa-fly','sa-pressure']; Pressure no slot 1, L1.
    const arti = makeMon({ id: 'a', speciesId: 144, secretPicks: [{ slot: 1, level: 1 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const plain = makeMon({ id: 'p', types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const foe: EnemyUnit[] = [{ battle: 40, types: ['normal'] }]
    // Pressure L1: inimigo 40 × 0.85 = 34; pWin = 20/34 ≈ 0.588
    expect(resolveDefense(fixedRng(1), [arti], foe).duels[0]?.pWin).toBeCloseTo(20 / 34, 5)
    expect(resolveDefense(fixedRng(1), [plain], foe).duels[0]?.pWin).toBeCloseTo(0.5) // 20/40
  })

  it('Pressure L2: reduz a Batalha de TODOS os inimigos em 30%', () => {
    // Zapdos (145) par = ['sa-fly','sa-pressure']; Pressure no slot 1, L2.
    const zapdos = makeMon({ id: 'z', speciesId: 145, secretPicks: [{ slot: 1, level: 2 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const foe: EnemyUnit[] = [{ battle: 40, types: ['normal'] }]
    // Pressure L2: inimigo 40 × 0.70 = 28; pWin = 20/28 ≈ 0.714
    expect(resolveDefense(fixedRng(1), [zapdos], foe).duels[0]?.pWin).toBeCloseTo(20 / 28, 5)
  })

  it('Pressure não acumula: squad com L1+L2 usa o maior (L2, ×0.70)', () => {
    // Squad com Articuno L1 (slot 1) e Zapdos L2 (slot 1): o máximo é L2 → ×0.70.
    const artiL1 = makeMon({ id: 'a', speciesId: 144, secretPicks: [{ slot: 1, level: 1 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const zapdosL2 = makeMon({ id: 'z', speciesId: 145, secretPicks: [{ slot: 1, level: 2 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const foe: EnemyUnit[] = [{ battle: 40, types: ['normal'] }]
    // O Articuno enfrenta o inimigo (é o 1º no squad), mas o pressureMult vem do máximo do squad (L2).
    // inimigo 40 × 0.70 = 28; pWin do 1º duelo (Articuno, batalha=20) = 20/28 ≈ 0.714.
    const out = resolveDefense(fixedRng(1), [artiL1, zapdosL2], foe)
    expect(out.duels[0]?.pWin).toBeCloseTo(20 / 28, 5)
  })

  // NOTA: sa-ice-body existe como código na engine (ramo compartilhado com sa-thick-fat),
  // mas nenhuma linha de espécie atualmente possui essa habilidade. O ramo de auto-win vs Fogo
  // é exercitado indiretamente pela mesma lógica do Thick Fat (ambos usam o mesmo mecanismo
  // de auto-win em resolveDefense). Testes específicos de espécie removidos para evitar
  // dependência de Jynx ter ice-body (design decision: Jynx = ['sa-dry-skin','sa-forewarn']).

  it('Moxie L1: +1 PERMANENTE em permaBonus.batalha por abate; sem bônus temporário adicional', () => {
    // Magikarp (129) par = ['sa-surf','sa-moxie']; Moxie no slot 1, level 1.
    // Base batalha=20. 1º duelo: pWin=20/30. Após vitória: permaBonus.batalha=1 → efetiva=21.
    // 2º duelo: pWin=21/30 (permanente reflete IMEDIATAMENTE). Sem temp extra.
    const gyara = makeMon({ id: 'g', speciesId: 129, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    const foes: EnemyUnit[] = [{ battle: 30, types: ['normal'] }, { battle: 30, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0), [gyara], foes)
    // 1º duelo: base 20 vs 30, pWin=20/30
    expect(out.duels[0]?.pWin).toBeCloseTo(20 / 30)
    // 2º duelo: base 21 (permaBonus=1) vs 30, pWin=21/30 — NÃO 22/30 (nenhum temp extra de frontWins)
    expect(out.duels[1]?.pWin).toBeCloseTo(21 / 30)
    // Permanente: permaBonus.batalha === 2 (2 abates)
    expect(out.squad[0]?.permaBonus?.batalha).toBe(2)
  })

  it('Moxie L1: permaBonus.batalha acumula por vitória (não capeado no campo, efetiva capeada em 60)', () => {
    // Começa com permaBonus.batalha=59; uma vitória → permaBonus sobe para 60.
    // Efetiva: base=1 + permaBonus=60 = 61, clamped a 60 pelo effectiveAttr.
    const gyara = makeMon({ id: 'g', speciesId: 129, secretPicks: [{ slot: 1, level: 1 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 1, resistencia: 100 }), permaBonus: { batalha: 59 } })
    const foes: EnemyUnit[] = [{ battle: 1, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0), [gyara], foes)
    expect(out.squad[0]?.permaBonus?.batalha).toBe(60) // permanente sobe mesmo que efetivo já no teto
  })

  it('Moxie L2: +1 permanente E +5 temporário por vitória (teto temp +25)', () => {
    // Gyarados (130) par = ['sa-surf','sa-moxie']; slot 1, level 2.
    // Base batalha=30; inimigos battle=28 → pWin base = 30/28 > 1 (sempre vence).
    // Após 1ª vitória: permaBonus.batalha=1; temp = min(25, 5*1)=5.
    // Após 2ª vitória: permaBonus.batalha=2; temp = min(25, 5*2)=10.
    // Verificar via duelo "borderline": usar batalha baixa onde só o temp vira a balança.
    const gyara = makeMon({ id: 'g', speciesId: 130, secretPicks: [{ slot: 1, level: 2 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 100 }) })
    // 1º duelo: batalha=20 vs enemy=20 → pWin=1 (20/20). Vence.
    // 2º duelo (frontWins=1): batalha efetiva = 20+5=25 vs enemy=24 → pWin>1. Sem L2 seria 20/24.
    const foes: EnemyUnit[] = [{ battle: 20, types: ['normal'] }, { battle: 24, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0), [gyara], foes)
    expect(out.won).toBe(true)
    expect(out.squad[0]?.permaBonus?.batalha).toBe(2) // 2 abates → +2 permanente
    // 2ª batalha: pWin = (20+5)/24 = 25/24 > 1, clamped a 1
    expect(out.duels[1]?.pWin).toBeCloseTo(Math.min(1, 25 / 24))
  })

  it('Moxie L2: bônus temporário capeado em +25 (5 vitórias)', () => {
    // Após 5 vitórias, temp = min(25, 5*5)=25. Na 6ª batalha, temp ainda é 25.
    const gyara = makeMon({ id: 'g', speciesId: 130, secretPicks: [{ slot: 1, level: 2 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 30, resistencia: 100 }) })
    const foes: EnemyUnit[] = Array(7).fill({ battle: 1, types: ['normal'] }) as EnemyUnit[]
    const out = resolveDefense(fixedRng(0), [gyara], foes)
    expect(out.won).toBe(true)
    // Após 5 vitórias, o 6º duelo usa temp=25 (não 30); o 7º também.
    // pWin do 6º duelo: (30+25)/1 = 55 → clamped 1; do 7º: (30+25+1perma)/1 → clamped 1
    // O que importa é que permaBonus cresce linearmente
    expect(out.squad[0]?.permaBonus?.batalha).toBe(7)
  })

  it('Regenerator L1: recupera 1 de vida por inimigo derrotado', () => {
    // Slowpoke (79) par = ['sa-regenerator','sa-own-tempo']; Regenerator no slot 0. Vence os dois sem tomar dano.
    const slow = makeMon({ id: 's', speciesId: 79, secretPicks: [{ slot: 0, level: 1 }], types: ['normal'], baseAttrs: makeAttrs({ batalha: 50, resistencia: 100 }), currentHp: 5 })
    const foes: EnemyUnit[] = [{ battle: 10, types: ['normal'] }, { battle: 10, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0), [slow], foes)
    expect(out.won).toBe(true)
    expect(out.squad[0]?.currentHp).toBe(7) // 5 + 1 por abate (2 abates)
  })

  it('Regenerator L2: cura para HP cheio em cada vitória', () => {
    // Slowpoke (79) slot0=regenerator; nível 2. Começa com HP baixo; vence dois inimigos fracos.
    // Garantia de vitória: batalha=50 vs inimigos battle=1 → pWin ≈ 1; fixedRng(0) sempre ganha.
    const maxHp = 10
    const slow = makeMon({
      id: 's', speciesId: 79, secretPicks: [{ slot: 0, level: 2 }], types: ['normal'],
      baseAttrs: makeAttrs({ batalha: 50, resistencia: 100 }), currentHp: 3, maxHp,
    })
    const foes: EnemyUnit[] = [{ battle: 1, types: ['normal'] }, { battle: 1, types: ['normal'] }]
    const out = resolveDefense(fixedRng(0), [slow], foes)
    expect(out.won).toBe(true)
    // Após 1ª vitória já ficou com HP cheio; 2ª vitória mantém HP cheio.
    expect(out.squad[0]?.currentHp).toBe(maxHp)
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

describe('squadSizeRange / rollSquadSize (faixa por dia, teto 6)', () => {
  it('âncoras: dia 1 = 1/1, dia 6 = 3/5, dia 10 = 4/6, dia 15 = 6/6', () => {
    expect(squadSizeRange(1)).toEqual({ min: 1, max: 1 })
    expect(squadSizeRange(6)).toEqual({ min: 3, max: 5 })
    expect(squadSizeRange(10)).toEqual({ min: 4, max: 6 })
    expect(squadSizeRange(15)).toEqual({ min: 6, max: 6 })
  })

  it('min ≤ max em todo dia e teto 6 (inclui modo infinito)', () => {
    for (let day = 1; day <= 60; day++) {
      const { min, max } = squadSizeRange(day)
      expect(min).toBeGreaterThanOrEqual(1)
      expect(min).toBeLessThanOrEqual(max)
      expect(max).toBeLessThanOrEqual(6)
    }
    expect(squadSizeRange(30)).toEqual({ min: 6, max: 6 })
  })

  it('rollSquadSize sorteia dentro da faixa do dia', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const day = 7
      const { min, max } = squadSizeRange(day)
      const size = rollSquadSize(createRng(seed), day)
      expect(size).toBeGreaterThanOrEqual(min)
      expect(size).toBeLessThanOrEqual(max)
    }
  })
})

describe('resolveDefense — Paralyze (-50% Batalha)', () => {
  it('um Pokémon paralisado luta com metade da Batalha efetiva', () => {
    const rng = createRng(1)
    // makeMon com batalha=40, ivs/allocations zerados, tipos neutros — effectiveAttr devolve a base.
    const you = makeMon({ id: 'p1', types: ['normal'], baseAttrs: makeAttrs({ batalha: 40 }) })
    const enemy: EnemyUnit = { battle: 30, types: ['normal'] }
    // Sem paralisia: 40 vs 30 → vitória garantida (pWin clamp 1).
    const normal = resolveDefense(createRng(1), [you], [enemy])
    expect(normal.duels[0]?.pWin).toBe(1)
    // Com paralisia: 20 vs 30 → pWin ≈ 0,667.
    const para = resolveDefense(rng, [you], [enemy], { paralyzedIds: new Set(['p1']) })
    expect(para.duels[0]?.pWin).toBeCloseTo((40 * PARALYZE_BATTLE_MULT) / 30, 5)
  })

  it('sem id paralisado, nada muda', () => {
    const you = makeMon({ id: 'p1', types: ['normal'], baseAttrs: makeAttrs({ batalha: 40 }) })
    const enemy: EnemyUnit = { battle: 30, types: ['normal'] }
    const r = resolveDefense(createRng(1), [you], [enemy], { paralyzedIds: new Set(['outro']) })
    expect(r.duels[0]?.pWin).toBe(1)
  })
})

describe('medalhas dos invasores (piso de 10% + rampa)', () => {
  it('dia 1 zera tudo; aberturas: bronze d2, prata d3, ouro d4 (~10%)', () => {
    const d1 = medalChancesForDay(1)
    expect(d1).toEqual({ bronze: 0, silver: 0, gold: 0 })
    expect(medalChancesForDay(2).bronze).toBeCloseTo(0.1, 5)
    expect(medalChancesForDay(2).silver).toBe(0)
    expect(medalChancesForDay(3).silver).toBeCloseTo(0.1, 5)
    expect(medalChancesForDay(3).gold).toBe(0)
    expect(medalChancesForDay(4).gold).toBeCloseTo(0.1, 5)
  })

  it('acumuladas ordenadas (bronze ≥ prata ≥ ouro) e saturação por tier', () => {
    for (let day = 1; day <= 35; day++) {
      const { bronze, silver, gold } = medalChancesForDay(day)
      expect(bronze).toBeGreaterThanOrEqual(silver)
      expect(silver).toBeGreaterThanOrEqual(gold)
    }
    expect(medalChancesForDay(10).bronze).toBeCloseTo(1, 5)
    expect(medalChancesForDay(20).silver).toBeCloseTo(1, 5)
    const d30 = medalChancesForDay(30)
    expect(d30).toEqual({ bronze: 1, silver: 1, gold: 1 })
  })

  it('modo infinito: além do dia 30 segura em 100% (todo invasor Ouro)', () => {
    expect(medalChancesForDay(45)).toEqual({ bronze: 1, silver: 1, gold: 1 })
    for (let seed = 1; seed <= 50; seed++) {
      expect(rollMedalForDay(createRng(seed), 1)).toBeNull()
      expect(rollMedalForDay(createRng(seed), 30)).toBe('gold')
    }
  })
})

describe('Tinted Lens', () => {
  // Caterpie(10): par = ['sa-tinted-lens','sa-fly'] → Tinted Lens slot 0.
  // Inseto vs Fogo = desvantagem (singleTypeMultiplier('bug','fire')=0.5 → ×0.5 contra mim).
  // Sem TL: yourEff = 20×0.5 = 10; enemyEff = 20×1.5 = 30 → pWin = 1/3.
  it('em desvantagem de tipo, a Batalha conta ×1.5 (L1)', () => {
    const you = makeMon({ id: 'a', speciesId: 10, types: ['bug'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 30 }, 0), secretPicks: [{ slot: 0, level: 1 }] })
    const enemy: EnemyUnit = { battle: 20, types: ['fire'] }
    const res = resolveDefense(createRng(1), [you], [enemy])
    expect(res.duels[0]?.pWin).toBeCloseTo(0.5) // (10×1.5)/30 = 0.5
  })

  it('em desvantagem, L2 conta ×2.0', () => {
    const you = makeMon({ id: 'a', speciesId: 10, types: ['bug'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 30 }, 0), secretPicks: [{ slot: 0, level: 2 }] })
    const enemy: EnemyUnit = { battle: 20, types: ['fire'] }
    const res = resolveDefense(createRng(1), [you], [enemy])
    expect(res.duels[0]?.pWin).toBeCloseTo(20 / 30) // (10×2.0)/30
  })

  it('sem desvantagem (neutro), Tinted Lens não atua', () => {
    const you = makeMon({ id: 'a', speciesId: 10, types: ['bug'], baseAttrs: makeAttrs({ batalha: 20, resistencia: 30 }, 0), secretPicks: [{ slot: 0, level: 1 }] })
    const enemy: EnemyUnit = { battle: 20, types: ['normal'] }
    const res = resolveDefense(createRng(1), [you], [enemy])
    expect(res.duels[0]?.pWin).toBeCloseTo(1) // 20/20 = 1 (clamp)
  })
})

describe('itens de duelo', () => {
  it('grip-claw: +5 de Batalha aumenta a chance de vitória', () => {
    // batalha efetiva padrão = 20; enemy 30 → sem item: 20/30 ≈ 0.667, com item: 25/30 ≈ 0.833
    const you = makeMon({ baseAttrs: makeAttrs({ batalha: 20 }) })
    const enemy: EnemyUnit = { battle: 30, types: ['normal'] }
    const semItem = resolveDefense(createRng(1), [you], [enemy], { runItems: [] })
    const comItem = resolveDefense(createRng(1), [you], [enemy], { runItems: ['grip-claw'] })
    // Com +5 de Batalha, pWin do primeiro duelo é maior.
    expect(comItem.duels[0]!.pWin).toBeGreaterThan(semItem.duels[0]!.pWin)
  })
  it('sticky-barb: reduz o poder do oponente (pWin maior) e custa 1 HP por duelo', () => {
    // batalha efetiva padrão = 20; enemy 30 → sem item: 20/30 ≈ 0.667, com item: 20/22.5 ≈ 0.889
    const you = makeMon({ baseAttrs: makeAttrs({ batalha: 20 }) })
    const enemy: EnemyUnit = { battle: 30, types: ['normal'] }
    const semItem = resolveDefense(createRng(2), [you], [enemy], { runItems: [] })
    const comItem = resolveDefense(createRng(2), [you], [enemy], { runItems: ['sticky-barb'] })
    expect(comItem.duels[0]!.pWin).toBeGreaterThan(semItem.duels[0]!.pWin)
    // O Pokémon perde ao menos 1 HP ao entrar no duelo (sticky-barb custa 1 HP ao entrar).
    expect(comItem.squad[0]!.currentHp).toBeLessThan(you.currentHp)
  })
})

describe('Leaf Guard L2 — defesa de ginásio', () => {
  // Tangela(114): par = ['sa-regenerator','sa-leaf-guard'] → Leaf Guard slot 1.
  // Aliado fraco (batalha 0) perde 1 duelo e tomaria 4; o portador L2 absorve ceil(4/2)=2.
  it('o absorvedor toma metade do dano de cada aliado que perderia vida', () => {
    const weak = makeMon({ id: 'w', speciesId: 1, types: ['grass'], baseAttrs: makeAttrs({ batalha: 0, resistencia: 60 }, 0) })
    const guard = makeMon({ id: 'g', speciesId: 114, types: ['grass'], baseAttrs: makeAttrs({ batalha: 60, resistencia: 60 }, 0), secretPicks: [{ slot: 1, level: 2 }] })
    const enemy: EnemyUnit = { battle: 40, types: ['normal'] }
    const res = resolveDefense(createRng(99), [weak, guard], [enemy, enemy], { damagePerLoss: 4 })
    const w = res.squad.find((p) => p.id === 'w')!
    const g = res.squad.find((p) => p.id === 'g')!
    expect(w.currentHp).toBe(w.maxHp) // aliado restaurado (não perde vida)
    expect(g.maxHp - g.currentHp).toBe(2) // absorveu ceil(4/2) do aliado
  })

  it('sem portador L2, o dano fica como na cadeia normal', () => {
    const a = makeMon({ id: 'a', speciesId: 1, types: ['grass'], baseAttrs: makeAttrs({ batalha: 0, resistencia: 60 }, 0) })
    const enemy: EnemyUnit = { battle: 40, types: ['normal'] }
    const res = resolveDefense(createRng(99), [a], [enemy], { damagePerLoss: 4 })
    const after = res.squad.find((p) => p.id === 'a')!
    expect(after.maxHp - after.currentHp).toBeGreaterThan(0) // perdeu vida normalmente
  })

  it('Leaf Guard L1 (não-L2) NÃO atua no ginásio', () => {
    const weak = makeMon({ id: 'w', speciesId: 1, types: ['grass'], baseAttrs: makeAttrs({ batalha: 0, resistencia: 60 }, 0) })
    const guardL1 = makeMon({ id: 'g', speciesId: 114, types: ['grass'], baseAttrs: makeAttrs({ batalha: 60, resistencia: 60 }, 0), secretPicks: [{ slot: 1, level: 1 }] })
    const enemy: EnemyUnit = { battle: 40, types: ['normal'] }
    const res = resolveDefense(createRng(99), [weak, guardL1], [enemy, enemy], { damagePerLoss: 4 })
    const w = res.squad.find((p) => p.id === 'w')!
    expect(w.maxHp - w.currentHp).toBeGreaterThan(0) // L1 não protege no ginásio: aliado perde vida
  })
})
