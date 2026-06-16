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

// O dia simula um expediente das 08:00 às 18:00 (10 h). O tempo real do dia
// (DAY_LENGTH_MS) é projetado nesse intervalo e exibido como um relógio HH:MM
// que avança de 10 em 10 minutos: 08:00 → 08:10 → … → 18:00, onde trava.
const DAY_START_HOUR = 8
const DAY_END_HOUR = 18
const GAME_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60 // 600
const STEP_MINUTES = 10

function formatClock(elapsedMs: number, dayLengthMs: number): string {
  const progress = dayLengthMs > 0 ? Math.min(1, Math.max(0, elapsedMs / dayLengthMs)) : 1
  // Trava em 18:00 (GAME_MINUTES) e arredonda para baixo ao passo de 10 min.
  const stepped = Math.min(GAME_MINUTES, Math.floor((progress * GAME_MINUTES) / STEP_MINUTES) * STEP_MINUTES)
  const hour = DAY_START_HOUR + Math.floor(stepped / 60)
  const minute = stepped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
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
  const remaining = formatClock(elapsedMs, dayLengthMs)
  // Ao chegar nas 18:00 o relógio trava e fica vermelho, sinalizando o fim do dia.
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
