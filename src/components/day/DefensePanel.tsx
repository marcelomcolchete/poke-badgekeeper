// Atribuição da defesa de ginásio (PLAN §4.4): escolha do esquadrão (≥1) para a
// cadeia de duelos 1v1. A resolução acontece na hora, no reducer.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { PokemonType } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { MIN_DEFENSE_SQUAD } from '../../engine/constants.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  defenseId: string
  onClose: () => void
}

export function DefensePanel({ state, dispatch, defenseId, onClose }: Props) {
  const defense = state.defenses.find((d) => d.id === defenseId)
  const [selected, setSelected] = useState<string[]>([])
  if (!defense) return null

  const enemyTypes = [...new Set(defense.enemies.flatMap((e) => e.types))] as PokemonType[]
  const maxBattle = defense.enemies.reduce((m, e) => Math.max(m, e.battle), 0)
  const valid = selected.length >= MIN_DEFENSE_SQUAD

  const toggle = (id: string): void =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const defend = (): void => {
    dispatch({ type: 'ASSIGN_DEFENSE', defenseId, squadIds: selected })
    onClose()
  }

  return (
    <Overlay title="DEFESA DO GINÁSIO" onClose={onClose} wide>
      <div className={styles.defenseInfo}>
        <span>
          Invasores: <b>{defense.enemies.length}</b>
        </span>
        <span className={styles.enemyTypes}>
          {enemyTypes.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
        <span>
          Batalha inimiga: <b>{maxBattle}</b>
        </span>
      </div>
      <p className={styles.hint}>
        Escolha ao menos {MIN_DEFENSE_SQUAD} Pokémon disponíveis para a cadeia de duelos 1v1.
      </p>
      <div className={styles.picker}>
        {state.roster.map((mon) => (
          <PokemonCard
            key={mon.id}
            pokemon={mon}
            selected={selected.includes(mon.id)}
            disabled={mon.status !== 'idle'}
            onClick={mon.status === 'idle' ? () => toggle(mon.id) : undefined}
          />
        ))}
      </div>
      <button type="button" className={styles.confirm} disabled={!valid} onClick={defend}>
        Defender ▶ ({selected.length})
      </button>
    </Overlay>
  )
}
