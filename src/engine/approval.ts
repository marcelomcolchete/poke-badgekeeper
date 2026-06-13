// Aprovação (estrelas) e progressão de cidade (PLAN §4.7).
// Estrelas de 1 a 5 em passos de 0,5. Meta de missões cumprida → +0,5; TODAS → +1,0;
// meta não cumprida → −0,5. Efetivado ao fim do dia 10 se > 3 estrelas.

import {
  STARS_HIRE_THRESHOLD,
  STARS_MAX,
  STARS_MIN,
  STARS_STEP,
} from './constants.ts'
import { MISSION_GOAL_FRACTION } from './balance.ts'
import { clamp, roundToStep } from './math.ts'

/** Meta de missões do dia (curva por cidade fica na Fase 5); mínimo de 1 se houver missões. */
export function missionGoal(totalMissions: number): number {
  if (totalMissions <= 0) return 0
  return Math.max(1, Math.ceil(totalMissions * MISSION_GOAL_FRACTION))
}

export function dailyGoalMet(completed: number, totalMissions: number): boolean {
  if (totalMissions <= 0) return true
  return completed >= missionGoal(totalMissions)
}

/** Variação de estrelas do dia: +1,0 (todas), +0,5 (meta), −0,5 (abaixo da meta) — PLAN §4.7. */
export function approvalDelta(completed: number, totalMissions: number): number {
  if (totalMissions <= 0) return 0
  if (completed >= totalMissions) return STARS_STEP * 2
  if (dailyGoalMet(completed, totalMissions)) return STARS_STEP
  return -STARS_STEP
}

/** Aplica a variação do dia, mantendo as estrelas em [1, 5] e em passos de 0,5. */
export function applyApproval(stars: number, completed: number, totalMissions: number): number {
  const next = stars + approvalDelta(completed, totalMissions)
  return clamp(roundToStep(next, STARS_STEP), STARS_MIN, STARS_MAX)
}

/** Efetivado (avança de cidade) se as estrelas finais forem > 3 — PLAN §4.7. */
export function isHired(finalStars: number): boolean {
  return finalStars > STARS_HIRE_THRESHOLD
}
