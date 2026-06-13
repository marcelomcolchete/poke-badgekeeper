import type { PokemonType } from '../../types/index.ts'
import { TYPE_LABEL_PT, typeColorVar } from './visual.ts'
import styles from './common.module.css'

/** Badge retrô com a cor canônica do tipo (PLAN §2.1). */
export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <span className={styles.typeBadge} style={{ backgroundColor: typeColorVar(type) }}>
      {TYPE_LABEL_PT[type]}
    </span>
  )
}
