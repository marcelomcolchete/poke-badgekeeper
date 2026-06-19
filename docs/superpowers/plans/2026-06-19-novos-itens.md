# Novos Itens (Vermilion + gerais) e Fossil Stone passiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 5 itens (`electirizer`, `dragon-fang`, `magnet`, `shiny-charm`, `moon-stone`) e transformar `fossil-stone` num passivo de batalha.

**Architecture:** Itens passivos vivem em `s.runItems` e são lidos por funções PURAS na engine (`itemEffects.ts`, `secretEffects.ts`). Consumíveis com alvo (Rare Candy, Moon Stone) são ações dedicadas no reducer + modal na `MorningScreen`. O electirizer introduz cargas por-Pokémon no `GameState`, incrementadas ao ser atingido por um raio (`stormFlow`) e consumidas no despacho da missão (`missionFlow`).

**Tech Stack:** TypeScript, React, Vitest. Build: `npm run build` (tsc -b). Typecheck: `npm run typecheck`. Testes: `npx vitest run <arquivo>`.

## Global Constants

- Spec: `docs/superpowers/specs/2026-06-19-novos-itens-design.md` (fonte da verdade).
- Multiplicadores de batalha por tipo/espécie = **1.5** (+50%), como `thick-club`.
- `electirizer` = **650g**, Vermilion. `dragon-fang`/`magnet` = **1000g**, Vermilion. `fossil-stone` = **1000g** (era 800), Pewter. `shiny-charm` = **1000g**, geral. `moon-stone` = **700g**, geral.
- `ELECTIRIZER_MISSION_BONUS` = **0.5** por carga (acumula). `SHINY_CHARM_BONUS` = **0.04** (chance 1% → 5%).
- Vermilion = cidade índice **2**; Pewter = **0**. Espécies fósseis = `[138, 139, 140, 141, 142]`.
- Comentários e textos de UI em **português** (padrão do repo). Commits em PT, no estilo `feat(escopo): ...`.
- Cada task termina com build verde + testes passando + commit.

---

### Task 1: `dragon-fang` + `magnet` (passivos de batalha, Vermilion)

**Files:**
- Modify: `src/engine/balance.ts` (após linha 329, `MYSTIC_WATER_BATTLE_MULT`)
- Modify: `src/engine/itemEffects.ts` (`itemBattleMultiplier`, imports)
- Modify: `src/data/items.ts` (`ITEMS`, `CITY_ITEM_IDS`)
- Test: `src/engine/itemEffects.test.ts`
- Test: `src/data/items.test.ts` (corrigir teste de extras de cidade)

**Interfaces:**
- Consumes: `itemBattleMultiplier(p: Pokemon, runItems: readonly string[]): number` (existente).
- Produces: constantes `DRAGON_FANG_BATTLE_MULT`, `MAGNET_BATTLE_MULT`; itens `dragon-fang`/`magnet` em `CITY_ITEM_IDS[2]`.

- [ ] **Step 1: Escrever o teste que falha (itemEffects)**

Em `src/engine/itemEffects.test.ts`, dentro do bloco de testes de `itemBattleMultiplier` (ou crie um novo `describe`), adicione:

`makeMon` já está importado no topo do arquivo (`import { makeMon } from './testkit.ts'`) — não adicione import novo.

```typescript
describe('itemBattleMultiplier — dragon-fang e magnet', () => {
  it('dragon-fang dá +50% só para tipo Dragão', () => {
    const dratini = makeMon({ id: 'd', types: ['dragon'] })
    const pidgey = makeMon({ id: 'p', types: ['normal', 'flying'] })
    expect(itemBattleMultiplier(dratini, ['dragon-fang'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(pidgey, ['dragon-fang'])).toBeCloseTo(1)
  })

  it('magnet dá +50% só para tipo Elétrico', () => {
    const pikachu = makeMon({ id: 'e', types: ['electric'] })
    const rattata = makeMon({ id: 'r', types: ['normal'] })
    expect(itemBattleMultiplier(pikachu, ['magnet'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(rattata, ['magnet'])).toBeCloseTo(1)
  })
})
```

> **Nota:** use o MESMO mecanismo de criação de Pokémon de teste já presente no topo de `itemEffects.test.ts` (verifique o import/factory existente — pode ser `makeMon` de um helper compartilhado ou um objeto literal `Pokemon`). Reaproveite o padrão do arquivo; o importante é um Pokémon com `types` e `speciesId`.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/itemEffects.test.ts`
Expected: FAIL (os multiplicadores ainda não existem; resultado 1 onde se espera 1.5).

- [ ] **Step 3: Adicionar as constantes de balance**

Em `src/engine/balance.ts`, logo após a linha `export const MYSTIC_WATER_BATTLE_MULT = 1.5`:

```typescript
/** Dragon Fang: +50% em batalhas para Pokémon do tipo Dragão. */
export const DRAGON_FANG_BATTLE_MULT = 1.5
/** Magnet: +50% em batalhas para Pokémon do tipo Elétrico. */
export const MAGNET_BATTLE_MULT = 1.5
```

- [ ] **Step 4: Aplicar os multiplicadores em `itemBattleMultiplier`**

Em `src/engine/itemEffects.ts`, no import de `./balance.ts` acrescente `DRAGON_FANG_BATTLE_MULT` e `MAGNET_BATTLE_MULT`. Depois, dentro de `itemBattleMultiplier`, antes da linha do Lagging Tail (`if (hasRunItem(runItems, 'lagging-tail')) mult *= LAGGING_TAIL_BATTLE_MULT`):

```typescript
  if (hasRunItem(runItems, 'dragon-fang') && p.types.includes('dragon')) {
    mult *= DRAGON_FANG_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'magnet') && p.types.includes('electric')) {
    mult *= MAGNET_BATTLE_MULT
  }
```

Atualize também o comentário-doc da função para listar Dragon Fang/Magnet.

- [ ] **Step 5: Adicionar os itens ao catálogo + cidade**

Em `src/data/items.ts`, dentro do array `ITEMS` (após a entrada `mystic-water`, por proximidade temática), adicione:

```typescript
  {
    id: 'dragon-fang',
    name: 'Dragon Fang',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Dragão ganham +50% em batalhas.',
    sprite: sprite('dragon-fang'),
    effect: { kind: 'passive' },
  },
  {
    id: 'magnet',
    name: 'Magnet',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Elétrico ganham +50% em batalhas.',
    sprite: sprite('magnet'),
    effect: { kind: 'passive' },
  },
```

E em `CITY_ITEM_IDS`, adicione a entrada de Vermilion (índice 2):

```typescript
export const CITY_ITEM_IDS: Record<number, string[]> = {
  0: ['lagging-tail', 'thick-club', 'fossil-stone'],
  1: ['mystic-water', 'surfboard', 'fresh-water'],
  2: ['dragon-fang', 'magnet'],
}
```

(O comentário acima de `CITY_ITEM_IDS` deve passar a citar Vermilion (2) também.)

- [ ] **Step 6: Corrigir o teste de extras de cidade (items.test.ts)**

O teste `'extras de cidade só aparecem na própria cidade'` em `src/data/items.test.ts` assume "Cidade 2 (Vermilion) não tem extras". Substitua o corpo INTEIRO desse `it(...)` por uma versão genérica sobre `CITY_ITEM_IDS`:

```typescript
  it('extras de cidade só aparecem na própria cidade', () => {
    const pewterOnly = CITY_ITEM_IDS[0] ?? []
    const ceruleanOnly = CITY_ITEM_IDS[1] ?? []
    const vermilionOnly = CITY_ITEM_IDS[2] ?? []
    // Toda oferta de uma cidade sai do pool global + extras da própria cidade.
    for (const city of [0, 1, 2]) {
      const allowed = new Set([...GLOBAL_ITEM_IDS, ...(CITY_ITEM_IDS[city] ?? [])])
      for (let seed = 0; seed < 80; seed++) {
        for (const id of getDailyShop(seed, 1, city)) expect(allowed.has(id)).toBe(true)
      }
    }
    // Extras de uma cidade nunca aparecem em outra.
    const seen: Record<number, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set() }
    for (let seed = 0; seed < 200; seed++) {
      for (const city of [0, 1, 2]) {
        for (const id of getDailyShop(seed, 1, city)) seen[city]!.add(id)
      }
    }
    expect(ceruleanOnly.some((id) => seen[0]!.has(id))).toBe(false)
    expect(vermilionOnly.some((id) => seen[0]!.has(id))).toBe(false)
    expect(pewterOnly.some((id) => seen[1]!.has(id))).toBe(false)
    expect(vermilionOnly.some((id) => seen[1]!.has(id))).toBe(false)
    expect(pewterOnly.some((id) => seen[2]!.has(id))).toBe(false)
    expect(ceruleanOnly.some((id) => seen[2]!.has(id))).toBe(false)
    // Em cada cidade, ao varrer seeds, pelo menos um extra próprio acaba aparecendo.
    expect(pewterOnly.some((id) => seen[0]!.has(id))).toBe(true)
    expect(ceruleanOnly.some((id) => seen[1]!.has(id))).toBe(true)
    expect(vermilionOnly.some((id) => seen[2]!.has(id))).toBe(true)
  })
```

- [ ] **Step 7: Rodar os testes e ver passar**

Run: `npx vitest run src/engine/itemEffects.test.ts src/data/items.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/engine/balance.ts src/engine/itemEffects.ts src/data/items.ts src/engine/itemEffects.test.ts src/data/items.test.ts
git commit -m "feat(items): dragon-fang e magnet (+50% batalha por tipo, Vermilion)"
```

---

### Task 2: `fossil-stone` vira passivo de batalha (fósseis)

**Files:**
- Modify: `src/engine/balance.ts`
- Modify: `src/engine/itemEffects.ts` (helper `isFossilSpecies` + checagem)
- Modify: `src/data/types.ts` (`ItemEffect`: remover `fossilStone`)
- Modify: `src/game/marketFlow.ts` (remover `grantFossil`/case/imports)
- Modify: `src/data/items.ts` (entrada `fossil-stone`)
- Test: `src/engine/itemEffects.test.ts`
- Test: `src/game/itemFlow.test.ts` (remover suíte do fóssil consumível)

**Interfaces:**
- Produces: `isFossilSpecies(speciesId: number): boolean`; `FOSSIL_STONE_BATTLE_MULT`.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/engine/itemEffects.test.ts`, acrescente:

```typescript
describe('itemBattleMultiplier — fossil-stone', () => {
  it('dá +50% para Pokémon fóssil (espécies 138–142)', () => {
    const omanyte = makeMon({ id: 'o', speciesId: 138 })
    const pikachu = makeMon({ id: 'p', speciesId: 25 })
    expect(itemBattleMultiplier(omanyte, ['fossil-stone'])).toBeCloseTo(1.5)
    expect(itemBattleMultiplier(pikachu, ['fossil-stone'])).toBeCloseTo(1)
  })
})
```

> Garanta que `makeMon` (ou factory equivalente do arquivo) aceite `speciesId`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/itemEffects.test.ts`
Expected: FAIL (multiplicador 1 onde se espera 1.5).

- [ ] **Step 3: Constante de balance**

Em `src/engine/balance.ts`, após as constantes do Task 1:

```typescript
/** Fossil Stone: +50% em batalhas para Pokémon fósseis (Omanyte/Omastar/Kabuto/Kabutops/Aerodactyl). */
export const FOSSIL_STONE_BATTLE_MULT = 1.5
```

- [ ] **Step 4: Helper + checagem em `itemEffects.ts`**

Em `src/engine/itemEffects.ts`, acrescente `FOSSIL_STONE_BATTLE_MULT` ao import de `./balance.ts`. Logo após a função `hasRunItem` (ou perto do topo do arquivo), adicione:

```typescript
/** Espécies fósseis (Omanyte/Omastar/Kabuto/Kabutops/Aerodactyl) — alvo da Fossil Stone. */
const FOSSIL_SPECIES_IDS = [138, 139, 140, 141, 142]

/** Este Pokémon é um fóssil? (Fossil Stone). */
export function isFossilSpecies(speciesId: number): boolean {
  return FOSSIL_SPECIES_IDS.includes(speciesId)
}
```

Dentro de `itemBattleMultiplier`, após o bloco do `magnet`:

```typescript
  if (hasRunItem(runItems, 'fossil-stone') && isFossilSpecies(p.speciesId)) {
    mult *= FOSSIL_STONE_BATTLE_MULT
  }
```

- [ ] **Step 5: Remover `fossilStone` do tipo `ItemEffect`**

Em `src/data/types.ts`, remova a linha `| { kind: 'fossilStone' }` da união `ItemEffect`. No bloco de comentário acima da união, remova a linha que descreve `fossilStone`.

- [ ] **Step 6: Remover `grantFossil` e o case em `marketFlow.ts`**

Em `src/game/marketFlow.ts`:
1. Remova o `case 'fossilStone': { ... }` inteiro (o bloco que chama `grantFossil`).
2. Remova a função `grantFossil` inteira.
3. Remova a constante `FOSSIL_SPECIES_IDS`.
4. Remova os imports que ficaram sem uso: `createPokemon` (do `leveling.ts`), `shinyFor` (do `shiny.ts` — remova a linha de import inteira), `RANKS` (do `ranking.ts` — remova a linha inteira), `rosterIsFull` (do `capture.ts` — remova a linha inteira) e `takeId` (do `runtime.ts` — mantenha `findMon, replaceMon, takeRng`).

O import de `leveling.ts` deve ficar:
```typescript
import {
  allocatePoint as engineAllocate,
  evolveToLevel,
  pendingPoints,
} from '../engine/leveling.ts'
```
O import de `runtime.ts` deve ficar:
```typescript
import { findMon, replaceMon, takeRng } from './runtime.ts'
```

- [ ] **Step 7: Atualizar a entrada `fossil-stone` no catálogo**

Em `src/data/items.ts`, substitua a entrada `fossil-stone` por:

```typescript
  {
    id: 'fossil-stone',
    name: 'Fossil Stone',
    type: 'passive',
    price: 1000,
    description: 'Pokémon fósseis ganham +50% em batalhas.',
    sprite: sprite('fossil-stone'),
    effect: { kind: 'passive' },
  },
```

- [ ] **Step 8: Remover a suíte de teste do fóssil consumível**

Em `src/game/itemFlow.test.ts`, remova o bloco `describe('Fossil Stone (gera um fóssil)', () => { ... })` inteiro (as 3 it's: "adiciona um Pokémon fóssil…", "sem ouro é no-op", "quando o fóssil sai shiny…"). Depois, se `pokemonRank` (ou outro import) ficar sem uso, remova-o do import no topo do arquivo (o `npm run typecheck` aponta os não usados).

- [ ] **Step 9: Rodar testes e typecheck**

Run: `npx vitest run src/engine/itemEffects.test.ts src/game/itemFlow.test.ts src/data/items.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: sem erros (em especial, sem "declared but never used").

- [ ] **Step 10: Commit**

```bash
git add src/engine/balance.ts src/engine/itemEffects.ts src/data/types.ts src/game/marketFlow.ts src/data/items.ts src/game/itemFlow.test.ts src/engine/itemEffects.test.ts
git commit -m "feat(items): fossil-stone vira passivo (+50% batalha p/ fosseis)"
```

---

### Task 3: `electirizer` (bônus de próxima missão por raio)

**Files:**
- Modify: `src/engine/balance.ts`
- Modify: `src/engine/state.ts` (`GameState.electirizerCharges`, `MissionInstance.electirizerBonus`, `createInitialState`)
- Modify: `src/engine/secretEffects.ts` (`MissionSecretCtx`, `missionAttrMultiplier`)
- Modify: `src/game/stormFlow.ts` (`processStorms`)
- Modify: `src/game/missionFlow.ts` (`acceptMission`, `resolveMissionNow`)
- Modify: `src/data/items.ts` (`ITEMS`, `CITY_ITEM_IDS[2]`)
- Test: `src/engine/secretEffects.test.ts`
- Test: `src/game/stormFlow.test.ts`

**Interfaces:**
- Consumes: `MissionSecretCtx` (`secretEffects.ts`), `processStorms(s, prevMs, nowMs)`, `acceptMission(s, missionId, teamIds)`.
- Produces: `GameState.electirizerCharges: Record<string, number>`; `MissionInstance.electirizerBonus?: Record<string, number>`; `MissionSecretCtx.electirizerBonus?: Record<string, number>`; constante `ELECTIRIZER_MISSION_BONUS`.

- [ ] **Step 1: Escrever o teste de `missionAttrMultiplier` (unidade)**

Em `src/engine/secretEffects.test.ts`, adicione um teste que monta um `MissionSecretCtx` mínimo com `electirizerBonus` e verifica o multiplicador. Use o padrão de construção de ctx já existente no arquivo (reaproveite o helper/factory de Pokémon e de template do próprio teste). Exemplo:

```typescript
describe('missionAttrMultiplier — electirizer', () => {
  it('+50% por carga acumulada no Pokémon despachado', () => {
    const p = makeMon({ id: 'x' })
    const ctx: MissionSecretCtx = {
      team: [p],
      template: PATRULHA, // const já definida no topo do arquivo (template normal)
      runtime: {},
      runItems: [],
      electirizerBonus: { x: 2 }, // 2 raios → +100%
    }
    expect(missionAttrMultiplier(p, ctx)).toBeCloseTo(2) // 1 * (1 + 0.5*2)
  })

  it('sem carga, multiplicador é 1', () => {
    const p = makeMon({ id: 'y' })
    const ctx: MissionSecretCtx = { team: [p], template: PATRULHA, runtime: {}, runItems: [] }
    expect(missionAttrMultiplier(p, ctx)).toBeCloseTo(1)
  })
})
```

> `PATRULHA`, `makeMon`, `missionAttrMultiplier` e `MissionSecretCtx` já estão importados/definidos no topo de `secretEffects.test.ts`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: FAIL (`electirizerBonus` ainda não existe no ctx / não é aplicado; provável erro de tipo no teste OU resultado 1 onde se espera 2).

- [ ] **Step 3: Constante de balance**

Em `src/engine/balance.ts`:

```typescript
/** Electirizer: +50% no sucesso da próxima missão por raio sofrido (acumula por carga). */
export const ELECTIRIZER_MISSION_BONUS = 0.5
```

- [ ] **Step 4: Campos no estado**

Em `src/engine/state.ts`:
1. Na interface `MissionInstance`, após o campo `paralyzeHold?`, adicione:
```typescript
  /**
   * Electirizer: cargas de bônus (raios sofridos) por Pokémon, FIXADAS no despacho e consumidas
   * nesta missão — `id → nº de raios`. Cada carga vale +50% no sucesso. Ausente = sem bônus.
   */
  electirizerBonus?: Record<string, number>
```
2. Na interface `GameState`, após `runItems: string[]`, adicione:
```typescript
  /**
   * Electirizer: cargas de "próxima missão" acumuladas por Pokémon (raios sofridos), aguardando
   * despacho. Persiste até ser consumida (snapshot em acceptMission). Vazio = sem cargas pendentes.
   */
  electirizerCharges: Record<string, number>
```
3. Em `createInitialState`, no objeto retornado, após `runItems: [],` adicione:
```typescript
    electirizerCharges: {},
```

- [ ] **Step 5: Estender `MissionSecretCtx` e aplicar em `missionAttrMultiplier`**

Em `src/engine/secretEffects.ts`:
1. Acrescente `ELECTIRIZER_MISSION_BONUS` ao import de `./itemEffects.ts`? Não — vem de `./balance.ts`. Adicione `ELECTIRIZER_MISSION_BONUS` no import de `./balance.ts` (verifique o bloco de imports de balance no topo; se não houver, crie a linha de import).
2. Na interface `MissionSecretCtx`, adicione:
```typescript
  /** Electirizer: cargas de bônus por Pokémon (id → nº de raios) fixadas no despacho. */
  electirizerBonus?: Record<string, number>
```
3. Em `missionAttrMultiplier`, troque o final da função. Hoje é:
```typescript
  if (mult < 1 && ctx.team.some(hasClearBody)) return 1
  return mult
```
Passe a ser:
```typescript
  if (mult < 1 && ctx.team.some(hasClearBody)) mult = 1
  // Electirizer: bônus positivo da "próxima missão" (não é anulado pelo Clear Body).
  const charges = ctx.electirizerBonus?.[p.id] ?? 0
  if (charges > 0) mult *= 1 + ELECTIRIZER_MISSION_BONUS * charges
  return mult
```

- [ ] **Step 6: Rodar o teste de unidade e ver passar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: PASS.

- [ ] **Step 7: Teste de integração do raio (stormFlow)**

Em `src/game/stormFlow.test.ts`, adicione um teste que: monta um estado com `runItems: ['electirizer']`, um Pokémon em trânsito numa missão, força um raio sobre a posição dele e verifica `s.electirizerCharges[id] === 1`. Reaproveite o cenário/utilitários já usados no arquivo para posicionar o Pokémon e disparar o strike (o arquivo já testa Paralyze). Esboço:

```typescript
it('electirizer: raio acumula 1 carga no Pokémon atingido', () => {
  const s = /* estado do teste já usado para Paralyze neste arquivo */ buildStormScenario()
  s.runItems = ['electirizer']
  const id = s.missions[0]!.teamIds[0]!
  processStorms(s, prevMs, nowMs) // mesmos prevMs/nowMs que o teste de Paralyze usa para acertar
  expect(s.electirizerCharges[id]).toBe(1)
})

it('sem electirizer, nenhuma carga é criada', () => {
  const s = buildStormScenario()
  processStorms(s, prevMs, nowMs)
  expect(Object.keys(s.electirizerCharges)).toHaveLength(0)
})
```

> Use EXATAMENTE o mesmo arranjo do teste de Paralyze existente neste arquivo (mesmo Pokémon/posição/strike) para garantir o acerto. `processStorms`, `prevMs` e `nowMs` devem refletir o que já funciona ali.

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx vitest run src/game/stormFlow.test.ts`
Expected: FAIL (cargas não incrementam ainda).

- [ ] **Step 9: Incrementar carga em `processStorms`**

Em `src/game/stormFlow.ts`, dentro de `processStorms`, no laço `for (const id of hit) { ... }`, logo após a chamada `applyParalyze(s, id, pos, strike.strikeAtMs, frozenContainers)`:

```typescript
      // Electirizer: cada raio sofrido vira +1 carga de bônus para a PRÓXIMA missão deste Pokémon.
      if (s.runItems.includes('electirizer')) {
        const charges = (s.electirizerCharges ??= {})
        charges[id] = (charges[id] ?? 0) + 1
      }
```

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run src/game/stormFlow.test.ts`
Expected: PASS.

- [ ] **Step 11: Snapshot + consumo no despacho (`acceptMission`)**

Em `src/game/missionFlow.ts`, dentro de `acceptMission`, logo APÓS a validação do time (depois de `if (team.length < MIN_DISPATCH || team.length > MAX_DISPATCH) return`), adicione o snapshot:

```typescript
  // Electirizer: fixa (e consome) as cargas acumuladas dos membros despachados — bônus desta missão.
  const charges = (s.electirizerCharges ??= {})
  const electirizerBonus: Record<string, number> = {}
  for (const p of team) {
    if (charges[p.id]) {
      electirizerBonus[p.id] = charges[p.id]!
      delete charges[p.id]
    }
  }
```

No objeto `ctx` construído logo abaixo (o `const ctx: MissionSecretCtx = { team, template, runtime: s.today.secretRuntime, runItems: s.runItems }`), acrescente a propriedade:

```typescript
    electirizerBonus,
```

E, junto com os outros campos gravados na missão (perto de `mission.teamIds = ...`), grave o snapshot quando houver:

```typescript
  if (Object.keys(electirizerBonus).length > 0) mission.electirizerBonus = electirizerBonus
```

- [ ] **Step 12: Reusar o snapshot na resolução (`resolveMissionNow`)**

Ainda em `src/game/missionFlow.ts`, em `resolveMissionNow`, no `ctx` (`const ctx: MissionSecretCtx = { team, template, runtime: s.today.secretRuntime, runItems: s.runItems }`), acrescente:

```typescript
    electirizerBonus: mission.electirizerBonus,
```

Assim a `pSuccess` do preview (acceptMission) e a do desfecho (resolveMissionNow) usam o MESMO bônus.

- [ ] **Step 13: Adicionar o item ao catálogo + Vermilion**

Em `src/data/items.ts`, no array `ITEMS`:

```typescript
  {
    id: 'electirizer',
    name: 'Electirizer',
    type: 'passive',
    price: 650,
    description:
      'Quando um Pokémon seu é atingido por um raio, ele ganha +50% na próxima missão (acumula a cada raio).',
    sprite: sprite('electirizer'),
    effect: { kind: 'passive' },
  },
```

E adicione `'electirizer'` a `CITY_ITEM_IDS[2]`:

```typescript
  2: ['electirizer', 'dragon-fang', 'magnet'],
```

- [ ] **Step 14: Suíte completa + typecheck**

Run: `npx vitest run src/engine/secretEffects.test.ts src/game/stormFlow.test.ts src/data/items.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 15: Commit**

```bash
git add src/engine/balance.ts src/engine/state.ts src/engine/secretEffects.ts src/game/stormFlow.ts src/game/missionFlow.ts src/data/items.ts src/engine/secretEffects.test.ts src/game/stormFlow.test.ts
git commit -m "feat(items): electirizer (raio da bonus de +50% na proxima missao)"
```

---

### Task 4: `Shiny Charm` (+4% de chance de shiny)

**Files:**
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/shiny.ts`
- Modify: `src/game/captureFlow.ts`
- Modify: `src/components/day/CityMap.tsx`
- Modify: `src/data/items.ts`
- Test: `src/engine/shiny.test.ts`

**Interfaces:**
- Produces: `SHINY_CHARM_BONUS` (constants); `rollShiny(rng, chance?)`, `shinyForChance(chance, ...parts)`, `spotHasShinyChance(chance, seed, day, spotIndex)`, `shinyChance(runItems)` (shiny.ts).
- Consumes: `shinyFor`/`spotHasShiny` (mantidos com chance default).

- [ ] **Step 1: Escrever o teste que falha**

Em `src/engine/shiny.test.ts`:

```typescript
import { SHINY_CHANCE, SHINY_CHARM_BONUS } from './constants.ts'
import { shinyChance, shinyForChance } from './shiny.ts'

describe('shiny charm', () => {
  it('shinyChance soma +4% quando o item está na run', () => {
    expect(shinyChance([])).toBeCloseTo(SHINY_CHANCE)
    expect(shinyChance(['shiny-charm'])).toBeCloseTo(SHINY_CHANCE + SHINY_CHARM_BONUS)
  })

  it('é monotônico: tudo que era shiny a 1% segue shiny a 5%', () => {
    const base = SHINY_CHANCE
    const boosted = SHINY_CHANCE + SHINY_CHARM_BONUS
    for (let i = 0; i < 2000; i++) {
      if (shinyForChance(base, i)) expect(shinyForChance(boosted, i)).toBe(true)
    }
  })

  it('a chance maior produz MAIS shinies no agregado', () => {
    let lo = 0
    let hi = 0
    for (let i = 0; i < 5000; i++) {
      if (shinyForChance(SHINY_CHANCE, i)) lo++
      if (shinyForChance(SHINY_CHANCE + SHINY_CHARM_BONUS, i)) hi++
    }
    expect(hi).toBeGreaterThan(lo)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/shiny.test.ts`
Expected: FAIL (`SHINY_CHARM_BONUS`, `shinyChance`, `shinyForChance` não existem).

- [ ] **Step 3: Constante**

Em `src/engine/constants.ts`, logo após `export const SHINY_SEED_SALT = 0x5417`:

```typescript
/** Shiny Charm (item): bônus aditivo na chance de shiny enquanto possuído (0.01 → 0.05). */
export const SHINY_CHARM_BONUS = 0.04
```

- [ ] **Step 4: Variantes com chance em `shiny.ts`**

Substitua o conteúdo de `src/engine/shiny.ts` por:

```typescript
// Rolagem determinística de shiny. Decidida FORA de createPokemon e passada como flag,
// preservando as sequências de RNG existentes. Pré-aviso no mapa e captura usam o MESMO cálculo.
// A chance é parametrizável (Shiny Charm soma +4%); o mesmo saque de RNG é comparado a um limiar
// maior → MONOTÔNICO (comprar o charm nunca "des-shinya" nada).

import { createRng, deriveSeed, type Rng } from './rng.ts'
import { CAPTURE_CHOICES, SHINY_CHANCE, SHINY_CHARM_BONUS, SHINY_SEED_SALT } from './constants.ts'

/** Consome 1 saque do RNG: true se o Pokémon é shiny (chance default = SHINY_CHANCE). */
export function rollShiny(rng: Rng, chance: number = SHINY_CHANCE): boolean {
  return rng.next() < chance
}

/** Shiny determinístico com chance explícita, a partir de partes de seed (sal dedicado embutido). */
export function shinyForChance(chance: number, ...parts: number[]): boolean {
  return rollShiny(createRng(deriveSeed(SHINY_SEED_SALT, ...parts)), chance)
}

/** Shiny determinístico (chance base). Mantido para compatibilidade dos call sites sem itens. */
export function shinyFor(...parts: number[]): boolean {
  return shinyForChance(SHINY_CHANCE, ...parts)
}

/** True se algum dos CAPTURE_CHOICES candidatos do spot for shiny, com a chance dada. */
export function spotHasShinyChance(
  chance: number,
  seed: number,
  day: number,
  spotIndex: number,
): boolean {
  for (let slot = 0; slot < CAPTURE_CHOICES; slot++) {
    if (shinyForChance(chance, seed, day, spotIndex, slot)) return true
  }
  return false
}

/** Pré-aviso no mapa com a chance base (sem itens). */
export function spotHasShiny(seed: number, day: number, spotIndex: number): boolean {
  return spotHasShinyChance(SHINY_CHANCE, seed, day, spotIndex)
}

/** Chance efetiva de shiny dados os itens da run (Shiny Charm soma SHINY_CHARM_BONUS). */
export function shinyChance(runItems: readonly string[]): number {
  return SHINY_CHANCE + (runItems.includes('shiny-charm') ? SHINY_CHARM_BONUS : 0)
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/shiny.test.ts`
Expected: PASS. (Os testes antigos de `shinyFor`/`spotHasShiny` continuam passando — assinaturas preservadas.)

- [ ] **Step 6: Aplicar a chance na captura**

Em `src/game/captureFlow.ts`:
1. Troque o import `import { shinyFor } from '../engine/shiny.ts'` por `import { shinyChance, shinyForChance } from '../engine/shiny.ts'`.
2. Em `readySearch`, no `candidateShiny`, troque:
```typescript
    candidateShiny: encounter.candidates.map((_, i) =>
      shinyFor(s.run.seed, s.run.day, search.spotIndex, i),
    ),
```
por:
```typescript
    candidateShiny: encounter.candidates.map((_, i) =>
      shinyForChance(shinyChance(s.runItems), s.run.seed, s.run.day, search.spotIndex, i),
    ),
```

- [ ] **Step 7: Aplicar a chance no pré-aviso do mapa**

Em `src/components/day/CityMap.tsx`:
1. Troque o import `import { spotHasShiny } from '../../engine/shiny.ts'` por `import { shinyChance, spotHasShinyChance } from '../../engine/shiny.ts'`.
2. Na prop `shinyHere`, troque:
```typescript
shinyHere={spotHasShiny(state.run.seed, state.run.day, i)}
```
por:
```typescript
shinyHere={spotHasShinyChance(shinyChance(state.runItems), state.run.seed, state.run.day, i)}
```

- [ ] **Step 8: Adicionar o item (geral)**

Em `src/data/items.ts`, no array `ITEMS`:

```typescript
  {
    id: 'shiny-charm',
    name: 'Shiny Charm',
    type: 'passive',
    price: 1000,
    description: 'Aumenta em +4% a chance de encontrar Pokémon shiny.',
    sprite: sprite('shiny-charm'),
    effect: { kind: 'passive' },
  },
```

E adicione `'shiny-charm'` ao array `GLOBAL_ITEM_IDS` (ex.: após `'premier-ball'`).

- [ ] **Step 9: Testes + typecheck**

Run: `npx vitest run src/engine/shiny.test.ts src/game/captureShiny.test.ts src/data/items.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add src/engine/constants.ts src/engine/shiny.ts src/game/captureFlow.ts src/components/day/CityMap.tsx src/data/items.ts src/engine/shiny.test.ts
git commit -m "feat(items): shiny-charm (+4% de chance de shiny)"
```

---

### Task 5: `Moon Stone` (evoluir 1 estágio ignorando o nível)

**Files:**
- Modify: `src/data/types.ts` (`ItemEffect`: adicionar `moonStone`)
- Modify: `src/engine/leveling.ts` (`evolveOneStage`)
- Modify: `src/game/marketFlow.ts` (`useMoonStone`, case `moonStone`, imports)
- Modify: `src/game/actions.ts` (ação `USE_MOON_STONE`)
- Modify: `src/game/reducer.ts` (case `USE_MOON_STONE`)
- Modify: `src/data/items.ts` (`ITEMS`, `GLOBAL_ITEM_IDS`)
- Modify: `src/components/screens/MorningScreen.tsx` (modal + elegibilidade)
- Test: `src/engine/leveling.test.ts`
- Test: `src/game/itemFlow.test.ts`

**Interfaces:**
- Produces: `evolveOneStage(p: Pokemon, rng: Rng): Pokemon`; `useMoonStone(s: GameState, pokemonId: string): void`; ação `{ type: 'USE_MOON_STONE'; pokemonId: string }`; item `moon-stone` com `effect: { kind: 'moonStone' }`.

- [ ] **Step 1: Teste de `evolveOneStage` (unidade)**

Em `src/engine/leveling.test.ts`:

```typescript
import { createRng } from './rng.ts'
import { createPokemon, evolveOneStage } from './leveling.ts'

describe('evolveOneStage (Moon Stone)', () => {
  it('evolui 1 estágio mantendo o nível, ignorando atLevel', () => {
    // Bulbasaur (1) → Ivysaur (2). Nível 1 (abaixo do atLevel de evolução).
    const bulba = createPokemon({ id: 'b', speciesId: 1, level: 1, rng: createRng(1) })
    const evolved = evolveOneStage(bulba, createRng(2))
    expect(evolved.speciesId).toBe(2)
    expect(evolved.level).toBe(1)
  })

  it('espécie final retorna inalterada', () => {
    // Venusaur (3) não evolui.
    const venu = createPokemon({ id: 'v', speciesId: 3, level: 5, rng: createRng(1) })
    expect(evolveOneStage(venu, createRng(2)).speciesId).toBe(3)
  })

  it('NÃO encadeia: só um estágio por chamada', () => {
    // Charmander (4) → Charmeleon (5), não Charizard (6).
    const char = createPokemon({ id: 'c', speciesId: 4, level: 9, rng: createRng(1) })
    expect(evolveOneStage(char, createRng(2)).speciesId).toBe(5)
  })
})
```

> Confirme os ids/linhas em `src/data/pokemon/evolutions.generated.ts` (1→2→3, 4→5→6 já verificados). Se algum `createPokemon` exigir campos extras, siga o padrão dos testes existentes no arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/leveling.test.ts`
Expected: FAIL (`evolveOneStage` não existe).

- [ ] **Step 3: Implementar `evolveOneStage`**

Em `src/engine/leveling.ts`, logo após a função `evolveToLevel` (a `evolveInto` privada já existe abaixo e será reutilizada):

```typescript
/**
 * Evolui UM estágio ignorando o nível (Moon Stone): troca para a próxima forma (sorteando o ramo
 * com `rng`, ex.: Eevee) mantendo nível/XP/alocações e a PROPORÇÃO de HP. Espécie final → inalterada.
 */
export function evolveOneStage(p: Pokemon, rng: Rng): Pokemon {
  const evo = getSpecies(p.speciesId).evolvesTo
  if (!evo) return p
  return evolveInto(p, rng.pick(evo.ids))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/leveling.test.ts`
Expected: PASS.

- [ ] **Step 5: `moonStone` no tipo `ItemEffect`**

Em `src/data/types.ts`, na união `ItemEffect`, adicione:

```typescript
  | { kind: 'moonStone' }
```

No comentário-doc acima da união, acrescente uma linha descrevendo `moonStone` (escolhe um Pokémon do time/caixa para evoluir 1 estágio ignorando o nível).

- [ ] **Step 6: Teste de `useMoonStone` via reducer (time e caixa)**

Em `src/game/itemFlow.test.ts`, adicione:

```typescript
describe('Moon Stone (evolui ignorando o nível)', () => {
  it('evolui um Pokémon do time e cobra 700', () => {
    let s = createInitialState(SEED)
    s.gold = 700
    s.roster = [makeMon({ id: 'a', speciesId: 1, level: 1 })] // Bulbasaur
    s = reducer(s, { type: 'USE_MOON_STONE', pokemonId: 'a' })
    expect(s.roster[0]!.speciesId).toBe(2) // Ivysaur
    expect(s.gold).toBe(0)
  })

  it('evolui um Pokémon da caixa', () => {
    let s = createInitialState(SEED)
    s.gold = 700
    s.box = [makeMon({ id: 'bx', speciesId: 4, level: 1 })] // Charmander
    s = reducer(s, { type: 'USE_MOON_STONE', pokemonId: 'bx' })
    expect(s.box[0]!.speciesId).toBe(5) // Charmeleon
    expect(s.gold).toBe(0)
  })

  it('sem ouro é no-op', () => {
    let s = createInitialState(SEED)
    s.gold = 100
    s.roster = [makeMon({ id: 'a', speciesId: 1, level: 1 })]
    s = reducer(s, { type: 'USE_MOON_STONE', pokemonId: 'a' })
    expect(s.roster[0]!.speciesId).toBe(1)
    expect(s.gold).toBe(100)
  })
})
```

> Use a mesma factory `makeMon` e a constante `SEED` já presentes no arquivo. `makeMon` deve aceitar `speciesId`/`level` (já usado nos testes do Rare Candy).

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/game/itemFlow.test.ts`
Expected: FAIL (`USE_MOON_STONE` desconhecido / sem efeito).

- [ ] **Step 8: `useMoonStone` em `marketFlow.ts`**

Em `src/game/marketFlow.ts`:
1. Adicione os imports: `import { getSpecies } from '../data/pokemon/index.ts'` e inclua `evolveOneStage` no import de `../engine/leveling.ts`:
```typescript
import {
  allocatePoint as engineAllocate,
  evolveOneStage,
  evolveToLevel,
  pendingPoints,
} from '../engine/leveling.ts'
```
2. No `switch (effect.kind)` de `buyItem`, junto ao `case 'rareCandy':`, acrescente um case irmão (alvo escolhido depois, via ação dedicada):
```typescript
    case 'moonStone':
      // Precisa de um alvo escolhido na compra → tratado por useMoonStone (ação dedicada).
      return
```
3. Adicione a função (perto de `useRareCandy`):
```typescript
/**
 * Moon Stone: evolui o Pokémon escolhido (time OU caixa) um estágio, ignorando o nível (sorteia o
 * ramo). Sem ouro, alvo inexistente, que não evolui, ou já comprado hoje → no-op (a UI bloqueia).
 */
export function useMoonStone(s: GameState, pokemonId: string): void {
  const item = getItem('moon-stone')
  if (s.today.purchasedItems.includes(item.id)) return
  const fromRoster = s.roster.find((p) => p.id === pokemonId)
  const target = fromRoster ?? s.box.find((p) => p.id === pokemonId)
  if (!target || getSpecies(target.speciesId).evolvesTo === null || !canAfford(s.gold, item)) return
  s.gold -= item.price
  const evolved = evolveOneStage(target, takeRng(s))
  if (fromRoster) s.roster = s.roster.map((p) => (p.id === pokemonId ? evolved : p))
  else s.box = s.box.map((p) => (p.id === pokemonId ? evolved : p))
  markSold(s, item.id)
}
```

- [ ] **Step 9: Ação + reducer**

Em `src/game/actions.ts`, após a ação `USE_RARE_CANDY`:
```typescript
  /** Compra uma Moon Stone e evolui (1 estágio, ignorando o nível) o Pokémon escolhido — PLAN — Itens. */
  | { type: 'USE_MOON_STONE'; pokemonId: string }
```

Em `src/game/reducer.ts`:
1. No import de `./marketFlow.ts`, acrescente `useMoonStone`:
```typescript
import { allocatePoint, applyItem, buyBall, buyItem, useMoonStone, useRareCandy } from './marketFlow.ts'
```
2. Após o `case 'USE_RARE_CANDY':`:
```typescript
    case 'USE_MOON_STONE':
      useMoonStone(s, action.pokemonId)
      break
```

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run src/game/itemFlow.test.ts`
Expected: PASS.

- [ ] **Step 11: Item no catálogo (geral)**

Em `src/data/items.ts`, no array `ITEMS`:
```typescript
  {
    id: 'moon-stone',
    name: 'Moon Stone',
    type: 'consumable',
    price: 700,
    description: 'Escolha um Pokémon para evoluir na hora, mesmo sem o nível.',
    sprite: sprite('moon-stone'),
    effect: { kind: 'moonStone' },
  },
```
E adicione `'moon-stone'` ao array `GLOBAL_ITEM_IDS`.

- [ ] **Step 12: Modal + elegibilidade na `MorningScreen`**

Em `src/components/screens/MorningScreen.tsx`:

1. Em `shopState`, antes do `return` final, adicione o ramo do Moon Stone (espelha o do Rare Candy, mas elegibilidade = existir Pokémon evoluível no time OU caixa):
```typescript
  if (item.effect.kind === 'moonStone') {
    const anyEvolvable = [...state.roster, ...state.box].some(
      (p) => getSpecies(p.speciesId).evolvesTo !== null,
    )
    return { label: `$ ${item.price}`, disabled: !afford || !anyEvolvable, sold: false, needsTarget: true }
  }
```

2. No componente `MorningScreen`, adicione o estado do modal (junto ao `candyOpen`):
```typescript
  const [moonOpen, setMoonOpen] = useState(false)
```

3. Na função `buy`, trate o Moon Stone:
```typescript
  const buy = (item: ItemData): void => {
    if (item.effect.kind === 'rareCandy') setCandyOpen(true)
    else if (item.effect.kind === 'moonStone') setMoonOpen(true)
    else dispatch({ type: 'BUY_ITEM', itemId: item.id })
  }
```

4. Adicione o handler de escolha (junto a `pickCandyTarget`):
```typescript
  const pickMoonTarget = (pokemonId: string): void => {
    dispatch({ type: 'USE_MOON_STONE', pokemonId })
    setMoonOpen(false)
  }
```

5. Logo após o bloco `{candyOpen && ( ... )}`, adicione o modal do Moon Stone (reusa as classes do Rare Candy):
```tsx
      {moonOpen && (
        <Overlay title="MOON STONE — ESCOLHA UM POKÉMON" onClose={() => setMoonOpen(false)}>
          <p className={styles.candyHint}>O Pokémon escolhido evolui na hora, mesmo sem o nível.</p>
          <div className={styles.candyList}>
            {[...state.roster, ...state.box]
              .filter((mon) => getSpecies(mon.speciesId).evolvesTo !== null)
              .map((mon) => {
                const species = getSpecies(mon.speciesId)
                return (
                  <button
                    key={mon.id}
                    type="button"
                    className={styles.candyRow}
                    onClick={() => pickMoonTarget(mon.id)}
                    data-sound="select"
                  >
                    <img className={styles.candyImg} src={species.spritePath} alt="" />
                    <span className={styles.candyMain}>
                      <span className={styles.candyName}>
                        {displayNameOf(mon)}
                        <span className={styles.candyLvl}>Nv {mon.level}</span>
                      </span>
                    </span>
                    <span className={styles.candyPlus}>Evoluir</span>
                  </button>
                )
              })}
          </div>
        </Overlay>
      )}
```

- [ ] **Step 13: Build completo (inclui tsc + vite) + testes**

Run: `npx vitest run src/game/itemFlow.test.ts src/engine/leveling.test.ts src/data/items.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: build sem erros (tsc -b + vite build).

- [ ] **Step 14: Commit**

```bash
git add src/data/types.ts src/engine/leveling.ts src/game/marketFlow.ts src/game/actions.ts src/game/reducer.ts src/data/items.ts src/components/screens/MorningScreen.tsx src/engine/leveling.test.ts src/game/itemFlow.test.ts
git commit -m "feat(items): moon-stone (evolui 1 estagio ignorando o nivel, time/caixa)"
```

---

## Verificação final (após todas as tasks)

- [ ] **Suíte completa**: `npm test` → tudo verde.
- [ ] **Build**: `npm run build` → sem erros.
- [ ] **Lint**: `npm run lint` → sem erros novos (em especial imports não usados removidos no Task 2).

## Self-Review (cobertura do spec)

- §1 electirizer → Task 3 (cargas, snapshot, consumo, +50% acumulável).
- §2 dragon-fang / §3 magnet → Task 1.
- §4 fossil-stone passivo → Task 2 (remove grant, +50% batalha p/ fósseis, 1000g).
- §5 Shiny Charm → Task 4 (+4%, monotônico, captura + mapa).
- §6 Moon Stone → Task 5 (1 estágio, ramo aleatório, mantém nível, time + caixa, bloqueio sem evoluível).
- Catálogo/cidades/sprites → distribuído entre as tasks; sprites já existem no disco.
- Constantes de balance → criadas nas tasks 1–4.
