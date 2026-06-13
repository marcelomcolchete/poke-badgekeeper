// Modelos de missão (PLAN §4.2 / §4.3). A exigência por eixo (0–100) desenha o hexágono.
// Valores são pontos de partida — afinados na Fase 5 (balanceamento).

import type { Attrs } from '../types/index.ts'
import type { MissionTemplate } from './types.ts'

const SEC = 1000

function req(partial: Partial<Attrs>): Attrs {
  return {
    batalha: partial.batalha ?? 20,
    inteligencia: partial.inteligencia ?? 20,
    carisma: partial.carisma ?? 20,
    agilidade: partial.agilidade ?? 20,
    resistencia: partial.resistencia ?? 20,
    percepcao: partial.percepcao ?? 20,
  }
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'patrol',
    name: 'Patrulha',
    themeIcon: '🛡️',
    requirement: req({ batalha: 45, agilidade: 45, resistencia: 45, percepcao: 40 }),
    baseTravelMs: 25 * SEC,
    baseExecutionMs: 35 * SEC,
    danger: 3,
  },
  {
    id: 'rescue',
    name: 'Resgate',
    themeIcon: '🆘',
    requirement: req({ batalha: 55, resistencia: 70, agilidade: 50 }),
    baseTravelMs: 30 * SEC,
    baseExecutionMs: 45 * SEC,
    danger: 4,
  },
  {
    id: 'delivery',
    name: 'Entrega',
    themeIcon: '📦',
    requirement: req({ agilidade: 75, inteligencia: 50 }),
    baseTravelMs: 35 * SEC,
    baseExecutionMs: 30 * SEC,
    danger: 2,
  },
  {
    id: 'negotiation',
    name: 'Negociação',
    themeIcon: '💬',
    requirement: req({ carisma: 75, inteligencia: 55 }),
    baseTravelMs: 20 * SEC,
    baseExecutionMs: 50 * SEC,
    danger: 2,
  },
  {
    id: 'investigation',
    name: 'Investigação',
    themeIcon: '🔍',
    requirement: req({ percepcao: 75, inteligencia: 60 }),
    baseTravelMs: 25 * SEC,
    baseExecutionMs: 45 * SEC,
    danger: 3,
  },
  {
    id: 'brawl',
    name: 'Confronto',
    themeIcon: '👊',
    requirement: req({ batalha: 80, resistencia: 50 }),
    baseTravelMs: 30 * SEC,
    baseExecutionMs: 40 * SEC,
    danger: 5,
  },
]

export function getMissionTemplate(id: string): MissionTemplate {
  const tpl = MISSION_TEMPLATES.find((t) => t.id === id)
  if (!tpl) throw new Error(`Modelo de missão ${id} não encontrado`)
  return tpl
}
