// Painel de perseguição (Feature B): escolhe até 3 Pokémon idle para ir atrás da Rocket. Espelha o
// seletor de esquadrão da defesa. Despacha via DISPATCH_THEFT_CHASERS; o relógio segue correndo.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { isAvailable, sortRoster } from '../../engine/roster.ts'
import { THEFT_CHASERS_MAX } from '../../engine/balance.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

export function TheftChasePanel({ state, dispatch, onClose }: Props) {
  const theft = state.theft
  const [picked, setPicked] = useState<string[]>([])
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return null

  const candidates = sortRoster(state.roster).filter((p) => isAvailable(p) && p.status === 'idle')
  const toggle = (id: string): void =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < THEFT_CHASERS_MAX ? [...cur, id] : cur,
    )

  return (
    <Overlay title="EQUIPE ROCKET — PERSEGUIÇÃO" onClose={onClose} wide>
      <div className={styles.capture}>
        <p className={styles.hint}>
          Escolha até {THEFT_CHASERS_MAX} Pokémon idle para perseguir a Rocket. O relógio continua
          correndo!
        </p>
        <div className={styles.stats}>
          <span>
            Perseguidores: <b>{picked.length}/{THEFT_CHASERS_MAX}</b>
          </span>
          {candidates.length === 0 && (
            <span style={{ color: 'var(--c-hp-low)' }}>Nenhum Pokémon disponível no ginásio.</span>
          )}
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
