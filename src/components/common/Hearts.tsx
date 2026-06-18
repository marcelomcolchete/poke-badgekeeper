import { HEARTS_MAX } from '../../engine/constants.ts'
import { heartsOf } from '../../engine/hearts.ts'
import styles from './common.module.css'

/** Corações 0–5 (passos de 0,5) por sobreposição de largura — afinidade do Pokémon. */
export function Hearts({ value }: { value: number | undefined }) {
  const hearts = heartsOf(value)
  const pct = `${(hearts / HEARTS_MAX) * 100}%`
  return (
    <span
      className={styles.hearts}
      aria-label={`${hearts} de ${HEARTS_MAX} corações`}
      title={`${hearts}/${HEARTS_MAX} corações — +${Math.round(Math.min(0.5, hearts * 0.1) * 100)}% de XP`}
    >
      <span className={styles.heartsOff}>{'♥'.repeat(HEARTS_MAX)}</span>
      <span className={styles.heartsOn} style={{ width: pct }}>
        {'♥'.repeat(HEARTS_MAX)}
      </span>
    </span>
  )
}
