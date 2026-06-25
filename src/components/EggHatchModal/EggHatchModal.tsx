import type { Dispatch } from 'react'
import type { GameAction } from '../../game/actions.ts'
import type { HatchResult } from '../../engine/state.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { displayNameOf } from '../common/naming.ts'
import { Overlay } from '../common/Overlay.tsx'
import styles from './EggHatchModal.module.css'

interface Props {
  hatch: HatchResult
  dispatch: Dispatch<GameAction>
}

export function EggHatchModal({ hatch, dispatch }: Props) {
  const { pokemon, toTeam } = hatch
  const species = getSpecies(pokemon.speciesId)
  const sprite = pokemon.shiny ? species.shinySpritePath : species.spritePath
  return (
    <Overlay title="O OVO CHOCOU!" onClose={() => dispatch({ type: 'DISMISS_HATCH' })}>
      <div className={styles.body}>
        <img className={styles.sprite} src={sprite} alt="" />
        <p className={styles.name}>
          {displayNameOf(pokemon)}
          {pokemon.shiny ? ' ✨' : ''}
        </p>
        <p className={styles.dest}>{toTeam ? 'Foi direto para o seu time!' : 'Foi para o Computador (PC).'}</p>
        <button type="button" className={styles.ok} onClick={() => dispatch({ type: 'DISMISS_HATCH' })} data-sound="select">
          OK
        </button>
      </div>
    </Overlay>
  )
}
