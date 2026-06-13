// Deslocamento no grafo da cidade (PLAN §3.1): menor caminho entre dois pontos, o
// comprimento desse caminho (base do tempo de viagem) e a interpolação da posição ao
// longo dele (base da animação dos Pokémon caminhando ponto a ponto). Tudo puro.

import type { MapPos } from '../types/index.ts'
import type { CityGraph } from '../data/types.ts'
import { MAP_ASPECT_H, MAP_ASPECT_W } from './constants.ts'
import { clamp } from './math.ts'

/**
 * Distância entre dois pontos corrigida pela proporção 16:9 da arte — assim um passo
 * horizontal "vale" o tanto de tela que ocupa (a animação fica em velocidade constante).
 */
export function segmentLength(a: MapPos, b: MapPos): number {
  const dx = (a.x - b.x) * MAP_ASPECT_W
  const dy = (a.y - b.y) * MAP_ASPECT_H
  return Math.hypot(dx, dy)
}

/**
 * Menor caminho de `from` até `to` (lista de ids, inclusive as pontas), por Dijkstra com
 * peso = distância euclidiana entre pontos. Desempate alfabético → resultado determinístico.
 * Devolve [] se algum ponto não existe ou se não há caminho.
 */
export function shortestPath(graph: CityGraph, from: string, to: string): string[] {
  if (!graph.nodes[from] || !graph.nodes[to]) return []
  if (from === to) return [from]

  const dist: Record<string, number> = { [from]: 0 }
  const prev: Record<string, string> = {}
  const visited = new Set<string>()

  for (;;) {
    // Próximo não-visitado de menor distância (desempate alfabético).
    let current: string | null = null
    let best = Infinity
    for (const id of Object.keys(dist)) {
      if (visited.has(id)) continue
      const d = dist[id] as number
      if (d < best || (d === best && current !== null && id < current)) {
        best = d
        current = id
      }
    }
    if (current === null) return [] // inalcançável
    if (current === to) break
    visited.add(current)

    const here = graph.nodes[current] as MapPos
    for (const next of graph.adj[current] ?? []) {
      if (visited.has(next)) continue
      const nextPos = graph.nodes[next]
      if (!nextPos) continue
      const candidate = best + segmentLength(here, nextPos)
      if (candidate < (dist[next] ?? Infinity)) {
        dist[next] = candidate
        prev[next] = current
      }
    }
  }

  const path = [to]
  let cursor = to
  while (cursor !== from) {
    cursor = prev[cursor] as string
    path.unshift(cursor)
  }
  return path
}

/** Comprimento total (16:9-corrigido) de um caminho já resolvido. */
export function pathDistance(graph: CityGraph, path: readonly string[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const a = graph.nodes[path[i - 1] as string]
    const b = graph.nodes[path[i] as string]
    if (a && b) total += segmentLength(a, b)
  }
  return total
}

/**
 * Posição a `frac∈[0,1]` do comprimento total do caminho (0 = origem, 1 = destino).
 * Velocidade constante: o tempo é distribuído proporcionalmente ao tamanho de cada trecho.
 */
export function pointAlongPath(graph: CityGraph, path: readonly string[], frac: number): MapPos {
  if (path.length === 0) return { x: 0, y: 0 }
  const first = graph.nodes[path[0] as string] as MapPos
  const last = graph.nodes[path[path.length - 1] as string] as MapPos
  if (path.length === 1) return { ...first }
  // Pontas exatas (evita drift de ponto flutuante na interpolação).
  if (frac <= 0) return { ...first }
  if (frac >= 1) return { ...last }

  const total = pathDistance(graph, path)
  if (total <= 0) return { ...first }

  const target = clamp(frac, 0, 1) * total
  let traveled = 0
  for (let i = 1; i < path.length; i++) {
    const a = graph.nodes[path[i - 1] as string] as MapPos
    const b = graph.nodes[path[i] as string] as MapPos
    const len = segmentLength(a, b)
    if (traveled + len >= target || i === path.length - 1) {
      const t = len > 0 ? (target - traveled) / len : 1
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    traveled += len
  }
  return { ...(graph.nodes[path[path.length - 1] as string] as MapPos) }
}
