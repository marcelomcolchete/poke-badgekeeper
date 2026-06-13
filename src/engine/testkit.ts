// Fábricas para os testes da engine. NÃO faz parte do bundle de produção
// (nenhum módulo da app a importa); existe só para montar Pokémon/Attrs nos *.test.ts.

import type { Attrs, Pokemon } from '../types/index.ts'
import type { Rng } from './rng.ts'
import { maxHpOf, zeroAttrs } from './attributes.ts'

/**
 * Rng-stub determinístico: `bool(p)` devolve `sample < p`. Use sample=0 para forçar
 * sucesso (qualquer P>0) e sample≈1 para forçar falha. `pick` sempre pega o 1º item.
 */
export function fixedRng(sample: number): Rng {
  return {
    next: () => sample,
    int: (min) => min,
    float: () => sample,
    bool: (p = 0.5) => sample < p,
    pick: <T>(items: readonly T[]): T => items[0] as T,
    shuffle: <T>(items: readonly T[]): T[] => [...items],
    state: () => 0,
  }
}

/** Attrs com um valor de preenchimento e overrides por eixo. */
export function makeAttrs(overrides: Partial<Attrs> = {}, fill = 20): Attrs {
  return {
    batalha: overrides.batalha ?? fill,
    inteligencia: overrides.inteligencia ?? fill,
    carisma: overrides.carisma ?? fill,
    agilidade: overrides.agilidade ?? fill,
    resistencia: overrides.resistencia ?? fill,
    percepcao: overrides.percepcao ?? fill,
  }
}

/** Pokémon de teste com defaults sãos; HP derivado se não for informado. */
export function makeMon(overrides: Partial<Pokemon> = {}): Pokemon {
  const draft: Pokemon = {
    id: overrides.id ?? 'p1',
    speciesId: overrides.speciesId ?? 1,
    level: overrides.level ?? 1,
    xp: overrides.xp ?? 0,
    types: overrides.types ?? ['normal'],
    baseAttrs: overrides.baseAttrs ?? makeAttrs(),
    allocations: overrides.allocations ?? zeroAttrs(),
    currentHp: 0,
    maxHp: 0,
    status: overrides.status ?? 'idle',
    passives: overrides.passives ?? [],
    gender: overrides.gender ?? 'genderless',
    nickname: overrides.nickname ?? null,
  }
  const maxHp = overrides.maxHp ?? maxHpOf(draft)
  const currentHp = overrides.currentHp ?? maxHp
  return { ...draft, maxHp, currentHp }
}
