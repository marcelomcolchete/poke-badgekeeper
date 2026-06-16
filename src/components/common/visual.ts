// Rótulos em PT e cor por tipo para a UI (PLAN §2.1). As cores canônicas dos 15
// tipos vivem como variáveis CSS (--type-*) em styles/theme.css.

import type { AttrKey, PokemonStatus, PokemonType, Rarity } from '../../types/index.ts'
import type { Rank } from '../../engine/ranking.ts'

/** Rótulo em PT do que o Pokémon está fazendo agora (HUD/painel do time). */
export const STATUS_LABEL_PT: Record<PokemonStatus, string> = {
  idle: 'Pronto',
  traveling: 'A caminho',
  onMission: 'Em missão',
  defending: 'Defendendo',
  returning: 'Voltando',
  fainted: 'Desmaiado',
  atCenter: 'No Centro',
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

/** Medalha (emoji) por nível da Habilidade Secreta: 1 Bronze, 2 Prata, 3 Ouro. */
export const SECRET_MEDAL: Record<number, string> = { 1: '🥉', 2: '🥈', 3: '🥇' }

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
