// Atributo efetivo, soma do time, área/interseção de hexágono e HP derivado (PLAN §4.1/§4.2).
// Tudo puro: recebe Pokémon/Attrs e devolve números ou NOVOS Pokémon (nunca muta).

import { ATTR_KEYS, type AttrKey, type Attrs, type Pokemon } from '../types/index.ts'
import {
  ATTR_MAX,
  ATTR_MIN,
  ATTR_PER_POINT,
  HP_MAX,
  HP_MIN,
} from './constants.ts'
import { clamp } from './math.ts'

/** Constante geométrica do radar de 6 eixos a 60° (PLAN §4.2). */
const SIN_60 = Math.sin(Math.PI / 3)
/** Resistência por ponto de HP: 100/10 = 10 (PLAN §4.1). */
const RESISTANCE_PER_HP = ATTR_MAX / HP_MAX

/** Constrói um Attrs aplicando `fn` a cada eixo canônico (sem `any`, todos os 6 presentes). */
export function mapAttrs(fn: (key: AttrKey) => number): Attrs {
  return {
    batalha: fn('batalha'),
    inteligencia: fn('inteligencia'),
    carisma: fn('carisma'),
    agilidade: fn('agilidade'),
    resistencia: fn('resistencia'),
    percepcao: fn('percepcao'),
  }
}

export function zeroAttrs(): Attrs {
  return mapAttrs(() => 0)
}

/** Atributo efetivo = clamp(base + alocação·10, 10, 100) — PLAN §4.1. */
export function effectiveAttr(p: Pokemon, key: AttrKey): number {
  return clamp(p.baseAttrs[key] + p.allocations[key] * ATTR_PER_POINT, ATTR_MIN, ATTR_MAX)
}

export function effectiveAttrs(p: Pokemon): Attrs {
  return mapAttrs((k) => effectiveAttr(p, k))
}

/** Soma do time num eixo, capada em 100 — o máximo da missão (PLAN §4.2). */
export function teamAxisSum(team: readonly Pokemon[], key: AttrKey): number {
  const total = team.reduce((sum, p) => sum + effectiveAttr(p, key), 0)
  return Math.min(total, ATTR_MAX)
}

export function teamSum(team: readonly Pokemon[]): Attrs {
  return mapAttrs((k) => teamAxisSum(team, k))
}

/** Área do hexágono radar: 0.5·sin60·Σ rᵢ·r₍ᵢ₊₁ mod 6₎ (PLAN §4.2). */
export function hexagonArea(attrs: Attrs): number {
  const r = ATTR_KEYS.map((k) => attrs[k])
  let cross = 0
  for (let i = 0; i < r.length; i++) {
    cross += (r[i] as number) * (r[(i + 1) % r.length] as number)
  }
  return 0.5 * SIN_60 * cross
}

/** Interseção por eixo: min(a, b) em cada eixo (PLAN §4.2). */
export function axisMin(a: Attrs, b: Attrs): Attrs {
  return mapAttrs((k) => Math.min(a[k], b[k]))
}

/** HP inteiro 1–10 derivado da Resistência: clamp(round(res/10), 1, 10) — PLAN §4.1. */
export function hpFromResistance(resistencia: number): number {
  return clamp(Math.round(resistencia / RESISTANCE_PER_HP), HP_MIN, HP_MAX)
}

/** HP máximo de um Pokémon a partir da Resistência efetiva. */
export function maxHpOf(p: Pokemon): number {
  return hpFromResistance(effectiveAttr(p, 'resistencia'))
}

export function isFainted(p: Pokemon): boolean {
  return p.currentHp <= 0
}

/** Recalcula o HP máximo (após alocação/evolução) e reclampa o HP atual. */
export function recomputeMaxHp(p: Pokemon): Pokemon {
  const maxHp = maxHpOf(p)
  return { ...p, maxHp, currentHp: Math.min(p.currentHp, maxHp) }
}

/** Aplica dano inteiro; desmaia (status fainted) se o HP chegar a 0 — PLAN §4.2/§4.4. */
export function applyDamage(p: Pokemon, amount: number): Pokemon {
  const currentHp = clamp(p.currentHp - amount, 0, p.maxHp)
  return { ...p, currentHp, status: currentHp <= 0 ? 'fainted' : p.status }
}

/** Cura HP (itens), sem ultrapassar o máximo nem reviver (HP 0 continua desmaiado). */
export function heal(p: Pokemon, amount: number): Pokemon {
  return { ...p, currentHp: clamp(p.currentHp + amount, 0, p.maxHp) }
}
