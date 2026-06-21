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

/** Componente RGB em hex de 2 dígitos. */
function hex2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
}

/** Rampa de 5 paradas: azul → verde → amarelo → laranja → vermelho. */
const THEFT_RAMP: readonly (readonly [number, number, number])[] = [
  [59, 130, 246], // azul    #3b82f6
  [46, 193, 106], // verde   #2ec16a
  [242, 198, 60], // amarelo #f2c63c
  [239, 140, 52], // laranja #ef8c34
  [226, 59, 59], // vermelho #e23b3b
]

/** Cor da rampa em t∈[0,1] (interpola entre as paradas adjacentes). */
function rampColor(t: number): [number, number, number] {
  const ct = clamp(t, 0, 1)
  const segs = THEFT_RAMP.length - 1
  const scaled = ct * segs
  const i = Math.min(Math.floor(scaled), segs - 1)
  const f = scaled - i
  const a = THEFT_RAMP[i]!
  const b = THEFT_RAMP[i + 1]!
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]
}

/** Tinta legível (escura/clara) pela luminância relativa da cor de fundo. */
function inkFor(r: number, g: number, b: number): string {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1a1a1a' : '#ffffff'
}

/**
 * Rótulo + cor + tinta da chance de roubo (B9): palavra por bucket e cor que percorre a rampa
 * azul→vermelho por (percent-1)/99. A tinta acompanha a luminância para o chip ficar legível.
 */
export function theftChanceLabel(percent: number): { label: string; color: string; ink: string } {
  const p = clamp(percent, 0, 100)
  const bucket = THEFT_LABEL_BUCKETS.find((b) => p <= b.upTo) ?? THEFT_LABEL_BUCKETS[THEFT_LABEL_BUCKETS.length - 1]!
  const t = p <= 1 ? 0 : p >= 100 ? 1 : (p - 1) / 99
  const [r, g, b] = rampColor(t)
  return { label: bucket.label, color: `#${hex2(r)}${hex2(g)}${hex2(b)}`, ink: inkFor(r, g, b) }
}
