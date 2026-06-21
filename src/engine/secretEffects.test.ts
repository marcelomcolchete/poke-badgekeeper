import { describe, expect, it } from 'vitest'
import type { CityGraph } from '../data/types.ts'
import { makeMon } from './testkit.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { DIG_TUNNEL_COST } from './balance.ts'
import { graphWithTunnel, graphWithTunnels, pathDistance, shortestPath } from './pathfinding.ts'
import {
  damageTaken,
  explosionSelfDamage,
  hasBattleArmor,
  hasCloudNine,
  hasDig,
  hasExplosion,
  hasLightningRod,
  hasReckless,
  hasQuickFeet,
  hasShellArmor,
  hasSturdy,
  hasSurf,
  hasVitalSpirit,
  hustleBattleBonus,
  missionAttrMultiplier,
  missionEffectBreakdown,
  rivalryBattleBonus,
  rolloutBattleBonus,
  sturdyAvailable,
  teamFlies,
  teamHasFly,
  teamHasQuickFeet,
  teamHasSwiftSwim,
  teamHasSurf,
  teamHasVitalSpirit,
  teamIsSpeedy,
  teamSecretAxisSum,
  teamSnipes,
  teamSurfs,
  teamTravelSpeedMultiplier,
  type MissionSecretCtx,
} from './secretEffects.ts'

const ESCOLTA = getMissionTemplate('escolta')
const ENSINO = getMissionTemplate('ensino')
const PATRULHA = getMissionTemplate('patrulha')
const PALESTRA = getMissionTemplate('palestra')

// Pares de habilidades secretas (slot0, slot1) por linha:
// Sandshrew(27):[rollout,dig]; Geodude(74):[sturdy,explosion]; Onix(95):[sturdy,weak-armor]
// Cubone(104):[battle-armor,lightning-rod]; Rhyhorn(111):[rock-head,reckless]
// Omanyte(138):[swift-swim,shell-armor]; Aerodactyl(142):[fly,rock-head]
// Squirtle/Blastoise(7):[surf,torrent]; Goldeen(118):[surf,swift-swim]; Horsea(116):[surf,sniper]
// Staryu(120):[analytic,natural-cure]; Tentacool(72):[clear-body,surf]; Nidoran♀(29):[rivalry,hustle]
// Electabuzz(125):[vital-spirit,volt-absorb]; Jolteon(135 override):[quick-feet,volt-absorb]

function ctxOf(
  team: ReturnType<typeof makeMon>[],
  template = PALESTRA,
  runtime = {},
  runItems: string[] = [],
): MissionSecretCtx {
  return { team, template, runtime, runItems }
}

describe('desbloqueio por secretPicks', () => {
  it('só ativa as habilidades já desbloqueadas, pelo slot', () => {
    // Sandshrew (27): slot0=rollout, slot1=dig
    expect(rolloutBattleBonus(makeMon({ speciesId: 27, secretPicks: [{ slot: 0, level: 1 }] }), 1)).toBeGreaterThan(0)
    expect(hasDig(makeMon({ speciesId: 27, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(false)
    expect(hasDig(makeMon({ speciesId: 27, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }))).toBe(true)
    // Sandslash (28) cai na mesma linha do Sandshrew (raiz 27).
    expect(hasDig(makeMon({ speciesId: 28, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }))).toBe(true)
    // Sem picks: nada ativo.
    expect(rolloutBattleBonus(makeMon({ speciesId: 27 }), 1)).toBe(0)
    // Espécie sem linha secreta: nada.
    expect(hasDig(makeMon({ speciesId: 1, secretPicks: [{ slot: 0, level: 2 }, { slot: 1, level: 1 }] }))).toBe(false)
  })

  it('flags por habilidade respeitam o slot na linha', () => {
    // Geodude(74): slot0=sturdy, slot1=explosion
    expect(hasSturdy(makeMon({ speciesId: 74, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(true)
    expect(hasExplosion(makeMon({ speciesId: 74, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(false)
    expect(hasExplosion(makeMon({ speciesId: 74, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }))).toBe(true)
    // Cubone(104): slot0=battle-armor, slot1=lightning-rod
    expect(hasBattleArmor(makeMon({ speciesId: 104, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(true)
    expect(hasLightningRod(makeMon({ speciesId: 104, secretPicks: [{ slot: 1, level: 1 }] }))).toBe(true)
    // Rhyhorn(111): slot0=rock-head, slot1=reckless
    expect(hasReckless(makeMon({ speciesId: 111, secretPicks: [{ slot: 0, level: 2 }, { slot: 1, level: 1 }] }))).toBe(true)
    // Omanyte(138): slot0=swift-swim, slot1=shell-armor
    const oma = makeMon({ speciesId: 138, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] })
    expect(hasShellArmor(oma)).toBe(true)
  })
})

describe('missionAttrMultiplier', () => {
  it('Rivalidade: +10% por aliado do mesmo gênero (L1)', () => {
    // Nidoran♀(29): slot0=rivalry → secretPicks:[{slot:0,level:1}]
    const nido = makeMon({ id: 'a', speciesId: 29, gender: 'male', secretPicks: [{ slot: 0, level: 1 }] })
    const allyM = makeMon({ id: 'b', gender: 'male' })
    const ally2 = makeMon({ id: 'd', gender: 'male' })
    const other = makeMon({ id: 'c', gender: 'female' })
    expect(missionAttrMultiplier(nido, ctxOf([nido, allyM]))).toBeCloseTo(1.1)
    expect(missionAttrMultiplier(nido, ctxOf([nido, allyM, ally2]))).toBeCloseTo(1.2)
    expect(missionAttrMultiplier(nido, ctxOf([nido, other]))).toBe(1)
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBe(1)
  })

  it('Rock Head: +40% em escolta, −40% em ensino; nada em patrulha (L1)', () => {
    // Rhyhorn(111): slot0=rock-head → secretPicks:[{slot:0,level:1}]
    const rhy = makeMon({ speciesId: 111, secretPicks: [{ slot: 0, level: 1 }] })
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ESCOLTA))).toBeCloseTo(1.4)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ENSINO))).toBeCloseTo(0.6)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], PATRULHA))).toBe(1)
  })

  it('Battle Armor: +25% só com o flag pendente (L1)', () => {
    // Cubone(104): slot0=battle-armor → secretPicks:[{slot:0,level:1}]
    const cub = makeMon({ id: 'cu', speciesId: 104, secretPicks: [{ slot: 0, level: 1 }] })
    expect(missionAttrMultiplier(cub, ctxOf([cub]))).toBe(1)
    const ctx = ctxOf([cub], PALESTRA, { cu: { battleArmorPending: true } })
    expect(missionAttrMultiplier(cub, ctx)).toBeCloseTo(1.25)
  })

  it('Hustle: −10% nos atributos em missão (L1)', () => {
    // Nidoran♀(29): slot1=hustle → secretPicks:[{slot:0,level:1},{slot:1,level:1}]
    const nido = makeMon({ speciesId: 29, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] })
    // Sozinho (sem aliado do mesmo gênero): Hustle (−10%) e Rivalry (sem aliados = 0%).
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBeCloseTo(0.9)
  })

  it('teamSecretAxisSum aplica o multiplicador (e cai no teto)', () => {
    // Rhyhorn(111): slot0=rock-head → secretPicks:[{slot:0,level:1}]
    const rhy = makeMon({ speciesId: 111, secretPicks: [{ slot: 0, level: 1 }] }) // efetivo 20/eixo, Rock Head
    expect(teamSecretAxisSum('batalha', ctxOf([rhy], ESCOLTA))).toBeCloseTo(28) // 20 × 1.4
  })
})

describe('missionAttrMultiplier — multiplicadores por nível (L1 vs L2)', () => {
  // Slot mapping:
  // Rhyhorn(111): slot0=rock-head, slot1=reckless
  // Staryu(120): slot0=analytic, slot1=natural-cure
  // Squirtle(7): slot0=surf, slot1=torrent
  // Nidoran♀(29): slot0=rivalry, slot1=hustle
  // Cubone(104): slot0=battle-armor, slot1=lightning-rod

  it('Rock Head escolta: ×1.4 (L1) / ×1.8 (L2)', () => {
    const rhyL1 = makeMon({ speciesId: 111, secretPicks: [{ slot: 0, level: 1 }] })
    const rhyL2 = makeMon({ speciesId: 111, secretPicks: [{ slot: 0, level: 2 }] })
    expect(missionAttrMultiplier(rhyL1, ctxOf([rhyL1], ESCOLTA))).toBeCloseTo(1.4)
    expect(missionAttrMultiplier(rhyL2, ctxOf([rhyL2], ESCOLTA))).toBeCloseTo(1.8)
  })

  it('Rock Head ensino: ×0.6 (L1) / ×0.2 (L2)', () => {
    const rhyL1 = makeMon({ speciesId: 111, secretPicks: [{ slot: 0, level: 1 }] })
    const rhyL2 = makeMon({ speciesId: 111, secretPicks: [{ slot: 0, level: 2 }] })
    expect(missionAttrMultiplier(rhyL1, ctxOf([rhyL1], ENSINO))).toBeCloseTo(0.6)
    expect(missionAttrMultiplier(rhyL2, ctxOf([rhyL2], ENSINO))).toBeCloseTo(0.2)
  })

  it('Analytic ensino: ×1.4 (L1) / ×1.8 (L2)', () => {
    const starL1 = makeMon({ speciesId: 120, secretPicks: [{ slot: 0, level: 1 }] })
    const starL2 = makeMon({ speciesId: 120, secretPicks: [{ slot: 0, level: 2 }] })
    expect(missionAttrMultiplier(starL1, ctxOf([starL1], ENSINO))).toBeCloseTo(1.4)
    expect(missionAttrMultiplier(starL2, ctxOf([starL2], ENSINO))).toBeCloseTo(1.8)
  })

  it('Analytic patrulha: ×0.6 (L1) / ×0.2 (L2)', () => {
    const starL1 = makeMon({ speciesId: 120, secretPicks: [{ slot: 0, level: 1 }] })
    const starL2 = makeMon({ speciesId: 120, secretPicks: [{ slot: 0, level: 2 }] })
    expect(missionAttrMultiplier(starL1, ctxOf([starL1], PATRULHA))).toBeCloseTo(0.6)
    expect(missionAttrMultiplier(starL2, ctxOf([starL2], PATRULHA))).toBeCloseTo(0.2)
  })

  it('Torrent: ×1.25 (L1) / ×1.5 (L2) com aliado Água', () => {
    const sqL1 = makeMon({ id: 'sq1', speciesId: 7, secretPicks: [{ slot: 1, level: 1 }], types: ['water'] })
    const sqL2 = makeMon({ id: 'sq2', speciesId: 7, secretPicks: [{ slot: 1, level: 2 }], types: ['water'] })
    const waterAlly = makeMon({ id: 'w', types: ['water'] })
    expect(missionAttrMultiplier(sqL1, ctxOf([sqL1, waterAlly]))).toBeCloseTo(1.25)
    expect(missionAttrMultiplier(sqL2, ctxOf([sqL2, waterAlly]))).toBeCloseTo(1.5)
  })

  it('Battle Armor: ×1.25 (L1) / ×1.5 (L2) com flag pendente', () => {
    const cubL1 = makeMon({ id: 'cu1', speciesId: 104, secretPicks: [{ slot: 0, level: 1 }] })
    const cubL2 = makeMon({ id: 'cu2', speciesId: 104, secretPicks: [{ slot: 0, level: 2 }] })
    expect(missionAttrMultiplier(cubL1, ctxOf([cubL1], PALESTRA, { cu1: { battleArmorPending: true } }))).toBeCloseTo(1.25)
    expect(missionAttrMultiplier(cubL2, ctxOf([cubL2], PALESTRA, { cu2: { battleArmorPending: true } }))).toBeCloseTo(1.5)
  })

  it('Hustle missão: ×0.9 (L1) / ×0.7 (L2)', () => {
    // Nidoran♀(29) slot1=hustle; usar apenas slot1 para isolar hustle sem rivalry
    const nidoL1 = makeMon({ speciesId: 29, secretPicks: [{ slot: 1, level: 1 }] })
    const nidoL2 = makeMon({ speciesId: 29, secretPicks: [{ slot: 1, level: 2 }] })
    expect(missionAttrMultiplier(nidoL1, ctxOf([nidoL1]))).toBeCloseTo(0.9)
    expect(missionAttrMultiplier(nidoL2, ctxOf([nidoL2]))).toBeCloseTo(0.7)
  })

  it('Rivalry: +0.10/aliado (L1) / +0.20/aliado (L2)', () => {
    // Nidoran♀(29) slot0=rivalry; usar apenas slot0 para isolar rivalry sem hustle
    const nidoL1 = makeMon({ id: 'n1', speciesId: 29, gender: 'male', secretPicks: [{ slot: 0, level: 1 }] })
    const nidoL2 = makeMon({ id: 'n2', speciesId: 29, gender: 'male', secretPicks: [{ slot: 0, level: 2 }] })
    const ally = makeMon({ id: 'al', gender: 'male' })
    expect(missionAttrMultiplier(nidoL1, ctxOf([nidoL1, ally]))).toBeCloseTo(1.10)
    expect(missionAttrMultiplier(nidoL2, ctxOf([nidoL2, ally]))).toBeCloseTo(1.20)
  })
})

describe('Surf / Sniper: predicados de time', () => {
  // Goldeen(118): slot0=surf → level:1 = Surf base
  const goldeen = makeMon({ id: 'g', speciesId: 118, secretPicks: [{ slot: 0, level: 1 }] })
  // Blastoise(9, raiz 7): slot0=surf level:2 = Surf+ (leva o time)
  const blastoise = makeMon({ id: 'bl', speciesId: 9, secretPicks: [{ slot: 0, level: 2 }] })
  // Horsea(116): slot0=surf, slot1=sniper → level:1 cada
  const horsea = makeMon({ id: 'h', speciesId: 116, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] })
  const other = makeMon({ id: 'o' })

  it('hasSurf: Surf (nível 1) ou Surf+ (nível 2)', () => {
    expect(hasSurf(goldeen)).toBe(true)
    expect(hasSurf(blastoise)).toBe(true)
    expect(hasSurf(other)).toBe(false)
    expect(hasSurf(makeMon({ speciesId: 118 }))).toBe(false)
  })

  it('teamHasSurf / teamSurfs: sozinho sempre; em time só com Surf+', () => {
    expect(teamHasSurf([goldeen])).toBe(true)
    expect(teamSurfs([goldeen])).toBe(true)
    expect(teamSurfs([goldeen, other])).toBe(false) // só Surf (L1): acompanhado não surfa
    expect(teamSurfs([blastoise, other])).toBe(true) // Surf+ (L2) leva o time
    expect(teamSurfs([other])).toBe(false)
  })

  it('o item Surfboard faz o time inteiro surfar (como o Surf+)', () => {
    expect(teamSurfs([other], ['surfboard'])).toBe(true)
    expect(teamSurfs([other, other], ['surfboard'])).toBe(true)
    expect(teamHasSurf([other], ['surfboard'])).toBe(true)
    expect(teamSurfs([other], [])).toBe(false) // sem o item, ninguém surfa
  })

  it('teamSnipes: só sozinho', () => {
    expect(teamSnipes([horsea])).toBe(true)
    expect(teamSnipes([horsea, other])).toBe(false)
    expect(teamSnipes([other])).toBe(false)
  })
})

describe('missionAttrMultiplier — habilidades de Cerulean', () => {
  it('Torrent: +25% com OUTRO aliado do tipo Água (L1)', () => {
    // Squirtle(7): slot0=surf, slot1=torrent → secretPicks:[{slot:1,level:1}]
    const sq = makeMon({ id: 'sq', speciesId: 7, secretPicks: [{ slot: 1, level: 1 }], types: ['water'] })
    const waterAlly = makeMon({ id: 'w', types: ['water'] })
    const fireAlly = makeMon({ id: 'f', types: ['fire'] })
    expect(missionAttrMultiplier(sq, ctxOf([sq, waterAlly]))).toBeCloseTo(1.25)
    expect(missionAttrMultiplier(sq, ctxOf([sq, fireAlly]))).toBe(1)
    expect(missionAttrMultiplier(sq, ctxOf([sq]))).toBe(1) // "outro" exclui ele mesmo
  })

  it('Analytic: +40% em Ensino, −40% em Patrulha, nada em Palestra (L1)', () => {
    // Staryu(120): slot0=analytic → secretPicks:[{slot:0,level:1}]
    const staryu = makeMon({ speciesId: 120, secretPicks: [{ slot: 0, level: 1 }] })
    expect(missionAttrMultiplier(staryu, ctxOf([staryu], ENSINO))).toBeCloseTo(1.4)
    expect(missionAttrMultiplier(staryu, ctxOf([staryu], PATRULHA))).toBeCloseTo(0.6)
    expect(missionAttrMultiplier(staryu, ctxOf([staryu], PALESTRA))).toBe(1)
  })

  it('Clear Body: anula o debuff de atributo do time (Hustle)', () => {
    // Nidoran♀(29): slot1=hustle → secretPicks:[{slot:0,level:1},{slot:1,level:1}]
    const nido = makeMon({ id: 'n', speciesId: 29, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }], gender: 'female' })
    // Tentacool(72): slot0=clear-body → secretPicks:[{slot:0,level:1}]
    const tentacool = makeMon({ id: 't', speciesId: 72, secretPicks: [{ slot: 0, level: 1 }] })
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBeCloseTo(0.9) // só Hustle
    expect(missionAttrMultiplier(nido, ctxOf([nido, tentacool]))).toBe(1) // anulado
  })
})

describe('combate: bônus de batalha', () => {
  it('Rollout: bônus aditivo dobrando por vitória (L1: 2→32, L2: 4→64)', () => {
    // Sandshrew(27): slot0=rollout L1
    const l1 = makeMon({ speciesId: 27, secretPicks: [{ slot: 0, level: 1 }] })
    // Sandslash(28): slot0=rollout L2
    const l2 = makeMon({ speciesId: 28, secretPicks: [{ slot: 0, level: 2 }] })
    const none = makeMon({})

    // frontWins=0 → 0 para qualquer nível
    expect(rolloutBattleBonus(l1, 0)).toBe(0)
    expect(rolloutBattleBonus(l2, 0)).toBe(0)
    // sem Rollout → 0 independente de frontWins
    expect(rolloutBattleBonus(none, 3)).toBe(0)

    // L1: 1→2, 2→4, 3→8, 4→16, 5→32 (cap), 6→32 (cap)
    expect(rolloutBattleBonus(l1, 1)).toBe(2)
    expect(rolloutBattleBonus(l1, 2)).toBe(4)
    expect(rolloutBattleBonus(l1, 3)).toBe(8)
    expect(rolloutBattleBonus(l1, 4)).toBe(16)
    expect(rolloutBattleBonus(l1, 5)).toBe(32)
    expect(rolloutBattleBonus(l1, 6)).toBe(32)

    // L2: 1→4, 2→8, 3→16, 4→32, 5→64 (cap), 6→64 (cap)
    expect(rolloutBattleBonus(l2, 1)).toBe(4)
    expect(rolloutBattleBonus(l2, 2)).toBe(8)
    expect(rolloutBattleBonus(l2, 3)).toBe(16)
    expect(rolloutBattleBonus(l2, 4)).toBe(32)
    expect(rolloutBattleBonus(l2, 5)).toBe(64)
    expect(rolloutBattleBonus(l2, 6)).toBe(64)
  })

  it('Rivalidade: +0.10 de batalha (L1) / +0.20 (L2) contra o mesmo gênero', () => {
    // Nidoran♀(29): slot0=rivalry
    expect(rivalryBattleBonus(makeMon({ speciesId: 29, secretPicks: [{ slot: 0, level: 1 }] }))).toBeCloseTo(0.1)
    expect(rivalryBattleBonus(makeMon({ speciesId: 29, secretPicks: [{ slot: 0, level: 2 }] }))).toBeCloseTo(0.2)
    expect(rivalryBattleBonus(makeMon({}))).toBe(0)
  })

  it('Hustle: +0.10 de batalha (L1) / +0.30 (L2)', () => {
    // Nidoran♀(29): slot1=hustle; só slot1 → sem rivalry ativo
    expect(hustleBattleBonus(makeMon({ speciesId: 29, secretPicks: [{ slot: 1, level: 1 }] }))).toBeCloseTo(0.1)
    expect(hustleBattleBonus(makeMon({ speciesId: 29, secretPicks: [{ slot: 1, level: 2 }] }))).toBeCloseTo(0.3)
    expect(hustleBattleBonus(makeMon({ speciesId: 29 }))).toBe(0)
  })

  it('Explosion: auto-dano = metade da vida máxima (arred. p/ cima)', () => {
    expect(explosionSelfDamage(makeMon({ maxHp: 10, currentHp: 10 }))).toBe(5)
    expect(explosionSelfDamage(makeMon({ maxHp: 9, currentHp: 9 }))).toBe(5)
  })
})

describe('dano recebido (damageTaken)', () => {
  it('Shell Armor L1: ceil(raw/2); L2: ceil(raw/3); Shell tem precedência; Weak Armor NÃO altera dano', () => {
    // Omanyte(138): slot1=shell-armor L1 → ceil(raw/2)
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 1, level: 1 }] }), 3)).toBe(2)  // ceil(3/2)=2
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 1, level: 1 }] }), 4)).toBe(2)  // ceil(4/2)=2
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 1, level: 1 }] }), 1)).toBe(1)  // ceil(1/2)=1
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 1, level: 1 }] }), 0)).toBe(0)  // 0 continua 0
    // Omanyte slot1=shell-armor L2 → ceil(raw/3)
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 1, level: 2 }] }), 3)).toBe(1)  // ceil(3/3)=1
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 1, level: 2 }] }), 4)).toBe(2)  // ceil(4/3)=2
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 1, level: 2 }] }), 6)).toBe(2)  // ceil(6/3)=2
    // Omanyte slot0(swift-swim L2)+slot1(shell-armor L1): Shell tem precedência → ceil(raw/2)
    expect(damageTaken(makeMon({ speciesId: 138, secretPicks: [{ slot: 0, level: 2 }, { slot: 1, level: 1 }] }), 3)).toBe(2)
    // Onix(95): slot1=weak-armor — NÃO mais dobra dano → passa raw igual
    expect(damageTaken(makeMon({ speciesId: 95, secretPicks: [{ slot: 1, level: 1 }] }), 3)).toBe(3)
    // sem habilidade → raw
    expect(damageTaken(makeMon({}), 3)).toBe(3)
  })
})

describe('viagem e voo', () => {
  it('Weak Armor L1: +15%/ponto; L2: +25%/ponto de HP faltante', () => {
    // Onix(95): slot1=weak-armor L1
    const onixFull = makeMon({ id: 'o', speciesId: 95, secretPicks: [{ slot: 1, level: 1 }], maxHp: 10, currentHp: 10 })
    expect(teamTravelSpeedMultiplier([onixFull])).toBeCloseTo(1) // cheio: sem bônus
    // L1: 3 faltando → +3×0.15 = +45% → 1.45
    const hurtL1 = makeMon({ id: 'o', speciesId: 95, secretPicks: [{ slot: 1, level: 1 }], maxHp: 10, currentHp: 7 })
    expect(teamTravelSpeedMultiplier([hurtL1])).toBeCloseTo(1.45)
    // L2: 3 faltando → +3×0.25 = +75% → 1.75
    const hurtL2 = makeMon({ id: 'o2', speciesId: 95, secretPicks: [{ slot: 1, level: 2 }], maxHp: 10, currentHp: 7 })
    expect(teamTravelSpeedMultiplier([hurtL2])).toBeCloseTo(1.75)
  })

  it('teamHasFly: Aerodactyl (sa-fly) ou a passiva Fly do museu', () => {
    // Aerodactyl(142): slot0=fly → secretPicks:[{slot:0,level:1}]
    expect(teamHasFly([makeMon({ speciesId: 142, secretPicks: [{ slot: 0, level: 1 }] })])).toBe(true)
    expect(teamHasFly([makeMon({ passives: ['fly'] })])).toBe(true)
    expect(teamHasFly([makeMon({})])).toBe(false)
  })

  it('teamFlies: sozinho sempre; em time só com Fly+', () => {
    const flyer = makeMon({ id: 'f', passives: ['fly'] })
    const other = makeMon({ id: 'o' })
    expect(teamFlies([flyer])).toBe(true)
    expect(teamFlies([flyer, other])).toBe(false)
    expect(teamFlies([other])).toBe(false)
    expect(teamFlies([])).toBe(false)
    // Aerodactyl(142): slot0=fly level:2 = Fly+ → faz o time inteiro voar
    const aero3 = makeMon({ id: 'a', speciesId: 142, secretPicks: [{ slot: 0, level: 2 }] })
    expect(teamFlies([aero3, other])).toBe(true)
    // Aerodactyl com Fly (L1): sozinho voa, acompanhado não
    const aero1 = makeMon({ id: 'a', speciesId: 142, secretPicks: [{ slot: 0, level: 1 }] })
    expect(teamFlies([aero1, other])).toBe(false)
  })

  it('Fly acelera o time ao voar', () => {
    // Aerodactyl(142): slot0=fly level:1
    const aero = makeMon({ speciesId: 142, secretPicks: [{ slot: 0, level: 1 }] })
    expect(teamTravelSpeedMultiplier([aero])).toBeCloseTo(1.5) // sozinho voa: +50%
  })
})

describe('Sturdy: 1×/dia', () => {
  it('disponível por dia, consome no runtime', () => {
    // Geodude(74): slot0=sturdy → secretPicks:[{slot:0,level:1}]
    const geo = makeMon({ id: 'g', speciesId: 74, secretPicks: [{ slot: 0, level: 1 }] })
    expect(sturdyAvailable(geo, {})).toBe(true)
    expect(sturdyAvailable(geo, { g: { sturdyUsed: true } })).toBe(false)
    expect(sturdyAvailable(makeMon({ speciesId: 1 }), {})).toBe(false)
  })
})

describe('Dig: túneis no grafo', () => {
  const graph: CityGraph = {
    nodes: { a: { x: 0, y: 0 }, b: { x: 0.1, y: 0 }, c: { x: 0.9, y: 0 } },
    adj: { a: ['b'], b: ['a', 'c'], c: ['b'] },
    markers: {},
  }

  it('um túnel vira o caminho mais curto e barato entre os dois pontos', () => {
    const direct = pathDistance(graph, shortestPath(graph, 'a', 'c'))
    const tunneled = graphWithTunnel(graph, ['a', 'c'])
    const viaTunnel = shortestPath(tunneled, 'a', 'c')
    expect(viaTunnel).toEqual(['a', 'c'])
    expect(pathDistance(tunneled, viaTunnel)).toBeCloseTo(DIG_TUNNEL_COST)
    expect(pathDistance(tunneled, viaTunnel)).toBeLessThan(direct)
  })

  it('graphWithTunnels aplica vários túneis (um por Pokémon com Dig)', () => {
    const tunneled = graphWithTunnels(graph, [
      ['a', 'b'],
      ['b', 'c'],
    ])
    // Cada par do conjunto fica barato.
    expect(pathDistance(tunneled, shortestPath(tunneled, 'a', 'b'))).toBeCloseTo(DIG_TUNNEL_COST)
    expect(pathDistance(tunneled, shortestPath(tunneled, 'b', 'c'))).toBeCloseTo(DIG_TUNNEL_COST)
    // a↔c passa por dois túneis encadeados (a–b–c).
    expect(pathDistance(tunneled, shortestPath(tunneled, 'a', 'c'))).toBeCloseTo(2 * DIG_TUNNEL_COST)
  })

  it('lista vazia devolve o próprio grafo', () => {
    expect(graphWithTunnels(graph, [])).toBe(graph)
  })
})

describe('predicados de chuva (Swift Swim / Cloud Nine)', () => {
  it('teamHasSwiftSwim: true se ALGUÉM no time tem Swift Swim', () => {
    // Omanyte(138): slot0=swift-swim → secretPicks:[{slot:0,level:1}]
    const swimmer = makeMon({ speciesId: 138, secretPicks: [{ slot: 0, level: 1 }] })
    const plain = makeMon({ speciesId: 138 })
    expect(teamHasSwiftSwim([swimmer])).toBe(true)
    expect(teamHasSwiftSwim([plain])).toBe(false)
    expect(teamHasSwiftSwim([plain, swimmer])).toBe(true)
  })

  it('hasCloudNine: só com a habilidade desbloqueada (Psyduck 54, slot1)', () => {
    // Psyduck(54): slot0=surf, slot1=cloud-nine → secretPicks:[{slot:1,level:1}]
    expect(hasCloudNine(makeMon({ speciesId: 54, secretPicks: [{ slot: 1, level: 1 }] }))).toBe(true)
    expect(hasCloudNine(makeMon({ speciesId: 54, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(false)
  })
})

describe('teamIsSpeedy (aura de velocidade ao vivo)', () => {
  const rainNow = {
    rain: [{ startMs: 0, endMs: 100_000, puddles: [] }],
    storms: [],
    forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1, stormChancePercent: 0, potentialStormCount: 0 },
  }
  const dry = { rain: [], storms: [], forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0, stormChancePercent: 0, potentialStormCount: 0 } }

  it('Swift Swim acende a aura SÓ enquanto chove', () => {
    // Omanyte(138): slot0=swift-swim
    const swimmer = makeMon({ speciesId: 138, secretPicks: [{ slot: 0, level: 1 }] })
    expect(teamIsSpeedy([swimmer], [], rainNow, 5_000)).toBe(true) // chovendo
    expect(teamIsSpeedy([swimmer], [], rainNow, 200_000)).toBe(false) // depois da chuva
    expect(teamIsSpeedy([swimmer], [], dry, 0)).toBe(false) // sem chuva
  })

  it('Weak Armor (HP faltante) mantém a aura como antes, sem depender de chuva', () => {
    // Onix(95): slot1=weak-armor; com HP faltante o multiplicador base passa de 1.
    const hurt = makeMon({ speciesId: 95, secretPicks: [{ slot: 1, level: 1 }], maxHp: 10, currentHp: 7 })
    expect(teamIsSpeedy([hurt], [], dry, 0)).toBe(true)
  })
})

describe('Vital Spirit (Electabuzz)', () => {
  it('hasVitalSpirit ativa no slot0 da linha (Electabuzz 125)', () => {
    // Electabuzz(125): slot0=vital-spirit, slot1=volt-absorb
    expect(hasVitalSpirit(makeMon({ speciesId: 125 }))).toBe(false)
    expect(hasVitalSpirit(makeMon({ speciesId: 125, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(true)
  })

  it('teamHasVitalSpirit = qualquer membro do time com a habilidade', () => {
    const carrier = makeMon({ id: 'e', speciesId: 125, secretPicks: [{ slot: 0, level: 1 }] })
    const other = makeMon({ id: 'o' })
    expect(teamHasVitalSpirit([other])).toBe(false)
    expect(teamHasVitalSpirit([other, carrier])).toBe(true)
  })
})

describe('Quick Feet (Jolteon, linha divergente)', () => {
  it('hasQuickFeet ativa no slot0 da linha do Jolteon (135)', () => {
    // Jolteon(135): slot0=quick-feet, slot1=volt-absorb — via SECRET_LINE_BY_SPECIES
    expect(hasQuickFeet(makeMon({ speciesId: 135 }))).toBe(false)
    expect(hasQuickFeet(makeMon({ speciesId: 135, secretPicks: [{ slot: 0, level: 1 }] }))).toBe(true)
  })

  it('não vaza para outros eeveelutions (Flareon 136 sem linha)', () => {
    expect(hasQuickFeet(makeMon({ speciesId: 136, secretPicks: [{ slot: 0, level: 2 }, { slot: 1, level: 1 }] }))).toBe(false)
  })

  it('teamHasQuickFeet L1 solo: true', () => {
    // Jolteon(135): slot0=quick-feet L1 sozinho → true
    const jolteon = makeMon({ id: 'j', speciesId: 135, secretPicks: [{ slot: 0, level: 1 }] })
    expect(teamHasQuickFeet([jolteon])).toBe(true)
  })

  it('teamHasQuickFeet L1 em time de 2: false', () => {
    // Jolteon(135): slot0=quick-feet L1 acompanhado → false
    const jolteon = makeMon({ id: 'j', speciesId: 135, secretPicks: [{ slot: 0, level: 1 }] })
    const other = makeMon({ id: 'o' })
    expect(teamHasQuickFeet([jolteon, other])).toBe(false)
  })

  it('teamHasQuickFeet L2 em time de 2: true (time inteiro fica rápido)', () => {
    // Jolteon(135): slot0=quick-feet L2 acompanhado → true (bônus para o time todo)
    const jolteon = makeMon({ id: 'j', speciesId: 135, secretPicks: [{ slot: 0, level: 2 }] })
    const other = makeMon({ id: 'o' })
    expect(teamHasQuickFeet([jolteon, other])).toBe(true)
  })

  it('teamHasQuickFeet dobra a velocidade de viagem quando ativo', () => {
    const jolteon = makeMon({ id: 'j', speciesId: 135, secretPicks: [{ slot: 0, level: 1 }] })
    const other = makeMon({ id: 'o' })
    expect(teamTravelSpeedMultiplier([jolteon])).toBeCloseTo(2, 6) // L1 solo: +100%
    expect(teamTravelSpeedMultiplier([jolteon, other])).toBeCloseTo(1, 6) // L1 acompanhado: sem bônus
    // L2 acompanhado: +100% para o time
    const jolteonL2 = makeMon({ id: 'j2', speciesId: 135, secretPicks: [{ slot: 0, level: 2 }] })
    expect(teamTravelSpeedMultiplier([jolteonL2, other])).toBeCloseTo(2, 6)
  })
})

describe('missionAttrMultiplier — electirizer', () => {
  it('+50% por carga acumulada no Pokémon despachado', () => {
    const p = makeMon({ id: 'x' })
    const ctx: MissionSecretCtx = {
      team: [p],
      template: PATRULHA,
      runtime: {},
      runItems: [],
      electirizerBonus: { x: 2 }, // 2 raios → +100%
    }
    expect(missionAttrMultiplier(p, ctx)).toBeCloseTo(2) // 1 * (1 + 0.5*2)
  })

  it('sem carga, multiplicador é 1', () => {
    const p = makeMon({ id: 'y' })
    const ctx: MissionSecretCtx = { team: [p], template: PATRULHA, runtime: {}, runItems: [] }
    expect(missionAttrMultiplier(p, ctx)).toBeCloseTo(1)
  })
})

describe('missionEffectBreakdown', () => {
  const baseCtx = (over: Partial<MissionSecretCtx>): MissionSecretCtx => ({
    team: [],
    template: getMissionTemplate('patrulha'),
    runtime: {},
    runItems: [],
    ...over,
  })

  it('time sem efeitos → lista vazia', () => {
    const mon = makeMon({ id: 'p1', speciesId: 1 })
    expect(missionEffectBreakdown(baseCtx({ team: [mon] }))).toEqual([])
  })

  it('Hustle aparece como perda de atributo (L1 = −10%)', () => {
    // Nidoran♀(29): slot1=hustle → secretPicks:[{slot:1,level:1}]
    const mon = makeMon({ id: 'p1', speciesId: 29, secretPicks: [{ slot: 1, level: 1 }] })
    const entries = missionEffectBreakdown(baseCtx({ team: [mon] }))
    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'hustle', direction: 'loss', value: '−10%', kind: 'attr' }),
    )
  })

  it('Lagging Tail gera ganho de atributo e perda de velocidade', () => {
    const mon = makeMon({ id: 'p1', speciesId: 1 })
    const entries = missionEffectBreakdown(baseCtx({ team: [mon], runItems: ['lagging-tail'] }))
    const attr = entries.find((e) => e.id === 'lagging-tail' && e.kind === 'attr')
    const speed = entries.find((e) => e.id === 'lagging-tail' && e.kind === 'speed')
    expect(attr).toMatchObject({ direction: 'gain', value: '+50%', source: 'item' })
    expect(speed).toMatchObject({ direction: 'loss', value: '−50%' })
  })

  it('Weak Armor com HP faltante vira ganho de velocidade proporcional', () => {
    // Onix(95): slot1=weak-armor L1; 2 de HP faltante × 15% = +30%.
    const mon = makeMon({ id: 'p1', speciesId: 95, secretPicks: [{ slot: 1, level: 1 }], maxHp: 5, currentHp: 3 })
    const entries = missionEffectBreakdown(baseCtx({ team: [mon] }))
    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'weak-armor', kind: 'speed', direction: 'gain', value: '+30%' }),
    )
  })

  it('Rivalry com dois aliados do mesmo gênero mostra +20% (bônus agregado)', () => {
    // Nidoran♀(29): slot0=rivalry → secretPicks:[{slot:0,level:1}]
    const nido = makeMon({ id: 'n1', speciesId: 29, secretPicks: [{ slot: 0, level: 1 }], gender: 'female' })
    const ally1 = makeMon({ id: 'a1', gender: 'female' })
    const ally2 = makeMon({ id: 'a2', gender: 'female' })
    const entries = missionEffectBreakdown(baseCtx({ team: [nido, ally1, ally2] }))
    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'rivalry', kind: 'attr', direction: 'gain', value: '+20%' }),
    )
  })

  it('Clear Body SEM perda de atributo no time: entrada não aparece', () => {
    // Tentacool(72): slot0=clear-body → secretPicks:[{slot:0,level:1}]
    // Missão patrulha: nenhum Analytic ou Rock Head presente, logo nenhuma perda de atributo.
    const tentacool = makeMon({ id: 't1', speciesId: 72, secretPicks: [{ slot: 0, level: 1 }] })
    const entries = missionEffectBreakdown(baseCtx({ team: [tentacool] }))
    expect(entries.find((e) => e.id === 'clear-body')).toBeUndefined()
  })
})
