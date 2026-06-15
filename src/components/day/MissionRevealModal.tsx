// Conclusão de missão (PLAN §4.2, ajuste): ao resolver uma missão o jogo pausa e
// mostra os dois gráficos sobrepostos (exigência × time) com um ponto que oscila e
// pousa — DENTRO da interseção = vitória; FORA = derrota. O desfecho vem da engine
// (Bernoulli semeado, em mission.result); o ponto é a visualização desse resultado.

import { useEffect, useRef, useState } from 'react'
import type { Attrs, Pokemon } from '../../types/index.ts'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState, MissionInstance } from '../../engine/state.ts'
import { getMissionTemplate, missionReward } from '../../data/missionTemplates.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { teamSum } from '../../engine/attributes.ts'
import { TEAM_ATTR_MAX } from '../../engine/constants.ts'
import { HexRadar } from '../HexRadar/HexRadar.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { displayNameOf } from '../common/naming.ts'
import styles from './MissionRevealModal.module.css'

const SIZE = 260
// Escala do ponto = teto das missões (mesma do HexRadar) p/ o pouso casar com o desenho.
const AXIS_MAX = TEAM_ATTR_MAX
const SETTLE_MS = 1400

interface Props {
  state: GameState
  mission: MissionInstance
  onClose: () => void
  /** Missão Rocket cumprida: inicia a batalha (em vez de "Continuar"). */
  onBattle?: () => void
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

export function MissionRevealModal({ state, mission, onClose, onBattle }: Props) {
  const template = getMissionTemplate(mission.templateId)
  // Rocket cumprida e ainda sem batalha: a tela mostra "Batalhar" e nenhuma recompensa.
  const rocketPending = !!mission.rocket && !mission.rocket.resolved
  const team: Pokemon[] = mission.teamIds
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const requirement = mission.requirement
  const sum = teamSum(team)
  const success = mission.result === 'success'
  const percent = mission.pSuccess !== null ? Math.round(mission.pSuccess * 100) : null
  const reward = missionReward(template)
  const totalXp = Object.values(mission.xpAwards ?? {}).reduce((a, b) => a + b, 0)

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
    // Rocket cumprida: a batalha é obrigatória — sem fechar a tela (só o botão "Batalhar").
    <Overlay
      title={`MISSÃO — ${template.name.toUpperCase()}`}
      onClose={rocketPending ? undefined : onClose}
    >
      <div className={styles.reveal}>
        <div className={styles.radarWrap}>
          <HexRadar requirement={requirement} teamSum={sum} size={SIZE} axisMax={AXIS_MAX} />
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

        {settled && rocketPending && (
          <p className={styles.chance}>
            ⚔️ A Equipe Rocket apareceu! Vença a batalha para receber ouro + 3× XP.
          </p>
        )}

        {settled && !rocketPending && (
          <div className={styles.results}>
            <span className={styles.resultsTitle}>
              {success ? 'Recompensas' : 'Time de volta ao ginásio'}
            </span>
            <ul className={styles.crewList}>
              {team.map((mon) => {
                const xp = mission.xpAwards?.[mon.id] ?? 0
                const fainted = mon.currentHp <= 0
                return (
                  <li key={mon.id} className={styles.crewRow}>
                    <img
                      className={styles.crewSprite}
                      src={getSpecies(mon.speciesId).spritePath}
                      alt=""
                      draggable={false}
                    />
                    <span className={styles.crewName}>
                      {fainted && <span aria-hidden="true">💀 </span>}
                      {displayNameOf(mon)}
                    </span>
                    {success ? (
                      <span className={styles.crewXp}>+{xp} XP</span>
                    ) : (
                      <span className={styles.crewHp}>
                        HP {mon.currentHp}/{mon.maxHp}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {success && (
              <div className={styles.totals}>
                <span className={styles.totalLine}>
                  XP total: <b>+{totalXp}</b>
                </span>
                {reward && (
                  <span className={styles.totalLine}>
                    <span aria-hidden="true">{reward.icon}</span> {reward.label}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {rocketPending ? (
          <button
            type="button"
            className={styles.continue}
            onClick={onBattle}
            disabled={!settled || !onBattle}
          >
            Batalhar ⚔️
          </button>
        ) : (
          <button type="button" className={styles.continue} onClick={onClose} disabled={!settled}>
            Continuar ▶
          </button>
        )}
      </div>
    </Overlay>
  )
}
