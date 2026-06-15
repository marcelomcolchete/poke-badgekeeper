// Preparação do dia e bootstrap da run (PLAN §3/§4.8).
// setupDay instancia a agenda (timeline) em eventos 'scheduled' no mapa.
// autoSeedRun é um atalho PROVISÓRIO para rodar headless/testes — o fluxo
// interativo de novo jogo (sorteio de tipos + inicial, §3) chega na Fase 4.

import type { CityData } from '../data/types.ts'
import type { DefenseEvent, GameState } from '../engine/state.ts'
import { createInitialState } from '../engine/state.ts'
import type { TrainerId } from '../types/index.ts'
import { getCity, nodePos, nodesForCategory } from '../data/cities.ts'
import { getTrainer } from '../data/trainers.ts'
import { buildDaySchedule, type DefenseSlot } from '../engine/timeline.ts'
import { createMissionInstance } from '../engine/missions.ts'
import { enemySquadSizeForDay, generateDefenseEnemies } from '../engine/gymDefense.ts'
import { createPokemon } from '../engine/leveling.ts'
import { hasDig } from '../engine/secretEffects.ts'
import { createRng, deriveSeed } from '../engine/rng.ts'
import { DEFENSE_LIFETIME_MS, MISSION_LIFETIME_MS } from '../engine/balance.ts'
import { DIG_SEED_SALT, TRAINER_SEED_SALT } from '../engine/constants.ts'
import { takeId } from './runtime.ts'

/** Instancia a agenda do dia (missões/defesas 'scheduled') e arma o relógio (PLAN §4.8). */
export function setupDay(s: GameState): void {
  const city = getCity(s.run.cityIndex)
  const schedule = buildDaySchedule(s.run.seed, s.run.day, city)
  s.missions = schedule.missions.map((slot) => {
    const nodes = nodesForCategory(city.siteNodes, slot.category)
    const node = nodes[slot.siteIndex % nodes.length] ?? city.siteNodes.gym
    // A missão Rocket dura igual a uma defesa de ginásio (timer mais longo); demais, o normal.
    const lifetimeMs = slot.templateId === 'rocket' ? DEFENSE_LIFETIME_MS : MISSION_LIFETIME_MS
    return createMissionInstance({
      id: takeId(s, 'm'),
      rng: createRng(slot.seed),
      day: s.run.day,
      category: slot.category,
      node,
      spawnAtMs: slot.atMs,
      lifetimeMs,
      templateId: slot.templateId,
    })
  })
  // Treinadores do dia: sorteados SEM repetição (um treinador não invade duas vezes no
  // mesmo dia — se já veio hoje, só pode voltar amanhã). PLAN §4.4.
  const trainerRng = createRng(deriveSeed(s.run.seed, TRAINER_SEED_SALT, s.run.day))
  const dayTrainers = trainerRng.shuffle(city.trainers)
  s.defenses = schedule.defenses.map((slot, i) =>
    buildDefense(s, slot, city, dayTrainers[i % dayTrainers.length] ?? city.trainers[0] ?? 'YOUNGSTER'),
  )
  // Captura só nas áreas verdes (pontos) sorteadas para hoje (#3), com horário de surgimento.
  const spots = schedule.captureSiteIndices
    .map((i, k) => ({ node: city.siteNodes.green[i], at: schedule.captureSpawnsAtMs[k] ?? 0 }))
    .filter((p): p is { node: string; at: number } => p.node !== undefined)
  s.captureSpots = spots.map((p) => p.node)
  s.captureSpotSpawnsAtMs = spots.map((p) => p.at)
  s.today.digTunnel = computeDigTunnel(s, city)
  s.clock.dayElapsedMs = 0
  s.clock.speed = 1
}

/**
 * Túnel do Dig (Habilidade Secreta do Diglett): se algum Pokémon do roster tem a habilidade
 * desbloqueada, sorteia dois pontos distintos do grafo ligados por baixo da terra hoje.
 */
function computeDigTunnel(s: GameState, city: CityData): [string, string] | null {
  if (!s.roster.some(hasDig)) return null
  const ids = Object.keys(city.graph.nodes)
  if (ids.length < 2) return null
  const rng = createRng(deriveSeed(s.run.seed, DIG_SEED_SALT, s.run.day))
  const [a, b] = rng.shuffle(ids)
  return a && b ? [a, b] : null
}

function buildDefense(
  s: GameState,
  slot: DefenseSlot,
  city: CityData,
  trainerId: TrainerId,
): DefenseEvent {
  const rng = createRng(slot.seed)
  const size = enemySquadSizeForDay(s.run.day)
  return {
    id: takeId(s, 'd'),
    pos: nodePos(city.graph, city.siteNodes.gym),
    spawnAtMs: slot.atMs,
    expiresAtMs: slot.atMs + DEFENSE_LIFETIME_MS,
    status: 'scheduled',
    trainerId,
    squadIds: [],
    enemies: generateDefenseEnemies(rng, getTrainer(trainerId), size),
    duels: [],
  }
}

/**
 * Bootstrap PROVISÓRIO de uma run na cidade 0: tipos do ginásio fixos da cidade e o
 * primeiro inicial (nível fixo). Usado headless/testes — o fluxo interativo de novo
 * jogo (escolha de versões) vive na UI (PLAN §3).
 */
export function autoSeedRun(seed: number): GameState {
  const s = createInitialState(seed)
  const city = getCity(0)
  const rng = createRng(deriveSeed(seed, 0))
  s.gym.types = [city.primaryType, city.secondaryType]
  const starter = city.starters[0]
  if (starter) {
    s.roster = [
      createPokemon({ id: takeId(s, 'p'), speciesId: starter.speciesId, level: starter.level, rng }),
    ]
  }
  return s
}

/** Versão escolhida de um inicial: espécie + nível fixos + seed do roll selecionado. */
export interface StarterPick {
  speciesId: number
  level: number
  /** Seed do roll escolhido — recria EXATAMENTE o Pokémon mostrado no preview. */
  seed: number
  /** Apelido opcional dado na tela de novo jogo. */
  nickname?: string
}

/**
 * Conclui o fluxo interativo de novo jogo (PLAN §3): grava os tipos fixos do ginásio
 * e monta o roster com as versões escolhidas dos iniciais fixos da cidade.
 */
export function startRun(s: GameState, picks: StarterPick[]): void {
  const city = getCity(s.run.cityIndex)
  s.gym.types = [city.primaryType, city.secondaryType]
  // O seed do roll é estável (vem da UI): o card do preview = Pokémon obtido (natureza, IVs/rank).
  s.roster = picks.map((pick) =>
    createPokemon({
      id: takeId(s, 'p'),
      speciesId: pick.speciesId,
      level: pick.level,
      rng: createRng(pick.seed),
      nickname: cleanNickname(pick.nickname),
    }),
  )
  s.run.phase = 'MORNING'
}

/** Apelido inicial: aparado; null quando vazio (cai no nome da espécie). */
function cleanNickname(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
