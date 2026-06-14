// Naturezas dos Pokémon — 25 no total: 1 neutra (Bashful) + 24 não-neutras.
// As 24 não-neutras distribuem exatamente 4 boosted e 4 reduced por eixo.
// O eixo `carisma` foi integrado com base no perfil de personalidade de cada natureza.

import type { AttrKey } from '../types/index.ts'
import type { Rng } from '../engine/rng.ts'

export const NATURE_KEYS = [
  'bashful',
  'lonely',
  'brave',
  'adamant',
  'serious',
  'bold',
  'relaxed',
  'lax',
  'quirky',
  'timid',
  'hasty',
  'naive',
  'docile',
  'modest',
  'mild',
  'quiet',
  'rash',
  'calm',
  'gentle',
  'careful',
  'hardy',
  'naughty',
  'impish',
  'jolly',
  'sassy',
] as const

export type Nature = (typeof NATURE_KEYS)[number]

export interface NatureEntry {
  /** Eixo favorecido (+15 por ponto alocado em vez de +10). null = natureza neutra. */
  boosted: AttrKey | null
  /** Eixo penalizado (+5 por ponto alocado em vez de +10). null = natureza neutra. */
  reduced: AttrKey | null
}

/**
 * Tabela das 25 naturezas.
 *
 * Distribuição por eixo (4 boosted + 4 reduced cada):
 *   batalha    boosted: lonely, brave, adamant, serious
 *              reduced: bold, mild, calm, docile
 *   resistencia boosted: bold, relaxed, lax, quirky
 *              reduced: naughty, hasty, gentle, serious
 *   inteligencia boosted: modest, mild, quiet, rash
 *              reduced: adamant, jolly, careful, quirky
 *   agilidade  boosted: timid, hasty, naive, docile
 *              reduced: quiet, rash, sassy, hardy
 *   percepcao  boosted: calm, gentle, careful, hardy
 *              reduced: brave, impish, lax, naive
 *   carisma    boosted: naughty, impish, jolly, sassy
 *              reduced: lonely, relaxed, timid, modest
 */
export const NATURES: Record<Nature, NatureEntry> = {
  // ── Neutra ──────────────────────────────────────────────────────────────────
  bashful:  { boosted: null,            reduced: null            },

  // ── +batalha ────────────────────────────────────────────────────────────────
  lonely:   { boosted: 'batalha',       reduced: 'carisma'       }, // guerreira solitária
  brave:    { boosted: 'batalha',       reduced: 'percepcao'     }, // corajosa e impulsiva
  adamant:  { boosted: 'batalha',       reduced: 'inteligencia'  }, // obstinada, força bruta
  serious:  { boosted: 'batalha',       reduced: 'resistencia'   }, // disciplinada no ataque, tensa

  // ── +resistencia ────────────────────────────────────────────────────────────
  bold:     { boosted: 'resistencia',   reduced: 'batalha'       }, // ousada e imponente
  relaxed:  { boosted: 'resistencia',   reduced: 'carisma'       }, // robusta mas apática
  lax:      { boosted: 'resistencia',   reduced: 'percepcao'     }, // desleixada, aguenta por inércia
  quirky:   { boosted: 'resistencia',   reduced: 'inteligencia'  }, // imprevisível, opera no instinto

  // ── +agilidade ──────────────────────────────────────────────────────────────
  timid:    { boosted: 'agilidade',     reduced: 'carisma'       }, // tímida, veloz por instinto de fuga
  hasty:    { boosted: 'agilidade',     reduced: 'resistencia'   }, // apressada, guarda aberta
  naive:    { boosted: 'agilidade',     reduced: 'percepcao'     }, // ingênua, fácil de enganar
  docile:   { boosted: 'agilidade',     reduced: 'batalha'       }, // dócil e ágil, sem garra

  // ── +inteligencia ───────────────────────────────────────────────────────────
  modest:   { boosted: 'inteligencia',  reduced: 'carisma'       }, // modesta e reservada
  mild:     { boosted: 'inteligencia',  reduced: 'batalha'       }, // gentil e pacífica
  quiet:    { boosted: 'inteligencia',  reduced: 'agilidade'     }, // quieta e contemplativa
  rash:     { boosted: 'inteligencia',  reduced: 'agilidade'     }, // impulsiva e brilhante

  // ── +percepcao ──────────────────────────────────────────────────────────────
  calm:     { boosted: 'percepcao',     reduced: 'batalha'       }, // serena e observadora
  gentle:   { boosted: 'percepcao',     reduced: 'resistencia'   }, // gentil e empática, vulnerável
  careful:  { boosted: 'percepcao',     reduced: 'inteligencia'  }, // cuidadosa e intuitiva
  hardy:    { boosted: 'percepcao',     reduced: 'agilidade'     }, // observador paciente e pesado

  // ── +carisma ────────────────────────────────────────────────────────────────
  naughty:  { boosted: 'carisma',       reduced: 'resistencia'   }, // travessa e irreverente
  impish:   { boosted: 'carisma',       reduced: 'percepcao'     }, // maliciosa e sedutora
  jolly:    { boosted: 'carisma',       reduced: 'inteligencia'  }, // alegre e popular
  sassy:    { boosted: 'carisma',       reduced: 'agilidade'     }, // atrevida e exibicionista
}

/** Retorna a entrada de uma natureza. */
export function getNatureEntry(nature: Nature): NatureEntry {
  return NATURES[nature]
}

/** Sorteia uma natureza aleatória uniformemente entre as 25. */
export function rollNature(rng: Rng): Nature {
  return rng.pick(NATURE_KEYS)
}

/** Nomes das naturezas em português (mantém o nome original — são nomes próprios). */
export const NATURE_LABEL_PT: Record<Nature, string> = {
  bashful:  'Bashful',
  lonely:   'Lonely',
  brave:    'Brave',
  adamant:  'Adamant',
  serious:  'Serious',
  bold:     'Bold',
  relaxed:  'Relaxed',
  lax:      'Lax',
  quirky:   'Quirky',
  timid:    'Timid',
  hasty:    'Hasty',
  naive:    'Naive',
  docile:   'Docile',
  modest:   'Modest',
  mild:     'Mild',
  quiet:    'Quiet',
  rash:     'Rash',
  calm:     'Calm',
  gentle:   'Gentle',
  careful:  'Careful',
  hardy:    'Hardy',
  naughty:  'Naughty',
  impish:   'Impish',
  jolly:    'Jolly',
  sassy:    'Sassy',
}
