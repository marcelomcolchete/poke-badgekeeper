import { describe, expect, it } from 'vitest'
import {
  graphWithoutSurf,
  pathDistance,
  pathUsesSurf,
  shortestPath,
  surfTravelDistance,
} from '../engine/pathfinding.ts'
import { getCity, nodesForCategory } from './cities.ts'

const CELADON = getCity(3)
const { graph, siteNodes } = CELADON

describe('Celadon (cidade 4)', () => {
  it('é grama/inseto com os iniciais fixos Gloom (Nv3) e Bulbasaur (Nv1)', () => {
    expect(CELADON.name).toBe('Celadon')
    expect([CELADON.primaryType, CELADON.secondaryType]).toEqual(['grass', 'bug'])
    expect(CELADON.starters).toEqual([
      { speciesId: 44, level: 3 },
      { speciesId: 1, level: 1 },
    ])
  })

  it('o ginásio é o ponto "aa"', () => {
    expect(siteNodes.gym).toBe('aa')
  })

  it('todo vizinho aponta para um ponto existente', () => {
    for (const neighbors of Object.values(graph.adj)) {
      for (const n of neighbors) expect(graph.nodes[n], n).toBeDefined()
    }
  })

  it('todas as arestas são simétricas (não há mão única em Celadon)', () => {
    for (const [id, neighbors] of Object.entries(graph.adj)) {
      for (const n of neighbors) {
        expect(graph.adj[n], `aresta ${id}–${n} deveria ser simétrica`).toContain(id)
      }
    }
  })

  it('marca o ponto de água do atalho (nw) como metadado do mapa', () => {
    expect(graph.surfNodes).toEqual(['nw'])
  })

  it('todos os sítios de missão existem no grafo', () => {
    const sn = siteNodes
    for (const id of [sn.gym, sn.center, ...sn.mart, ...sn.specialMission, ...sn.houses, ...sn.green]) {
      expect(graph.nodes[id], `sítio ${id} fora do grafo`).toBeDefined()
    }
  })

  it('tem DOIS marts (j, n) e a missão de mart pode surgir em qualquer um', () => {
    expect(siteNodes.mart).toEqual(['j', 'n'])
    expect(nodesForCategory(siteNodes, 'mart')).toEqual(['j', 'n'])
  })

  it('tem DUAS Missões Especiais (j = SPEC1, r = SPEC2)', () => {
    expect(siteNodes.specialMission).toEqual(['j', 'r'])
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['j', 'r'])
  })

  it("'j' hospeda mart + Missão Especial com markers distintos por tipo", () => {
    expect(graph.markers['j:mart']).toBeDefined()
    expect(graph.markers['j:specialMission']).toBeDefined()
    expect(graph.markers['j:mart']).not.toEqual(graph.markers['j:specialMission'])
  })

  it('o mart de terra (j) é alcançável sem Surf', () => {
    const dry = graphWithoutSurf(graph)
    expect(shortestPath(dry, siteNodes.gym, 'j').length, 'aa→j sem surf').toBeGreaterThan(0)
  })

  it('o mart central (n) é alcançável a pé; o Surf é o atalho (cruza a água, anda menos)', () => {
    const dry = graphWithoutSurf(graph)
    const dryPath = shortestPath(dry, siteNodes.gym, 'n')
    expect(dryPath.length, 'aa→n a pé (sem surf)').toBeGreaterThan(0) // dá pra chegar a pé
    const surfPath = shortestPath(graph, siteNodes.gym, 'n')
    expect(pathUsesSurf(graph, surfPath), 'o caminho ótimo até n cruza a água').toBe(true)
    expect(
      surfTravelDistance(graph, surfPath),
      'com surf (água por baixo) anda menos que a pé por cima',
    ).toBeLessThan(pathDistance(dry, dryPath))
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
      expect(shortestPath(graph, siteNodes.gym, node).length, `aa→${node}`).toBeGreaterThan(0)
      expect(shortestPath(graph, node, siteNodes.gym).length, `${node}→aa`).toBeGreaterThan(0)
    }
  })

  it('as áreas verdes são de exploração/captura (não hospedam Missão Especial)', () => {
    const special = nodesForCategory(siteNodes, 'special')
    for (const g of siteNodes.green) expect(special).not.toContain(g)
  })
})
