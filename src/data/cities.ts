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

// Pewter (1.png): grafo calibrado sobre a arte anotada. 17 pontos (a–q); o ginásio é 'j'.
// Posições normalizadas (0–1) — estimadas da arte e refináveis com o DEV picker do CityMap.
const PEWTER_NODES: Record<string, MapPos> = {
  a: { x: 0.53, y: 0.165 },
  b: { x: 0.803, y: 0.162 },
  c: { x: 0.154, y: 0.302 },
  d: { x: 0.365, y: 0.301 },
  e: { x: 0.488, y: 0.302 },
  f: { x: 0.488, y: 0.441 },
  g: { x: 0.706, y: 0.441 },
  h: { x: 0.803, y: 0.441 },
  i: { x: 0.155, y: 0.626 },
  j: { x: 0.323, y: 0.623 },
  k: { x: 0.488, y: 0.699 },
  l: { x: 0.58, y: 0.699 },
  m: { x: 0.805, y: 0.699 },
  n: { x: 0.241, y: 0.779 },
  o: { x: 0.241, y: 0.959 },
  p: { x: 0.365, y: 0.959 },
  q: { x: 0.473, y: 0.959 },
}

// Arestas NÃO-direcionadas (o '-' liga os dois sentidos), conforme o CSV de Pewter.
// O cluster n–o–p–q é alcançado a partir do resto só por 'q' (q–k); 'j' (ginásio) e 'a'/'n'
// são becos sem saída de 1 vizinho.
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
  ['k', 'q'],
  ['l', 'm'],
  ['n', 'o'],
  ['o', 'p'],
  ['p', 'q'],
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
// PARADA (a letra para onde o Pokémon caminha). Estimadas da arte e refináveis com o DEV
// picker do CityMap. Nós sem entrada usam o próprio ponto do grafo.
// OBS.: 'g' hospeda DOIS números (6.2 casa + 3.3 grama). O marcador desempata por TIPO:
// chave composta "g:house" → casa (6.2); o 'g' simples cobre o verde/captura (3.3).
const PEWTER_MARKERS: Record<string, MapPos> = {
  j: { x: 0.323, y: 0.435 }, // 1 — ginásio (sobre o prédio)
  p: { x: 0.365, y: 0.778 }, // 2 — centro (sobre o P.C)
  l: { x: 0.58, y: 0.537 }, // 4 — mart (sobre o prédio)
  d: { x: 0.358, y: 0.072 }, // 5 — museu
  a: { x: 0.529, y: 0.042 }, // 6.1 — casa (prédio rosa, topo)
  g: { x: 0.704, y: 0.569 }, // 3.3 — grama (padrão de 'g': verde/captura)
  'g:house': { x: 0.703, y: 0.299 }, // 6.2 — casa (quando a missão é de casa)
  c: { x: 0.161, y: 0.054 }, // 3.1 — grama
  b: { x: 0.74, y: 0.056 }, // 3.2 — grama
  m: { x: 0.924, y: 0.731 }, // 3.4 — grama
  n: { x: 0.159, y: 0.778 }, // 3.5 — grama
}

const PEWTER_GRAPH: CityGraph = {
  nodes: PEWTER_NODES,
  adj: buildAdjacency(PEWTER_NODES, PEWTER_EDGES),
  markers: PEWTER_MARKERS,
}

// Sítio → ponto do grafo (números da imagem anotada).
const PEWTER_SITE_NODES: CitySiteNodes = {
  gym: 'j', // 1 (ginásio)
  center: 'p', // 2 (centro)
  mart: 'l', // 4 (mart)
  museum: 'd', // 5 (museu / Rocket Team)
  houses: ['a', 'g'], // 6.1, 6.2
  green: ['c', 'b', 'g', 'm', 'n'], // 3.1, 3.2, 3.3, 3.4, 3.5
}

interface CitySeed {
  name: string
  primaryType: CityData['primaryType']
  secondaryType: CityData['secondaryType']
  /** Iniciais fixos: [Nv 3, Nv 1]. */
  starters: CityData['starters']
  graph?: CityGraph
  siteNodes?: CitySiteNodes
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
 * Âncora de EXIBIÇÃO de um marcador (popup de missão/captura/defesa) — PLAN §3.1: o ícone
 * aparece SOBRE o número da arte, não sobre a letra (ponto de parada). Quando um ponto
 * hospeda mais de um número (ex.: 'g' = casa 6.2 + grama 3.3), `kind` desempata via a chave
 * composta "ponto:tipo" (ex.: "g:house"). Sem chave composta, usa o marcador do ponto;
 * sem marcador, cai no próprio ponto. Os Pokémon continuam caminhando até `nodePos`.
 */
export function markerPos(graph: CityGraph, id: string, kind?: SiteKind): MapPos {
  if (kind) {
    const keyed = graph.markers[`${id}:${kind}`]
    if (keyed) return keyed
  }
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
