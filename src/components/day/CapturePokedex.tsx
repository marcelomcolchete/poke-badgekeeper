// Pokédex da Área (PLAN §4.5, redesign): todas as espécies capturáveis nos tipos do ginásio.
// As já capturadas aparecem coloridas; as ainda não vistas, em silhueta preta (brightness 0).

import type { PokemonType } from '../../types/index.ts'
import { RARITIES } from '../../types/index.ts'
import { capturePool } from '../../data/pokemon/index.ts'
import styles from './Panels.module.css'

interface Props {
  types: readonly PokemonType[]
  /** Conjunto de speciesId já capturados (roster ∪ box ∪ histórico). */
  caught: ReadonlySet<number>
  /** Índice da raridade máxima liberada pela bola atual: só mostra silhuetas até este teto. */
  maxRarityIndex: number
}

export function CapturePokedex({ types, caught, maxRarityIndex }: Props) {
  // Só aparecem (em silhueta) as espécies liberadas pelo nível de bola do jogador.
  const pool = capturePool(types).filter((s) => RARITIES.indexOf(s.rarity) <= maxRarityIndex)
  if (pool.length === 0) return null
  const have = pool.filter((s) => caught.has(s.id)).length

  return (
    <div className={styles.dex}>
      <div className={styles.dexHead}>
        <span className={styles.dexTitle}>Pokédex da área</span>
        <span className={styles.dexCount}>
          {have}/{pool.length}
        </span>
      </div>
      <div className={styles.dexGrid}>
        {pool.map((s) => {
          const seen = caught.has(s.id)
          return (
            <span
              key={s.id}
              className={`${styles.dexTile} ${seen ? '' : styles.dexTileLocked}`}
              title={seen ? s.displayName : '???'}
            >
              <img
                className={styles.dexImg}
                src={s.spritePath}
                alt={seen ? s.displayName : '???'}
                loading="lazy"
              />
            </span>
          )
        })}
      </div>
    </div>
  )
}
