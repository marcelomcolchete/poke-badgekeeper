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
  /** Abre a confirmação de desistir (ícone no canto do header). */
  onQuit?: () => void
}

// Ordem dos controles: 1x, 2x, 3x e por fim a pausa (hotkey "4") — PLAN §3.1.
const SPEED_OPTIONS: { value: GameSpeed; label: string }[] = [
  { value: 1, label: '▶' },
  { value: 2, label: '▶▶' },
  { value: 3, label: '▶▶▶' },
  { value: 0, label: 'II' },
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
  onQuit,
}: HudProps) {
  const remaining = formatClock(dayLengthMs - elapsedMs)
  const overtime = elapsedMs >= dayLengthMs
  const starsPct = `${(stars / STARS_MAX) * 100}%`

  return (
    <div className={styles.hud}>
      <span className={styles.group}>
        <span className={styles.day}>
          DIA {day}/{totalDays}
        </span>
        {onQuit && (
          <button
            type="button"
            className={styles.quit}
            onClick={onQuit}
            aria-label="Desistir da run"
            title="Desistir da run"
            data-sound="deselect"
          >
            🚪
          </button>
        )}
      </span>

      <span className={styles.sep} aria-hidden="true" />

      <span className={styles.clock}>
        <span className={styles.muted}>TEMPO</span>
        <span className={overtime ? styles.clockLow : undefined}>{remaining}</span>
      </span>

      <span className={styles.gold}>$ {gold}</span>

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

      <span className={styles.sep} aria-hidden="true" />

      <span className={styles.stars}>
        <span className={styles.starsOff}>{'★'.repeat(STARS_MAX)}</span>
        <span className={styles.starsOn} style={{ width: starsPct }}>
          {'★'.repeat(STARS_MAX)}
        </span>
      </span>
    </div>
  )
}
