// Aplicação dos raios da Tempestade no runtime (PLAN §clima): a geometria/horário são puros
// (engine/storm), mas QUEM é atingido depende da posição dos Pokémon — então a detecção de
// acerto e a aplicação de dano/Paralyze acontecem no tick do dia, como o dano de missão.

import type { MapPos } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { pointInCircle, strikesResolvingBetween } from '../engine/storm.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'
import { STRIKE_DAMAGE, PARALYZE_STUN_MS } from '../engine/balance.ts'
import { findMon, replaceMon } from './runtime.ts'
import { shiftMissionTimestamps } from './missionFlow.ts'

/**
 * Aplica o Paralyze a um Pokémon atingido: -50% de Batalha pelo resto do dia (idempotente) e
 * congela o sprite na posição do impacto por 5s, deslocando a janela da perna em curso (a missão
 * demora 5s a mais). Reaplicar estende o congelamento por mais 5s. `pos` é a posição já computada
 * na detecção de acerto.
 */
export function applyParalyze(s: GameState, id: string, pos: MapPos, now: number): void {
  if (!s.today.paralyzedBattleIds.includes(id)) s.today.paralyzedBattleIds.push(id)

  // Missão em trânsito (ida/volta) com este Pokémon no time.
  const mission = s.missions.find(
    (m) => m.teamIds.includes(id) && (m.status === 'traveling' || m.status === 'returning'),
  )
  if (mission) {
    const active = mission.paralyzeHold && now < mission.paralyzeHold.untilMs
    const untilMs = (active ? mission.paralyzeHold!.untilMs : now) + PARALYZE_STUN_MS
    mission.paralyzeHold = { pos: { ...pos }, untilMs }
    shiftMissionTimestamps(mission, mission.status === 'traveling' ? 'out' : 'back', PARALYZE_STUN_MS, true)
    return
  }
  // Procurador de captura a caminho.
  const search = s.captureSearches.find((c) => c.searcherId === id && c.phase === 'traveling')
  if (search) {
    const active = search.paralyzeHold && now < search.paralyzeHold.untilMs
    const untilMs = (active ? search.paralyzeHold!.untilMs : now) + PARALYZE_STUN_MS
    search.paralyzeHold = { pos: { ...pos }, untilMs }
    search.arriveAtMs += PARALYZE_STUN_MS
    search.readyAtMs += PARALYZE_STUN_MS
    search.departAtMs += PARALYZE_STUN_MS
    return
  }
  // Procurador voltando ao ginásio.
  const ret = s.captureReturns.find((r) => r.searcherId === id)
  if (ret) {
    const active = ret.paralyzeHold && now < ret.paralyzeHold.untilMs
    const untilMs = (active ? ret.paralyzeHold!.untilMs : now) + PARALYZE_STUN_MS
    ret.paralyzeHold = { pos: { ...pos }, untilMs }
    ret.arriveAtMs += PARALYZE_STUN_MS
    ret.departAtMs += PARALYZE_STUN_MS
  }
}

/**
 * Processa os raios cujo impacto cai em (prevMs, nowMs]: para cada Pokémon VISÍVEL no mapa dentro
 * de algum círculo, reduz 1 de HP (preservando o status de trânsito — o desmaio é realizado no
 * settle normal da missão) e aplica Paralyze.
 */
export function processStorms(s: GameState, prevMs: number, nowMs: number): void {
  if (s.weather.storms.length === 0) return
  for (const strike of strikesResolvingBetween(s.weather.storms, prevMs, nowMs)) {
    const positions = travelerPositionsAt(s, strike.strikeAtMs)
    const hit = new Set<string>()
    for (const { id, pos } of positions) {
      if (hit.has(id)) continue
      if (strike.circles.some((c) => pointInCircle(c, pos))) hit.add(id)
    }
    for (const id of hit) {
      const mon = findMon(s, id)
      if (!mon) continue
      const pos = positions.find((t) => t.id === id)!.pos
      // Reduz HP SEM virar fainted aqui (preserva 'traveling'/'returning'); settle normal cuida.
      replaceMon(s, { ...mon, currentHp: Math.max(0, mon.currentHp - STRIKE_DAMAGE) })
      applyParalyze(s, id, pos, strike.strikeAtMs)
    }
  }
}
