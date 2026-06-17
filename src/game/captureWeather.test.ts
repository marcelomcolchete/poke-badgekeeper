// Integração clima × exploração: o procurador NÃO-surfista que toparia uma poça na rota desvia
// ou espera ela secar, em vez de atravessar — espelha o que as missões já fazem (missionWeather).
// Regressão de bug: antes, advanceSearch ignorava as poças e o explorador passava por cima delas.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { getCity } from '../data/cities.ts'
import { graphWithoutNodes, graphWithoutSurf, shortestPath } from '../engine/pathfinding.ts'
import type { WeatherSchedule } from '../engine/weather.ts'
import { advanceSearch, startSearch } from './captureFlow.ts'

const CERULEAN = getCity(1)
const DRY = graphWithoutSurf(CERULEAN.graph)
const GYM = CERULEAN.siteNodes.gym

/** Schedule com UMA poça num ponto, ativa de [0, endMs]. */
function puddleOn(node: string, eventEndMs = 20_000, endMs = 25_000): WeatherSchedule {
  return {
    rain: [{ startMs: 0, endMs: eventEndMs, puddles: [{ node, startMs: 0, eventEndMs, endMs }] }],
    forecast: { rainChancePercent: 40, rainMmPerHour: 24, potentialRainCount: 2 },
  }
}

/** Estado em Cerulean com um não-surfista e um spot de captura no ponto `node` já surgido. */
function ceruleanSearchTo(node: string) {
  const s = createInitialState(1)
  s.run.cityIndex = 1
  s.roster = [createPokemon({ id: 'p1', speciesId: 19 /* Rattata: sem Surf */, level: 5, rng: createRng(1) })]
  s.captureSpots = [node]
  s.captureSpotSpawnsAtMs = [0]
  s.clock.dayElapsedMs = 0
  return s
}

describe('exploração respeita poças (clima)', () => {
  const path = shortestPath(DRY, GYM, 'o') // rota de ida com pontos intermediários

  it('a rota de teste tem pelo menos um ponto intermediário', () => {
    expect(path.length).toBeGreaterThanOrEqual(3)
  })

  it('poça no próximo ponto sem alternativa → espera; senão desvia (nunca cruza a poça)', () => {
    const blockNode = path[1] as string
    const alt = shortestPath(graphWithoutNodes(DRY, new Set([blockNode])), GYM, 'o')
    const s = ceruleanSearchTo('o')
    startSearch(s, 'p1', 0)
    const search = s.captureSearches[0]!
    const arriveBefore = search.arriveAtMs
    const readyBefore = search.readyAtMs

    s.weather = puddleOn(blockNode)
    advanceSearch(s, search, 0)

    if (alt.length === 0) {
      // Sem rota seca: parado no ponto anterior à poça, com chegada e busca adiadas.
      expect(search.weatherHold).toEqual({ node: path[0], untilMs: 25_000 })
      expect(search.arriveAtMs).toBe(arriveBefore + 25_000)
      expect(search.readyAtMs).toBe(readyBefore + 25_000)
      expect(search.phase).toBe('traveling') // não chegou: continua viajando
    } else {
      // Havia alternativa seca → desviou (não passa pela poça) e adiou a chegada.
      expect(search.reroutePath).toBeDefined()
      expect(search.reroutePath).not.toContain(blockNode)
      expect(search.weatherHold).toBeUndefined()
      expect(search.arriveAtMs).toBeGreaterThanOrEqual(arriveBefore)
    }
  })

  it('poça FORA da rota → exploração intacta', () => {
    const s = ceruleanSearchTo('o')
    startSearch(s, 'p1', 0)
    const search = s.captureSearches[0]!
    const arriveBefore = search.arriveAtMs
    const offRoute = Object.keys(CERULEAN.graph.nodes).find((n) => !path.includes(n) && n !== GYM)!
    s.weather = puddleOn(offRoute)
    advanceSearch(s, search, 0)
    expect(search.weatherHold).toBeUndefined()
    expect(search.reroutePath).toBeUndefined()
    expect(search.arriveAtMs).toBe(arriveBefore)
  })

  it('sem chuva no dia → nada a fazer', () => {
    const s = ceruleanSearchTo('o')
    startSearch(s, 'p1', 0)
    const search = s.captureSearches[0]!
    const arriveBefore = search.arriveAtMs
    advanceSearch(s, search, 0)
    expect(search.weatherHold).toBeUndefined()
    expect(search.arriveAtMs).toBe(arriveBefore)
  })
})
