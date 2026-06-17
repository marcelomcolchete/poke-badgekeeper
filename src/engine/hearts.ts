// Corações de afinidade por Pokémon (0–5, passo 0,5). Puro: só números.
// Cada coração rende +10% de XP ganho, até o teto de +50% (5 corações). No fim do dia o Pokémon
// ganha/perde corações conforme o desempenho (ver dailyHeartDelta).

import {
  HEARTS_MAX,
  HEARTS_MIN,
  HEARTS_START,
  HEARTS_STEP,
  HEARTS_XP_MAX_BONUS,
  HEARTS_XP_PER,
} from './constants.ts'
import { clamp, roundToStep } from './math.ts'

/** Corações efetivos de um Pokémon (ausente = HEARTS_START), capados em [0, 5]. */
export function heartsOf(hearts: number | undefined): number {
  return clamp(hearts ?? HEARTS_START, HEARTS_MIN, HEARTS_MAX)
}

/** Multiplicador de XP pelos corações: 1 + 10%/coração, teto +50%. */
export function heartXpMultiplier(hearts: number | undefined): number {
  return 1 + Math.min(HEARTS_XP_MAX_BONUS, heartsOf(hearts) * HEARTS_XP_PER)
}

/**
 * Variação de corações no fim do dia (só para Pokémon do time; o PC não muda):
 *  +0,5 se sobreviveu / −0,5 se morreu; +0,5 de bônus se foi o Destaque do Dia;
 *  −0,5 se não fez nada (nenhuma missão/exploração/batalha direta). Acumulam.
 */
export function dailyHeartDelta(opts: {
  fainted: boolean
  participated: boolean
  mvp: boolean
}): number {
  let delta = opts.fainted ? -HEARTS_STEP : HEARTS_STEP
  if (opts.mvp) delta += HEARTS_STEP
  if (!opts.participated) delta -= HEARTS_STEP
  return delta
}

/** Aplica a variação do dia, mantendo os corações em [0, 5] e em passos de 0,5. */
export function applyHeartDelta(hearts: number | undefined, delta: number): number {
  return clamp(roundToStep(heartsOf(hearts) + delta, HEARTS_STEP), HEARTS_MIN, HEARTS_MAX)
}
