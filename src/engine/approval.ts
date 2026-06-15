// Aprovação (estrelas) e progressão de cidade (PLAN §4.7).
// Estrelas de 1 a 5 em passos de 0,5. As metas do dia são DUAS: missões cumpridas e
// batalhas vencidas. Bater AMBAS as metas → +0,5; bater 100% das DUAS → +1,0; deixar
// qualquer meta sem bater → −0,5. Efetivado ao fim do dia 10 se > 3 estrelas.

import {
  STARS_HIRE_THRESHOLD,
  STARS_MAX,
  STARS_MIN,
  STARS_STEP,
} from './constants.ts'
import { MISSION_GOAL_FRACTION } from './balance.ts'
import { clamp, roundToStep } from './math.ts'

/** Progresso do dia nas duas frentes que valem estrela: missões e batalhas (defesas). */
export interface DailyProgress {
  missionsCompleted: number
  missionsTotal: number
  battlesWon: number
  battlesTotal: number
}

/**
 * Meta de um domínio do dia (missões ou batalhas): uma fração do total, mínimo 1 se houver
 * itens. Curva por cidade fica na Fase 5. Missões e batalhas usam a MESMA fração.
 */
export function dailyGoal(total: number): number {
  if (total <= 0) return 0
  return Math.max(1, Math.ceil(total * MISSION_GOAL_FRACTION))
}

/** Meta de missões do dia (alias de `dailyGoal` — mantido para compatibilidade). */
export const missionGoal = dailyGoal
/** Meta de batalhas (defesas vencidas) do dia. */
export const battleGoal = dailyGoal

/** Uma meta isolada foi cumprida? Sem itens no domínio → cumprida de graça. */
function goalReached(done: number, total: number): boolean {
  if (total <= 0) return true
  return done >= dailyGoal(total)
}

/** Domínio 100% concluído? Sem itens → trivialmente completo. */
function allReached(done: number, total: number): boolean {
  return done >= total
}

/** Ambas as metas (missões E batalhas) cumpridas → rende +½ estrela. */
export function dailyGoalMet(p: DailyProgress): boolean {
  return (
    goalReached(p.missionsCompleted, p.missionsTotal) &&
    goalReached(p.battlesWon, p.battlesTotal)
  )
}

/** Dia perfeito: TODAS as missões E TODAS as batalhas (100% nas duas) → rende +1 estrela. */
export function dailyPerfect(p: DailyProgress): boolean {
  return (
    allReached(p.missionsCompleted, p.missionsTotal) &&
    allReached(p.battlesWon, p.battlesTotal)
  )
}

/** Variação de estrelas do dia: +1,0 (perfeito), +0,5 (ambas as metas), −0,5 (faltou alguma). */
export function approvalDelta(p: DailyProgress): number {
  // Dia sem missões e sem batalhas: nada a cobrar.
  if (p.missionsTotal <= 0 && p.battlesTotal <= 0) return 0
  if (dailyPerfect(p)) return STARS_STEP * 2
  if (dailyGoalMet(p)) return STARS_STEP
  return -STARS_STEP
}

/** Aplica a variação do dia, mantendo as estrelas em [0, 5] e em passos de 0,5. */
export function applyApproval(stars: number, p: DailyProgress): number {
  const next = stars + approvalDelta(p)
  return clamp(roundToStep(next, STARS_STEP), STARS_MIN, STARS_MAX)
}

/** Efetivado (avança de cidade) se as estrelas finais forem > 3 — PLAN §4.7. */
export function isHired(finalStars: number): boolean {
  return finalStars > STARS_HIRE_THRESHOLD
}
