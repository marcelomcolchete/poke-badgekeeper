// Reducer puro: aplica uma ação ao GameState chamando a engine (PLAN §5).
// Trabalha sobre um rascunho (clone) e o muta localmente; a entrada nunca muda,
// então a função é pura e determinística (RNG semeado via runtime).

import type { GameState } from '../engine/state.ts'
import type { GameAction } from './actions.ts'
import { draft } from './runtime.ts'
import { tick } from './dayClock.ts'
import { startRun } from './setup.ts'
import { advancePhase, setSpeed } from './phaseFlow.ts'
import { acceptMission } from './missionFlow.ts'
import { assignDefense } from './defenseFlow.ts'
import { capturePick, captureDismiss, renamePokemon, startSearch } from './captureFlow.ts'
import { allocatePoint, applyItem, buyItem } from './marketFlow.ts'

export function reducer(state: GameState, action: GameAction): GameState {
  const s = draft(state)
  switch (action.type) {
    case 'START_RUN':
      startRun(
        s,
        action.gymTypes,
        action.starterSpeciesId,
        action.extraSpeciesIds,
        action.starterNickname,
        action.extraNicknames,
      )
      break
    case 'SET_SPEED':
      setSpeed(s, action.speed)
      break
    case 'TICK':
      tick(s, action.deltaMs)
      break
    case 'ADVANCE_PHASE':
      advancePhase(s)
      break
    case 'ACCEPT_MISSION':
      acceptMission(s, action.missionId, action.teamIds)
      break
    case 'ASSIGN_DEFENSE':
      assignDefense(s, action.defenseId, action.squadIds)
      break
    case 'START_SEARCH':
      startSearch(s, action.searcherId, action.spotIndex)
      break
    case 'CAPTURE_PICK':
      capturePick(s, action.searcherId, action.speciesId)
      break
    case 'CAPTURE_DISMISS':
      captureDismiss(s, action.searcherId)
      break
    case 'RENAME_POKEMON':
      renamePokemon(s, action.pokemonId, action.nickname)
      break
    case 'BUY_ITEM':
      buyItem(s, action.itemId, action.quantity)
      break
    case 'USE_ITEM':
      applyItem(s, action.itemId, action.targetId)
      break
    case 'ALLOCATE_POINT':
      allocatePoint(s, action.pokemonId, action.attr)
      break
  }
  return s
}
