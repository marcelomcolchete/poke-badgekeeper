// Tipos da camada de dados estáticos (PLAN §5).

import type { Attrs, MapPos, MissionCategory, PokemonType, Rarity } from '../types/index.ts'

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
  /** Museu: missão temática única da run (concede passiva). */
  museum: string
  /** Casas: missões 'house'. */
  houses: string[]
  /** Áreas verdes: missões 'freeArea' e os spots de captura do dia. */
  green: string[]
}

/** Cidade de Kanto (PLAN §3.1 / §4.7 / §4.8). */
export interface CityData {
  index: number
  name: string
  /** Tipo primário fixo do ginásio. */
  primaryType: PokemonType
  /** Pokémon inicial (nível 3) do tipo primário. */
  starterSpeciesId: number
  /** Arte top-down de fundo da fase Dia. */
  mapImage: string
  /** Capa ilustrada (perspectiva) para o card do menu de seleção. */
  coverImage: string
  /** Dimensões nativas da arte (px) — reservam a proporção e evitam layout shift. */
  mapW: number
  mapH: number
  /** Multiplicador de dificuldade (curva de missões/defesas) — PLAN §4.8. */
  difficultyFactor: number
  /** Grafo de deslocamento (pontos a–s + adjacência) — PLAN §3.1. */
  graph: CityGraph
  /** Mapeamento sítio → ponto do grafo (ginásio, centro, mart, museu, casas, verdes). */
  siteNodes: CitySiteNodes
  /** Missão única do museu desta cidade (id de template 'museum'); ausente = sem museu. */
  museumMissionId?: string
}

export type ItemKind = 'usable' | 'passive'

export interface ItemData {
  id: string
  name: string
  kind: ItemKind
  price: number
  description: string
}

/** Modelo de missão: a exigência por eixo desenha o hexágono (PLAN §4.2). */
export interface MissionTemplate {
  id: string
  name: string
  /** Ícone/emoji do tema (exibido no popup do mapa) — PLAN §3.1. */
  themeIcon: string
  /** Categoria temática: define o sítio onde surge e as regras (cura/ouro/dificuldade). */
  category: MissionCategory
  requirement: Attrs
  /** Tempo-base de viagem e execução (ms de jogo) — PLAN §4.3. */
  baseTravelMs: number
  baseExecutionMs: number
  /** Perigo da missão (dano em caso de falha) — PLAN §4.2. */
  danger: number
  /** Passiva concedida ao concluir (usado pelas missões de museu). */
  grantsPassive?: string
}

export interface PassiveData {
  id: string
  name: string
  description: string
}
