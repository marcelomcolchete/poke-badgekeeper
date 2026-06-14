/**
 * Reimporta o balanceamento manual (CSV exportado por exportPokemonCsv.ts) de volta
 * para os arquivos de dados gerados. O CSV passa a ser a FONTE DE VERDADE do
 * balanceamento — estes arquivos não devem mais ser regenerados pelo
 * buildPokemonData.ts (que busca da PokéAPI) sob risco de perder os ajustes.
 *
 * Preserva displayName e spritePath das espécies atuais (não estão no CSV).
 * Suporta múltiplos alvos de evolução (ex.: Eevee → 134,135,136).
 *
 * Uso: node --experimental-strip-types scripts/importPokemonCsv.ts [caminho-do-csv]
 * Regenera:
 *   - src/data/pokemon/species.generated.ts
 *   - src/data/pokemon/evolutions.generated.ts
 *   - src/data/pokemon/genders.generated.ts
 *   - src/data/pokemon/minWildLevels.generated.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Attrs, PokemonType, Rarity } from '../src/types/index.ts'
import type { EvolutionStep, SpeciesBase } from '../src/data/types.ts'
import { SPECIES_BASE } from '../src/data/pokemon/species.generated.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// CSV canônico (fonte de verdade do balanceamento). Passe outro caminho via argv[2].
const DEFAULT_CSV = resolve(ROOT, 'scripts/data/pokemon-balance.csv')

// displayName/spritePath atuais por id (não vêm no CSV — preservados).
const existingById = new Map(SPECIES_BASE.map((s) => [s.id, s]))

/** Parser CSV mínimo, ciente de aspas (campos com vírgula, ex.: "134,135,136"). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') pushField()
    else if (c === '\n') pushRow()
    else if (c === '\r') {
      /* ignora CR */
    } else field += c
  }
  if (field.length > 0 || row.length > 0) pushRow()
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function num(s: string): number {
  return Number(s.trim())
}

const csvPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_CSV
const rawFile = readFileSync(csvPath, 'utf8')
const raw = rawFile.charCodeAt(0) === 0xfeff ? rawFile.slice(1) : rawFile // remove BOM
const rows = parseCsv(raw)
const header = rows[0].map((h) => h.trim())
const col = (name: string): number => {
  const i = header.indexOf(name)
  if (i < 0) throw new Error(`Coluna ausente no CSV: ${name}`)
  return i
}

const C = {
  id: col('id'),
  name: col('name'),
  type1: col('type1'),
  type2: col('type2'),
  rarity: col('rarity'),
  evolvesTo: col('evolvesTo_id'),
  atLevel: col('evolve_atLevel'),
  batalha: col('batalha'),
  inteligencia: col('inteligencia'),
  carisma: col('carisma'),
  agilidade: col('agilidade'),
  resistencia: col('resistencia'),
  percepcao: col('percepcao'),
  gender: col('gender_rate'),
  minWild: col('minWildLevel'),
}

const species: SpeciesBase[] = []
const steps: EvolutionStep[] = []
const genderRate = new Map<number, number>()
const minWild = new Map<number, number>()

for (const r of rows.slice(1)) {
  const id = num(r[C.id])
  const prev = existingById.get(id)
  if (!prev) throw new Error(`id ${id} não existe nas espécies atuais — não reimportável`)
  if (r[C.name].trim() !== prev.name) {
    console.warn(`Aviso: name divergente p/ id ${id}: CSV="${r[C.name]}" vs "${prev.name}"`)
  }

  const types = [r[C.type1].trim(), r[C.type2].trim()].filter(Boolean) as PokemonType[]
  const baseAttrs: Attrs = {
    batalha: num(r[C.batalha]),
    inteligencia: num(r[C.inteligencia]),
    carisma: num(r[C.carisma]),
    agilidade: num(r[C.agilidade]),
    resistencia: num(r[C.resistencia]),
    percepcao: num(r[C.percepcao]),
  }
  species.push({
    id,
    name: prev.name,
    displayName: prev.displayName,
    types,
    baseAttrs,
    rarity: r[C.rarity].trim() as Rarity,
    spritePath: prev.spritePath,
  })

  const targets = r[C.evolvesTo]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
  if (targets.length > 0) {
    const atLevel = num(r[C.atLevel])
    for (const to of targets) steps.push({ from: id, to, atLevel })
  }

  genderRate.set(id, num(r[C.gender]))
  minWild.set(id, num(r[C.minWild]))
}

species.sort((a, b) => a.id - b.id)
steps.sort((a, b) => a.from - b.from || a.to - b.to)

function serializeAttrs(a: Attrs): string {
  return (
    `{ batalha: ${a.batalha}, inteligencia: ${a.inteligencia}, carisma: ${a.carisma}, ` +
    `agilidade: ${a.agilidade}, resistencia: ${a.resistencia}, percepcao: ${a.percepcao} }`
  )
}

const pokemonDir = resolve(ROOT, 'src/data/pokemon')
const header1 =
  '// AUTO-GERADO por scripts/importPokemonCsv.ts (balanceamento manual via CSV) — não editar à mão.\n'

const speciesBody = species
  .map(
    (s) =>
      `  { id: ${s.id}, name: ${JSON.stringify(s.name)}, displayName: ${JSON.stringify(
        s.displayName,
      )}, types: ${JSON.stringify(s.types)}, baseAttrs: ${serializeAttrs(
        s.baseAttrs,
      )}, rarity: ${JSON.stringify(s.rarity)}, spritePath: ${JSON.stringify(s.spritePath)} },`,
  )
  .join('\n')
writeFileSync(
  resolve(pokemonDir, 'species.generated.ts'),
  `${header1}import type { SpeciesBase } from '../types.ts'\n\nexport const SPECIES_BASE: SpeciesBase[] = [\n${speciesBody}\n]\n`,
)

const evoBody = steps
  .map((e) => `  { from: ${e.from}, to: ${e.to}, atLevel: ${e.atLevel} },`)
  .join('\n')
writeFileSync(
  resolve(pokemonDir, 'evolutions.generated.ts'),
  `${header1}import type { EvolutionStep } from '../types.ts'\n\nexport const EVOLUTIONS: EvolutionStep[] = [\n${evoBody}\n]\n`,
)

const ids = species.map((s) => s.id)
const genderBody = ids.map((id) => `  ${id}: ${genderRate.get(id) ?? -1},`).join('\n')
writeFileSync(
  resolve(pokemonDir, 'genders.generated.ts'),
  `${header1}// gender_rate: oitavos-fêmea (0=100% macho, 8=100% fêmea, -1=sem gênero).\n\n` +
    `export const GENDER_RATE: Record<number, number> = {\n${genderBody}\n}\n`,
)

const minWildBody = ids.map((id) => `  ${id}: ${minWild.get(id) ?? 1},`).join('\n')
writeFileSync(
  resolve(pokemonDir, 'minWildLevels.generated.ts'),
  `${header1}// Menor nível em que a espécie pode surgir como selvagem (gating de raridade/poder).\n\n` +
    `export const MIN_WILD_LEVEL: Record<number, number> = {\n${minWildBody}\n}\n`,
)

console.log(
  `OK: ${species.length} espécies, ${steps.length} passos de evolução, ` +
    `minWild e gender regravados. CSV: ${csvPath}`,
)
