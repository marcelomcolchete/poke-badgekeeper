import { describe, expect, it } from 'vitest'
import { graphWithoutSurf, shortestPath } from '../engine/pathfinding.ts'
import { getCity, nodesForCategory } from './cities.ts'

const CINNABAR = getCity(6)
const { graph, siteNodes } = CINNABAR

describe('Cinnabar (cidade 7)', () => {
  it('é fire/fighting com os iniciais fixos Growlithe (Nv3) e Dratini (Nv1)', () => {
    expect(CINNABAR.name).toBe('Cinnabar')
    expect([CINNABAR.primaryType, CINNABAR.secondaryType]).toEqual(['fire', 'fighting'])
    expect(CINNABAR.starters).toEqual([
      { speciesId: 58, level: 3 },
      { speciesId: 77, level: 1 },
    ])
  })

  it('o ginásio é o ponto "e"', () => {
    expect(siteNodes.gym).toBe('e')
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

  it('marca os 3 pontos de Surf (b, i, k) como metadado do mapa', () => {
    expect(graph.surfNodes).toEqual(['b', 'i', 'k'])
  })

  it('todos os sítios de missão existem no grafo', () => {
    const sn = siteNodes
    for (const id of [sn.gym, sn.center, ...sn.mart, ...sn.specialMission, ...sn.houses, ...sn.green]) {
      expect(graph.nodes[id], `sítio ${id} fora do grafo`).toBeDefined()
    }
  })

  it('todo sítio é alcançável do ginásio E tem volta ao ginásio (com Surf disponível)', () => {
    const sites = [
      siteNodes.center,
      ...siteNodes.mart,
      ...siteNodes.specialMission,
      ...siteNodes.houses,
      ...siteNodes.green,
    ]
    for (const node of sites) {
      expect(shortestPath(graph, siteNodes.gym, node).length, `e→${node}`).toBeGreaterThan(0)
      expect(shortestPath(graph, node, siteNodes.gym).length, `${node}→e`).toBeGreaterThan(0)
    }
  })

  it('o GRASS esquerdo (g32) fica atrás d\'água: inalcançável sem Surf, alcançável com Surf', () => {
    const dry = graphWithoutSurf(graph)
    expect(shortestPath(dry, siteNodes.gym, 'g32').length, 'e→g32 sem surf').toBe(0)
    expect(shortestPath(graph, siteNodes.gym, 'g32').length, 'e→g32 com surf').toBeGreaterThan(0)
  })

  it('os demais sítios (não-aquáticos) são alcançáveis mesmo SEM Surf', () => {
    const dry = graphWithoutSurf(graph)
    for (const node of [siteNodes.center, ...siteNodes.mart, ...siteNodes.specialMission, ...siteNodes.houses, 'g31']) {
      expect(shortestPath(dry, siteNodes.gym, node).length, `e→${node} sem surf`).toBeGreaterThan(0)
    }
  })

  it('a Missão Especial tem um ÚNICO ponto (j)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['j'])
    expect(siteNodes.specialMission).toEqual(['j'])
  })

  it('as 3 casas compartilham a parada "c" (uma entrada em houses)', () => {
    expect(siteNodes.houses).toEqual(['c'])
  })
})
