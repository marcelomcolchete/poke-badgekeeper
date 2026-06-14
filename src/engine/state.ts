// Tipos do GameState + estado inicial (PLAN §5).
// A engine é pura: recebe GameState + ação e retorna um NOVO GameState.
// A Fase 3 acrescenta o runtime do dia (eventos com timing, buscas, encontros, tally).

import type {
  EnemyUnit,
  GamePhase,
  GameSpeed,
  MapPos,
  Pokemon,
  PokemonType,
} from '../types/index.ts'
import type { DuelLog } from './gymDefense.ts'
import { DAY_LENGTH_MS, STARS_START, STARTING_GOLD } from './constants.ts'

export interface RunInfo {
  /** Índice da cidade atual de Kanto (0..7). */
  cityIndex: number
  /** Dia atual (1..10). */
  day: number
  /** Seed-mestra da run (reprodutibilidade). */
  seed: number
  phase: GamePhase
  /** Motivo da derrota quando phase === 'GAMEOVER' (mensagem da tela de fim de jogo). */
  gameOverReason?: 'gym' | 'stars'
}

export interface ClockState {
  dayElapsedMs: number
  dayLengthMs: number
  speed: GameSpeed
}

export interface GymInfo {
  /** [primário, tipo2, tipo3] — definem o pool capturável (PLAN §4.5). */
  types: PokemonType[]
}

export type MissionStatus =
  | 'scheduled' // ainda não surgiu no mapa
  | 'available' // popup no mapa, aceitável até expirar
  | 'traveling' // time a caminho da missão (ida) — PLAN §4.3
  | 'inProgress' // executando no local
  | 'returning' // desfecho aplicado; time voltando ao ginásio
  | 'resolved' // concluída e time já em casa (ver result)

export type MissionResult = 'success' | 'failure' | 'expired'

export interface MissionInstance {
  id: string
  templateId: string
  /** Ponto do grafo onde a missão surge — define o trajeto desde o ginásio (PLAN §3.1). */
  node: string
  /** Menor caminho ginásio→ponto (ids), calculado ao aceitar; a volta é o reverso. */
  path: string[]
  /** Momento (ms de jogo) em que aparece no mapa. */
  spawnAtMs: number
  /** Momento em que some se não for aceita — PLAN §3.1. */
  expiresAtMs: number
  status: MissionStatus
  teamIds: string[]
  /** Marcos de tempo definidos ao aceitar (ms de jogo) — PLAN §4.3. */
  acceptedAtMs: number | null
  /** Fim da viagem de ida (chegada ao local). */
  arriveAtMs: number | null
  /** Fim da execução = desfecho aplicado; início da volta. */
  resolveAtMs: number | null
  /** Chegada de volta ao ginásio = time liberado. */
  returnEndsAtMs: number | null
  result: MissionResult | null
  pSuccess: number | null
  /**
   * Sub-seed do RNG de evolução, sorteado ao resolver. O XP só é APLICADO na volta ao
   * ginásio (PLAN §4.1, ajuste) — guardar o seed mantém a evolução determinística.
   */
  xpSeed?: number
}

export type DefenseStatus =
  | 'scheduled' // agendada, ainda não surgiu
  | 'active' // símbolo no ginásio, aguardando esquadrão (timer mais longo)
  | 'won'
  | 'lost'

export interface DefenseEvent {
  id: string
  pos: MapPos
  spawnAtMs: number
  /** Surge sobre o ginásio com timer mais longo que missões — PLAN §3.1 / §4.4. */
  expiresAtMs: number
  status: DefenseStatus
  squadIds: string[]
  /** Inimigos sorteados quando a defesa surge (matchup fixo/semeado). */
  enemies: EnemyUnit[]
  /** Log da cadeia de duelos, preenchido ao resolver — alimenta o modal de batalha (§4.4). */
  duels: DuelLog[]
}

/** Busca de captura em andamento: um Pokémon viaja até o spot e procura até gerar encontro (PLAN §4.5). */
export interface CaptureSearch {
  searcherId: string
  spotIndex: number
  /** Ponto da grama (do grafo) — define o trajeto desde o ginásio. */
  node: string
  /** Menor caminho ginásio→ponto (ida); a volta é o reverso. */
  path: string[]
  /** Fase: 'traveling' (a caminho) ou 'searching' (procurando no local). */
  phase: 'traveling' | 'searching'
  /** Saída do ginásio (início da ida) — base da animação. */
  departAtMs: number
  /** Chegada ao local (início da busca). */
  arriveAtMs: number
  /** Fim da busca = encontro gerado. */
  readyAtMs: number
}

/** Procurador voltando ao ginásio após capturar/dispensar — só fica idle ao chegar (PLAN §4.5). */
export interface CaptureReturn {
  searcherId: string
  /** Índice da área de captura (em captureSpots) de onde está voltando — marcador no mapa (#6). */
  spotIndex: number
  /** Capturou alguém nesta exploração? Define o ícone ✓/✗ do marcador na volta (#6). */
  captured: boolean
  node: string
  path: string[]
  departAtMs: number
  arriveAtMs: number
}

/** Encontro pronto: 3 candidatos para o jogador decidir (capturar / voltar / seguir) — PLAN §4.5. */
export interface CaptureEncounter {
  searcherId: string
  spotIndex: number
  level: number
  candidateSpeciesIds: number[]
  /** Seed estável por candidato: preview = Pokémon capturado (natureza, IVs/rank) — §4.5. */
  candidateSeeds: number[]
}

export interface ItemStack {
  itemId: string
  quantity: number
}

export interface Approval {
  /** 1.0–5.0 em passos de 0.5 (PLAN §4.7). */
  stars: number
  dailyGoalMet: boolean
}

/** Registro de uma missão resolvida no dia (contagem + MVP no resumo). */
export interface MissionResultLog {
  templateId: string
  success: boolean
  teamIds: string[]
}

/** Um inimigo derrotado numa defesa do dia: quem derrotou + espécie (sprite no relatório). */
export interface DefenseKill {
  defeaterId: string
  /** Espécie do desafiante derrotado — usada só para a miniatura no relatório. */
  speciesId?: number
}

/** Acumulador do dia em curso (zerado a cada manhã) — base do resumo/aprovação. */
export interface DayTally {
  missionResults: MissionResultLog[]
  defensesTotal: number
  defensesWon: number
  /** Defesas LUTADAS e perdidas no dia (relatório de falhas). */
  defensesLost: number
  capturedIds: string[]
  goldEarned: number
  /** XP total concedido em missões bem-sucedidas no dia (relatório) — somado na volta. */
  xpEarned: number
  /** Ouro vindo só de defesas (base do bônus de +30% por dia perfeito) — PLAN §4.6. */
  defenseGold: number
  /** Estrelas no início do dia (preenchido no fechamento) — para o resumo. */
  starsBefore: number
  /** Fossil já reviveu alguém hoje? (efeito 1×/dia). */
  fossilUsed: boolean
  /** Áreas de captura já exploradas hoje (índices em captureSpots) — somem do mapa. */
  exploredSpots: number[]
  /** Inimigos derrotados em defesas hoje (MVP por derrotas + miniaturas no relatório). */
  defenseKills: DefenseKill[]
}

export interface DayLog {
  day: number
  starsAfter: number
  goldEarned: number
  captured: number
}

export interface GameState {
  run: RunInfo
  clock: ClockState
  gym: GymInfo
  /** 1..9 Pokémon (despacha 1–6 por missão). */
  roster: Pokemon[]
  missions: MissionInstance[]
  defenses: DefenseEvent[]
  captureSearches: CaptureSearch[]
  /** Procuradores voltando ao ginásio após o encontro (PLAN §4.5). */
  captureReturns: CaptureReturn[]
  encounters: CaptureEncounter[]
  /** Pontos de grama (ids do grafo) com captura ativa hoje (1×/dia) — spots no mapa. */
  captureSpots: string[]
  /** Horário (ms de jogo) em que cada spot de captura surge no mapa — alinhado a captureSpots. */
  captureSpotSpawnsAtMs: number[]
  approval: Approval
  gold: number
  inventory: ItemStack[]
  /** Itens/passivas permanentes da run (ex.: 'fossil' do museu). */
  runItems: string[]
  today: DayTally
  history: DayLog[]
  /** Contador determinístico de ids de entidades (eventos/Pokémon). */
  nextId: number
  /** Cursor determinístico para derivar sub-seeds de RNG durante o dia. */
  rngCursor: number
}

export function emptyTally(): DayTally {
  return {
    missionResults: [],
    defensesTotal: 0,
    defensesWon: 0,
    defensesLost: 0,
    capturedIds: [],
    goldEarned: 0,
    xpEarned: 0,
    defenseGold: 0,
    starsBefore: 0,
    fossilUsed: false,
    exploredSpots: [],
    defenseKills: [],
  }
}

/** Estado inicial de uma nova run (antes da escolha do inicial e dos tipos do ginásio). */
export function createInitialState(seed: number): GameState {
  return {
    run: { cityIndex: 0, day: 1, seed, phase: 'MORNING' },
    clock: { dayElapsedMs: 0, dayLengthMs: DAY_LENGTH_MS, speed: 0 },
    gym: { types: [] },
    roster: [],
    missions: [],
    defenses: [],
    captureSearches: [],
    captureReturns: [],
    encounters: [],
    captureSpots: [],
    captureSpotSpawnsAtMs: [],
    approval: { stars: STARS_START, dailyGoalMet: false },
    gold: STARTING_GOLD,
    inventory: [],
    runItems: [],
    today: emptyTally(),
    history: [],
    nextId: 1,
    rngCursor: 0,
  }
}
