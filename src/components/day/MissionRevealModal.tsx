// Conclusão de missão (PLAN §4.2, ajuste): ao resolver uma missão o jogo pausa e
// mostra os dois gráficos sobrepostos (exigência × time) com um ponto que oscila e
// pousa — DENTRO da interseção = vitória; FORA = derrota. O desfecho vem da engine
// (Bernoulli semeado, em mission.result); o ponto é a visualização desse resultado.

import { useEffect, useRef, useState } from 'react'
import type { Attrs, Pokemon } from '../../types/index.ts'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState, MissionInstance } from '../../engine/state.ts'
import { getMissionTemplate } from '../../data/missionTemplates.ts'
import { teamSum } from '../../engine/attributes.ts'
import { HexRadar } from '../HexRadar/HexRadar.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './MissionRevealModal.module.css'

const SIZE = 260
const AXIS_MAX = 100
const SETTLE_MS = 1400

interface Props {
  state: GameState
  mission: MissionInstance
  onClose: () => void
}

interface Pt {
  x: number
  y: number
}

const CENTER: Pt = { x: SIZE / 2, y: SIZE / 2 }
const RADIUS = SIZE / 2 - 30

function axis(r: number, index: number): Pt {
  const angle = (-90 + 60 * index) * (Math.PI / 180)
  return { x: CENTER.x + r * Math.cos(angle), y: CENTER.y + r * Math.sin(angle) }
}

/** Ponto-alvo onde a animação pousa: no centro da interseção (vitória) ou na lacuna (derrota). */
function landingPoint(requirement: Attrs, team: Attrs, success: boolean): Pt {
  if (success) {
    // Centroide do hexágono de interseção (min por eixo) — garantidamente dentro dele.
    const pts = ATTR_KEYS.map((k, i) => axis((Math.min(team[k], requirement[k]) / AXIS_MAX) * RADIUS, i))
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    return { x: cx, y: cy }
  }
  // Derrota: eixo de maior lacuna (exigência acima do que o time cobre), no meio da lacuna.
  let worst = 0
  let gap = -1
  ATTR_KEYS.forEach((k, i) => {
    const g = requirement[k] - Math.min(team[k], requirement[k])
    if (g > gap) {
      gap = g
      worst = i
    }
  })
  const k = ATTR_KEYS[worst] as (typeof ATTR_KEYS)[number]
  const mid = (Math.min(team[k], requirement[k]) + requirement[k]) / 2
  return axis((mid / AXIS_MAX) * RADIUS, worst)
}

export function MissionRevealModal({ state, mission, onClose }: Props) {
  const template = getMissionTemplate(mission.templateId)
  const team: Pokemon[] = mission.teamIds
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const requirement = template.requirement
  const sum = teamSum(team)
  const success = mission.result === 'success'
  const percent = mission.pSuccess !== null ? Math.round(mission.pSuccess * 100) : null

  const landing = useRef(landingPoint(requirement, sum, success)).current
  const [dot, setDot] = useState<Pt>(CENTER)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / SETTLE_MS)
      if (t >= 1) {
        setDot(landing)
        setSettled(true)
        return
      }
      // Centro desloca-se rumo ao alvo enquanto a oscilação aleatória encolhe.
      const ease = t * t
      const baseX = CENTER.x + (landing.x - CENTER.x) * ease
      const baseY = CENTER.y + (landing.y - CENTER.y) * ease
      const amp = RADIUS * (1 - t) * 0.7
      const ang = Math.random() * Math.PI * 2
      const rr = Math.random() * amp
      setDot({ x: baseX + Math.cos(ang) * rr, y: baseY + Math.sin(ang) * rr })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [landing])

  return (
    <Overlay title={`MISSÃO — ${template.name.toUpperCase()}`} onClose={onClose}>
      <div className={styles.reveal}>
        <div className={styles.radarWrap}>
          <HexRadar requirement={requirement} teamSum={sum} size={SIZE} />
          <svg className={styles.overlay} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <circle
              className={`${styles.dot} ${settled ? (success ? styles.win : styles.lose) : ''}`}
              cx={dot.x}
              cy={dot.y}
              r={6}
            />
          </svg>
        </div>
        <p className={`${styles.verdict} ${settled ? (success ? styles.winText : styles.loseText) : ''}`}>
          {!settled
            ? 'Resolvendo…'
            : success
              ? 'O ponto caiu na interseção — MISSÃO CUMPRIDA! ✓'
              : 'O ponto caiu fora da interseção — missão falhou.'}
        </p>
        {percent !== null && <p className={styles.chance}>Chance de sucesso: {percent}%</p>}
        <button type="button" className={styles.continue} onClick={onClose} disabled={!settled}>
          Continuar ▶
        </button>
      </div>
    </Overlay>
  )
}
