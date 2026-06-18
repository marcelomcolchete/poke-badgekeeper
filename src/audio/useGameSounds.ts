// Observa o GameState e dispara sons nas TRANSIÇÕES (a engine é pura; o som é efeito).
// Cada efeito compara o estado atual com um snapshot em ref e toca uma única vez por
// evento. O primeiro render só estabelece a linha de base (não toca nada ao carregar).

import { useEffect, useRef } from 'react'
import type { GameState } from '../engine/state.ts'
import type { MissionResult } from '../engine/state.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { pendingPoints } from '../engine/leveling.ts'
import { isRaining } from '../engine/weather.ts'
import { playSound } from './sounds.ts'
import { startRain, stopRain } from './rainPlayer.ts'

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

    // 4) Tempo acabando: defesa de ginásio 'active' sem esquadrão E missão Equipe Rocket
    //    'available' não despachada — em ambas, deixar o timer zerar é derrota imediata.
    //    Missões normais prestes a expirar não apitam.
    const now = state.clock.dayElapsedMs
    if (!first) {
      for (const d of state.defenses) {
        if (d.status === 'active') warnIfExpiring(d.id, d.expiresAtMs - now, warnedIds.current)
      }
      for (const m of state.missions) {
        if (m.status === 'available' && getMissionTemplate(m.templateId).isRocket) {
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

    ready.current = true
  }, [state])

  // Sai da fase Dia / desmonta: garante que a chuva pare.
  useEffect(() => () => stopRain(), [])
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
