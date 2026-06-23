import { describe, expect, it } from 'vitest'
import { pathDistance, shortestPath } from '../engine/pathfinding.ts'
import { getCity, nodesForCategory } from './cities.ts'

const FUCHSIA = getCity(4)
const { graph, siteNodes } = FUCHSIA

/** Pares de mão única declarados no chat (cidade-loop). */
const ONE_WAY: [string, string][] = [
  ['s', 'r'],
  ['v', 'x'],
]

describe('Fuchsia (cidade 5)', () => {
  it('é poison/dragon com os iniciais fixos Koffing (Nv3) e Zubat (Nv1)', () => {
    expect(FUCHSIA.name).toBe('Fuchsia')
    expect([FUCHSIA.primaryType, FUCHSIA.secondaryType]).toEqual(['poison', 'dragon'])
    expect(FUCHSIA.starters).toEqual([
      { speciesId: 109, level: 3 },
      { speciesId: 41, level: 1 },
    ])
  })

  it('o ginásio é o ponto "s"', () => {
    expect(siteNodes.gym).toBe('s')
  })

  it('todo vizinho aponta para um ponto existente', () => {
    for (const neighbors of Object.values(graph.adj)) {
      for (const n of neighbors) expect(graph.nodes[n], n).toBeDefined()
    }
  })

  it('arestas de mão única: s→r e v→x existem só no sentido de ida', () => {
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

  it('não tem pontos de Surf (todos os círculos são de terra)', () => {
    expect(graph.surfNodes).toBeUndefined()
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
      expect(shortestPath(graph, siteNodes.gym, node).length, `s→${node}`).toBeGreaterThan(0)
      expect(shortestPath(graph, node, siteNodes.gym).length, `${node}→s`).toBeGreaterThan(0)
    }
  })

  it('a volta NÃO é o reverso da ida quando há mão única (v→x corta o corredor)', () => {
    // Ida ao cluster direito (x, acesso só por v→x): o corredor s–t–u–v→x.
    const out = shortestPath(graph, siteNodes.gym, 'x')
    const back = shortestPath(graph, 'x', siteNodes.gym)
    expect(out[out.length - 1]).toBe('x')
    expect(back[back.length - 1]).toBe('s')
    // A volta dá a volta pelo topo (x não retorna por v) — não é só a ida invertida.
    expect(back).not.toEqual([...out].reverse())
    expect(back).not.toContain('v') // x↛v: a volta nunca passa por 'v'
  })

  it('o ginásio fecha em loop: s→r só de ida, volta por aa→ab→s', () => {
    const out = shortestPath(graph, 's', 'r')
    const back = shortestPath(graph, 'r', 's')
    expect(out).toEqual(['s', 'r']) // ida direta pela mão única
    expect(back).toEqual(['r', 'aa', 'ab', 's']) // volta pelo loop
    expect(pathDistance(graph, back)).toBeGreaterThan(pathDistance(graph, out))
  })

  it('a Missão Especial tem um ÚNICO ponto (d)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['d'])
    expect(siteNodes.specialMission).toEqual(['d'])
  })

  it('tem 4 casas (t, u, o, p) e 4 áreas de captura (g31..g34)', () => {
    expect(siteNodes.houses).toEqual(['t', 'u', 'o', 'p'])
    expect(siteNodes.green).toEqual(['g31', 'g32', 'g33', 'g34'])
  })
})
