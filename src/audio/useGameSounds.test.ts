import { describe, expect, it } from 'vitest'
import type { StormEvent } from '../engine/storm.ts'
import { shouldThunder } from './useGameSounds.ts'

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
