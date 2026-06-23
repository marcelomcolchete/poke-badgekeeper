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
import { buildDaySchedule, rollSpecialMissions, spawnTimesAcrossSegments, type DefenseSlot } from '../engine/timeline.ts'
import { createMissionInstance } from '../engine/missions.ts'
import { buildDayWeather } from '../engine/storm.ts'
import { generateDefenseEnemies, rollSquadSize } from '../engine/gymDefense.ts'
import { createPokemon } from '../engine/leveling.ts'
import { hasDig, hasDigPlus, hasOwnTempo, sporeDayBuffs } from '../engine/secretEffects.ts'
import { secretLevelOf } from '../data/secretAbilities.ts'
import { recomputeMaxHp } from '../engine/attributes.ts'
import { createRng, deriveSeed } from '../engine/rng.ts'
import { shinyFor } from '../engine/shiny.ts'
import {
  CLOUD_NINE_RAIN_PP_L1,
  CLOUD_NINE_RAIN_PP_L2,
  CLOUD_NINE_OTHER_PP_L1,
  CLOUD_NINE_OTHER_PP_L2,
  OVERCOAT_PP_L1,
  OVERCOAT_PP_L2,
  OWN_TEMPO_CAP_L1,
  OWN_TEMPO_CAP_L2,
  DEFENSE_LIFETIME_MS,
  DIG_HOLES_PER_TUNNEL,
  MISSION_LIFETIME_MS,
  SPECIAL_CHANCE_START,
} from '../engine/balance.ts'
import { DIG_SEED_SALT, SPORE_SEED_SALT, TRAINER_SEED_SALT } from '../engine/constants.ts'
import { takeId, takeRng } from './runtime.ts'

/**
 * Define a oferta do mercado da manhã (3 itens) — fixada ao entrar na manhã para não
 * re-sortear quando o jogador compra. Exclui os passivos já possuídos (1×/run).
 */
export function setupMorningShop(s: GameState): void {
  s.today.shopOffer = getDailyShop(s.run.seed, s.run.day, s.run.cityIndex, s.runItems, s.run.ballLevel)
  s.today.purchasedItems = []
}

/** Instancia a agenda do dia (missões/defesas 'scheduled') e arma o relógio (PLAN §4.8). */
export function setupDay(s: GameState): void {
  const city = getCity(s.run.cityIndex)

  // Garante uma chance corrente por local especial da cidade (inicia em START; preserva as
  // existentes ao trocar de dia, perde tamanho só se a cidade mudou o nº de locais).
  const specialCount = city.siteNodes.specialMission.length
  if (s.run.specialChances.length !== specialCount) {
    s.run.specialChances = Array.from(
      { length: specialCount },
      (_, i) => s.run.specialChances[i] ?? SPECIAL_CHANCE_START,
    )
  }

  const schedule = buildDaySchedule(s.run.seed, s.run.day, city)
  s.missions = schedule.missions.map((slot) => {
    const nodes = nodesForCategory(city.siteNodes, slot.category)
    const node = nodes[slot.siteIndex % nodes.length] ?? city.siteNodes.gym
    const lifetimeMs = MISSION_LIFETIME_MS
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

  // Missões Especiais (⭐): rolagem ESTOCÁSTICA por local no abrir do dia (muta a chance persistida).
  // Determinístico via takeRng (cursor da run). Hits viram instâncias 'special' com timer longo,
  // distribuídas nos 3 momentos como as demais (não aparecem na previsão — surpresa).
  const specialRng = takeRng(s)
  const roll = rollSpecialMissions(specialRng, s.run.specialChances)
  s.run.specialChances = roll.nextChances
  if (roll.hits.length > 0) {
    const times = spawnTimesAcrossSegments(specialRng, roll.hits.length, s.run.day)
    roll.hits.forEach((siteIndex, k) => {
      const nodes = city.siteNodes.specialMission
      const node = nodes[siteIndex] ?? city.siteNodes.gym
      s.missions.push(
        createMissionInstance({
          id: takeId(s, 'm'),
          rng: createRng(deriveSeed(s.run.seed, s.run.day * 1000 + siteIndex)),
          day: s.run.day,
          category: 'special',
          node,
          spawnAtMs: times[k] ?? 0,
          lifetimeMs: DEFENSE_LIFETIME_MS,
          templateId: 'special',
        }),
      )
    })
  }
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
  // Clima do dia (chuva + tempestade): pré-computado e reprodutível por (seed, dia, cidade).
  // rainDelta = Σ cloudNineRainPP(level) − Σ overcoatPP(level)
  // stormDelta = −Σ cloudNineOtherPP(level) − Σ overcoatPP(level)
  // ownTempoCap: strictest (lowest) cap among Own Tempo holders; 0 = no cap
  let rainDelta = 0
  let stormDelta = 0
  for (const p of s.roster) {
    const cnLevel = secretLevelOf(p, 'sa-cloud-nine')
    if (cnLevel === 2) { rainDelta += CLOUD_NINE_RAIN_PP_L2; stormDelta -= CLOUD_NINE_OTHER_PP_L2 }
    else if (cnLevel === 1) { rainDelta += CLOUD_NINE_RAIN_PP_L1; stormDelta -= CLOUD_NINE_OTHER_PP_L1 }
    const ocLevel = secretLevelOf(p, 'sa-overcoat')
    if (ocLevel === 2) { rainDelta -= OVERCOAT_PP_L2; stormDelta -= OVERCOAT_PP_L2 }
    else if (ocLevel === 1) { rainDelta -= OVERCOAT_PP_L1; stormDelta -= OVERCOAT_PP_L1 }
  }
  // Own Tempo: non-stacking, use strictest cap (L2=1 < L1=2; if both, L2 wins)
  let ownTempoCap = 0
  if (s.roster.some((p) => hasOwnTempo(p) && secretLevelOf(p, 'sa-own-tempo') === 2)) {
    ownTempoCap = OWN_TEMPO_CAP_L2
  } else if (s.roster.some(hasOwnTempo)) {
    ownTempoCap = OWN_TEMPO_CAP_L1
  }
  s.weather = buildDayWeather(
    s.run.seed,
    s.run.day,
    city,
    rainDelta,
    stormDelta,
    0, // extraHeatChancePercent — preenchido na Task 9 (Cloud Nine/Overcoat)
    ownTempoCap,
  )
  applyForewarn(s)
  applySpore(s)
  s.clock.dayElapsedMs = 0
  s.clock.speed = 1
}

/**
 * Spore: no início do dia, cada portador ganha buffs de atributo do dia (1 eixo no L1, 3 no L2).
 * Os incrementos somam ao `dayBuffs` existente (itens da manhã), o HP é recalculado e o Pokémon
 * começa o dia cheio. Determinístico por (seed do dia).
 */
export function applySpore(s: GameState): void {
  const rng = createRng(deriveSeed(s.run.seed, SPORE_SEED_SALT, s.run.day))
  s.roster = s.roster.map((p) => {
    const add = sporeDayBuffs(p, rng)
    if (Object.keys(add).length === 0) return p
    const dayBuffs = { ...(p.dayBuffs ?? {}) }
    for (const key of Object.keys(add) as (keyof typeof add)[]) {
      dayBuffs[key] = (dayBuffs[key] ?? 0) + (add[key] ?? 0)
    }
    const recomputed = recomputeMaxHp({ ...p, dayBuffs })
    return { ...recomputed, currentHp: recomputed.maxHp }
  })
}

/**
 * Forewarn: cada portador antecipa missões não-special iguais ao seu NÍVEL (L1 = 1, L2 = 2).
 * O total é a SOMA dos níveis de todos os portadores. Antecipa spawnAtMs=0 (preserva a duração).
 */
function applyForewarn(s: GameState): void {
  const count = s.roster.reduce((sum, p) => sum + secretLevelOf(p, 'sa-forewarn'), 0)
  if (count === 0) return
  const movable = s.missions.filter((m) => m.templateId !== 'special' && m.spawnAtMs > 0)
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
  // Tamanho do esquadrão sorteado na faixa do dia, depois os inimigos e a arte — tudo do
  // mesmo rng semeado, então é estável para este evento mas varia entre defesas/dias.
  const size = rollSquadSize(rng, s.run.day)
  const trainer = getTrainer(trainerId)
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
      shiny: shinyFor(pick.seed),
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
