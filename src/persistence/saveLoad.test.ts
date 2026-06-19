import { beforeEach, describe, expect, it } from 'vitest'
import { SAVE_KEY } from '../engine/constants.ts'
import { emptyWeatherSchedule } from '../engine/weather.ts'
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

  it('migra v26 → v27 inicializando o clima vazio', () => {
    const legacy: Partial<ReturnType<typeof autoSeedRun>> = autoSeedRun(7)
    delete legacy.weather // save "antigo" não tinha o campo weather
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 26, savedAtMs: 0, state: legacy }))
    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    expect(loaded!.weather).toEqual(emptyWeatherSchedule())
  })

  it('migra v32 → v33: adiciona storms, previsão de tempestade e paralyzedBattleIds', () => {
    const base = autoSeedRun(42) as unknown as Record<string, unknown>
    // Simula save v32: weather sem storms, forecast sem campos de tempestade, today sem paralyzedBattleIds.
    const weatherV32 = {
      rain: [],
      forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0 },
    }
    const todayBase = base.today as Record<string, unknown>
    const todayV32 = { ...todayBase }
    delete todayV32.paralyzedBattleIds
    const v32 = {
      version: 32,
      savedAtMs: 0,
      state: { ...base, weather: weatherV32, today: todayV32 },
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(v32))
    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    expect(loaded!.weather.storms).toEqual([])
    expect(loaded!.weather.forecast.stormChancePercent).toBe(0)
    expect(loaded!.today.paralyzedBattleIds).toEqual([])
  })

  it('migra v33 → v34: save sem shiny/candidateShiny segue válido (passthrough)', () => {
    const base = autoSeedRun(42) as unknown as Record<string, unknown>
    const v33 = { version: 33, savedAtMs: 0, state: base }
    localStorage.setItem(SAVE_KEY, JSON.stringify(v33))
    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    expect(loaded!.roster[0]!.shiny).toBeUndefined()
  })

  it('clearSave remove o save', () => {
    saveGame(autoSeedRun(1), 0)
    clearSave()
    expect(hasSave()).toBe(false)
    expect(loadGame()).toBeNull()
  })
})
