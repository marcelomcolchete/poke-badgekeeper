// Agenda do dia: quantas missões/defesas surgem e QUANDO/ONDE, tudo semeado e
// escalando com o dia e o fator da cidade (PLAN §4.8). Cada missão sorteia uma
// CATEGORIA (que define o sítio onde nasce) e a captura escolhe 2 áreas verdes.
// A instanciação do conteúdo (template, inimigos) fica para missions.ts/gymDefense.ts.

import type { CityData } from '../data/types.ts'
import type { MissionCategory } from '../types/index.ts'
import { sitesForCategory } from '../data/cities.ts'
import { createRng, deriveSeed, type Rng } from './rng.ts'
import { DAY_LENGTH_MS, TOTAL_DAYS } from './constants.ts'
import {
  CAPTURE_SPOTS_PER_DAY,
  DAILY_CATEGORY_POOL,
  MAX_DEFENSES,
  MAX_MISSIONS,
  MIN_DEFENSES,
  MIN_MISSIONS,
  MUSEUM_DAY_MAX,
  MUSEUM_DAY_MIN,
  SPAWN_WINDOW_FRACTION,
} from './balance.ts'
import { clamp, lerp } from './math.ts'

/** Salt fixo para derivar o dia do museu a partir do seed da run. */
const MUSEUM_SEED_SALT = 0x4d757365 // 'Muse'

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

export interface MissionSlot {
  /** Momento (ms de jogo) em que a missão surge. */
  atMs: number
  /** Sub-seed estável para o conteúdo ser rolado na hora. */
  seed: number
  /** Categoria temática — define o sítio onde nasce. */
  category: MissionCategory
  /** Índice do sítio (dentro da lista da categoria) onde a missão surge. */
  siteIndex: number
  /** Template fixo (missão de museu); ausente = sorteia da categoria. */
  templateId?: string
}

export interface DefenseSlot {
  atMs: number
  seed: number
}

export interface DaySchedule {
  day: number
  missions: MissionSlot[]
  defenses: DefenseSlot[]
  /** Índices das áreas verdes (city.sites.green) que recebem captura hoje. */
  captureSiteIndices: number[]
}

/** Dia (semeado) em que a missão única do museu surge na run — PLAN §3.1 (#5). */
export function museumDay(seed: number): number {
  return createRng(deriveSeed(seed, MUSEUM_SEED_SALT)).int(MUSEUM_DAY_MIN, MUSEUM_DAY_MAX)
}

function randomTime(rng: Rng): number {
  return Math.floor(rng.float(0, DAY_LENGTH_MS * SPAWN_WINDOW_FRACTION))
}

function scheduleMissions(rng: Rng, count: number, city: CityData): MissionSlot[] {
  return Array.from({ length: count }, () => {
    const category = rng.pick(DAILY_CATEGORY_POOL)
    const siteCount = Math.max(1, sitesForCategory(city.sites, category).length)
    return {
      atMs: randomTime(rng),
      seed: rng.int(0, 0x7fffffff),
      category,
      siteIndex: rng.int(0, siteCount - 1),
    }
  })
}

function scheduleDefenses(rng: Rng, count: number): DefenseSlot[] {
  return Array.from({ length: count }, () => ({
    atMs: randomTime(rng),
    seed: rng.int(0, 0x7fffffff),
  }))
}

/** Escolhe (semeado) até CAPTURE_SPOTS_PER_DAY áreas verdes distintas para captura. */
function pickCaptureSpots(rng: Rng, greenCount: number): number[] {
  const n = Math.min(CAPTURE_SPOTS_PER_DAY, greenCount)
  const indices = Array.from({ length: greenCount }, (_, i) => i)
  return rng.shuffle(indices).slice(0, n)
}

/** Agenda completa do dia, reprodutível pelo seed da run + dia (PLAN §3.1/§4.8). */
export function buildDaySchedule(seed: number, day: number, city: CityData): DaySchedule {
  const rng = createRng(deriveSeed(seed, day))
  const missions = scheduleMissions(rng, missionsForDay(day, city), city)

  // Missão única do museu (#5): só na cidade que tem museu e no dia semeado da run.
  if (city.museumMissionId && day === museumDay(seed)) {
    missions.push({
      atMs: randomTime(rng),
      seed: rng.int(0, 0x7fffffff),
      category: 'museum',
      siteIndex: 0,
      templateId: city.museumMissionId,
    })
  }
  missions.sort((a, b) => a.atMs - b.atMs)

  return {
    day,
    missions,
    defenses: scheduleDefenses(rng, defensesForDay(day, city)),
    captureSiteIndices: pickCaptureSpots(rng, city.sites.green.length),
  }
}
