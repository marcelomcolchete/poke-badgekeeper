import { STARS_MAX } from '../../engine/constants.ts'
import styles from './common.module.css'

/** Estrelas 1–5 (passos de 0,5) por sobreposição de largura — PLAN §4.7. */
export function Stars({ value }: { value: number }) {
  const pct = `${(value / STARS_MAX) * 100}%`
  return (
    <span className={styles.stars}>
      <span className={styles.starsOff}>{'★'.repeat(STARS_MAX)}</span>
      <span className={styles.starsOn} style={{ width: pct }}>
        {'★'.repeat(STARS_MAX)}
      </span>
    </span>
  )
}
