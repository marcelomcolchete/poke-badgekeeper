// Integração clima × missão: o replaneja/espera de um time NÃO-surfista quando uma poça nasce
// na rota (engine/missionFlow.ts → applyWeatherHold). Determinístico: poça = função de `now`.

import { describe, expect, it } from 'vitest'
import { createInitialState, type MissionInstance } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { getCity } from '../data/cities.ts'
import { graphWithoutNodes, graphWithoutSurf, pointAlongPath, shortestPath } from '../engine/pathfinding.ts'
import type { WeatherSchedule } from '../engine/weather.ts'
import { acceptMission, applyWeatherHold } from './missionFlow.ts'
import { DAY_LENGTH_MS } from '../engine/constants.ts'

const CERULEAN = getCity(1)
const DRY = graphWithoutSurf(CERULEAN.graph) // grafo de quem não surfa (sem água)

/** Estado mínimo em Cerulean com um Pokémon que não surfa no roster. */
function ceruleanState() {
  const s = createInitialState(1)
  s.run.cityIndex = 1
  s.roster = [createPokemon({ id: 'p1', speciesId: 19 /* Rattata: sem Surf */, level: 5, rng: createRng(1) })]
  return s
}

/** Schedule com UMA poça num ponto, ativa de [0, dry]. */
function puddleOn(node: string, eventEndMs = 20_000, endMs = 25_000): WeatherSchedule {
  return {
    rain: [{ startMs: 0, endMs: eventEndMs, puddles: [{ node, startMs: 0, eventEndMs, endMs }] }],
    storms: [],
    heat: [],
    snow: [], sand: [], forecast: { rainChancePercent: 40, rainMmPerHour: 24, potentialRainCount: 2, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 0, potentialHeatCount: 0, snowstormChancePercent: 0, potentialSnowstormCount: 0, sandstormChancePercent: 0, potentialSandstormCount: 0 },
  }
}

/** Missão de ida pronta para o tick (no ginásio, frac 0). */
function travelingMission(path: string[]): MissionInstance {
  return {
    id: 'm1',
    templateId: 'patrol',
    requirement: {} as MissionInstance['requirement'],
    node: path[path.length - 1] as string,
    path,
    returnPath: [...path].reverse(),
    spawnAtMs: 0,
    expiresAtMs: 999_999,
    status: 'traveling',
    teamIds: ['p1'],
    acceptedAtMs: 0,
    arriveAtMs: 20_000,
    resolveAtMs: 30_000,
    returnEndsAtMs: 40_000,
    result: null,
    pSuccess: 0.5,
  }
}

describe('applyWeatherHold (replaneja/espera por poça)', () => {
  // Rota de ida do ginásio até 'o' (sem surf): tem pontos intermediários para bloquear.
  const path = shortestPath(DRY, 'u', 'o')

  it('a rota de teste tem pelo menos um ponto intermediário', () => {
    expect(path.length).toBeGreaterThanOrEqual(3)
  })

  it('poça no próximo ponto sem alternativa → espera no ponto anterior e adia os marcos', () => {
    const blockNode = path[1] as string
    // Só vale o cenário de ESPERA se bloquear esse ponto isola o destino (sem rota seca).
    const alt = shortestPath(graphWithoutNodes(DRY, new Set([blockNode])), 'u', 'o')
    const s = ceruleanState()
    s.weather = puddleOn(blockNode)
    const m = travelingMission(path)
    applyWeatherHold(s, m, 0)

    if (alt.length === 0) {
      expect(m.weatherHold).toEqual({ node: path[0], untilMs: 25_000 })
      // ESPERA translada a janela INTEIRA: início (acceptedAtMs) e fim deslocam pela espera (25s).
      expect(m.acceptedAtMs).toBe(25_000)
      expect(m.arriveAtMs).toBe(45_000)
      expect(m.resolveAtMs).toBe(55_000)
      expect(m.returnEndsAtMs).toBe(65_000)
      expect(m.weatherDelayMs).toBe(25_000)
    } else {
      // Havia alternativa seca → replanejou em vez de esperar.
      expect(m.reroutePath).toBeDefined()
      expect(m.weatherHold).toBeUndefined()
      expect(m.reroutePath).not.toContain(blockNode)
      // DESVIO só estica o fim: o início (acceptedAtMs) NÃO se move (sprite segue andando).
      expect(m.acceptedAtMs).toBe(0)
    }
  })

  it('espera: ao retomar, o progresso aponta para o ponto congelado (sem teleporte)', () => {
    const blockNode = path[1] as string
    const alt = shortestPath(graphWithoutNodes(DRY, new Set([blockNode])), 'u', 'o')
    if (alt.length > 0) return // o cenário de teleporte só existe quando há ESPERA
    const s = ceruleanState()
    s.weather = puddleOn(blockNode)
    const m = travelingMission(path)
    applyWeatherHold(s, m, 0)

    // Posição congelada durante a espera = nó onde ficou parado.
    const heldNode = m.weatherHold!.node
    const frozen = CERULEAN.graph.nodes[heldNode]!
    // Posição no 1º instante após a poça secar (mesma fórmula do renderer).
    const untilMs = m.weatherHold!.untilMs
    const frac = (untilMs - (m.acceptedAtMs ?? 0)) / ((m.arriveAtMs ?? 0) - (m.acceptedAtMs ?? 0))
    const resumed = pointAlongPath(CERULEAN.graph, m.reroutePath ?? m.path, frac)
    // Sem o fix, frac seria ~0,55 (numerador acumula a espera) → o sprite saltava à frente.
    expect(resumed.x).toBeCloseTo(frozen.x, 5)
    expect(resumed.y).toBeCloseTo(frozen.y, 5)
  })

  it('poça FORA da rota → missão intacta', () => {
    const s = ceruleanState()
    // 'v' é um beco (vizinho do ginásio) que não está na rota até 'o'.
    const offRoute = Object.keys(CERULEAN.graph.nodes).find((n) => !path.includes(n) && n !== 'u')!
    s.weather = puddleOn(offRoute)
    const m = travelingMission(path)
    applyWeatherHold(s, m, 0)
    expect(m.weatherHold).toBeUndefined()
    expect(m.reroutePath).toBeUndefined()
    expect(m.arriveAtMs).toBe(20_000)
  })

  it('time voando ignora poças', () => {
    const s = ceruleanState()
    s.weather = puddleOn(path[1] as string)
    const m = travelingMission(path)
    m.flying = true
    applyWeatherHold(s, m, 0)
    expect(m.weatherHold).toBeUndefined()
    expect(m.reroutePath).toBeUndefined()
    expect(m.arriveAtMs).toBe(20_000)
  })

  it('sem chuva no dia → nada a fazer', () => {
    const s = ceruleanState() // weather vazio por padrão
    const m = travelingMission(path)
    applyWeatherHold(s, m, 0)
    expect(m.weatherHold).toBeUndefined()
    expect(m.arriveAtMs).toBe(20_000)
  })
})

describe('Swift Swim acelera a ida da missão sob chuva', () => {
  // Chuva cobrindo o dia inteiro, sem poças (não interfere com desvio/espera).
  const rainAllDay: WeatherSchedule = {
    rain: [{ startMs: 0, endMs: DAY_LENGTH_MS, puddles: [] }],
    storms: [],
    heat: [],
    snow: [], sand: [], forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 0, potentialHeatCount: 0, snowstormChancePercent: 0, potentialSnowstormCount: 0, sandstormChancePercent: 0, potentialSandstormCount: 0 },
  }
  // Destino alcançável a pé (sem surf) a partir do ginásio de Cerulean.
  const gym = CERULEAN.siteNodes.gym
  const dest = Object.keys(CERULEAN.graph.nodes).find(
    (n) => shortestPath(DRY, gym, n).length >= 3,
  )!

  /** Estado pronto para despachar UMA missão 'available' em `dest`, com o roster dado. */
  // Omanyte (138) par = ['sa-swift-swim','sa-shell-armor']; Swift Swim no slot 0.
  function dispatchState(hasSwiftSwim: boolean) {
    const s = createInitialState(1)
    s.run.cityIndex = 1
    s.weather = rainAllDay
    const mon = createPokemon({ id: 'p1', speciesId: 138 /* Omanyte */, level: 10, rng: createRng(1) })
    mon.secretPicks = hasSwiftSwim ? [{ slot: 0 as const, level: 1 as const }] : []
    mon.status = 'idle' // acceptMission só despacha quem está idle
    s.roster = [mon]
    s.missions = [
      {
        id: 'm1',
        templateId: 'patrulha',
        requirement: {} as MissionInstance['requirement'],
        node: dest,
        path: [],
        returnPath: [],
        spawnAtMs: 0,
        expiresAtMs: 999_999,
        status: 'available',
        teamIds: [],
        acceptedAtMs: null,
        arriveAtMs: null,
        resolveAtMs: null,
        returnEndsAtMs: null,
        result: null,
        pSuccess: 0,
      },
    ]
    return s
  }

  it('time com Swift Swim chega antes do que sem, sob chuva', () => {
    const withSS = dispatchState(true)
    acceptMission(withSS, 'm1', ['p1'])
    const plain = dispatchState(false)
    acceptMission(plain, 'm1', ['p1'])

    const swiftArrive = withSS.missions[0]!.arriveAtMs!
    const plainArrive = plain.missions[0]!.arriveAtMs!
    expect(swiftArrive).toBeGreaterThan(0)
    expect(swiftArrive).toBeLessThan(plainArrive)
    // Chuva o dia todo → ×3 → ~1/3 do tempo de ida.
    expect(swiftArrive).toBeCloseTo(plainArrive / 3, 0)
  })
})
