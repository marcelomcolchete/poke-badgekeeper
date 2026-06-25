import { describe, expect, it } from 'vitest'
import { shortestPath } from '../engine/pathfinding.ts'
import { getCity, nodesForCategory } from './cities.ts'

const SAFFRON = getCity(5)
const { graph, siteNodes } = SAFFRON

describe('Saffron (cidade 6)', () => {
  it('é psychic/ghost com os iniciais fixos Abra (Nv3) e Gastly (Nv1)', () => {
    expect(SAFFRON.name).toBe('Saffron')
    expect([SAFFRON.primaryType, SAFFRON.secondaryType]).toEqual(['psychic', 'ghost'])
    expect(SAFFRON.starters).toEqual([
      { speciesId: 63, level: 3 },
      { speciesId: 79, level: 1 },
    ])
  })

  it('o ginásio é o ponto "d"', () => {
    expect(siteNodes.gym).toBe('d')
  })

  it('todo vizinho aponta para um ponto existente', () => {
    for (const neighbors of Object.values(graph.adj)) {
      for (const n of neighbors) expect(graph.nodes[n], n).toBeDefined()
    }
  })

  it('todas as arestas são simétricas (sem mão única)', () => {
    for (const [id, neighbors] of Object.entries(graph.adj)) {
      for (const n of neighbors) {
        expect(graph.adj[n], `aresta ${id}–${n} deveria ser simétrica`).toContain(id)
      }
    }
  })

  it('não tem pontos de Surf (todos os círculos são de terra)', () => {
    expect(graph.surfNodes).toBeUndefined()
  })

  it('o 2º prédio GYM (→C) virou casa; o ginásio oficial é o prédio direito (→D)', () => {
    expect(siteNodes.gym).toBe('d')
    expect(siteNodes.houses).toContain('c')
    expect(siteNodes.gym).not.toBe('c')
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
      expect(shortestPath(graph, siteNodes.gym, node).length, `d→${node}`).toBeGreaterThan(0)
      expect(shortestPath(graph, node, siteNodes.gym).length, `${node}→d`).toBeGreaterThan(0)
    }
  })

  it('a Missão Especial tem um ÚNICO ponto (u)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['u'])
    expect(siteNodes.specialMission).toEqual(['u'])
  })

  it('tem 10 casas (inclui o 2º gym "c") e 3 áreas de captura (g31..g33)', () => {
    expect(siteNodes.houses).toEqual(['c', 'f', 'k', 'n', 's', 't', 'v', 'x', 'ab', 'ac'])
    expect(siteNodes.green).toEqual(['g31', 'g32', 'g33'])
  })
})
