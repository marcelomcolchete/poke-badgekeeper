// Tipos de missão (rebalanceamento). São 6 tipos normais — cada um amarrado a um
// atributo principal — e 3 especiais (Pokecenter/Pokemart/Equipe Rocket). A EXIGÊNCIA por eixo
// não mora aqui: é gerada e gravada na instância no spawn, escalando com o dia (ver
// engine/missions.ts → generateRequirement). O template descreve só o tipo, o perigo,
// o tempo de execução e as recompensas.

import type { MissionCategory } from '../types/index.ts'
import type { MissionTemplate } from './types.ts'

const SEC = 1000

/** 6 tipos normais: tipo de missão ↔ atributo principal (mais exigido). */
export const NORMAL_TEMPLATES: MissionTemplate[] = [
  {
    id: 'patrulha',
    name: 'Patrulha',
    themeIcon: '👮',
    gen: 'normal',
    primaryAttr: 'batalha',
    baseExecutionMs: 40 * SEC,
    danger: 4,
  },
  {
    id: 'palestra',
    name: 'Palestra',
    themeIcon: '🎤',
    gen: 'normal',
    primaryAttr: 'carisma',
    baseExecutionMs: 40 * SEC,
    danger: 3,
  },
  {
    id: 'ensino',
    name: 'Ensino',
    themeIcon: '📚',
    gen: 'normal',
    primaryAttr: 'inteligencia',
    baseExecutionMs: 40 * SEC,
    danger: 3,
  },
  {
    id: 'entrega',
    name: 'Entrega',
    themeIcon: '📦',
    gen: 'normal',
    primaryAttr: 'agilidade',
    baseExecutionMs: 35 * SEC,
    danger: 3,
  },
  {
    id: 'investigacao',
    name: 'Investigação',
    themeIcon: '🔍',
    gen: 'normal',
    primaryAttr: 'percepcao',
    baseExecutionMs: 45 * SEC,
    danger: 3,
  },
  {
    id: 'escolta',
    name: 'Escolta',
    themeIcon: '🛡️',
    gen: 'normal',
    primaryAttr: 'resistencia',
    baseExecutionMs: 40 * SEC,
    danger: 4,
  },
]

/** 3 especiais: amarradas ao sítio (Centro/Mart/Museu) e com recompensa própria. */
export const POKECENTER_TEMPLATE: MissionTemplate = {
  id: 'pokecenter',
  name: 'Pokecenter',
  themeIcon: '➕',
  gen: 'special2',
  baseExecutionMs: 45 * SEC,
  danger: 4,
  healOnSuccess: true,
}

export const POKEMART_TEMPLATE: MissionTemplate = {
  id: 'pokemart',
  name: 'Pokemart',
  themeIcon: '🛒',
  gen: 'special2',
  baseExecutionMs: 40 * SEC,
  danger: 3,
  goldOnSuccess: 150,
}

/**
 * Equipe Rocket: missão EXTRA (fora do agendamento normal) que aparece 2× na run em dias
 * sorteados. A parte de atributos é como o antigo museu (5 principais, um fixo em 70); ao
 * concluir, o time BATALHA contra um treinador Rocket e só então recebe ouro + 3× XP.
 */
export const ROCKET_TEAM_TEMPLATE: MissionTemplate = {
  id: 'rocket',
  name: 'Equipe Rocket',
  themeIcon: 'R',
  gen: 'special5',
  baseExecutionMs: 55 * SEC,
  danger: 3,
  isRocket: true,
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  ...NORMAL_TEMPLATES,
  POKECENTER_TEMPLATE,
  POKEMART_TEMPLATE,
  ROCKET_TEAM_TEMPLATE,
]

export function getMissionTemplate(id: string): MissionTemplate {
  const tpl = MISSION_TEMPLATES.find((t) => t.id === id)
  if (!tpl) throw new Error(`Modelo de missão ${id} não encontrado`)
  return tpl
}

/**
 * Templates candidatos de uma categoria (para o sorteio do dia): áreas verdes e casas
 * geram qualquer um dos 6 tipos normais; cada sítio especial gera o seu.
 */
export function templatesForCategory(category: MissionCategory): MissionTemplate[] {
  switch (category) {
    case 'center':
      return [POKECENTER_TEMPLATE]
    case 'mart':
      return [POKEMART_TEMPLATE]
    case 'rocket':
      return [ROCKET_TEAM_TEMPLATE]
    default:
      // 'freeArea' e 'house' → tipos normais.
      return NORMAL_TEMPLATES
  }
}

/** Aviso de recompensa de uma missão (ícone + texto), ou null se não houver. */
export function missionReward(template: MissionTemplate): { icon: string; label: string } | null {
  if (template.healOnSuccess) return { icon: '💚', label: 'Cura o time no sucesso' }
  if (template.goldOnSuccess) return { icon: '💰', label: `+${template.goldOnSuccess} de ouro no sucesso` }
  if (template.isRocket) return { icon: '⚔️', label: 'Batalha Rocket: ouro + 3× XP na vitória' }
  return null
}
