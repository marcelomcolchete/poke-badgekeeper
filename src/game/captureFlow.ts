// Captura como atividade do dia (PLAN §4.5): START_SEARCH faz um Pokémon VIAJAR até a
// área de grama; ao chegar, ele procura; ao terminar, surge um encontro (3 candidatos).
// Depois de capturar/dispensar, o procurador VOLTA ao ginásio e só então fica disponível.

import type { GameState } from '../engine/state.ts'
import type { CaptureReturn, CaptureSearch } from '../engine/state.ts'
import { markActive } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { rollEncounter, rosterIsFull, searchMs } from '../engine/capture.ts'
import { HEARTS_MAX, MAX_ROSTER_SIZE } from '../engine/constants.ts'
import { maxRarityIndexForBall } from '../data/balls.ts'
import { effectiveAttr } from '../engine/attributes.ts'
import { createPokemon } from '../engine/leveling.ts'
import { travelRoute } from '../engine/missions.ts'
import { graphWithTunnels } from '../engine/pathfinding.ts'
import { planWeatherLeg } from '../engine/weatherTravel.ts'
import { teamSurfs } from '../engine/secretEffects.ts'
import { instantWeatherSpeed, weatherTravelMs } from '../engine/rainSpeed.ts'
import { EXPLORATION_XP } from '../engine/balance.ts'
import { applyXpGains } from './itemFlow.ts'
import { createRng } from '../engine/rng.ts'
import { shinyChance, shinyForChance } from '../engine/shiny.ts'
import { findMon, replaceMon, takeId, takeRng } from './runtime.ts'

/** Concede o XP de exploração ao explorador e contabiliza no total do dia. */
function awardExplorationXp(s: GameState, searcherId: string): void {
  applyXpGains(s, new Map([[searcherId, EXPLORATION_XP]]), takeRng(s))
  s.today.xpEarned += EXPLORATION_XP
}

/**
 * Manda um Pokémon idle viajar até um spot e procurar. Com o roster cheio a busca continua
 * liberada (§4.5, ajuste): ao capturar, o jogador escolhe um Pokémon para descartar.
 */
export function startSearch(s: GameState, searcherId: string, spotIndex: number): void {
  const searcher = findMon(s, searcherId)
  if (!searcher || searcher.status !== 'idle') return
  if (s.captureSearches.some((c) => c.searcherId === searcherId)) return
  const node = s.captureSpots[spotIndex]
  if (!node) return
  // A área só pode ser explorada depois de surgir no mapa (horário sorteado) — #7.
  if (s.clock.dayElapsedMs < (s.captureSpotSpawnsAtMs[spotIndex] ?? 0)) return

  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const { flying, surfing, path, distance } = travelRoute(graph, city.siteNodes.gym, node, [searcher], s.runItems)
  // Inalcançável: a área só é acessível cruzando a água e o explorador não surfa (ex.: 3.6 em 'm',
  // que só liga por 'a'/'n'). Sem rota, não despacha — a UI já bloqueia, mas a guarda evita uma
  // "viagem instantânea" de caminho vazio (espelha acceptMission). Voo/Sniper nunca dão [].
  if (path.length === 0) return
  const now = s.clock.dayElapsedMs
  const oneWay = weatherTravelMs(s.weather, now, distance, [searcher], s.runItems, s.today.electrified)
  const arriveAtMs = now + oneWay
  // Fast Ball: a busca é resolvida na hora em que o Pokémon chega na área (sem tempo de busca).
  const instant = s.runItems.includes('fast-ball')

  markActive(s.today, searcherId) // participação do dia (corações)
  replaceMon(s, { ...searcher, status: 'traveling' })
  s.captureSearches.push({
    searcherId,
    spotIndex,
    node,
    path,
    flying,
    surfing,
    phase: 'traveling',
    departAtMs: now,
    arriveAtMs,
    readyAtMs: instant ? arriveAtMs : arriveAtMs + searchMs(searcher),
  })
}

/**
 * Clima (poças): um procurador que NÃO surfa nem voa desvia de poças ativas na ida ou, sem rota
 * seca, espera no ponto anterior até a poça secar — espelha o `applyWeatherHold` das missões.
 * Adia em conjunto a chegada (arriveAtMs) e o fim da busca (readyAtMs) pelo atraso embutido.
 */
function applySearchWeatherHold(s: GameState, search: CaptureSearch, nowMs: number): void {
  if (s.weather.rain.length === 0) return
  if (search.flying) return
  const searcher = findMon(s, search.searcherId)
  if (!searcher) return
  const team = [searcher]
  if (teamSurfs(team, s.runItems)) return

  // Espera em andamento: fica parado até a poça secar; só então reavalia.
  if (search.weatherHold) {
    if (nowMs < search.weatherHold.untilMs) return
    search.weatherHold = undefined
  }

  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const baseLeg = search.reroutePath ?? search.path
  // Velocidade efetiva AGORA (base + Swift Swim se chovendo, ou reduzida pelo calor); o extraMs do desvio é linear a essa
  // taxa, enquanto a chegada-base veio do integrador (rainSpeed) — aproximação consciente (ver plano).
  const speedMult = instantWeatherSpeed(s.weather, nowMs, team, s.runItems, s.today.electrified)
  const plan = planWeatherLeg({
    graph,
    weather: s.weather,
    baseLeg,
    legStart: search.departAtMs,
    legEnd: search.arriveAtMs,
    nowMs,
    team,
    speedMult,
  })
  if (plan.kind === 'reroute') {
    search.reroutePath = plan.reroutePath
    search.arriveAtMs += plan.extraMs
    search.readyAtMs += plan.extraMs
  } else if (plan.kind === 'wait') {
    search.weatherHold = { node: plan.node, untilMs: plan.untilMs }
    // Espera: translada a janela inteira (departAtMs incluído) para o progresso retomar do ponto congelado.
    search.departAtMs += plan.extraMs
    search.arriveAtMs += plan.extraMs
    search.readyAtMs += plan.extraMs
  }
}

/** Transições por tempo da busca: traveling→(chegada)searching→(busca)encontro (§4.5). */
export function advanceSearch(s: GameState, search: CaptureSearch, nowMs: number): void {
  if (search.phase === 'traveling') applySearchWeatherHold(s, search, nowMs)
  if (search.phase === 'traveling' && nowMs >= search.arriveAtMs) {
    search.phase = 'searching'
    search.snow = undefined // chegou na área → zera os stacks de gelo
    search.sandDetour = undefined
    const searcher = findMon(s, search.searcherId)
    if (searcher) replaceMon(s, { ...searcher, status: 'onMission' })
  }
  if (search.phase === 'searching' && nowMs >= search.readyAtMs) {
    readySearch(s, search)
  }
}

/** Busca concluída → gera o encontro (candidatos dos tipos do ginásio) — PLAN §4.5. */
export function readySearch(s: GameState, search: CaptureSearch): void {
  s.captureSearches = s.captureSearches.filter((c) => c !== search)
  // O nível de bola limita as raridades; a Percepção do explorador define a distribuição de rank.
  const searcher = findMon(s, search.searcherId)
  const maxRarityIndex = maxRarityIndexForBall(s.run.ballLevel)
  const searcherPerception = searcher ? effectiveAttr(searcher, 'percepcao') : 0
  const encounter = rollEncounter(takeRng(s), s.gym.types, s.run.day, maxRarityIndex)
  // Um seed estável por candidato: o card do preview já mostra natureza/IVs/rank reais
  // e a captura recria o MESMO Pokémon a partir desse seed (com o mesmo centro de rank).
  const seedRng = takeRng(s)
  s.encounters.push({
    searcherId: search.searcherId,
    spotIndex: search.spotIndex,
    level: encounter.level,
    candidateSpeciesIds: encounter.candidates.map((c) => c.id),
    candidateLevels: encounter.levels,
    candidateSeeds: encounter.candidates.map(() => seedRng.int(0, 0x7fffffff)),
    candidateShiny: encounter.candidates.map((_, i) =>
      shinyForChance(shinyChance(s.runItems), s.run.seed, s.run.day, search.spotIndex, i),
    ),
    searcherPerception,
  })
}

function popEncounter(s: GameState, searcherId: string) {
  const encounter = s.encounters.find((e) => e.searcherId === searcherId)
  if (encounter) s.encounters = s.encounters.filter((e) => e !== encounter)
  return encounter
}

/** Marca a área como explorada hoje — o spot some do mapa até o próximo dia. */
function consumeSpot(s: GameState, spotIndex: number): void {
  if (!s.today.exploredSpots.includes(spotIndex)) s.today.exploredSpots.push(spotIndex)
}

/** Inicia a viagem de volta do procurador ao ginásio (fica idle só ao chegar). */
function startReturn(s: GameState, searcherId: string, spotIndex: number, captured: boolean): void {
  const searcher = findMon(s, searcherId)
  if (!searcher) return
  const city = getCity(s.run.cityIndex)
  const node = s.captureSpots[spotIndex] ?? city.siteNodes.gym
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  // Volta = rota REAL do ponto até o ginásio (não o reverso da ida): com arestas de mão única
  // (ex.: voltar de 'k' por k→t→u) o caminho/tempo da volta diferem da ida (PLAN §3.1).
  const { flying, surfing, path, distance } = travelRoute(graph, node, city.siteNodes.gym, [searcher], s.runItems)
  const now = s.clock.dayElapsedMs
  const oneWay = weatherTravelMs(s.weather, now, distance, [searcher], s.runItems, s.today.electrified)
  replaceMon(s, { ...searcher, status: 'returning' })
  s.captureReturns.push({
    searcherId,
    spotIndex,
    captured,
    node,
    path,
    flying,
    surfing,
    departAtMs: now,
    arriveAtMs: now + oneWay,
  })
}

/**
 * Clima (poças): mesma regra da ida aplicada à volta de um procurador que não surfa nem voa —
 * desvia das poças ativas ou espera no ponto anterior, adiando a chegada (arriveAtMs).
 */
function applyReturnWeatherHold(s: GameState, ret: CaptureReturn, nowMs: number): void {
  if (s.weather.rain.length === 0) return
  if (ret.flying) return
  const searcher = findMon(s, ret.searcherId)
  if (!searcher) return
  const team = [searcher]
  if (teamSurfs(team, s.runItems)) return

  if (ret.weatherHold) {
    if (nowMs < ret.weatherHold.untilMs) return
    ret.weatherHold = undefined
  }

  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  // `path` é ponto→ginásio (volta real); saves antigos guardavam ginásio→ponto (detecta e inverte).
  const back = ret.path[0] === ret.node ? ret.path : [...ret.path].reverse()
  const baseLeg = ret.reroutePath ?? back
  // Velocidade efetiva AGORA (base + Swift Swim se chovendo, ou reduzida pelo calor); o extraMs do desvio é linear a essa
  // taxa, enquanto a chegada-base veio do integrador (rainSpeed) — aproximação consciente (ver plano).
  const speedMult = instantWeatherSpeed(s.weather, nowMs, team, s.runItems, s.today.electrified)
  const plan = planWeatherLeg({
    graph,
    weather: s.weather,
    baseLeg,
    legStart: ret.departAtMs,
    legEnd: ret.arriveAtMs,
    nowMs,
    team,
    speedMult,
  })
  if (plan.kind === 'reroute') {
    ret.reroutePath = plan.reroutePath
    ret.arriveAtMs += plan.extraMs
  } else if (plan.kind === 'wait') {
    ret.weatherHold = { node: plan.node, untilMs: plan.untilMs }
    // Espera: translada a janela inteira (departAtMs incluído) para o progresso retomar do ponto congelado.
    ret.departAtMs += plan.extraMs
    ret.arriveAtMs += plan.extraMs
  }
}

/** Procurador chegou de volta ao ginásio → idle; remove do conjunto de retornos. */
export function advanceCaptureReturn(s: GameState, ret: CaptureReturn, nowMs: number): void {
  applyReturnWeatherHold(s, ret, nowMs)
  if (nowMs < ret.arriveAtMs) return
  const searcher = findMon(s, ret.searcherId)
  if (searcher) replaceMon(s, { ...searcher, status: 'idle' })
  s.captureReturns = s.captureReturns.filter((r) => r !== ret)
}

/**
 * Captura o candidato escolhido, encerra a área e inicia a volta. Com o time cheio (6) o
 * Pokémon vai automaticamente para o Computador (PC) — a troca com o time só acontece de manhã.
 */
export function capturePick(s: GameState, searcherId: string, candidateIndex: number): void {
  const encounter = s.encounters.find((e) => e.searcherId === searcherId)
  const speciesId = encounter?.candidateSpeciesIds[candidateIndex]
  if (!encounter || speciesId === undefined) return

  s.encounters = s.encounters.filter((e) => e !== encounter)
  const id = takeId(s, 'p')
  // Recria o candidato a partir do seed do encontro (preview = captura); saves antigos
  // sem candidateSeeds caem no RNG da run.
  const seed = encounter.candidateSeeds?.[candidateIndex]
  // Nível REAL do candidato escolhido (saves antigos sem candidateLevels caem no nível base).
  const level = encounter.candidateLevels?.[candidateIndex] ?? encounter.level
  const shiny = encounter.candidateShiny?.[candidateIndex] ?? false
  const base = createPokemon({
    id,
    speciesId,
    level,
    rng: seed !== undefined ? createRng(seed) : takeRng(s),
    searcherPerception: encounter.searcherPerception,
    shiny,
  })
  // Love Ball: captura já vem com o máximo de corações.
  const caught = s.runItems.includes('love-ball') ? { ...base, hearts: HEARTS_MAX } : base
  // Time cheio → vai pro PC; senão entra no time.
  if (rosterIsFull(s.roster)) s.box = [...s.box, caught]
  else s.roster = [...s.roster, caught]
  s.today.capturedIds.push(id)
  if (!s.caughtSpecies.includes(speciesId)) s.caughtSpecies = [...s.caughtSpecies, speciesId]

  startReturn(s, searcherId, encounter.spotIndex, true)
  consumeSpot(s, encounter.spotIndex)
  awardExplorationXp(s, searcherId)
}

/** Manhã: deposita um Pokémon do time no Computador (PC). Mantém pelo menos 1 no time. */
export function depositPokemon(s: GameState, pokemonId: string): void {
  if (s.run.phase !== 'MORNING') return
  if (s.roster.length <= 1) return
  const mon = s.roster.find((p) => p.id === pokemonId)
  if (!mon) return
  s.roster = s.roster.filter((p) => p.id !== pokemonId)
  s.box = [...s.box, { ...mon, status: 'idle' }]
}

/** Manhã: retira um Pokémon do Computador (PC) para o time. Exige vaga (time < 6). */
export function withdrawPokemon(s: GameState, pokemonId: string): void {
  if (s.run.phase !== 'MORNING') return
  if (s.roster.length >= MAX_ROSTER_SIZE) return
  const mon = s.box.find((p) => p.id === pokemonId)
  if (!mon) return
  s.box = s.box.filter((p) => p.id !== pokemonId)
  s.roster = [...s.roster, { ...mon, status: 'idle' }]
}

/**
 * Define o apelido de um Pokémon (vazio = volta a usar o nome da espécie) — PLAN §4.5.
 * Procura no time E no Computador (PC): capturas com o time cheio vão pro `box`, e renomear
 * só o roster fazia o apelido escolhido se perder (findMon/replaceMon olham só o roster).
 */
export function renamePokemon(s: GameState, pokemonId: string, nickname: string): void {
  const trimmed = nickname.trim().slice(0, 16)
  const next = trimmed.length > 0 ? trimmed : null
  const inRoster = s.roster.find((p) => p.id === pokemonId)
  if (inRoster) {
    replaceMon(s, { ...inRoster, nickname: next })
    return
  }
  const inBox = s.box.find((p) => p.id === pokemonId)
  if (inBox) {
    s.box = s.box.map((p) => (p.id === pokemonId ? { ...p, nickname: next } : p))
  }
}

/** Não pega nenhum: encerra a área do dia e traz o procurador de volta — PLAN §4.5. */
export function captureDismiss(s: GameState, searcherId: string): void {
  const encounter = popEncounter(s, searcherId)
  if (!encounter) return
  startReturn(s, searcherId, encounter.spotIndex, false)
  consumeSpot(s, encounter.spotIndex)
  awardExplorationXp(s, searcherId)
}
