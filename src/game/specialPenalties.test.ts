// Penalidades da Missão Especial (Feature A — A3/A4): aplicadas no fim do dia, nunca game over,
// e EXCLUÍDAS da razão normal de estrelas.

import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import { finalizeDay } from './phaseFlow.ts'
import type { GameState } from '../engine/state.ts'

/** Estado pronto para finalizar o dia com `missionResults` controlados. */
function dayWith(results: GameState['today']['missionResults']): GameState {
  const s = autoSeedRun(1)
  s.run.phase = 'DAY'
  s.run.day = 3
  s.approval.missionStars = 3
  s.approval.battleStars = 3
  s.today.missionResults = results
  // Sem defesas: a trilha de batalhas fica neutra (total 0 → delta 0).
  s.today.defensesTotal = 0
  s.today.defensesWon = 0
  return s
}

describe('penalidades da Missão Especial', () => {
  it('especial NÃO despachada (expired) zera missionStars sem game over', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: false, teamIds: [] }, // expirada, sem dispatch
    ])
    finalizeDay(s)
    expect(s.approval.missionStars).toBe(0)
    expect(s.run.phase).not.toBe('GAMEOVER')
  })

  it('especial despachada e falha tira 1 estrela cheia (piso 0)', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: false, teamIds: ['p1'] }, // tentou e falhou
    ])
    const before = 3
    finalizeDay(s)
    // desempenho normal: 1/1 → +1; depois −1 da especial → volta a 3.
    expect(s.approval.missionStars).toBe(before)
    expect(s.run.phase).not.toBe('GAMEOVER')
  })

  it('especial concluída não penaliza (só conta no total de exibição)', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: true, teamIds: ['p1'] },
    ])
    finalizeDay(s)
    // 1 normal cumprida de 1 normal → 100% → +1 estrela; especial concluída não mexe na razão nem penaliza.
    expect(s.approval.missionStars).toBe(4)
    expect(s.run.phase).not.toBe('GAMEOVER')
  })

  it('a razão de estrelas IGNORA a especial (não conta como missão a mais não cumprida)', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'palestra', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: true, teamIds: ['p1'] },
    ])
    finalizeDay(s)
    // 2/2 normais → 100% → +1 (não 2/3 = 66%); especial concluída não penaliza.
    // Se a especial entrasse na razão seria 2/3 → meta atingida → apenas +0,5.
    // Com a filtragem correta: 2/2 → +1,0 → 3 + 1 = 4.
    expect(s.approval.missionStars).toBe(4)
  })
})
