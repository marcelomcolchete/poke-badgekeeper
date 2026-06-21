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
  /** Caminho da sprite shiny (derivado do id) — exibido quando o indivíduo é shiny. */
  shinySpritePath: string
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
  /**
   * Pontos que só Pokémon com a Habilidade Secreta "Surf" desbloqueada conseguem atravessar
   * (corredores de água — ex.: 'a'/'n' em Cerulean). Hoje é apenas METADADO do mapa: o bloqueio
   * de despacho quando o menor caminho cruza um destes pontos e ninguém do time tem Surf entra
   * com o plano da Habilidade Surf. Ausente = nenhum ponto exige Surf.
   */
  surfNodes?: string[]
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
  /**
   * Poké Mart: pontos onde a missão 'mart' pode surgir (recompensa em ouro). Cidades com um
   * único mart usam lista de 1 elemento; Celadon tem 2 (['j', 'n']) — a missão sorteia um deles.
   */
  mart: string[]
  /**
   * Pontos onde a Missão Especial pode surgir (um por local especial da cidade, EM ORDEM).
   * Cidades com um único local usam lista de 1 elemento; Celadon pode ter 2 (['x', 'y']).
   * `run.specialChances` é indexado pela ordem desta lista.
   */
  specialMission: string[]
  /** Casas: missões 'house'. */
  houses: string[]
  /** Áreas verdes (exploração 3.x): APENAS os spots de captura do dia — não hospedam missões. */
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
  /** Mapeamento sítio → ponto do grafo (ginásio, centro, mart, missão especial, casas, verdes). */
  siteNodes: CitySiteNodes
  /** Classes de treinador que podem invadir o ginásio nesta cidade (PLAN §4.4). */
  trainers: TrainerId[]
}

/** As duas famílias de itens (PLAN — Sistema de Itens): consumível dura até disparar; passivo, a run toda. */
export type ItemKind = 'consumable' | 'passive'

/**
 * Efeito concreto de um item (união discriminada). Dirige tanto a compra (marketFlow) quanto
 * os efeitos na engine:
 * - heal/revive: vão pro inventário com `uses` cargas e são USADOS manualmente (clique na barra
 *   de itens). `scope: 'single'` pede um Pokémon-alvo; `scope: 'team'` aplica no time inteiro.
 * - statBuff: +amount num atributo de TODO o time, só no dia (dayBuffs); não vai pro inventário.
 * - passive: adiciona o `id` do item a s.runItems (efeito permanente lido pela engine).
 * - rareCandy: na compra, escolhe um Pokémon que sobe 1 nível.
 * - premierBall: na compra, sobe 1 nível a bola atual de graça (Pokébola→…→Masterball).
 * - moonStone: na compra, escolhe um Pokémon (time/caixa) que evolui 1 estágio ignorando o nível.
 */
export type ItemScope = 'single' | 'team'
export type ItemEffect =
  | { kind: 'heal'; scope: ItemScope; uses: number }
  | { kind: 'revive'; scope: ItemScope; uses: number }
  | { kind: 'statBuff'; attr: AttrKey; amount: number }
  | { kind: 'passive' }
  | { kind: 'rareCandy' }
  | { kind: 'premierBall' }
  | { kind: 'moonStone' }

export interface ItemData {
  id: string
  name: string
  /** Família para exibição (consumível × passivo). */
  type: ItemKind
  price: number
  description: string
  /** Caminho da sprite (public/sprites/itens/<id>.png). */
  sprite: string
  effect: ItemEffect
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
}

export interface PassiveData {
  id: string
  name: string
  description: string
}
