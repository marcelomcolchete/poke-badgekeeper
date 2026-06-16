// Integração clima × missão: o replaneja/espera de um time NÃO-surfista quando uma poça nasce
// na rota (engine/missionFlow.ts → applyWeatherHold). Determinístico: poça = função de `now`.

import { describe, expect, it } from 'vitest'
import { createInitialState, type MissionInstance } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { getCity } from '../data/cities.ts'
import { graphWithoutNodes, graphWithoutSurf, shortestPath } from '../engine/pathfinding.ts'
import type { WeatherSchedule } from '../engine/weather.ts'
import { applyWeatherHold } from './missionFlow.ts'

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
    forecast: { rainChancePercent: 40, rainMmPerHour: 24, potentialRainCount: 2 },
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
      // marcos posteriores deslocados pela espera (25s) e atraso registrado.
      expect(m.arriveAtMs).toBe(45_000)
      expect(m.resolveAtMs).toBe(55_000)
      expect(m.returnEndsAtMs).toBe(65_000)
      expect(m.weatherDelayMs).toBe(25_000)
    } else {
      // Havia alternativa seca → replanejou em vez de esperar.
      expect(m.reroutePath).toBeDefined()
      expect(m.weatherHold).toBeUndefined()
      expect(m.reroutePath).not.toContain(blockNode)
    }
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
