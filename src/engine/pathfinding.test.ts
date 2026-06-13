import { describe, expect, it } from 'vitest'
import { getCity } from '../data/cities.ts'
import { pathDistance, pointAlongPath, shortestPath } from './pathfinding.ts'

const PEWTER = getCity(0)
const GRAPH = PEWTER.graph

describe('grafo de Pewter', () => {
  it('adjacência é simétrica', () => {
    for (const [id, neighbors] of Object.entries(GRAPH.adj)) {
      for (const n of neighbors) {
        expect(GRAPH.adj[n], `${n} deveria listar ${id}`).toContain(id)
      }
    }
  })

  it('todo vizinho existe como ponto', () => {
    for (const neighbors of Object.values(GRAPH.adj)) {
      for (const n of neighbors) expect(GRAPH.nodes[n]).toBeDefined()
    }
  })

  it('todos os pontos são alcançáveis a partir do ginásio (j)', () => {
    for (const id of Object.keys(GRAPH.nodes)) {
      expect(shortestPath(GRAPH, 'j', id).length, `j→${id}`).toBeGreaterThan(0)
    }
  })

  it('os pontos de sítio existem no grafo (ginásio = j)', () => {
    const sn = PEWTER.siteNodes
    expect(sn.gym).toBe('j')
    for (const id of [sn.gym, sn.center, sn.mart, sn.museum, ...sn.houses, ...sn.green]) {
      expect(GRAPH.nodes[id], id).toBeDefined()
    }
  })
})

describe('shortestPath', () => {
  it('mesmo ponto → caminho de 1 elemento', () => {
    expect(shortestPath(GRAPH, 'j', 'j')).toEqual(['j'])
  })

  it('ponto inexistente → caminho vazio', () => {
    expect(shortestPath(GRAPH, 'j', 'zz')).toEqual([])
  })

  it('exemplo do enunciado: j→q é o caminho único pelo topo', () => {
    expect(shortestPath(GRAPH, 'j', 'q')).toEqual(['j', 'i', 'c', 'd', 'e', 'f', 'k', 'o', 'q'])
  })

  it('é simétrico no conjunto de pontos (ida = volta invertida)', () => {
    const out = shortestPath(GRAPH, 'j', 'm')
    const back = shortestPath(GRAPH, 'm', 'j')
    expect(back).toEqual([...out].reverse())
  })

  it('pontos próximos têm caminho mais curto que pontos distantes', () => {
    const near = pathDistance(GRAPH, shortestPath(GRAPH, 'j', 'd')) // museu (perto)
    const far = pathDistance(GRAPH, shortestPath(GRAPH, 'j', 'q')) // grama 3.6 (longe)
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(near)
  })
})

describe('pointAlongPath', () => {
  const path = shortestPath(GRAPH, 'j', 'q')

  it('frac 0 = origem, frac 1 = destino', () => {
    expect(pointAlongPath(GRAPH, path, 0)).toEqual(GRAPH.nodes.j)
    expect(pointAlongPath(GRAPH, path, 1)).toEqual(GRAPH.nodes.q)
  })

  it('frac intermediário fica dentro da caixa do mapa (0–1)', () => {
    const mid = pointAlongPath(GRAPH, path, 0.5)
    expect(mid.x).toBeGreaterThanOrEqual(0)
    expect(mid.x).toBeLessThanOrEqual(1)
    expect(mid.y).toBeGreaterThanOrEqual(0)
    expect(mid.y).toBeLessThanOrEqual(1)
  })

  it('caminho de 1 ponto → sempre nele', () => {
    expect(pointAlongPath(GRAPH, ['j'], 0.7)).toEqual({ ...GRAPH.nodes.j })
  })
})
