// Núcleo PURO do efeito climático Tempestade (2º efeito, após a Chuva). O schedule é semeado
// (STORM_SEED_SALT) e pré-computado em setupDay, então a presença/área de qualquer raio em
// qualquer instante é FUNÇÃO PURA de `now` (como as poças). A detecção de acerto e a aplicação
// de dano/Paralyze ficam no runtime (game/stormFlow.ts), pois dependem da posição dos Pokémon.
//
// Geometria do raio (ver docs/superpowers/specs/2026-06-19-efeito-tempestade-design.md):
// - raio padrão STRIKE_RADIUS (fração da largura); se o CENTRO já é água, vira único
//   STRIKE_RADIUS_ON_WATER; senão, cada ponto de água DENTRO do primário gera um secundário
//   STRIKE_SECONDARY_RADIUS (sem encadear adiante).

import type { MapPos } from '../types/index.ts'
import type { CityData } from '../data/types.ts'
import { MAP_ASPECT_W } from './constants.ts'
import { segmentLength } from './pathfinding.ts'
import { puddleLevelAt, type RainEvent } from './weather.ts'
import {
  STRIKE_RADIUS,
  STRIKE_RADIUS_ON_WATER,
  STRIKE_SECONDARY_RADIUS,
} from './balance.ts'

/** Um círculo do efeito do raio: centro (coords normalizadas) + raio (fração da largura). */
export interface StrikeCircle {
  cx: number
  cy: number
  radius: number
}

/** Um raio: aviso (vermelho), impacto (amarelo) e os círculos atingidos no impacto. */
export interface Strike {
  warnAtMs: number
  strikeAtMs: number
  circles: StrikeCircle[]
}

/** Um evento de tempestade: janela [start, end] e os raios que caem nela. */
export interface StormEvent {
  startMs: number
  endMs: number
  strikes: Strike[]
}

/** Um ponto está dentro do círculo? Usa a distância 16:9-corrigida (raio = fração da largura). */
export function pointInCircle(circle: StrikeCircle, p: MapPos): boolean {
  return segmentLength({ x: circle.cx, y: circle.cy }, p) <= circle.radius * MAP_ASPECT_W
}

/** Pontos de água em `nowMs`: surfNodes (fixos) + poças ativas da chuva nesse instante. */
export function waterNodesAt(
  city: CityData,
  rainEvents: readonly RainEvent[],
  nowMs: number,
): Set<string> {
  const water = new Set<string>(city.graph.surfNodes ?? [])
  for (const ev of rainEvents) {
    for (const p of ev.puddles) {
      if (puddleLevelAt(p, nowMs) > 0) water.add(p.node)
    }
  }
  return water
}

/**
 * Círculos de UM raio centrado em `center`, no instante `strikeAtMs`:
 * - centro é água → único STRIKE_RADIUS_ON_WATER;
 * - senão → primário STRIKE_RADIUS + um secundário STRIKE_SECONDARY_RADIUS por ponto de água
 *   dentro do primário (sem encadear adiante).
 */
export function resolveStrikeCircles(
  center: string,
  strikeAtMs: number,
  city: CityData,
  rainEvents: readonly RainEvent[],
): StrikeCircle[] {
  const pos = city.graph.nodes[center]
  if (!pos) return []
  const water = waterNodesAt(city, rainEvents, strikeAtMs)
  if (water.has(center)) {
    return [{ cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS_ON_WATER }]
  }
  const circles: StrikeCircle[] = [{ cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS }]
  const primary: StrikeCircle = { cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS }
  for (const node of water) {
    const wp = city.graph.nodes[node]
    if (wp && pointInCircle(primary, wp)) {
      circles.push({ cx: wp.x, cy: wp.y, radius: STRIKE_SECONDARY_RADIUS })
    }
  }
  return circles
}
