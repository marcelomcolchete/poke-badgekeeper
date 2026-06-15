// Batalha da missão Equipe Rocket (PLAN — Rocket Team): ao clicar "Batalhar" na conclusão
// da missão, o time despachado enfrenta o treinador Rocket NA ORDEM em que foi enviado,
// reaproveitando a animação de duelos (BattleView). As recompensas (ouro-bônus + 3× XP) só
// são aplicadas ao concluir a animação, e apenas na vitória.

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
  missionId: string
  onClose: () => void
}

export function RocketBattlePanel({ state, dispatch, missionId, onClose }: Props) {
  const mission = state.missions.find((m) => m.id === missionId)
  const rocket = mission?.rocket

  // Resolve a batalha (cadeia de duelos) assim que o painel abre — uma única vez.
  useEffect(() => {
    if (rocket && !rocket.resolved) dispatch({ type: 'RESOLVE_ROCKET_BATTLE', missionId })
  }, [rocket, rocket?.resolved, missionId, dispatch])

  if (!mission || !rocket) return null

  // Aguardando a resolução (próximo render traz o log de duelos).
  if (!rocket.resolved || !rocket.duels) {
    return (
      <Overlay title="EQUIPE ROCKET — BATALHA" wide>
        <p style={{ textAlign: 'center', padding: '24px 0' }}>Preparando a batalha…</p>
      </Overlay>
    )
  }

  return (
    <BattleView
      state={state}
      trainer={getTrainer(rocket.trainerId)}
      squadIds={mission.teamIds}
      enemies={rocket.enemies}
      duels={rocket.duels}
      won={rocket.won === true}
      title="EQUIPE ROCKET — BATALHA"
      wonText="EQUIPE ROCKET DERROTADA! ✓ Recompensas: ouro + 3× XP"
      lostText="A Equipe Rocket venceu desta vez…"
      onFinish={() => {
        dispatch({ type: 'COMPLETE_ROCKET_BATTLE', missionId })
        onClose()
      }}
    />
  )
}
