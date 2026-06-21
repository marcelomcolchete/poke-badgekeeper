import { describe, expect, it } from 'vitest'
import { pathDistance, shortestPath } from '../engine/pathfinding.ts'
import { getCity, nodesForCategory } from './cities.ts'

const CERULEAN = getCity(1)
const { graph, siteNodes } = CERULEAN

/** Pares de mão única declarados no CSV de Cerulean. */
const ONE_WAY: [string, string][] = [
  ['k', 't'],
  ['q', 'v'],
]

describe('Cerulean (cidade 2)', () => {
  it('é água/gelo com os iniciais fixos Staryu (Nv3) e Goldeen (Nv1)', () => {
    expect(CERULEAN.name).toBe('Cerulean')
    expect([CERULEAN.primaryType, CERULEAN.secondaryType]).toEqual(['water', 'ice'])
    expect(CERULEAN.starters).toEqual([
      { speciesId: 120, level: 3 },
      { speciesId: 118, level: 1 },
    ])
  })

  it('o ginásio é o ponto "u"', () => {
    expect(siteNodes.gym).toBe('u')
  })

  it('todo vizinho aponta para um ponto existente', () => {
    for (const neighbors of Object.values(graph.adj)) {
      for (const n of neighbors) expect(graph.nodes[n], n).toBeDefined()
    }
  })

  it('arestas de mão única: k→t e q→v existem só no sentido de ida', () => {
    for (const [from, to] of ONE_WAY) {
      expect(graph.adj[from], `${from}→${to}`).toContain(to)
      expect(graph.adj[to], `${to}↛${from}`).not.toContain(from)
    }
  })

  it('todas as demais arestas são simétricas', () => {
    const oneWayKey = new Set(ONE_WAY.map(([a, b]) => `${a}->${b}`))
    for (const [id, neighbors] of Object.entries(graph.adj)) {
      for (const n of neighbors) {
        if (oneWayKey.has(`${id}->${n}`)) continue // mão única: sem volta esperada
        expect(graph.adj[n], `aresta ${id}–${n} deveria ser simétrica`).toContain(id)
      }
    }
  })

  it('marca os pontos de Surf (a, n) como metadado do mapa', () => {
    expect(graph.surfNodes).toEqual(['a', 'n'])
  })

  it('todos os sítios de missão existem no grafo', () => {
    const sn = siteNodes
    for (const id of [sn.gym, sn.center, ...sn.mart, ...sn.specialMission, ...sn.houses, ...sn.green]) {
      expect(graph.nodes[id], `sítio ${id} fora do grafo`).toBeDefined()
    }
  })

  it('todo sítio é alcançável do ginásio E tem volta ao ginásio (apesar das mãos únicas)', () => {
    const sites = [
      siteNodes.center,
      ...siteNodes.mart,
      ...siteNodes.specialMission,
      ...siteNodes.houses,
      ...siteNodes.green,
    ]
    for (const node of sites) {
      expect(shortestPath(graph, siteNodes.gym, node).length, `u→${node}`).toBeGreaterThan(0)
      expect(shortestPath(graph, node, siteNodes.gym).length, `${node}→u`).toBeGreaterThan(0)
    }
  })

  it('a volta NÃO é o reverso da ida quando há mão única (k→t→u é mais curto)', () => {
    // Ida ao spot 3.2 (g32, acesso por 'k'): o longo trajeto que evita t→k (inexistente).
    const out = shortestPath(graph, siteNodes.gym, 'g32')
    const back = shortestPath(graph, 'g32', siteNodes.gym)
    expect(out[out.length - 1]).toBe('g32')
    expect(back[back.length - 1]).toBe('u')
    // A volta usa a aresta de mão única k→t→u — não é só a ida invertida, e é mais curta.
    expect(back).not.toEqual([...out].reverse())
    expect(back).toEqual(['g32', 'k', 't', 'u'])
    expect(pathDistance(graph, back)).toBeLessThan(pathDistance(graph, out))
  })

  it('a Missão Especial tem um ÚNICO ponto (x)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['x'])
    expect(siteNodes.specialMission).toEqual(['x'])
  })

  it("'m' (antiga 2ª Rocket) virou área de exploração/captura", () => {
    expect(nodesForCategory(siteNodes, 'special')).not.toContain('m')
    expect(siteNodes.green).toContain('m')
  })
})
