// Captura como atividade do dia (PLAN §4.5): START_SEARCH ocupa um Pokémon; ao
// terminar a busca, surge um encontro com 3 candidatos; o jogador captura/volta/segue.

import type { GameState } from '../engine/state.ts'
import type { CaptureSearch } from '../engine/state.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import {
  captureWild,
  rollEncounter,
  rosterIsFull,
  searchMs,
} from '../engine/capture.ts'
import { findMon, replaceMon, takeId, takeRng } from './runtime.ts'

/** Manda um Pokémon idle procurar num spot; bloqueado com o roster cheio (PLAN §4.5). */
export function startSearch(s: GameState, searcherId: string, spotIndex: number): void {
  if (rosterIsFull(s.roster)) return
  const searcher = findMon(s, searcherId)
  if (!searcher || searcher.status !== 'idle') return
  if (s.captureSearches.some((c) => c.searcherId === searcherId)) return

  replaceMon(s, { ...searcher, status: 'onMission' })
  s.captureSearches.push({
    searcherId,
    spotIndex,
    readyAtMs: s.clock.dayElapsedMs + searchMs(searcher),
  })
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

function releaseSearcher(s: GameState, searcherId: string): void {
  const searcher = findMon(s, searcherId)
  if (searcher) replaceMon(s, { ...searcher, status: 'idle' })
}

/** Marca a área como explorada hoje — o spot some do mapa até o próximo dia. */
function consumeSpot(s: GameState, spotIndex: number): void {
  if (!s.today.exploredSpots.includes(spotIndex)) s.today.exploredSpots.push(spotIndex)
}

/** Captura o candidato escolhido (se houver espaço), libera o procurador e encerra a área. */
export function capturePick(s: GameState, searcherId: string, speciesId: number): void {
  const encounter = popEncounter(s, searcherId)
  if (!encounter || !encounter.candidateSpeciesIds.includes(speciesId)) return
  if (rosterIsFull(s.roster)) {
    releaseSearcher(s, searcherId) // roster encheu nesse meio-tempo: só volta
    return
  }
  const id = takeId(s, 'p')
  s.roster = captureWild({
    roster: s.roster,
    species: getSpecies(speciesId),
    level: encounter.level,
    rng: takeRng(s),
    id,
  })
  s.today.capturedIds.push(id)
  releaseSearcher(s, searcherId)
  consumeSpot(s, encounter.spotIndex)
}

/** Não pega nenhum: traz o Pokémon de volta (idle) e encerra a área do dia — PLAN §4.5. */
export function captureDismiss(s: GameState, searcherId: string): void {
  const encounter = popEncounter(s, searcherId)
  if (!encounter) return
  releaseSearcher(s, searcherId)
  consumeSpot(s, encounter.spotIndex)
}
