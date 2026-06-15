// Detalhe de um Pokémon do time (aberto a partir da coluna esquerda na fase Dia):
// card completo + distribuir pontos de level-up + usar Potion/Revive.

import type { Dispatch } from 'react'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { getNatureEntry, NATURE_LABEL_PT } from '../../data/natures.ts'
import { secretAbilityFor } from '../../data/secretAbilities.ts'
import { ATTR_MAX } from '../../engine/constants.ts'
import { effectiveAttr, perPointGain } from '../../engine/attributes.ts'
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
  const natureEntry = mon.nature ? getNatureEntry(mon.nature) : null
  const secret = secretAbilityFor(mon.speciesId)
  const secretUnlocked = secret ? mon.passives.includes(secret.id) : false
  const hurt = mon.currentHp > 0 && mon.currentHp < mon.maxHp
  const fainted = mon.currentHp <= 0
  const potions = count(state, 'potion')
  const revives = count(state, 'revive')

  return (
    <Overlay title={displayNameOf(mon).toUpperCase()} onClose={onClose}>
      <div className={styles.body}>
        <PokemonCard pokemon={mon} />

        {mon.nature && (
          <div className={styles.natureLine}>
            <span className={styles.natureName}>{NATURE_LABEL_PT[mon.nature]}</span>
            {natureEntry?.boosted && (
              <span className={styles.natureBoosted}>+ {ATTR_SHORT_PT[natureEntry.boosted]}</span>
            )}
            {natureEntry?.reduced && (
              <span className={styles.natureReduced}>− {ATTR_SHORT_PT[natureEntry.reduced]}</span>
            )}
            {!natureEntry?.boosted && !natureEntry?.reduced && (
              <span className={styles.natureNeutral}>(neutra)</span>
            )}
          </div>
        )}

        {secret && (
          <div className={`${styles.secret} ${secretUnlocked ? styles.secretOn : styles.secretOff}`}>
            <span className={styles.secretHead}>
              <span className={styles.secretIcon}>{secretUnlocked ? '✦' : '🔒'}</span>
              Habilidade Secreta
            </span>
            <span className={styles.secretName}>{secretUnlocked ? secret.name : '? ? ?'}</span>
            <span className={styles.secretDesc}>
              {secretUnlocked ? secret.description : 'Desbloqueie sendo o Destaque do Dia.'}
            </span>
          </div>
        )}

        {pending > 0 && (
          <div className={styles.alloc}>
            <span className={styles.allocLabel}>Distribuir +{pending}:</span>
            <div className={styles.allocBtns}>
              {ATTR_KEYS.map((attr) => {
                const current = effectiveAttr(mon, attr)
                // Ganho REAL ao alocar: o ponto rende +5/+10/+15 pela natureza, mas o teto 60
                // pode aparar o saldo (ex.: 59 → só +1). Mostramos o número exato.
                const gain = Math.min(ATTR_MAX, current + perPointGain(mon, attr)) - current
                const maxed = gain <= 0
                const capped = !maxed && gain < perPointGain(mon, attr)
                const btnClass = [
                  styles.allocBtn,
                  capped ? styles.allocBtnCapped : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={attr}
                    type="button"
                    className={btnClass}
                    disabled={maxed}
                    title={
                      maxed
                        ? `${ATTR_SHORT_PT[attr]} já está no máximo (${ATTR_MAX})`
                        : `${ATTR_SHORT_PT[attr]}: ${current} → ${current + gain}`
                    }
                    onClick={() => dispatch({ type: 'ALLOCATE_POINT', pokemonId: mon.id, attr })}
                  >
                    <span className={styles.allocName}>{ATTR_SHORT_PT[attr]}</span>
                    <span className={styles.allocGain}>{maxed ? 'máx' : `+${gain}`}</span>
                  </button>
                )
              })}
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
