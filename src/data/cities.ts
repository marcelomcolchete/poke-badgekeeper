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
// Novidades: DOIS marts (a missão de mart surge em 'j' OU 'n'). O mart central 'n' é alcançável a
// pé pelo ponto de cima 'nu'; o Surf é um atalho que cruza a água 'nw' por baixo (anda menos).
// DUAS Missões Especiais (SPEC1='j', SPEC2='r'). Sem mão única.
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
  n: { x: 0.446, y: 0.498 }, // mart central — a pé por 'nu' (cima); atalho de Surf por 'nw' (baixo)
  nu: { x: 0.446, y: 0.4 }, // chegada a pé do mart central (acima do prédio)
  nw: { x: 0.446, y: 0.56 }, // (surf) travessia de água — atalho por baixo até 'n'
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
  ['c', 'nu'],
  ['nu', 'n'],
  ['x', 'nw'],
  ['nw', 'n'],
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
  'n:mart': { x: 0.446, y: 0.38 }, // MART (prédio central; parada 'n', a pé via 'nu')
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
  surfNodes: ['nw'],
}

// Sítio → ponto do grafo (pop-ups da arte anotada de Celadon).
const CELADON_SITE_NODES: CitySiteNodes = {
  gym: 'aa', // GYM
  center: 'f', // CP
  mart: ['j', 'n'], // DOIS marts (loja em 'j'; prédio central em 'n', alcançável a pé via 'nu')
  specialMission: ['j', 'r'], // SPEC1 (loja, parada 'j') e SPEC2 ('r')
  houses: ['a', 'b', 'c', 'd', 'e', 'm', 's', 'aj', 'ac', 'ad', 'ae', 'af'], // HOUSE
  green: ['g31', 'g32', 'g33'], // GRASS ×3 (exploração/captura)
}

// ============================ Fuchsia (5.png) ============================
// Grafo calibrado sobre a arte anotada (mapa do chat). 28 pontos de PARADA a–ac (sem 'w')
// + 4 nós dedicados de exploração g31..g34 (áreas GRASS, sobre os retângulos). O ginásio é
// 's'. Posições normalizadas (0–1) estimadas da arte — refináveis com o DEV picker do CityMap.
// É uma CIDADE-LOOP: duas mãos únicas (s→r no ginásio, v→x no corredor inferior) forçam a
// circulação. Volta ao ginásio fecha pela esquerda (i–r→aa→ab→s) e pela direita (h–q). Sem Surf.
const FUCHSIA_NODES: Record<string, MapPos> = {
  a: { x: 0.072, y: 0.169 },
  b: { x: 0.227, y: 0.169 },
  c: { x: 0.513, y: 0.169 },
  d: { x: 0.578, y: 0.222 },
  e: { x: 0.117, y: 0.282 },
  f: { x: 0.578, y: 0.357 },
  g: { x: 0.628, y: 0.357 },
  h: { x: 0.907, y: 0.359 },
  i: { x: 0.061, y: 0.457 },
  j: { x: 0.117, y: 0.457 },
  k: { x: 0.513, y: 0.457 },
  l: { x: 0.578, y: 0.457 },
  m: { x: 0.628, y: 0.457 },
  n: { x: 0.628, y: 0.757 },
  o: { x: 0.702, y: 0.757 },
  p: { x: 0.795, y: 0.757 },
  q: { x: 0.907, y: 0.757 },
  r: { x: 0.061, y: 0.833 },
  s: { x: 0.198, y: 0.833 },
  t: { x: 0.304, y: 0.833 },
  u: { x: 0.419, y: 0.833 },
  v: { x: 0.534, y: 0.833 },
  x: { x: 0.628, y: 0.833 },
  y: { x: 0.795, y: 0.833 },
  z: { x: 0.907, y: 0.833 },
  aa: { x: 0.061, y: 0.913 },
  ab: { x: 0.198, y: 0.913 },
  ac: { x: 0.419, y: 0.943 },
  // Áreas de exploração (GRASS): nós dedicados sobre os retângulos, ligados ao ponto de acesso.
  g31: { x: 0.072, y: 0.051 }, // GRASS topo-esq (acesso 'a')
  g32: { x: 0.041, y: 0.282 }, // GRASS esquerda (acesso 'e')
  g33: { x: 0.965, y: 0.359 }, // GRASS direita (acesso 'h')
  g34: { x: 0.534, y: 0.944 }, // GRASS baixo (acesso 'ac')
}

// Arestas NÃO-direcionadas (ligam os dois sentidos). As mãos únicas s→r e v→x ficam em DIRECTED.
const FUCHSIA_EDGES: [string, string][] = [
  ['a', 'b'],
  ['b', 'c'],
  ['c', 'k'],
  ['d', 'f'],
  ['e', 'j'],
  ['f', 'g'],
  ['f', 'l'],
  ['g', 'h'],
  ['g', 'm'],
  ['h', 'q'],
  ['i', 'j'],
  ['i', 'r'],
  ['j', 'k'],
  ['k', 'l'],
  ['l', 'm'],
  ['m', 'n'],
  ['n', 'o'],
  ['n', 'x'],
  ['o', 'p'],
  ['p', 'q'],
  ['p', 'y'],
  ['q', 'z'],
  ['r', 'aa'],
  ['s', 't'],
  ['s', 'ab'],
  ['t', 'u'],
  ['u', 'v'],
  ['u', 'ac'],
  ['x', 'y'],
  ['y', 'z'],
  ['aa', 'ab'],
  // acesso às áreas de exploração (uma aresta por seta roxa do GRASS)
  ['a', 'g31'],
  ['e', 'g32'],
  ['h', 'g33'],
  ['ac', 'g34'],
]

// Arestas de MÃO ÚNICA: vai mas não volta. Ginásio sai por s→r (volta via aa→ab→s); o corredor
// inferior entra no cluster direito por v→x (volta dá a volta pelo topo).
const FUCHSIA_DIRECTED_EDGES: [string, string][] = [
  ['s', 'r'],
  ['v', 'x'],
]

// Âncoras de EXIBIÇÃO: o popup aparece SOBRE o retângulo da arte (distinto da letra de parada).
// Nenhuma letra hospeda mais de um pop-up aqui, então todas as chaves são simples.
const FUCHSIA_MARKERS: Record<string, MapPos> = {
  s: { x: 0.198, y: 0.648 }, // GYM (sobre o ginásio)
  v: { x: 0.53, y: 0.628 }, // CP — centro (sobre o P.C)
  b: { x: 0.227, y: 0.052 }, // MART (sobre o prédio)
  d: { x: 0.59, y: 0.083 }, // SPEC1 (sobre o prédio laranja)
  t: { x: 0.304, y: 0.648 }, // HOUSE
  u: { x: 0.409, y: 0.648 }, // HOUSE
  o: { x: 0.702, y: 0.648 }, // HOUSE
  p: { x: 0.806, y: 0.648 }, // HOUSE
}

const FUCHSIA_GRAPH: CityGraph = {
  nodes: FUCHSIA_NODES,
  adj: buildAdjacency(FUCHSIA_NODES, FUCHSIA_EDGES, FUCHSIA_DIRECTED_EDGES),
  markers: FUCHSIA_MARKERS,
}

// Sítio → ponto do grafo (pop-ups da arte anotada de Fuchsia).
const FUCHSIA_SITE_NODES: CitySiteNodes = {
  gym: 's', // GYM
  center: 'v', // CP
  mart: ['b'], // MART
  specialMission: ['d'], // SPEC1 — ponto especial único
  houses: ['t', 'u', 'o', 'p'], // HOUSE ×4
  green: ['g31', 'g32', 'g33', 'g34'], // GRASS ×4 (exploração/captura)
}

// ============================ Saffron (6.png) ============================
// Grafo calibrado sobre a arte anotada (mapa do chat). 29 pontos de PARADA a–ad (sem 'w')
// + 3 nós dedicados de exploração g31..g33 (áreas GRASS, sobre os retângulos). O ginásio é
// 'd'. Posições normalizadas (0–1) estimadas da arte — refináveis com o DEV picker do CityMap.
// A arte tem DOIS prédios GYM (→C e →D); como o modelo só tem um ginásio (base de viagens/
// defesas), 'd' é o ginásio oficial e 'c' (o 2º GYM) vira casa. Layout em "escada": loop
// perimetral (spines e–j–p–r–z / i–o–q–y–ad) + dois degraus internos (j–k–l–m–n–o e
// r–s–t–u–v–x–y). Sem Surf e sem mãos únicas (tudo bidirecional).
const SAFFRON_NODES: Record<string, MapPos> = {
  a: { x: 0.529, y: 0.157 },
  b: { x: 0.529, y: 0.236 },
  c: { x: 0.617, y: 0.236 },
  d: { x: 0.702, y: 0.236 },
  e: { x: 0.25, y: 0.307 },
  f: { x: 0.356, y: 0.307 },
  g: { x: 0.529, y: 0.307 },
  h: { x: 0.702, y: 0.307 },
  i: { x: 0.791, y: 0.307 },
  j: { x: 0.25, y: 0.524 },
  k: { x: 0.31, y: 0.524 },
  l: { x: 0.401, y: 0.524 },
  m: { x: 0.608, y: 0.524 },
  n: { x: 0.726, y: 0.524 },
  o: { x: 0.791, y: 0.524 },
  p: { x: 0.25, y: 0.619 },
  q: { x: 0.791, y: 0.619 },
  r: { x: 0.25, y: 0.78 },
  s: { x: 0.326, y: 0.78 },
  t: { x: 0.401, y: 0.78 },
  u: { x: 0.508, y: 0.78 },
  v: { x: 0.611, y: 0.78 },
  x: { x: 0.688, y: 0.78 },
  y: { x: 0.791, y: 0.78 },
  z: { x: 0.25, y: 0.963 },
  aa: { x: 0.371, y: 0.963 },
  ab: { x: 0.499, y: 0.963 },
  ac: { x: 0.666, y: 0.963 },
  ad: { x: 0.791, y: 0.963 },
  // Áreas de exploração (GRASS): nós dedicados sobre os retângulos, ligados ao ponto de acesso.
  g31: { x: 0.529, y: 0.079 }, // GRASS topo (acesso 'a')
  g32: { x: 0.078, y: 0.616 }, // GRASS esquerda (acesso 'p')
  g33: { x: 0.935, y: 0.616 }, // GRASS direita (acesso 'q')
}

// Arestas NÃO-direcionadas (ligam os dois sentidos). Todas bidirecionais (sem mão única).
const SAFFRON_EDGES: [string, string][] = [
  ['a', 'b'],
  ['b', 'c'],
  ['b', 'g'],
  ['c', 'd'],
  ['d', 'h'],
  ['e', 'f'],
  ['e', 'j'],
  ['f', 'g'],
  ['g', 'h'],
  ['h', 'i'],
  ['i', 'o'],
  ['j', 'k'],
  ['j', 'p'],
  ['k', 'l'],
  ['l', 'm'],
  ['m', 'n'],
  ['n', 'o'],
  ['o', 'q'],
  ['p', 'r'],
  ['q', 'y'],
  ['r', 's'],
  ['r', 'z'],
  ['s', 't'],
  ['t', 'u'],
  ['u', 'v'],
  ['v', 'x'],
  ['x', 'y'],
  ['y', 'ad'],
  ['z', 'aa'],
  ['aa', 'ab'],
  ['ab', 'ac'],
  ['ac', 'ad'],
  // acesso às áreas de exploração (uma aresta por seta roxa do GRASS)
  ['a', 'g31'],
  ['p', 'g32'],
  ['q', 'g33'],
]

// Âncoras de EXIBIÇÃO: o popup aparece SOBRE o retângulo da arte (distinto da letra de parada).
// Nenhuma letra hospeda mais de um pop-up aqui, então todas as chaves são simples.
const SAFFRON_MARKERS: Record<string, MapPos> = {
  d: { x: 0.702, y: 0.137 }, // GYM (prédio direito; ginásio oficial)
  c: { x: 0.608, y: 0.139 }, // HOUSE (era o 2º GYM, à esquerda)
  m: { x: 0.608, y: 0.405 }, // MART (sobre o prédio)
  u: { x: 0.508, y: 0.616 }, // SPEC1 (sobre o prédio laranja)
  aa: { x: 0.371, y: 0.85 }, // CP — centro (sobre o P.C)
  f: { x: 0.354, y: 0.215 }, // HOUSE
  k: { x: 0.31, y: 0.414 }, // HOUSE
  n: { x: 0.726, y: 0.415 }, // HOUSE
  s: { x: 0.326, y: 0.648 }, // HOUSE
  t: { x: 0.401, y: 0.648 }, // HOUSE
  v: { x: 0.611, y: 0.648 }, // HOUSE
  x: { x: 0.688, y: 0.648 }, // HOUSE
  ab: { x: 0.499, y: 0.847 }, // HOUSE
  ac: { x: 0.666, y: 0.852 }, // HOUSE
}

const SAFFRON_GRAPH: CityGraph = {
  nodes: SAFFRON_NODES,
  adj: buildAdjacency(SAFFRON_NODES, SAFFRON_EDGES),
  markers: SAFFRON_MARKERS,
}

// Sítio → ponto do grafo (pop-ups da arte anotada de Saffron).
const SAFFRON_SITE_NODES: CitySiteNodes = {
  gym: 'd', // GYM oficial (prédio direito)
  center: 'aa', // CP
  mart: ['m'], // MART
  specialMission: ['u'], // SPEC1 — ponto especial único
  houses: ['c', 'f', 'k', 'n', 's', 't', 'v', 'x', 'ab', 'ac'], // HOUSE ×10 ('c' = 2º GYM)
  green: ['g31', 'g32', 'g33'], // GRASS ×3 (exploração/captura)
}

// ============================ Cinnabar (7.png) ============================
// A cidade mais simples: 15 pontos de PARADA a–p (sem 'l') + 2 nós dedicados de exploração
// g31/g32 (áreas GRASS). O ginásio é 'e'. Posições normalizadas (0–1) estimadas da arte —
// refináveis com o DEV picker do CityMap. TRÊS pontos de Surf na coluna de água à esquerda
// (b, i, k); o GRASS esquerdo (g32) fica atrás d'água (acesso só por 'i'). Sem mãos únicas.
// Estrutura em anel: c–d–e–g–h–p–o–n–m–j no miolo; a coluna b–i–k liga por Surf.
const CINNABAR_NODES: Record<string, MapPos> = {
  a: { x: 0.582, y: 0.149 },
  b: { x: 0.151, y: 0.36 }, // (surf)
  c: { x: 0.348, y: 0.36 },
  d: { x: 0.582, y: 0.356 },
  e: { x: 0.853, y: 0.36 },
  f: { x: 0.582, y: 0.478 },
  g: { x: 0.853, y: 0.478 },
  h: { x: 0.907, y: 0.478 },
  i: { x: 0.151, y: 0.76 }, // (surf)
  j: { x: 0.358, y: 0.76 },
  k: { x: 0.151, y: 0.938 }, // (surf)
  m: { x: 0.358, y: 0.938 },
  n: { x: 0.603, y: 0.938 },
  o: { x: 0.794, y: 0.938 },
  p: { x: 0.907, y: 0.938 },
  // Áreas de exploração (GRASS): nós dedicados sobre os retângulos, ligados ao ponto de acesso.
  g31: { x: 0.582, y: 0.046 }, // GRASS topo (acesso 'a')
  g32: { x: 0.061, y: 0.761 }, // GRASS esquerda (acesso 'i' — atrás d'água, só por Surf)
}

// Arestas NÃO-direcionadas (ligam os dois sentidos). Todas bidirecionais (sem mão única).
const CINNABAR_EDGES: [string, string][] = [
  ['a', 'd'],
  ['b', 'c'],
  ['b', 'i'],
  ['c', 'd'],
  ['d', 'e'],
  ['d', 'f'],
  ['e', 'g'],
  ['f', 'g'],
  ['g', 'h'],
  ['h', 'p'],
  ['i', 'j'],
  ['i', 'k'],
  ['j', 'm'],
  ['k', 'm'],
  ['m', 'n'],
  ['n', 'o'],
  ['o', 'p'],
  // acesso às áreas de exploração (uma aresta por seta roxa do GRASS)
  ['a', 'g31'],
  ['i', 'g32'],
]

// Âncoras de EXIBIÇÃO: o popup aparece SOBRE o retângulo da arte (distinto da letra de parada).
// Nenhuma letra hospeda mais de um pop-up aqui, então todas as chaves são simples. As 3 casas
// compartilham a parada 'c', então o marcador 'c' fica sobre os prédios de casa (topo).
const CINNABAR_MARKERS: Record<string, MapPos> = {
  e: { x: 0.853, y: 0.107 }, // GYM (sobre o ginásio)
  c: { x: 0.348, y: 0.15 }, // HOUSE ×3 (sobre os prédios, topo)
  n: { x: 0.603, y: 0.618 }, // CP — centro (sobre o P.C)
  o: { x: 0.794, y: 0.652 }, // MART (sobre o prédio)
  j: { x: 0.358, y: 0.5 }, // SPEC1 (sobre o prédio laranja)
}

const CINNABAR_GRAPH: CityGraph = {
  nodes: CINNABAR_NODES,
  adj: buildAdjacency(CINNABAR_NODES, CINNABAR_EDGES),
  markers: CINNABAR_MARKERS,
  surfNodes: ['b', 'i', 'k'],
}

// Sítio → ponto do grafo (pop-ups da arte anotada de Cinnabar).
const CINNABAR_SITE_NODES: CitySiteNodes = {
  gym: 'e', // GYM
  center: 'n', // CP
  mart: ['o'], // MART
  specialMission: ['j'], // SPEC1 — ponto especial único
  houses: ['c'], // HOUSE ×3 → mesma parada 'c' (uma entrada)
  green: ['g31', 'g32'], // GRASS ×2 (g32 atrás d'água, só por Surf)
}

// ============================ Viridian (8.png) ============================
// Grafo calibrado sobre a arte anotada (mapa do chat). 27 pontos de PARADA a–ab (sem 'w')
// + 3 nós dedicados de exploração g31/g32/g33 (áreas GRASS). O ginásio é 'f'. Posições
// normalizadas (0–1) estimadas da arte — refináveis com o DEV picker do CityMap. Novidades:
// 'v' é ponto de Surf (no laguinho) e hospeda a Missão Especial — SPEC fica atrás d'água
// (acesso só por Surf, via 'n'/'x' — arestas brancas). Mão única f→j (vai mas não volta). O
// GRASS inferior-direito (g33) tem 4 acessos (t, r, u, aa).
const VIRIDIAN_NODES: Record<string, MapPos> = {
  a: { x: 0.634, y: 0.041 },
  b: { x: 0.844, y: 0.041 },
  c: { x: 0.447, y: 0.116 },
  d: { x: 0.634, y: 0.116 },
  e: { x: 0.634, y: 0.261 },
  f: { x: 0.761, y: 0.261 },
  g: { x: 0.844, y: 0.261 },
  h: { x: 0.447, y: 0.371 },
  i: { x: 0.531, y: 0.371 },
  j: { x: 0.761, y: 0.371 },
  k: { x: 0.185, y: 0.535 },
  l: { x: 0.302, y: 0.535 },
  m: { x: 0.447, y: 0.535 },
  n: { x: 0.302, y: 0.643 },
  o: { x: 0.447, y: 0.643 },
  p: { x: 0.531, y: 0.643 },
  q: { x: 0.648, y: 0.643 },
  r: { x: 0.749, y: 0.643 },
  s: { x: 0.844, y: 0.643 },
  t: { x: 0.648, y: 0.755 },
  u: { x: 0.844, y: 0.755 },
  v: { x: 0.302, y: 0.87 }, // (surf) — laguinho; hospeda a Missão Especial
  x: { x: 0.447, y: 0.87 },
  y: { x: 0.544, y: 0.87 },
  z: { x: 0.648, y: 0.87 },
  aa: { x: 0.749, y: 0.87 },
  ab: { x: 0.844, y: 0.87 },
  // Áreas de exploração (GRASS): nós dedicados sobre os retângulos, ligados ao(s) ponto(s) de acesso.
  g31: { x: 0.447, y: 0.042 }, // GRASS topo (acesso 'c')
  g32: { x: 0.046, y: 0.535 }, // GRASS esquerda (acesso 'k')
  g33: { x: 0.749, y: 0.752 }, // GRASS inferior-dir (acesso 't', 'r', 'u', 'aa')
}

// Arestas NÃO-direcionadas (ligam os dois sentidos). A mão única f→j fica em DIRECTED.
const VIRIDIAN_EDGES: [string, string][] = [
  ['a', 'b'],
  ['a', 'd'],
  ['b', 'g'],
  ['c', 'd'],
  ['c', 'h'],
  ['d', 'e'],
  ['e', 'f'],
  ['f', 'g'],
  ['h', 'i'],
  ['h', 'm'],
  ['i', 'j'],
  ['k', 'l'],
  ['l', 'm'],
  ['l', 'n'],
  ['m', 'o'],
  ['n', 'o'],
  ['n', 'v'], // branca (surf)
  ['o', 'p'],
  ['o', 'x'],
  ['p', 'q'],
  ['q', 'r'],
  ['q', 't'],
  ['r', 's'],
  ['s', 'u'],
  ['t', 'z'],
  ['u', 'ab'],
  ['v', 'x'], // branca (surf)
  ['x', 'y'],
  ['y', 'z'],
  ['z', 'aa'],
  ['aa', 'ab'],
  // acesso às áreas de exploração (uma aresta por seta roxa do GRASS)
  ['c', 'g31'],
  ['k', 'g32'],
  ['t', 'g33'],
  ['r', 'g33'],
  ['u', 'g33'],
  ['aa', 'g33'],
]

// Arestas de MÃO ÚNICA: vai mas não volta (f→j; 'j' não lista 'f').
const VIRIDIAN_DIRECTED_EDGES: [string, string][] = [['f', 'j']]

// Âncoras de EXIBIÇÃO: o popup aparece SOBRE o retângulo da arte (distinto da letra de parada).
// Nenhuma letra hospeda mais de um pop-up aqui, então todas as chaves são simples.
const VIRIDIAN_MARKERS: Record<string, MapPos> = {
  f: { x: 0.776, y: 0.118 }, // GYM (sobre o ginásio)
  y: { x: 0.544, y: 0.702 }, // CP — centro (sobre o P.C)
  r: { x: 0.761, y: 0.481 }, // MART (sobre o prédio)
  v: { x: 0.185, y: 0.767 }, // SPEC1 (sobre o retângulo laranja, à esq. do laguinho)
  i: { x: 0.534, y: 0.206 }, // HOUSE (topo)
  p: { x: 0.534, y: 0.461 }, // HOUSE (meio)
}

const VIRIDIAN_GRAPH: CityGraph = {
  nodes: VIRIDIAN_NODES,
  adj: buildAdjacency(VIRIDIAN_NODES, VIRIDIAN_EDGES, VIRIDIAN_DIRECTED_EDGES),
  markers: VIRIDIAN_MARKERS,
  surfNodes: ['v'],
}

// Sítio → ponto do grafo (pop-ups da arte anotada de Viridian).
const VIRIDIAN_SITE_NODES: CitySiteNodes = {
  gym: 'f', // GYM
  center: 'y', // CP
  mart: ['r'], // MART
  specialMission: ['v'], // SPEC1 — ponto único, atrás d'água (só por Surf)
  houses: ['i', 'p'], // HOUSE ×2
  green: ['g31', 'g32', 'g33'], // GRASS ×3 (g33 com 4 acessos)
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
      { speciesId: 48, level: 1 }, // Venonat
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
    graph: FUCHSIA_GRAPH,
    siteNodes: FUCHSIA_SITE_NODES,
    trainers: FUCHSIA_TRAINERS,
  },
  {
    name: 'Saffron',
    primaryType: 'psychic',
    secondaryType: 'ghost',
    starters: [
      { speciesId: 63, level: 3 }, // Abra
      { speciesId: 79, level: 1 }, // Slowpoke
    ],
    graph: SAFFRON_GRAPH,
    siteNodes: SAFFRON_SITE_NODES,
    trainers: SAFFRON_TRAINERS,
  },
  {
    name: 'Cinnabar',
    primaryType: 'fire',
    secondaryType: 'fighting',
    starters: [
      { speciesId: 58, level: 3 }, // Growlithe
      { speciesId: 77, level: 1 }, // Ponyta
    ],
    graph: CINNABAR_GRAPH,
    siteNodes: CINNABAR_SITE_NODES,
    trainers: CINNABAR_TRAINERS,
  },
  {
    name: 'Viridian',
    primaryType: 'ground',
    secondaryType: 'normal',
    starters: [
      { speciesId: 52, level: 3 }, // Meowth
      { speciesId: 32, level: 1 }, // Nidoran♂
    ],
    graph: VIRIDIAN_GRAPH,
    siteNodes: VIRIDIAN_SITE_NODES,
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
