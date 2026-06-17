// Núcleo PURO do desvio/espera por poças de chuva, compartilhado por QUEM viaja a pé sem surfar:
// missões (game/missionFlow.ts) e exploração/captura (game/captureFlow.ts). Dada uma perna de
// viagem (caminho + janela de tempo) e o instante atual, decide se o trajeto à frente cruza uma
// poça ATIVA e, em caso afirmativo, devolve um desvio seco (reroute) ou uma espera no ponto
// anterior até a poça secar (wait). Tudo determinístico (poça = função pura de `now`).

import type { Pokemon } from '../types/index.ts'
import type { CityGraph } from '../data/types.ts'
import { clamp } from './math.ts'
import { graphTravelMs } from './missions.ts'
import {
  graphWithoutNodes,
  graphWithoutSurf,
  pathDistance,
  shortestPath,
} from './pathfinding.ts'
import { blockedNodesAt, puddleLevelAt, type WeatherSchedule } from './weather.ts'

/** Índice do último ponto já alcançado numa perna, pela fração de tempo (espelha pointAlongPath). */
export function nodeIndexAtFraction(graph: CityGraph, leg: readonly string[], frac: number): number {
  if (leg.length <= 1 || frac <= 0) return 0
  if (frac >= 1) return leg.length - 1
  const total = pathDistance(graph, leg)
  if (total <= 0) return 0
  const target = frac * total
  let traveled = 0
  for (let i = 0; i < leg.length - 1; i++) {
    traveled += pathDistance(graph, [leg[i] as string, leg[i + 1] as string])
    if (traveled >= target) return i // entre o ponto i e o i+1 → "está em" i
  }
  return leg.length - 1
}

/**
 * Decisão de clima para uma perna em trânsito:
 * - `clear`: a rota à frente está limpa (segue como está).
 * - `reroute`: há rota seca contornando as poças → novo caminho da perna + atraso embutido.
 * - `wait`: sem rota seca e a poça está no PRÓXIMO ponto → espera no ponto anterior até ela secar.
 */
export type WeatherLegPlan =
  | { kind: 'clear' }
  | { kind: 'reroute'; reroutePath: string[]; extraMs: number }
  | { kind: 'wait'; node: string; untilMs: number; extraMs: number }

export interface WeatherLegParams {
  graph: CityGraph
  weather: WeatherSchedule
  /** Caminho REAL da perna atual (já considerando um eventual desvio anterior). */
  baseLeg: readonly string[]
  /** Início e fim (ms de jogo) da perna — definem a fração percorrida em `nowMs`. */
  legStart: number
  legEnd: number
  nowMs: number
  /** Time/explorador em trânsito — base da velocidade ao estimar o atraso do desvio. */
  team: readonly Pokemon[]
  speedMult: number
}

/**
 * Planeja o clima da perna SEM mutar nada: o chamador aplica o resultado nos seus marcos
 * (missão ou exploração). Pressupõe que quem chama já filtrou voo/surf (esses ignoram poças).
 */
export function planWeatherLeg(params: WeatherLegParams): WeatherLegPlan {
  const { graph, weather, baseLeg, legStart, legEnd, nowMs, team, speedMult } = params
  if (baseLeg.length < 2 || legEnd <= legStart) return { kind: 'clear' }

  const frac = clamp((nowMs - legStart) / (legEnd - legStart), 0, 1)
  const here = nodeIndexAtFraction(graph, baseLeg, frac)
  const dest = baseLeg[baseLeg.length - 1] as string
  const remaining = baseLeg.slice(here + 1)
  if (remaining.length === 0) return { kind: 'clear' }

  const blocked = blockedNodesAt(weather, nowMs)
  if (!remaining.some((n) => blocked.has(n))) return { kind: 'clear' } // rota à frente limpa

  // 1) Tenta replanejar: menor caminho daqui ao destino contornando as poças (e a água).
  const dry = graphWithoutNodes(graphWithoutSurf(graph), blocked)
  const fromNode = baseLeg[here] as string
  const alt = shortestPath(dry, fromNode, dest)
  if (alt.length > 0) {
    const oldRemaining = baseLeg.slice(here) // daqui até o destino (rota antiga)
    const extraDist = Math.max(0, pathDistance(graph, alt) - pathDistance(graph, oldRemaining))
    const extraMs = graphTravelMs(extraDist, team, speedMult)
    return { kind: 'reroute', reroutePath: [...baseLeg.slice(0, here + 1), ...alt.slice(1)], extraMs }
  }

  // 2) Sem rota seca: só espera quando o PRÓXIMO ponto é a poça (espera um ponto antes).
  const nextNode = baseLeg[here + 1] as string
  if (!blocked.has(nextNode)) return { kind: 'clear' } // a poça está adiante; segue e reavalia ao chegar
  let untilMs = nowMs
  for (const ev of weather.rain) {
    for (const p of ev.puddles) {
      if (p.node === nextNode && puddleLevelAt(p, nowMs) > 0) untilMs = Math.max(untilMs, p.endMs)
    }
  }
  if (untilMs <= nowMs) return { kind: 'clear' }
  return { kind: 'wait', node: fromNode, untilMs, extraMs: untilMs - nowMs }
}
