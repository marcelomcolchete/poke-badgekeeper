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
  /** Próxima forma e o nível de jogo em que evolui (null se não evolui). */
  evolvesTo: { id: number; atLevel: number } | null
  /** Menor nível em que pode surgir como selvagem (1, ou o nível em que esta forma evolui) — PLAN §4.5. */
  minWildLevel: number
}

/**
 * Sítios do mapa: ONDE cada tipo de evento/missão surge (posições normalizadas 0–1).
 * Cada categoria de missão só nasce no seu sítio; captura só nas áreas verdes;
 * defesa só no ginásio. Sítios únicos têm um ponto; houses/green têm vários.
 */
export interface CitySites {
  /** Ginásio: única origem das defesas. */
  gym: MapPos
  /** Centro Pokémon: missões 'center' (curam o time no sucesso). */
  center: MapPos
  /** Poké Mart: missões 'mart' (recompensa em ouro). */
  mart: MapPos
  /** Museu: missão temática única da run (concede passiva). */
  museum: MapPos
  /** Casas: missões 'house'. */
  houses: MapPos[]
  /** Áreas verdes: missões 'freeArea' e os spots de captura do dia. */
  green: MapPos[]
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
  /** Dimensões nativas da arte (px) — reservam a proporção e evitam layout shift. */
  mapW: number
  mapH: number
  /** Multiplicador de dificuldade (curva de missões/defesas) — PLAN §4.8. */
  difficultyFactor: number
  /** Sítios do mapa (ginásio, centro, mart, museu, casas, áreas verdes). */
  sites: CitySites
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
