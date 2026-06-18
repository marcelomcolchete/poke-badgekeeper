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
  hasWeakArmor,
  hustleBattleBonus,
  missionAttrMultiplier,
  rivalryBattleBonus,
  rolloutBonusPerWin,
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

// Linhas de Cerulean (a habilidade vem da posição na linha):
// Goldeen(118) Surf#1; Blastoise(9) Surf+#3; Horsea(116) Sniper#3; Squirtle(7) Torrent#2;
// Staryu(120) Analytic#1; Tentacool(72) Clear Body#1; Nidoran♀(29) Hustle#2.

function ctxOf(
  team: ReturnType<typeof makeMon>[],
  template = PALESTRA,
  runtime = {},
  runItems: string[] = [],
): MissionSecretCtx {
  return { team, template, runtime, runItems }
}

describe('desbloqueio sequencial (secretCount)', () => {
  it('só ativa as habilidades já desbloqueadas, na ordem da linha', () => {
    // Sandshrew (27): [Rollout, Dig, Sand Rush]
    expect(rolloutBonusPerWin(makeMon({ speciesId: 27, secretCount: 1 }))).toBeGreaterThan(0)
    expect(hasDig(makeMon({ speciesId: 27, secretCount: 1 }))).toBe(false)
    expect(hasDig(makeMon({ speciesId: 27, secretCount: 2 }))).toBe(true)
    // Sandslash (28) cai na mesma linha do Sandshrew (raiz 27).
    expect(hasDig(makeMon({ speciesId: 28, secretCount: 2 }))).toBe(true)
    // Sem destaque nenhum: nada ativo.
    expect(rolloutBonusPerWin(makeMon({ speciesId: 27, secretCount: 0 }))).toBe(0)
    // Espécie sem linha secreta: nada.
    expect(hasDig(makeMon({ speciesId: 1, secretCount: 3 }))).toBe(false)
  })

  it('flags por habilidade respeitam a posição na linha', () => {
    expect(hasSturdy(makeMon({ speciesId: 74, secretCount: 1 }))).toBe(true) // Geodude #1
    expect(hasExplosion(makeMon({ speciesId: 74, secretCount: 1 }))).toBe(false) // Geodude #2
    expect(hasExplosion(makeMon({ speciesId: 74, secretCount: 2 }))).toBe(true)
    expect(hasBattleArmor(makeMon({ speciesId: 104, secretCount: 2 }))).toBe(true) // Cubone #2
    expect(hasLightningRod(makeMon({ speciesId: 111, secretCount: 1 }))).toBe(true) // Rhyhorn #1
    expect(hasReckless(makeMon({ speciesId: 111, secretCount: 3 }))).toBe(true) // Rhyhorn #3
    // Omanyte (138): [Swift Swim, Shell Armor, Weak Armor] — com 3, tem Shell E Weak.
    const oma3 = makeMon({ speciesId: 138, secretCount: 3 })
    expect(hasShellArmor(oma3)).toBe(true)
    expect(hasWeakArmor(oma3)).toBe(true)
  })
})

describe('missionAttrMultiplier', () => {
  it('Rivalidade: +10% por aliado do mesmo gênero', () => {
    const nido = makeMon({ id: 'a', speciesId: 29, gender: 'male', secretCount: 1 })
    const allyM = makeMon({ id: 'b', gender: 'male' })
    const ally2 = makeMon({ id: 'd', gender: 'male' })
    const other = makeMon({ id: 'c', gender: 'female' })
    expect(missionAttrMultiplier(nido, ctxOf([nido, allyM]))).toBeCloseTo(1.1)
    expect(missionAttrMultiplier(nido, ctxOf([nido, allyM, ally2]))).toBeCloseTo(1.2)
    expect(missionAttrMultiplier(nido, ctxOf([nido, other]))).toBe(1)
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBe(1)
  })

  it('Rock Head: +50% em escolta, −50% em ensino; nada em patrulha', () => {
    const rhy = makeMon({ speciesId: 111, secretCount: 2 }) // Rhyhorn #2 = Rock Head
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ESCOLTA))).toBeCloseTo(1.5)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ENSINO))).toBeCloseTo(0.5)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], PATRULHA))).toBe(1)
  })

  it('Battle Armor: +30% só com o flag pendente', () => {
    const cub = makeMon({ id: 'cu', speciesId: 104, secretCount: 2 }) // Cubone #2 = Battle Armor
    expect(missionAttrMultiplier(cub, ctxOf([cub]))).toBe(1)
    const ctx = ctxOf([cub], PALESTRA, { cu: { battleArmorPending: true } })
    expect(missionAttrMultiplier(cub, ctx)).toBeCloseTo(1.3)
  })

  it('Hustle: −10% nos atributos em missão', () => {
    const nido = makeMon({ speciesId: 29, secretCount: 2 }) // Nidoran♀ #2 = Hustle (e Rivalidade #1)
    // Sozinho (sem aliado do mesmo gênero): só a penalidade do Hustle.
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBeCloseTo(0.9)
  })

  it('teamSecretAxisSum aplica o multiplicador (e cai no teto)', () => {
    const rhy = makeMon({ speciesId: 111, secretCount: 2 }) // efetivo 20/eixo, Rock Head
    expect(teamSecretAxisSum('batalha', ctxOf([rhy], ESCOLTA))).toBeCloseTo(30) // 20 × 1.5
  })
})

describe('Surf / Sniper: predicados de time', () => {
  const goldeen = makeMon({ id: 'g', speciesId: 118, secretCount: 1 }) // Surf
  const blastoise = makeMon({ id: 'bl', speciesId: 9, secretCount: 3 }) // Surf+
  const horsea = makeMon({ id: 'h', speciesId: 116, secretCount: 3 }) // Sniper
  const other = makeMon({ id: 'o' })

  it('hasSurf: Surf ou Surf+', () => {
    expect(hasSurf(goldeen)).toBe(true)
    expect(hasSurf(blastoise)).toBe(true)
    expect(hasSurf(other)).toBe(false)
    expect(hasSurf(makeMon({ speciesId: 118, secretCount: 0 }))).toBe(false)
  })

  it('teamHasSurf / teamSurfs: sozinho sempre; em time só com Surf+', () => {
    expect(teamHasSurf([goldeen])).toBe(true)
    expect(teamSurfs([goldeen])).toBe(true)
    expect(teamSurfs([goldeen, other])).toBe(false) // só Surf: acompanhado não surfa
    expect(teamSurfs([blastoise, other])).toBe(true) // Surf+ leva o time
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
  it('Torrent: +50% com OUTRO aliado do tipo Água', () => {
    const sq = makeMon({ id: 'sq', speciesId: 7, secretCount: 2, types: ['water'] }) // Torrent
    const waterAlly = makeMon({ id: 'w', types: ['water'] })
    const fireAlly = makeMon({ id: 'f', types: ['fire'] })
    expect(missionAttrMultiplier(sq, ctxOf([sq, waterAlly]))).toBeCloseTo(1.5)
    expect(missionAttrMultiplier(sq, ctxOf([sq, fireAlly]))).toBe(1)
    expect(missionAttrMultiplier(sq, ctxOf([sq]))).toBe(1) // "outro" exclui ele mesmo
  })

  it('Analytic: +50% em Ensino, −50% em Patrulha, nada em Palestra', () => {
    const staryu = makeMon({ speciesId: 120, secretCount: 1 }) // Analytic
    expect(missionAttrMultiplier(staryu, ctxOf([staryu], ENSINO))).toBeCloseTo(1.5)
    expect(missionAttrMultiplier(staryu, ctxOf([staryu], PATRULHA))).toBeCloseTo(0.5)
    expect(missionAttrMultiplier(staryu, ctxOf([staryu], PALESTRA))).toBe(1)
  })

  it('Clear Body: anula o debuff de atributo do time (Hustle)', () => {
    const nido = makeMon({ id: 'n', speciesId: 29, secretCount: 2, gender: 'female' }) // Hustle
    const tentacool = makeMon({ id: 't', speciesId: 72, secretCount: 1 }) // Clear Body
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBeCloseTo(0.9) // só Hustle
    expect(missionAttrMultiplier(nido, ctxOf([nido, tentacool]))).toBe(1) // anulado
  })
})

describe('combate: bônus de batalha', () => {
  it('Rollout: +10% por vitória', () => {
    expect(rolloutBonusPerWin(makeMon({ speciesId: 27, secretCount: 1 }))).toBeCloseTo(0.1)
    expect(rolloutBonusPerWin(makeMon({}))).toBe(0)
  })

  it('Rivalidade: +10% de batalha contra o mesmo gênero', () => {
    expect(rivalryBattleBonus(makeMon({ speciesId: 29, secretCount: 1 }))).toBeCloseTo(0.1)
    expect(rivalryBattleBonus(makeMon({}))).toBe(0)
  })

  it('Hustle: +10% de batalha', () => {
    expect(hustleBattleBonus(makeMon({ speciesId: 29, secretCount: 2 }))).toBeCloseTo(0.1)
    expect(hustleBattleBonus(makeMon({ speciesId: 29, secretCount: 1 }))).toBe(0)
  })

  it('Explosion: auto-dano = metade da vida máxima (arred. p/ cima)', () => {
    expect(explosionSelfDamage(makeMon({ maxHp: 10, currentHp: 10 }))).toBe(5)
    expect(explosionSelfDamage(makeMon({ maxHp: 9, currentHp: 9 }))).toBe(5)
  })
})

describe('dano recebido (damageTaken)', () => {
  it('Weak Armor dobra; Shell Armor reduz a 1; Shell tem precedência', () => {
    expect(damageTaken(makeMon({ speciesId: 95, secretCount: 1 }), 3)).toBe(6) // Onix #1 = Weak Armor
    expect(damageTaken(makeMon({ speciesId: 138, secretCount: 2 }), 3)).toBe(1) // Omanyte #2 = Shell
    expect(damageTaken(makeMon({ speciesId: 138, secretCount: 3 }), 3)).toBe(1) // Shell + Weak → 1
    expect(damageTaken(makeMon({}), 3)).toBe(3)
    expect(damageTaken(makeMon({ speciesId: 138, secretCount: 2 }), 0)).toBe(0) // 0 continua 0
  })
})

describe('viagem e voo', () => {
  it('Weak Armor: +20% de velocidade por ponto de HP faltante', () => {
    const onix = makeMon({ id: 'o', speciesId: 95, secretCount: 1, maxHp: 10, currentHp: 10 })
    expect(teamTravelSpeedMultiplier([onix])).toBeCloseTo(1) // cheio: sem bônus
    const hurt = makeMon({ id: 'o', speciesId: 95, secretCount: 1, maxHp: 10, currentHp: 7 })
    expect(teamTravelSpeedMultiplier([hurt])).toBeCloseTo(1.6) // 3 faltando → +60%
  })

  it('teamHasFly: Aerodactyl (sa-fly) ou a passiva Fly do museu', () => {
    expect(teamHasFly([makeMon({ speciesId: 142, secretCount: 1 })])).toBe(true)
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
    // Aerodactyl com Fly+ (secretCount 3) faz o time inteiro voar.
    const aero3 = makeMon({ id: 'a', speciesId: 142, secretCount: 3 })
    expect(teamFlies([aero3, other])).toBe(true)
    const aero1 = makeMon({ id: 'a', speciesId: 142, secretCount: 1 })
    expect(teamFlies([aero1, other])).toBe(false) // só Fly: acompanhado não voa
  })

  it('Fly acelera o time ao voar', () => {
    const aero = makeMon({ speciesId: 142, secretCount: 1 })
    expect(teamTravelSpeedMultiplier([aero])).toBeCloseTo(1.5) // sozinho voa: +50%
  })
})

describe('Sturdy: 1×/dia', () => {
  it('disponível por dia, consome no runtime', () => {
    const geo = makeMon({ id: 'g', speciesId: 74, secretCount: 1 })
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
    // Omanyte (138): [Swift Swim, Shell Armor, Weak Armor] → posição 1.
    const swimmer = makeMon({ speciesId: 138, secretCount: 1 })
    const plain = makeMon({ speciesId: 138, secretCount: 0 })
    expect(teamHasSwiftSwim([swimmer])).toBe(true)
    expect(teamHasSwiftSwim([plain])).toBe(false)
    expect(teamHasSwiftSwim([plain, swimmer])).toBe(true)
  })

  it('hasCloudNine: só com a habilidade desbloqueada (Psyduck 54, posição 3)', () => {
    expect(hasCloudNine(makeMon({ speciesId: 54, secretCount: 3 }))).toBe(true)
    expect(hasCloudNine(makeMon({ speciesId: 54, secretCount: 2 }))).toBe(false)
  })
})

describe('teamIsSpeedy (aura de velocidade ao vivo)', () => {
  const rainNow = {
    rain: [{ startMs: 0, endMs: 100_000, puddles: [] }],
    forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1 },
  }
  const dry = { rain: [], forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0 } }

  it('Swift Swim acende a aura SÓ enquanto chove', () => {
    const swimmer = makeMon({ speciesId: 138, secretCount: 1 })
    expect(teamIsSpeedy([swimmer], [], rainNow, 5_000)).toBe(true) // chovendo
    expect(teamIsSpeedy([swimmer], [], rainNow, 200_000)).toBe(false) // depois da chuva
    expect(teamIsSpeedy([swimmer], [], dry, 0)).toBe(false) // sem chuva
  })

  it('Weak Armor (HP faltante) mantém a aura como antes, sem depender de chuva', () => {
    // Onix (95): Weak Armor na posição 1; com HP faltante o multiplicador base passa de 1.
    const hurt = makeMon({ speciesId: 95, secretCount: 1, maxHp: 10, currentHp: 7 })
    expect(teamIsSpeedy([hurt], [], dry, 0)).toBe(true)
  })
})

describe('Vital Spirit (Electabuzz)', () => {
  it('hasVitalSpirit ativa na 1ª posição da linha (Electabuzz 125)', () => {
    // Electabuzz (125): [Vital Spirit, Volt Absorb, Static].
    expect(hasVitalSpirit(makeMon({ speciesId: 125, secretCount: 0 }))).toBe(false)
    expect(hasVitalSpirit(makeMon({ speciesId: 125, secretCount: 1 }))).toBe(true)
  })

  it('teamHasVitalSpirit = qualquer membro do time com a habilidade', () => {
    const carrier = makeMon({ id: 'e', speciesId: 125, secretCount: 1 })
    const other = makeMon({ id: 'o' })
    expect(teamHasVitalSpirit([other])).toBe(false)
    expect(teamHasVitalSpirit([other, carrier])).toBe(true)
  })
})

describe('Quick Feet (Jolteon, linha divergente)', () => {
  it('hasQuickFeet ativa na 1ª posição da linha do Jolteon (135)', () => {
    // Jolteon (135): [Quick Feet, Volt Absorb, Static] — via SECRET_LINE_BY_SPECIES.
    expect(hasQuickFeet(makeMon({ speciesId: 135, secretCount: 0 }))).toBe(false)
    expect(hasQuickFeet(makeMon({ speciesId: 135, secretCount: 1 }))).toBe(true)
  })

  it('não vaza para outros eeveelutions (Flareon 136 sem linha)', () => {
    expect(hasQuickFeet(makeMon({ speciesId: 136, secretCount: 3 }))).toBe(false)
  })

  it('teamHasQuickFeet só vale sozinho; dobra a velocidade de viagem (×2)', () => {
    const jolteon = makeMon({ id: 'j', speciesId: 135, secretCount: 1 })
    const other = makeMon({ id: 'o' })
    expect(teamHasQuickFeet([jolteon])).toBe(true)
    expect(teamHasQuickFeet([jolteon, other])).toBe(false) // acompanhado não corre
    expect(teamTravelSpeedMultiplier([jolteon])).toBeCloseTo(2, 6) // +100%
    expect(teamTravelSpeedMultiplier([jolteon, other])).toBeCloseTo(1, 6) // sem bônus em grupo
  })
})
