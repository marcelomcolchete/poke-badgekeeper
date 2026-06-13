// Rótulos em PT e cor por tipo para a UI (PLAN §2.1). As cores canônicas dos 15
// tipos vivem como variáveis CSS (--type-*) em styles/theme.css.

import type { AttrKey, PokemonType } from '../../types/index.ts'

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
