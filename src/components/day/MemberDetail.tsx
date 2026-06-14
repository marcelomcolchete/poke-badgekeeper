// Detalhe de um Pokémon do time (aberto a partir da coluna esquerda na fase Dia):
// card completo + distribuir pontos de level-up + usar Potion/Revive.

import type { Dispatch } from 'react'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { pendingPoints } from '../../engine/leveling.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
import styles from './MemberDetail.module.css'

function count(state: GameState, itemId: string): number {
  return state.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0
}

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  pokemonId: string
  onClose: () => void
}

export function MemberDetail({ state, dispatch, pokemonId, onClose }: Props) {
  const mon = state.roster.find((p) => p.id === pokemonId)
  if (!mon) return null

  const pending = pendingPoints(mon)
  const hurt = mon.currentHp > 0 && mon.currentHp < mon.maxHp
  const fainted = mon.currentHp <= 0
  const potions = count(state, 'potion')
  const revives = count(state, 'revive')

  return (
    <Overlay title={displayNameOf(mon).toUpperCase()} onClose={onClose}>
      <div className={styles.body}>
        <PokemonCard pokemon={mon} />

        {pending > 0 && (
          <div className={styles.alloc}>
            <span className={styles.allocLabel}>Distribuir +{pending}:</span>
            <div className={styles.allocBtns}>
              {ATTR_KEYS.map((attr) => (
                <button
                  key={attr}
                  type="button"
                  className={styles.allocBtn}
                  onClick={() => dispatch({ type: 'ALLOCATE_POINT', pokemonId: mon.id, attr })}
                >
                  {ATTR_SHORT_PT[attr]}
                </button>
              ))}
            </div>
          </div>
        )}

        {(hurt || fainted) && (
          <div className={styles.items}>
            {hurt && (
              <button
                type="button"
                className={styles.itemBtn}
                disabled={potions <= 0}
                onClick={() => dispatch({ type: 'USE_ITEM', itemId: 'potion', targetId: mon.id })}
              >
                Potion ({potions})
              </button>
            )}
            {fainted && (
              <button
                type="button"
                className={styles.itemBtn}
                disabled={revives <= 0}
                onClick={() => dispatch({ type: 'USE_ITEM', itemId: 'revive', targetId: mon.id })}
              >
                Revive ({revives})
              </button>
            )}
          </div>
        )}
      </div>
    </Overlay>
  )
}
