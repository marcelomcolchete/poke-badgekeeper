// Tipos da camada de dados estáticos (PLAN §5).

import type { AttrKey, Attrs, MapPos, PokemonType, Rarity, TrainerId } from '../types/index.ts'

/** Espécie como sai do gerador (sem informação de evolução). */
export interface SpeciesBase {
  id: number
  /** Nome da PokéAPI (minúsculo, ex.: "nidoran-f"). */
  name: string
  /** Nome de exibição (ex.: "Nidoran♀"). */
  displayName: string
  types: PokemonType[]
  /** Atributos base derivados dos stats oficiais (10–50) — PLAN §4.1. */
  baseAttrs: Attrs
  /** Raridade no sorteio de captura/preparação (PLAN §4.5). */
  rarity: Rarity
  spritePath: string
}

/** Um passo de evolução: `from` vira `to` ao atingir `atLevel` (escala 1–10) — PLAN §4.1.1. */
export interface EvolutionStep {
  from: number
  to: number
  atLevel: number
}

/** Espécie completa (base + evolução resolvida). */
export interface Species extends SpeciesBase {
  /**
   * Próximas formas e o nível de jogo em que evolui (null se não evolui). Pode haver
   * mais de um alvo (ex.: Eevee): a evolução sorteia um deles via RNG — PLAN §4.1.1.
   */
  evolvesTo: { ids: number[]; atLevel: number } | null
  /** Menor nível em que pode surgir como selvagem (1, ou o nível em que esta forma evolui) — PLAN §4.5. */
  minWildLevel: number
}

/**
 * Grafo de deslocamento da cidade (PLAN §3.1): os pontos (a–s) por onde os Pokémon
 * caminham do ginásio até a missão e de volta. Posições normalizadas 0–1 e adjacência
 * NÃO-direcionada (simétrica). O menor caminho entre dois pontos define o tempo de viagem.
 */
export interface CityGraph {
  /** Posição normalizada (0–1) de cada ponto, indexada pelo id (ex.: 'j'). */
  nodes: Record<string, MapPos>
  /** Vizinhos de cada ponto (sempre simétrico: se a∈adj[b] então b∈adj[a]). */
  adj: Record<string, string[]>
  /**
   * Âncora de EXIBIÇÃO do popup/marcador de cada ponto (PLAN §3.1): onde o ícone
   * da missão/captura/defesa aparece SOBRE a arte (números enumerados do mapa), que é
   * distinta do ponto de PARADA (a letra para onde os Pokémon caminham). Sem entrada,
   * o marcador cai no próprio ponto do grafo (`nodes[id]`).
   */
  markers: Record<string, MapPos>
  /**
   * Custo EXPLÍCITO de arestas (chave canônica "a|b" ordenada), sobrepondo a distância
   * geométrica. Usado pelo túnel do Dig (atravessar por baixo da terra custa quase nada),
   * ausente nas arestas normais — PLAN §3.1 (Habilidade Secreta).
   */
  edgeCosts?: Record<string, number>
}

/**
 * Sítios do mapa → ponto do grafo ONDE cada tipo de evento/missão surge.
 * Cada categoria só nasce no seu sítio; captura só nas áreas verdes; defesa só no
 * ginásio. Sítios únicos apontam um ponto; houses/green listam vários.
 */
export interface CitySiteNodes {
  /** Ginásio: origem das viagens e única origem das defesas. */
  gym: string
  /** Centro Pokémon: missões 'center' (curam o time no sucesso). */
  center: string
  /** Poké Mart: missões 'mart' (recompensa em ouro). */
  mart: string
  /** Antigo ponto do museu: onde a missão Rocket Team surge nesta cidade. */
  museum: string
  /** Casas: missões 'house'. */
  houses: string[]
  /** Áreas verdes: missões 'freeArea' e os spots de captura do dia. */
  green: string[]
}

/** Inicial fixo da cidade: espécie + nível fixos; a UI sorteia 3 versões para escolher. */
export interface CityStarter {
  speciesId: number
  level: number
}

/** Cidade de Kanto (PLAN §3.1 / §4.7 / §4.8). */
export interface CityData {
  index: number
  name: string
  /** Tipos fixos do ginásio (primário + secundário). */
  primaryType: PokemonType
  secondaryType: PokemonType
  /** Iniciais fixos da cidade (espécie + nível); a UI deixa escolher entre 3 versões de cada. */
  starters: CityStarter[]
  /** Arte top-down de fundo da fase Dia. */
  mapImage: string
  /** Capa ilustrada (perspectiva) para o card do menu de seleção. */
  coverImage: string
  /** Dimensões nativas da arte (px) — reservam a proporção e evitam layout shift. */
  mapW: number
  mapH: number
  /** Grafo de deslocamento (pontos a–s + adjacência) — PLAN §3.1. */
  graph: CityGraph
  /** Mapeamento sítio → ponto do grafo (ginásio, centro, mart, museu, casas, verdes). */
  siteNodes: CitySiteNodes
  /** Classes de treinador que podem invadir o ginásio nesta cidade (PLAN §4.4). */
  trainers: TrainerId[]
}

export type ItemKind = 'usable' | 'passive'

export interface ItemData {
  id: string
  name: string
  kind: ItemKind
  price: number
  description: string
}

/**
 * Modo de geração da exigência de uma missão (rolada por dia no spawn):
 * - 'normal': 1 atributo principal (primaryAttr) + 1 secundário sorteado (pode coincidir
 *   com o principal → "mega"); demais eixos são "resto".
 * - 'special2': 2 principais + 1 secundário + 3 restos, todos com eixos sorteados (Pokecenter/Pokemart).
 * - 'special5': 5 principais + 1 resto, eixos sorteados (Rocket Team).
 */
export type MissionGen = 'normal' | 'special2' | 'special5'

/**
 * Modelo (tipo) de missão. A exigência por eixo NÃO é estática: é gerada e gravada na
 * instância no momento do spawn (escala com o dia) — ver engine/missions.ts. O template
 * descreve só o tipo, o perigo, o tempo de execução e as recompensas.
 */
export interface MissionTemplate {
  id: string
  name: string
  /** Ícone/emoji do tema (exibido no popup/marcador do mapa) — PLAN §3.1. */
  themeIcon: string
  /** Como a exigência é gerada (ver MissionGen). */
  gen: MissionGen
  /** Atributo principal (mais exigido) — apenas tipos normais (gen 'normal'). */
  primaryAttr?: AttrKey
  /** Tempo-base de execução no local (ms de jogo) — PLAN §4.3. */
  baseExecutionMs: number
  /** Perigo da missão (dano em caso de falha) — PLAN §4.2. */
  danger: number
  /** Recompensa: cura o time no sucesso (Pokecenter). */
  healOnSuccess?: boolean
  /** Recompensa: ouro concedido no sucesso (Pokemart). */
  goldOnSuccess?: number
  /**
   * Missão da Equipe Rocket: ao concluir a parte de atributos, o time enfrenta um treinador
   * Rocket numa batalha (PLAN — Rocket Team). As recompensas (ouro + 3× XP) só vêm na vitória.
   */
  isRocket?: boolean
}

export interface PassiveData {
  id: string
  name: string
  description: string
}
