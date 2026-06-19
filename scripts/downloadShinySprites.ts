// Baixa as sprites shiny da Gen 1 (PokéAPI sprites CDN) para public/sprites/pokemons/gen1/shiny/.
// Idempotente: pula as que já existem. Uso: node --experimental-strip-types scripts/downloadShinySprites.ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHINY_CDN = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny'
const GEN1_MAX = 151

async function main(): Promise<void> {
  const dir = resolve(ROOT, 'public/sprites/pokemons/gen1/shiny')
  mkdirSync(dir, { recursive: true })
  let ok = 0
  for (let id = 1; id <= GEN1_MAX; id++) {
    const out = resolve(dir, `${id}.png`)
    if (existsSync(out)) {
      ok++
      continue
    }
    try {
      const res = await fetch(`${SHINY_CDN}/${id}.png`)
      if (!res.ok) {
        console.warn(`shiny ${id}: HTTP ${res.status}`)
        continue
      }
      writeFileSync(out, Buffer.from(await res.arrayBuffer()))
      ok++
    } catch (e) {
      console.warn(`shiny ${id}: falhou`, e)
    }
  }
  console.log(`Sprites shiny prontas: ${ok}/${GEN1_MAX}`)
}

void main()
