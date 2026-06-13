// Radar hexagonal sobreposto (PLAN §3.1/§4.2): a exigência da missão e a soma do
// time (capada em 100) desenhadas nos 6 eixos canônicos a 60°. A sobreposição das
// áreas ilustra a P_sucesso (interseção ÷ exigência).

import { ATTR_KEYS, type Attrs } from '../../types/index.ts'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import styles from './HexRadar.module.css'

const AXIS_MAX = 100
const RINGS = [0.25, 0.5, 0.75, 1]

interface Props {
  requirement: Attrs
  teamSum: Attrs
  size?: number
}

export function HexRadar({ requirement, teamSum, size = 260 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 30

  const at = (r: number, index: number): { x: number; y: number } => {
    const angle = (-90 + 60 * index) * (Math.PI / 180)
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }
  const ringPoints = (scale: number): string =>
    ATTR_KEYS.map((_, i) => pointStr(at(radius * scale, i))).join(' ')
  const valuePoints = (attrs: Attrs): string =>
    ATTR_KEYS.map((key, i) => {
      const value = Math.max(0, Math.min(AXIS_MAX, attrs[key]))
      return pointStr(at((value / AXIS_MAX) * radius, i))
    }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={styles.radar}
      role="img"
      aria-label="Radar da missão contra o time"
    >
      {RINGS.map((scale) => (
        <polygon key={scale} className={styles.grid} points={ringPoints(scale)} />
      ))}
      {ATTR_KEYS.map((key, i) => {
        const spoke = at(radius, i)
        const label = at(radius + 16, i)
        return (
          <g key={key}>
            <line className={styles.spoke} x1={cx} y1={cy} x2={spoke.x} y2={spoke.y} />
            <text className={styles.label} x={label.x} y={label.y} textAnchor="middle">
              {ATTR_SHORT_PT[key]}
            </text>
          </g>
        )
      })}
      <polygon className={styles.requirement} points={valuePoints(requirement)} />
      <polygon className={styles.team} points={valuePoints(teamSum)} />
    </svg>
  )
}

function pointStr(p: { x: number; y: number }): string {
  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
}
