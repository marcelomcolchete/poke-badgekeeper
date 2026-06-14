// XP, level-up, alocação de pontos, criação de Pokémon e evolução (PLAN §4.1/§4.1.1).
// Puro: devolve sempre NOVOS Pokémon. A escolha do atributo no level-up é do jogador
// (modal, via allocatePoint); selvagens nascem com os pontos distribuídos pelo RNG.

import { ATTR_KEYS, type AttrKey, type Attrs, type Pokemon } from '../types/index.ts'
import type { Nature } from '../data/natures.ts'
import { rollNature } from '../data/natures.ts'
import type { Rng } from './rng.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import { rollGender } from './gender.ts'
import { HP_MIN, IV_MAX, IV_MIN, LEVEL_MAX, LEVEL_MIN } from './constants.ts'
import { RARITY_XP_RATE, XP_TO_NEXT_BASE } from './balance.ts'
import { mapAttrs, maxHpOf, recomputeMaxHp, zeroAttrs } from './attributes.ts'
import { clamp } from './math.ts'

/** XP para subir do nível `level` → `level+1`; Infinity no nível máximo (PLAN §4.1). */
export function xpToNext(level: number): number {
  if (level >= LEVEL_MAX) return Infinity
  return XP_TO_NEXT_BASE * level
}

export function totalAllocated(p: Pokemon): number {
  return ATTR_KEYS.reduce((sum, k) => sum + p.allocations[k], 0)
}

/** Pontos de atributo ainda não gastos = (nível − 1) − alocados (PLAN §4.1). */
export function pendingPoints(p: Pokemon): number {
  return p.level - 1 - totalAllocated(p)
}

/** Aloca 1 ponto num eixo (escolha do jogador); recalcula o HP máximo. */
export function allocatePoint(p: Pokemon, key: AttrKey): Pokemon {
  if (pendingPoints(p) <= 0) throw new Error('Sem pontos para alocar')
  const allocations: Attrs = { ...p.allocations, [key]: p.allocations[key] + 1 }
  return recomputeMaxHp({ ...p, allocations })
}

function randomAllocations(rng: Rng, points: number): Attrs {
  const allocations = zeroAttrs()
  for (let i = 0; i < points; i++) {
    const key = rng.pick(ATTR_KEYS)
    allocations[key] += 1
  }
  return allocations
}

/** Variação de encontro: cada eixo recebe um inteiro em [−10, +10] (PLAN §4.1). */
function randomIvs(rng: Rng): Attrs {
  return mapAttrs(() => rng.int(IV_MIN, IV_MAX))
}

export interface NewPokemonSpec {
  id: string
  speciesId: number
  level: number
  rng: Rng
  passives?: string[]
  /** Apelido inicial (raro; a captura renomeia depois via ação própria). */
  nickname?: string | null
  /** Natureza predefinida; omitir para sortear via RNG. */
  nature?: Nature | null
}

/**
 * Cria um Pokémon no nível dado. Os `(nível − 1)` pontos já vêm distribuídos
 * aleatoriamente (regra do selvagem e do inicial > nível 1) — PLAN §4.1.1.
 * Nasce com HP cheio. O sexo é sorteado pela proporção da espécie.
 */
export function createPokemon(spec: NewPokemonSpec): Pokemon {
  const species = getSpecies(spec.speciesId)
  const level = clamp(spec.level, LEVEL_MIN, LEVEL_MAX)
  // Alocações primeiro, gênero e natureza depois: mantém estável a sequência do RNG das alocações.
  const allocations = randomAllocations(spec.rng, level - 1)
  const gender = rollGender(spec.rng, species.id)
  // Se nature for explicitamente fornecida (incluindo null), usa o valor; senão sorteia.
  const nature = 'nature' in spec ? (spec.nature ?? null) : rollNature(spec.rng)
  // IVs por último: mantém estáveis as sequências de alocação/gênero/natureza já existentes.
  const ivs = randomIvs(spec.rng)
  const draft: Pokemon = {
    id: spec.id,
    speciesId: species.id,
    level,
    xp: 0,
    types: [...species.types],
    baseAttrs: { ...species.baseAttrs },
    ivs,
    allocations,
    currentHp: 0,
    maxHp: 0,
    status: 'idle',
    passives: spec.passives ? [...spec.passives] : [],
    gender,
    nickname: spec.nickname ?? null,
    nature,
  }
  const maxHp = maxHpOf(draft)
  return { ...draft, maxHp, currentHp: maxHp }
}

/**
 * Aplica todas as evoluções devidas ao nível atual, em cadeia (PLAN §4.1.1). Quando a
 * espécie tem mais de um alvo (ex.: Eevee), sorteia um deles via `rng`; sem `rng`,
 * usa o primeiro alvo (determinístico — usado em testes/contextos sem aleatoriedade).
 */
export function evolveToLevel(p: Pokemon, rng?: Rng): Pokemon {
  let current = p
  for (;;) {
    const evo = getSpecies(current.speciesId).evolvesTo
    if (!evo || current.level < evo.atLevel) return current
    const toId = rng ? rng.pick(evo.ids) : evo.ids[0]! // ids nunca é vazio (vem de um passo)
    current = evolveInto(current, toId)
  }
}

/** Troca para a forma evoluída preservando nível/XP/alocações e a PROPORÇÃO de HP. */
function evolveInto(p: Pokemon, toId: number): Pokemon {
  const target = getSpecies(toId)
  const ratio = p.maxHp > 0 ? p.currentHp / p.maxHp : 0
  const evolved: Pokemon = {
    ...p,
    speciesId: target.id,
    types: [...target.types],
    baseAttrs: { ...target.baseAttrs },
  }
  const maxHp = maxHpOf(evolved)
  const floor = p.currentHp > 0 ? HP_MIN : 0 // não "ressuscita" nem mata quem estava vivo
  const currentHp = clamp(Math.round(ratio * maxHp), floor, maxHp)
  return { ...evolved, maxHp, currentHp }
}

export interface XpResult {
  pokemon: Pokemon
  levelsGained: number
}

/** XP efetivo após a taxa de raridade: mais raro ganha XP mais devagar (PLAN §4.5). */
export function rarityXpRate(speciesId: number): number {
  return RARITY_XP_RATE[getSpecies(speciesId).rarity]
}

/**
 * Acrescenta XP (escalado pela raridade), sobe de nível enquanto houver limiar (até
 * 10) e aplica evoluções. NÃO aloca os pontos do level-up (ficam pendentes) — PLAN §4.1.
 */
export function addXp(p: Pokemon, amount: number, rng?: Rng): XpResult {
  const gained = Math.max(0, Math.floor(amount * rarityXpRate(p.speciesId)))
  let xp = p.xp + gained
  let level = p.level
  while (level < LEVEL_MAX && xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
  }
  const pokemon = evolveToLevel({ ...p, xp, level }, rng)
  return { pokemon, levelsGained: level - p.level }
}
