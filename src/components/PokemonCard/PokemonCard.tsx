import type { Pokemon, PokemonStatus } from '../../types/index.ts'
import { ATTR_KEYS } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { LEVEL_MAX } from '../../engine/constants.ts'
import { effectiveAttr, effectiveAttrs } from '../../engine/attributes.ts'
import { pendingPoints, xpToNext } from '../../engine/leveling.ts'
import { HexRadar } from '../HexRadar/HexRadar.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { HpBar } from '../common/HpBar.tsx'
import { RARITY_COLOR, RARITY_LABEL_PT } from '../common/visual.ts'
import styles from './PokemonCard.module.css'

const STATUS_LABEL: Record<PokemonStatus, string> = {
  idle: 'Pronto',
  traveling: 'Viajando',
  onMission: 'Em missão',
  defending: 'Defendendo',
  returning: 'Voltando',
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
  const atMaxLevel = pokemon.level >= LEVEL_MAX
  const xpNeeded = xpToNext(pokemon.level)
  const xpLeft = atMaxLevel ? 0 : Math.max(0, xpNeeded - pokemon.xp)
  const xpPct = atMaxLevel ? 100 : Math.min(100, (pokemon.xp / xpNeeded) * 100)
  const evolvesNextLevel = species.evolvesTo?.atLevel === pokemon.level + 1
  const totalStats = ATTR_KEYS.reduce((sum, key) => sum + effectiveAttr(pokemon, key), 0)
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
          <span className={styles.meta}>
            <span className={styles.level}>Nv {pokemon.level}</span>
            <span className={styles.rarity} style={{ color: RARITY_COLOR[species.rarity] }}>
              {RARITY_LABEL_PT[species.rarity]}
            </span>
          </span>
          <span className={styles.types}>
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
        </div>
        {pending > 0 && <span className={styles.pending}>+{pending}★</span>}
      </div>

      <div className={styles.radarBox}>
        <HexRadar values={effectiveAttrs(pokemon)} showValues frame={false} size={150} />
        <span className={styles.total}>
          Total Stats: <b>{totalStats}</b>
        </span>
      </div>

      <div className={styles.foot}>
        <HpBar current={pokemon.currentHp} max={pokemon.maxHp} />
        <span className={styles.status}>{STATUS_LABEL[pokemon.status]}</span>
      </div>

      <div className={styles.exp}>
        <span className={styles.expTrack}>
          <span className={styles.expFill} style={{ width: `${xpPct}%` }} />
        </span>
        <span className={styles.expText}>
          {atMaxLevel
            ? 'Nível máximo'
            : `EXP: faltam ${xpLeft} p/ Nv ${pokemon.level + 1}${evolvesNextLevel ? ' ✦ evolui' : ''}`}
        </span>
      </div>
    </button>
  )
}
