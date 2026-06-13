// Preparação do dia e bootstrap da run (PLAN §3/§4.8).
// setupDay instancia a agenda (timeline) em eventos 'scheduled' no mapa.
// autoSeedRun é um atalho PROVISÓRIO para rodar headless/testes — o fluxo
// interativo de novo jogo (sorteio de tipos + inicial, §3) chega na Fase 4.

import type { PokemonType } from '../types/index.ts'
import type { CityData } from '../data/types.ts'
import { LEVEL_MIN } from '../engine/constants.ts'
import type { DefenseEvent, GameState } from '../engine/state.ts'
import { POKEMON_TYPES } from '../types/index.ts'
import { createInitialState } from '../engine/state.ts'
import { getCity, nodePos, nodesForCategory } from '../data/cities.ts'
import { buildDaySchedule, type DefenseSlot } from '../engine/timeline.ts'
import { createMissionInstance } from '../engine/missions.ts'
import { generateDefenseEnemies } from '../engine/gymDefense.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng, deriveSeed, type Rng } from '../engine/rng.ts'
import {
  DEFENSE_LIFETIME_MS,
  ENEMY_SQUAD_MAX,
  ENEMY_SQUAD_MIN,
  MISSION_LIFETIME_MS,
} from '../engine/balance.ts'
import { STARTER_LEVEL } from '../engine/constants.ts'
import { takeId, takeRng } from './runtime.ts'

/** Instancia a agenda do dia (missões/defesas 'scheduled') e arma o relógio (PLAN §4.8). */
export function setupDay(s: GameState): void {
  const city = getCity(s.run.cityIndex)
  const schedule = buildDaySchedule(s.run.seed, s.run.day, city)
  s.missions = schedule.missions.map((slot) => {
    const nodes = nodesForCategory(city.siteNodes, slot.category)
    const node = nodes[slot.siteIndex % nodes.length] ?? city.siteNodes.gym
    return createMissionInstance({
      id: takeId(s, 'm'),
      rng: createRng(slot.seed),
      category: slot.category,
      node,
      spawnAtMs: slot.atMs,
      lifetimeMs: MISSION_LIFETIME_MS,
      templateId: slot.templateId,
    })
  })
  s.defenses = schedule.defenses.map((slot) => buildDefense(s, slot, city))
  // Captura só nas áreas verdes (pontos) sorteadas para hoje (#3), com horário de surgimento.
  const spots = schedule.captureSiteIndices
    .map((i, k) => ({ node: city.siteNodes.green[i], at: schedule.captureSpawnsAtMs[k] ?? 0 }))
    .filter((p): p is { node: string; at: number } => p.node !== undefined)
  s.captureSpots = spots.map((p) => p.node)
  s.captureSpotSpawnsAtMs = spots.map((p) => p.at)
  s.clock.dayElapsedMs = 0
  s.clock.speed = 1
}

function buildDefense(s: GameState, slot: DefenseSlot, city: CityData): DefenseEvent {
  const rng = createRng(slot.seed)
  const size = rng.int(ENEMY_SQUAD_MIN, ENEMY_SQUAD_MAX)
  return {
    id: takeId(s, 'd'),
    pos: nodePos(city.graph, city.siteNodes.gym),
    spawnAtMs: slot.atMs,
    expiresAtMs: slot.atMs + DEFENSE_LIFETIME_MS,
    status: 'scheduled',
    squadIds: [],
    enemies: generateDefenseEnemies(rng, s.run.day, size),
  }
}

function pickExtraTypes(rng: Rng, primary: PokemonType): PokemonType[] {
  return rng.shuffle(POKEMON_TYPES.filter((t) => t !== primary)).slice(0, 1)
}

/**
 * Bootstrap PROVISÓRIO de uma run na cidade 0: define os 2 tipos do ginásio
 * (primário + 1 sorteado) e o inicial nível 3. Substituído pelo fluxo
 * interativo de novo jogo na Fase 4 (PLAN §3).
 */
export function autoSeedRun(seed: number): GameState {
  const s = createInitialState(seed)
  const city = getCity(0)
  const rng = createRng(deriveSeed(seed, 0))
  s.gym.types = [city.primaryType, ...pickExtraTypes(rng, city.primaryType)]
  s.roster = [
    createPokemon({ id: takeId(s, 'p'), speciesId: city.starterSpeciesId, level: STARTER_LEVEL, rng }),
  ]
  return s
}

/**
 * Conclui o fluxo interativo de novo jogo (PLAN §3): grava os 2 tipos do ginásio
 * e monta o roster inicial — inicial nível 3 + 1 recruta nível 1.
 */
export function startRun(
  s: GameState,
  gymTypes: PokemonType[],
  starterSpeciesId: number,
  extraSpeciesIds: number[],
): void {
  s.gym.types = [...gymTypes]
  const starter = createPokemon({
    id: takeId(s, 'p'),
    speciesId: starterSpeciesId,
    level: STARTER_LEVEL,
    rng: takeRng(s),
  })
  const extras = extraSpeciesIds.map((speciesId) =>
    createPokemon({ id: takeId(s, 'p'), speciesId, level: LEVEL_MIN, rng: takeRng(s) }),
  )
  s.roster = [starter, ...extras]
  s.run.phase = 'MORNING'
}
