// Aplicação da Nevasca (Snowstorm) no runtime (espelha game/stormFlow.ts): a agenda (janelas) é
// pura, mas o EFEITO depende do estado por container — a cada 2s viajando sob nevasca o time ganha
// um stack de gelo (velocidade ×0,8 composto, até 4); no 5º stack CONGELA (para no lugar, perde
// 1 HP a cada 2s; voador morre). Descongela 2s após a janela acabar. Stacks resetam ao chegar no
// destino de cada perna (game/missionFlow + captureFlow limpam `snow`, espelhando o weatherHold).

import type { MapPos } from '../types/index.ts'
import type { GameState, MissionInstance, CaptureSearch, CaptureReturn } from '../engine/state.ts'
import { snowExposureMs, snowWindowEndAt } from '../engine/snow.ts'
import { hasClearBody } from '../engine/secretEffects.ts'
import { containerTeamIds, killFlyingContainer } from './containers.ts'
import { shiftMissionTimestamps } from './missionFlow.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'
import { findMon, replaceMon } from './runtime.ts'
import {
  SNOW_STACK_INTERVAL_MS,
  SNOW_SLOW_PER_STACK,
  SNOW_MAX_STACKS,
  SNOW_FREEZE_DAMAGE,
  SNOW_FREEZE_DAMAGE_INTERVAL_MS,
  SNOW_THAW_MS,
} from '../engine/balance.ts'

type SnowState = NonNullable<MissionInstance['snow']>

/** Container genérico que pode congelar (tem `snow`, `paralyzeHold` e pode estar voando). */
interface SnowTarget {
  snow?: SnowState
  paralyzeHold?: { pos: MapPos; untilMs: number }
  flying?: boolean
}

/** Desconta o dano de congelamento acumulado (−1 HP a cada 2s) de cada membro vivo do time. */
function applyFreezeDrain(s: GameState, teamIds: readonly string[], cur: SnowState, nowMs: number): void {
  const since = cur.lastDrainMs ?? cur.frozenAtMs ?? nowMs
  const drains = Math.floor((nowMs - since) / SNOW_FREEZE_DAMAGE_INTERVAL_MS)
  if (drains <= 0) return
  for (const tid of teamIds) {
    const mon = findMon(s, tid)
    // Espelha o dano do raio: só reduz HP (o desmaio é liquidado na volta — sobreviventes seguem).
    if (mon && mon.currentHp > 0) {
      replaceMon(s, { ...mon, currentHp: Math.max(0, mon.currentHp - SNOW_FREEZE_DAMAGE * drains) })
    }
  }
  cur.lastDrainMs = since + drains * SNOW_FREEZE_DAMAGE_INTERVAL_MS
}

/**
 * Processa a nevasca para UM container em perna de viagem. `primaryId` localiza posição+time;
 * `shiftEnd` estica só o fim da perna (slowdown); `shiftAll` desliza a janela inteira (freeze, para
 * o progresso retomar do ponto congelado após o thaw).
 */
function applySnowToContainer(
  s: GameState,
  prevMs: number,
  nowMs: number,
  ct: SnowTarget,
  primaryId: string,
  shiftEnd: (deltaMs: number) => void,
  shiftAll: (deltaMs: number) => void,
): void {
  const teamIds = containerTeamIds(s, primaryId)
  // Clear Body: imunidade total à nevasca (consistente com a imunidade à tempestade).
  if (teamIds.some((tid) => { const m = findMon(s, tid); return m ? hasClearBody(m) : false })) {
    if (ct.snow?.frozenAtMs != null) ct.paralyzeHold = undefined
    ct.snow = undefined
    return
  }

  // Já congelado: drena até o thaw; ao chegar no thaw, descongela e zera.
  if (ct.snow?.frozenAtMs != null) {
    if (nowMs >= (ct.snow.thawAtMs ?? nowMs)) {
      ct.paralyzeHold = undefined
      ct.snow = undefined
      return
    }
    applyFreezeDrain(s, teamIds, ct.snow, nowMs)
    return
  }

  // Não congelado: só cresce sob exposição à nevasca. Holds ativos (poça/Paralyze) = não viajando.
  if (ct.paralyzeHold && nowMs < ct.paralyzeHold.untilMs) return
  const exposure = snowExposureMs(s.weather.snow, prevMs, nowMs)
  if (exposure <= 0) return

  const cur: SnowState = ct.snow ?? { stacks: 0, exposureMs: 0 }
  cur.exposureMs += exposure
  const stacks = Math.min(SNOW_MAX_STACKS, Math.floor(cur.exposureMs / SNOW_STACK_INTERVAL_MS))

  if (stacks < SNOW_MAX_STACKS) {
    // Slowdown composto: a perna fica mais longa proporcional ao tempo exposto neste tick.
    cur.stacks = stacks
    ct.snow = cur
    if (stacks > 0) {
      const extraMs = exposure * (1 / SNOW_SLOW_PER_STACK ** stacks - 1)
      if (extraMs > 0) shiftEnd(extraMs)
    }
    return
  }

  // 5º stack → congela. thawAtMs = fim da janela ativa + 2s (ambos conhecidos do schedule puro).
  const thawAtMs = (snowWindowEndAt(s.weather.snow, nowMs) ?? nowMs) + SNOW_THAW_MS
  cur.stacks = SNOW_MAX_STACKS
  cur.frozenAtMs = nowMs
  cur.lastDrainMs = nowMs
  cur.thawAtMs = thawAtMs
  ct.snow = cur

  // Voador morre ao congelar (espelha a morte-voadora do raio).
  if (ct.flying === true) {
    killFlyingContainer(s, primaryId)
    return
  }

  // Terrestre: congela o sprite na posição atual e desliza a perna pelo tempo parado.
  const pos = travelerPositionsAt(s, nowMs).find((t) => t.id === primaryId)?.pos
  if (pos) ct.paralyzeHold = { pos: { ...pos }, untilMs: thawAtMs }
  shiftAll(thawAtMs - nowMs)
}

/**
 * Aplica a nevasca a TODOS os viajantes no tick (missões ida/volta, buscas e retornos de captura).
 * Robusto a saltos grandes de tempo via snowExposureMs (interseção com as janelas).
 */
export function processSnow(s: GameState, prevMs: number, nowMs: number): void {
  if (nowMs <= prevMs) return

  for (const m of s.missions) {
    if (m.status !== 'traveling' && m.status !== 'returning') continue
    const leg: 'out' | 'back' = m.status === 'traveling' ? 'out' : 'back'
    const primaryId = m.teamIds[0]
    if (!primaryId) continue
    applySnowToContainer(
      s,
      prevMs,
      nowMs,
      m,
      primaryId,
      (d) => shiftMissionTimestamps(m, leg, d, false),
      (d) => shiftMissionTimestamps(m, leg, d, true),
    )
  }

  for (const c of s.captureSearches as CaptureSearch[]) {
    if (c.phase !== 'traveling') continue
    applySnowToContainer(
      s,
      prevMs,
      nowMs,
      c,
      c.searcherId,
      (d) => { c.arriveAtMs += d; c.readyAtMs += d },
      (d) => { c.departAtMs += d; c.arriveAtMs += d; c.readyAtMs += d },
    )
  }

  for (const r of s.captureReturns as CaptureReturn[]) {
    applySnowToContainer(
      s,
      prevMs,
      nowMs,
      r,
      r.searcherId,
      (d) => { r.arriveAtMs += d },
      (d) => { r.departAtMs += d; r.arriveAtMs += d },
    )
  }
}
