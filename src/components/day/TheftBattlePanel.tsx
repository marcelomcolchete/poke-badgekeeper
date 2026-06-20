// Batalha de resgate do Evento de Roubo Rocket (Feature B): os perseguidores enfrentam o esquadrão
// Rocket na ordem despachada (reusa a animação BattleView). Resolve ao abrir; recompensas (3× XP)
// só ao concluir a animação e apenas na vitória.

import { useEffect } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { getTrainer } from '../../data/trainers.ts'
import { Overlay } from '../common/Overlay.tsx'
import { BattleView } from './BattleView.tsx'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

export function TheftBattlePanel({ state, dispatch, onClose }: Props) {
  const theft = state.theft

  useEffect(() => {
    if (theft && theft.phase === 'battle' && !theft.resolved) {
      dispatch({ type: 'RESOLVE_THEFT_BATTLE' })
    }
  }, [theft, theft?.resolved, theft?.phase, dispatch])

  if (!theft || theft.phase !== 'battle') return null

  if (!theft.resolved || !theft.duels) {
    return (
      <Overlay title="EQUIPE ROCKET — RESGATE" wide>
        <p style={{ textAlign: 'center', padding: '24px 0' }}>Preparando a batalha…</p>
      </Overlay>
    )
  }

  return (
    <BattleView
      state={state}
      trainer={getTrainer(theft.trainerId)}
      squadIds={theft.chaserIds}
      enemies={theft.enemies}
      duels={theft.duels}
      won={theft.won === true}
      title="EQUIPE ROCKET — RESGATE"
      wonText="POKÉMON RESGATADO! ✓ Recompensa: 3× XP"
      lostText="A Equipe Rocket fugiu com o seu Pokémon…"
      onFinish={() => {
        dispatch({ type: 'COMPLETE_THEFT_BATTLE' })
        onClose()
      }}
    />
  )
}
