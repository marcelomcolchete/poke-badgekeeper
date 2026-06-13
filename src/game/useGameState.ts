// Estado do jogo + dispatch + autosave (PLAN §5).
// Único ponto (com useGameClock) que toca localStorage/Date.now — a engine e o
// reducer permanecem puros. Carrega o save no início e regrava com debounce.

import { useEffect, useRef } from 'react'
import { useReducer } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../engine/state.ts'
import type { GameAction } from './actions.ts'
import { reducer } from './reducer.ts'
import { loadGame, saveGame } from '../persistence/saveLoad.ts'

const AUTOSAVE_DEBOUNCE_MS = 1_000

/** useReducer com o reducer puro + carga do save + autosave debounced. */
export function useGameState(createInitial: () => GameState): readonly [GameState, Dispatch<GameAction>] {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadGame() ?? createInitial())

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveGame(state, Date.now()), AUTOSAVE_DEBOUNCE_MS)
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [state])

  return [state, dispatch]
}
