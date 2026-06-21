// Painel de perseguição (Feature B): escolhe até 3 Pokémon idle para ir atrás da Rocket. Reusa o
// layout do despacho de missão (grid radarSide + picker), com um R vermelho no lugar do radar.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { Pokemon } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { isAvailable, sortRoster } from '../../engine/roster.ts'
import { THEFT_CHASERS_MAX } from '../../engine/balance.ts'
import { getSpecies, pokemonSpritePath } from '../../data/pokemon/index.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

function monName(mon: Pokemon): string {
  return mon.nickname ?? getSpecies(mon.speciesId).displayName
}

export function TheftChasePanel({ state, dispatch, onClose }: Props) {
  const theft = state.theft
  const [picked, setPicked] = useState<string[]>([])
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return null

  const team: Pokemon[] = picked
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const toggle = (id: string): void =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < THEFT_CHASERS_MAX ? [...cur, id] : cur,
    )
  const remove = (id: string): void => setPicked((cur) => cur.filter((x) => x !== id))

  return (
    <Overlay title="EQUIPE ROCKET — PERSEGUIÇÃO" onClose={onClose} wide>
      <div className={styles.dispatch}>
        <div className={styles.radarSide}>
          <div className={styles.rocketEmblem} aria-hidden="true">R</div>
          <p className={styles.missionReward}>
            <span aria-hidden="true">⚔️</span> Recompensa: 3× XP no resgate
          </p>
          <div className={styles.stats}>
            <span>
              Perseguidores: <b>{picked.length}/{THEFT_CHASERS_MAX}</b>
            </span>
            <span>O relógio continua correndo!</span>
          </div>
          <div className={styles.selectedTeam}>
            <span className={styles.selectedTitle}>Selecionados ({picked.length}/{THEFT_CHASERS_MAX})</span>
            {team.length === 0 ? (
              <span className={styles.selectedEmpty}>Escolha até {THEFT_CHASERS_MAX} Pokémon idle ao lado.</span>
            ) : (
              <ul className={styles.chipList}>
                {team.map((mon) => (
                  <li key={mon.id} className={styles.chip}>
                    <img className={styles.chipSprite} src={pokemonSpritePath(mon)} alt="" draggable={false} />
                    <span className={styles.chipName}>{monName(mon)}</span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => remove(mon.id)}
                      aria-label={`Remover ${monName(mon)} da perseguição`}
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
              selected={picked.includes(mon.id)}
              toggle
              disabled={!isAvailable(mon) || mon.status !== 'idle'}
              onClick={isAvailable(mon) && mon.status === 'idle' ? () => toggle(mon.id) : undefined}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className={styles.confirm}
        disabled={picked.length === 0}
        onClick={() => {
          dispatch({ type: 'DISPATCH_THEFT_CHASERS', chaserIds: picked })
          onClose()
        }}
      >
        Perseguir ▶ ({picked.length})
      </button>
    </Overlay>
  )
}
