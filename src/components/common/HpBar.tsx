import styles from './common.module.css'

/** Barra de HP verde→amarelo→vermelho (PLAN §2.1). */
export function HpBar({ current, max }: { current: number; max: number }) {
  const ratio = max > 0 ? current / max : 0
  const color = ratio > 0.5 ? 'var(--c-hp-high)' : ratio > 0.2 ? 'var(--c-hp-mid)' : 'var(--c-hp-low)'
  return (
    <span className={styles.hp}>
      <span className={styles.hpLabel}>HP</span>
      <span className={styles.hpTrack}>
        <span className={styles.hpFill} style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
      </span>
      <span className={styles.hpText}>
        {current}/{max}
      </span>
    </span>
  )
}
