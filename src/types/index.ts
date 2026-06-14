// Tipos de domínio compartilhados (PLAN §4 / §5).
// Nota: o tipo Nature vive em src/data/natures.ts para evitar dependência circular.

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

/** Raridades, da mais comum à mais rara (PLAN §4.5 — sistema de raridade). */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legend'] as const

export type Rarity = (typeof RARITIES)[number]

/** Estado de um Pokémon do roster durante o dia (PLAN §5). */
export type PokemonStatus =
  | 'idle'
  | 'traveling' // a caminho da missão/área (ida)
  | 'onMission'
  | 'defending'
  | 'returning' // voltando ao ginásio (só fica 'idle' ao chegar)
  | 'fainted'
  | 'atCenter'

/** Sexo do Pokémon — sorteado na criação pela taxa da espécie (jogo original). */
export type Gender = 'male' | 'female' | 'genderless'

export interface Pokemon {
  id: string
  speciesId: number
  level: number
  xp: number
  types: PokemonType[]
  /** Base curada por espécie (10–50). */
  baseAttrs: Attrs
  /** Pontos alocados por nível; efetivo = base + alocação * modificador de natureza. */
  allocations: Attrs
  currentHp: number
  maxHp: number
  status: PokemonStatus
  passives: string[]
  /** Sexo sorteado na captura/criação pela proporção da espécie (PLAN §4.5). */
  gender: Gender
  /** Apelido dado pelo jogador na captura; null = usa o nome da espécie. */
  nickname: string | null
  /** Natureza sorteada na criação; null = sem natureza (saves migrados de v11). */
  nature: import('../data/natures.ts').Nature | null
}

/** Tipos de sítio no mapa da cidade — definem ONDE cada evento/missão pode surgir. */
export const SITE_KINDS = ['gym', 'center', 'mart', 'museum', 'house', 'green'] as const

export type SiteKind = (typeof SITE_KINDS)[number]

/** Categoria temática de uma missão; cada uma só nasce no seu tipo de sítio. */
export const MISSION_CATEGORIES = ['center', 'mart', 'house', 'freeArea', 'museum'] as const

export type MissionCategory = (typeof MISSION_CATEGORIES)[number]

/** Sítio onde cada categoria de missão surge no mapa. */
export const CATEGORY_SITE: Record<MissionCategory, SiteKind> = {
  center: 'center',
  mart: 'mart',
  house: 'house',
  freeArea: 'green',
  museum: 'museum',
}

/** Fase do dia (PLAN §3 / §5). GAMEOVER = derrota imediata (ex.: ginásio indefeso). */
export type GamePhase = 'MORNING' | 'DAY' | 'CAPTURE' | 'SUMMARY' | 'GAMEOVER'

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
  /** Espécie do invasor — usada só para exibir o sprite na batalha (pode faltar em dados antigos/testes). */
  speciesId?: number
}
