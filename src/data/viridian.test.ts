import { describe, expect, it } from 'vitest'
import { graphWithoutSurf, shortestPath } from '../engine/pathfinding.ts'
import { getCity, nodesForCategory } from './cities.ts'

const VIRIDIAN = getCity(7)
const { graph, siteNodes } = VIRIDIAN

/** Pares de mão única declarados no chat. */
const ONE_WAY: [string, string][] = [['f', 'j']]

describe('Viridian (cidade 8)', () => {
  it('é ground/normal com os iniciais fixos Nidorino (Nv3) e Meowth (Nv1)', () => {
    expect(VIRIDIAN.name).toBe('Viridian')
    expect([VIRIDIAN.primaryType, VIRIDIAN.secondaryType]).toEqual(['ground', 'normal'])
    expect(VIRIDIAN.starters).toEqual([
      { speciesId: 52, level: 3 },
      { speciesId: 32, level: 1 },
    ])
  })

  it('o ginásio é o ponto "f"', () => {
    expect(siteNodes.gym).toBe('f')
  })

  it('todo vizinho aponta para um ponto existente', () => {
    for (const neighbors of Object.values(graph.adj)) {
      for (const n of neighbors) expect(graph.nodes[n], n).toBeDefined()
    }
  })

  it('aresta de mão única: f→j existe só no sentido de ida', () => {
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

  it('marca o ponto de Surf (v) como metadado do mapa', () => {
    expect(graph.surfNodes).toEqual(['v'])
  })

  it('o GRASS inferior-direito (g33) tem 4 acessos: t, r, u, aa', () => {
    for (const access of ['t', 'r', 'u', 'aa']) {
      expect(graph.adj[access], `${access}–g33`).toContain('g33')
    }
    expect(graph.adj['g33']?.slice().sort()).toEqual(['aa', 'r', 't', 'u'])
  })

  it('todos os sítios de missão existem no grafo', () => {
    const sn = siteNodes
    for (const id of [sn.gym, sn.center, ...sn.mart, ...sn.specialMission, ...sn.houses, ...sn.green]) {
      expect(graph.nodes[id], `sítio ${id} fora do grafo`).toBeDefined()
    }
  })

  it('todo sítio é alcançável do ginásio E tem volta ao ginásio (apesar da mão única / Surf)', () => {
    const sites = [
      siteNodes.center,
      ...siteNodes.mart,
      ...siteNodes.specialMission,
      ...siteNodes.houses,
      ...siteNodes.green,
    ]
    for (const node of sites) {
      expect(shortestPath(graph, siteNodes.gym, node).length, `f→${node}`).toBeGreaterThan(0)
      expect(shortestPath(graph, node, siteNodes.gym).length, `${node}→f`).toBeGreaterThan(0)
    }
  })

  it('a Missão Especial (v) fica atrás d\'água: inalcançável sem Surf, alcançável com Surf', () => {
    const dry = graphWithoutSurf(graph)
    expect(shortestPath(dry, siteNodes.gym, 'v').length, 'f→v sem surf').toBe(0)
    expect(shortestPath(graph, siteNodes.gym, 'v').length, 'f→v com surf').toBeGreaterThan(0)
  })

  it('os demais sítios (não-aquáticos) são alcançáveis mesmo SEM Surf', () => {
    const dry = graphWithoutSurf(graph)
    for (const node of [siteNodes.center, ...siteNodes.mart, ...siteNodes.houses, ...siteNodes.green]) {
      expect(shortestPath(dry, siteNodes.gym, node).length, `f→${node} sem surf`).toBeGreaterThan(0)
    }
  })

  it('a Missão Especial tem um ÚNICO ponto (v)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['v'])
    expect(siteNodes.specialMission).toEqual(['v'])
  })
})
