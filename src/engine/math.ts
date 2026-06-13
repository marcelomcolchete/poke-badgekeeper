// Utilitários numéricos puros, compartilhados pela engine (PLAN §5).
// Sem estado, sem RNG: apenas funções matemáticas determinísticas.

/** Limita `value` ao intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/** Interpolação linear: a→b conforme t (esperado em [0, 1], mas não forçado). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Média aritmética; 0 para lista vazia (evita NaN nas fórmulas de tempo/ouro). */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Arredonda para o múltiplo de `step` mais próximo (ex.: passos de 0,5 nas estrelas). */
export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step
}
