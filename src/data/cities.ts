// As 8 cidades de Kanto (PLAN §3.1 / §4.7 / §4.8).
// Cada cidade aponta para sua arte top-down (/maps/kanto/N.png, 1920×1080) e define
// o GRAFO de deslocamento (pontos a–s + adjacência) e o mapeamento sítio→ponto: onde
// cada evento/missão surge. Os Pokémon caminham do ginásio até a missão e de volta
// pelo menor caminho; o tempo de viagem sai daí. Só Pewter está calibrada; as demais
// herdam o layout de Pewter (placeholder) até a arte ser anotada.

import type { MapPos, MissionCategory, SiteKind } from '../types/index.ts'
import { CATEGORY_SITE } from '../types/index.ts'
import type { CityData, CityGraph, CitySiteNodes } from './types.ts'

// Pewter (1.png): grafo calibrado sobre a arte anotada. 19 pontos (a–s); o ginásio é 'j'.
// Posições normalizadas (0–1) — estimadas da arte e refináveis com o DEV picker do CityMap.
const PEWTER_NODES: Record<string, MapPos> = {
  a: { x: 0.555, y: 0.207 },
  b: { x: 0.672, y: 0.208 },
  c: { x: 0.307, y: 0.282 },
  d: { x: 0.423, y: 0.282 },
  e: { x: 0.492, y: 0.282 },
  f: { x: 0.492, y: 0.364 },
  g: { x: 0.615, y: 0.364 },
  h: { x: 0.672, y: 0.364 },
  i: { x: 0.305, y: 0.468 },
  j: { x: 0.4, y: 0.468 },
  k: { x: 0.497, y: 0.507 },
  l: { x: 0.555, y: 0.507 },
  m: { x: 0.672, y: 0.507 },
  n: { x: 0.423, y: 0.657 },
  o: { x: 0.493, y: 0.657 },
  p: { x: 0.327, y: 0.752 },
  q: { x: 0.493, y: 0.752 },
  r: { x: 0.594, y: 0.752 },
  s: { x: 0.672, y: 0.752 },
}

// Arestas NÃO-direcionadas (o '-' liga os dois sentidos). Derivadas da anotação do mapa;
// 'm' liga a 'l' (não a 'i', que fica na ponta oposta), confirmando o exemplo j→…→q.
const PEWTER_EDGES: [string, string][] = [
  ['a', 'b'],
  ['b', 'h'],
  ['c', 'd'],
  ['c', 'i'],
  ['d', 'e'],
  ['e', 'f'],
  ['f', 'g'],
  ['f', 'k'],
  ['g', 'h'],
  ['h', 'm'],
  ['i', 'j'],
  ['k', 'l'],
  ['k', 'o'],
  ['l', 'm'],
  ['m', 's'],
  ['n', 'o'],
  ['o', 'q'],
  ['p', 'q'],
  ['q', 'r'],
  ['r', 's'],
]

/** Monta a adjacência simétrica a partir da lista de arestas (vizinhos ordenados). */
function buildAdjacency(
  nodes: Record<string, MapPos>,
  edges: [string, string][],
): Record<string, string[]> {
  const adj: Record<string, string[]> = {}
  for (const id of Object.keys(nodes)) adj[id] = []
  for (const [a, b] of edges) {
    if (!adj[a]?.includes(b)) adj[a]?.push(b)
    if (!adj[b]?.includes(a)) adj[b]?.push(a)
  }
  for (const id of Object.keys(adj)) adj[id]?.sort()
  return adj
}

const PEWTER_GRAPH: CityGraph = {
  nodes: PEWTER_NODES,
  adj: buildAdjacency(PEWTER_NODES, PEWTER_EDGES),
}

// Sítio → ponto do grafo (números da imagem anotada).
const PEWTER_SITE_NODES: CitySiteNodes = {
  gym: 'j', // 1 (ginásio)
  center: 'n', // 2 (centro)
  mart: 'l', // 4 (mart)
  museum: 'd', // 5 (museu)
  houses: ['p', 'a', 'g'], // 6.1, 6.2, 6.3
  green: ['c', 'b', 'm', 'r', 'q'], // 3.1, 3.2, 3.4, 3.5, 3.6
}

interface CitySeed {
  name: string
  primaryType: CityData['primaryType']
  starterSpeciesId: number
  difficultyFactor: number
  graph?: CityGraph
  siteNodes?: CitySiteNodes
  museumMissionId?: string
}

// Inicial = um Pokémon não-evoluído do tipo primário (nível 3), à la Onix em Pewter.
const SEEDS: CitySeed[] = [
  {
    name: 'Pewter',
    primaryType: 'rock',
    starterSpeciesId: 95,
    difficultyFactor: 1.0,
    graph: PEWTER_GRAPH,
    siteNodes: PEWTER_SITE_NODES,
    museumMissionId: 'museum-fossil',
  },
  { name: 'Cerulean', primaryType: 'water', starterSpeciesId: 120, difficultyFactor: 1.1 },
  { name: 'Vermilion', primaryType: 'electric', starterSpeciesId: 100, difficultyFactor: 1.25 },
  { name: 'Celadon', primaryType: 'grass', starterSpeciesId: 43, difficultyFactor: 1.4 },
  { name: 'Fuchsia', primaryType: 'poison', starterSpeciesId: 23, difficultyFactor: 1.5 },
  { name: 'Saffron', primaryType: 'psychic', starterSpeciesId: 63, difficultyFactor: 1.65 },
  { name: 'Cinnabar', primaryType: 'fire', starterSpeciesId: 58, difficultyFactor: 1.8 },
  { name: 'Viridian', primaryType: 'ground', starterSpeciesId: 27, difficultyFactor: 2.0 },
]

// Todos os mapas têm o mesmo tamanho (16:9).
const MAP_W = 1920
const MAP_H = 1080

export const CITIES: CityData[] = SEEDS.map((s, index) => ({
  index,
  name: s.name,
  primaryType: s.primaryType,
  starterSpeciesId: s.starterSpeciesId,
  mapImage: `/maps/kanto/${index + 1}.png`,
  coverImage: `/maps/kanto/${index + 1}_capa.png`,
  mapW: MAP_W,
  mapH: MAP_H,
  difficultyFactor: s.difficultyFactor,
  // Cidades não calibradas herdam o layout de Pewter (placeholder).
  graph: s.graph ?? PEWTER_GRAPH,
  siteNodes: s.siteNodes ?? PEWTER_SITE_NODES,
  museumMissionId: s.museumMissionId,
}))

export function getCity(index: number): CityData {
  const city = CITIES[index]
  if (!city) throw new Error(`Cidade ${index} não encontrada`)
  return city
}

/** Posição normalizada de um ponto do grafo (erro se o ponto não existir). */
export function nodePos(graph: CityGraph, id: string): MapPos {
  const pos = graph.nodes[id]
  if (!pos) throw new Error(`Ponto ${id} não existe no grafo`)
  return pos
}

/** Pontos onde uma categoria de missão pode surgir, nesta cidade. */
export function nodesForCategory(siteNodes: CitySiteNodes, category: MissionCategory): string[] {
  return nodesByKind(siteNodes, CATEGORY_SITE[category])
}

/** Pontos de um dado tipo de sítio (sítios únicos viram lista de 1 elemento). */
export function nodesByKind(siteNodes: CitySiteNodes, kind: SiteKind): string[] {
  switch (kind) {
    case 'gym':
      return [siteNodes.gym]
    case 'center':
      return [siteNodes.center]
    case 'mart':
      return [siteNodes.mart]
    case 'museum':
      return [siteNodes.museum]
    case 'house':
      return siteNodes.houses
    case 'green':
      return siteNodes.green
  }
}
