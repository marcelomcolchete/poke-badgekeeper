// Tabela de efetividade da Gen 1 (PLAN §4.4). Apenas entradas != 1× são listadas.
// Multiplicador do ATACANTE contra o DEFENSOR. Inclui os quirks da Gen 1
// (ex.: Ghost não afeta Psychic; Bug 2× contra Poison; Ice 0.5× contra Fire).

import type { PokemonType } from '../types/index.ts'

type Chart = Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>>

const TYPE_CHART: Chart = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    steel: 2,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, bug: 2, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 2,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    steel: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 0, ghost: 2 },
  dragon: { dragon: 2, steel: 0.5 },
  // Aço (não-Gen 1) — matchups modernos: forte vs gelo/pedra, fraco vs fogo/água/elétrico/aço.
  steel: { ice: 2, rock: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
}

/** Multiplicador de um tipo atacante contra UM tipo defensor (1 se neutro). */
export function singleTypeMultiplier(attacker: PokemonType, defender: PokemonType): number {
  return TYPE_CHART[attacker]?.[defender] ?? 1
}

/**
 * Multiplicador CANÔNICO (×2/×0.5/0) de um atacante contra defensor de 1–2 tipos
 * (produto dos eixos). Nota: a regra do jogo aplica ×1,5 por vantagem e ×0,5 por
 * desvantagem (PLAN §4.4); essa tradução fica na engine de defesa (Fase 2), que usa
 * estes valores apenas para saber QUAIS matchups são vantagem/desvantagem/imunidade.
 */
export function typeMultiplier(
  attacker: PokemonType,
  defenderTypes: readonly PokemonType[],
): number {
  return defenderTypes.reduce((acc, d) => acc * singleTypeMultiplier(attacker, d), 1)
}

export { TYPE_CHART }
