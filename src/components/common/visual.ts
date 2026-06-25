// Rótulos em PT e cor por tipo para a UI (PLAN §2.1). As cores canônicas dos 15
// tipos vivem como variáveis CSS (--type-*) em styles/theme.css.

import type { AttrKey, PokemonStatus, PokemonType, Rarity } from '../../types/index.ts'
import type { Rank } from '../../engine/ranking.ts'
import { ATTR_PER_POINT } from '../../engine/constants.ts'

/** Faixa de alerta do ganho REAL de 1 ponto na distribuição de atributos. */
export type GainTier = 'danger' | 'warn' | 'boost' | 'normal'

/**
 * Realce do ganho real de 1 ponto: vermelho (≤5, rende pouco — pense se vale), amarelo (<10,
 * aparado pelo teto), azul (>10, favorecido pela natureza), neutro (=10).
 */
export function gainTier(gain: number): GainTier {
  if (gain <= 5) return 'danger'
  if (gain < ATTR_PER_POINT) return 'warn'
  if (gain > ATTR_PER_POINT) return 'boost'
  return 'normal'
}

/** Rótulo em PT do que o Pokémon está fazendo agora (HUD/painel do time). */
export const STATUS_LABEL_PT: Record<PokemonStatus, string> = {
  idle: 'Pronto',
  traveling: 'A caminho',
  onMission: 'Em missão',
  defending: 'Defendendo',
  returning: 'Voltando',
  fainted: 'Desmaiado',
  atCenter: 'No Centro',
  stolen: 'Roubado', // Feature B
}

/** Cor do "led" de status (verde = livre, amarelo = ocupado, vermelho = indisponível). */
export const STATUS_COLOR: Record<PokemonStatus, string> = {
  idle: '#6fcf3f',
  traveling: '#f0c020',
  onMission: '#f0c020',
  defending: '#e0683c',
  returning: '#57a6dc',
  fainted: '#e84040',
  atCenter: '#a05fd0',
  stolen: '#c0392b', // Feature B
}

export const TYPE_LABEL_PT: Record<PokemonType, string> = {
  normal: 'Normal',
  fire: 'Fogo',
  water: 'Água',
  electric: 'Elétrico',
  grass: 'Grama',
  ice: 'Gelo',
  fighting: 'Lutador',
  poison: 'Veneno',
  ground: 'Terra',
  flying: 'Voador',
  psychic: 'Psíquico',
  bug: 'Inseto',
  rock: 'Pedra',
  ghost: 'Fantasma',
  dragon: 'Dragão',
  steel: 'Aço',
}

export const ATTR_LABEL_PT: Record<AttrKey, string> = {
  batalha: 'Batalha',
  inteligencia: 'Inteligência',
  carisma: 'Carisma',
  agilidade: 'Agilidade',
  resistencia: 'Resistência',
  percepcao: 'Percepção',
}

export const ATTR_SHORT_PT: Record<AttrKey, string> = {
  batalha: 'BTL',
  inteligencia: 'INT',
  carisma: 'CAR',
  agilidade: 'AGI',
  resistencia: 'RES',
  percepcao: 'PER',
}

export function typeColorVar(type: PokemonType): string {
  return `var(--type-${type})`
}

export const RARITY_LABEL_PT: Record<Rarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legend: 'Lendário',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa0b5',
  uncommon: '#5fbf6f',
  rare: '#4f86d6',
  epic: '#a05fd0',
  legend: '#e0a020',
}

/** Tier de medalha do invasor → nível numérico das tabelas de medalha (Bronze/Prata/Ouro). */
export const MEDAL_TIER_RANK = { bronze: 1, silver: 2, gold: 3 } as const

/** Medalha (emoji) por tier de medalha de invasor: 1 Bronze, 2 Prata, 3 Ouro. */
export const SECRET_MEDAL: Record<number, string> = { 1: '🥉', 2: '🥈', 3: '🥇' }

/**
 * Medalha da Habilidade Secreta por NÍVEL do indivíduo (1 = Prata, 2 = Ouro). Uma medalha por
 * habilidade ativa; bronze não aparece em habilidades secretas (só no sistema de invasores).
 */
export const SECRET_LEVEL_MEDAL: Record<1 | 2, string> = { 1: '🥈', 2: '🥇' }

/** Rótulo do nível da medalha da Habilidade Secreta (acessibilidade / tooltip). */
export const SECRET_LEVEL_LABEL: Record<1 | 2, string> = { 1: 'Prata', 2: 'Ouro' }

/** Cor de acento por nível da Habilidade Secreta (Prata/Ouro) — uso em bordas/medalhas. */
export const SECRET_LEVEL_COLOR: Record<1 | 2, string> = { 1: '#c7ced8', 2: '#e8b923' }

/** Tom legível como TEXTO sobre fundo claro (creme) por nível (Prata/Ouro). */
export const SECRET_LEVEL_INK: Record<1 | 2, string> = { 1: '#7c8794', 2: '#b08808' }

/** Rótulo do nível da medalha (acessibilidade / tooltip). */
export const SECRET_TIER_LABEL: Record<number, string> = { 1: 'Bronze', 2: 'Prata', 3: 'Ouro' }

/** Cor de acento por nível da Habilidade Secreta (Bronze/Prata/Ouro) — uso em bordas/medalhas. */
export const SECRET_MEDAL_COLOR: Record<number, string> = {
  1: '#c97b3a',
  2: '#c7ced8',
  3: '#e8b923',
}

/**
 * Tom de medalha legível como TEXTO sobre fundo claro (creme). As cores vivas de SECRET_MEDAL_COLOR
 * (sobretudo a prata) somem no creme; estes tons mais escuros mantêm bronze/prata/ouro reconhecíveis.
 */
export const SECRET_MEDAL_INK: Record<number, string> = {
  1: '#b06a2e',
  2: '#7c8794',
  3: '#b08808',
}

/** Cor do badge de ranking (F frio/cinza → S dourado). */
export const RANK_COLOR: Record<Rank, string> = {
  F: '#8a8f9c',
  E: '#5fbf6f',
  D: '#3fae9a',
  C: '#4f86d6',
  B: '#a05fd0',
  A: '#e0683c',
  S: '#e0a020',
}
