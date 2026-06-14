/**
 * Exporta uma planilha (CSV) com todas as espécies e seus atributos de jogo,
 * para balanceamento manual. Reimportável depois por um script de volta.
 *
 * Uso: node --experimental-strip-types scripts/exportPokemonCsv.ts
 * Gera: scripts/out/pokemon-balance.csv
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPECIES_BASE } from '../src/data/pokemon/species.generated.ts'
import { EVOLUTIONS } from '../src/data/pokemon/evolutions.generated.ts'
import { GENDER_RATE } from '../src/data/pokemon/genders.generated.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// id -> próxima forma e nível de evolução
const evolvesTo = new Map<number, { id: number; atLevel: number }>()
const minWildLevel = new Map<number, number>()
for (const step of EVOLUTIONS) {
  evolvesTo.set(step.from, { id: step.to, atLevel: step.atLevel })
  minWildLevel.set(step.to, step.atLevel)
}

const HEADERS = [
  'id',
  'name',
  'displayName',
  'type1',
  'type2',
  'rarity',
  'batalha',
  'inteligencia',
  'carisma',
  'agilidade',
  'resistencia',
  'percepcao',
  'total',
  'gender_rate', // oitavos-fêmea da PokéAPI: 0=100% macho, 8=100% fêmea, -1=sem gênero
  'chance_female_%',
  'chance_male_%',
  'evolvesTo_id',
  'evolve_atLevel',
  'minWildLevel',
]

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const rows: (string | number)[][] = []
for (const s of SPECIES_BASE) {
  const a = s.baseAttrs
  const total =
    a.batalha + a.inteligencia + a.carisma + a.agilidade + a.resistencia + a.percepcao
  const rate = GENDER_RATE[s.id] ?? -1
  const female = rate < 0 ? '' : Math.round((rate / 8) * 100)
  const male = rate < 0 ? '' : 100 - Math.round((rate / 8) * 100)
  const evo = evolvesTo.get(s.id)
  rows.push([
    s.id,
    s.name,
    s.displayName,
    s.types[0] ?? '',
    s.types[1] ?? '',
    s.rarity,
    a.batalha,
    a.inteligencia,
    a.carisma,
    a.agilidade,
    a.resistencia,
    a.percepcao,
    total,
    rate,
    female,
    male,
    evo?.id ?? '',
    evo?.atLevel ?? '',
    minWildLevel.get(s.id) ?? 1,
  ])
}

const csv = [HEADERS, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
const outDir = resolve(ROOT, 'scripts/out')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'pokemon-balance.csv')
writeFileSync(outPath, '﻿' + csv, 'utf8') // BOM p/ acentos no Sheets/Excel
console.log(`Gerado: ${outPath} (${rows.length} espécies)`)
