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
  hasSturdy,
  hasWeakArmor,
  missionAttrMultiplier,
  teamHasFly,
  teamSecretAxisSum,
  teamTravelSpeedMultiplier,
  type MissionSecretCtx,
} from './secretEffects.ts'

const ESCOLTA = getMissionTemplate('escolta')
const PATRULHA = getMissionTemplate('patrulha')
const PALESTRA = getMissionTemplate('palestra')

function ctxOf(team: ReturnType<typeof makeMon>[], template = PALESTRA, runtime = {}): MissionSecretCtx {
  return { team, template, runtime }
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
  it('Rivalidade: +10% com aliado do mesmo gênero', () => {
    const nido = makeMon({ id: 'a', speciesId: 29, gender: 'male', passives: ['secret-nidoran-f'] })
    const ally = makeMon({ id: 'b', gender: 'male' })
    const other = makeMon({ id: 'c', gender: 'female' })
    expect(missionAttrMultiplier(nido, ctxOf([nido, ally]))).toBeCloseTo(1.1)
    expect(missionAttrMultiplier(nido, ctxOf([nido, other]))).toBe(1)
    expect(missionAttrMultiplier(nido, ctxOf([nido]))).toBe(1)
  })

  it('Rock Head: +20% só em escolta', () => {
    const rhy = makeMon({ speciesId: 111, passives: ['secret-rhyhorn'] })
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], ESCOLTA))).toBeCloseTo(1.2)
    expect(missionAttrMultiplier(rhy, ctxOf([rhy], PATRULHA))).toBe(1)
  })

  it('Shell Armor: +50% escolta, −50% patrulha', () => {
    const oma = makeMon({ speciesId: 138, passives: ['secret-omanyte'] })
    expect(missionAttrMultiplier(oma, ctxOf([oma], ESCOLTA))).toBeCloseTo(1.5)
    expect(missionAttrMultiplier(oma, ctxOf([oma], PATRULHA))).toBeCloseTo(0.5)
    expect(missionAttrMultiplier(oma, ctxOf([oma], PALESTRA))).toBe(1)
  })

  it('Battle Armor: +50% só com o flag pendente (defendeu)', () => {
    const cub = makeMon({ id: 'cu', speciesId: 104, passives: ['secret-cubone'] })
    expect(missionAttrMultiplier(cub, ctxOf([cub]))).toBe(1)
    const ctx = ctxOf([cub], PALESTRA, { cu: { battleArmorPending: true } })
    expect(missionAttrMultiplier(cub, ctx)).toBeCloseTo(1.5)
  })

  it('teamSecretAxisSum aplica o multiplicador (e cai no teto)', () => {
    const rhy = makeMon({ speciesId: 111, passives: ['secret-rhyhorn'] }) // efetivo 20/eixo
    expect(teamSecretAxisSum('batalha', ctxOf([rhy], ESCOLTA))).toBeCloseTo(24) // 20 × 1.2
  })
})

describe('viagem e combate', () => {
  it('Sand Rush e Weak Armor aceleram o time', () => {
    const sand = makeMon({ id: 's', speciesId: 27, passives: ['secret-sandshrew'] })
    expect(teamTravelSpeedMultiplier([sand], {})).toBe(1)
    expect(teamTravelSpeedMultiplier([sand], { s: { sandRushStacks: 2 } })).toBeCloseTo(1.5)
    const onix = makeMon({ id: 'o', speciesId: 95, passives: ['secret-onix'] })
    expect(teamTravelSpeedMultiplier([onix], {})).toBe(1)
    expect(teamTravelSpeedMultiplier([onix], { o: { weakArmorActive: true } })).toBeCloseTo(1.5)
  })

  it('teamHasFly: Aerodactyl ou a passiva Fly', () => {
    expect(teamHasFly([makeMon({ speciesId: 142, passives: ['secret-aerodactyl'] })])).toBe(true)
    expect(teamHasFly([makeMon({ passives: ['fly'] })])).toBe(true)
    expect(teamHasFly([makeMon({})])).toBe(false)
  })

  it('Weak Armor dobra o dano recebido', () => {
    expect(combatDamageMultiplier(makeMon({ speciesId: 95, passives: ['secret-onix'] }))).toBe(2)
    expect(combatDamageMultiplier(makeMon({ speciesId: 140, passives: ['secret-kabuto'] }))).toBe(2)
    expect(combatDamageMultiplier(makeMon({}))).toBe(1)
  })

  it('flags por habilidade', () => {
    expect(hasSturdy(makeMon({ speciesId: 74, passives: ['secret-geodude'] }))).toBe(true)
    expect(hasDig(makeMon({ speciesId: 50, passives: ['secret-diglett'] }))).toBe(true)
    expect(hasBattleArmor(makeMon({ speciesId: 104, passives: ['secret-cubone'] }))).toBe(true)
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

  it('sem túnel, devolve o próprio grafo', () => {
    expect(graphWithTunnel(graph, null)).toBe(graph)
  })
})
