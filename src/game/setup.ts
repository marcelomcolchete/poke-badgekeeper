// Preparação do dia e bootstrap da run (PLAN §3/§4.8).
// setupDay instancia a agenda (timeline) em eventos 'scheduled' no mapa.
// autoSeedRun é um atalho PROVISÓRIO para rodar headless/testes — o fluxo
// interativo de novo jogo (sorteio de tipos + inicial, §3) chega na Fase 4.

import type { CityData } from '../data/types.ts'
import type { DefenseEvent, GameState } from '../engine/state.ts'
import { createInitialState } from '../engine/state.ts'
import type { TrainerId } from '../types/index.ts'
import { RIVAL_TRAINER_IDS } from '../types/index.ts'
import { getCity, nodePos, nodesForCategory } from '../data/cities.ts'
import { getDailyShop } from '../data/items.ts'
import { getTrainer, trainerSprites } from '../data/trainers.ts'
import { buildDaySchedule, type DefenseSlot } from '../engine/timeline.ts'
import { createMissionInstance } from '../engine/missions.ts'
import { buildWeatherSchedule } from '../engine/weather.ts'
import { enemySquadSizeForDay, generateDefenseEnemies } from '../engine/gymDefense.ts'
import { createPokemon } from '../engine/leveling.ts'
import { hasDig, hasDigPlus, hasForewarn } from '../engine/secretEffects.ts'
import { createRng, deriveSeed } from '../engine/rng.ts'
import {
  DEFENSE_LIFETIME_MS,
  DIG_HOLES_PER_TUNNEL,
  MISSION_LIFETIME_MS,
} from '../engine/balance.ts'
import { DIG_SEED_SALT, TRAINER_SEED_SALT } from '../engine/constants.ts'
import { takeId } from './runtime.ts'

/**
 * Define a oferta do mercado da manhã (3 itens) — fixada ao entrar na manhã para não
 * re-sortear quando o jogador compra. Exclui os passivos já possuídos (1×/run).
 */
export function setupMorningShop(s: GameState): void {
  s.today.shopOffer = getDailyShop(s.run.seed, s.run.day, s.run.cityIndex, s.runItems)
  s.today.purchasedItems = []
}

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
  // mesmo dia — se já veio hoje, só pode voltar amanhã). PLAN §4.4. Os rivais entram no
  // pool de TODA cidade, além da lista local (dedup caso a cidade já os liste).
  const trainerRng = createRng(deriveSeed(s.run.seed, TRAINER_SEED_SALT, s.run.day))
  const trainerPool = [...new Set<TrainerId>([...city.trainers, ...RIVAL_TRAINER_IDS])]
  const dayTrainers = trainerRng.shuffle(trainerPool)
  s.defenses = schedule.defenses.map((slot, i) =>
    buildDefense(s, slot, city, dayTrainers[i % dayTrainers.length] ?? city.trainers[0] ?? 'YOUNGSTER'),
  )
  // Captura só nas áreas verdes (pontos) sorteadas para hoje (#3), com horário de surgimento.
  const spots = schedule.captureSiteIndices
    .map((i, k) => ({ node: city.siteNodes.green[i], at: schedule.captureSpawnsAtMs[k] ?? 0 }))
    .filter((p): p is { node: string; at: number } => p.node !== undefined)
  s.captureSpots = spots.map((p) => p.node)
  s.captureSpotSpawnsAtMs = spots.map((p) => p.at)
  s.today.digTunnels = computeDigTunnels(s, city)
  // Clima do dia (chuva/poças em Cerulean): pré-computado e reprodutível por (seed, dia, cidade).
  s.weather = buildWeatherSchedule(s.run.seed, s.run.day, city)
  applyForewarn(s)
  s.clock.dayElapsedMs = 0
  s.clock.speed = 1
}

/**
 * Forewarn: cada Pokémon do roster com a habilidade antecipa UMA missão não-Rocket do dia para o
 * início do dia (spawnAtMs = 0, preservando a duração). N portadores antecipam N missões.
 */
function applyForewarn(s: GameState): void {
  const count = s.roster.filter(hasForewarn).length
  if (count === 0) return
  const movable = s.missions.filter((m) => m.templateId !== 'rocket' && m.spawnAtMs > 0)
  for (const mission of movable.slice(0, count)) {
    const lifetime = mission.expiresAtMs - mission.spawnAtMs
    mission.spawnAtMs = 0
    mission.expiresAtMs = lifetime
  }
}

/**
 * Túneis do Dig: cada Pokémon do roster com Dig (ou Dig+) abre UM túnel ligando dois pontos do
 * grafo por baixo da terra hoje. Vários portadores → vários túneis (podem se sobrepor, sem
 * problema). Dig+ ancora um dos buracos sempre no ginásio. Determinístico (seed do dia + índice).
 */
function computeDigTunnels(s: GameState, city: CityData): string[][] {
  const ids = Object.keys(city.graph.nodes)
  if (ids.length < DIG_HOLES_PER_TUNNEL) return []
  const gym = city.siteNodes.gym
  const tunnels: string[][] = []
  let diggerIndex = 0
  for (const p of s.roster) {
    const dig = hasDig(p)
    const digPlus = hasDigPlus(p)
    if (!dig && !digPlus) continue
    const rng = createRng(deriveSeed(s.run.seed, DIG_SEED_SALT, s.run.day * 100 + diggerIndex))
    diggerIndex += 1
    // Dig+ fixa o ginásio como uma das pontas; preenche o resto com pontos distintos sorteados.
    const picked: string[] = digPlus && ids.includes(gym) ? [gym] : []
    for (const id of rng.shuffle(ids)) {
      if (picked.length >= DIG_HOLES_PER_TUNNEL) break
      if (!picked.includes(id)) picked.push(id)
    }
    if (picked.length >= DIG_HOLES_PER_TUNNEL) tunnels.push(picked)
  }
  return tunnels
}

function buildDefense(
  s: GameState,
  slot: DefenseSlot,
  city: CityData,
  trainerId: TrainerId,
): DefenseEvent {
  const rng = createRng(slot.seed)
  const size = enemySquadSizeForDay(s.run.day)
  const trainer = getTrainer(trainerId)
  // Inimigos primeiro (mantém os rolls existentes), depois a arte — sorteada do mesmo rng
  // semeado, então é estável para este evento mas varia entre defesas/dias.
  const enemies = generateDefenseEnemies(rng, trainer, size, s.run.day)
  return {
    id: takeId(s, 'd'),
    pos: nodePos(city.graph, city.siteNodes.gym),
    spawnAtMs: slot.atMs,
    expiresAtMs: slot.atMs + DEFENSE_LIFETIME_MS,
    status: 'scheduled',
    trainerId,
    trainerSprite: rng.pick(trainerSprites(trainer)),
    squadIds: [],
    enemies,
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
    s.caughtSpecies = [starter.speciesId]
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
  s.caughtSpecies = [...new Set(picks.map((pick) => pick.speciesId))]
  s.run.phase = 'MORNING'
  setupMorningShop(s)
}

/** Apelido inicial: aparado; null quando vazio (cai no nome da espécie). */
function cleanNickname(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
