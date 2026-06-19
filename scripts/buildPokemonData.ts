/**
 * Gerador dos dados da Gen 1 (PLAN §1 Fase 1 / balanceamento Fase 5).
 *
 * Busca nomes/tipos/sprites/stats/amizade via PokéAPI e:
 *  - deriva os 6 atributos custom (10–50) a partir dos stats OFICIAIS:
 *      • agilidade  ← Speed
 *      • resistencia← HP, Def, Sp.Def
 *      • batalha    ← Atk, Def, Sp.Atk, Sp.Def
 *      • inteligencia← Sp.Atk, Sp.Def
 *      • carisma    ← base_happiness (amizade) + preenchimento
 *      • percepcao  ← preenchimento (balanceia o total)
 *    O TOTAL dos 6 é calibrado pelo BST (ancoras: Squirtle ~135, Wartortle ~158,
 *    Blastoise 190) e garante-se que a forma evoluída tem total > anterior (§4.1);
 *  - remapeia os níveis de evolução para 1–10 (16→3, 55→9) — PLAN §4.1.1;
 *  - classifica a raridade (Common/Uncommon/Rare/Epic/Legend) pelo BST — PLAN §4.5;
 *  - baixa as sprites front-default para public/sprites/pokemons/gen1/.
 *
 * Emite (auto-gerados, não editar à mão):
 *  - src/data/pokemon/species.generated.ts
 *  - src/data/pokemon/evolutions.generated.ts
 *  - src/data/pokemon/genders.generated.ts (gender_rate: oitavos-fêmea, -1 = sem gênero)
 *
 * Uso: node --experimental-strip-types scripts/buildPokemonData.ts
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AttrKey, PokemonType, Rarity } from '../src/types/index.ts'
import type { EvolutionStep, SpeciesBase } from '../src/data/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://pokeapi.co/api/v2'
const SPRITE_CDN = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const GEN1_MAX = 151
const CONCURRENCY = 12

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round = (n: number) => Math.round(n)

const DISPLAY_OVERRIDES: Record<string, string> = {
  'nidoran-f': 'Nidoran♀',
  'nidoran-m': 'Nidoran♂',
  'mr-mime': 'Mr. Mime',
  farfetchd: "Farfetch'd",
}

function displayName(name: string): string {
  if (DISPLAY_OVERRIDES[name]) return DISPLAY_OVERRIDES[name]
  return name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function idFromUrl(url: string): number {
  const m = url.match(/\/(\d+)\/?$/)
  return m ? Number(m[1]) : NaN
}

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
  }
  throw new Error(`Falha ao buscar ${url}`)
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i] as T, i)
    }
  })
  await Promise.all(workers)
  return out
}

type StatMap = Record<string, number>
type Attrs = Record<AttrKey, number>

/** Métrica (combinação de stats) → atributo 10–50, com limites por métrica. */
function norm(value: number, lo: number, hi: number): number {
  return clamp(round(10 + ((value - lo) / (hi - lo)) * 40), 10, 50)
}

function bstOf(s: StatMap): number {
  return (
    (s['hp'] ?? 0) +
    (s['attack'] ?? 0) +
    (s['defense'] ?? 0) +
    (s['special-attack'] ?? 0) +
    (s['special-defense'] ?? 0) +
    (s['speed'] ?? 0)
  )
}

/**
 * Deriva os 6 atributos dos stats oficiais. A "forma" (4 atributos derivados) vem
 * dos stats; o TOTAL é calibrado pelo BST; carisma/percepcao preenchem o restante
 * (carisma puxado pela amizade, percepcao balanceia) — PLAN §4.1.
 */
function deriveAttrs(s: StatMap, friendship: number): Attrs {
  const hp = s['hp'] ?? 20
  const atk = s['attack'] ?? 20
  const def = s['defense'] ?? 20
  const spa = s['special-attack'] ?? 20
  const spd = s['special-defense'] ?? 20
  const spe = s['speed'] ?? 20

  const agilidade = norm(spe, 15, 130)
  const resistencia = norm(0.45 * hp + 0.3 * def + 0.25 * spd, 35, 130)
  const batalha = norm(0.4 * atk + 0.18 * def + 0.3 * spa + 0.12 * spd, 30, 120)
  const inteligencia = norm(0.55 * spa + 0.45 * spd, 25, 120)

  const target = clamp(round(0.2546 * bstOf(s) + 55), 70, 290)
  const remainder = clamp(target - (agilidade + resistencia + batalha + inteligencia), 20, 100)
  const charismaFrac = clamp(0.5 + (friendship - 70) / 200, 0.35, 0.65)
  const carisma = clamp(round(remainder * charismaFrac), 10, 50)
  const percepcao = clamp(remainder - carisma, 10, 50)

  return { batalha, inteligencia, carisma, agilidade, resistencia, percepcao }
}

const LEGENDARY_IDS = new Set([144, 145, 146, 150, 151])

/** Raridade pela força total (BST), com os lendários fixos — PLAN §4.5. */
function rarityOf(id: number, bst: number): Rarity {
  if (LEGENDARY_IDS.has(id)) return 'legend'
  if (bst >= 500) return 'epic'
  if (bst >= 450) return 'rare'
  if (bst >= 330) return 'uncommon'
  return 'common'
}

/** Nível de evolução oficial → escala 1–10 (16→3, 55→9). null = pedra/troca/amizade. */
function remapLevel(min: number | null, parentLevel: number): number {
  let lvl = min == null ? 4 : clamp(round(((min - 16) / 39) * 6 + 3), 2, 9)
  if (parentLevel > 0) lvl = clamp(Math.max(lvl, parentLevel + 1), 2, 10)
  return lvl
}

function gen1Types(p: any): PokemonType[] {
  const source = p.past_types?.length ? p.past_types[0].types : p.types
  return source
    .slice()
    .sort((a: any, b: any) => a.slot - b.slot)
    .map((t: any) => t.type.name as PokemonType)
}

async function downloadOne(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) return
  try {
    const res = await fetch(url)
    if (!res.ok) return
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(dest, buf)
  } catch {
    // sprite ausente é não-fatal
  }
}

async function downloadSprite(id: number, spriteDir: string, shinyDir: string): Promise<void> {
  await downloadOne(`${SPRITE_CDN}/${id}.png`, resolve(spriteDir, `${id}.png`))
  await downloadOne(`${SPRITE_CDN}/shiny/${id}.png`, resolve(shinyDir, `${id}.png`))
}

const ATTR_TOTAL = (a: Attrs): number =>
  a.batalha + a.inteligencia + a.carisma + a.agilidade + a.resistencia + a.percepcao

/** Sobe 1 ponto num atributo (preferindo percepcao/carisma) para garantir monotonicidade. */
function bumpOne(a: Attrs): boolean {
  for (const k of ['percepcao', 'carisma', 'batalha', 'resistencia', 'inteligencia', 'agilidade'] as const) {
    if (a[k] < 50) {
      a[k] += 1
      return true
    }
  }
  return false
}

/** Garante que toda forma evoluída tem total > anterior (PLAN §4.1). */
function enforceMonotonic(species: SpeciesBase[], steps: EvolutionStep[]): void {
  const byId = new Map(species.map((s) => [s.id, s]))
  for (let iter = 0; iter < 6; iter++) {
    let changed = false
    for (const step of steps) {
      const from = byId.get(step.from)
      const to = byId.get(step.to)
      if (!from || !to) continue
      while (ATTR_TOTAL(to.baseAttrs) <= ATTR_TOTAL(from.baseAttrs)) {
        if (!bumpOne(to.baseAttrs)) break
        changed = true
      }
    }
    if (!changed) break
  }
}

function serializeAttrs(a: Attrs): string {
  return (
    `{ batalha: ${a.batalha}, inteligencia: ${a.inteligencia}, carisma: ${a.carisma}, ` +
    `agilidade: ${a.agilidade}, resistencia: ${a.resistencia}, percepcao: ${a.percepcao} }`
  )
}

async function main(): Promise<void> {
  const spriteDir = resolve(ROOT, 'public/sprites/pokemons/gen1')
  const shinyDir = resolve(ROOT, 'public/sprites/pokemons/gen1/shiny')
  const pokemonDir = resolve(ROOT, 'src/data/pokemon')
  mkdirSync(spriteDir, { recursive: true })
  mkdirSync(shinyDir, { recursive: true })
  mkdirSync(pokemonDir, { recursive: true })

  const ids = Array.from({ length: GEN1_MAX }, (_, i) => i + 1)
  const chainUrls = new Set<string>()
  const genderRate = new Map<number, number>()

  console.log(`Buscando ${GEN1_MAX} Pokémon + sprites...`)
  const species: SpeciesBase[] = await mapLimit(ids, CONCURRENCY, async (id) => {
    const [p, sp] = await Promise.all([
      getJson(`${API}/pokemon/${id}`),
      getJson(`${API}/pokemon-species/${id}`),
    ])
    const stats: StatMap = {}
    for (const st of p.stats) stats[st.stat.name] = st.base_stat
    const friendship: number = sp.base_happiness ?? 70
    genderRate.set(id, sp.gender_rate ?? -1)
    if (sp.evolution_chain?.url) chainUrls.add(sp.evolution_chain.url)
    await downloadSprite(id, spriteDir, shinyDir)
    return {
      id,
      name: p.name,
      displayName: displayName(p.name),
      types: gen1Types(p),
      baseAttrs: deriveAttrs(stats, friendship),
      rarity: rarityOf(id, bstOf(stats)),
      spritePath: `/sprites/pokemons/gen1/${id}.png`,
    }
  })

  console.log('Resolvendo cadeias de evolução...')
  const steps: EvolutionStep[] = []
  const walk = (node: any, parentLevel: number): void => {
    const fromId = idFromUrl(node.species.url)
    for (const child of node.evolves_to) {
      const toId = idFromUrl(child.species.url)
      const min: number | null = child.evolution_details?.[0]?.min_level ?? null
      const lvl = remapLevel(min, parentLevel)
      if (fromId <= GEN1_MAX && toId <= GEN1_MAX) steps.push({ from: fromId, to: toId, atLevel: lvl })
      walk(child, lvl)
    }
  }
  await mapLimit([...chainUrls], CONCURRENCY, async (url) => {
    const chain = await getJson(url)
    walk(chain.chain, 0)
  })

  species.sort((a, b) => a.id - b.id)
  steps.sort((a, b) => a.from - b.from || a.to - b.to)
  enforceMonotonic(species, steps)

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

  const evoBody = steps
    .map((e) => `  { from: ${e.from}, to: ${e.to}, atLevel: ${e.atLevel} },`)
    .join('\n')

  const header = '// AUTO-GERADO por scripts/buildPokemonData.ts — não editar à mão.\n'

  writeFileSync(
    resolve(pokemonDir, 'species.generated.ts'),
    `${header}import type { SpeciesBase } from '../types.ts'\n\nexport const SPECIES_BASE: SpeciesBase[] = [\n${speciesBody}\n]\n`,
  )
  writeFileSync(
    resolve(pokemonDir, 'evolutions.generated.ts'),
    `${header}import type { EvolutionStep } from '../types.ts'\n\nexport const EVOLUTIONS: EvolutionStep[] = [\n${evoBody}\n]\n`,
  )

  const genderBody = ids.map((id) => `  ${id}: ${genderRate.get(id) ?? -1},`).join('\n')
  const genderHeader =
    `${header}// gender_rate da PokéAPI: oitavos-fêmea (0=100% macho, 8=100% fêmea, -1=sem gênero).\n`
  writeFileSync(
    resolve(pokemonDir, 'genders.generated.ts'),
    `${genderHeader}\nexport const GENDER_RATE: Record<number, number> = {\n${genderBody}\n}\n`,
  )

  console.log(`OK: ${species.length} espécies, ${steps.length} passos de evolução.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
