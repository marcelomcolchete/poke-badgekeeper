// Task 8: testes de integração do Evento de Roubo Rocket no relógio e nas transições de fase.
// Cobre: processTheft chamado no tick, rollTheftAtDayOpen no dia-aberto, resolveLeftovers
// fecha o roubo no fim do dia, e startNextDay limpa s.theft.

import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import { tick } from './dayClock.ts'
import { advancePhase } from './phaseFlow.ts'
import { rollTheftAtDayOpen, spawnTheft } from './theftFlow.ts'
import { makeMon } from '../engine/testkit.ts'
import type { GameState } from '../engine/state.ts'

/** Estado de DAY pronto para testes de tick (sem missões/defesas para não enroscar). */
function dayState(seed = 42): GameState {
  const s = autoSeedRun(seed)
  s.run.phase = 'DAY'
  // Limpar agenda para ter tick limpo
  s.missions = []
  s.defenses = []
  return s
}

describe('Task 8 — processTheft integrado no tick do dayClock', () => {
  it('tick avança o roubo armado para fleeing quando há alvo elegível', () => {
    const s = dayState()
    // Armar o roubo manualmente (sem usar a rolagem de chances)
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    expect(s.theft?.phase).toBe('armed') // pré-condição
    s.roster = [makeMon({ id: 'p1', status: 'idle' })]

    // tick deve chamar processTheft internamente → spawnTheft → fleeing
    tick(s, 1000)

    expect(s.theft?.phase).toBe('fleeing')
    expect(s.theft?.stolenId).toBe('p1')
  })

  it('tick resolve a fuga quando now ≥ arriveAtMs (atFarNode ou resolved)', () => {
    const s = dayState()
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'p2', status: 'idle' })]
    spawnTheft(s, 0) // fase fleeing a partir de t=0
    const arrive = s.theft!.arriveAtMs

    // Avançar tempo além de arriveAtMs — s.theft deve sair de fleeing
    s.clock.dayElapsedMs = arrive - 1
    tick(s, 2) // now = arrive + 1

    // Deve ter avançado de fleeing para atFarNode (ou resolved se graça também expirou)
    expect(s.theft?.phase).not.toBe('fleeing')
  })

  it('tick não processa roubo quando phase !== DAY', () => {
    const s = dayState()
    s.run.phase = 'MORNING'
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' })]

    tick(s, 1000) // não deve processar (phase MORNING)

    // theft permanece armed (tick retornou cedo)
    expect(s.theft?.phase).toBe('armed')
  })
})

describe('Task 8 — rollTheftAtDayOpen chamado em advancePhase MORNING→DAY', () => {
  it('MORNING→DAY com theftChance=100 arma o evento de roubo', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'MORNING'
    s.run.theftChance = 100
    // Garantir que não há theft já (limpa cursor de forma cirúrgica)
    delete (s as GameState & { theft?: unknown }).theft

    advancePhase(s) // MORNING → DAY, deve chamar rollTheftAtDayOpen

    expect(s.run.phase).toBe('DAY')
    // Com 100% de chance, theft deve estar armado
    expect(s.theft?.phase).toBe('armed')
  })

  it('MORNING→DAY com theftChance=1 incrementa a chance se não armar', () => {
    const s = autoSeedRun(99) // seed que falha na rolagem com 1%
    s.run.phase = 'MORNING'
    s.run.theftChance = 1
    delete (s as GameState & { theft?: unknown }).theft

    advancePhase(s)

    expect(s.run.phase).toBe('DAY')
    if (!s.theft) {
      // Falhou: chance deve ter dobrado
      expect(s.run.theftChance).toBe(2)
    } else {
      // Por acaso acertou: theft armado
      expect(s.theft.phase).toBe('armed')
    }
  })

  it('rollTheftAtDayOpen é idempotente: segundo advancePhase não sobrescreve theft existente', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'MORNING'
    s.run.theftChance = 100
    rollTheftAtDayOpen(s) // simula theft já existente
    const existingTheft = s.theft
    expect(existingTheft?.phase).toBe('armed')

    // Novo advancePhase não deve substituir o theft existente
    s.run.phase = 'MORNING'
    advancePhase(s) // chama rollTheftAtDayOpen → deve retornar imediatamente

    expect(s.theft).toBe(existingTheft) // mesma referência (ou pelo menos mesmo conteúdo)
  })
})

describe('Task 8 — resolveLeftovers fecha o roubo no fim do dia', () => {
  it('fleeing no fechamento do dia vira resolveTheftLoss (Pokémon removido)', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'DAY'
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'p2', status: 'idle' })]
    spawnTheft(s, 0) // fleeing
    expect(s.theft?.phase).toBe('fleeing')

    // Fechar o dia via advancePhase DAY → SUMMARY (chama finalizeDay → resolveLeftovers)
    s.run.phase = 'DAY'
    s.today.missionResults = [{ templateId: 't', success: true, teamIds: ['p1'] }]
    advancePhase(s) // DAY → SUMMARY

    // Com fleeing no fechamento: resolveTheftLoss → Pokémon p1 removido
    expect(s.roster.find((p) => p.id === 'p1')).toBeUndefined()
    expect(s.theft?.phase).toBe('resolved')
    expect(s.theft?.won).toBe(false)
  })

  it('atFarNode no fechamento do dia vira resolveTheftLoss', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'DAY'
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'p2', status: 'idle' })]
    spawnTheft(s, 0)
    // Forçar fase atFarNode manualmente
    s.theft = { ...s.theft!, phase: 'atFarNode' }

    s.today.missionResults = [{ templateId: 't', success: true, teamIds: ['p1'] }]
    advancePhase(s) // DAY → SUMMARY

    expect(s.roster.find((p) => p.id === 'p1')).toBeUndefined()
    expect(s.theft?.phase).toBe('resolved')
  })

  it('battle no fechamento do dia é resolvida automaticamente', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'DAY'
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [
      makeMon({ id: 'p1', status: 'idle' }),
      makeMon({ id: 'c1', status: 'defending' }),
    ]
    spawnTheft(s, 0)
    // Forçar fase battle com um perseguidor
    s.theft = {
      ...s.theft!,
      phase: 'battle',
      chaserIds: ['c1'],
      chaserArriveAtMs: [0],
      chaserStartAtMs: [0],
      enemies: [{ battle: 1, types: ['normal' as const] }],
    }

    s.today.missionResults = [{ templateId: 't', success: true, teamIds: ['c1'] }]
    advancePhase(s) // DAY → SUMMARY

    // Deve ter resolvido (won ou lost, mas sempre resolved)
    expect(s.theft?.phase).toBe('resolved')
  })

  it('armed no fechamento do dia permanece sem ação extra', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'DAY'
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    // Sem alvo: theft permanece armed
    s.roster = [makeMon({ id: 'p1', status: 'traveling' })] // ninguém elegível

    s.today.missionResults = [{ templateId: 't', success: true, teamIds: [] }]
    advancePhase(s) // DAY → SUMMARY

    // armed sem alvo: sem ação no fechamento
    expect(s.theft?.phase).toBe('armed')
    expect(s.run.phase).toBe('SUMMARY')
  })
})

describe('Task 8 — startNextDay limpa s.theft', () => {
  it('após SUMMARY→próximo dia, s.theft é undefined', () => {
    const s = autoSeedRun(42)
    s.run.phase = 'DAY'
    s.run.theftChance = 100
    rollTheftAtDayOpen(s)
    s.roster = [makeMon({ id: 'p1', status: 'idle' }), makeMon({ id: 'p2', status: 'idle' })]
    spawnTheft(s, 0)
    // Resolver a perda (p1 removido) para poder fechar o dia
    s.theft = { ...s.theft!, phase: 'resolved', won: false, resolved: true }
    // Restaurar p1 ao roster para não travar resolveLeftovers
    s.roster = [makeMon({ id: 'p2', status: 'idle' })]

    // Avançar para SUMMARY
    s.today.missionResults = [{ templateId: 't', success: true, teamIds: ['p2'] }]
    advancePhase(s) // DAY → SUMMARY
    expect(s.run.phase).toBe('SUMMARY')

    // Avançar para próximo dia
    advancePhase(s) // SUMMARY → MORNING dia 2

    expect(s.theft).toBeUndefined()
    expect(s.run.day).toBe(2)
  })
})
