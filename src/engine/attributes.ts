// Atributo efetivo, soma do time, área/interseção de hexágono e HP derivado (PLAN §4.1/§4.2).
// Tudo puro: recebe Pokémon/Attrs e devolve números ou NOVOS Pokémon (nunca muta).

import { ATTR_KEYS, type AttrKey, type Attrs, type Pokemon } from '../types/index.ts'
import type { Nature } from '../data/natures.ts'
import { NATURES } from '../data/natures.ts'
import {
  ATTR_EFFECTIVE_MIN,
  ATTR_MAX,
  ATTR_PER_POINT,
  HP_MAX,
  HP_MIN,
  NATURE_BOOSTED_PER_POINT,
  NATURE_REDUCED_PER_POINT,
  RESISTANCE_PER_HP,
  TEAM_ATTR_MAX,
} from './constants.ts'
import { clamp } from './math.ts'

/** Constante geométrica do radar de 6 eixos a 60° (PLAN §4.2). */
const SIN_60 = Math.sin(Math.PI / 3)

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

/** Multiplicador de pontos por natureza: 15 (favorecido), 5 (penalizado) ou 10 (neutro). */
function natureBonusPerPoint(nature: Nature | null, key: AttrKey): number {
  if (!nature) return ATTR_PER_POINT
  const entry = NATURES[nature]
  if (entry.boosted === key) return NATURE_BOOSTED_PER_POINT
  if (entry.reduced === key) return NATURE_REDUCED_PER_POINT
  return ATTR_PER_POINT
}

/**
 * Quanto cada ponto alocado nesse eixo rende para ESTE Pokémon: 15 (favorecido pela
 * natureza), 5 (penalizado) ou 10 (neutro). Exposto para a UI do level-up mostrar o
 * incremento real (+5/+10/+15) em vez do +10 fixo.
 */
export function perPointGain(p: Pokemon, key: AttrKey): number {
  return natureBonusPerPoint(p.nature, key)
}

/** Atributo efetivo = clamp(base + iv + alocação·modificador, 0, 60) — PLAN §4.1. */
export function effectiveAttr(p: Pokemon, key: AttrKey): number {
  const perPoint = natureBonusPerPoint(p.nature, key)
  const iv = p.ivs?.[key] ?? 0
  return clamp(p.baseAttrs[key] + iv + p.allocations[key] * perPoint, ATTR_EFFECTIVE_MIN, ATTR_MAX)
}

export function effectiveAttrs(p: Pokemon): Attrs {
  return mapAttrs((k) => effectiveAttr(p, k))
}

/**
 * Soma do time num eixo, capada em TEAM_ATTR_MAX (70) — o máximo da missão (PLAN §4.2).
 * Como cada Pokémon vai no máx. 60, só com 2+ Pokémon dá pra chegar a 70 num eixo.
 */
export function teamAxisSum(team: readonly Pokemon[], key: AttrKey): number {
  const total = team.reduce((sum, p) => sum + effectiveAttr(p, key), 0)
  return Math.min(total, TEAM_ATTR_MAX)
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

/**
 * HP inteiro derivado da Resistência: 1 de vida a cada 10 pontos — clamp(floor(res/10),
 * 1, 10). A faixa 0–10 também rende 1 (o piso do clamp). Ex.: 20→2, 35→3, 60→6 (PLAN §4.1).
 */
export function hpFromResistance(resistencia: number): number {
  return clamp(Math.floor(resistencia / RESISTANCE_PER_HP), HP_MIN, HP_MAX)
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
