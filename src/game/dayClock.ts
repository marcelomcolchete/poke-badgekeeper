// Relógio do dia (PLAN §4.3): avança o tempo e dispara, por tempo, as transições
// dos eventos agendados — spawn, expiração, resolução de missões e de buscas. Ao
// fim dos 180s, fecha o dia automaticamente.

import type { GameState } from '../engine/state.ts'
import { advanceMission, expireMission, promoteMission } from './missionFlow.ts'
import { expireDefense, loseRunByUndefendedGym, spawnDefense } from './defenseFlow.ts'
import { advanceCaptureReturn, advanceSearch } from './captureFlow.ts'
import { finalizeDay } from './phaseFlow.ts'

/** Avança o relógio em `deltaMs` (ms de jogo) e processa os eventos do dia. */
export function tick(s: GameState, deltaMs: number): void {
  if (s.run.phase !== 'DAY') return
  const end = s.clock.dayLengthMs
  const now = Math.min(s.clock.dayElapsedMs + Math.max(0, deltaMs), end)
  s.clock.dayElapsedMs = now

  processMissions(s, now)
  processDefenses(s, now)
  if (s.run.phase !== 'DAY') return // derrota por ginásio indefeso encerrou a run
  processSearches(s, now)

  if (now >= end) finalizeDay(s)
}

function processMissions(s: GameState, now: number): void {
  for (const mission of s.missions) {
    promoteMission(mission, now)
    if (mission.status === 'available' && now >= mission.expiresAtMs) {
      expireMission(s, mission)
    } else if (
      mission.status === 'traveling' ||
      mission.status === 'inProgress' ||
      mission.status === 'returning'
    ) {
      advanceMission(s, mission, now)
    }
  }
}

function processDefenses(s: GameState, now: number): void {
  for (const defense of s.defenses) {
    const wasActive = defense.status === 'active' // já estava no mapa antes deste tick?
    spawnDefense(s, defense, now)
    if (defense.status === 'active' && now >= defense.expiresAtMs) {
      expireDefense(defense)
      // Derrota imediata só se a defesa já estava ATIVA antes deste tick — o jogador
      // teve tempo real de reagir e não lutou (PLAN §4.4). Surgir e expirar no mesmo
      // salto de tempo (aba oculta / avanço headless do dia) apenas a remove, sem perder.
      if (wasActive) loseRunByUndefendedGym(s)
    }
  }
}

function processSearches(s: GameState, now: number): void {
  for (const search of [...s.captureSearches]) advanceSearch(s, search, now)
  for (const ret of [...s.captureReturns]) advanceCaptureReturn(s, ret, now)
}
