import type { Pokemon, PokemonStatus } from '../../types/index.ts'
import { ATTR_KEYS } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { pendingPoints } from '../../engine/leveling.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { HpBar } from '../common/HpBar.tsx'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import styles from './PokemonCard.module.css'

const STATUS_LABEL: Record<PokemonStatus, string> = {
  idle: 'Pronto',
  traveling: 'Viajando',
  onMission: 'Em missão',
  defending: 'Defendendo',
  fainted: 'Desmaiado',
  atCenter: 'No Centro',
}

interface Props {
  pokemon: Pokemon
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function PokemonCard({ pokemon, selected = false, disabled = false, onClick }: Props) {
  const species = getSpecies(pokemon.speciesId)
  const pending = pendingPoints(pokemon)
  const classes = [
    styles.card,
    selected ? styles.selected : '',
    disabled ? styles.disabled : '',
    pokemon.currentHp <= 0 ? styles.fainted : '',
  ].join(' ')

  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled || !onClick}>
      <div className={styles.head}>
        <img className={styles.sprite} src={species.spritePath} alt={species.displayName} />
        <div className={styles.id}>
          <span className={styles.name}>{species.displayName}</span>
          <span className={styles.level}>Nv {pokemon.level}</span>
          <span className={styles.types}>
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
        </div>
        {pending > 0 && <span className={styles.pending}>+{pending}★</span>}
      </div>

      <div className={styles.attrs}>
        {ATTR_KEYS.map((key) => (
          <span key={key} className={styles.attr}>
            <span className={styles.attrLabel}>{ATTR_SHORT_PT[key]}</span>
            <span className={styles.attrValue}>{effectiveAttr(pokemon, key)}</span>
          </span>
        ))}
      </div>

      <div className={styles.foot}>
        <HpBar current={pokemon.currentHp} max={pokemon.maxHp} />
        <span className={styles.status}>{STATUS_LABEL[pokemon.status]}</span>
      </div>
    </button>
  )
}
