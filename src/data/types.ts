// Tipos da camada de dados estáticos (PLAN §5).

import type { Attrs, MapPos, PokemonType, Rarity } from '../types/index.ts'

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
  /** Próxima forma e o nível de jogo em que evolui (null se não evolui). */
  evolvesTo: { id: number; atLevel: number } | null
  /** Menor nível em que pode surgir como selvagem (1, ou o nível em que esta forma evolui) — PLAN §4.5. */
  minWildLevel: number
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
  /** Multiplicador de dificuldade (curva de missões/defesas) — PLAN §4.8. */
  difficultyFactor: number
  /** Âncoras normalizadas (0–1) onde missões podem surgir. */
  missionAnchors: MapPos[]
  /** Áreas de captura fixas (sempre visíveis). */
  captureSpots: MapPos[]
  /** Posição do ginásio (onde surge o símbolo de defesa). */
  gymPos: MapPos
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
  requirement: Attrs
  /** Tempo-base de viagem e execução (ms de jogo) — PLAN §4.3. */
  baseTravelMs: number
  baseExecutionMs: number
  /** Perigo da missão (dano em caso de falha) — PLAN §4.2. */
  danger: number
}

export interface PassiveData {
  id: string
  name: string
  description: string
}
