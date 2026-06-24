import { HEARTS_MAX } from '../../engine/constants.ts'
import { heartsOf, heartXpMultiplier } from '../../engine/hearts.ts'
import styles from './common.module.css'

/** Rótulo compacto do multiplicador de XP por nível de afinidade (passos de 0,5). */
const XP_MULT_LABEL: Record<number, string> = {
  0: '⅛',
  0.5: '0,18',
  1: '¼',
  1.5: '0,35',
  2: '½',
  2.5: '0,71',
  3: '1',
  3.5: '1,41',
  4: '2',
  4.5: '2,83',
  5: '4',
}

/** Texto do multiplicador de XP exibido ao lado dos corações (sem o '×'). */
export function xpMultiplierLabel(hearts: number): string {
  return XP_MULT_LABEL[hearts] ?? heartXpMultiplier(hearts).toFixed(2).replace('.', ',')
}

/** Corações 0–5 (passos de 0,5) por sobreposição de largura — afinidade do Pokémon. */
export function Hearts({ value }: { value: number | undefined }) {
  const hearts = heartsOf(value)
  const pct = `${(hearts / HEARTS_MAX) * 100}%`
  const label = xpMultiplierLabel(hearts)
  const full = hearts === HEARTS_MAX
  const onClass = full ? `${styles.heartsOn} ${styles.heartsGold}` : styles.heartsOn
  return (
    <span
      className={styles.hearts}
      aria-label={`${hearts} de ${HEARTS_MAX} corações — ×${label} de XP`}
    >
      <span className={styles.heartsOff}>{'♥'.repeat(HEARTS_MAX)}</span>
      <span className={onClass} style={{ width: pct }}>
        {'♥'.repeat(HEARTS_MAX)}
      </span>
      <span className={styles.heartsXp} aria-hidden="true">{`×${label} XP`}</span>
    </span>
  )
}
