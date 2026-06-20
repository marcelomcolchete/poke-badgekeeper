// Núcleo PURO do Evento de Roubo Rocket (Feature B): progressão da chance, tempo de fuga e o
// rótulo/cor da previsão. Sem RNG e sem React — funções determinísticas reusadas pelo fluxo do
// dia (game/theftFlow.ts) e pela UI (previsão). A orquestração (alvo/spawn/tick) vive em theftFlow.

import { THEFT_CHANCE_MAX } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import { makeFleeTeam } from './theftInternal.ts'
import { clamp, lerp } from './math.ts'

/** Próxima chance de roubo (%): dobra a corrente, saturando em THEFT_CHANCE_MAX. */
export function rollNextTheftChance(current: number): number {
  return Math.min(THEFT_CHANCE_MAX, Math.max(1, Math.round(current)) * 2)
}

/**
 * Tempo (ms de jogo) da Rocket percorrer `distance` (distância de caminho do ginásio ao nó final):
 * usa a MESMA curva de viagem de um Pokémon com THEFT_FLEE_AGILITY de agilidade, sozinho e sem
 * habilidades/itens — então a fuga reaproveita exatamente o tuning de velocidade das missões.
 */
export function theftFleeMs(distance: number): number {
  if (distance <= 0) return 0
  return graphTravelMs(distance, makeFleeTeam(), 1)
}

/** Buckets do rótulo "Chance de Rocket" (B9): limite superior (≤) → palavra. */
const THEFT_LABEL_BUCKETS: readonly { upTo: number; label: string }[] = [
  { upTo: 4, label: 'Muito Improvável' },
  { upTo: 8, label: 'Improvável' },
  { upTo: 16, label: 'Possível' },
  { upTo: 32, label: 'Provável' },
  { upTo: 64, label: 'Muito Provável' },
  { upTo: 100, label: 'Inevitável' },
]

/** Componente RGB interpolado verde→vermelho por t∈[0,1], em hex de 2 dígitos. */
function hex2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
}

/**
 * Rótulo + cor da chance de roubo (B9): palavra por bucket (sequência 1→2→4→…→100) e cor que
 * interpola do verde (#2ec16a, perigo baixo) ao vermelho (#e23b3b, perigo máximo) por percent/100.
 */
export function theftChanceLabel(percent: number): { label: string; color: string } {
  const p = clamp(percent, 0, 100)
  const bucket = THEFT_LABEL_BUCKETS.find((b) => p <= b.upTo) ?? THEFT_LABEL_BUCKETS[THEFT_LABEL_BUCKETS.length - 1]!
  // t = 0 no piso (1%) → verde puro #2ec16a; t = 1 no teto (100%) → vermelho puro #e23b3b.
  const t = p <= 1 ? 0 : p >= 100 ? 1 : (p - 1) / 99
  // verde (46,193,106) → vermelho (226,59,59)
  const r = lerp(46, 226, t)
  const g = lerp(193, 59, t)
  const b = lerp(106, 59, t)
  return { label: bucket.label, color: `#${hex2(r)}${hex2(g)}${hex2(b)}` }
}
