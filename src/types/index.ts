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
  // Genéricos.
  'YOUNGSTER',
  'BIRD_KEEPER',
  'LASS',
  'BROCK',
  'HIKER',
  // Rivais — entram no pool de TODA cidade (ver RIVAL_TRAINER_IDS), além da lista local.
  'BRENDAN',
  'MAY',
  'LEAF',
  'RED',
  // Cerulean (água/gelo).
  'MISTY',
  'PICNICKER',
  'PARASOL_LADY',
  'FISHERMAN',
  'POKEFAN',
  // Vermilion (3) — electric/dragon.
  'SURGE',
  'VERMILION_ENGINEER',
  'VERMILION_ROCKER',
  'VERMILION_SAILOR',
  'VERMILION_GENTLEMAN',
  'VERMILION_POKEMANIAC',
  // Celadon (4) — grass/bug.
  'ERIKA',
  'CELADON_BEAUTY',
  'CELADON_LASS',
  'CELADON_PICNICKER',
  'CELADON_BUGCATCHER',
  'CELADON_GAMER',
  // Fuchsia (5) — poison/dragon.
  'KOGA',
  'FUCHSIA_JUGGLER',
  'FUCHSIA_TAMER',
  'FUCHSIA_DRAGONTAMER',
  'FUCHSIA_BIRDKEEPER',
  'FUCHSIA_SWIMMER',
  // Saffron (6) — psychic/ghost.
  'SABRINA',
  'SAFFRON_ACETRAINER',
  'SAFFRON_SCIENTIST',
  'SAFFRON_CHANNELER',
  'SAFFRON_HEXMANIAC',
  'SAFFRON_BLACKBELT',
  // Cinnabar (7) — fire/fighting.
  'BLAINE',
  'CINNABAR_BURGLAR',
  'CINNABAR_SUPERNERD',
  'CINNABAR_BLACKBELT',
  'CINNABAR_KINDLER',
  'CINNABAR_SWIMMER',
  // Viridian (8) — ground/normal.
  'GIOVANNI',
  'VIRIDIAN_TAMER',
  'VIRIDIAN_ACETRAINER',
  'VIRIDIAN_YOUNGSTER',
  'VIRIDIAN_CAMPER',
  'VIRIDIAN_BIKER',
] as const

/**
 * Rivais: aparecem no pool de invasores de TODA cidade, independente da lista local da cidade
 * (anexados no sorteio do dia — engine/setup). Subconjunto de TRAINER_IDS.
 */
export const RIVAL_TRAINER_IDS = ['BRENDAN', 'MAY', 'LEAF', 'RED'] as const

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
   * Corações de afininade (0..5, passo 0,5). Novos Pokémon começam com 2. Cada coração dá +10% de
   * XP ganho (teto +50%). Sobem/descem no fim do dia conforme o desempenho. Ausente = trata como 2.
   */
  hearts?: number
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
  /** Shiny: 1% no encontro/criação. Sempre rank S e com sprite própria. Ausente = não-shiny. */
  shiny?: boolean
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

/** Tier de medalha de um invasor: Bronze < Prata < Ouro (bônus de Batalha crescente). */
export type MedalTier = 'bronze' | 'silver' | 'gold'

/** Inimigo efêmero de uma defesa de ginásio (só Batalha + tipo) — PLAN §4.4. */
export interface EnemyUnit {
  battle: number
  types: PokemonType[]
  /** Espécie do invasor — usada só para exibir o sprite na batalha (pode faltar em dados antigos/testes). */
  speciesId?: number
  /** Medalha sorteada por dia (chance/raridade crescem com o dia): soma Batalha e exibe o selo. */
  medal?: MedalTier
  /** Sexo sorteado pela proporção da espécie (exibido na foto; ausente em dados antigos). */
  gender?: Gender
}
