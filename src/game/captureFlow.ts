// Captura como atividade do dia (PLAN §4.5): START_SEARCH faz um Pokémon VIAJAR até a
// área de grama; ao chegar, ele procura; ao terminar, surge um encontro (3 candidatos).
// Depois de capturar/dispensar, o procurador VOLTA ao ginásio e só então fica disponível.

import type { GameState } from '../engine/state.ts'
import type { CaptureReturn, CaptureSearch } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import { captureWild, rollEncounter, rosterIsFull, searchMs } from '../engine/capture.ts'
import { graphTravelMs } from '../engine/missions.ts'
import { pathDistance, shortestPath } from '../engine/pathfinding.ts'
import { findMon, replaceMon, takeId, takeRng } from './runtime.ts'

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
  const path = shortestPath(city.graph, city.siteNodes.gym, node)
  const oneWay = graphTravelMs(pathDistance(city.graph, path), [searcher])
  const now = s.clock.dayElapsedMs
  const arriveAtMs = now + oneWay

  replaceMon(s, { ...searcher, status: 'traveling' })
  s.captureSearches.push({
    searcherId,
    spotIndex,
    node,
    path,
    phase: 'traveling',
    departAtMs: now,
    arriveAtMs,
    readyAtMs: arriveAtMs + searchMs(searcher),
  })
}

/** Transições por tempo da busca: traveling→(chegada)searching→(busca)encontro (§4.5). */
export function advanceSearch(s: GameState, search: CaptureSearch, nowMs: number): void {
  if (search.phase === 'traveling' && nowMs >= search.arriveAtMs) {
    search.phase = 'searching'
    const searcher = findMon(s, search.searcherId)
    if (searcher) replaceMon(s, { ...searcher, status: 'onMission' })
  }
  if (search.phase === 'searching' && nowMs >= search.readyAtMs) {
    readySearch(s, search)
  }
}

/** Busca concluída → gera o encontro (3 candidatos dos tipos do ginásio) — PLAN §4.5. */
export function readySearch(s: GameState, search: CaptureSearch): void {
  s.captureSearches = s.captureSearches.filter((c) => c !== search)
  const encounter = rollEncounter(takeRng(s), s.gym.types, s.run.day)
  s.encounters.push({
    searcherId: search.searcherId,
    spotIndex: search.spotIndex,
    level: encounter.level,
    candidateSpeciesIds: encounter.candidates.map((c) => c.id),
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
  const path = shortestPath(city.graph, city.siteNodes.gym, node)
  const oneWay = graphTravelMs(pathDistance(city.graph, path), [searcher])
  const now = s.clock.dayElapsedMs
  replaceMon(s, { ...searcher, status: 'returning' })
  s.captureReturns.push({
    searcherId,
    spotIndex,
    captured,
    node,
    path,
    departAtMs: now,
    arriveAtMs: now + oneWay,
  })
}

/** Procurador chegou de volta ao ginásio → idle; remove do conjunto de retornos. */
export function advanceCaptureReturn(s: GameState, ret: CaptureReturn, nowMs: number): void {
  if (nowMs < ret.arriveAtMs) return
  const searcher = findMon(s, ret.searcherId)
  if (searcher) replaceMon(s, { ...searcher, status: 'idle' })
  s.captureReturns = s.captureReturns.filter((r) => r !== ret)
}

/**
 * Captura o candidato escolhido, encerra a área e inicia a volta. Com o roster cheio é
 * preciso indicar `releaseId` — o Pokémon descartado para abrir vaga (§4.5, ajuste). Nunca
 * descarta o próprio procurador (ainda em campo).
 */
export function capturePick(
  s: GameState,
  searcherId: string,
  speciesId: number,
  releaseId?: string,
): void {
  // Valida ANTES de consumir o encontro: uma captura bloqueada (time cheio sem descarte)
  // não pode descartar o trio do encontro.
  const encounter = s.encounters.find((e) => e.searcherId === searcherId)
  if (!encounter || !encounter.candidateSpeciesIds.includes(speciesId)) return

  if (rosterIsFull(s.roster)) {
    if (!releaseId || releaseId === searcherId) return
    if (!s.roster.some((p) => p.id === releaseId)) return
    s.roster = s.roster.filter((p) => p.id !== releaseId)
  }
  s.encounters = s.encounters.filter((e) => e !== encounter)
  const id = takeId(s, 'p')
  s.roster = captureWild({
    roster: s.roster,
    species: getSpecies(speciesId),
    level: encounter.level,
    rng: takeRng(s),
    id,
  })
  s.today.capturedIds.push(id)

  startReturn(s, searcherId, encounter.spotIndex, true)
  consumeSpot(s, encounter.spotIndex)
}

/** Define o apelido de um Pokémon (vazio = volta a usar o nome da espécie) — PLAN §4.5. */
export function renamePokemon(s: GameState, pokemonId: string, nickname: string): void {
  const mon = findMon(s, pokemonId)
  if (!mon) return
  const trimmed = nickname.trim().slice(0, 16)
  replaceMon(s, { ...mon, nickname: trimmed.length > 0 ? trimmed : null })
}

/** Não pega nenhum: encerra a área do dia e traz o procurador de volta — PLAN §4.5. */
export function captureDismiss(s: GameState, searcherId: string): void {
  const encounter = popEncounter(s, searcherId)
  if (!encounter) return
  startReturn(s, searcherId, encounter.spotIndex, false)
  consumeSpot(s, encounter.spotIndex)
}
