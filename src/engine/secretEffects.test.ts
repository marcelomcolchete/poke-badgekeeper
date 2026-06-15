import { describe, expect, it } from 'vitest'
import type { CityGraph } from '../data/types.ts'
import { makeMon } from './testkit.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { DIG_TUNNEL_COST } from './balance.ts'
import { graphWithTunnel, pathDistance, shortestPath } from './pathfinding.ts'
import {
  activeSecretId,
  combatDamageMultiplier,
  hasBattleArmor,
  hasDig,
  hasShellArmor,
  hasSturdy,
  hasWeakArmor,
  missionAttrMultiplier,
  rivalryBattleBonus,
  rolloutBonusPerWin,
  sturdyAvailable,
  sturdyHealsFull,
  teamFlies,
  teamHasFly,
  teamSecretAxisSum,
  teamTravelSpeedMultiplier,
  type MissionSecretCtx,
} from './secretEffects.ts'

const ESCOLTA = getMissionTemplate('escolta')
const ENSINO = getMissionTemplate('ensino')
const PATRULHA = getMissionTemplate('patrulha')
const PALESTRA = getMissionTemplate('palestra')

function ctxOf(
  team: ReturnType<typeof makeMon>[],
  template = PALESTRA,
  runtime = {},
  runItems: string[] = [],
): MissionSecretCtx {
  return { team, template, runtime, runItems }
}

describe('activeSecretId', () => {
  it('só é ativa com a espécie da linha E a passiva desbloqueada', () => {
    expect(activeSecretId(makeMon({ speciesId: 27, passives: ['secret-sandshrew'] }))).toBe('secret-sandshrew')
    // Sandslash (28) cai na mesma linha do Sandshrew (raiz 27).
    expect(activeSecretId(makeMon({ speciesId: 28, passives: ['secret-sandshrew'] }))).toBe('secret-sandshrew')
    expect(activeSecretId(makeMon({ speciesId: 27, passives: [] }))).toBeNull()
    expect(activeSecretId(makeMon({ speciesId: 1, passives: [] }))).toBeNull()
  })
})

describe('missionAttrMultiplier', () => {
  it('Rivalidade: +10% por aliado do mesmo gênero (nível Bronze)', () => {
    const nido = makeMon({ id: 'a', speciesId: 29, gender: 'male', passives: ['secret-nidoran-f'] })
    const allyM = makeMon({ id: 'b', gender: 'male' })
    const ally2 = makeMon({ id: 'd', gender: 'male' })
    const other = makeMon({ id: 'c', gender: 'female' })
    expect(missionAttrMultiplier(nido, ctxOf([nido, allyM]))).toBeCloseTo(1.1)
    expect(missionAttrMultiplier(nido, ctxOf([nido, allyM, ally2]))).toBeCloseTo(1.2) // 2 aliados
    expect(missionAttrMultiplier(nido, ctxOf([nido, other]))).toBe(1)
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBe(1)
  })

  it('Rivalidade nível Ouro: +20% por aliado do mesmo gênero', () => {
    const nido = makeMon({ id: 'a', speciesId: 29, gender: 'male', passives: ['secret-nidoran-f'], secretLevel: 3 })
    const allyM = makeMon({ id: 'b', gender: 'male' })
    expect(missionAttrMultiplier(nido, ctxOf([nido, allyM]))).toBeCloseTo(1.2)
  })

  it('Rock Head: +50% em escolta, −50% em ensino (Bronze); nada em patrulha', () => {
    const rhy = makeMon({ speciesId: 111, passives: ['secret-rhyhorn'] })
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ESCOLTA))).toBeCloseTo(1.5)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ENSINO))).toBeCloseTo(0.5)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], PATRULHA))).toBe(1)
  })

  it('Rock Head nível Ouro: +100% escolta, −70% ensino', () => {
    const rhy = makeMon({ speciesId: 111, passives: ['secret-rhyhorn'], secretLevel: 3 })
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ESCOLTA))).toBeCloseTo(2.0)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ENSINO))).toBeCloseTo(0.3)
  })

  it('Shell Armor não altera atributos de missão (só anula dano)', () => {
    const oma = makeMon({ speciesId: 138, passives: ['secret-omanyte'] })
    expect(missionAttrMultiplier(oma, ctxOf([oma], ESCOLTA))).toBe(1)
    expect(missionAttrMultiplier(oma, ctxOf([oma], PATRULHA))).toBe(1)
  })

  it('Battle Armor: +30% (Bronze) só com o flag pendente', () => {
    const cub = makeMon({ id: 'cu', speciesId: 104, passives: ['secret-cubone'] })
    expect(missionAttrMultiplier(cub, ctxOf([cub]))).toBe(1)
    const ctx = ctxOf([cub], PALESTRA, { cu: { battleArmorPending: true } })
    expect(missionAttrMultiplier(cub, ctx)).toBeCloseTo(1.3)
  })

  it('Battle Armor nível Ouro: +100%', () => {
    const cub = makeMon({ id: 'cu', speciesId: 104, passives: ['secret-cubone'], secretLevel: 3 })
    const ctx = ctxOf([cub], PALESTRA, { cu: { battleArmorPending: true } })
    expect(missionAttrMultiplier(cub, ctx)).toBeCloseTo(2.0)
  })

  it('teamSecretAxisSum aplica o multiplicador (e cai no teto)', () => {
    const rhy = makeMon({ speciesId: 111, passives: ['secret-rhyhorn'] }) // efetivo 20/eixo
    expect(teamSecretAxisSum('batalha', ctxOf([rhy], ESCOLTA))).toBeCloseTo(30) // 20 × 1.5
  })
})

describe('combate: bônus de batalha', () => {
  it('Rollout: bônus por vitória escala com o nível', () => {
    expect(rolloutBonusPerWin(makeMon({ speciesId: 27, passives: ['secret-sandshrew'] }))).toBeCloseTo(0.1)
    expect(rolloutBonusPerWin(makeMon({ speciesId: 27, passives: ['secret-sandshrew'], secretLevel: 2 }))).toBeCloseTo(0.15)
    expect(rolloutBonusPerWin(makeMon({ speciesId: 27, passives: ['secret-sandshrew'], secretLevel: 3 }))).toBeCloseTo(0.25)
    expect(rolloutBonusPerWin(makeMon({}))).toBe(0)
  })

  it('Rivalidade: bônus de batalha só a partir do nível Prata', () => {
    expect(rivalryBattleBonus(makeMon({ speciesId: 29, passives: ['secret-nidoran-f'] }))).toBe(0)
    expect(rivalryBattleBonus(makeMon({ speciesId: 29, passives: ['secret-nidoran-f'], secretLevel: 2 }))).toBeCloseTo(0.15)
    expect(rivalryBattleBonus(makeMon({ speciesId: 29, passives: ['secret-nidoran-f'], secretLevel: 3 }))).toBeCloseTo(0.3)
  })
})

describe('viagem e combate', () => {
  it('Weak Armor acelera o time por nível (após tomar dano)', () => {
    const onix = makeMon({ id: 'o', speciesId: 95, passives: ['secret-onix'] })
    expect(teamTravelSpeedMultiplier([onix], {})).toBe(1)
    expect(teamTravelSpeedMultiplier([onix], { o: { weakArmorActive: true } })).toBeCloseTo(1.5)
    const onix3 = makeMon({ id: 'o', speciesId: 95, passives: ['secret-onix'], secretLevel: 3 })
    expect(teamTravelSpeedMultiplier([onix3], { o: { weakArmorActive: true } })).toBeCloseTo(3.0) // +200%
  })

  it('Shell Armor desacelera a próxima missão por nível (debuff)', () => {
    const oma = makeMon({ id: 'm', speciesId: 138, passives: ['secret-omanyte'] })
    expect(teamTravelSpeedMultiplier([oma], { m: { shellArmorSlow: true } })).toBeCloseTo(0.5) // −50%
    const oma3 = makeMon({ id: 'm', speciesId: 138, passives: ['secret-omanyte'], secretLevel: 3 })
    expect(teamTravelSpeedMultiplier([oma3], { m: { shellArmorSlow: true } })).toBeCloseTo(1.0) // sem penalidade
  })

  it('Fly: +50% de velocidade a partir do nível Prata ao voar', () => {
    const aero1 = makeMon({ speciesId: 142, passives: ['secret-aerodactyl'] })
    expect(teamTravelSpeedMultiplier([aero1], {})).toBeCloseTo(1.0) // Bronze: sem bônus de velocidade
    const aero2 = makeMon({ speciesId: 142, passives: ['secret-aerodactyl'], secretLevel: 2 })
    expect(teamTravelSpeedMultiplier([aero2], {})).toBeCloseTo(1.5)
  })

  it('teamHasFly: Aerodactyl ou a passiva Fly', () => {
    expect(teamHasFly([makeMon({ speciesId: 142, passives: ['secret-aerodactyl'] })])).toBe(true)
    expect(teamHasFly([makeMon({ passives: ['fly'] })])).toBe(true)
    expect(teamHasFly([makeMon({})])).toBe(false)
  })

  it('teamFlies: sozinho sempre; em time só com Aerodactyl Ouro', () => {
    const flyer = makeMon({ id: 'f', passives: ['fly'] })
    const other = makeMon({ id: 'o' })
    expect(teamFlies([flyer])).toBe(true)
    expect(teamFlies([flyer, other])).toBe(false) // voador comum acompanhado não voa
    expect(teamFlies([other])).toBe(false)
    expect(teamFlies([])).toBe(false)
    // Aerodactyl nível Ouro faz o time inteiro voar.
    const aero3 = makeMon({ id: 'a', speciesId: 142, passives: ['secret-aerodactyl'], secretLevel: 3 })
    expect(teamFlies([aero3, other])).toBe(true)
    const aero2 = makeMon({ id: 'a', speciesId: 142, passives: ['secret-aerodactyl'], secretLevel: 2 })
    expect(teamFlies([aero2, other])).toBe(false) // Prata ainda só sozinho
  })

  it('combatDamageMultiplier: Weak Armor dobra, Shell Armor anula', () => {
    expect(combatDamageMultiplier(makeMon({ speciesId: 95, passives: ['secret-onix'] }))).toBe(2)
    expect(combatDamageMultiplier(makeMon({ speciesId: 140, passives: ['secret-kabuto'] }))).toBe(2)
    expect(combatDamageMultiplier(makeMon({ speciesId: 138, passives: ['secret-omanyte'] }))).toBe(0)
    expect(combatDamageMultiplier(makeMon({}))).toBe(1)
  })

  it('Sturdy: cura total só no Ouro; escopo por jogo no Bronze', () => {
    const geo1 = makeMon({ speciesId: 74, passives: ['secret-geodude'] })
    const geo3 = makeMon({ speciesId: 74, passives: ['secret-geodude'], secretLevel: 3 })
    expect(sturdyHealsFull(geo1)).toBe(false)
    expect(sturdyHealsFull(geo3)).toBe(true)
    // Bronze gasta no JOGO (passiva 'sturdy-spent'); Prata/Ouro gastam no DIA (runtime).
    expect(sturdyAvailable(geo1, {})).toBe(true)
    expect(sturdyAvailable(makeMon({ speciesId: 74, passives: ['secret-geodude', 'sturdy-spent'] }), {})).toBe(false)
    const geo2 = makeMon({ id: 'g', speciesId: 74, passives: ['secret-geodude'], secretLevel: 2 })
    expect(sturdyAvailable(geo2, { g: { sturdyUsed: true } })).toBe(false)
    expect(sturdyAvailable(geo2, {})).toBe(true)
  })

  it('flags por habilidade', () => {
    expect(hasSturdy(makeMon({ speciesId: 74, passives: ['secret-geodude'] }))).toBe(true)
    expect(hasDig(makeMon({ speciesId: 50, passives: ['secret-diglett'] }))).toBe(true)
    expect(hasBattleArmor(makeMon({ speciesId: 104, passives: ['secret-cubone'] }))).toBe(true)
    expect(hasShellArmor(makeMon({ speciesId: 138, passives: ['secret-omanyte'] }))).toBe(true)
    expect(hasWeakArmor(makeMon({ speciesId: 74, passives: ['secret-geodude'] }))).toBe(false)
  })
})

describe('Dig: túnel no grafo', () => {
  const graph: CityGraph = {
    nodes: { a: { x: 0, y: 0 }, b: { x: 0.1, y: 0 }, c: { x: 0.9, y: 0 } },
    adj: { a: ['b'], b: ['a', 'c'], c: ['b'] },
    markers: {},
  }

  it('o túnel vira o caminho mais curto e barato entre os dois pontos', () => {
    const direct = pathDistance(graph, shortestPath(graph, 'a', 'c'))
    const tunneled = graphWithTunnel(graph, ['a', 'c'])
    const viaTunnel = shortestPath(tunneled, 'a', 'c')
    expect(viaTunnel).toEqual(['a', 'c'])
    expect(pathDistance(tunneled, viaTunnel)).toBeCloseTo(DIG_TUNNEL_COST)
    expect(pathDistance(tunneled, viaTunnel)).toBeLessThan(direct)
  })

  it('liga TODOS os pontos da lista entre si (3 nós)', () => {
    const tunneled = graphWithTunnel(graph, ['a', 'b', 'c'])
    // Qualquer par fica barato (custo do túnel), inclusive a↔c.
    expect(pathDistance(tunneled, shortestPath(tunneled, 'a', 'c'))).toBeCloseTo(DIG_TUNNEL_COST)
    expect(pathDistance(tunneled, shortestPath(tunneled, 'b', 'c'))).toBeCloseTo(DIG_TUNNEL_COST)
  })

  it('sem túnel, devolve o próprio grafo', () => {
    expect(graphWithTunnel(graph, null)).toBe(graph)
  })
})
