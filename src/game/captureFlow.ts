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

/** Manda um Pokémon idle viajar até um spot e procurar; bloqueado com o roster cheio (§4.5). */
export function startSearch(s: GameState, searcherId: string, spotIndex: number): void {
  if (rosterIsFull(s.roster)) return
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
function startReturn(s: GameState, searcherId: string, spotIndex: number): void {
  const searcher = findMon(s, searcherId)
  if (!searcher) return
  const city = getCity(s.run.cityIndex)
  const node = s.captureSpots[spotIndex] ?? city.siteNodes.gym
  const path = shortestPath(city.graph, city.siteNodes.gym, node)
  const oneWay = graphTravelMs(pathDistance(city.graph, path), [searcher])
  const now = s.clock.dayElapsedMs
  replaceMon(s, { ...searcher, status: 'returning' })
  s.captureReturns.push({ searcherId, node, path, departAtMs: now, arriveAtMs: now + oneWay })
}

/** Procurador chegou de volta ao ginásio → idle; remove do conjunto de retornos. */
export function advanceCaptureReturn(s: GameState, ret: CaptureReturn, nowMs: number): void {
  if (nowMs < ret.arriveAtMs) return
  const searcher = findMon(s, ret.searcherId)
  if (searcher) replaceMon(s, { ...searcher, status: 'idle' })
  s.captureReturns = s.captureReturns.filter((r) => r !== ret)
}

/** Captura o candidato escolhido (se houver espaço), encerra a área e inicia a volta. */
export function capturePick(s: GameState, searcherId: string, speciesId: number): void {
  const encounter = popEncounter(s, searcherId)
  if (!encounter || !encounter.candidateSpeciesIds.includes(speciesId)) return
  if (!rosterIsFull(s.roster)) {
    const id = takeId(s, 'p')
    s.roster = captureWild({
      roster: s.roster,
      species: getSpecies(speciesId),
      level: encounter.level,
      rng: takeRng(s),
      id,
    })
    s.today.capturedIds.push(id)
  }
  startReturn(s, searcherId, encounter.spotIndex)
  consumeSpot(s, encounter.spotIndex)
}

/** Não pega nenhum: encerra a área do dia e traz o procurador de volta — PLAN §4.5. */
export function captureDismiss(s: GameState, searcherId: string): void {
  const encounter = popEncounter(s, searcherId)
  if (!encounter) return
  startReturn(s, searcherId, encounter.spotIndex)
  consumeSpot(s, encounter.spotIndex)
}
