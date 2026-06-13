// RNG semeado e determinístico (PLAN §5) — base da reprodutibilidade do save.
// Implementação: mulberry32 (PRNG de 32 bits, rápido e estável).
// NUNCA usar Math.random()/Date.now() na engine — sempre passar por um Rng.

export interface Rng {
  /** Próximo float em [0, 1). */
  next(): number
  /** Inteiro em [minInclusive, maxInclusive]. */
  int(minInclusive: number, maxInclusive: number): number
  /** Float em [min, max). */
  float(min: number, max: number): number
  /** Verdadeiro com a probabilidade dada (padrão 0.5). */
  bool(probability?: number): boolean
  /** Escolhe um item de uma lista não-vazia. */
  pick<T>(items: readonly T[]): T
  /** Nova lista embaralhada (Fisher–Yates); não muta a entrada. */
  shuffle<T>(items: readonly T[]): T[]
  /** Estado interno atual (para snapshot/inspeção). */
  state(): number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (minInclusive: number, maxInclusive: number): number => {
    if (maxInclusive < minInclusive) {
      throw new Error(`int(${minInclusive}, ${maxInclusive}): intervalo inválido`)
    }
    const span = maxInclusive - minInclusive + 1
    return minInclusive + Math.floor(next() * span)
  }

  const float = (min: number, max: number): number => min + next() * (max - min)

  const bool = (probability = 0.5): boolean => next() < probability

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('pick(): lista vazia')
    return items[int(0, items.length - 1)] as T
  }

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i)
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }

  return { next, int, float, bool, pick, shuffle, state: () => a >>> 0 }
}

/** Hash determinístico de string → seed de 32 bits (xfnv1a). */
export function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Combina partes numéricas num sub-seed estável (ex.: seed da run + nº do dia). */
export function deriveSeed(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const p of parts) {
    h ^= p | 0
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
