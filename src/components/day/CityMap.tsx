// Mapa da cidade na fase Dia (PLAN §3.1): a arte vai num "palco" 16:9 centralizado
// (letterbox — nunca corta e os marcadores ficam alinhados à arte). Missões/eventos
// surgem nos pontos do grafo; os Pokémon despachados caminham ponto a ponto (ida e
// volta) e suas fotos aparecem se deslocando pelo mapa.

import type { MouseEvent, ReactNode } from 'react'
import type { MapPos, Pokemon } from '../../types/index.ts'
import { CATEGORY_SITE } from '../../types/index.ts'
import type { CityGraph } from '../../data/types.ts'
import type {
  CaptureReturn,
  CaptureSearch,
  DefenseEvent,
  GameState,
  MissionInstance,
} from '../../engine/state.ts'
import { getCity, markerPos } from '../../data/cities.ts'
import { getMissionTemplate, missionReward } from '../../data/missionTemplates.ts'
import { pokemonSpritePath } from '../../data/pokemon/index.ts'
import { graphWithTunnels } from '../../engine/pathfinding.ts'
import { shinyChance, spotHasShinyChance } from '../../engine/shiny.ts'
import { activePuddlesAt } from '../../engine/weather.ts'
import { activeStrikeCirclesAt } from '../../engine/storm.ts'
import { teamIsSpeedy } from '../../engine/secretEffects.ts'
import { clamp } from '../../engine/math.ts'
import { missionTravelerPos, searchTravelerPos, returnTravelerPos } from '../../engine/travelerPositions.ts'
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

function ringStyle(fraction: number, color = 'var(--c-hud-accent)'): { background: string } {
  return {
    background: `conic-gradient(${color} ${fraction * 360}deg, rgba(10,12,40,0.45) 0)`,
  }
}

/** Fração [0,1] do tempo RESTANTE entre dois instantes (esvazia até 0 no fim). */
function remainingFraction(now: number, start: number, end: number): number {
  return end > start ? clamp((end - now) / (end - start), 0, 1) : 0
}

export function CityMap({ state, onMission, onDefense, onSpot }: Props) {
  const city = getCity(state.run.cityIndex)
  const graph = graphWithTunnels(city.graph, state.today.digTunnels)
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

        {state.today.digTunnels.map((tunnel, i) => (
          <DigTunnel key={`dig-${i}`} graph={graph} tunnel={tunnel} />
        ))}

        <PuddleOverlay graph={graph} puddles={activePuddlesAt(state.weather, now)} />

        <StormOverlay strikes={activeStrikeCirclesAt(state.weather.storms, now)} />

        {activeDefense && (
          <div className={styles.anchor} style={posStyle(markerPos(graph, city.siteNodes.gym, 'gym'))}>
            <DefenseMarker defense={activeDefense} now={now} onClick={() => onDefense(activeDefense.id)} />
          </div>
        )}

        {state.captureSpots.map((node, i) => {
          if (now < (state.captureSpotSpawnsAtMs[i] ?? 0)) return null // ainda não surgiu (#7)
          const ret = state.captureReturns.find((r) => r.spotIndex === i)
          // Área explorada some — mas se há um procurador VOLTANDO dela, mantém o ✓/✗ (#6).
          if (state.today.exploredSpots.includes(i) && !ret) return null
          return (
            <div key={`spot-${i}`} className={styles.anchor} style={posStyle(markerPos(graph, node, 'green'))}>
              <ExplorationMarker
                spotIndex={i}
                search={state.captureSearches.find((c) => c.spotIndex === i)}
                ret={ret}
                ready={state.encounters.some((e) => e.spotIndex === i)}
                shinyHere={spotHasShinyChance(shinyChance(state.runItems), state.run.seed, state.run.day, i)}
                now={now}
                onClick={() => onSpot(i)}
              />
            </div>
          )
        })}

        {missions.map((mission) => (
          <div
            key={mission.id}
            className={styles.anchor}
            style={posStyle(
              markerPos(graph, mission.node, mission.category ? CATEGORY_SITE[mission.category] : undefined),
            )}
          >
            <MissionMarker mission={mission} now={now} onClick={() => onMission(mission.id)} />
          </div>
        ))}

        <MapTravelers state={state} graph={graph} now={now} />
      </div>
    </div>
  )
}

/** Túnel do Dig: um buraco em cada ponto ligado (2; a ligação fica subentendida). */
function DigTunnel({ graph, tunnel }: { graph: CityGraph; tunnel: readonly string[] }) {
  return (
    <>
      {tunnel.map((id) => {
        const pos = graph.nodes[id]
        if (!pos) return null
        return (
          <div
            key={id}
            className={styles.tunnelHole}
            style={posStyle(pos)}
            title="Túnel (Dig)"
            aria-hidden="true"
          >
            🕳️
          </div>
        )
      })}
    </>
  )
}

/** Poças de chuva no mapa (espelha DigTunnel): 💧 dimensionado pelo nível (pequeno/médio/grande). */
function PuddleOverlay({
  graph,
  puddles,
}: {
  graph: CityGraph
  puddles: { node: string; level: number }[]
}) {
  return (
    <>
      {puddles.map(({ node, level }) => {
        const pos = graph.nodes[node]
        if (!pos) return null
        return (
          <div
            key={`puddle-${node}`}
            className={`${styles.puddle} ${styles[`puddleLvl${level}`] ?? ''}`}
            style={posStyle(pos)}
            title={`Poça d'água (nível ${level})`}
            aria-hidden="true"
          >
            💧
          </div>
        )
      })}
    </>
  )
}

/** Círculos dos raios: vermelho pulsante no aviso (5s), amarelo no impacto. Diâmetro = 2·raio. */
function StormOverlay({
  strikes,
}: {
  strikes: { phase: 'warning' | 'striking'; circles: { cx: number; cy: number; radius: number }[] }[]
}) {
  return (
    <>
      {strikes.flatMap((s, i) =>
        s.circles.map((c, j) => {
          // raio é fração da largura; em % da largura o diâmetro é 2·raio·100. A altura usa o
          // mesmo valor em px (círculo real), então convertemos via aspect-ratio no width/height.
          const widthPct = c.radius * 2 * 100
          return (
            <div
              key={`strike-${i}-${j}`}
              className={`${styles.strike} ${s.phase === 'warning' ? styles.strikeWarn : styles.strikeHit}`}
              style={{
                left: `${c.cx * 100}%`,
                top: `${c.cy * 100}%`,
                width: `${widthPct}%`,
                aspectRatio: '1 / 1',
              }}
              aria-hidden="true"
            />
          )
        }),
      )}
    </>
  )
}

/** Sprites do time/procurador se movendo pelo mapa (ponto a ponto), ida e volta. */
function MapTravelers({ state, graph, now }: { state: GameState; graph: CityGraph; now: number }) {
  return (
    <>
      {state.missions.map((m) => {
        const pos = missionTravelerPos(graph, m, now)
        if (!pos) return null
        // Buff de velocidade do time (Weak Armor/Fly) → aura piscando ao redor.
        const team = m.teamIds
          .map((id) => state.roster.find((p) => p.id === id))
          .filter((p): p is Pokemon => p !== undefined)
        const speedy = teamIsSpeedy(team, state.runItems, state.weather, now)
        // Paralisia por raio: sprite congelado com tremor elétrico enquanto não expirou.
        const paralyzed = !!m.paralyzeHold && now < m.paralyzeHold.untilMs
        return (
          <TravelerGroup
            key={`m-${m.id}`}
            pos={pos}
            ids={m.teamIds}
            roster={state.roster}
            speedy={speedy}
            flying={m.flying}
            surfing={m.surfing}
            paralyzed={paralyzed}
          />
        )
      })}
      {state.captureSearches.map((c) => {
        const pos = searchTravelerPos(graph, c, now)
        if (!pos) return null
        const paralyzed = !!c.paralyzeHold && now < c.paralyzeHold.untilMs
        return (
          <TravelerGroup key={`s-${c.searcherId}`} pos={pos} ids={[c.searcherId]} roster={state.roster} flying={c.flying} surfing={c.surfing} paralyzed={paralyzed} />
        )
      })}
      {state.captureReturns.map((r) => {
        const pos = returnTravelerPos(graph, r, now)
        const paralyzed = !!r.paralyzeHold && now < r.paralyzeHold.untilMs
        return (
          <TravelerGroup key={`r-${r.searcherId}`} pos={pos} ids={[r.searcherId]} roster={state.roster} flying={r.flying} surfing={r.surfing} paralyzed={paralyzed} />
        )
      })}
    </>
  )
}

/** Grupo de até 3 sprites agrupados numa posição do mapa (aura de velocidade/voo/paralisia opcional). */
function TravelerGroup({
  pos,
  ids,
  roster,
  speedy = false,
  flying = false,
  surfing = false,
  paralyzed = false,
}: {
  pos: MapPos
  ids: string[]
  roster: Pokemon[]
  speedy?: boolean
  flying?: boolean
  surfing?: boolean
  paralyzed?: boolean
}) {
  const mons = ids
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
    .slice(0, 3)
  if (mons.length === 0) return null
  return (
    <div
      className={`${styles.travelers} ${speedy ? styles.speedy : ''} ${flying ? styles.flying : ''} ${surfing ? styles.surfing : ''} ${paralyzed ? styles.paralyzed : ''}`}
      style={posStyle(pos)}
    >
      {speedy && <span className={styles.speedAura} aria-hidden="true" />}
      {flying && (
        <span className={styles.flyBadge} title="Voando (Fly)" aria-hidden="true">
          🪽
        </span>
      )}
      {surfing && (
        <span className={styles.surfBadge} title="Surfando (Surf)" aria-hidden="true">
          🌊
        </span>
      )}
      {mons.map((mon) => (
        <img
          key={mon.id}
          className={styles.traveler}
          src={pokemonSpritePath(mon)}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  )
}

interface MissionVisual {
  /** Classe de tema do ícone (cor/estilo por estado). */
  iconClass: string | undefined
  /** Cor do anel de progresso (conic-gradient). */
  ringColor: string
  /** Conteúdo do ícone (texto, emoji ou animação de "..."). */
  content: ReactNode
  /** Fração [0,1] do anel: tempo restante daquela etapa. */
  fraction: number
  /** O anel pulsa (chama atenção) só quando há ação do jogador pendente. */
  pulse: boolean
  ariaLabel: string
}

/** Define ícone, cor e timer do marcador conforme o estado da missão (#1). */
function missionVisual(mission: MissionInstance, now: number): MissionVisual {
  switch (mission.status) {
    case 'traveling':
      // A caminho: passos + anel do tempo de chegada (ida).
      return {
        iconClass: styles.travelIcon,
        ringColor: '#4f86d6',
        content: '👣',
        fraction: remainingFraction(now, mission.acceptedAtMs ?? now, mission.arriveAtMs ?? now),
        pulse: false,
        ariaLabel: 'Time a caminho da missão',
      }
    case 'inProgress':
      // No local: "..." animado + anel do tempo de execução.
      return {
        iconClass: styles.workIcon,
        ringColor: '#e0a93c',
        content: <Dots />,
        fraction: remainingFraction(now, mission.arriveAtMs ?? now, mission.resolveAtMs ?? now),
        pulse: false,
        ariaLabel: 'Missão em execução',
      }
    case 'returning': {
      // Terminou: ✓ verde (sucesso) ou ✗ vermelho (falha) + anel da volta.
      const won = mission.result === 'success'
      return {
        iconClass: won ? styles.winIcon : styles.failIcon,
        ringColor: won ? '#4f9e3f' : '#e0683c',
        content: won ? '✓' : '✗',
        fraction: remainingFraction(now, mission.resolveAtMs ?? now, mission.returnEndsAtMs ?? now),
        pulse: false,
        ariaLabel: won ? 'Missão cumprida, time voltando' : 'Missão falhou, time voltando',
      }
    }
    default: {
      // Disponível: "!" (ou "⭐" da Missão Especial) com o anel esvaziando até expirar.
      const isSpecial = mission.templateId === 'special'
      return {
        iconClass: styles.bang,
        ringColor: 'var(--c-hud-accent)',
        content: isSpecial ? '⭐' : '!',
        fraction: timerFraction(mission, now),
        pulse: true,
        ariaLabel: isSpecial ? 'Missão Especial disponível' : 'Missão disponível',
      }
    }
  }
}

/** Três pontos surgindo em sequência (missão acontecendo no local). */
function Dots() {
  return (
    <span className={styles.dots} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
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
  const v = missionVisual(mission, now)
  // Selo de recompensa (missões especiais) — só enquanto a missão está disponível.
  const reward = mission.status === 'available' ? missionReward(getMissionTemplate(mission.templateId)) : null
  return (
    <button
      type="button"
      className={`${styles.ring} ${v.pulse ? '' : styles.ringBusy}`}
      style={ringStyle(v.fraction, v.ringColor)}
      onClick={onClick}
      aria-label={reward ? `${v.ariaLabel} — ${reward.label}` : v.ariaLabel}
    >
      <span className={`${styles.icon} ${v.iconClass}`}>{v.content}</span>
      {reward && (
        <span className={styles.rewardBadge} title={reward.label} aria-hidden="true">
          {reward.icon}
        </span>
      )}
    </button>
  )
}

interface ExplorationVisual {
  iconClass: string | undefined
  ringColor: string
  content: ReactNode
  fraction: number
  pulse: boolean
  ariaLabel: string
  /** Estados em ação (clicáveis); a volta é só informativa. */
  interactive: boolean
}

/**
 * Marcador da área de exploração espelhando o das missões (#6): 👣 + anel ao IR, "…" ao
 * procurar, "!" no encontro e ✓/✗ + anel ao VOLTAR (capturou = ✓). Sem nada em ação,
 * mostra a grama clicável (mandar um Pokémon procurar).
 */
function explorationVisual(
  search: CaptureSearch | undefined,
  ret: CaptureReturn | undefined,
  ready: boolean,
  now: number,
  shinyHere = false,
): ExplorationVisual {
  if (ret) {
    const ok = ret.captured
    return {
      iconClass: ok ? styles.winIcon : styles.failIcon,
      ringColor: ok ? '#4f9e3f' : '#e0683c',
      content: ok ? '✓' : '✗',
      fraction: remainingFraction(now, ret.departAtMs, ret.arriveAtMs),
      pulse: false,
      ariaLabel: ok ? 'Pokémon capturado, voltando' : 'Sem captura, voltando',
      interactive: false,
    }
  }
  if (ready) {
    return {
      iconClass: styles.bang,
      ringColor: 'var(--c-hud-accent)',
      content: '!',
      fraction: 1,
      pulse: true,
      ariaLabel: 'Encontro pronto na área',
      interactive: true,
    }
  }
  if (search?.phase === 'searching') {
    return {
      iconClass: styles.workIcon,
      ringColor: '#e0a93c',
      content: <Dots />,
      fraction: remainingFraction(now, search.arriveAtMs, search.readyAtMs),
      pulse: false,
      ariaLabel: 'Explorando a área',
      interactive: true,
    }
  }
  if (search?.phase === 'traveling') {
    return {
      iconClass: styles.travelIcon,
      ringColor: '#4f86d6',
      content: '👣',
      fraction: remainingFraction(now, search.departAtMs, search.arriveAtMs),
      pulse: false,
      ariaLabel: 'A caminho da área de exploração',
      interactive: true,
    }
  }
  return {
    iconClass: undefined,
    ringColor: shinyHere ? '#e0a020' : 'var(--c-grass-dark)',
    content: shinyHere ? '🍂' : '🌿',
    fraction: 1,
    pulse: true,
    ariaLabel: shinyHere ? 'Área de exploração (shiny!)' : 'Área de exploração',
    interactive: true,
  }
}

function ExplorationMarker({
  spotIndex,
  search,
  ret,
  ready,
  shinyHere,
  now,
  onClick,
}: {
  spotIndex: number
  search: CaptureSearch | undefined
  ret: CaptureReturn | undefined
  ready: boolean
  shinyHere?: boolean
  now: number
  onClick: () => void
}) {
  const v = explorationVisual(search, ret, ready, now, shinyHere)
  const className = `${styles.ring} ${v.pulse ? '' : styles.ringBusy}`
  const inner = <span className={`${styles.icon} ${v.iconClass ?? ''}`}>{v.content}</span>
  if (!v.interactive) {
    return (
      <span className={className} style={ringStyle(v.fraction, v.ringColor)} aria-label={v.ariaLabel}>
        {inner}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={className}
      style={ringStyle(v.fraction, v.ringColor)}
      onClick={onClick}
      aria-label={`${v.ariaLabel} ${spotIndex + 1}`}
    >
      {inner}
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
