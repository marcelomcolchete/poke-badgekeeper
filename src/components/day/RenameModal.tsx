// Renomear na captura (PLAN §4.5): aparece logo após capturar um Pokémon, mostrando
// o sexo já sorteado e permitindo dar um apelido (opcional). "Manter nome" usa a espécie.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { Pokemon } from '../../types/index.ts'
import type { GameAction } from '../../game/actions.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { Overlay } from '../common/Overlay.tsx'
import { genderColor, genderSymbol } from '../common/naming.ts'
import styles from './RenameModal.module.css'

interface Props {
  pokemon: Pokemon
  dispatch: Dispatch<GameAction>
  onDone: () => void
}

const MAX_LEN = 16

export function RenameModal({ pokemon, dispatch, onDone }: Props) {
  const species = getSpecies(pokemon.speciesId)
  const [name, setName] = useState('')
  const symbol = genderSymbol(pokemon.gender)

  const confirm = (): void => {
    const trimmed = name.trim()
    if (trimmed) dispatch({ type: 'RENAME_POKEMON', pokemonId: pokemon.id, nickname: trimmed })
    onDone()
  }

  return (
    <Overlay title="POKÉMON CAPTURADO!" onClose={onDone}>
      <div className={styles.body}>
        <img className={styles.sprite} src={species.spritePath} alt={species.displayName} />
        <span className={styles.species}>
          {species.displayName}
          {symbol && (
            <span className={styles.gender} style={{ color: genderColor(pokemon.gender) }}>
              {symbol}
            </span>
          )}
          <span className={styles.level}>Nv {pokemon.level}</span>
        </span>

        <label className={styles.field}>
          <span className={styles.label}>Dar um apelido?</span>
          <input
            className={styles.input}
            type="text"
            value={name}
            maxLength={MAX_LEN}
            placeholder={species.displayName}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={onDone}>
            Manter nome
          </button>
          <button type="button" className={styles.primary} onClick={confirm} disabled={!name.trim()}>
            Confirmar apelido
          </button>
        </div>
      </div>
    </Overlay>
  )
}
