import { describe, expect, it } from 'vitest'
import { getCity } from '../data/cities.ts'
import {
  graphWithoutSurf,
  pathDistance,
  pathUsesSurf,
  shortestPath,
  surfTravelDistance,
} from './pathfinding.ts'
import { travelRoute } from './missions.ts'
import { makeMon } from './testkit.ts'

const CERULEAN = getCity(1)
const { graph, siteNodes } = CERULEAN
const GYM = siteNodes.gym // 'u'

// O ponto 'm' (Rocket 5.1) só é alcançável cruzando os pontos de água a→n (u…→b→a→n→m).
const WATER_NODE = 'm'

// Surfistas/exploradores de teste (a habilidade vem da posição na linha do Pokémon).
const goldeenSurf = makeMon({ id: 'g', speciesId: 118, secretCount: 1 }) // Goldeen: Surf é a 1ª
const blastoiseSurfPlus = makeMon({ id: 'bl', speciesId: 9, secretCount: 3 }) // Blastoise: Surf+ na 3ª
const horseaSniper = makeMon({ id: 'h', speciesId: 116, secretCount: 3 }) // Horsea: Sniper na 3ª
const articunoFly = makeMon({ id: 'ar', speciesId: 144, secretCount: 1 }) // Articuno: Fly na 1ª
const plain = makeMon({ id: 'x', speciesId: 1 }) // sem linha secreta

describe('graphWithoutSurf', () => {
  it('remove os pontos de água da adjacência (ficam inalcançáveis)', () => {
    const blocked = graphWithoutSurf(graph)
    for (const surf of graph.surfNodes ?? []) {
      expect(blocked.adj[surf]).toEqual([])
      for (const neighbors of Object.values(blocked.adj)) {
        expect(neighbors).not.toContain(surf)
      }
    }
  })

  it("'m' fica inalcançável sem Surf, mas alcançável no grafo completo", () => {
    expect(shortestPath(graphWithoutSurf(graph), GYM, WATER_NODE)).toEqual([])
    expect(shortestPath(graph, GYM, WATER_NODE).length).toBeGreaterThan(0)
  })
})

describe('surfTravelDistance', () => {
  it('é menor que pathDistance quando a rota cruza a água (+100% de velocidade)', () => {
    const path = shortestPath(graph, GYM, WATER_NODE)
    expect(pathUsesSurf(graph, path)).toBe(true)
    expect(surfTravelDistance(graph, path)).toBeLessThan(pathDistance(graph, path))
  })

  it('iguala pathDistance quando a rota NÃO cruza a água', () => {
    const path = shortestPath(graph, GYM, siteNodes.center) // 'p', sem água
    expect(pathUsesSurf(graph, path)).toBe(false)
    expect(surfTravelDistance(graph, path)).toBeCloseTo(pathDistance(graph, path))
  })
})

describe('travelRoute — Surf/Sniper/Fly em Cerulean', () => {
  it('surfista sozinho alcança a água, com flag surfing e tempo reduzido', () => {
    const r = travelRoute(graph, GYM, WATER_NODE, [goldeenSurf])
    expect(r.path.length).toBeGreaterThan(0)
    expect(r.surfing).toBe(true)
    expect(r.flying).toBe(false)
    expect(r.distance).toBeLessThan(pathDistance(graph, r.path))
  })

  it('Surf+ leva o time inteiro pela água', () => {
    const r = travelRoute(graph, GYM, WATER_NODE, [blastoiseSurfPlus, plain])
    expect(r.surfing).toBe(true)
    expect(r.path.length).toBeGreaterThan(0)
  })

  it('sem surfista, a rota para a água é inalcançável (path vazio)', () => {
    const r = travelRoute(graph, GYM, WATER_NODE, [plain])
    expect(r.path).toEqual([])
    expect(r.surfing).toBe(false)
  })

  it('surfista acompanhado (sem Surf+) não consegue surfar', () => {
    const r = travelRoute(graph, GYM, WATER_NODE, [goldeenSurf, plain])
    expect(r.path).toEqual([])
  })

  it('Sniper sozinho atua do ginásio: alcança qualquer ponto com distância 0', () => {
    const r = travelRoute(graph, GYM, WATER_NODE, [horseaSniper])
    expect(r.path).toEqual([GYM, WATER_NODE])
    expect(r.distance).toBe(0)
  })

  it('voador alcança a água em linha reta', () => {
    const r = travelRoute(graph, GYM, WATER_NODE, [articunoFly])
    expect(r.flying).toBe(true)
    expect(r.path).toEqual([GYM, WATER_NODE])
  })

  it('rota normal (sem água) não marca surfing nem bloqueia', () => {
    const r = travelRoute(graph, GYM, siteNodes.center, [goldeenSurf])
    expect(r.surfing).toBe(false)
    expect(r.path.length).toBeGreaterThan(0)
  })
})
