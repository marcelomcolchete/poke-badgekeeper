// Modelos de missão (PLAN §4.2 / §4.3). A exigência por eixo (0–100) desenha o hexágono.
// Valores são pontos de partida — afinados na Fase 5 (balanceamento).

import type { Attrs, MissionCategory } from '../types/index.ts'
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

// Conteúdo PROVISÓRIO: cada categoria já tem ao menos um template para o jogo rodar.
// O elenco temático completo por sítio (centro/mart/casa/área livre/museu) entra depois.
export const MISSION_TEMPLATES: MissionTemplate[] = [
  // Área livre (#3 verde) — geralmente mais fáceis.
  {
    id: 'patrol',
    name: 'Patrulha',
    themeIcon: '🛡️',
    category: 'freeArea',
    requirement: req({ batalha: 45, agilidade: 45, resistencia: 45, percepcao: 40 }),
    baseTravelMs: 25 * SEC,
    baseExecutionMs: 35 * SEC,
    danger: 3,
  },
  {
    id: 'investigation',
    name: 'Investigação',
    themeIcon: '🔍',
    category: 'freeArea',
    requirement: req({ percepcao: 75, inteligencia: 60 }),
    baseTravelMs: 25 * SEC,
    baseExecutionMs: 45 * SEC,
    danger: 3,
  },
  {
    id: 'brawl',
    name: 'Confronto',
    themeIcon: '👊',
    category: 'freeArea',
    requirement: req({ batalha: 80, resistencia: 50 }),
    baseTravelMs: 30 * SEC,
    baseExecutionMs: 40 * SEC,
    danger: 5,
  },
  // Casa (#6) — geralmente mais fáceis.
  {
    id: 'negotiation',
    name: 'Negociação',
    themeIcon: '💬',
    category: 'house',
    requirement: req({ carisma: 75, inteligencia: 55 }),
    baseTravelMs: 20 * SEC,
    baseExecutionMs: 50 * SEC,
    danger: 2,
  },
  // Centro Pokémon (#2) — mais difícil; cura o time no sucesso.
  {
    id: 'rescue',
    name: 'Resgate',
    themeIcon: '🆘',
    category: 'center',
    requirement: req({ batalha: 55, resistencia: 70, agilidade: 50 }),
    baseTravelMs: 30 * SEC,
    baseExecutionMs: 45 * SEC,
    danger: 4,
  },
  // Poké Mart (#4) — mais difícil; rende ouro.
  {
    id: 'delivery',
    name: 'Entrega',
    themeIcon: '📦',
    category: 'mart',
    requirement: req({ agilidade: 75, inteligencia: 50 }),
    baseTravelMs: 35 * SEC,
    baseExecutionMs: 30 * SEC,
    danger: 2,
  },
  // Museu (#5) — única na run; concede a passiva Fossil (Pewter).
  {
    id: 'museum-fossil',
    name: 'Escavação no Museu',
    themeIcon: '🦴',
    category: 'museum',
    requirement: req({ inteligencia: 60, percepcao: 60, carisma: 45 }),
    baseTravelMs: 25 * SEC,
    baseExecutionMs: 55 * SEC,
    danger: 3,
    grantsPassive: 'fossil',
  },
]

export function getMissionTemplate(id: string): MissionTemplate {
  const tpl = MISSION_TEMPLATES.find((t) => t.id === id)
  if (!tpl) throw new Error(`Modelo de missão ${id} não encontrado`)
  return tpl
}

/** Templates de uma categoria (para o sorteio do dia). */
export function templatesForCategory(category: MissionCategory): MissionTemplate[] {
  return MISSION_TEMPLATES.filter((t) => t.category === category)
}
