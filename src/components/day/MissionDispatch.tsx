// Despacho de missão (PLAN §3.1/§4.2): escolha do time (1–6) com o radar hexagonal
// sobreposto (exigência × cobertura do time) e a P_sucesso resultante.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { AttrKey, Pokemon } from '../../types/index.ts'
import type { GameState, MissionInstance } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import type { MissionTemplate } from '../../data/types.ts'
import { MAX_DISPATCH, MIN_DISPATCH, TEAM_ATTR_MAX } from '../../engine/constants.ts'
import { getCity } from '../../data/cities.ts'
import { getMissionTemplate, missionReward } from '../../data/missionTemplates.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { missionDurationMs, missionSuccessProbabilityCtx, travelRoute } from '../../engine/missions.ts'
import {
  teamHasAttrBoost,
  teamSecretSum,
  teamTravelSpeedMultiplier,
  type MissionSecretCtx,
} from '../../engine/secretEffects.ts'
import { sortRoster } from '../../engine/roster.ts'
import { graphWithTunnel } from '../../engine/pathfinding.ts'
import { ATTR_LABEL_PT } from '../common/visual.ts'
import { HexRadar } from '../HexRadar/HexRadar.tsx'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

/** Descrição do subtipo (combinação de atributos) de uma missão. */
function missionSubtitle(template: MissionTemplate, secondary: AttrKey | null | undefined): string | null {
  if (template.gen !== 'normal' || !template.primaryAttr) return null
  const primary = template.primaryAttr
  if (secondary && secondary !== primary) {
    return `${ATTR_LABEL_PT[primary]} + ${ATTR_LABEL_PT[secondary]}`
  }
  return `${ATTR_LABEL_PT[primary]} (mega)`
}

/** Nome exibido de um Pokémon (apelido ou nome da espécie). */
function monName(mon: Pokemon): string {
  return mon.nickname ?? getSpecies(mon.speciesId).displayName
}

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
  const ctx: MissionSecretCtx = {
    team,
    template,
    runtime: state.today.secretRuntime,
    runItems: state.runItems,
  }
  const probability = Math.round(missionSuccessProbabilityCtx(ctx, mission.requirement) * 100)
  const graph = graphWithTunnel(city.graph, state.today.digTunnel)
  const { flying, distance } = travelRoute(graph, city.siteNodes.gym, mission.node, team)
  const speedMult = teamTravelSpeedMultiplier(team, state.today.secretRuntime, state.runItems)
  const durationS = Math.round(missionDurationMs(team, distance, template, speedMult) / 1000)
  const boosted = teamHasAttrBoost(ctx)
  const valid = selected.length >= MIN_DISPATCH && selected.length <= MAX_DISPATCH
  const subtitle = missionSubtitle(template, mission.secondaryAttr)
  const reward = missionReward(template)
  const remove = (id: string): void => setSelected((prev) => prev.filter((x) => x !== id))

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
          {subtitle && <p className={styles.missionSubtitle}>{subtitle}</p>}
          {reward && (
            <p className={styles.missionReward}>
              <span aria-hidden="true">{reward.icon}</span> {reward.label}
            </p>
          )}
          <HexRadar requirement={mission.requirement} teamSum={teamSecretSum(ctx)} axisMax={TEAM_ATTR_MAX} />
          {boosted && (
            <p className={styles.missionReward}>
              <span aria-hidden="true">✦</span> Habilidade Secreta ativa nesta missão
            </p>
          )}
          {flying && (
            <p className={styles.missionReward}>
              <span aria-hidden="true">🪽</span> Voando em linha reta (Fly, só sozinho)
            </p>
          )}
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
          <div className={styles.selectedTeam}>
            <span className={styles.selectedTitle}>Selecionados ({selected.length}/{MAX_DISPATCH})</span>
            {team.length === 0 ? (
              <span className={styles.selectedEmpty}>Escolha até {MAX_DISPATCH} Pokémon ao lado.</span>
            ) : (
              <ul className={styles.chipList}>
                {team.map((mon) => (
                  <li key={mon.id} className={styles.chip}>
                    <img
                      className={styles.chipSprite}
                      src={getSpecies(mon.speciesId).spritePath}
                      alt=""
                      draggable={false}
                    />
                    <span className={styles.chipName}>{monName(mon)}</span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => remove(mon.id)}
                      aria-label={`Remover ${monName(mon)} da missão`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={styles.picker}>
          {sortRoster(state.roster).map((mon) => (
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
