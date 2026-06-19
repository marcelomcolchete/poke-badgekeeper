// Relógio do dia (PLAN §4.3): avança o tempo e dispara, por tempo, as transições
// dos eventos agendados — spawn, expiração, resolução de missões e de buscas.
// Ao esgotar os 180s o dia entra em "encerramento": para de surgir evento novo,
// mas só fecha de fato quando o ÚLTIMO Pokémon volta ao ginásio (PLAN §3, ajuste).

import type { Pokemon } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { isFainted } from '../engine/attributes.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { advanceMission, expireMission, loseRunByRocket, promoteMission } from './missionFlow.ts'
import { expireDefense, loseRunByUndefendedGym, spawnDefense } from './defenseFlow.ts'
import { advanceCaptureReturn, advanceSearch } from './captureFlow.ts'
import { finalizeDay } from './phaseFlow.ts'
import { processStorms } from './stormFlow.ts'

/** Status de Pokémon que ainda estão "fora" do ginásio (impedem o fim do dia). */
const AWAY_STATUSES: Pokemon['status'][] = ['traveling', 'onMission', 'returning', 'defending']

/** Avança o relógio em `deltaMs` (ms de jogo) e processa os eventos do dia. */
export function tick(s: GameState, deltaMs: number): void {
  if (s.run.phase !== 'DAY') return
  // O tempo passa de 180s (overtime): o relógio segue para trazer o time de volta,
  // mas nada novo surge e missões não aceitas são descartadas.
  const prevMs = s.clock.dayElapsedMs
  const now = s.clock.dayElapsedMs + Math.max(0, deltaMs)
  s.clock.dayElapsedMs = now
  const overtime = now >= s.clock.dayLengthMs

  processMissions(s, now, overtime)
  processDefenses(s, now, overtime)
  if (s.run.phase !== 'DAY') return // derrota por ginásio indefeso encerrou a run
  processSearches(s, now)

  processStorms(s, prevMs, now)

  // Time inteiro desmaiado no dia = derrota imediata (sem ninguém para lutar/agir).
  checkTeamWipeout(s)
  if (s.run.phase !== 'DAY') return

  if (overtime && dayComplete(s)) finalizeDay(s)
}

/** Todo o time desmaiado encerra a run na hora (PLAN — condição de derrota). */
function checkTeamWipeout(s: GameState): void {
  if (s.roster.length === 0 || !s.roster.every(isFainted)) return
  s.run.phase = 'GAMEOVER'
  s.run.gameOverReason = 'fainted'
  s.clock.speed = 0
}

function processMissions(s: GameState, now: number, overtime: boolean): void {
  for (const mission of s.missions) {
    // Rocket disponível ANTES deste tick: deixar o timer zerar sem despachar = derrota
    // imediata. Surgir e expirar no mesmo salto de tempo (aba oculta) apenas a descarta.
    const wasAvailableRocket =
      mission.status === 'available' && getMissionTemplate(mission.templateId).isRocket
    // Encerramento (18h): apenas missões que AINDA não surgiram são descartadas. As que já
    // estão como pop-up na tela ('available') continuam até o PRÓPRIO timer acabar — sumir no
    // 18h faria o jogador perder na hora se fosse batalha/Rocket (PLAN §3.1, ajuste).
    if (overtime) {
      if (mission.status === 'scheduled') {
        expireMission(s, mission)
        continue
      }
    } else {
      promoteMission(s, mission, now)
    }
    // Pop-up ignorado até o fim do tempo dele expira (e Rocket não despachada = derrota) — vale
    // tanto no horário normal quanto no encerramento, dando ao jogador a janela inteira.
    if (mission.status === 'available' && now >= mission.expiresAtMs) {
      expireMission(s, mission)
      if (wasAvailableRocket) loseRunByRocket(s)
      continue
    }
    if (
      mission.status === 'traveling' ||
      mission.status === 'inProgress' ||
      mission.status === 'returning'
    ) {
      advanceMission(s, mission, now)
    }
  }
}

function processDefenses(s: GameState, now: number, overtime: boolean): void {
  for (const defense of s.defenses) {
    const wasActive = defense.status === 'active' // já estava no mapa antes deste tick?
    if (!overtime) spawnDefense(s, defense, now) // no encerramento nenhuma defesa nova surge
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

/**
 * O dia pode fechar quando ninguém está mais "fora": nenhum Pokémon viajando/em missão/
 * voltando/defendendo, nenhuma busca/retorno/encontro pendente e nenhuma defesa ativa
 * aguardando esquadrão (PLAN §3, ajuste — o dia só termina com todos de volta).
 */
function dayComplete(s: GameState): boolean {
  if (s.roster.some((p) => AWAY_STATUSES.includes(p.status))) return false
  if (s.captureSearches.length > 0 || s.captureReturns.length > 0) return false
  if (s.encounters.length > 0) return false
  if (s.defenses.some((d) => d.status === 'active')) return false
  // Pop-up de missão ainda na tela: o dia espera o jogador despachar ou o timer dela esgotar.
  if (s.missions.some((m) => m.status === 'available')) return false
  return true
}
