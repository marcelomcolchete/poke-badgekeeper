// As 8 cidades de Kanto (PLAN §3.1 / §4.7 / §4.8).
// Cada cidade aponta para sua arte top-down (/maps/kanto/N.png, 1920×1080) e define
// o GRAFO de deslocamento (pontos a–s + adjacência) e o mapeamento sítio→ponto: onde
// cada evento/missão surge. Os Pokémon caminham do ginásio até a missão e de volta
// pelo menor caminho; o tempo de viagem sai daí. Só Pewter está calibrada; as demais
// herdam o layout de Pewter (placeholder) até a arte ser anotada.

import type { MapPos, MissionCategory, SiteKind, TrainerId } from '../types/index.ts'
import { CATEGORY_SITE, TRAINER_IDS } from '../types/index.ts'
import type { CityData, CityGraph, CitySiteNodes } from './types.ts'

// Classes de treinador que invadem o ginásio (PLAN §4.4). Pewter está calibrada com as 9
// classes; as demais cidades REPLICAM essa lista por enquanto, até terem elenco próprio.
const PEWTER_TRAINERS: TrainerId[] = [...TRAINER_IDS]

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

// Âncoras de EXIBIÇÃO (PLAN §3.1): onde o popup/marcador aparece SOBRE a arte — os
// "números" da imagem anotada (3.1, 6.2, o "1" do ginásio…), distintos do ponto de
// PARADA (a letra para onde o Pokémon caminha). Ex.: a captura 3.6 aparece no fim do
// caminho de baixo, mas o time só desce até o ponto 'q'. Estimadas da arte e refináveis
// com o DEV picker do CityMap. Nós sem entrada usam o próprio ponto do grafo.
const PEWTER_MARKERS: Record<string, MapPos> = {
  j: { x: 0.401, y: 0.4 }, // 1 — ginásio (sobre o prédio)
  n: { x: 0.423, y: 0.578 }, // 2 — centro
  l: { x: 0.543, y: 0.435 }, // 4 — mart
  d: { x: 0.423, y: 0.198 }, // 5 — museu
  p: { x: 0.327, y: 0.685 }, // 6.1 — casa
  a: { x: 0.518, y: 0.197 }, // 6.2 — casa
  g: { x: 0.612, y: 0.298 }, // 6.3 — casa
  c: { x: 0.305, y: 0.193 }, // 3.1 — área verde
  b: { x: 0.628, y: 0.193 }, // 3.2 — área verde
  m: { x: 0.727, y: 0.542 }, // 3.4 — área verde
  r: { x: 0.594, y: 0.676 }, // 3.5 — horta
  q: { x: 0.477, y: 0.878 }, // 3.6 — área verde (fim do caminho de baixo)
}

const PEWTER_GRAPH: CityGraph = {
  nodes: PEWTER_NODES,
  adj: buildAdjacency(PEWTER_NODES, PEWTER_EDGES),
  markers: PEWTER_MARKERS,
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
  secondaryType: CityData['secondaryType']
  /** Iniciais fixos: [Nv 3, Nv 1]. */
  starters: CityData['starters']
  graph?: CityGraph
  siteNodes?: CitySiteNodes
  museumMissionId?: string
}

// Tipos do ginásio fixos (primário + secundário) e DOIS iniciais fixos por cidade
// (um Nv 3 + um Nv 1). A UI deixa o jogador escolher entre 3 versões aleatórias de cada.
// Só Pewter está calibrada/jogável; as demais são apenas configuração por ora.
const SEEDS: CitySeed[] = [
  {
    name: 'Pewter',
    primaryType: 'rock',
    secondaryType: 'ground',
    starters: [
      { speciesId: 95, level: 3 }, // Onix
      { speciesId: 74, level: 1 }, // Geodude
    ],
    graph: PEWTER_GRAPH,
    siteNodes: PEWTER_SITE_NODES,
    museumMissionId: 'museu',
  },
  {
    name: 'Cerulean',
    primaryType: 'water',
    secondaryType: 'ice',
    starters: [
      { speciesId: 120, level: 3 }, // Staryu
      { speciesId: 118, level: 1 }, // Goldeen
    ],
  },
  {
    name: 'Vermilion',
    primaryType: 'electric',
    secondaryType: 'steel',
    starters: [
      { speciesId: 25, level: 3 }, // Pikachu
      { speciesId: 81, level: 1 }, // Magnemite
    ],
  },
  {
    name: 'Celadon',
    primaryType: 'grass',
    secondaryType: 'poison',
    starters: [
      { speciesId: 44, level: 3 }, // Gloom
      { speciesId: 1, level: 1 }, // Bulbasaur
    ],
  },
  {
    name: 'Fuchsia',
    primaryType: 'poison',
    secondaryType: 'flying',
    starters: [
      { speciesId: 109, level: 3 }, // Koffing
      { speciesId: 41, level: 1 }, // Zubat
    ],
  },
  {
    name: 'Saffron',
    primaryType: 'psychic',
    secondaryType: 'ghost',
    starters: [
      { speciesId: 63, level: 3 }, // Abra
      { speciesId: 92, level: 1 }, // Gastly
    ],
  },
  {
    name: 'Cinnabar',
    primaryType: 'fire',
    secondaryType: 'dragon',
    starters: [
      { speciesId: 58, level: 3 }, // Growlithe
      { speciesId: 147, level: 1 }, // Dratini
    ],
  },
  {
    name: 'Viridian',
    primaryType: 'ground',
    secondaryType: 'normal',
    starters: [
      { speciesId: 33, level: 3 }, // Nidorino
      { speciesId: 52, level: 1 }, // Meowth
    ],
  },
]

// Todos os mapas têm o mesmo tamanho (16:9).
const MAP_W = 1920
const MAP_H = 1080

export const CITIES: CityData[] = SEEDS.map((s, index) => ({
  index,
  name: s.name,
  primaryType: s.primaryType,
  secondaryType: s.secondaryType,
  starters: s.starters,
  mapImage: `/maps/kanto/${index + 1}.png`,
  coverImage: `/maps/kanto/${index + 1}_capa.png`,
  mapW: MAP_W,
  mapH: MAP_H,
  // Cidades não calibradas herdam o layout de Pewter (placeholder).
  graph: s.graph ?? PEWTER_GRAPH,
  siteNodes: s.siteNodes ?? PEWTER_SITE_NODES,
  museumMissionId: s.museumMissionId,
  trainers: PEWTER_TRAINERS,
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

/**
 * Âncora de EXIBIÇÃO de um marcador (popup de missão/captura/defesa) — PLAN §3.1.
 * Usa a posição enumerada do mapa quando definida; senão, cai no ponto de parada.
 * Os Pokémon continuam caminhando até `nodePos`; só o ícone é desenhado aqui.
 */
export function markerPos(graph: CityGraph, id: string): MapPos {
  return graph.markers[id] ?? nodePos(graph, id)
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
