// Relógio do dia em tempo real (PLAN §4.3): converte tempo de parede em ms de jogo
// segundo a velocidade (x1/x2/x3) e despacha TICK por frame. Pausa fora do DAY ou
// com velocidade 0. O reducer encerra o dia sozinho ao chegar aos 180s.

import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../engine/state.ts'
import type { GameAction } from './actions.ts'

export function useGameClock(state: GameState, dispatch: Dispatch<GameAction>): void {
  const lastTs = useRef<number | null>(null)
  const speed = state.clock.speed
  const running = state.run.phase === 'DAY' && speed > 0

  useEffect(() => {
    if (!running) {
      lastTs.current = null
      return
    }
    let frame = 0
    const loop = (ts: number): void => {
      if (lastTs.current === null) lastTs.current = ts
      const wallMs = ts - lastTs.current
      lastTs.current = ts
      if (wallMs > 0) dispatch({ type: 'TICK', deltaMs: wallMs * speed })
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [running, speed, dispatch])
}
