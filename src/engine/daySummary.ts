// Resumo do dia: agrega missões, defesas, ouro, capturados, baixas e o destaque
// (MVP) para a tela de Resumo e para o histórico (PLAN §3 / §5).

import type { Pokemon } from '../types/index.ts'
import type { DayLog, DefenseKill, MissionResultLog } from './state.ts'
import { isFainted } from './attributes.ts'

export type { MissionResultLog }

export interface DaySummaryInput {
  day: number
  starsBefore: number
  starsAfter: number
  missionResults: readonly MissionResultLog[]
  defensesWon: number
  defensesTotal: number
  defenseKills: readonly DefenseKill[]
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
  /** Pokémon com mais feitos (missões + derrotas); null se não houve nenhum. */
  mvpId: string | null
  /** Quantas missões bem-sucedidas o destaque participou (0 se não houver). */
  mvpMissions: number
  /** Quantos desafiantes o destaque derrotou em defesas (0 se não houver). */
  mvpDefeats: number
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
    ...computeMvp(input.missionResults, input.defenseKills),
  }
}

/**
 * Destaque do dia: quem somou mais FEITOS = missões bem-sucedidas + desafiantes
 * derrotados em defesas. Em empate vence quem tem mais missões (PLAN §3, ajuste).
 */
export function computeMvp(
  results: readonly MissionResultLog[],
  defenseKills: readonly DefenseKill[] = [],
): {
  mvpId: string | null
  mvpMissions: number
  mvpDefeats: number
} {
  const missionsById = new Map<string, number>()
  for (const result of results) {
    if (!result.success) continue
    for (const id of result.teamIds) missionsById.set(id, (missionsById.get(id) ?? 0) + 1)
  }
  const defeatsById = new Map<string, number>()
  for (const kill of defenseKills) {
    defeatsById.set(kill.defeaterId, (defeatsById.get(kill.defeaterId) ?? 0) + 1)
  }

  let mvpId: string | null = null
  let bestDeeds = 0
  let bestMissions = 0
  const ids = new Set([...missionsById.keys(), ...defeatsById.keys()])
  for (const id of ids) {
    const missions = missionsById.get(id) ?? 0
    const deeds = missions + (defeatsById.get(id) ?? 0)
    // Mais feitos vence; empate desempata por mais missões.
    if (deeds > bestDeeds || (deeds === bestDeeds && missions > bestMissions)) {
      bestDeeds = deeds
      bestMissions = missions
      mvpId = id
    }
  }
  return {
    mvpId,
    mvpMissions: mvpId ? (missionsById.get(mvpId) ?? 0) : 0,
    mvpDefeats: mvpId ? (defeatsById.get(mvpId) ?? 0) : 0,
  }
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
