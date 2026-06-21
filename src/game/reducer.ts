// Reducer puro: aplica uma ação ao GameState chamando a engine (PLAN §5).
// Trabalha sobre um rascunho (clone) e o muta localmente; a entrada nunca muda,
// então a função é pura e determinística (RNG semeado via runtime).

import type { GameState } from '../engine/state.ts'
import { createInitialState } from '../engine/state.ts'
import type { GameAction } from './actions.ts'
import { draft } from './runtime.ts'
import { tick } from './dayClock.ts'
import { startRun } from './setup.ts'
import { advancePhase, setSpeed, chooseSecretAbility } from './phaseFlow.ts'
import { acceptMission } from './missionFlow.ts'
import { assignDefense, completeDefense } from './defenseFlow.ts'
import {
  capturePick,
  captureDismiss,
  depositPokemon,
  renamePokemon,
  startSearch,
  withdrawPokemon,
} from './captureFlow.ts'
import { allocatePoint, applyItem, buyBall, buyItem, useMoonStone, useRareCandy } from './marketFlow.ts'
import { dispatchTheftChasers, resolveTheftBattle, completeTheftBattle } from './theftFlow.ts'

export function reducer(state: GameState, action: GameAction): GameState {
  // Reinício total numa nova cidade: descarta o estado atual (não dobra no draft) — começo limpo.
  if (action.type === 'RESET_TO_CITY') {
    const fresh = createInitialState(action.seed)
    fresh.run.cityIndex = action.cityIndex
    return fresh
  }
  const s = draft(state)
  switch (action.type) {
    case 'SELECT_CITY':
      s.run.cityIndex = action.cityIndex
      break
    case 'START_RUN':
      startRun(s, action.picks)
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
    case 'COMPLETE_DEFENSE':
      completeDefense(s, action.defenseId)
      break
    case 'START_SEARCH':
      startSearch(s, action.searcherId, action.spotIndex)
      break
    case 'CAPTURE_PICK':
      capturePick(s, action.searcherId, action.candidateIndex)
      break
    case 'CAPTURE_DISMISS':
      captureDismiss(s, action.searcherId)
      break
    case 'DEPOSIT_POKEMON':
      depositPokemon(s, action.pokemonId)
      break
    case 'WITHDRAW_POKEMON':
      withdrawPokemon(s, action.pokemonId)
      break
    case 'RENAME_POKEMON':
      renamePokemon(s, action.pokemonId, action.nickname)
      break
    case 'BUY_ITEM':
      buyItem(s, action.itemId, action.quantity)
      break
    case 'BUY_BALL':
      buyBall(s)
      break
    case 'USE_ITEM':
      applyItem(s, action.itemId, action.targetId)
      break
    case 'USE_RARE_CANDY':
      useRareCandy(s, action.pokemonId)
      break
    case 'USE_MOON_STONE':
      useMoonStone(s, action.pokemonId)
      break
    case 'ALLOCATE_POINT':
      allocatePoint(s, action.pokemonId, action.attr)
      break
    case 'DISPATCH_THEFT_CHASERS':
      dispatchTheftChasers(s, action.chaserIds)
      break
    case 'RESOLVE_THEFT_BATTLE':
      resolveTheftBattle(s)
      break
    case 'COMPLETE_THEFT_BATTLE':
      completeTheftBattle(s)
      break
    case 'CHOOSE_SECRET':
      chooseSecretAbility(s, action.slot, action.level)
      break
  }
  return s
}
