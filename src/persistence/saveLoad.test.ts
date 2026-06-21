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

  it('migra v34 → v35: inicia specialChances vazio, descarta missões Rocket e libera Pokémon presos', () => {
    const base = autoSeedRun(42) as unknown as Record<string, unknown>
    // Monta roster sintético com 3 Pokémon para testar a liberação de presos.
    const rosterBase = base.roster as Array<Record<string, unknown>>
    const proto = rosterBase[0]! // template com todos os campos obrigatórios do Pokémon
    const mon0 = { ...proto, id: 'p-test-0', status: 'mission' } // preso na missão Rocket
    const mon1 = { ...proto, id: 'p-test-1', status: 'mission' } // preso na missão battle
    const mon2 = { ...proto, id: 'p-test-2', status: 'idle' }    // na missão normal (não afetado)
    const missions = [
      { templateId: 'rocket', status: 'traveling', teamIds: [mon0.id], category: 'rocket' },
      { templateId: 'patrol', status: 'battle',   teamIds: [mon1.id], category: 'patrol' },
      { templateId: 'patrol', status: 'traveling', teamIds: [mon2.id], category: 'patrol' },
    ]
    const run = { ...base.run as Record<string, unknown> }
    delete run.specialChances
    const v34 = {
      version: 34,
      savedAtMs: 0,
      state: { ...base, roster: [mon0, mon1, mon2], missions, run },
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(v34))
    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    // specialChances inicializado vazio
    expect(loaded!.run.specialChances).toEqual([])
    // apenas a missão normal sobrevive
    expect(loaded!.missions).toHaveLength(1)
    expect((loaded!.missions[0] as unknown as Record<string, unknown>).templateId).toBe('patrol')
    expect((loaded!.missions[0] as unknown as Record<string, unknown>).status).toBe('traveling')
    // mon0 e mon1 libertos (idle); mon2 não afetado
    const r0 = loaded!.roster.find((p) => p.id === mon0.id)!
    const r1 = loaded!.roster.find((p) => p.id === mon1.id)!
    const r2 = loaded!.roster.find((p) => p.id === mon2.id)!
    expect(r0.status).toBe('idle')
    expect(r1.status).toBe('idle')
    expect(r2.status).toBe('idle')
  })

  it('migra v35 → v36: inicia run.theftChance=1 e não cria theft', () => {
    const base = autoSeedRun(42) as unknown as Record<string, unknown>
    // Simula save v35: run sem theftChance (campo novo na v36).
    const run = { ...base.run as Record<string, unknown> }
    delete run.theftChance
    const v35 = { version: 35, savedAtMs: 0, state: { ...base, run } }
    localStorage.setItem(SAVE_KEY, JSON.stringify(v35))
    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    expect(loaded!.run.theftChance).toBe(1)
    expect(loaded!.theft).toBeUndefined()
  })

  it('migra v36 → v37: converte secretCount para secretPicks e limpa secretUnlock do dia', () => {
    const base = autoSeedRun(42) as unknown as Record<string, unknown>
    const rosterBase = base.roster as Array<Record<string, unknown>>
    const proto = rosterBase[0]!
    const mon0 = { ...proto, id: 'p-sc-0', secretCount: 0 }  // 0 → []
    const mon1 = { ...proto, id: 'p-sc-1', secretCount: 1 }  // 1 → [{slot:0,level:1}]
    const mon2 = { ...proto, id: 'p-sc-2', secretCount: 3 }  // >=2 → [{slot:0},{slot:1}]
    const today = { ...(base.today as Record<string, unknown>), secretUnlock: { foo: 1 } }
    const v36 = {
      version: 36,
      savedAtMs: 0,
      state: { ...base, roster: [mon0, mon1, mon2], today },
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(v36))
    const loaded = loadGame()!
    expect(loaded).not.toBeNull()
    const r0 = loaded.roster.find((p) => p.id === 'p-sc-0')! as unknown as Record<string, unknown>
    const r1 = loaded.roster.find((p) => p.id === 'p-sc-1')! as unknown as Record<string, unknown>
    const r2 = loaded.roster.find((p) => p.id === 'p-sc-2')! as unknown as Record<string, unknown>
    expect(r0.secretPicks ?? []).toEqual([])
    expect(r1.secretPicks).toEqual([{ slot: 0, level: 1 }])
    expect(r2.secretPicks).toEqual([{ slot: 0, level: 1 }, { slot: 1, level: 1 }])
    expect(r0.secretCount).toBeUndefined()
    expect(r1.secretCount).toBeUndefined()
    expect(r2.secretCount).toBeUndefined()
    expect(loaded.today.secretUnlock).toBeNull()
  })

  it('clearSave remove o save', () => {
    saveGame(autoSeedRun(1), 0)
    clearSave()
    expect(hasSave()).toBe(false)
    expect(loadGame()).toBeNull()
  })
})
