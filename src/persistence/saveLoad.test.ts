import { beforeEach, describe, expect, it } from 'vitest'
import { SAVE_KEY } from '../engine/constants.ts'
import { autoSeedRun } from '../game/setup.ts'
import { reducer } from '../game/reducer.ts'
import { clearSave, hasSave, loadGame, saveGame } from './saveLoad.ts'

/** localStorage em memória para o ambiente node dos testes. */
function memStorage(): Storage {
  const map = new Map<string, string>()
  const api = {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => map.set(k, v),
  }
  return api as unknown as Storage
}

beforeEach(() => {
  globalThis.localStorage = memStorage()
})

describe('saveLoad (PLAN §5)', () => {
  it('faz round-trip de um GameState completo (v2)', () => {
    let state = autoSeedRun(42)
    state = reducer(state, { type: 'ADVANCE_PHASE' }) // entra no DAY (com agenda)
    state = reducer(state, { type: 'TICK', deltaMs: 20_000 })

    saveGame(state, 1_700_000_000_000)
    expect(hasSave()).toBe(true)
    expect(loadGame()).toEqual(state)
  })

  it('descarta save de versão incompatível', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 999, savedAtMs: 0, state: {} }))
    expect(loadGame()).toBeNull()
  })

  it('clearSave remove o save', () => {
    saveGame(autoSeedRun(1), 0)
    clearSave()
    expect(hasSave()).toBe(false)
    expect(loadGame()).toBeNull()
  })
})
