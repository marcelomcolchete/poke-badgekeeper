// Tipos do GameState + estado inicial (PLAN §5).
// A engine é pura: recebe GameState + ação e retorna um NOVO GameState.

import type {
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

export type MissionStatus = 'available' | 'traveling' | 'inProgress' | 'resolved'

export interface MissionInstance {
  id: string
  templateId: string
  pos: MapPos
  /** Momento (ms de jogo) em que some se não aceita — PLAN §3.1. */
  expiresAtMs: number
  status: MissionStatus
  teamIds: string[]
}

export type DefenseStatus = 'scheduled' | 'active' | 'won' | 'lost'

export interface DefenseEvent {
  id: string
  /** Surge sobre o ginásio com timer mais longo que missões — PLAN §3.1 / §4.4. */
  expiresAtMs: number
  status: DefenseStatus
  squadIds: string[]
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
  approval: Approval
  gold: number
  inventory: ItemStack[]
  history: DayLog[]
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
    approval: { stars: STARS_START, dailyGoalMet: false },
    gold: 0,
    inventory: [],
    history: [],
  }
}
