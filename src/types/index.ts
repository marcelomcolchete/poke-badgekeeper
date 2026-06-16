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

/**
 * Os 15 tipos da Gen 1 + Aço (steel). Aço não existe na Gen 1 — foi adicionado para o
 * ginásio de Vermilion (secundário Aço). Nenhuma espécie é Aço por ora; a tipagem do
 * Magnemite & cia. (dado gerado) fica para quando Vermilion for implementada.
 */
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
  'steel',
] as const

export type PokemonType = (typeof POKEMON_TYPES)[number]

/** Raridades, da mais comum à mais rara (PLAN §4.5 — sistema de raridade). */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legend'] as const

export type Rarity = (typeof RARITIES)[number]

/**
 * Classes de treinador que podem invadir o ginásio na defesa (PLAN §4.4). Cada cidade
 * define quais aparecem; cada classe tem o seu próprio elenco de Pokémon (data/trainers).
 */
export const TRAINER_IDS = [
  'YOUNGSTER',
  'BIRD_KEEPER',
  'LASS',
  'BROCK',
  'HIKER',
  'BRENDAN',
  'MAY',
  'LEAF',
  'RED',
] as const

/**
 * Treinadores da Equipe Rocket (missão Rocket Team). Ficam FORA do pool de invasores do
 * ginásio (TRAINER_IDS): só aparecem na batalha da missão Rocket (PLAN — Rocket Team).
 */
export const ROCKET_TRAINER_IDS = ['ROCKET_TEAM_MALE', 'ROCKET_TEAM_FEMALE'] as const

export type RocketTrainerId = (typeof ROCKET_TRAINER_IDS)[number]

export type TrainerId = (typeof TRAINER_IDS)[number] | RocketTrainerId

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
  /** Variação sorteada no encontro/criação: −10 a +10 por eixo (pode zerar o atributo). */
  ivs: Attrs
  /** Pontos alocados por nível; efetivo = base + iv + alocação * modificador de natureza. */
  allocations: Attrs
  currentHp: number
  maxHp: number
  status: PokemonStatus
  passives: string[]
  /**
   * Quantas das TRÊS Habilidades Secretas da LINHA este indivíduo já desbloqueou (0..3),
   * gravado no Pokémon e preservado na evolução. Sobe +1 a cada vez que é o Destaque do Dia
   * (1ª vez → habilidade 1, 2ª → 2, 3ª → 3). Ausente/0 = nenhuma desbloqueada.
   */
  secretCount?: number
  /**
   * Buffs temporários por eixo aplicados por itens x_* (somados ao atributo efetivo, afetando
   * inclusive o HP). Valem só no dia da compra e são limpos na virada do dia. Ausente = sem buff.
   */
  dayBuffs?: Partial<Attrs>
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

/**
 * Categoria temática de uma missão; cada uma só nasce no seu tipo de sítio. 'freeArea' é
 * LEGADO (áreas verdes hoje são só captura) — mantida para compatibilidade de saves antigos,
 * mas não é mais sorteada no agendamento do dia (ver DAILY_CATEGORY_POOL).
 */
export const MISSION_CATEGORIES = ['center', 'mart', 'house', 'freeArea', 'rocket'] as const

export type MissionCategory = (typeof MISSION_CATEGORIES)[number]

/** Sítio onde cada categoria de missão surge no mapa (Rocket nasce no antigo ponto do museu). */
export const CATEGORY_SITE: Record<MissionCategory, SiteKind> = {
  center: 'center',
  mart: 'mart',
  house: 'house',
  freeArea: 'green',
  rocket: 'museum',
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
  /** Desafiante em destaque: recebeu +15 de Batalha e exibe medalha (1 por esquadrão). */
  buffed?: boolean
  /** Sexo sorteado pela proporção da espécie (exibido na foto; ausente em dados antigos). */
  gender?: Gender
}
