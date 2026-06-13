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
import { DAY_LENGTH_MS, STARS_START } from './constants.ts'

export interface RunInfo {
  /** Índice da cidade atual de Kanto (0..7). */
  cityIndex: number
  /** Dia atual (1..10). */
  day: number
  /** Seed-mestra da run (reprodutibilidade). */
  seed: number
  phase: GamePhase
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
  | 'traveling' // time a caminho (PLAN §4.3)
  | 'inProgress' // executando
  | 'resolved' // concluída (ver result)

export type MissionResult = 'success' | 'failure' | 'expired'

export interface MissionInstance {
  id: string
  templateId: string
  pos: MapPos
  /** Momento (ms de jogo) em que aparece no mapa. */
  spawnAtMs: number
  /** Momento em que some se não for aceita — PLAN §3.1. */
  expiresAtMs: number
  status: MissionStatus
  teamIds: string[]
  /** Fim da viagem e da execução (definidos ao aceitar) — PLAN §4.3. */
  travelEndsAtMs: number | null
  resolveAtMs: number | null
  result: MissionResult | null
  pSuccess: number | null
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
}

/** Busca de captura em andamento: um Pokémon ocupado num spot até gerar encontro (PLAN §4.5). */
export interface CaptureSearch {
  searcherId: string
  spotIndex: number
  readyAtMs: number
}

/** Encontro pronto: 3 candidatos para o jogador decidir (capturar / voltar / seguir) — PLAN §4.5. */
export interface CaptureEncounter {
  searcherId: string
  spotIndex: number
  level: number
  candidateSpeciesIds: number[]
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

/** Acumulador do dia em curso (zerado a cada manhã) — base do resumo/aprovação. */
export interface DayTally {
  missionResults: MissionResultLog[]
  defensesTotal: number
  defensesWon: number
  capturedIds: string[]
  goldEarned: number
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
  encounters: CaptureEncounter[]
  approval: Approval
  gold: number
  inventory: ItemStack[]
  today: DayTally
  history: DayLog[]
  /** Contador determinístico de ids de entidades (eventos/Pokémon). */
  nextId: number
  /** Cursor determinístico para derivar sub-seeds de RNG durante o dia. */
  rngCursor: number
}

export function emptyTally(): DayTally {
  return { missionResults: [], defensesTotal: 0, defensesWon: 0, capturedIds: [], goldEarned: 0 }
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
    encounters: [],
    approval: { stars: STARS_START, dailyGoalMet: false },
    gold: 0,
    inventory: [],
    today: emptyTally(),
    history: [],
    nextId: 1,
    rngCursor: 0,
  }
}
