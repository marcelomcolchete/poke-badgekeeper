import type { Pokemon } from '../../types/index.ts'
import { ATTR_KEYS } from '../../types/index.ts'
import { getSpecies, pokemonSpritePath } from '../../data/pokemon/index.ts'
import { getNatureEntry, NATURE_LABEL_PT } from '../../data/natures.ts'
import { LEVEL_MAX } from '../../engine/constants.ts'
import { effectiveAttr, effectiveAttrs } from '../../engine/attributes.ts'
import { pendingPoints, xpToNext } from '../../engine/leveling.ts'
import { pokemonRank } from '../../engine/ranking.ts'
import { HexRadar } from '../HexRadar/HexRadar.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { HpBar } from '../common/HpBar.tsx'
import { RANK_COLOR, RARITY_COLOR, RARITY_LABEL_PT, STATUS_LABEL_PT } from '../common/visual.ts'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import styles from './PokemonCard.module.css'

interface Props {
  pokemon: Pokemon
  selected?: boolean
  disabled?: boolean
  /** Quando true, vira um botão de alternância (aria-pressed) — habilita o som select/deselect. */
  toggle?: boolean
  onClick?: () => void
}

export function PokemonCard({ pokemon, selected = false, disabled = false, toggle = false, onClick }: Props) {
  const species = getSpecies(pokemon.speciesId)
  const pending = pendingPoints(pokemon)
  const atMaxLevel = pokemon.level >= LEVEL_MAX
  const natureEntry = pokemon.nature ? getNatureEntry(pokemon.nature) : null
  const rank = pokemonRank(pokemon)
  const xpNeeded = xpToNext(pokemon.level)
  const xpPct = atMaxLevel ? 100 : Math.min(100, (pokemon.xp / xpNeeded) * 100)
  const evolvesAt = species.evolvesTo?.atLevel
  const totalStats = ATTR_KEYS.reduce((sum, key) => sum + effectiveAttr(pokemon, key), 0)
  const classes = [
    styles.card,
    selected ? styles.selected : '',
    disabled ? styles.disabled : '',
    pokemon.currentHp <= 0 ? styles.fainted : '',
  ].join(' ')

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-pressed={toggle ? selected : undefined}
    >
      <span className={styles.rank} style={{ color: RANK_COLOR[rank], borderColor: RANK_COLOR[rank] }} aria-label={`Rank ${rank}`}>
        <span className={styles.rankTag}>RANK</span>
        <span className={styles.rankLetter}>{rank}</span>
      </span>
      <div className={styles.head}>
        <img className={styles.sprite} src={pokemonSpritePath(pokemon)} alt={species.displayName} />
        {pokemon.shiny && (
          <span className={styles.shiny} aria-label="Shiny" title="Shiny">
            ✨
          </span>
        )}
        <div className={styles.id}>
          <span className={styles.name}>
            {displayNameOf(pokemon)}
            {genderSymbol(pokemon.gender) && (
              <span
                className={styles.gender}
                style={{ color: genderColor(pokemon.gender) }}
                aria-label={pokemon.gender === 'female' ? 'Fêmea' : 'Macho'}
              >
                {genderSymbol(pokemon.gender)}
              </span>
            )}
          </span>
          <span className={styles.meta}>
            <span className={styles.level}>Nv {pokemon.level}</span>
            <span className={styles.rarity} style={{ color: RARITY_COLOR[species.rarity] }}>
              {RARITY_LABEL_PT[species.rarity]}
            </span>
            {pending > 0 && <span className={styles.pending}>+{pending}★</span>}
          </span>
          {pokemon.nature && (
            <span className={styles.nature}>
              {NATURE_LABEL_PT[pokemon.nature]}
            </span>
          )}
          <span className={styles.types}>
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
        </div>
      </div>

      <div className={styles.radarBox}>
        <HexRadar
          values={effectiveAttrs(pokemon)}
          showValues
          frame={false}
          size={150}
          boostedAxis={natureEntry?.boosted ?? null}
          reducedAxis={natureEntry?.reduced ?? null}
        />
        <span className={styles.total}>
          Total Stats: <b>{totalStats}</b>
        </span>
      </div>

      <div className={styles.foot}>
        <HpBar current={pokemon.currentHp} max={pokemon.maxHp} />
        <span className={styles.status}>{STATUS_LABEL_PT[pokemon.status]}</span>
      </div>

      <div className={styles.exp}>
        <span className={styles.expTrack}>
          <span className={styles.expFill} style={{ width: `${xpPct}%` }} />
        </span>
        <span className={styles.expText}>
          {atMaxLevel
            ? 'Nível máximo'
            : `EXP: ${pokemon.xp}/${xpNeeded}${evolvesAt !== undefined ? ` ✦ evolui no Nv ${evolvesAt}` : ''}`}
        </span>
      </div>
    </button>
  )
}
