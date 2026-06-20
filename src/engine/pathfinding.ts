// Deslocamento no grafo da cidade (PLAN §3.1): menor caminho entre dois pontos, o
// comprimento desse caminho (base do tempo de viagem) e a interpolação da posição ao
// longo dele (base da animação dos Pokémon caminhando ponto a ponto). Tudo puro.

import type { MapPos } from '../types/index.ts'
import type { CityGraph } from '../data/types.ts'
import { MAP_ASPECT_H, MAP_ASPECT_W } from './constants.ts'
import { DIG_TUNNEL_COST, SURF_WATER_TIME_MULT } from './balance.ts'
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

/** Chave canônica (ordenada) de uma aresta entre dois pontos — usada nos custos do túnel. */
export function tunnelKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Custo de atravessar a aresta a–b: peso explícito (túnel do Dig) ou distância geométrica. */
function edgeCost(graph: CityGraph, a: string, b: string): number {
  const override = graph.edgeCosts?.[tunnelKey(a, b)]
  if (override !== undefined) return override
  const pa = graph.nodes[a]
  const pb = graph.nodes[b]
  return pa && pb ? segmentLength(pa, pb) : Infinity
}

/**
 * Grafo do dia com o túnel do Dig: liga TODOS os pontos da lista entre si por arestas de
 * custo ínfimo (DIG_TUNNEL_COST), sem mexer no grafo-base — o time atravessa de qualquer um
 * a qualquer outro por baixo da terra. Sem túnel (null/<2 pontos válidos), devolve o grafo.
 */
export function graphWithTunnel(
  graph: CityGraph,
  tunnel: readonly string[] | null | undefined,
): CityGraph {
  if (!tunnel) return graph
  const nodes = [...new Set(tunnel)].filter((id) => graph.nodes[id])
  if (nodes.length < 2) return graph
  const adj: Record<string, string[]> = { ...graph.adj }
  const edgeCosts: Record<string, number> = { ...(graph.edgeCosts ?? {}) }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i] as string
      const b = nodes[j] as string
      adj[a] = adj[a]?.includes(b) ? adj[a] : [...(adj[a] ?? []), b]
      adj[b] = adj[b]?.includes(a) ? adj[b] : [...(adj[b] ?? []), a]
      edgeCosts[tunnelKey(a, b)] = DIG_TUNNEL_COST
    }
  }
  return { ...graph, adj, edgeCosts }
}

/**
 * Grafo do dia com VÁRIOS túneis do Dig (um por Pokémon com a habilidade): aplica cada túnel em
 * sequência. Túneis podem se sobrepor (sem problema). Lista vazia → devolve o grafo intacto.
 */
export function graphWithTunnels(
  graph: CityGraph,
  tunnels: readonly (readonly string[])[] | null | undefined,
): CityGraph {
  if (!tunnels || tunnels.length === 0) return graph
  return tunnels.reduce((g, tunnel) => graphWithTunnel(g, tunnel), graph)
}

/**
 * Grafo SEM os pontos de água (Surf): remove os `surfNodes` da adjacência (tira as arestas de
 * entrada e de saída), deixando-os inalcançáveis. Usado para quem NÃO consegue surfar — o menor
 * caminho jamais cruza a água, e destinos só acessíveis por água ficam inalcançáveis ([]).
 * Sem `surfNodes`, devolve o grafo intacto.
 */
export function graphWithoutSurf(graph: CityGraph): CityGraph {
  const surf = graph.surfNodes
  if (!surf || surf.length === 0) return graph
  const blocked = new Set(surf)
  const adj: Record<string, string[]> = {}
  for (const [id, neighbors] of Object.entries(graph.adj)) {
    adj[id] = blocked.has(id) ? [] : neighbors.filter((n) => !blocked.has(n))
  }
  return { ...graph, adj }
}

/**
 * Grafo SEM os pontos informados (espelha `graphWithoutSurf`): remove os ids de `blocked` da
 * adjacência (entrada e saída), deixando-os inalcançáveis. Usado pelas poças de chuva — quem não
 * surfa não cruza uma poça ativa; o menor caminho a contorna ou (se não houver) devolve []. Conjunto
 * vazio → devolve o grafo intacto.
 */
export function graphWithoutNodes(graph: CityGraph, blocked: ReadonlySet<string>): CityGraph {
  if (blocked.size === 0) return graph
  const adj: Record<string, string[]> = {}
  for (const [id, neighbors] of Object.entries(graph.adj)) {
    adj[id] = blocked.has(id) ? [] : neighbors.filter((n) => !blocked.has(n))
  }
  return { ...graph, adj }
}

/** O caminho passa por algum ponto de água (Surf)? */
export function pathUsesSurf(graph: CityGraph, path: readonly string[]): boolean {
  const surf = graph.surfNodes
  if (!surf || surf.length === 0) return false
  const water = new Set(surf)
  return path.some((id) => water.has(id))
}

/**
 * Comprimento de viagem de um caminho COM o bônus de Surf: igual ao `pathDistance`, mas as
 * arestas incidentes a um ponto de água custam metade (SURF_WATER_TIME_MULT) — +100% de
 * velocidade na água. O caminho (geometria/animação) não muda; só o tempo de viagem cai.
 */
export function surfTravelDistance(graph: CityGraph, path: readonly string[]): number {
  const water = new Set(graph.surfNodes ?? [])
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as string
    const b = path[i] as string
    if (!graph.nodes[a] || !graph.nodes[b]) continue
    const cost = edgeCost(graph, a, b)
    total += water.has(a) || water.has(b) ? cost * SURF_WATER_TIME_MULT : cost
  }
  return total
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

    for (const next of graph.adj[current] ?? []) {
      if (visited.has(next)) continue
      if (!graph.nodes[next]) continue
      const candidate = best + edgeCost(graph, current, next)
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

/** Comprimento total (16:9-corrigido, com custo de túnel) de um caminho já resolvido. */
export function pathDistance(graph: CityGraph, path: readonly string[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as string
    const b = path[i] as string
    if (graph.nodes[a] && graph.nodes[b]) total += edgeCost(graph, a, b)
  }
  return total
}

/**
 * Distância de CAMINHO (não euclidiana) de `from` a cada nó alcançável, reusando shortestPath +
 * pathDistance (com o custo de túnel do Dig já embutido). Nós inalcançáveis ficam de fora.
 */
export function nodeDistancesFrom(graph: CityGraph, from: string): Record<string, number> {
  const out: Record<string, number> = {}
  if (!graph.nodes[from]) return out
  for (const id of Object.keys(graph.nodes)) {
    if (id === from) {
      out[id] = 0
      continue
    }
    const path = shortestPath(graph, from, id)
    if (path.length > 0) out[id] = pathDistance(graph, path)
  }
  return out
}

/**
 * Nó com MAIOR distância de caminho a partir de `from` (destino da fuga da Rocket — Feature B).
 * Restrito a `candidates` quando informado (default = todos os nós, exceto `from`). Ignora
 * inalcançáveis; desempate alfabético. Null se não há candidato alcançável.
 */
export function farthestNodeFrom(
  graph: CityGraph,
  from: string,
  candidates?: readonly string[],
): string | null {
  const dist = nodeDistancesFrom(graph, from)
  const pool = candidates ?? Object.keys(graph.nodes)
  let best: string | null = null
  let bestDist = -1
  for (const id of pool) {
    if (id === from) continue
    const d = dist[id]
    if (d === undefined) continue // inalcançável
    if (d > bestDist || (d === bestDist && best !== null && id < best)) {
      bestDist = d
      best = id
    }
  }
  return best
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
    const idA = path[i - 1] as string
    const idB = path[i] as string
    const a = graph.nodes[idA] as MapPos
    const b = graph.nodes[idB] as MapPos
    // Comprimento do trecho = custo (túnel é ínfimo → atravessa rápido); posição é geométrica.
    const len = edgeCost(graph, idA, idB)
    if (traveled + len >= target || i === path.length - 1) {
      const t = len > 0 ? (target - traveled) / len : 1
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    traveled += len
  }
  return { ...(graph.nodes[path[path.length - 1] as string] as MapPos) }
}
