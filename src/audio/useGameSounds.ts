// Observa o GameState e dispara sons nas TRANSIÇÕES (a engine é pura; o som é efeito).
// Cada efeito compara o estado atual com um snapshot em ref e toca uma única vez por
// evento. O primeiro render só estabelece a linha de base (não toca nada ao carregar).

import { useEffect, useRef } from 'react'
import type { GameState } from '../engine/state.ts'
import type { MissionResult } from '../engine/state.ts'
import type { GamePhase } from '../types/index.ts'
import { pendingPoints } from '../engine/leveling.ts'
import { isRaining } from '../engine/weather.ts'
import { strikesResolvingBetween } from '../engine/storm.ts'
import type { StormEvent } from '../engine/storm.ts'
import { playSound } from './sounds.ts'
import { startRain, stopRain } from './rainPlayer.ts'
import { startHeat, stopHeat } from './heatPlayer.ts'
import { startSnow, stopSnow } from './snowPlayer.ts'
import { startSand, stopSand } from './sandPlayer.ts'
import { isHot } from '../engine/heat.ts'
import { isSnowing } from '../engine/snow.ts'
import { isSanding } from '../engine/sand.ts'
import { playThunder } from './thunderPlayer.ts'

/**
 * Deve soar um trovão nesta janela? True quando algum raio impacta em (prevMs, nowMs] na fase
 * Dia. Puro (testável): a mesma `strikesResolvingBetween` do dano dos raios — o que se ouve é o
 * que cai. `nowMs <= prevMs` (virada de dia / sem avanço) não soa.
 */
export function shouldThunder(
  storms: readonly StormEvent[],
  prevMs: number,
  nowMs: number,
  phase: GamePhase,
): boolean {
  if (phase !== 'DAY' || nowMs <= prevMs) return false
  return strikesResolvingBetween(storms, prevMs, nowMs).length > 0
}

/** Faltando este tempo (ms de jogo) para expirar, avisa que o tempo está acabando. */
const WARNING_MS = 6_000

export function useGameSounds(state: GameState): void {
  const ready = useRef(false)
  const availableIds = useRef<Set<string>>(new Set())
  const activeDefenseIds = useRef<Set<string>>(new Set())
  const resolvedIds = useRef<Set<string>>(new Set())
  const pendingTotal = useRef(0)
  const warnedIds = useRef<Set<string>>(new Set())
  const raining = useRef(false)
  const hot = useRef(false)
  const snowing = useRef(false)
  const sanding = useRef(false)
  const prevStormMs = useRef(0)
  const theftWarned = useRef(false)
  const theftAnnounced = useRef(false)

  useEffect(() => {
    const first = !ready.current

    // 1) Nova missão disponível: id que virou 'available' e não estava antes.
    const available = new Set<string>()
    for (const m of state.missions) {
      if (m.status === 'available') {
        available.add(m.id)
        if (!first && !availableIds.current.has(m.id)) playSound('missionNew')
      }
    }
    availableIds.current = available

    // 1b) Defesa de ginásio surgiu (virou 'active'): mesmo som da nova missão (batalha hoje).
    const activeDefenses = new Set<string>()
    for (const d of state.defenses) {
      if (d.status === 'active') {
        activeDefenses.add(d.id)
        if (!first && !activeDefenseIds.current.has(d.id)) playSound('missionNew')
      }
    }
    activeDefenseIds.current = activeDefenses

    // 2) Missão resolvida: success/failure tocam; 'expired' (não despachada) fica em silêncio.
    for (const m of state.missions) {
      if (m.result && !resolvedIds.current.has(m.id)) {
        resolvedIds.current.add(m.id)
        if (!first) playResult(m.result)
      }
    }

    // 3) Level-up: soma de pontos pendentes do roster aumentou (alocar diminui; só subir aumenta).
    const pending = state.roster.reduce((sum, p) => sum + pendingPoints(p), 0)
    if (!first && pending > pendingTotal.current) playSound('levelUp')
    pendingTotal.current = pending

    // 4) Tempo acabando: defesa de ginásio 'active' sem esquadrão E Missão Especial
    //    'available' não despachada — em ambas, deixar o timer zerar é derrota imediata.
    //    Missões normais prestes a expirar não apitam.
    const now = state.clock.dayElapsedMs
    if (!first) {
      for (const d of state.defenses) {
        if (d.status === 'active') warnIfExpiring(d.id, d.expiresAtMs - now, warnedIds.current)
      }
      for (const m of state.missions) {
        if (m.status === 'available' && m.templateId === 'special') {
          warnIfExpiring(m.id, m.expiresAtMs - now, warnedIds.current)
        }
      }
    }

    // 5) Som de chuva em loop: toca enquanto chove na fase Dia (fade in/out no rainPlayer).
    //    Acompanha o relógio — pausar o jogo congela `now`, mantendo o estado de chuva.
    const isRain = state.run.phase === 'DAY' && isRaining(state.weather, now)
    if (isRain && !raining.current) startRain()
    else if (!isRain && raining.current) stopRain()
    raining.current = isRain

    // 5b) Som de calor em loop: toca enquanto há janela de calor ativa na fase Dia (heatPlayer).
    const isHotNow = state.run.phase === 'DAY' && isHot(state.weather.heat, now)
    if (isHotNow && !hot.current) startHeat()
    else if (!isHotNow && hot.current) stopHeat()
    hot.current = isHotNow

    // 5c) Som de nevasca em loop (snowPlayer).
    const isSnowNow = state.run.phase === 'DAY' && isSnowing(state.weather.snow, now)
    if (isSnowNow && !snowing.current) startSnow()
    else if (!isSnowNow && snowing.current) stopSnow()
    snowing.current = isSnowNow

    // 5d) Som de tempestade de areia em loop (sandPlayer).
    const isSandNow = state.run.phase === 'DAY' && isSanding(state.weather.sand, now)
    if (isSandNow && !sanding.current) startSand()
    else if (!isSandNow && sanding.current) stopSand()
    sanding.current = isSandNow

    // 6) Som de raio: um trovão (thunderN sorteado) por janela em que um raio impacta na fase Dia.
    //    Mesma janela (prevMs, now] do dano (engine/stormFlow), então o áudio segue o impacto.
    if (!first && shouldThunder(state.weather.storms, prevStormMs.current, now, state.run.phase)) {
      playThunder()
    }
    prevStormMs.current = now

    // 6b) Rocket apareceu (virou perseguível): toca o MESMO som de missão nova, uma vez.
    if (!first && state.theft?.phase === 'fleeing' && !theftAnnounced.current) {
      theftAnnounced.current = true
      playSound('missionNew')
    }
    if (!state.theft || state.theft.phase === 'resolved') {
      theftAnnounced.current = false
    }

    // 7) Roubo Rocket chegou ao nó mais distante: toca o alerta (mesmo da defesa acabando) uma vez.
    if (!first && state.theft?.phase === 'atFarNode' && !theftWarned.current) {
      theftWarned.current = true
      playSound('timeWarning')
    }
    // Rearma o aviso quando não há evento em janela final (próximo dia/evento).
    if (!state.theft || (state.theft.phase !== 'atFarNode' && state.theft.phase !== 'battle')) {
      theftWarned.current = false
    }

    ready.current = true
  }, [state])

  // Sai da fase Dia / desmonta: garante que a chuva e o calor parem.
  useEffect(() => () => { stopRain(); stopHeat(); stopSnow(); stopSand() }, [])
}

function playResult(result: MissionResult): void {
  if (result === 'success') playSound('missionSuccess')
  else if (result === 'failure') playSound('missionFail')
  // 'expired' = oportunidade perdida (não despachada) → sem som.
}

function warnIfExpiring(id: string, remainingMs: number, warned: Set<string>): void {
  if (remainingMs > 0 && remainingMs <= WARNING_MS && !warned.has(id)) {
    warned.add(id)
    playSound('timeWarning')
  }
}
