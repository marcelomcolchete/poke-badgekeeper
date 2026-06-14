// Despacho de missão (PLAN §3.1/§4.2): escolha do time (1–6) com o radar hexagonal
// sobreposto (exigência × cobertura do time) e a P_sucesso resultante.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { Pokemon } from '../../types/index.ts'
import type { GameState, MissionInstance } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { MAX_DISPATCH, MIN_DISPATCH } from '../../engine/constants.ts'
import { getCity } from '../../data/cities.ts'
import { getMissionTemplate } from '../../data/missionTemplates.ts'
import { teamSum } from '../../engine/attributes.ts'
import { missionDurationMs, missionSuccessProbability } from '../../engine/missions.ts'
import { pathDistance, shortestPath } from '../../engine/pathfinding.ts'
import { HexRadar } from '../HexRadar/HexRadar.tsx'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  missionId: string
  onClose: () => void
}

export function MissionDispatch({ state, dispatch, missionId, onClose }: Props) {
  const mission = state.missions.find((m) => m.id === missionId)
  const [selected, setSelected] = useState<string[]>([])
  if (!mission) return null

  const template = getMissionTemplate(mission.templateId)
  // Missão já aceita: painel de status (sem despacho) — o time está em campo (#4).
  if (mission.status !== 'available') {
    return <MissionStatus state={state} mission={mission} onClose={onClose} />
  }

  const city = getCity(state.run.cityIndex)
  const team: Pokemon[] = selected
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const probability = Math.round(missionSuccessProbability(team, template.requirement) * 100)
  const distance = pathDistance(city.graph, shortestPath(city.graph, city.siteNodes.gym, mission.node))
  const durationS = Math.round(missionDurationMs(team, distance, template) / 1000)
  const valid = selected.length >= MIN_DISPATCH && selected.length <= MAX_DISPATCH

  const toggle = (id: string): void => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_DISPATCH
          ? [...prev, id]
          : prev,
    )
  }

  const send = (): void => {
    dispatch({ type: 'ACCEPT_MISSION', missionId, teamIds: selected })
    onClose()
  }

  return (
    <Overlay title={`MISSÃO — ${template.name.toUpperCase()}`} onClose={onClose} wide>
      <div className={styles.dispatch}>
        <div className={styles.radarSide}>
          <HexRadar requirement={template.requirement} teamSum={teamSum(team)} />
          <div className={styles.stats}>
            <span>
              Sucesso: <b>{probability}%</b>
            </span>
            <span>
              Tempo: <b>~{durationS}s</b>
            </span>
            <span>
              Time: <b>{selected.length}/{MAX_DISPATCH}</b>
            </span>
          </div>
        </div>
        <div className={styles.picker}>
          {state.roster.map((mon) => (
            <PokemonCard
              key={mon.id}
              pokemon={mon}
              selected={selected.includes(mon.id)}
              toggle
              disabled={mon.status !== 'idle'}
              onClick={mon.status === 'idle' ? () => toggle(mon.id) : undefined}
            />
          ))}
        </div>
      </div>
      <button type="button" className={styles.confirm} disabled={!valid} onClick={send}>
        Despachar ▶
      </button>
    </Overlay>
  )
}

const PHASE_LABEL: Record<string, string> = {
  traveling: 'A caminho da missão',
  inProgress: 'Em ação no local',
  returning: 'Voltando ao ginásio',
}

/** Status de uma missão já aceita (sem despacho): fase atual, time em campo e chance. */
function MissionStatus({
  state,
  mission,
  onClose,
}: {
  state: GameState
  mission: MissionInstance
  onClose: () => void
}) {
  const template = getMissionTemplate(mission.templateId)
  const team: Pokemon[] = mission.teamIds
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const probability = mission.pSuccess !== null ? Math.round(mission.pSuccess * 100) : null

  return (
    <Overlay title={`MISSÃO — ${template.name.toUpperCase()}`} onClose={onClose} wide>
      <div className={styles.capture}>
        <p className={styles.hint}>
          {PHASE_LABEL[mission.status] ?? 'Em andamento'} — o time está em campo. Aguarde o retorno.
        </p>
        <div className={styles.stats}>
          {probability !== null && (
            <span>
              Sucesso: <b>{probability}%</b>
            </span>
          )}
          <span>
            Time: <b>{team.length}</b>
          </span>
        </div>
        <div className={styles.picker}>
          {team.map((mon) => (
            <PokemonCard key={mon.id} pokemon={mon} disabled />
          ))}
        </div>
      </div>
    </Overlay>
  )
}
