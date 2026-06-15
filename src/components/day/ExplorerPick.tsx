// Carta enxuta para escolher QUEM explora (PLAN §4.5, redesign): na exploração só importam
// Agilidade, Percepção e Inteligência — então mostramos só esses 3 (Percepção em destaque,
// pois acelera a busca). Sem radar/EXP/raridade, para caber todo o time sem rolagem.

import type { AttrKey, Pokemon } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import { STATUS_LABEL_PT } from '../common/visual.ts'
import styles from './Panels.module.css'

const EXPLORE_STATS: { key: AttrKey; label: string }[] = [
  { key: 'agilidade', label: 'AGI' },
  { key: 'percepcao', label: 'PER' },
  { key: 'inteligencia', label: 'INT' },
]

interface Props {
  pokemon: Pokemon
  disabled?: boolean
  onClick?: () => void
}

export function ExplorerPick({ pokemon, disabled = false, onClick }: Props) {
  const species = getSpecies(pokemon.speciesId)
  const symbol = genderSymbol(pokemon.gender)

  return (
    <button
      type="button"
      className={`${styles.explorer} ${disabled ? styles.explorerOff : ''}`}
      disabled={disabled || !onClick}
      onClick={onClick}
      data-sound={disabled ? undefined : 'select'}
    >
      <img className={styles.explorerSprite} src={species.spritePath} alt={species.displayName} />
      <span className={styles.explorerInfo}>
        <span className={styles.explorerName}>
          {displayNameOf(pokemon)}
          {symbol && <span style={{ color: genderColor(pokemon.gender) }}> {symbol}</span>}
          <span className={styles.explorerLvl}>Nv {pokemon.level}</span>
        </span>
        <span className={styles.explorerStats}>
          {EXPLORE_STATS.map(({ key, label }) => (
            <span
              key={key}
              className={`${styles.exStat} ${key === 'percepcao' ? styles.exStatKey : ''}`}
            >
              <b>{effectiveAttr(pokemon, key)}</b>
              <span className={styles.exStatLbl}>{label}</span>
            </span>
          ))}
        </span>
      </span>
      {disabled && <span className={styles.explorerStatus}>{STATUS_LABEL_PT[pokemon.status]}</span>}
    </button>
  )
}
