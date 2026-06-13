// Tipos de domínio compartilhados (PLAN §4 / §5).

/** Ordem canônica fixa dos 6 eixos do radar (60° entre si) — PLAN §4.2. */
export const ATTR_KEYS = [
  'batalha',
  'inteligencia',
  'carisma',
  'agilidade',
  'resistencia',
  'percepcao',
] as const

export type AttrKey = (typeof ATTR_KEYS)[number]

/** Mapa de atributos (0–100) indexado pelos eixos canônicos. */
export type Attrs = Record<AttrKey, number>

/** Os 15 tipos da Gen 1. */
export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
] as const

export type PokemonType = (typeof POKEMON_TYPES)[number]

/** Estado de um Pokémon do roster durante o dia (PLAN §5). */
export type PokemonStatus =
  | 'idle'
  | 'traveling'
  | 'onMission'
  | 'defending'
  | 'fainted'
  | 'atCenter'

export interface Pokemon {
  id: string
  speciesId: number
  level: number
  xp: number
  types: PokemonType[]
  /** Base curada por espécie (10–50). */
  baseAttrs: Attrs
  /** Pontos alocados por nível; efetivo = base + alocação * 10. */
  allocations: Attrs
  currentHp: number
  maxHp: number
  status: PokemonStatus
  passives: string[]
}

/** Fase do dia (PLAN §3 / §5). */
export type GamePhase = 'MORNING' | 'DAY' | 'CAPTURE' | 'SUMMARY'

/** Velocidade do relógio: 0 = pausa. */
export type GameSpeed = 0 | 1 | 2 | 3

/** Posição normalizada (0–1) sobre a arte do mapa — PLAN §3.1. */
export interface MapPos {
  x: number
  y: number
}

/** Inimigo efêmero de uma defesa de ginásio (só Batalha + tipo) — PLAN §4.4. */
export interface EnemyUnit {
  battle: number
  types: PokemonType[]
}
