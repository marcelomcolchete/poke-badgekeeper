// As 8 cidades de Kanto (PLAN §3.1 / §4.7 / §4.8).
// Cada cidade aponta para sua arte top-down (/maps/kanto/N.png, 1920×1080) e define
// o GRAFO de deslocamento (pontos a–s + adjacência) e o mapeamento sítio→ponto: onde
// cada evento/missão surge. Os Pokémon caminham do ginásio até a missão e de volta
// pelo menor caminho; o tempo de viagem sai daí. Só Pewter está calibrada; as demais
// herdam o layout de Pewter (placeholder) até a arte ser anotada.

import type { MapPos, MissionCategory, SiteKind, TrainerId } from '../types/index.ts'
import { CATEGORY_SITE } from '../types/index.ts'
import type { CityData, CityGraph, CitySiteNodes } from './types.ts'

// Classes de treinador que invadem o ginásio (PLAN §4.4). Os RIVAIS entram em toda cidade
// automaticamente (engine/setup), então estas listas guardam só os treinadores PRÓPRIOS da
// cidade. Cidades sem lista própria herdam a lista genérica (placeholder até terem elenco).
const GENERIC_TRAINERS: TrainerId[] = ['YOUNGSTER', 'BIRD_KEEPER', 'LASS', 'BROCK', 'HIKER']

// Cerulean (água/gelo): elenco temático próprio. Rivais são adicionados automaticamente.
const CERULEAN_TRAINERS: TrainerId[] = [
  'MISTY',
  'YOUNGSTER',
  'PICNICKER',
  'PARASOL_LADY',
  'FISHERMAN',
  'POKEFAN',
]

// Elencos próprios das cidades 3–8 (líder primeiro; rivais somados no setup).
const VERMILION_TRAINERS: TrainerId[] = [
  'SURGE',
  'VERMILION_ENGINEER',
  'VERMILION_ROCKER',
  'VERMILION_SAILOR',
  'VERMILION_GENTLEMAN',
  'VERMILION_POKEMANIAC',
]
const CELADON_TRAINERS: TrainerId[] = [
  'ERIKA',
  'CELADON_BEAUTY',
  'CELADON_LASS',
  'CELADON_PICNICKER',
  'CELADON_BUGCATCHER',
  'CELADON_GAMER',
]
const FUCHSIA_TRAINERS: TrainerId[] = [
  'KOGA',
  'FUCHSIA_JUGGLER',
  'FUCHSIA_TAMER',
  'FUCHSIA_DRAGONTAMER',
  'FUCHSIA_BIRDKEEPER',
  'FUCHSIA_SWIMMER',
]
const SAFFRON_TRAINERS: TrainerId[] = [
  'SABRINA',
  'SAFFRON_ACETRAINER',
  'SAFFRON_SCIENTIST',
  'SAFFRON_CHANNELER',
  'SAFFRON_HEXMANIAC',
  'SAFFRON_BLACKBELT',
]
const CINNABAR_TRAINERS: TrainerId[] = [
  'BLAINE',
  'CINNABAR_BURGLAR',
  'CINNABAR_SUPERNERD',
  'CINNABAR_BLACKBELT',
  'CINNABAR_KINDLER',
  'CINNABAR_SWIMMER',
]
const VIRIDIAN_TRAINERS: TrainerId[] = [
  'GIOVANNI',
  'VIRIDIAN_TAMER',
  'VIRIDIAN_ACETRAINER',
  'VIRIDIAN_YOUNGSTER',
  'VIRIDIAN_CAMPER',
  'VIRIDIAN_BIKER',
]

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

/**
 * Monta a adjacência a partir das arestas (vizinhos ordenados). `edges` são NÃO-direcionadas
 * (ligam os dois sentidos); `directed` são de MÃO ÚNICA (só `a→b`), usadas em Cerulean
 * (ex.: 'k→t', 'q→v') onde o Pokémon passa num sentido mas não volta por ali.
 */
function buildAdjacency(
  nodes: Record<string, MapPos>,
  edges: [string, string][],
  directed: [string, string][] = [],
): Record<string, string[]> {
  const adj: Record<string, string[]> = {}
  for (const id of Object.keys(nodes)) adj[id] = []
  const link = (a: string, b: string): void => {
    if (!adj[a]?.includes(b)) adj[a]?.push(b)
  }
  for (const [a, b] of edges) {
    link(a, b)
    link(b, a)
  }
  for (const [a, b] of directed) link(a, b)
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
  mart: ['l'], // 4 (mart)
  specialMission: ['d'], // 5 (ponto único da Missão Especial)
  houses: ['a', 'g'], // 6.1, 6.2
  green: ['c', 'b', 'g', 'm', 'n'], // 3.1, 3.2, 3.3, 3.4, 3.5
}

// ============================ Cerulean (2.png) ============================
// Grafo calibrado sobre a arte anotada (CSV de Cerulean). 23 pontos de PARADA a–x (sem 'w')
// + 5 nós dedicados de exploração g31..g35 (as áreas 3.1–3.5, sobre os números). O ginásio é
// 'u'. Posições normalizadas (0–1) estimadas da arte — refináveis com o DEV picker do CityMap.
// Novidades vs. Pewter: pontos de Surf ('a','n') e arestas de mão única (k→t, q→v). A Rocket tem
// um ÚNICO ponto (5.2 = 'x'); o antigo 5.1 ('m') virou área de exploração (3.6).
const CERULEAN_NODES: Record<string, MapPos> = {
  a: { x: 0.109, y: 0.054 }, // (surf)
  b: { x: 0.487, y: 0.054 },
  c: { x: 0.635, y: 0.144 },
  d: { x: 0.758, y: 0.144 },
  e: { x: 0.197, y: 0.178 },
  f: { x: 0.745, y: 0.375 },
  g: { x: 0.831, y: 0.375 },
  h: { x: 0.197, y: 0.424 },
  i: { x: 0.367, y: 0.424 },
  j: { x: 0.492, y: 0.424 },
  k: { x: 0.547, y: 0.424 },
  l: { x: 0.635, y: 0.424 },
  m: { x: 0.03, y: 0.448 },
  n: { x: 0.11, y: 0.448 }, // (surf)
  o: { x: 0.197, y: 0.622 },
  p: { x: 0.388, y: 0.622 },
  q: { x: 0.746, y: 0.602 },
  r: { x: 0.831, y: 0.602 },
  s: { x: 0.385, y: 0.769 },
  t: { x: 0.547, y: 0.769 },
  u: { x: 0.661, y: 0.769 },
  v: { x: 0.746, y: 0.769 },
  x: { x: 0.385, y: 0.935 },
  // Áreas de exploração (3.1–3.5): nós dedicados sobre os números, ligados ao ponto de acesso.
  g31: { x: 0.365, y: 0.178 }, // 3.1 (acesso 'e')
  g32: { x: 0.544, y: 0.276 }, // 3.2 (acesso 'k')
  g33: { x: 0.885, y: 0.6 }, // 3.3 (acesso 'r')
  g34: { x: 0.11, y: 0.69 }, // 3.4 (acesso 'o')
  g35: { x: 0.836, y: 0.769 }, // 3.5 (acesso 'r')
}

// Arestas NÃO-direcionadas (ligam os dois sentidos), conforme a coluna "adjacentes" do CSV,
// mais as ligações dos nós de exploração aos seus pontos de acesso.
const CERULEAN_EDGES: [string, string][] = [
  ['a', 'b'],
  ['a', 'n'],
  ['b', 'j'],
  ['c', 'd'],
  ['c', 'l'],
  ['d', 'f'],
  ['e', 'h'],
  ['f', 'g'],
  ['f', 'q'],
  ['g', 'r'],
  ['h', 'i'],
  ['h', 'o'],
  ['i', 'j'],
  ['j', 'k'],
  ['k', 'l'],
  ['m', 'n'],
  ['o', 'p'],
  ['p', 's'],
  ['q', 'r'],
  ['s', 't'],
  ['s', 'x'],
  ['t', 'u'],
  ['u', 'v'],
  ['e', 'g31'],
  ['k', 'g32'],
  ['r', 'g33'],
  ['o', 'g34'],
  ['r', 'g35'],
]

// Arestas de MÃO ÚNICA: vai mas não volta (CSV — 'k' lista 't' mas 't' não lista 'k'; idem 'q→v').
const CERULEAN_DIRECTED_EDGES: [string, string][] = [
  ['k', 't'],
  ['q', 'v'],
]

// Âncoras de EXIBIÇÃO: onde o popup aparece SOBRE o número da arte (distinto da letra de parada).
// Pontos que hospedam mais de um número desempatam por TIPO (chave composta "ponto:tipo").
const CERULEAN_MARKERS: Record<string, MapPos> = {
  'u:gym': { x: 0.659, y: 0.611 }, // 1 — ginásio (sobre o prédio)
  'p:center': { x: 0.471, y: 0.544 }, // 2 — centro (sobre o P.C)
  't:mart': { x: 0.601, y: 0.892 }, // 4 — mart (sobre o prédio)
  x: { x: 0.285, y: 0.852 }, // 5.2 — Rocket (ponto único; sobre o ponto laranja inferior)
  m: { x: 0.03, y: 0.294 }, // 3.6 — exploração (era a 2ª Rocket; sobre o ponto laranja superior)
  h: { x: 0.219, y: 0.276 }, // 6.1 — casa
  i: { x: 0.37, y: 0.276 }, // 6.2 — casa
  c: { x: 0.641, y: 0.276 }, // 6.3 — casa
  g: { x: 0.846, y: 0.243 }, // 6.4 — casa
  'p:house': { x: 0.323, y: 0.498 }, // 6.5 — casa (quando a missão é de casa em 'p')
  't:house': { x: 0.492, y: 0.91 }, // 6.6 — casa (quando a missão é de casa em 't')
  'u:house': { x: 0.688, y: 0.91 }, // 6.7 — casa (quando a missão é de casa em 'u')
}

const CERULEAN_GRAPH: CityGraph = {
  nodes: CERULEAN_NODES,
  adj: buildAdjacency(CERULEAN_NODES, CERULEAN_EDGES, CERULEAN_DIRECTED_EDGES),
  markers: CERULEAN_MARKERS,
  surfNodes: ['a', 'n'],
}

// Sítio → ponto do grafo (números da imagem anotada de Cerulean).
const CERULEAN_SITE_NODES: CitySiteNodes = {
  gym: 'u', // 1 (ginásio)
  center: 'p', // 2 (centro) — acessível de 'p' e 't'; paramos em 'p'
  mart: ['t'], // 4 (mart) — acessível de 't' e 'u'; paramos em 't'
  specialMission: ['x'], // 5.2 — ponto especial ÚNICO
  houses: ['h', 'i', 'c', 'g', 'p', 't', 'u'], // 6.1..6.7
  green: ['g31', 'g32', 'g33', 'g34', 'g35', 'm'], // 3.1..3.6 (áreas de exploração/captura; 'm' era a 2ª Rocket)
}

// ============================ Vermilion (3.png) ============================
// Grafo calibrado sobre a arte anotada (mapa do chat). 38 pontos de PARADA a–an (sem 'j'/'w')
// + 5 nós dedicados de exploração g31..g35 (áreas GRASS, sobre os retângulos). O ginásio é
// 'aj'. Posições normalizadas (0–1) estimadas da arte — refináveis com o DEV picker do CityMap.
// Sem mãos únicas: todas as adjacências são bidirecionais.
const VERMILION_NODES: Record<string, MapPos> = {
  a: { x: 0.487, y: 0.116 },
  b: { x: 0.126, y: 0.211 }, // água (surf)
  c: { x: 0.198, y: 0.211 },
  d: { x: 0.322, y: 0.211 },
  e: { x: 0.415, y: 0.211 },
  f: { x: 0.487, y: 0.211 },
  g: { x: 0.572, y: 0.211 },
  h: { x: 0.679, y: 0.211 },
  i: { x: 0.788, y: 0.211 },
  k: { x: 0.322, y: 0.313 },
  l: { x: 0.415, y: 0.313 },
  m: { x: 0.487, y: 0.313 },
  n: { x: 0.572, y: 0.313 },
  o: { x: 0.679, y: 0.313 },
  p: { x: 0.788, y: 0.313 },
  q: { x: 0.126, y: 0.358 }, // água (surf)
  r: { x: 0.679, y: 0.418 },
  s: { x: 0.788, y: 0.418 },
  t: { x: 0.487, y: 0.451 },
  u: { x: 0.543, y: 0.451 },
  v: { x: 0.126, y: 0.606 }, // água (surf)
  x: { x: 0.266, y: 0.606 },
  y: { x: 0.399, y: 0.606 },
  z: { x: 0.487, y: 0.606 },
  aa: { x: 0.543, y: 0.606 },
  ab: { x: 0.615, y: 0.606 },
  ac: { x: 0.76, y: 0.606 },
  ad: { x: 0.887, y: 0.606 },
  ae: { x: 0.399, y: 0.699 },
  af: { x: 0.487, y: 0.699 },
  ag: { x: 0.539, y: 0.699 },
  ah: { x: 0.539, y: 0.811 },
  ai: { x: 0.126, y: 0.888 }, // água (surf)
  aj: { x: 0.304, y: 0.888 },
  ak: { x: 0.399, y: 0.888 },
  al: { x: 0.543, y: 0.888 }, // água (surf)
  am: { x: 0.543, y: 0.958 },
  an: { x: 0.76, y: 0.958 },
  // Áreas de exploração (GRASS): nós dedicados sobre os retângulos, ligados ao(s) ponto(s) de acesso.
  g31: { x: 0.49, y: 0.045 }, // GRASS topo (acesso 'a')
  g32: { x: 0.734, y: 0.314 }, // GRASS centro-dir (acesso 'o' e 'p')
  g33: { x: 0.21, y: 0.358 }, // GRASS esquerda (acesso 'c' e 'q')
  g34: { x: 0.96, y: 0.605 }, // GRASS direita (acesso 'ad')
  g35: { x: 0.477, y: 0.958 }, // GRASS baixo (acesso 'am')
}

// Arestas NÃO-direcionadas (ligam os dois sentidos). Todas bidirecionais (sem mão única).
const VERMILION_EDGES: [string, string][] = [
  ['a', 'f'],
  ['b', 'c'],
  ['c', 'd'],
  ['d', 'e'],
  ['e', 'f'],
  ['f', 'g'],
  ['g', 'h'],
  ['h', 'i'],
  ['d', 'k'],
  ['e', 'l'],
  ['f', 'm'],
  ['k', 'l'],
  ['l', 'm'],
  ['m', 'n'],
  ['n', 'o'],
  ['h', 'o'],
  ['i', 'p'],
  ['o', 'r'],
  ['p', 's'],
  ['r', 's'],
  ['m', 't'],
  ['t', 'u'],
  ['t', 'z'],
  ['u', 'aa'],
  ['z', 'af'],
  ['aa', 'ag'],
  ['v', 'x'],
  ['x', 'y'],
  ['y', 'z'],
  ['z', 'aa'],
  ['aa', 'ab'],
  ['ab', 'ac'],
  ['ac', 'ad'],
  ['y', 'ae'],
  ['ae', 'ak'],
  ['ae', 'af'],
  ['af', 'ag'],
  ['ag', 'ah'],
  ['b', 'q'],
  ['q', 'v'],
  ['v', 'ai'],
  ['ai', 'aj'],
  ['aj', 'ak'],
  ['ak', 'al'],
  ['ah', 'al'],
  ['al', 'am'],
  ['am', 'an'],
  ['ac', 'an'],
  // acesso às áreas de exploração (uma aresta por seta roxa do GRASS)
  ['a', 'g31'],
  ['o', 'g32'],
  ['p', 'g32'],
  ['c', 'g33'],
  ['q', 'g33'],
  ['ad', 'g34'],
  ['am', 'g35'],
]

// Âncoras de EXIBIÇÃO: o popup aparece SOBRE o retângulo da arte (distinto da letra de parada).
// Nenhuma letra hospeda mais de um pop-up aqui, então todas as chaves são simples.
const VERMILION_MARKERS: Record<string, MapPos> = {
  aj: { x: 0.304, y: 0.723 }, // GYM (sobre o ginásio)
  d: { x: 0.322, y: 0.04 }, // CP — centro (sobre o P.C)
  ab: { x: 0.603, y: 0.445 }, // MART (sobre o prédio)
  x: { x: 0.266, y: 0.445 }, // RKT — Rocket (sobre o prédio)
  c: { x: 0.21, y: 0.057 }, // HOUSE (topo-esq)
  e: { x: 0.415, y: 0.057 }, // HOUSE (topo)
  g: { x: 0.572, y: 0.057 }, // HOUSE (topo)
  y: { x: 0.415, y: 0.468 }, // HOUSE (meio)
  ah: { x: 0.603, y: 0.723 }, // HOUSE (baixo)
}

const VERMILION_GRAPH: CityGraph = {
  nodes: VERMILION_NODES,
  adj: buildAdjacency(VERMILION_NODES, VERMILION_EDGES),
  markers: VERMILION_MARKERS,
  surfNodes: ['b', 'q', 'v', 'ai', 'al'],
}

// Sítio → ponto do grafo (pop-ups da arte anotada de Vermilion).
const VERMILION_SITE_NODES: CitySiteNodes = {
  gym: 'aj', // GYM
  center: 'd', // CP
  mart: ['ab'], // MART
  specialMission: ['x'], // SPEC — ponto especial único
  houses: ['c', 'e', 'g', 'y', 'ah'], // HOUSE ×5
  green: ['g31', 'g32', 'g33', 'g34', 'g35'], // GRASS ×5 (exploração/captura)
}

// ============================ Celadon (4.png) ============================
// Grafo calibrado sobre a arte anotada (mapa do chat). 37 pontos de PARADA a–al (sem 'w')
// + 3 nós dedicados de exploração g31..g33 (áreas GRASS, sobre os retângulos). O ginásio é
// 'aa'. Posições normalizadas (0–1) estimadas da arte — refináveis com o DEV picker do CityMap.
// Novidades: DOIS marts (a missão de mart surge em 'j' OU 'n'); 'n' é ponto de água (Surf), então
// o mart de 'n' fica atrás de água. DUAS Missões Especiais (SPEC1='j', SPEC2='r'). Sem mão única.
const CELADON_NODES: Record<string, MapPos> = {
  a: { x: 0.108, y: 0.262 },
  b: { x: 0.342, y: 0.262 },
  c: { x: 0.51, y: 0.262 },
  d: { x: 0.604, y: 0.262 },
  e: { x: 0.716, y: 0.262 },
  f: { x: 0.809, y: 0.262 },
  g: { x: 0.88, y: 0.262 },
  h: { x: 0.108, y: 0.354 },
  i: { x: 0.158, y: 0.354 },
  j: { x: 0.227, y: 0.354 },
  k: { x: 0.342, y: 0.354 },
  l: { x: 0.71, y: 0.35 },
  m: { x: 0.809, y: 0.35 },
  n: { x: 0.446, y: 0.498 }, // (surf) — mart atrás de água
  o: { x: 0.108, y: 0.535 },
  p: { x: 0.158, y: 0.535 },
  q: { x: 0.342, y: 0.535 },
  r: { x: 0.577, y: 0.532 },
  s: { x: 0.71, y: 0.532 },
  t: { x: 0.92, y: 0.532 },
  u: { x: 0.158, y: 0.611 },
  v: { x: 0.342, y: 0.611 },
  x: { x: 0.446, y: 0.611 },
  y: { x: 0.71, y: 0.611 },
  z: { x: 0.108, y: 0.802 },
  aa: { x: 0.182, y: 0.802 },
  ab: { x: 0.446, y: 0.795 },
  ac: { x: 0.564, y: 0.795 },
  ad: { x: 0.676, y: 0.795 },
  ae: { x: 0.762, y: 0.795 },
  af: { x: 0.828, y: 0.795 },
  ag: { x: 0.868, y: 0.795 },
  ah: { x: 0.92, y: 0.795 },
  ai: { x: 0.182, y: 0.927 },
  aj: { x: 0.365, y: 0.927 },
  ak: { x: 0.676, y: 0.927 },
  al: { x: 0.875, y: 0.927 },
  // Áreas de exploração (GRASS): nós dedicados sobre os retângulos, ligados ao ponto de acesso.
  g31: { x: 0.955, y: 0.265 }, // GRASS direita (acesso 'g')
  g32: { x: 0.04, y: 0.558 }, // GRASS esquerda (acesso 'o')
  g33: { x: 0.11, y: 0.927 }, // GRASS baixo (acesso 'ai')
}

// Arestas NÃO-direcionadas (ligam os dois sentidos). Todas bidirecionais (sem mão única).
const CELADON_EDGES: [string, string][] = [
  ['b', 'c'],
  ['c', 'd'],
  ['d', 'e'],
  ['e', 'f'],
  ['f', 'g'],
  ['a', 'h'],
  ['b', 'k'],
  ['e', 'l'],
  ['f', 'm'],
  ['h', 'i'],
  ['i', 'j'],
  ['j', 'k'],
  ['l', 'm'],
  ['h', 'o'],
  ['i', 'p'],
  ['k', 'q'],
  ['l', 's'],
  ['o', 'p'],
  ['p', 'q'],
  ['r', 's'],
  ['s', 't'],
  ['s', 'y'],
  ['p', 'u'],
  ['q', 'v'],
  ['u', 'v'],
  ['v', 'x'],
  ['x', 'y'],
  ['n', 'x'],
  ['x', 'ab'],
  ['z', 'aa'],
  ['aa', 'ai'],
  ['ai', 'aj'],
  ['aj', 'ak'],
  ['ab', 'ac'],
  ['ac', 'ad'],
  ['ad', 'ae'],
  ['ae', 'af'],
  ['af', 'ag'],
  ['ag', 'ah'],
  ['ad', 'ak'],
  ['ak', 'al'],
  ['ag', 'al'],
  ['t', 'ah'],
  // acesso às áreas de exploração (uma aresta por seta roxa do GRASS)
  ['g', 'g31'],
  ['o', 'g32'],
  ['ai', 'g33'],
]

// Âncoras de EXIBIÇÃO: o popup aparece SOBRE o retângulo da arte (distinto da letra de parada).
// 'j' hospeda DOIS pop-ups (mart da loja + SPEC1) → chave composta por TIPO.
const CELADON_MARKERS: Record<string, MapPos> = {
  aa: { x: 0.19, y: 0.685 }, // GYM (sobre o ginásio)
  f: { x: 0.805, y: 0.13 }, // CP — centro (sobre o P.C)
  'j:mart': { x: 0.26, y: 0.2 }, // MART (loja de departamentos)
  'j:specialMission': { x: 0.19, y: 0.2 }, // SPEC1 (mesma parada 'j')
  'n:mart': { x: 0.446, y: 0.38 }, // MART (prédio central; parada na água 'n')
  r: { x: 0.577, y: 0.41 }, // SPEC2
  a: { x: 0.11, y: 0.14 }, // HOUSE
  b: { x: 0.36, y: 0.14 }, // HOUSE
  c: { x: 0.51, y: 0.14 }, // HOUSE
  d: { x: 0.6, y: 0.14 }, // HOUSE
  e: { x: 0.69, y: 0.14 }, // HOUSE (×2 setas → mesma parada)
  m: { x: 0.805, y: 0.44 }, // HOUSE (×2 setas → mesma parada)
  s: { x: 0.655, y: 0.41 }, // HOUSE
  aj: { x: 0.37, y: 0.79 }, // HOUSE
  ac: { x: 0.57, y: 0.68 }, // HOUSE
  ad: { x: 0.66, y: 0.68 }, // HOUSE (×2 setas → mesma parada)
  ae: { x: 0.77, y: 0.68 }, // HOUSE
  af: { x: 0.84, y: 0.68 }, // HOUSE
}

const CELADON_GRAPH: CityGraph = {
  nodes: CELADON_NODES,
  adj: buildAdjacency(CELADON_NODES, CELADON_EDGES),
  markers: CELADON_MARKERS,
  surfNodes: ['n'],
}

// Sítio → ponto do grafo (pop-ups da arte anotada de Celadon).
const CELADON_SITE_NODES: CitySiteNodes = {
  gym: 'aa', // GYM
  center: 'f', // CP
  mart: ['j', 'n'], // DOIS marts (loja em 'j'; prédio central em 'n', atrás de água)
  specialMission: ['j', 'r'], // SPEC1 (loja, parada 'j') e SPEC2 ('r')
  houses: ['a', 'b', 'c', 'd', 'e', 'm', 's', 'aj', 'ac', 'ad', 'ae', 'af'], // HOUSE
  green: ['g31', 'g32', 'g33'], // GRASS ×3 (exploração/captura)
}

interface CitySeed {
  name: string
  primaryType: CityData['primaryType']
  secondaryType: CityData['secondaryType']
  /** Iniciais fixos: [Nv 3, Nv 1]. */
  starters: CityData['starters']
  graph?: CityGraph
  siteNodes?: CitySiteNodes
  /** Elenco próprio de invasores (sem rivais — adicionados no setup). Omitido → genérico. */
  trainers?: TrainerId[]
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
    graph: CERULEAN_GRAPH,
    siteNodes: CERULEAN_SITE_NODES,
    trainers: CERULEAN_TRAINERS,
  },
  {
    name: 'Vermilion',
    primaryType: 'electric',
    secondaryType: 'dragon',
    starters: [
      { speciesId: 25, level: 3 }, // Pikachu
      { speciesId: 81, level: 1 }, // Magnemite
    ],
    graph: VERMILION_GRAPH,
    siteNodes: VERMILION_SITE_NODES,
    trainers: VERMILION_TRAINERS,
  },
  {
    name: 'Celadon',
    primaryType: 'grass',
    secondaryType: 'bug',
    starters: [
      { speciesId: 44, level: 3 }, // Gloom
      { speciesId: 1, level: 1 }, // Bulbasaur
    ],
    graph: CELADON_GRAPH,
    siteNodes: CELADON_SITE_NODES,
    trainers: CELADON_TRAINERS,
  },
  {
    name: 'Fuchsia',
    primaryType: 'poison',
    secondaryType: 'dragon',
    starters: [
      { speciesId: 109, level: 3 }, // Koffing
      { speciesId: 41, level: 1 }, // Zubat
    ],
    trainers: FUCHSIA_TRAINERS,
  },
  {
    name: 'Saffron',
    primaryType: 'psychic',
    secondaryType: 'ghost',
    starters: [
      { speciesId: 63, level: 3 }, // Abra
      { speciesId: 92, level: 1 }, // Gastly
    ],
    trainers: SAFFRON_TRAINERS,
  },
  {
    name: 'Cinnabar',
    primaryType: 'fire',
    secondaryType: 'fighting',
    starters: [
      { speciesId: 58, level: 3 }, // Growlithe
      { speciesId: 147, level: 1 }, // Dratini
    ],
    trainers: CINNABAR_TRAINERS,
  },
  {
    name: 'Viridian',
    primaryType: 'ground',
    secondaryType: 'normal',
    starters: [
      { speciesId: 33, level: 3 }, // Nidorino
      { speciesId: 52, level: 1 }, // Meowth
    ],
    trainers: VIRIDIAN_TRAINERS,
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
  trainers: s.trainers ?? GENERIC_TRAINERS,
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
      return siteNodes.mart
    case 'specialMission':
      return siteNodes.specialMission
    case 'house':
      return siteNodes.houses
    case 'green':
      return siteNodes.green
  }
}
