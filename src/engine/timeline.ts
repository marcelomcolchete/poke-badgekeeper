// Agenda do dia: quantas missões/defesas surgem e QUANDO/ONDE, tudo semeado e
// escalando com o dia e o fator da cidade (PLAN §4.8). Cada missão sorteia uma
// CATEGORIA (que define o sítio onde nasce) e a captura escolhe 2 áreas verdes.
// A instanciação do conteúdo (template, inimigos) fica para missions.ts/gymDefense.ts.

import type { CityData } from '../data/types.ts'
import type { MissionCategory } from '../types/index.ts'
import { nodesForCategory } from '../data/cities.ts'
import { createRng, deriveSeed, type Rng } from './rng.ts'
import { DAY_LENGTH_MS, DAY_SEGMENTS, TOTAL_DAYS } from './constants.ts'
import {
  CAPTURE_SPOTS_PER_DAY,
  DAILY_CATEGORY_POOL,
  DAY1_FIRST_MISSION_DELAY_MS,
  DEFENSES_PER_DAY,
  MISSIONS_PER_DAY,
  MUSEUM_DAY_MAX,
  MUSEUM_DAY_MIN,
  NORMAL_CATEGORY_POOL,
  SPAWN_WINDOW_FRACTION,
} from './balance.ts'
import { clamp } from './math.ts'

/** Salt fixo para derivar o dia do museu a partir do seed da run. */
const MUSEUM_SEED_SALT = 0x4d757365 // 'Muse'

/** Índice (0..9) na tabela por dia — clamp p/ dias fora de 1..10. */
function dayIndex(day: number): number {
  return clamp(day, 1, TOTAL_DAYS) - 1
}

/** Quantidade de missões do dia — tabela fixa, igual para todas as cidades (sem museu). */
export function missionsForDay(day: number): number {
  return MISSIONS_PER_DAY[dayIndex(day)] ?? 0
}

/** Quantidade de defesas (batalhas) do dia — tabela fixa, igual para todas as cidades. */
export function defensesForDay(day: number): number {
  return DEFENSES_PER_DAY[dayIndex(day)] ?? 0
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
  /** Índices das áreas verdes (city.siteNodes.green) que recebem captura hoje. */
  captureSiteIndices: number[]
  /** Horário (ms de jogo) em que cada captura surge — alinhado a captureSiteIndices. */
  captureSpawnsAtMs: number[]
}

/** Dia (semeado) em que a missão única do museu surge na run — PLAN §3.1 (#5). */
export function museumDay(seed: number): number {
  return createRng(deriveSeed(seed, MUSEUM_SEED_SALT)).int(MUSEUM_DAY_MIN, MUSEUM_DAY_MAX)
}

/** Duração de cada um dos 3 momentos (minutos) do dia. */
const SEGMENT_MS = DAY_LENGTH_MS / DAY_SEGMENTS

/** Horário aleatório na janela do dia inteiro — usado pela captura (1×/dia). */
function randomTime(rng: Rng): number {
  return Math.floor(rng.float(0, DAY_LENGTH_MS * SPAWN_WINDOW_FRACTION))
}

/**
 * Reparte `count` eventos igualmente entre os DAY_SEGMENTS momentos do dia: base idêntica
 * em cada um e a sobra em momentos aleatórios distintos (ex.: 5 → [2,2,1] embaralhado).
 */
function segmentCounts(rng: Rng, count: number): number[] {
  const counts = Array.from({ length: DAY_SEGMENTS }, () => Math.floor(count / DAY_SEGMENTS))
  let remainder = count - counts.reduce((a, b) => a + b, 0)
  for (const seg of rng.shuffle(counts.map((_, i) => i))) {
    if (remainder <= 0) break
    counts[seg] = (counts[seg] ?? 0) + 1
    remainder--
  }
  return counts
}

/**
 * Horário de surgimento dentro de UM momento: início do momento + posição aleatória na sua
 * janela. No dia 1 o 1º momento só abre após o atraso de respiro (PLAN §3.1).
 */
function spawnTimeInSegment(rng: Rng, segment: number, day: number): number {
  const start = segment * SEGMENT_MS
  const lo = day === 1 && segment === 0 ? DAY1_FIRST_MISSION_DELAY_MS : 0
  const hi = SEGMENT_MS * SPAWN_WINDOW_FRACTION
  return Math.floor(start + rng.float(lo, hi))
}

/** Um horário por evento, já distribuídos igualmente entre os 3 momentos do dia. */
function spawnTimesAcrossSegments(rng: Rng, count: number, day: number): number[] {
  const times: number[] = []
  segmentCounts(rng, count).forEach((n, segment) => {
    for (let k = 0; k < n; k++) times.push(spawnTimeInSegment(rng, segment, day))
  })
  return times
}

/**
 * Sorteia a categoria de cada missão, com Pokecenter (center) e Pokemart (mart) limitados a
 * 1×/dia cada (podendo não sair nenhum): o excedente vira uma categoria normal.
 */
function rollCategories(rng: Rng, count: number): MissionCategory[] {
  const out: MissionCategory[] = []
  let hasCenter = false
  let hasMart = false
  for (let i = 0; i < count; i++) {
    let category = rng.pick(DAILY_CATEGORY_POOL)
    if ((category === 'center' && hasCenter) || (category === 'mart' && hasMart)) {
      category = rng.pick(NORMAL_CATEGORY_POOL)
    }
    if (category === 'center') hasCenter = true
    if (category === 'mart') hasMart = true
    out.push(category)
  }
  return out
}

function scheduleDefenses(rng: Rng, count: number, day: number): DefenseSlot[] {
  return spawnTimesAcrossSegments(rng, count, day).map((atMs) => ({
    atMs,
    seed: rng.int(0, 0x7fffffff),
  }))
}

/** Escolhe (semeado) até CAPTURE_SPOTS_PER_DAY áreas verdes distintas para captura. */
function pickCaptureSpots(rng: Rng, greenCount: number): number[] {
  const n = Math.min(CAPTURE_SPOTS_PER_DAY, greenCount)
  const indices = Array.from({ length: greenCount }, (_, i) => i)
  return rng.shuffle(indices).slice(0, n)
}

/**
 * Horário de surgimento de cada captura: no dia 1 surge logo no início (0); nos demais
 * dias, em horário aleatório dentro da janela do dia (PLAN §4.5, #7).
 */
function captureSpawns(rng: Rng, day: number, count: number): number[] {
  return Array.from({ length: count }, () => (day === 1 ? 0 : randomTime(rng)))
}

/** Agenda completa do dia, reprodutível pelo seed da run + dia (PLAN §3.1/§4.8). */
export function buildDaySchedule(seed: number, day: number, city: CityData): DaySchedule {
  const rng = createRng(deriveSeed(seed, day))

  // 1) Categorias das missões normais do dia (center/mart capados em 1×/dia).
  const specs: Omit<MissionSlot, 'atMs'>[] = rollCategories(rng, missionsForDay(day)).map(
    (category) => ({
      seed: rng.int(0, 0x7fffffff),
      category,
      siteIndex: rng.int(0, Math.max(1, nodesForCategory(city.siteNodes, category).length) - 1),
    }),
  )

  // 2) Missão única do museu (#5): entra no rateio dos 3 momentos como as demais.
  if (city.museumMissionId && day === museumDay(seed)) {
    specs.push({
      seed: rng.int(0, 0x7fffffff),
      category: 'museum',
      siteIndex: 0,
      templateId: city.museumMissionId,
    })
  }

  // 3) Distribui as missões igualmente entre os 3 momentos e ordena por horário.
  const missionTimes = spawnTimesAcrossSegments(rng, specs.length, day)
  const missions = specs
    .map((spec, i) => ({ ...spec, atMs: missionTimes[i] ?? 0 }))
    .sort((a, b) => a.atMs - b.atMs)

  // 4) Defesas: mesma distribuição em 3 momentos, independente das missões.
  const defenses = scheduleDefenses(rng, defensesForDay(day), day)
  const captureSiteIndices = pickCaptureSpots(rng, city.siteNodes.green.length)
  return {
    day,
    missions,
    defenses,
    captureSiteIndices,
    captureSpawnsAtMs: captureSpawns(rng, day, captureSiteIndices.length),
  }
}
