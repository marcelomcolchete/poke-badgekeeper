// Mapa da cidade na fase Dia (PLAN §3.1): a arte vai num "palco" 16:9 centralizado
// (letterbox — nunca corta e os marcadores ficam alinhados à arte). Missões/eventos
// surgem nos pontos do grafo; os Pokémon despachados caminham ponto a ponto (ida e
// volta) e suas fotos aparecem se deslocando pelo mapa.

import type { MouseEvent } from 'react'
import type { MapPos, Pokemon } from '../../types/index.ts'
import type { CityGraph } from '../../data/types.ts'
import type { DefenseEvent, GameState, MissionInstance } from '../../engine/state.ts'
import { getCity, markerPos } from '../../data/cities.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { pointAlongPath } from '../../engine/pathfinding.ts'
import { clamp } from '../../engine/math.ts'
import styles from './CityMap.module.css'

/** Missões que aparecem no mapa: disponíveis e as já aceitas (em trânsito/ação/volta) — #4. */
const VISIBLE_MISSION_STATUSES: MissionInstance['status'][] = [
  'available',
  'traveling',
  'inProgress',
  'returning',
]

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
// normalizada (0–1) no console — usado para calibrar os pontos do grafo de cada cidade.
function logPickedPos(e: MouseEvent<HTMLDivElement>): void {
  if (!import.meta.env.DEV) return
  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  console.log(`{ x: ${x.toFixed(3)}, y: ${y.toFixed(3)} },`)
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

/** Fração [0,1] do tempo decorrido entre dois instantes (start→end). */
function elapsedFraction(now: number, start: number, end: number): number {
  return end > start ? clamp((now - start) / (end - start), 0, 1) : 1
}

export function CityMap({ state, onMission, onDefense, onSpot }: Props) {
  const city = getCity(state.run.cityIndex)
  const graph = city.graph
  const now = state.clock.dayElapsedMs
  const activeDefense = state.defenses.find((d) => d.status === 'active')
  const missions = state.missions.filter((m) => VISIBLE_MISSION_STATUSES.includes(m.status))

  return (
    <div className={styles.map}>
      <div className={styles.stage} onClick={logPickedPos}>
        <img
          className={styles.bg}
          src={city.mapImage}
          width={city.mapW}
          height={city.mapH}
          alt={`Mapa de ${city.name}`}
          draggable={false}
        />

        {activeDefense && (
          <div className={styles.anchor} style={posStyle(markerPos(graph, city.siteNodes.gym))}>
            <DefenseMarker defense={activeDefense} now={now} onClick={() => onDefense(activeDefense.id)} />
          </div>
        )}

        {state.captureSpots.map((node, i) => {
          if (state.today.exploredSpots.includes(i)) return null // área já explorada hoje
          if (now < (state.captureSpotSpawnsAtMs[i] ?? 0)) return null // ainda não surgiu (#7)
          const ready = state.encounters.some((e) => e.spotIndex === i)
          const searching = state.captureSearches.some((c) => c.spotIndex === i)
          return (
            <div key={`spot-${i}`} className={styles.anchor} style={posStyle(markerPos(graph, node))}>
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
          <div key={mission.id} className={styles.anchor} style={posStyle(markerPos(graph, mission.node))}>
            <MissionMarker mission={mission} now={now} onClick={() => onMission(mission.id)} />
          </div>
        ))}

        <MapTravelers state={state} graph={graph} now={now} />
      </div>
    </div>
  )
}

/**
 * Posição atual do time de uma missão em deslocamento (ida/volta), ou null. Ao CHEGAR
 * na missão ('inProgress') o time some do mapa; reaparece só na volta ('returning') — #3.
 */
function missionTravelerPos(graph: CityGraph, m: MissionInstance, now: number): MapPos | null {
  if (m.path.length === 0) return null
  if (m.status === 'traveling' && m.acceptedAtMs !== null && m.arriveAtMs !== null) {
    return pointAlongPath(graph, m.path, elapsedFraction(now, m.acceptedAtMs, m.arriveAtMs))
  }
  if (m.status === 'returning' && m.resolveAtMs !== null && m.returnEndsAtMs !== null) {
    const back = [...m.path].reverse()
    return pointAlongPath(graph, back, elapsedFraction(now, m.resolveAtMs, m.returnEndsAtMs))
  }
  return null
}

/** Sprites do time/procurador se movendo pelo mapa (ponto a ponto), ida e volta. */
function MapTravelers({ state, graph, now }: { state: GameState; graph: CityGraph; now: number }) {
  return (
    <>
      {state.missions.map((m) => {
        const pos = missionTravelerPos(graph, m, now)
        return pos ? (
          <TravelerGroup key={`m-${m.id}`} pos={pos} ids={m.teamIds} roster={state.roster} />
        ) : null
      })}
      {state.captureSearches.map((c) => {
        // Ao chegar no local, o procurador some (entra na grama); reaparece só na volta — #3.
        if (c.phase !== 'traveling') return null
        const pos = pointAlongPath(graph, c.path, elapsedFraction(now, c.departAtMs, c.arriveAtMs))
        return <TravelerGroup key={`s-${c.searcherId}`} pos={pos} ids={[c.searcherId]} roster={state.roster} />
      })}
      {state.captureReturns.map((r) => {
        const pos = pointAlongPath(graph, [...r.path].reverse(), elapsedFraction(now, r.departAtMs, r.arriveAtMs))
        return <TravelerGroup key={`r-${r.searcherId}`} pos={pos} ids={[r.searcherId]} roster={state.roster} />
      })}
    </>
  )
}

/** Grupo de até 3 sprites agrupados numa posição do mapa. */
function TravelerGroup({ pos, ids, roster }: { pos: MapPos; ids: string[]; roster: Pokemon[] }) {
  const mons = ids
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
    .slice(0, 3)
  if (mons.length === 0) return null
  return (
    <div className={styles.travelers} style={posStyle(pos)}>
      {mons.map((mon) => (
        <img
          key={mon.id}
          className={styles.traveler}
          src={getSpecies(mon.speciesId).spritePath}
          alt=""
          draggable={false}
        />
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
  // Toda missão usa o mesmo marcador "!" (captura/ginásio têm marcadores próprios) — #1.
  // Aceita: o anel congela (cheio) e o marcador continua no mapa, sem piscar — #4.
  const available = mission.status === 'available'
  const fraction = available ? timerFraction(mission, now) : 1
  return (
    <button
      type="button"
      className={`${styles.ring} ${available ? '' : styles.ringBusy}`}
      style={ringStyle(fraction)}
      onClick={onClick}
      aria-label={available ? 'Missão disponível' : 'Missão em andamento'}
    >
      <span className={`${styles.icon} ${styles.bang}`}>!</span>
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
