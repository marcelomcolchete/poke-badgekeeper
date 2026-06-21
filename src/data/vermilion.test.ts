import { describe, expect, it } from 'vitest'
import { shortestPath } from '../engine/pathfinding.ts'
import { getCity, nodesForCategory } from './cities.ts'

const VERMILION = getCity(2)
const { graph, siteNodes } = VERMILION

describe('Vermilion (cidade 3)', () => {
  it('é elétrico/dragão com os iniciais fixos Pikachu (Nv3) e Magnemite (Nv1)', () => {
    expect(VERMILION.name).toBe('Vermilion')
    expect([VERMILION.primaryType, VERMILION.secondaryType]).toEqual(['electric', 'dragon'])
    expect(VERMILION.starters).toEqual([
      { speciesId: 25, level: 3 },
      { speciesId: 81, level: 1 },
    ])
  })

  it('o ginásio é o ponto "aj"', () => {
    expect(siteNodes.gym).toBe('aj')
  })

  it('todo vizinho aponta para um ponto existente', () => {
    for (const neighbors of Object.values(graph.adj)) {
      for (const n of neighbors) expect(graph.nodes[n], n).toBeDefined()
    }
  })

  it('todas as arestas são simétricas (não há mão única em Vermilion)', () => {
    for (const [id, neighbors] of Object.entries(graph.adj)) {
      for (const n of neighbors) {
        expect(graph.adj[n], `aresta ${id}–${n} deveria ser simétrica`).toContain(id)
      }
    }
  })

  it('marca os pontos de Surf (b, q, v, ai, al) como metadado do mapa', () => {
    expect(graph.surfNodes).toEqual(['b', 'q', 'v', 'ai', 'al'])
  })

  it('todos os sítios de missão existem no grafo', () => {
    const sn = siteNodes
    for (const id of [sn.gym, sn.center, ...sn.mart, ...sn.specialMission, ...sn.houses, ...sn.green]) {
      expect(graph.nodes[id], `sítio ${id} fora do grafo`).toBeDefined()
    }
  })

  it('todo sítio é alcançável do ginásio E tem volta ao ginásio', () => {
    const sites = [
      siteNodes.center,
      ...siteNodes.mart,
      ...siteNodes.specialMission,
      ...siteNodes.houses,
      ...siteNodes.green,
    ]
    for (const node of sites) {
      expect(shortestPath(graph, siteNodes.gym, node).length, `aj→${node}`).toBeGreaterThan(0)
      expect(shortestPath(graph, node, siteNodes.gym).length, `${node}→aj`).toBeGreaterThan(0)
    }
  })

  it('a GRASS g32 é acessível por dois pontos (o, p) e g33 por dois (c, q)', () => {
    expect(graph.adj['o']).toContain('g32')
    expect(graph.adj['p']).toContain('g32')
    expect(graph.adj['c']).toContain('g33')
    expect(graph.adj['q']).toContain('g33')
  })

  it('a Missão Especial tem um ÚNICO ponto (x)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['x'])
    expect(siteNodes.specialMission).toEqual(['x'])
  })

  it('as áreas verdes são de exploração/captura (não hospedam Missão Especial)', () => {
    const special = nodesForCategory(siteNodes, 'special')
    for (const g of siteNodes.green) expect(special).not.toContain(g)
  })
})
