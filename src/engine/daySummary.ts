// Resumo do dia: agrega missões, defesas, ouro, capturados, baixas e o destaque
// (MVP) para a tela de Resumo e para o histórico (PLAN §3 / §5).

import type { Pokemon } from '../types/index.ts'
import type { DayLog, MissionResultLog } from './state.ts'
import { isFainted } from './attributes.ts'

export type { MissionResultLog }

export interface DaySummaryInput {
  day: number
  starsBefore: number
  starsAfter: number
  missionResults: readonly MissionResultLog[]
  defensesWon: number
  defensesTotal: number
  goldEarned: number
  capturedIds: readonly string[]
  roster: readonly Pokemon[]
}

export interface DaySummary {
  day: number
  starsBefore: number
  starsAfter: number
  missionsCompleted: number
  missionsFailed: number
  missionsTotal: number
  defensesWon: number
  defensesTotal: number
  goldEarned: number
  captured: number
  fainted: number
  available: number
  /** Pokémon com mais missões bem-sucedidas; null se ninguém concluiu nenhuma. */
  mvpId: string | null
}

/** Agrega o resumo do dia a partir dos resultados e do roster final. */
export function buildDaySummary(input: DaySummaryInput): DaySummary {
  const missionsCompleted = input.missionResults.filter((m) => m.success).length
  const fainted = input.roster.filter(isFainted).length
  return {
    day: input.day,
    starsBefore: input.starsBefore,
    starsAfter: input.starsAfter,
    missionsCompleted,
    missionsFailed: input.missionResults.length - missionsCompleted,
    missionsTotal: input.missionResults.length,
    defensesWon: input.defensesWon,
    defensesTotal: input.defensesTotal,
    goldEarned: input.goldEarned,
    captured: input.capturedIds.length,
    fainted,
    available: input.roster.length - fainted,
    mvpId: computeMvp(input.missionResults),
  }
}

/** Destaque do dia: quem participou de mais missões bem-sucedidas (PLAN §3). */
function computeMvp(results: readonly MissionResultLog[]): string | null {
  const counts = new Map<string, number>()
  for (const result of results) {
    if (!result.success) continue
    for (const id of result.teamIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  let mvpId: string | null = null
  let best = 0
  for (const [id, count] of counts) {
    if (count > best) {
      best = count
      mvpId = id
    }
  }
  return mvpId
}

/** Converte o resumo no DayLog enxuto guardado no histórico do GameState. */
export function toDayLog(summary: DaySummary): DayLog {
  return {
    day: summary.day,
    starsAfter: summary.starsAfter,
    goldEarned: summary.goldEarned,
    captured: summary.captured,
  }
}
