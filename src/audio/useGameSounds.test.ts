import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { StormEvent } from '../engine/storm.ts'
import type { GameState } from '../engine/state.ts'
import { emptyWeatherSchedule } from '../engine/weather.ts'
import { emptyTally, emptyLifetime } from '../engine/state.ts'
import { STARS_START, STARTING_GOLD, DAY_LENGTH_MS } from '../engine/constants.ts'
import { THEFT_CHANCE_START } from '../engine/balance.ts'
import { shouldThunder, useGameSounds } from './useGameSounds.ts'
import { startHeat, stopHeat } from './heatPlayer.ts'

// ---------------------------------------------------------------------------
// Mocks para os testes do hook useGameSounds (ambiente node, sem DOM)
// ---------------------------------------------------------------------------

// Mocks dos players de áudio: vi.mock é hoisted, declarado antes dos imports que os usam.
vi.mock('./rainPlayer.ts', () => ({ startRain: vi.fn(), stopRain: vi.fn() }))
vi.mock('./heatPlayer.ts', () => ({ startHeat: vi.fn(), stopHeat: vi.fn() }))

// Mock mínimo do React para testar o hook useGameSounds em ambiente node.
// vi.hoisted é necessário para que _reactMockState seja disponível dentro do factory de vi.mock
// (ambos são hoisted antes dos imports, em ordem de aparição no arquivo).
const _reactMockState = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refs: [] as Array<{ current: any }>,
  idx: 0,
}))

// useRef: objetos persistentes entre chamadas (simula React fiber).
// useEffect: chama callback SÍNCRONO (sem scheduler, sem DOM).
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useRef: (initial: unknown) => {
      const s = _reactMockState
      if (s.refs[s.idx] === undefined) s.refs[s.idx] = { current: initial }
      return s.refs[s.idx++]
    },
    useEffect: (fn: () => void | (() => void)) => { fn() },
  }
})

/** Estado mínimo de GameState em fase DAY com heat schedule. */
function makeDayState(dayElapsedMs: number, heatWindows: { startMs: number; endMs: number }[]): GameState {
  return {
    run: { cityIndex: 0, day: 3, seed: 1, phase: 'DAY', ballLevel: 0, theftChance: THEFT_CHANCE_START, specialChances: [] },
    clock: { dayElapsedMs, dayLengthMs: DAY_LENGTH_MS, speed: 1 },
    gym: { types: [] },
    roster: [],
    box: [],
    caughtSpecies: [],
    missions: [],
    defenses: [],
    captureSearches: [],
    captureReturns: [],
    encounters: [],
    captureSpots: [],
    captureSpotSpawnsAtMs: [],
    approval: { missionStars: STARS_START, battleStars: STARS_START, dailyGoalMet: false },
    gold: STARTING_GOLD,
    inventory: [],
    runItems: [],
    electirizerCharges: {},
    today: emptyTally(),
    lifetime: emptyLifetime(),
    weather: { ...emptyWeatherSchedule(), heat: heatWindows },
    history: [],
    nextId: 1,
    rngCursor: 0,
  }
}

/** Tempestade com um único raio que impacta em `strikeAtMs` (círculos irrelevantes ao áudio). */
function stormWithStrikeAt(strikeAtMs: number): StormEvent[] {
  return [
    {
      startMs: 0,
      endMs: 60_000,
      strikes: [{ warnAtMs: strikeAtMs - 5_000, strikeAtMs, circles: [] }],
    },
  ]
}

// ---------------------------------------------------------------------------
// Helpers para simular ticks do hook
// ---------------------------------------------------------------------------

/**
 * Simula uma chamada ao hook useGameSounds (um "render").
 * Reseta o cursor de refs (idx) antes de cada chamada, mantendo os valores dos refs
 * (como o React faz entre re-renders do mesmo componente).
 */
function simulateTick(state: GameState): void {
  _reactMockState.idx = 0
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useGameSounds(state)
}

// ---------------------------------------------------------------------------

describe('shouldThunder', () => {
  const storms = stormWithStrikeAt(5_000)

  it('soa quando um raio impacta dentro da janela (prevMs, nowMs] na fase Dia', () => {
    expect(shouldThunder(storms, 4_000, 6_000, 'DAY')).toBe(true)
  })

  it('não soa quando o impacto já passou (fora da janela)', () => {
    expect(shouldThunder(storms, 6_000, 7_000, 'DAY')).toBe(false)
  })

  it('não soa antes do impacto', () => {
    expect(shouldThunder(storms, 0, 4_000, 'DAY')).toBe(false)
  })

  it('não soa fora da fase Dia (ex.: SUMMARY)', () => {
    expect(shouldThunder(storms, 4_000, 6_000, 'SUMMARY')).toBe(false)
  })

  it('virada de dia (nowMs <= prevMs) não soa', () => {
    expect(shouldThunder(storms, 9_000, 0, 'DAY')).toBe(false)
  })

  it('salto grande de tempo cobre o impacto e soa (robusto a aba oculta / x3)', () => {
    expect(shouldThunder(storms, 0, 100_000, 'DAY')).toBe(true)
  })

  it('sem tempestade nunca soa', () => {
    expect(shouldThunder([], 0, 100_000, 'DAY')).toBe(false)
  })

  it('a borda esquerda é exclusiva: impacto exatamente em prevMs não soa', () => {
    expect(shouldThunder(storms, 5_000, 6_000, 'DAY')).toBe(false)
  })

  it('a borda direita é inclusiva: impacto exatamente em nowMs soa', () => {
    expect(shouldThunder(storms, 4_000, 5_000, 'DAY')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Testes de integração do hook: som de Calor (espelha padrão da chuva)
// ---------------------------------------------------------------------------

describe('useGameSounds — som de Calor', () => {
  const HEAT_WINDOW = [{ startMs: 0, endMs: 10_000 }]

  beforeEach(() => {
    // Limpa refs e spies antes de cada teste (nova "instância" do hook).
    _reactMockState.refs = []
    _reactMockState.idx = 0
    vi.mocked(startHeat).mockClear()
    vi.mocked(stopHeat).mockClear()
  })

  it('chama startHeat ao entrar em janela de calor (fase DAY)', () => {
    // O som de calor (como o de chuva) não é bloqueado pelo flag `first`:
    // na 1ª chamada com now dentro da janela, hot.current=false → startHeat.
    simulateTick(makeDayState(5_000, HEAT_WINDOW))
    expect(vi.mocked(startHeat)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(stopHeat)).not.toHaveBeenCalled()
  })

  it('chama stopHeat ao sair da janela de calor', () => {
    // Entra na janela (1º tick): hot.current vai para true.
    simulateTick(makeDayState(5_000, HEAT_WINDOW))
    vi.mocked(startHeat).mockClear()
    // Sai da janela: hot.current=true, isHotNow=false → stopHeat.
    simulateTick(makeDayState(11_000, HEAT_WINDOW))
    expect(vi.mocked(stopHeat)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(startHeat)).not.toHaveBeenCalled()
  })

  it('não chama startHeat nem stopHeat quando calor não muda de estado', () => {
    simulateTick(makeDayState(5_000, HEAT_WINDOW))  // entra — startHeat; hot.current=true
    vi.mocked(startHeat).mockClear()
    simulateTick(makeDayState(6_000, HEAT_WINDOW))  // ainda quente — sem transição
    expect(vi.mocked(startHeat)).not.toHaveBeenCalled()
    expect(vi.mocked(stopHeat)).not.toHaveBeenCalled()
  })

  it('não chama startHeat em fase não-DAY mesmo com janela de calor', () => {
    const nonDayState: GameState = {
      ...makeDayState(5_000, HEAT_WINDOW),
      run: { ...makeDayState(5_000, HEAT_WINDOW).run, phase: 'MORNING' },
    }
    simulateTick(nonDayState)
    expect(vi.mocked(startHeat)).not.toHaveBeenCalled()
  })
})
