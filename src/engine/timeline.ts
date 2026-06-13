// Agenda do dia: quantas missões/defesas surgem e QUANDO/ONDE, tudo semeado e
// escalando com o dia e o fator da cidade (PLAN §4.8). A instanciação do conteúdo
// (template da missão, inimigos da defesa) fica para missions.ts/gymDefense.ts.

import type { CityData } from '../data/types.ts'
import { createRng, deriveSeed, type Rng } from './rng.ts'
import { DAY_LENGTH_MS, TOTAL_DAYS } from './constants.ts'
import {
  MAX_DEFENSES,
  MAX_MISSIONS,
  MIN_DEFENSES,
  MIN_MISSIONS,
  SPAWN_WINDOW_FRACTION,
} from './balance.ts'
import { clamp, lerp } from './math.ts'

/** Contagem por dia: round(lerp(min, max, (dia−1)/9) · fatorCidade) — PLAN §4.8. */
export function countForDay(day: number, min: number, max: number, difficultyFactor: number): number {
  const t = clamp((day - 1) / (TOTAL_DAYS - 1), 0, 1)
  return Math.max(0, Math.round(lerp(min, max, t) * difficultyFactor))
}

export function missionsForDay(day: number, city: CityData): number {
  return countForDay(day, MIN_MISSIONS, MAX_MISSIONS, city.difficultyFactor)
}

export function defensesForDay(day: number, city: CityData): number {
  return countForDay(day, MIN_DEFENSES, MAX_DEFENSES, city.difficultyFactor)
}

export interface SpawnSlot {
  /** Momento (ms de jogo) em que o evento surge no mapa. */
  atMs: number
  /** Índice da âncora do mapa (missão); defesa usa o ginásio (0). */
  anchorIndex: number
  /** Sub-seed estável para o conteúdo (template/inimigos) ser rolado na hora. */
  seed: number
}

export interface DaySchedule {
  day: number
  missions: SpawnSlot[]
  defenses: SpawnSlot[]
}

function scheduleSpawns(rng: Rng, count: number, anchorCount: number): SpawnSlot[] {
  const window = DAY_LENGTH_MS * SPAWN_WINDOW_FRACTION
  const slots: SpawnSlot[] = Array.from({ length: count }, () => ({
    atMs: Math.floor(rng.float(0, window)),
    anchorIndex: anchorCount > 0 ? rng.int(0, anchorCount - 1) : 0,
    seed: rng.int(0, 0x7fffffff),
  }))
  return slots.sort((a, b) => a.atMs - b.atMs)
}

/** Agenda completa do dia (missões + defesas), reprodutível pelo seed da run + dia (PLAN §3.1/§4.8). */
export function buildDaySchedule(seed: number, day: number, city: CityData): DaySchedule {
  const rng = createRng(deriveSeed(seed, day))
  return {
    day,
    missions: scheduleSpawns(rng, missionsForDay(day, city), city.missionAnchors.length),
    defenses: scheduleSpawns(rng, defensesForDay(day, city), 1),
  }
}
