// Mapa da cidade na fase Dia (PLAN §3.1): missões como popups com timer, áreas de
// captura fixas e o símbolo de defesa sobre o ginásio. Posições normalizadas (0–1).

import type { MouseEvent } from 'react'
import type { MapPos } from '../../types/index.ts'
import type { DefenseEvent, GameState, MissionInstance } from '../../engine/state.ts'
import { getCity } from '../../data/cities.ts'
import { getMissionTemplate } from '../../data/missionTemplates.ts'
import { clamp } from '../../engine/math.ts'
import styles from './CityMap.module.css'

interface Props {
  state: GameState
  onMission: (id: string) => void
  onDefense: (id: string) => void
  onSpot: (spotIndex: number) => void
}

function posStyle(p: MapPos): { left: string; top: string } {
  return { left: `${p.x * 100}%`, top: `${p.y * 100}%` }
}

// Dev picker (PLAN §3.1): em desenvolvimento, clicar no mapa loga a coordenada
// normalizada (0–1) no console — usado para calibrar as âncoras de cada cidade.
function logPickedPos(e: MouseEvent<HTMLDivElement>): void {
  if (!import.meta.env.DEV) return
  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  console.log(`{ x: ${x.toFixed(2)}, y: ${y.toFixed(2)} },`)
}

function timerFraction(event: { spawnAtMs: number; expiresAtMs: number }, now: number): number {
  const span = event.expiresAtMs - event.spawnAtMs
  return span > 0 ? clamp((event.expiresAtMs - now) / span, 0, 1) : 0
}

function ringStyle(fraction: number): { background: string } {
  return {
    background: `conic-gradient(var(--c-hud-accent) ${fraction * 360}deg, rgba(10,12,40,0.45) 0)`,
  }
}

export function CityMap({ state, onMission, onDefense, onSpot }: Props) {
  const city = getCity(state.run.cityIndex)
  const now = state.clock.dayElapsedMs
  const activeDefense = state.defenses.find((d) => d.status === 'active')
  const missions = state.missions.filter((m) => m.status === 'available')

  return (
    <div className={styles.map} onClick={logPickedPos}>
      <img
        className={styles.bg}
        src={city.mapImage}
        width={city.mapW}
        height={city.mapH}
        alt={`Mapa de ${city.name}`}
        draggable={false}
      />

      <div className={styles.anchor} style={posStyle(city.sites.gym)}>
        {activeDefense ? (
          <DefenseMarker defense={activeDefense} now={now} onClick={() => onDefense(activeDefense.id)} />
        ) : (
          <span className={styles.building} title="Ginásio">
            🏛️
          </span>
        )}
      </div>

      {state.captureSpots.map((spot, i) => {
        if (state.today.exploredSpots.includes(i)) return null // área já explorada hoje
        const ready = state.encounters.some((e) => e.spotIndex === i)
        const searching = state.captureSearches.some((c) => c.spotIndex === i)
        return (
          <div key={`spot-${i}`} className={styles.anchor} style={posStyle(spot)}>
            <button
              type="button"
              className={`${styles.disc} ${styles.capture} ${ready ? styles.ready : ''}`}
              onClick={() => onSpot(i)}
              aria-label={`Área de captura ${i + 1}`}
            >
              🌿
              {ready && <span className={styles.tag}>!</span>}
              {!ready && searching && <span className={styles.tag}>…</span>}
            </button>
          </div>
        )
      })}

      {missions.map((mission) => (
        <div key={mission.id} className={styles.anchor} style={posStyle(mission.pos)}>
          <MissionMarker mission={mission} now={now} onClick={() => onMission(mission.id)} />
        </div>
      ))}
    </div>
  )
}

function MissionMarker({
  mission,
  now,
  onClick,
}: {
  mission: MissionInstance
  now: number
  onClick: () => void
}) {
  const template = getMissionTemplate(mission.templateId)
  return (
    <button type="button" className={styles.ring} style={ringStyle(timerFraction(mission, now))} onClick={onClick}>
      <span className={styles.icon}>{template.themeIcon}</span>
    </button>
  )
}

function DefenseMarker({
  defense,
  now,
  onClick,
}: {
  defense: DefenseEvent
  now: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.ring} ${styles.defenseRing}`}
      style={ringStyle(timerFraction(defense, now))}
      onClick={onClick}
      aria-label="Defesa do ginásio"
    >
      <span className={styles.icon}>⚔️</span>
    </button>
  )
}
