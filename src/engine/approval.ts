// Aprovação (estrelas) e progressão de cidade (PLAN §4.7).
// DUAS trilhas INDEPENDENTES de estrelas — missões e batalhas — cada uma de 0 a 5 em passos de
// 0,5. Por trilha, comparando o cumprido com o total do dia:
//   • bateu TUDO (100%)                      → +1,0
//   • bateu a META (½ do total, mín. 1)      → +0,5
//   • abaixo da meta mas ≥ META MÍNIMA (¼)   → −0,5
//   • abaixo da META MÍNIMA                   → −1,0
// A meta mínima é floor(total/4) e pode ser 0 (aí nunca se perde 1 estrela). Sem itens no
// domínio, nada a cobrar (delta 0). Efetivação no fim do período: MÉDIA das duas trilhas ≥ 3.

import { STARS_HIRE_THRESHOLD, STARS_MAX, STARS_MIN, STARS_STEP } from './constants.ts'
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
 * itens. Missões e batalhas usam a MESMA fração.
 */
export function dailyGoal(total: number): number {
  if (total <= 0) return 0
  return Math.max(1, Math.ceil(total * MISSION_GOAL_FRACTION))
}

/** Meta MÍNIMA de um domínio: ¼ do total arredondado para baixo (pode ser 0). */
export function minGoal(total: number): number {
  if (total <= 0) return 0
  return Math.floor(total / 4)
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

/**
 * Variação de estrelas de UM domínio (missões OU batalhas):
 *   +1,0 (tudo) · +0,5 (meta) · −0,5 (≥ meta mínima) · −1,0 (< meta mínima) · 0 (sem itens).
 */
export function domainStarDelta(done: number, total: number): number {
  if (total <= 0) return 0
  if (allReached(done, total)) return STARS_STEP * 2 // +1
  if (done >= dailyGoal(total)) return STARS_STEP // +0,5
  if (done >= minGoal(total)) return -STARS_STEP // −0,5
  return -STARS_STEP * 2 // −1
}

/** Variação da trilha de MISSÕES no dia. */
export function missionStarDelta(p: DailyProgress): number {
  return domainStarDelta(p.missionsCompleted, p.missionsTotal)
}

/** Variação da trilha de BATALHAS no dia. */
export function battleStarDelta(p: DailyProgress): number {
  return domainStarDelta(p.battlesWon, p.battlesTotal)
}

/** Aplica a variação de uma trilha, mantendo-a em [0, 5] e em passos de 0,5. */
export function applyDomainStars(stars: number, delta: number): number {
  return clamp(roundToStep(stars + delta, STARS_STEP), STARS_MIN, STARS_MAX)
}

/** Ambas as metas (missões E batalhas) cumpridas — usado só no selo do resumo/relatório. */
export function dailyGoalMet(p: DailyProgress): boolean {
  return (
    goalReached(p.missionsCompleted, p.missionsTotal) &&
    goalReached(p.battlesWon, p.battlesTotal)
  )
}

/** Dia perfeito: TODAS as missões E TODAS as batalhas (100% nas duas) — selo do resumo. */
export function dailyPerfect(p: DailyProgress): boolean {
  return (
    allReached(p.missionsCompleted, p.missionsTotal) &&
    allReached(p.battlesWon, p.battlesTotal)
  )
}

/** Média das duas trilhas de estrelas (base da efetivação). */
export function averageStars(missionStars: number, battleStars: number): number {
  return (missionStars + battleStars) / 2
}

/** Efetivado (avança de cidade) se a MÉDIA das duas trilhas for ≥ 3 — PLAN §4.7. */
export function isHired(missionStars: number, battleStars: number): boolean {
  return averageStars(missionStars, battleStars) >= STARS_HIRE_THRESHOLD
}
