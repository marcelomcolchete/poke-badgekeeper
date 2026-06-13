// Helpers de orquestração mantendo o determinismo (PLAN §5).
// Ids e sub-seeds de RNG saem de contadores no próprio GameState — nada de
// Date.now()/Math.random(). O reducer trabalha sobre um "rascunho" (clone) e o
// muta localmente; a entrada nunca é tocada, então a pureza é preservada.

import type { Pokemon } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { createRng, deriveSeed, type Rng } from '../engine/rng.ts'

/** Clona o estado para mutação local segura (entrada intacta). */
export function draft(state: GameState): GameState {
  return structuredClone(state)
}

/** Próximo id determinístico com prefixo (ex.: `m7`, `d3`, `p12`). Avança o rascunho. */
export function takeId(s: GameState, prefix: string): string {
  const id = `${prefix}${s.nextId}`
  s.nextId += 1
  return id
}

/** RNG determinístico derivado de seed+dia+cursor; avança o cursor do rascunho. */
export function takeRng(s: GameState): Rng {
  const rng = createRng(deriveSeed(s.run.seed, s.run.day, s.rngCursor))
  s.rngCursor += 1
  return rng
}

/** Acha um Pokémon do roster por id (ou undefined). */
export function findMon(s: GameState, id: string): Pokemon | undefined {
  return s.roster.find((p) => p.id === id)
}

/** Substitui in-place (no rascunho) um Pokémon do roster pelo de mesmo id. */
export function replaceMon(s: GameState, updated: Pokemon): void {
  const index = s.roster.findIndex((p) => p.id === updated.id)
  if (index >= 0) s.roster[index] = updated
}
