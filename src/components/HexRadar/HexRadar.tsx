// Radar hexagonal sobreposto (PLAN §3.1/§4.2): a exigência da missão e a soma do
// time (capada no teto de atributos) desenhadas nos 6 eixos canônicos a 60°. A
// sobreposição das áreas ilustra a P_sucesso (interseção ÷ exigência).
//
// Modo individual: passando só `values` (e opcionalmente `showValues`), desenha um
// único polígono — o gráfico de atributos de UM Pokémon, com a pontuação sob cada
// eixo (usado na carta do Pokémon — PLAN §4.1).

import { ATTR_KEYS, type Attrs, type AttrKey } from '../../types/index.ts'
import { ATTR_MAX } from '../../engine/constants.ts'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import styles from './HexRadar.module.css'

const AXIS_MAX = ATTR_MAX
const RINGS = [0.25, 0.5, 0.75, 1]

interface Props {
  /** Exigência da missão (polígono laranja). Ausente no modo individual. */
  requirement?: Attrs
  /** Soma do time, capada em 100 (polígono verde). Ausente no modo individual. */
  teamSum?: Attrs
  /** Atributos de um único Pokémon (polígono verde) — modo individual. */
  values?: Attrs
  /** Mostra a pontuação numérica sob cada eixo (modo individual) — PLAN §4.1. */
  showValues?: boolean
  /** Desenha a moldura/fundo do painel (desligado quando embutido numa carta). */
  frame?: boolean
  size?: number
  /** Eixo favorecido pela natureza — label e spoke em azul. */
  boostedAxis?: AttrKey | null
  /** Eixo penalizado pela natureza — label e spoke em vermelho. */
  reducedAxis?: AttrKey | null
}

export function HexRadar({
  requirement,
  teamSum,
  values,
  showValues = false,
  frame = true,
  size = 260,
  boostedAxis = null,
  reducedAxis = null,
}: Props) {
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
      className={`${styles.radar} ${frame ? '' : styles.flush}`}
      role="img"
      aria-label="Radar de atributos"
    >
      {RINGS.map((scale) => (
        <polygon key={scale} className={styles.grid} points={ringPoints(scale)} />
      ))}
      {ATTR_KEYS.map((key, i) => {
        const spoke = at(radius, i)
        const label = at(radius + 16, i)
        const isBoosted = key === boostedAxis
        const isReduced = key === reducedAxis
        const spokeClass = isBoosted ? styles.spokeBoosted : isReduced ? styles.spokeReduced : styles.spoke
        const labelClass = isBoosted ? styles.labelBoosted : isReduced ? styles.labelReduced : styles.label
        return (
          <g key={key}>
            <line className={spokeClass} x1={cx} y1={cy} x2={spoke.x} y2={spoke.y} />
            <text className={labelClass} x={label.x} y={label.y} textAnchor="middle">
              {ATTR_SHORT_PT[key]}
            </text>
            {showValues && values && (
              <text
                className={Math.round(values[key]) >= AXIS_MAX ? styles.valueMax : styles.value}
                x={label.x}
                y={label.y + 10}
                textAnchor="middle"
              >
                {Math.round(values[key])}
              </text>
            )}
          </g>
        )
      })}
      {requirement && <polygon className={styles.requirement} points={valuePoints(requirement)} />}
      {teamSum && <polygon className={styles.team} points={valuePoints(teamSum)} />}
      {values && <polygon className={styles.team} points={valuePoints(values)} />}
    </svg>
  )
}

function pointStr(p: { x: number; y: number }): string {
  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
}
