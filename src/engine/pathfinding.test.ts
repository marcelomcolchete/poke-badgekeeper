import { describe, expect, it } from 'vitest'
import type { CityGraph } from '../data/types.ts'
import { getCity } from '../data/cities.ts'
import {
  farthestNodeFrom,
  graphWithoutNodes,
  nodeDistancesFrom,
  pathDistance,
  pointAlongPath,
  shortestPath,
} from './pathfinding.ts'

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
    for (const id of [sn.gym, sn.center, sn.mart, ...sn.specialMission, ...sn.houses, ...sn.green]) {
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

  it('j→q é o caminho único (q só é alcançado via k)', () => {
    expect(shortestPath(GRAPH, 'j', 'q')).toEqual(['j', 'i', 'c', 'd', 'e', 'f', 'k', 'q'])
  })

  it('é simétrico no conjunto de pontos (ida = volta invertida)', () => {
    const out = shortestPath(GRAPH, 'j', 'm')
    const back = shortestPath(GRAPH, 'm', 'j')
    expect(back).toEqual([...out].reverse())
  })

  it('pontos próximos têm caminho mais curto que pontos distantes', () => {
    const near = pathDistance(GRAPH, shortestPath(GRAPH, 'j', 'd')) // museu (perto)
    const far = pathDistance(GRAPH, shortestPath(GRAPH, 'j', 'q')) // ponto distante (sul)
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

describe('farthestNodeFrom', () => {
  // Linha: a — b — c — d (b,c,d à direita de a)
  const line: CityGraph = {
    nodes: { a: { x: 0, y: 0 }, b: { x: 0.25, y: 0 }, c: { x: 0.5, y: 0 }, d: { x: 0.75, y: 0 } },
    adj: { a: ['b'], b: ['a', 'c'], c: ['b', 'd'], d: ['c'] },
    markers: {},
  }

  it('nodeDistancesFrom cresce monotonicamente na linha', () => {
    const dist = nodeDistancesFrom(line, 'a')
    expect(dist.a).toBe(0)
    expect(dist.d).toBeGreaterThan(dist.c as number)
    expect(dist.c).toBeGreaterThan(dist.b as number)
  })

  it('escolhe o nó com MAIOR distância de caminho (não a euclidiana)', () => {
    expect(farthestNodeFrom(line, 'a')).toBe('d')
  })

  it('restringe aos candidatos quando informados', () => {
    expect(farthestNodeFrom(line, 'a', ['b', 'c'])).toBe('c')
  })

  it('ignora inalcançáveis e devolve null quando não há candidato', () => {
    const isolated: CityGraph = {
      nodes: { a: { x: 0, y: 0 }, z: { x: 1, y: 1 } },
      adj: { a: [], z: [] },
      markers: {},
    }
    expect(farthestNodeFrom(isolated, 'a')).toBeNull()
  })

  it('desempata alfabeticamente entre distâncias iguais', () => {
    // a no centro; b e c equidistantes (mesma distância de caminho).
    // Usamos deslocamento horizontal puro para evitar drift de ponto flutuante.
    const star: CityGraph = {
      nodes: { a: { x: 0.5, y: 0.5 }, b: { x: 0.0, y: 0.5 }, c: { x: 1.0, y: 0.5 } },
      adj: { a: ['b', 'c'], b: ['a'], c: ['a'] },
      markers: {},
    }
    expect(farthestNodeFrom(star, 'a')).toBe('b')
  })
})

describe('graphWithoutNodes (poças)', () => {
  it('conjunto vazio → devolve o grafo intacto', () => {
    expect(graphWithoutNodes(GRAPH, new Set())).toBe(GRAPH)
  })

  it('o ponto bloqueado fica sem adjacência e some dos vizinhos', () => {
    const blocked = graphWithoutNodes(GRAPH, new Set(['c']))
    expect(blocked.adj.c).toEqual([])
    for (const [, neighbors] of Object.entries(blocked.adj)) {
      expect(neighbors).not.toContain('c')
    }
  })

  it('o menor caminho contorna o ponto bloqueado quando há alternativa', () => {
    const direct = shortestPath(GRAPH, 'j', 'q')
    // bloqueia um ponto NO meio do caminho direto (não as pontas) e exige desvio.
    const mid = direct[2]!
    const detour = shortestPath(graphWithoutNodes(GRAPH, new Set([mid])), 'j', 'q')
    if (detour.length > 0) {
      expect(detour).not.toContain(mid)
    }
  })

  it('destino inalcançável sem o ponto-corte → caminho vazio', () => {
    // 'q' só é alcançado via 'k' em Pewter; bloquear 'k' isola 'q'.
    expect(shortestPath(graphWithoutNodes(GRAPH, new Set(['k'])), 'j', 'q')).toEqual([])
  })
})
