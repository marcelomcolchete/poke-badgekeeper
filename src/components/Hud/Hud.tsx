import type { GameSpeed } from '../../types/index.ts'
import { STARS_MAX } from '../../engine/constants.ts'
import styles from './Hud.module.css'

interface HudProps {
  day: number
  totalDays: number
  elapsedMs: number
  dayLengthMs: number
  speed: GameSpeed
  gold: number
  stars: number
  onSpeedChange?: (speed: GameSpeed) => void
}

const SPEED_OPTIONS: { value: GameSpeed; label: string }[] = [
  { value: 0, label: 'II' },
  { value: 1, label: '▶' },
  { value: 2, label: '▶▶' },
  { value: 3, label: '▶▶▶' },
]

function formatClock(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000))
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function Hud({
  day,
  totalDays,
  elapsedMs,
  dayLengthMs,
  speed,
  gold,
  stars,
  onSpeedChange,
}: HudProps) {
  const remaining = formatClock(dayLengthMs - elapsedMs)
  const starsPct = `${(stars / STARS_MAX) * 100}%`

  return (
    <div className={styles.hud}>
      <span className={styles.day}>
        DIA {day}/{totalDays}
      </span>

      <span className={styles.center}>
        <span className={styles.muted}>TEMPO</span>
        <span>{remaining}</span>
        <span className={styles.speedGroup}>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.speedBtn} ${speed === opt.value ? styles.speedActive : ''}`}
              onClick={() => onSpeedChange?.(opt.value)}
              aria-label={`Velocidade ${opt.value === 0 ? 'pausa' : `x${opt.value}`}`}
              aria-pressed={speed === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </span>
      </span>

      <span className={styles.right}>
        <span className={styles.gold}>$ {gold}</span>
        <span className={styles.stars}>
          <span className={styles.starsOff}>{'★'.repeat(STARS_MAX)}</span>
          <span className={styles.starsOn} style={{ width: starsPct }}>
            {'★'.repeat(STARS_MAX)}
          </span>
        </span>
      </span>
    </div>
  )
}
