// Painel do time (PLAN §3.1): ver os Pokémon, distribuir pontos de level-up
// (modal §4.1) e usar itens (Potion/Revive).

import type { Dispatch } from 'react'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { pendingPoints } from '../../engine/leveling.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import styles from './TeamPanel.module.css'

function count(state: GameState, itemId: string): number {
  return state.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0
}

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

export function TeamPanel({ state, dispatch, onClose }: Props) {
  const potions = count(state, 'potion')
  const revives = count(state, 'revive')

  return (
    <Overlay title="TIME" onClose={onClose} wide>
      <div className={styles.grid}>
        {state.roster.map((mon) => {
          const pending = pendingPoints(mon)
          const hurt = mon.currentHp > 0 && mon.currentHp < mon.maxHp
          const fainted = mon.currentHp <= 0
          return (
            <div key={mon.id} className={styles.entry}>
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
          )
        })}
      </div>
    </Overlay>
  )
}
