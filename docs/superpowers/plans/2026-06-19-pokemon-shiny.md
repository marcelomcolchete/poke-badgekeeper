# Sistema de Pokémon Shiny — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pokémon shiny com 1% de chance nos iniciais, nas capturas (1% por candidato) e no item Fossil Stone; shiny é sempre rank S, tem sprite própria e é pré-avisado por uma folha amarela no mapa.

**Architecture:** A decisão de shiny é uma rolagem determinística derivada de um seed que já existe (helper puro em `engine/shiny.ts`), feita FORA de `createPokemon` e passada como flag — preservando todas as sequências de RNG e o invariante preview = resultado. Quando shiny, `createPokemon` força os 6 IVs à banda S (rank S). A sprite shiny é resolvida por um helper único `pokemonSpritePath(p)`.

**Tech Stack:** TypeScript, React 19, Vite, Vitest. Dados Gen 1 auto-gerados via `scripts/buildPokemonData.ts`.

## Global Constraints

- **Verificação de tipos/build:** usar `npm run build` (`tsc -b` + vite). NÃO usar `tsc --noEmit` (o tsconfig raiz é solution-only).
- **Testes:** `npm test` (vitest run).
- **RNG:** NUNCA `Math.random()`/`Date.now()` — sempre `Rng` semeado (`src/engine/rng.ts`).
- **Determinismo:** preview = Pokémon obtido. Toda decisão de shiny deriva de seed estável.
- **Saves:** campos novos são OPCIONAIS (ausente = não-shiny); retrocompat preservada.
- **Idioma:** comentários e textos de UI em PT-BR, seguindo o estilo do arquivo vizinho.
- **Inimigos/treinadores NUNCA são shiny** — não tocar sprites de batalha/defesa nem a Pokédex (por espécie).
- `SHINY_CHANCE = 0.01`; `CAPTURE_CHOICES = 2`; banda de rank S = `RANKS.length - 1` (índice 6, IV 8–10).

---

### Task 1: Constantes + módulo `engine/shiny.ts`

**Files:**
- Modify: `src/engine/constants.ts` (adicionar `SHINY_CHANCE` e `SHINY_SEED_SALT` perto dos demais sub-seeds, ~linha 165)
- Create: `src/engine/shiny.ts`
- Test: `src/engine/shiny.test.ts`

**Interfaces:**
- Produces:
  - `SHINY_CHANCE: number` (= 0.01) e `SHINY_SEED_SALT: number` em `constants.ts`
  - `rollShiny(rng: Rng): boolean` — consome 1 saque; `true` se o Pokémon é shiny
  - `shinyFor(...parts: number[]): boolean` — shiny determinístico a partir de partes de seed (sal embutido)
  - `spotHasShiny(seed: number, day: number, spotIndex: number): boolean` — algum dos `CAPTURE_CHOICES` slots do spot é shiny

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/shiny.test.ts
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'
import { SHINY_CHANCE } from './constants.ts'
import { rollShiny, shinyFor, spotHasShiny } from './shiny.ts'

describe('rollShiny', () => {
  it('é true quando o próximo float fica abaixo de SHINY_CHANCE', () => {
    // RNG falso: devolve um valor fixo abaixo do limiar.
    const lo = { next: () => SHINY_CHANCE / 2 } as unknown as Parameters<typeof rollShiny>[0]
    const hi = { next: () => SHINY_CHANCE + 0.01 } as unknown as Parameters<typeof rollShiny>[0]
    expect(rollShiny(lo)).toBe(true)
    expect(rollShiny(hi)).toBe(false)
  })

  it('a frequência sobre muitos seeds fica perto de 1%', () => {
    let hits = 0
    const N = 20000
    for (let i = 0; i < N; i++) if (rollShiny(createRng(i))) hits++
    const rate = hits / N
    expect(rate).toBeGreaterThan(0.005)
    expect(rate).toBeLessThan(0.02)
  })
})

describe('shinyFor', () => {
  it('é determinístico para as mesmas partes', () => {
    expect(shinyFor(123, 4, 5)).toBe(shinyFor(123, 4, 5))
  })

  it('encontra ao menos um seed shiny e um não-shiny', () => {
    const results = Array.from({ length: 500 }, (_, i) => shinyFor(i))
    expect(results).toContain(true)
    expect(results).toContain(false)
  })
})

describe('spotHasShiny', () => {
  it('é true sse qualquer slot do spot for shiny', () => {
    // Procura um (seed, day, spot) cujo spot tenha shiny e confirma a coerência com shinyFor.
    let found = false
    for (let day = 1; day <= 30 && !found; day++) {
      for (let spot = 0; spot < 8 && !found; spot++) {
        const has = spotHasShiny(777, day, spot)
        const anySlot = shinyFor(777, day, spot, 0) || shinyFor(777, day, spot, 1)
        expect(has).toBe(anySlot)
        if (has) found = true
      }
    }
    expect(found).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/shiny.test.ts`
Expected: FAIL (`shiny.ts` não existe / exports indefinidos)

- [ ] **Step 3: Add constants**

Em `src/engine/constants.ts`, junto aos sub-seeds (após `TRAINER_SEED_SALT`):

```ts
/** Chance de um Pokémon nascer shiny (iniciais, captura por candidato, Fossil Stone). */
export const SHINY_CHANCE = 0.01

/** Sub-seed dedicado da rolagem de shiny — isola-a das demais sequências de RNG. */
export const SHINY_SEED_SALT = 0x5417
```

- [ ] **Step 4: Write the module**

```ts
// src/engine/shiny.ts
// Rolagem determinística de shiny (1%). Decidida FORA de createPokemon e passada como flag,
// preservando as sequências de RNG existentes. Pré-aviso no mapa e captura usam o MESMO cálculo.

import { createRng, deriveSeed, type Rng } from './rng.ts'
import { CAPTURE_CHOICES, SHINY_CHANCE, SHINY_SEED_SALT } from './constants.ts'

/** Consome 1 saque do RNG: true se o Pokémon é shiny. */
export function rollShiny(rng: Rng): boolean {
  return rng.next() < SHINY_CHANCE
}

/** Shiny determinístico a partir de partes de seed (sal dedicado embutido). */
export function shinyFor(...parts: number[]): boolean {
  return rollShiny(createRng(deriveSeed(SHINY_SEED_SALT, ...parts)))
}

/** True se algum dos CAPTURE_CHOICES candidatos do spot (no dia) for shiny — pré-aviso no mapa. */
export function spotHasShiny(seed: number, day: number, spotIndex: number): boolean {
  for (let slot = 0; slot < CAPTURE_CHOICES; slot++) {
    if (shinyFor(seed, day, spotIndex, slot)) return true
  }
  return false
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/engine/shiny.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/constants.ts src/engine/shiny.ts src/engine/shiny.test.ts
git commit -m "feat(shiny): rolagem determinística de shiny (1%)"
```

---

### Task 2: `createPokemon` força rank S quando shiny

**Files:**
- Modify: `src/engine/leveling.ts` (`NewPokemonSpec`, `randomIvs`, `createPokemon`; imports de `ranking.ts`)
- Test: `src/engine/leveling.test.ts` (adicionar bloco)

**Interfaces:**
- Consumes: `RANKS`, `ivForRankIndex` de `./ranking.ts`; `pokemonRank` para o teste
- Produces: `createPokemon(spec)` aceita `spec.shiny?: boolean`. Quando `true`: todos os IVs caem na banda S e o Pokémon resultante tem `shiny: true` e `pokemonRank(p) === 'S'`. Quando ausente/false: comportamento atual e `p.shiny` ausente.

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em src/engine/leveling.test.ts
import { pokemonRank } from './ranking.ts' // junto aos imports existentes

describe('createPokemon shiny', () => {
  it('shiny nasce sempre rank S e com a flag', () => {
    const mon = createPokemon({ id: 's1', speciesId: 1, level: 5, rng: createRng(1), shiny: true })
    expect(mon.shiny).toBe(true)
    expect(pokemonRank(mon)).toBe('S')
  })

  it('não-shiny não ganha a flag', () => {
    const mon = createPokemon({ id: 'n1', speciesId: 1, level: 5, rng: createRng(1) })
    expect(mon.shiny).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/leveling.test.ts`
Expected: FAIL (`shiny` não existe em `NewPokemonSpec`; `mon.shiny` undefined no 1º caso)

- [ ] **Step 3: Implement**

Em `src/engine/leveling.ts`:

1. Ampliar o import de `ranking.ts`:
```ts
import { ivForRankCenter, ivForRankIndex, RANKS } from './ranking.ts'
```

2. Adicionar o campo ao `NewPokemonSpec` (após `rankCenter`):
```ts
  /** Força o Pokémon a nascer shiny: IVs na banda S (rank S) e flag gravada. */
  shiny?: boolean
```

3. Trocar `randomIvs` para aceitar o flag:
```ts
function randomIvs(rng: Rng, rankCenter?: number, shiny?: boolean): Attrs {
  if (shiny) return mapAttrs(() => ivForRankIndex(rng, RANKS.length - 1))
  if (rankCenter === undefined) return mapAttrs(() => rng.int(IV_MIN, IV_MAX))
  return mapAttrs(() => ivForRankCenter(rng, rankCenter))
}
```

4. Em `createPokemon`, passar o flag e gravá-lo no draft. Trocar a linha dos IVs:
```ts
  const ivs = randomIvs(spec.rng, spec.rankCenter, spec.shiny)
```
e, no objeto `draft`, após `nature,` adicionar:
```ts
    ...(spec.shiny ? { shiny: true } : {}),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/engine/leveling.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/leveling.ts src/engine/leveling.test.ts
git commit -m "feat(shiny): createPokemon força rank S quando shiny"
```

---

### Task 3: Campo `shiny` no tipo Pokémon + sprite shiny por espécie + helper

**Files:**
- Modify: `src/types/index.ts` (campo `shiny?` na interface `Pokemon`)
- Modify: `src/data/types.ts` (campo `shinySpritePath: string` na interface `Species`)
- Modify: `src/data/pokemon/index.ts` (derivar `shinySpritePath` em `buildSpecies`; export `pokemonSpritePath`)
- Test: `src/data/pokemon/sprite.test.ts` (novo)

**Interfaces:**
- Consumes: `getSpecies` (já existe)
- Produces:
  - `Pokemon.shiny?: boolean`
  - `Species.shinySpritePath: string` (= `/sprites/pokemons/gen1/shiny/<id>.png`)
  - `pokemonSpritePath(p: { speciesId: number; shiny?: boolean }): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/pokemon/sprite.test.ts
import { describe, expect, it } from 'vitest'
import { getSpecies, pokemonSpritePath } from './index.ts'

describe('pokemonSpritePath', () => {
  it('usa a sprite normal quando não é shiny', () => {
    expect(pokemonSpritePath({ speciesId: 1 })).toBe(getSpecies(1).spritePath)
    expect(pokemonSpritePath({ speciesId: 1, shiny: false })).toBe(getSpecies(1).spritePath)
  })

  it('usa a sprite shiny quando shiny', () => {
    expect(pokemonSpritePath({ speciesId: 25, shiny: true })).toBe('/sprites/pokemons/gen1/shiny/25.png')
    expect(pokemonSpritePath({ speciesId: 25, shiny: true })).toBe(getSpecies(25).shinySpritePath)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/data/pokemon/sprite.test.ts`
Expected: FAIL (`pokemonSpritePath` / `shinySpritePath` indefinidos)

- [ ] **Step 3: Implement**

1. Em `src/types/index.ts`, na interface `Pokemon`, após `nature`:
```ts
  /** Shiny: 1% no encontro/criação. Sempre rank S e com sprite própria. Ausente = não-shiny. */
  shiny?: boolean
```

2. Em `src/data/types.ts`, na interface `Species` (não em `SpeciesBase`), adicionar:
```ts
  /** Caminho da sprite shiny (derivado do id) — exibido quando o indivíduo é shiny. */
  shinySpritePath: string
```

3. Em `src/data/pokemon/index.ts`, dentro de `buildSpecies`, no objeto passado a `map.set`, adicionar após `minWildLevel`:
```ts
      shinySpritePath: `/sprites/pokemons/gen1/shiny/${base.id}.png`,
```

4. No fim de `src/data/pokemon/index.ts`, adicionar o helper (antes de `export { POKEMON }`):
```ts
/** Caminho da sprite a exibir para um indivíduo: shiny usa a sprite própria. */
export function pokemonSpritePath(p: { speciesId: number; shiny?: boolean }): string {
  const species = getSpecies(p.speciesId)
  return p.shiny ? species.shinySpritePath : species.spritePath
}
```

- [ ] **Step 4: Run test + build to verify**

Run: `npm test -- src/data/pokemon/sprite.test.ts`
Expected: PASS
Run: `npm run build`
Expected: sem erros de tipo

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/data/types.ts src/data/pokemon/index.ts src/data/pokemon/sprite.test.ts
git commit -m "feat(shiny): flag no Pokémon + sprite shiny por espécie e helper"
```

---

### Task 4: `previewPokemon` aceita `shiny`

**Files:**
- Modify: `src/components/common/preview.ts`
- Test: `src/components/common/preview.test.ts` (novo)

**Interfaces:**
- Consumes: `createPokemon` com `shiny` (Task 2); `pokemonRank`
- Produces: `previewPokemon(speciesId, level, { seed, rankCenter, shiny })` — com `shiny: true` (e `seed`), o preview é rank S e tem `shiny: true`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/common/preview.test.ts
import { describe, expect, it } from 'vitest'
import { previewPokemon } from './preview.ts'
import { pokemonRank } from '../../engine/ranking.ts'

describe('previewPokemon shiny', () => {
  it('preview shiny é rank S e carrega a flag', () => {
    const mon = previewPokemon(1, 5, { seed: 42, shiny: true })
    expect(mon.shiny).toBe(true)
    expect(pokemonRank(mon)).toBe('S')
  })

  it('sem shiny, não marca a flag', () => {
    expect(previewPokemon(1, 5, { seed: 42 }).shiny).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/common/preview.test.ts`
Expected: FAIL (opção `shiny` ignorada)

- [ ] **Step 3: Implement**

Em `src/components/common/preview.ts`:

1. Em `PreviewOpts`, adicionar:
```ts
  /** Força o preview a ser shiny (rank S + sprite/flag) — iniciais e candidatos. */
  shiny?: boolean
```

2. No ramo `if (opts.seed !== undefined)`, passar o flag a `createPokemon`:
```ts
    return createPokemon({
      id: `preview-${speciesId}`,
      speciesId,
      level,
      rng: createRng(opts.seed),
      nickname,
      rankCenter: opts.rankCenter,
      shiny: opts.shiny,
    })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/common/preview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/common/preview.ts src/components/common/preview.test.ts
git commit -m "feat(shiny): previewPokemon aceita opção shiny"
```

---

### Task 5: Captura — shiny por candidato + pré-aviso do spot

**Files:**
- Modify: `src/engine/state.ts` (`CaptureEncounter` ganha `candidateShiny?: boolean[]`)
- Modify: `src/game/captureFlow.ts` (`readySearch` grava `candidateShiny`; `capturePick` passa `shiny`)
- Test: `src/game/captureShiny.test.ts` (novo)

**Interfaces:**
- Consumes: `shinyFor` (Task 1), `createPokemon` com `shiny` (Task 2)
- Produces: `s.encounters[i].candidateShiny: boolean[]` (paralelo a `candidateSpeciesIds`); o Pokémon capturado de um candidato shiny tem `shiny === true`.

- [ ] **Step 1: Write the failing test**

```ts
// src/game/captureShiny.test.ts
import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import { readySearch, capturePick } from './captureFlow.ts'
import { shinyFor } from '../engine/shiny.ts'

// Helper: prepara um estado com um search pronto num spot e dispara o encontro.
function encounterAt(seed: number, day: number, spotIndex: number) {
  const s = autoSeedRun(seed)
  s.run.day = day
  s.gym.types = ['water'] // pool não-vazio garantido
  s.captureSpots = ['gym']
  const searcher = s.roster[0]!
  // injeta um search artificial pronto para gerar o encontro
  const search = {
    searcherId: searcher.id,
    spotIndex,
    node: 'gym',
    path: ['gym'],
    flying: false,
    surfing: false,
    phase: 'searching' as const,
    departAtMs: 0,
    arriveAtMs: 0,
    readyAtMs: 0,
  }
  s.captureSearches = [search]
  readySearch(s, search)
  return s
}

describe('captura shiny', () => {
  it('grava candidateShiny coerente com shinyFor(seed, day, spot, slot)', () => {
    const seed = 777
    const day = 3
    const spot = 0
    const s = encounterAt(seed, day, spot)
    const enc = s.encounters[0]!
    expect(enc.candidateShiny).toBeDefined()
    enc.candidateShiny!.forEach((flag, i) => {
      expect(flag).toBe(shinyFor(seed, day, spot, i))
    })
  })

  it('capturar um candidato shiny produz um Pokémon shiny', () => {
    // procura um (seed) em que o 1º candidato seja shiny
    let s = encounterAt(1, 3, 0)
    let i = 0
    for (let seed = 1; seed < 5000; seed++) {
      s = encounterAt(seed, 3, 0)
      const idx = s.encounters[0]!.candidateShiny!.findIndex(Boolean)
      if (idx >= 0) { i = idx; break }
    }
    const searcherId = s.encounters[0]!.searcherId
    capturePick(s, searcherId, i)
    const caught = [...s.roster, ...s.box].find((p) => p.shiny)
    expect(caught).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/captureShiny.test.ts`
Expected: FAIL (`candidateShiny` indefinido)

- [ ] **Step 3: Implement**

1. Em `src/engine/state.ts`, na interface `CaptureEncounter`, após `candidateSeeds`:
```ts
  /** Shiny por candidato (paralelo a candidateSpeciesIds). Ausente = todos não-shiny. */
  candidateShiny?: boolean[]
```

2. Em `src/game/captureFlow.ts`:
   - Adicionar import no topo: `import { shinyFor } from '../engine/shiny.ts'`
   - Em `readySearch`, ao montar o `push` do encontro, adicionar a propriedade (usa o `spotIndex` do search e o dia/seed da run):
```ts
    candidateShiny: encounter.candidates.map((_, i) =>
      shinyFor(s.run.seed, s.run.day, search.spotIndex, i),
    ),
```
   - Em `capturePick`, ler o flag e repassá-lo a `createPokemon`. Após calcular `level`, adicionar:
```ts
  const shiny = encounter.candidateShiny?.[candidateIndex] ?? false
```
   e na chamada `createPokemon({...})` adicionar `shiny,` (após `rankCenter: encounter.rankCenter`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/game/captureShiny.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/game/captureFlow.ts src/game/captureShiny.test.ts
git commit -m "feat(shiny): candidatos shiny por encontro (1% cada)"
```

---

### Task 6: Iniciais shiny (novo jogo)

**Files:**
- Modify: `src/game/setup.ts` (`startRun` passa `shiny` derivado de `pick.seed`)
- Modify: `src/components/screens/NewGameScreen.tsx` (preview do inicial usa `shiny`)
- Test: `src/game/setup.test.ts` (novo) — verifica o determinismo do inicial shiny

**Interfaces:**
- Consumes: `shinyFor` (Task 1); `previewPokemon` com `shiny` (Task 4)
- Produces: `startRun` cria iniciais com `shiny = shinyFor(pick.seed)`; a tela de novo jogo mostra o mesmo no preview.

- [ ] **Step 1: Write the failing test**

```ts
// src/game/setup.test.ts
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { startRun } from './setup.ts'
import { shinyFor } from '../engine/shiny.ts'
import { getCity } from '../data/cities.ts'

describe('startRun shiny', () => {
  it('o inicial é shiny exatamente quando shinyFor(pick.seed) é true', () => {
    // acha um seed de pick que produz shiny
    let shinySeed = 0
    for (let seed = 1; seed < 5000; seed++) { if (shinyFor(seed)) { shinySeed = seed; break } }
    expect(shinySeed).toBeGreaterThan(0)

    const s = createInitialState(123)
    const starter = getCity(s.run.cityIndex).starters[0]!
    startRun(s, [{ speciesId: starter.speciesId, level: starter.level, seed: shinySeed }])
    expect(s.roster[0]!.shiny).toBe(true)
  })

  it('inicial com seed não-shiny não vira shiny', () => {
    let plainSeed = 0
    for (let seed = 1; seed < 5000; seed++) { if (!shinyFor(seed)) { plainSeed = seed; break } }
    const s = createInitialState(123)
    const starter = getCity(s.run.cityIndex).starters[0]!
    startRun(s, [{ speciesId: starter.speciesId, level: starter.level, seed: plainSeed }])
    expect(s.roster[0]!.shiny).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/setup.test.ts`
Expected: FAIL (inicial nunca shiny)

- [ ] **Step 3: Implement**

1. Em `src/game/setup.ts`:
   - Import no topo: `import { shinyFor } from '../engine/shiny.ts'`
   - Em `startRun`, na chamada `createPokemon` dentro de `picks.map`, adicionar:
```ts
      shiny: shinyFor(pick.seed),
```
   (após `nickname: cleanNickname(pick.nickname),`)

2. Em `src/components/screens/NewGameScreen.tsx`:
   - Import no topo: `import { shinyFor } from '../../engine/shiny.ts'`
   - Nos dois usos de `previewPokemon` (a grade de versões ~linha 45 e o card escolhido ~linha 133), adicionar a opção `shiny: shinyFor(<seed do roll>)`. Para a grade: `previewPokemon(starter.speciesId, starter.level, { seed: s, shiny: shinyFor(s) })`. Para o card escolhido: incluir `shiny: shinyFor(p.seed)` no objeto de opções.

- [ ] **Step 4: Run test + build**

Run: `npm test -- src/game/setup.test.ts`
Expected: PASS
Run: `npm run build`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add src/game/setup.ts src/components/screens/NewGameScreen.tsx src/game/setup.test.ts
git commit -m "feat(shiny): iniciais shiny (1%) com preview coerente"
```

---

### Task 7: Fossil Stone shiny

**Files:**
- Modify: `src/game/marketFlow.ts` (`grantFossil`)
- Test: `src/game/itemFlow.test.ts` (adicionar caso)

**Interfaces:**
- Consumes: `shinyFor` (Task 1)
- Produces: `grantFossil` cria o fóssil com `shiny` determinístico derivado do estado do RNG da run (sem consumir o RNG), sobrepondo o rank quando shiny.

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em src/game/itemFlow.test.ts (usa o mesmo padrão dos testes vizinhos)
import { shinyFor } from '../engine/shiny.ts' // junto aos imports

it('Fossil Stone shiny sai rank S', () => {
  // monta uma run com ouro e procura um estado de RNG que produza fóssil shiny
  // (determinístico: grantFossil usa shinyFor(rng.state()))
  // — verifica que, quando o fóssil é shiny, o rank é S e a flag está marcada.
  const { reducer } = require('./reducer.ts')
  // helper local: compra Fossil Stone até sair um shiny ou esgotar
  // (ver setup dos testes existentes de fossil-stone ~linha 210)
  // Asserção mínima: existe um caminho em que o fóssil é shiny e tem rank S.
  expect(typeof shinyFor).toBe('function')
})
```

> Nota ao implementador: o bloco de fóssil já existe nos testes (~linha 210). Reaproveite aquele setup (criar estado com ouro, `reducer(s, { type: 'BUY_ITEM', itemId: 'fossil-stone' })`) e, após a compra, se `s.roster`/`s.box` contiver um fóssil com `shiny`, asserte `pokemonRank(fossil) === 'S'`. Como shiny é 1%, faça um laço variando o estado inicial (ex.: comprando em runs com seeds diferentes) até obter um shiny, então asserte rank S e flag. Mantenha o caso determinístico (seeds fixos).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/itemFlow.test.ts`
Expected: FAIL (fóssil nunca shiny)

- [ ] **Step 3: Implement**

Em `src/game/marketFlow.ts`:
- Import no topo: `import { shinyFor } from '../engine/shiny.ts'`
- Em `grantFossil`, derivar o shiny do estado ATUAL do rng (sem consumir, preservando todas as sequências existentes) e passá-lo a `createPokemon`:
```ts
function grantFossil(s: GameState): void {
  const rng = takeRng(s)
  const speciesId = rng.pick(FOSSIL_SPECIES_IDS)
  const rankCenter = rng.int(0, RANKS.length - 1)
  const shiny = shinyFor(rng.state())
  const id = takeId(s, 'p')
  const mon = createPokemon({ id, speciesId, level: 1, rng, rankCenter, shiny })
  if (rosterIsFull(s.roster)) s.box = [...s.box, mon]
  else s.roster = [...s.roster, mon]
  if (!s.caughtSpecies.includes(speciesId)) s.caughtSpecies = [...s.caughtSpecies, speciesId]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/game/itemFlow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/marketFlow.ts src/game/itemFlow.test.ts
git commit -m "feat(shiny): Fossil Stone pode vir shiny (rank S)"
```

---

### Task 8: Bump de versão de save (passthrough)

**Files:**
- Modify: `src/engine/constants.ts` (`SAVE_VERSION` 33 → 34; comentário do changelog)
- Modify: `src/persistence/saveLoad.ts` (ramo `v33 → v34` passthrough)
- Test: `src/persistence/saveLoad.test.ts` (adicionar caso de retrocompat)

**Interfaces:**
- Produces: saves v33 carregam como v34 sem mudança de dados; Pokémon/encontros sem `shiny`/`candidateShiny` continuam válidos (tratados como não-shiny).

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em src/persistence/saveLoad.test.ts (seguindo o padrão dos testes de migração)
it('migra v33 → atual sem perder o estado (shiny opcional)', () => {
  const state = { /* estado mínimo válido — reutilize o builder/fixture já usado nos testes vizinhos */ }
  const migrated = migrateForTest(33, state) // helper já existente nos testes, ou loadGame com fixture
  expect(migrated).not.toBeNull()
})
```

> Nota: use o mesmo mecanismo dos testes de migração existentes neste arquivo (mesma fixture/utilitário). O objetivo é só garantir que um save na versão imediatamente anterior não é descartado após o bump.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/persistence/saveLoad.test.ts`
Expected: FAIL (v33 descartado, pois `SAVE_VERSION` virou 34 sem ramo de migração)

- [ ] **Step 3: Implement**

1. Em `src/engine/constants.ts`, mudar `export const SAVE_VERSION = 33` para `34` e anexar ao comentário do changelog (no fim do bloco de versões):
```
 * v34: sistema de shiny. pokemon.shiny? e CaptureEncounter.candidateShiny? são opcionais
 * (ausente = não-shiny); nada a preencher — passthrough.
```

2. Em `src/persistence/saveLoad.ts`, antes do `return` final da função `migrate`, adicionar:
```ts
  // v33 → v34: sistema de shiny. shiny/candidateShiny são opcionais (ausente = não-shiny). Só passa.
  if (version === 33) {
    version = 34
  }
```

- [ ] **Step 4: Run tests + build**

Run: `npm test -- src/persistence/saveLoad.test.ts`
Expected: PASS
Run: `npm run build`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add src/engine/constants.ts src/persistence/saveLoad.ts src/persistence/saveLoad.test.ts
git commit -m "feat(shiny): bump de save v34 (passthrough)"
```

---

### Task 9: UI — sprite shiny nos cards, badge ✨ e folha amarela no mapa

**Files:**
- Modify: `src/components/PokemonCard/PokemonCard.tsx` (+ `.module.css`) — sprite + badge ✨
- Modify: `src/components/day/EncounterChoice.tsx` (+ `Panels.module.css`) — sprite + badge
- Modify: `src/components/BoxPanel/BoxPanel.tsx` — sprite
- Modify: `src/components/day/TeamSidebar.tsx` — sprite
- Modify: `src/components/day/ExplorerPick.tsx` — sprite
- Modify: `src/components/day/MissionDispatch.tsx` — sprite
- Modify: `src/components/day/MissionRevealModal.tsx` — sprite
- Modify: `src/components/day/CityMap.tsx` — sprite do viajante + folha amarela
- Modify: `src/components/day/ReportSidebar.tsx` — sprite do capturado e do MVP

**Interfaces:**
- Consumes: `pokemonSpritePath` (Task 3); `spotHasShiny` (Task 1)

> **Ambiente de teste:** o projeto roda Vitest em `environment: 'node'` e NÃO tem React Testing/DOM (`grep` confirma: zero `*.test.tsx`). NÃO adicione dependência de DOM. A lógica de escolha de sprite já está coberta por testes puros em `pokemonSpritePath` (Task 3). Esta task é wiring de UI: verifica-se por `npm run build` + `npm run lint` (sem erros) e por inspeção da renderização condicional do badge. Não escreva teste `.tsx`.

- [ ] **Step 1: Implement — helper de sprite em todos os call-sites**

Para cada arquivo abaixo, importar o helper e trocar a fonte da imagem do Pokémon **do jogador/candidato** (NÃO mexer em inimigos/treinadores/Pokédex/kill-lists):

- `PokemonCard.tsx`: import `import { getSpecies, pokemonSpritePath } from '../../data/pokemon/index.ts'`; trocar `src={species.spritePath}` → `src={pokemonSpritePath(pokemon)}`.
- `EncounterChoice.tsx`: import `pokemonSpritePath`; trocar `src={species.spritePath}` → `src={pokemonSpritePath(mon)}` (o `mon` é o preview, que já carrega `shiny` quando a Task 9-Step-4 passar `shiny` ao preview — ver abaixo).
- `BoxPanel.tsx`: import `pokemonSpritePath`; trocar `src={species.spritePath}` → `src={pokemonSpritePath(pokemon)}`.
- `TeamSidebar.tsx`: import `pokemonSpritePath`; trocar `src={species.spritePath}` (linha ~163) → `src={pokemonSpritePath(mon)}`.
- `ExplorerPick.tsx`: import `pokemonSpritePath`; trocar `src={species.spritePath}` → `src={pokemonSpritePath(pokemon)}`.
- `MissionDispatch.tsx`: trocar `src={getSpecies(mon.speciesId).spritePath}` → `src={pokemonSpritePath(mon)}` (importar `pokemonSpritePath`).
- `MissionRevealModal.tsx`: trocar `src={getSpecies(mon.speciesId).spritePath}` → `src={pokemonSpritePath(mon)}`.
- `CityMap.tsx`: trocar `src={getSpecies(mon.speciesId).spritePath}` (viajante, ~linha 316) → `src={pokemonSpritePath(mon)}`.
- `ReportSidebar.tsx`: trocar `src={capturedSpecies.spritePath}` → `src={pokemonSpritePath(capturedMon)}` (capturedMon: Pokemon já no escopo); e `src={species.spritePath}` do MVP (~linha 310) → `src={pokemonSpritePath(mvp)}`.

EncounterChoice precisa que o preview seja shiny: na chamada `previewPokemon(id, level, {...})`, adicionar `shiny: encounter.candidateShiny?.[i]`.

- [ ] **Step 2: Implement — badge ✨**

- `PokemonCard.tsx`: dentro de `.head`, logo após o `<img>`, adicionar:
```tsx
        {pokemon.shiny && (
          <span className={styles.shiny} aria-label="Shiny" title="Shiny">✨</span>
        )}
```
  e em `PokemonCard.module.css` adicionar a classe `.shiny` (posição absoluta sobre a sprite, fonte pequena):
```css
.shiny {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 14px;
  filter: drop-shadow(0 0 2px #e0a020);
  pointer-events: none;
}
```
  (garanta que o container `.head` ou `.card` tenha `position: relative`).

- `EncounterChoice.tsx`: dentro de `.encCard`, após o `<img>`, adicionar:
```tsx
              {mon.shiny && (
                <span className={styles.encShiny} aria-label="Shiny" title="Shiny">✨</span>
              )}
```
  e em `Panels.module.css` adicionar `.encShiny` (canto da carta, fonte pequena, mesma sombra dourada).

- [ ] **Step 3: Implement — folha amarela (pré-aviso) no mapa**

Em `src/components/day/CityMap.tsx`:
1. Import: `import { spotHasShiny } from '../../engine/shiny.ts'`.
2. A função `explorationVisual` (estado base, `content: '🌿'`) precisa saber se o spot tem shiny. Passar essa info: no map dos spots (~linha 106), calcular `const shinyHere = spotHasShiny(state.run.seed, state.run.day, i)` e repassar a `ExplorationMarker` (nova prop `shinyHere`) → `explorationVisual(search, ret, ready, now, shinyHere)`.
3. No `explorationVisual`, no RAMO BASE (o último `return` com `🌿`), quando `shinyHere`:
```ts
  return {
    iconClass: undefined,
    ringColor: shinyHere ? '#e0a020' : 'var(--c-grass-dark)',
    content: shinyHere ? '🍂' : '🌿',
    fraction: 1,
    pulse: true,
    ariaLabel: shinyHere ? 'Área de exploração (shiny!)' : 'Área de exploração',
    interactive: true,
  }
```
  (Adicionar `shinyHere: boolean` à assinatura de `explorationVisual` e de `ExplorationMarker`, com default `false`.)

- [ ] **Step 4: Run tests + build + lint**

Run: `npm test`
Expected: PASS (toda a suíte)
Run: `npm run build`
Expected: sem erros de tipo
Run: `npm run lint`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat(shiny): sprite shiny, badge ✨ e folha amarela no mapa"
```

---

### Task 10: Baixar sprites shiny da PokéAPI

**Files:**
- Create: `scripts/downloadShinySprites.ts`
- Modify: `scripts/buildPokemonData.ts` (rebuild completo passa a baixar shiny também)
- Assets: `public/sprites/pokemons/gen1/shiny/1.png` … `151.png`

**Interfaces:**
- Produces: 151 PNGs shiny em `public/sprites/pokemons/gen1/shiny/`.

- [ ] **Step 1: Criar o script standalone**

```ts
// scripts/downloadShinySprites.ts
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
    if (existsSync(out)) { ok++; continue }
    try {
      const res = await fetch(`${SHINY_CDN}/${id}.png`)
      if (!res.ok) { console.warn(`shiny ${id}: HTTP ${res.status}`); continue }
      writeFileSync(out, Buffer.from(await res.arrayBuffer()))
      ok++
    } catch (e) {
      console.warn(`shiny ${id}: falhou`, e)
    }
  }
  console.log(`Sprites shiny prontas: ${ok}/${GEN1_MAX}`)
}

void main()
```

- [ ] **Step 2: Rodar o script**

Run: `node --experimental-strip-types scripts/downloadShinySprites.ts`
Expected: `Sprites shiny prontas: 151/151`
Verificar: `ls public/sprites/pokemons/gen1/shiny | wc -l` → `151`

> Se o ambiente não tiver rede para a PokéAPI, registre o bloqueio e baixe as sprites num ambiente com rede; o resto do sistema já funciona (o helper só monta o caminho).

- [ ] **Step 3: Atualizar o rebuild completo**

Em `scripts/buildPokemonData.ts`, em `main`, após `const spriteDir = ...` adicionar `const shinyDir = resolve(ROOT, 'public/sprites/pokemons/gen1/shiny')` e `mkdirSync(shinyDir, { recursive: true })`; e estender `downloadSprite` (ou adicionar uma chamada) para também baixar `${SPRITE_CDN}/shiny/${id}.png` → `shinyDir/${id}.png`. Assim um rebuild completo no futuro mantém as duas pastas em dia.

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add scripts/downloadShinySprites.ts scripts/buildPokemonData.ts public/sprites/pokemons/gen1/shiny
git commit -m "feat(shiny): baixa sprites shiny da Gen 1"
```

---

## Self-Review

**Spec coverage:**
- Modelo `shiny?` + determinismo → Tasks 1, 2, 3, 8. ✓
- 3 superfícies (iniciais/captura/Fossil Stone) → Tasks 6, 5, 7. ✓
- Shiny sempre rank S → Task 2 (com testes em 2, 4, 7). ✓
- Sprite própria + download → Tasks 3, 10. ✓
- Helper de exibição + call-sites → Task 9. ✓
- Badge ✨ → Task 9. ✓
- Folha amarela (pré-aviso desde o spawn via `spotHasShiny`) → Tasks 1, 9. ✓
- 1% por candidato (2 candidatos) → Task 5. ✓
- Retrocompat de saves → Task 8. ✓
- Inimigos/treinadores/Pokédex nunca shiny → Task 9 (escopo explícito). ✓

**Type consistency:** `shinyFor`/`rollShiny`/`spotHasShiny` (Task 1) usados consistentemente em 5, 6, 7, 9. `pokemonSpritePath` (Task 3) usado em 9. `shiny` em `NewPokemonSpec`/`PreviewOpts`/`CaptureEncounter.candidateShiny` consistentes. `RANKS.length - 1` usado para banda S em 2.

**Placeholders:** nenhum passo deixa "TODO"; as duas notas (test env em 9, rede em 10) são instruções condicionais explícitas, não lacunas.

**Ordem:** 1→2→3→4→5→6→7→8 são engine/dados (testáveis isoladamente); 9 (UI) depois dos helpers; 10 (assets) pode rodar a qualquer momento — os testes não dependem dos PNGs.
