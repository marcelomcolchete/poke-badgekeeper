# Itens globais + itens de cidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 23 itens novos (6 berries, Everstone, Poke Egg no pool global; 15 itens distribuídos por 5 cidades) e ajustar o Shiny Charm, estendendo o sistema de itens existente.

**Architecture:** Estende o catálogo (`src/data/items.ts`), os hooks puros de engine (`itemEffects.ts`, `gymDefense.ts`, `missions.ts`, `secretEffects.ts`, `economy.ts`) e o `GameState`. Itens passivos usam `{ kind: 'passive' }` + checagem por id (padrão de thick-club/eviolite); berries/ovo/big-nugget ganham `ItemEffect` tipado próprio. Tudo determinístico via RNG semeado.

**Tech Stack:** TypeScript, React 19, Vite, Vitest. Estado puro via reducer; sem libs externas novas.

## Global Constraints

- Índices de cidade (de `CITIES`): Pewter 0 · Cerulean 1 · Vermilion 2 · **Celadon 3 · Fuchsia 4 · Saffron 5 · Cinnabar 6 · Viridian 7**.
- Atributos (`ATTR_KEYS`): `batalha`, `inteligencia`, `carisma`, `agilidade`, `resistencia`, `percepcao`. Cap efetivo `ATTR_MAX = 60`.
- Rank por IVs (não por espécie): índices `RANKS = ['F','E','D','C','B','A','S']` → B=4, A=5, S=6.
- Determinismo: usar sempre `takeRng(s)` / RNG semeado. Nunca `Math.random`/`Date.now`.
- Sprites já existem em `public/sprites/itens/` (inclui `everstone.png`). Caminho via helper `sprite(id)` em `items.ts`.
- Validar tipos com `npm run build` (tsc -b); rodar testes com `npx vitest run <arquivo>`.
- Multiplicadores de batalha são MULTIPLICATIVOS (compõem entre si), igual ao `itemBattleMultiplier` atual.
- Cada item novo precisa: entrada no `ITEMS` + id em `GLOBAL_ITEM_IDS` ou `CITY_ITEM_IDS[n]`.

---

## Task 1: Ajuste de balanceamento do Shiny Charm

**Files:**
- Modify: `src/engine/constants.ts:72`
- Test: `src/engine/shiny.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `SHINY_CHARM_BONUS = 0.19` (lido por `shinyChance` em `shiny.ts`).

- [ ] **Step 1: Atualizar o teste existente do Shiny Charm**

Em `src/engine/shiny.test.ts`, localizar o bloco `describe('shiny charm', ...)` e ajustar o valor esperado:

```typescript
describe('shiny charm', () => {
  it('shinyChance soma +19% quando o item está na run', () => {
    expect(shinyChance([])).toBeCloseTo(SHINY_CHANCE)
    expect(shinyChance(['shiny-charm'])).toBeCloseTo(SHINY_CHANCE + 0.19)
    expect(shinyChance(['shiny-charm'])).toBeCloseTo(0.2)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/shiny.test.ts`
Expected: FAIL (esperava 0.05, recebeu 0.05 com a constante antiga — o `toBeCloseTo(0.2)` falha).

- [ ] **Step 3: Alterar a constante**

Em `src/engine/constants.ts`, trocar a linha 72:

```typescript
/** Shiny Charm (item): bônus aditivo na chance de shiny enquanto possuído (0.01 → 0.20). */
export const SHINY_CHARM_BONUS = 0.19
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/shiny.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/constants.ts src/engine/shiny.test.ts
git commit -m "balance: Shiny Charm +4% -> +19% (20% com o charm)"
```

---

## Task 2: Itens de +50% batalha por tipo (grassy-seed, black-sludge, twisted-spoon, charcoal)

**Files:**
- Modify: `src/engine/balance.ts` (após a linha 448), `src/engine/itemEffects.ts`, `src/data/items.ts`
- Test: `src/engine/itemEffects.test.ts`

**Interfaces:**
- Consumes: `itemBattleMultiplier(p, runItems)`, `hasRunItem`.
- Produces: ids passivos `grassy-seed`/`black-sludge`/`twisted-spoon`/`charcoal` reconhecidos por `itemBattleMultiplier`.

- [ ] **Step 1: Escrever o teste**

Adicionar em `src/engine/itemEffects.test.ts`, dentro do `describe('itemBattleMultiplier', ...)` (criar o describe se não houver):

```typescript
describe('itemBattleMultiplier — boosts por tipo novos', () => {
  it('Grassy Seed: +50% para Grama', () => {
    const grass = makeMon({ speciesId: BULBASAUR }) // Bulbasaur é grass/poison
    expect(itemBattleMultiplier(grass, ['grassy-seed'])).toBeCloseTo(1.5)
  })
  it('Black Sludge: +50% para Veneno', () => {
    const poison = makeMon({ speciesId: BULBASAUR }) // grass/poison
    expect(itemBattleMultiplier(poison, ['black-sludge'])).toBeCloseTo(1.5)
  })
  it('não afeta tipos diferentes', () => {
    const fireMon = makeMon({ speciesId: 4 }) // Charmander é fire
    expect(itemBattleMultiplier(fireMon, ['grassy-seed'])).toBe(1)
    expect(itemBattleMultiplier(fireMon, ['charcoal'])).toBeCloseTo(1.5)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/itemEffects.test.ts`
Expected: FAIL (multiplicador 1, não 1.5).

- [ ] **Step 3: Adicionar as constantes**

Em `src/engine/balance.ts`, após a linha 448 (`MYSTIC_WATER_BATTLE_MULT`):

```typescript
/** Itens de cidade: +50% em batalhas para Pokémon do tipo correspondente. */
export const GRASSY_SEED_BATTLE_MULT = 1.5
export const BLACK_SLUDGE_BATTLE_MULT = 1.5
export const TWISTED_SPOON_BATTLE_MULT = 1.5
export const CHARCOAL_BATTLE_MULT = 1.5
```

- [ ] **Step 4: Estender `itemBattleMultiplier`**

Em `src/engine/itemEffects.ts`, adicionar as constantes ao import do `./balance.ts` (junto de `THICK_CLUB_BATTLE_MULT`):

```typescript
  BLACK_SLUDGE_BATTLE_MULT,
  CHARCOAL_BATTLE_MULT,
  GRASSY_SEED_BATTLE_MULT,
  TWISTED_SPOON_BATTLE_MULT,
```

E, dentro de `itemBattleMultiplier`, antes da linha `if (hasRunItem(runItems, 'lagging-tail'))`:

```typescript
  if (hasRunItem(runItems, 'grassy-seed') && p.types.includes('grass')) {
    mult *= GRASSY_SEED_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'black-sludge') && p.types.includes('poison')) {
    mult *= BLACK_SLUDGE_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'twisted-spoon') && p.types.includes('psychic')) {
    mult *= TWISTED_SPOON_BATTLE_MULT
  }
  if (hasRunItem(runItems, 'charcoal') && p.types.includes('fire')) {
    mult *= CHARCOAL_BATTLE_MULT
  }
```

- [ ] **Step 5: Adicionar entradas no catálogo**

Em `src/data/items.ts`, dentro do array `ITEMS` (antes do `]` final), adicionar:

```typescript
  {
    id: 'grassy-seed',
    name: 'Grassy Seed',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Grama ganham +50% em batalhas.',
    sprite: sprite('grassy-seed'),
    effect: { kind: 'passive' },
  },
  {
    id: 'black-sludge',
    name: 'Black Sludge',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Venenoso ganham +50% em batalhas.',
    sprite: sprite('black-sludge'),
    effect: { kind: 'passive' },
  },
  {
    id: 'twisted-spoon',
    name: 'Twisted Spoon',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Psíquico ganham +50% em batalhas.',
    sprite: sprite('twisted-spoon'),
    effect: { kind: 'passive' },
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Fogo ganham +50% em batalhas.',
    sprite: sprite('charcoal'),
    effect: { kind: 'passive' },
  },
```

- [ ] **Step 6: Registrar nas cidades**

Em `src/data/items.ts`, substituir o objeto `CITY_ITEM_IDS` (linhas 262-266) para incluir as cidades novas:

```typescript
/** Itens EXTRAS por cidade (índice de CITIES). */
export const CITY_ITEM_IDS: Record<number, string[]> = {
  0: ['lagging-tail', 'thick-club', 'fossil-stone'],
  1: ['mystic-water', 'surfboard', 'fresh-water'],
  2: ['electirizer', 'dragon-fang', 'magnet'],
  3: ['grassy-seed'],
  4: ['black-sludge'],
  5: ['twisted-spoon'],
  6: ['charcoal'],
  7: [],
}
```

(As demais entradas de cada cidade são adicionadas nas tasks seguintes.)

- [ ] **Step 7: Rodar testes e build**

Run: `npx vitest run src/engine/itemEffects.test.ts && npm run build`
Expected: PASS + build sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/engine/balance.ts src/engine/itemEffects.ts src/engine/itemEffects.test.ts src/data/items.ts
git commit -m "feat(itens): boosts de batalha por tipo (grassy-seed, black-sludge, twisted-spoon, charcoal)"
```

---

## Task 3: Itens de +50% efetividade por tipo de missão (wise-glasses, zoom-lens, wide-lens)

**Files:**
- Modify: `src/engine/balance.ts`, `src/engine/itemEffects.ts`, `src/engine/missions.ts`, `src/data/items.ts`
- Test: `src/engine/itemEffects.test.ts`

**Interfaces:**
- Consumes: `MissionSecretCtx` (tem `template` e `runItems`), `missionSuccessProbabilityCtx`, `teamSecretSum`, `mapAttrs`.
- Produces: `missionTypeItemMultiplier(templateId: string, runItems: readonly string[]): number`.

- [ ] **Step 1: Escrever o teste**

Adicionar em `src/engine/itemEffects.test.ts`:

```typescript
import { missionTypeItemMultiplier } from './itemEffects.ts'

describe('missionTypeItemMultiplier', () => {
  it('wise-glasses: +50% só em Ensino', () => {
    expect(missionTypeItemMultiplier('ensino', ['wise-glasses'])).toBeCloseTo(1.5)
    expect(missionTypeItemMultiplier('escolta', ['wise-glasses'])).toBe(1)
  })
  it('zoom-lens: +50% só em Escolta; wide-lens: só em Investigação', () => {
    expect(missionTypeItemMultiplier('escolta', ['zoom-lens'])).toBeCloseTo(1.5)
    expect(missionTypeItemMultiplier('investigacao', ['wide-lens'])).toBeCloseTo(1.5)
    expect(missionTypeItemMultiplier('ensino', ['zoom-lens'])).toBe(1)
  })
  it('sem item = 1', () => {
    expect(missionTypeItemMultiplier('ensino', [])).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/itemEffects.test.ts`
Expected: FAIL (`missionTypeItemMultiplier` não existe).

- [ ] **Step 3: Adicionar constantes**

Em `src/engine/balance.ts`, após as constantes da Task 2:

```typescript
/** Lentes de cidade: +50% de poder do time num tipo específico de missão. */
export const WISE_GLASSES_MISSION_MULT = 1.5
export const ZOOM_LENS_MISSION_MULT = 1.5
export const WIDE_LENS_MISSION_MULT = 1.5
```

- [ ] **Step 4: Criar `missionTypeItemMultiplier`**

Em `src/engine/itemEffects.ts`, importar do `./balance.ts`:

```typescript
  WIDE_LENS_MISSION_MULT,
  WISE_GLASSES_MISSION_MULT,
  ZOOM_LENS_MISSION_MULT,
```

E adicionar a função (após `itemMissionMultiplier`):

```typescript
/**
 * Multiplicador de poder do time vindo de itens ligados a UM tipo de missão (1 = sem efeito):
 *  - Wise Glasses: +50% em Ensino (estudo).
 *  - Zoom Lens: +50% em Escolta (resistência/escolta).
 *  - Wide Lens: +50% em Investigação.
 */
export function missionTypeItemMultiplier(templateId: string, runItems: readonly string[]): number {
  if (hasRunItem(runItems, 'wise-glasses') && templateId === 'ensino') return WISE_GLASSES_MISSION_MULT
  if (hasRunItem(runItems, 'zoom-lens') && templateId === 'escolta') return ZOOM_LENS_MISSION_MULT
  if (hasRunItem(runItems, 'wide-lens') && templateId === 'investigacao') return WIDE_LENS_MISSION_MULT
  return 1
}
```

- [ ] **Step 5: Aplicar no cálculo de sucesso da missão**

Em `src/engine/missions.ts`, adicionar aos imports:

```typescript
import { mapAttrs } from './attributes.ts'
import { missionTypeItemMultiplier } from './itemEffects.ts'
```

(Se já houver import de `./itemEffects.ts`, apenas acrescentar `missionTypeItemMultiplier` a ele.)

Substituir o corpo de `missionSuccessProbabilityCtx` (linhas 174-182) por:

```typescript
export function missionSuccessProbabilityCtx(ctx: MissionSecretCtx, requirement: Attrs): number {
  const requiredArea = hexagonArea(requirement)
  if (requiredArea <= 0) return 1
  const summed = teamSecretSum(ctx)
  // Lentes de cidade: +50% de poder do time no tipo de missão correspondente.
  const typeMult = missionTypeItemMultiplier(ctx.template.id, ctx.runItems)
  const boosted = typeMult === 1 ? summed : mapAttrs((k) => summed[k] * typeMult)
  const intersection = hexagonArea(axisMin(boosted, requirement))
  const base = clamp(intersection / requiredArea, 0, 1)
  return teamHasVitalSpirit(ctx.team) ? 1 - (1 - base) ** 2 : base
}
```

- [ ] **Step 6: Catálogo + cidades**

Em `src/data/items.ts`, adicionar ao `ITEMS`:

```typescript
  {
    id: 'wise-glasses',
    name: 'Wise Glasses',
    type: 'passive',
    price: 1000,
    description: '+50% de poder do time em missões de Ensino (estudo).',
    sprite: sprite('wise-glasses'),
    effect: { kind: 'passive' },
  },
  {
    id: 'zoom-lens',
    name: 'Zoom Lens',
    type: 'passive',
    price: 1000,
    description: '+50% de poder do time em missões de Escolta.',
    sprite: sprite('zoom-lens'),
    effect: { kind: 'passive' },
  },
  {
    id: 'wide-lens',
    name: 'Wide Lens',
    type: 'passive',
    price: 1000,
    description: '+50% de poder do time em missões de Investigação.',
    sprite: sprite('wide-lens'),
    effect: { kind: 'passive' },
  },
```

E em `CITY_ITEM_IDS`: `5: ['twisted-spoon', 'wise-glasses']`, `6: ['charcoal', 'zoom-lens']`, `7: ['wide-lens']`.

- [ ] **Step 7: Testes e build**

Run: `npx vitest run src/engine/itemEffects.test.ts src/engine/missions.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 8: Commit**

```bash
git add src/engine/balance.ts src/engine/itemEffects.ts src/engine/missions.ts src/engine/itemEffects.test.ts src/data/items.ts
git commit -m "feat(itens): lentes de efetividade por tipo de missao (wise-glasses, zoom-lens, wide-lens)"
```

---

## Task 4: Ouro — amulet-coin (+50% todas as fontes) e big-nugget (instantGold)

**Files:**
- Modify: `src/engine/balance.ts`, `src/engine/economy.ts`, `src/data/types.ts`, `src/game/marketFlow.ts`, `src/game/defenseFlow.ts:131`, `src/game/missionFlow.ts:417`, `src/data/items.ts`
- Test: `src/engine/economy.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `goldForDefense`, `goldForMart`, `canAfford`, `markSold`.
- Produces: `applyGoldBonus(amount: number, runItems: readonly string[]): number`; novo `ItemEffect` `{ kind: 'instantGold'; amount: number }`.

- [ ] **Step 1: Escrever o teste**

Criar/edit `src/engine/economy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { applyGoldBonus } from './economy.ts'

describe('applyGoldBonus', () => {
  it('sem amulet-coin não muda o valor', () => {
    expect(applyGoldBonus(200, [])).toBe(200)
  })
  it('amulet-coin dá +50% (arredondado)', () => {
    expect(applyGoldBonus(200, ['amulet-coin'])).toBe(300)
    expect(applyGoldBonus(101, ['amulet-coin'])).toBe(152) // round(151.5)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: FAIL (`applyGoldBonus` não existe).

- [ ] **Step 3: Constante + função**

Em `src/engine/balance.ts`, após as constantes da Task 3:

```typescript
/** Amulet Coin: +50% de ouro de todas as fontes. */
export const AMULET_COIN_GOLD_MULT = 1.5
/** Big Nugget: ouro instantâneo concedido na compra. */
export const BIG_NUGGET_GOLD = 200
```

Em `src/engine/economy.ts`, adicionar ao import do `./balance.ts` o `AMULET_COIN_GOLD_MULT` e criar:

```typescript
/** Aplica o bônus de ouro de itens (Amulet Coin: +50%) sobre um valor já calculado. */
export function applyGoldBonus(amount: number, runItems: readonly string[]): number {
  return Math.round(amount * (runItems.includes('amulet-coin') ? AMULET_COIN_GOLD_MULT : 1))
}
```

- [ ] **Step 4: Novo `ItemEffect` instantGold**

Em `src/data/types.ts`, na união `ItemEffect` (após `moonStone`):

```typescript
  | { kind: 'instantGold'; amount: number }
```

- [ ] **Step 5: Compra do big-nugget + import**

Em `src/game/marketFlow.ts`, adicionar ao import de `../engine/economy.ts`:

```typescript
import { applyGoldBonus, canAfford } from '../engine/economy.ts'
```

E no `switch (effect.kind)` de `buyItem`, antes do `case 'rareCandy':`:

```typescript
    case 'instantGold': {
      // Big Nugget: paga na hora (×1.5 com Amulet Coin). Preço normalmente 0.
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      s.gold += applyGoldBonus(effect.amount, s.runItems)
      markSold(s, itemId)
      return
    }
```

- [ ] **Step 6: Aplicar +50% nas fontes de ouro**

Em `src/game/defenseFlow.ts`, importar `applyGoldBonus` de `../engine/economy.ts` e trocar a linha 131:

```typescript
  const gold = applyGoldBonus(goldForDefense(squad), s.runItems)
```

Em `src/game/missionFlow.ts`, importar `applyGoldBonus` de `../engine/economy.ts` e trocar a linha 417:

```typescript
    const gold = applyGoldBonus(goldForMart(team, template.goldOnSuccess), s.runItems)
```

- [ ] **Step 7: Catálogo + cidades**

Em `src/data/items.ts` (importar `BIG_NUGGET_GOLD` de `../engine/balance.ts` no topo) e adicionar ao `ITEMS`:

```typescript
  {
    id: 'amulet-coin',
    name: 'Amulet Coin',
    type: 'passive',
    price: 800,
    description: 'Receba +50% de ouro de todas as fontes.',
    sprite: sprite('amulet-coin'),
    effect: { kind: 'passive' },
  },
  {
    id: 'big-nugget',
    name: 'Big Nugget',
    type: 'consumable',
    price: 0,
    description: 'Ao comprar, receba 200 de ouro na hora.',
    sprite: sprite('big-nugget'),
    effect: { kind: 'instantGold', amount: BIG_NUGGET_GOLD },
  },
```

Em `CITY_ITEM_IDS`: `4: ['black-sludge', 'big-nugget']`, `7: ['wide-lens', 'amulet-coin']`.

- [ ] **Step 8: Testes e build**

Run: `npx vitest run src/engine/economy.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 9: Commit**

```bash
git add src/engine/balance.ts src/engine/economy.ts src/engine/economy.test.ts src/data/types.ts src/game/marketFlow.ts src/game/defenseFlow.ts src/game/missionFlow.ts src/data/items.ts
git commit -m "feat(itens): amulet-coin (+50% ouro) e big-nugget (ouro instantaneo)"
```

---

## Task 5: Itens de duelo — grip-claw (+5 batalha) e sticky-barb (-1 HP, oponente -25%)

**Files:**
- Modify: `src/engine/balance.ts`, `src/engine/gymDefense.ts`, `src/data/items.ts`
- Test: `src/engine/gymDefense.test.ts`

**Interfaces:**
- Consumes: `resolveDefense(rng, squad, enemies, opts)` (recebe `opts.runItems`), `hasRunItem`, `applyDamage`.
- Produces: efeitos de `grip-claw`/`sticky-barb` dentro do laço de duelo.

- [ ] **Step 1: Escrever o teste**

Adicionar em `src/engine/gymDefense.test.ts` (usar os helpers já existentes no arquivo — `makeMon`/`EnemyUnit` mock; espelhar o estilo dos testes vizinhos):

```typescript
describe('itens de duelo', () => {
  it('grip-claw: +5 de Batalha aumenta a chance de vitória', () => {
    const you = makeMon({ speciesId: 1, ivs: { batalha: 0 } as never })
    const enemy = { battle: 20, types: ['normal'] as const } // ajuste ao shape de EnemyUnit do arquivo
    const semItem = resolveDefense(createRng(1), [you], [enemy as never], { runItems: [] })
    const comItem = resolveDefense(createRng(1), [you], [enemy as never], { runItems: ['grip-claw'] })
    // Com +5 de Batalha, pWin do primeiro duelo é maior.
    expect(comItem.duels[0]!.pWin).toBeGreaterThan(semItem.duels[0]!.pWin)
  })
  it('sticky-barb: reduz o poder do oponente (pWin maior) e custa 1 HP por duelo', () => {
    const you = makeMon({ speciesId: 1 })
    const enemy = { battle: 30, types: ['normal'] as const }
    const semItem = resolveDefense(createRng(2), [you], [enemy as never], { runItems: [] })
    const comItem = resolveDefense(createRng(2), [you], [enemy as never], { runItems: ['sticky-barb'] })
    expect(comItem.duels[0]!.pWin).toBeGreaterThan(semItem.duels[0]!.pWin)
    // O Pokémon perde ao menos 1 HP ao entrar no duelo.
    expect(comItem.squad[0]!.currentHp).toBeLessThan(you.currentHp)
  })
})
```

(Ajustar o literal `enemy` ao tipo `EnemyUnit` real do arquivo de teste; reusar o factory de inimigo já presente em `gymDefense.test.ts`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/gymDefense.test.ts`
Expected: FAIL (sem efeito dos itens).

- [ ] **Step 3: Constantes**

Em `src/engine/balance.ts`, após `BIG_NUGGET_GOLD`:

```typescript
/** Grip Claw: bônus fixo de Batalha em duelos de defesa. */
export const GRIP_CLAW_BATTLE_FLAT = 5
/** Sticky Barb: custo de HP por duelo e redução do poder do oponente. */
export const STICKY_BARB_HP_COST = 1
export const STICKY_BARB_ENEMY_MULT = 0.75
```

- [ ] **Step 4: Aplicar no laço de duelo**

Em `src/engine/gymDefense.ts`, adicionar ao import de `./balance.ts`: `GRIP_CLAW_BATTLE_FLAT`, `STICKY_BARB_ENEMY_MULT`, `STICKY_BARB_HP_COST`. Adicionar ao import de `./attributes.ts` o `applyDamage` (se ainda não importado) e `hasRunItem` de `./itemEffects.ts`.

Trocar a linha 327 de `const you` para `let you` e inserir o bloco do Sticky Barb logo após:

```typescript
    let you = result[yours] as Pokemon
    // Sticky Barb: ao ENTRAR no duelo, seu Pokémon perde 1 de vida (pode desmaiar).
    if (hasRunItem(runItems, 'sticky-barb')) {
      const afterBarb = applyDamage(you, STICKY_BARB_HP_COST)
      result[yours] = afterBarb
      you = afterBarb
      if (you.currentHp <= 0) {
        // Desmaiou pela Sticky Barb antes de lutar: passa a vez.
        yours += 1
        frontWins = 0
        continue
      }
    }
```

Após a linha 330 (`yourEff *= itemBattleMultiplier(you, runItems)`), adicionar:

```typescript
    // Grip Claw: bônus fixo de Batalha em duelos.
    if (hasRunItem(runItems, 'grip-claw')) yourEff += GRIP_CLAW_BATTLE_FLAT
```

Após a linha 352 (`enemyEff *= enemyPressureMult`), adicionar:

```typescript
    // Sticky Barb: reduz o poder do oponente em 25%.
    if (hasRunItem(runItems, 'sticky-barb')) enemyEff *= STICKY_BARB_ENEMY_MULT
```

- [ ] **Step 5: Catálogo + cidades**

Em `src/data/items.ts`, adicionar ao `ITEMS`:

```typescript
  {
    id: 'sticky-barb',
    name: 'Sticky Barb',
    type: 'passive',
    price: 600,
    description: 'Em cada duelo de defesa, seu Pokémon perde 1 de vida e o oponente perde 25% do poder.',
    sprite: sprite('sticky-barb'),
    effect: { kind: 'passive' },
  },
  {
    id: 'grip-claw',
    name: 'Grip Claw',
    type: 'passive',
    price: 500,
    description: 'Pokémon ganham +5 de poder em batalhas de defesa.',
    sprite: sprite('grip-claw'),
    effect: { kind: 'passive' },
  },
```

Em `CITY_ITEM_IDS`: `4: ['black-sludge', 'big-nugget', 'sticky-barb']`, `7: ['wide-lens', 'amulet-coin', 'grip-claw']`.

- [ ] **Step 6: Testes e build**

Run: `npx vitest run src/engine/gymDefense.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 7: Commit**

```bash
git add src/engine/balance.ts src/engine/gymDefense.ts src/engine/gymDefense.test.ts src/data/items.ts
git commit -m "feat(itens): grip-claw (+5 batalha) e sticky-barb (-1 HP, oponente -25%)"
```

---

## Task 6: full-incense (+1 Pokémon na exploração)

**Files:**
- Modify: `src/engine/capture.ts`, `src/game/captureFlow.ts:143`, `src/data/items.ts`
- Test: `src/engine/capture.test.ts`

**Interfaces:**
- Consumes: `rollEncounter`, `rollCandidates`, `CAPTURE_CHOICES`.
- Produces: `effectiveCaptureChoices(runItems: readonly string[]): number`; `rollCandidates`/`rollEncounter` ganham parâmetro opcional `choices`.

- [ ] **Step 1: Escrever o teste**

Adicionar em `src/engine/capture.test.ts`:

```typescript
import { effectiveCaptureChoices } from './capture.ts'

describe('effectiveCaptureChoices', () => {
  it('2 sem item, 3 com full-incense', () => {
    expect(effectiveCaptureChoices([])).toBe(2)
    expect(effectiveCaptureChoices(['full-incense'])).toBe(3)
  })
})

describe('rollCandidates com choices custom', () => {
  it('respeita o número pedido', () => {
    const candidates = rollCandidates(createRng(7), GYM_TYPES, 5, ALL_RARITIES, 3)
    expect(candidates.length).toBeLessThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/capture.test.ts`
Expected: FAIL (`effectiveCaptureChoices` não existe / arity).

- [ ] **Step 3: Implementar em `capture.ts`**

Em `src/engine/capture.ts`, adicionar:

```typescript
/** Quantos candidatos a exploração atrai: 2, ou 3 com Full Incense. */
export function effectiveCaptureChoices(runItems: readonly string[]): number {
  return CAPTURE_CHOICES + (runItems.includes('full-incense') ? 1 : 0)
}
```

Adicionar o parâmetro `choices` (default `CAPTURE_CHOICES`) a `rollCandidates` (linha 86) e usá-lo no loop:

```typescript
export function rollCandidates(
  rng: Rng,
  gymTypes: readonly PokemonType[],
  level: number,
  maxRarityIndex: number,
  choices: number = CAPTURE_CHOICES,
): Species[] {
  const out: Species[] = []
  for (let i = 0; i < choices; i++) {
    const species = rollOne(rng, gymTypes, level, maxRarityIndex)
    if (species) out.push(species)
  }
  return out
}
```

E a `rollEncounter` (linha 129), passando `choices` ao `rollCandidateLevels`:

```typescript
export function rollEncounter(
  rng: Rng,
  gymTypes: readonly PokemonType[],
  day: number,
  maxRarityIndex: number,
  choices: number = CAPTURE_CHOICES,
): Encounter {
  const levels = rollCandidateLevels(rng, day, choices)
  // ...resto inalterado...
}
```

- [ ] **Step 4: Passar `runItems` no call site**

Em `src/game/captureFlow.ts`, importar `effectiveCaptureChoices` de `../engine/capture.ts` e trocar a linha 143:

```typescript
  const encounter = rollEncounter(takeRng(s), s.gym.types, s.run.day, maxRarityIndex, effectiveCaptureChoices(s.runItems))
```

- [ ] **Step 5: Catálogo + cidade**

Em `src/data/items.ts`, adicionar ao `ITEMS`:

```typescript
  {
    id: 'full-incense',
    name: 'Full Incense',
    type: 'passive',
    price: 800,
    description: 'A exploração atrai +1 Pokémon (de 2 para 3 candidatos).',
    sprite: sprite('full-incense'),
    effect: { kind: 'passive' },
  },
```

Em `CITY_ITEM_IDS`: `5: ['twisted-spoon', 'wise-glasses', 'full-incense']`.

- [ ] **Step 6: Testes e build**

Run: `npx vitest run src/engine/capture.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 7: Commit**

```bash
git add src/engine/capture.ts src/game/captureFlow.ts src/engine/capture.test.ts src/data/items.ts
git commit -m "feat(itens): full-incense (+1 pokemon na exploracao)"
```

---

## Task 7: As 6 berries (cura 25% + +2 atributo permanente)

**Files:**
- Modify: `src/data/types.ts`, `src/game/marketFlow.ts`, `src/components/common/ItemsBar.tsx`, `src/data/items.ts`
- Test: `src/game/marketFlow.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `buyItem`, `applyItem`, `addCharges`, `consumeItem`, `findMon`, `replaceMon`, `heal`, `recomputeMaxHp`.
- Produces: novo `ItemEffect` `{ kind: 'berry'; attr: AttrKey; healPct: number; statAmount: number }`.

- [ ] **Step 1: Novo `ItemEffect` berry**

Em `src/data/types.ts`, na união `ItemEffect`, adicionar:

```typescript
  | { kind: 'berry'; attr: AttrKey; healPct: number; statAmount: number }
```

- [ ] **Step 2: Escrever o teste**

Criar/edit `src/game/marketFlow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { effectiveAttr } from '../engine/attributes.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { buyItem, applyItem } from './marketFlow.ts'

function stateWithMon() {
  const s = createInitialState(1)
  const mon = createPokemon({ id: 'p1', speciesId: 1, level: 5, rng: createRng(1) })
  s.roster = [{ ...mon, currentHp: 1 }]
  s.gold = 1000
  return s
}

describe('berry (petaya = batalha)', () => {
  it('compra vai pro inventário e o uso cura 25% + dá +2 permanente de batalha', () => {
    const s = stateWithMon()
    const before = effectiveAttr(s.roster[0]!, 'batalha')
    buyItem(s, 'petaya-berry')
    expect(s.inventory.find((i) => i.itemId === 'petaya-berry')?.quantity).toBe(1)
    applyItem(s, 'petaya-berry', 'p1')
    expect(effectiveAttr(s.roster[0]!, 'batalha')).toBe(before + 2)
    expect(s.roster[0]!.currentHp).toBeGreaterThan(1) // curou
    expect(s.inventory.find((i) => i.itemId === 'petaya-berry')).toBeUndefined() // consumiu
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/game/marketFlow.test.ts`
Expected: FAIL (berry não tratada em buy/apply).

- [ ] **Step 4: Compra da berry**

Em `src/game/marketFlow.ts`, no `switch (effect.kind)` de `buyItem`, adicionar junto do `case 'heal': case 'revive':` um caso novo (a berry também empilha cargas):

```typescript
    case 'berry': {
      if (!canAfford(s, item, quantity)) return // usar canAfford(s.gold, item, quantity)
      s.gold -= item.price * quantity
      addCharges(s, itemId, quantity)
      markSold(s, itemId)
      return
    }
```

(Atenção: usar a mesma assinatura `canAfford(s.gold, item, quantity)` dos casos vizinhos.)

- [ ] **Step 5: Uso da berry (cura + permaBonus)**

Em `src/game/marketFlow.ts`, no início de `applyItem`, trocar a guarda atual por uma que também trate berry. Substituir:

```typescript
export function applyItem(s: GameState, itemId: string, targetId: string): void {
  const effect = getItem(itemId).effect
  if (effect.kind === 'berry') {
    const target = findMon(s, targetId)
    if (!target || target.currentHp <= 0) return // não usa em desmaiado
    if (!consumeItem(s, itemId)) return
    const attr = effect.attr
    const bumped = recomputeMaxHp({
      ...target,
      permaBonus: { ...target.permaBonus, [attr]: (target.permaBonus?.[attr] ?? 0) + effect.statAmount },
    })
    const restored = heal(bumped, bumped.currentHp + Math.ceil(bumped.maxHp * effect.healPct))
    replaceMon(s, restored)
    return
  }
  if (effect.kind !== 'heal' && effect.kind !== 'revive') return
  // ...resto inalterado (escopo team/single)...
```

- [ ] **Step 6: Exibir/usar berries na ItemsBar**

Em `src/components/common/ItemsBar.tsx`:

(a) Em `collectEntries`, na iteração do inventário, ampliar `usable`:

```typescript
    const usable = item.effect.kind === 'heal' || item.effect.kind === 'revive' || item.effect.kind === 'berry'
```

(b) Em `onUse`, ampliar a guarda e tratar berry como escopo single:

```typescript
  const onUse = (item: ItemData): void => {
    if (!dispatch) return
    if (item.effect.kind === 'berry') {
      setPicking(item)
      return
    }
    if (item.effect.kind !== 'heal' && item.effect.kind !== 'revive') return
    if (item.effect.scope === 'team') {
      dispatch({ type: 'USE_ITEM', itemId: item.id, targetId: '' })
      return
    }
    setPicking(item)
  }
```

(c) Em `eligibleTargets`, tratar berry (alvos vivos, mesmo com HP cheio):

```typescript
function eligibleTargets(state: GameState, item: ItemData) {
  if (item.effect.kind === 'revive') return state.roster.filter((p) => p.currentHp <= 0)
  if (item.effect.kind === 'berry') return state.roster.filter((p) => p.currentHp > 0)
  return state.roster.filter((p) => p.currentHp > 0 && p.currentHp < p.maxHp)
}
```

- [ ] **Step 7: Catálogo das 6 berries + pool global**

Em `src/data/items.ts`, adicionar uma função-fábrica (após `statItem`) e as 6 entradas:

```typescript
/** Berry: cura 25% do HP e dá +2 PERMANENTE num atributo (uso único, alvo vivo). */
function berryItem(id: string, name: string, attr: AttrKey, label: string): ItemData {
  return {
    id,
    name,
    type: 'consumable',
    price: 100,
    description: `Cura 25% do HP e dá +2 de ${label} (permanente) a um Pokémon.`,
    sprite: sprite(id),
    effect: { kind: 'berry', attr, healPct: 0.25, statAmount: 2 },
  }
}
```

No `ITEMS`:

```typescript
  berryItem('petaya-berry', 'Petaya Berry', 'batalha', 'Batalha'),
  berryItem('leppa-berry', 'Leppa Berry', 'inteligencia', 'Inteligência'),
  berryItem('golden-nanab-berry', 'Golden Nanab Berry', 'carisma', 'Carisma'),
  berryItem('aguav-berry', 'Aguav Berry', 'agilidade', 'Agilidade'),
  berryItem('sitrus-berry', 'Sitrus Berry', 'resistencia', 'Resistência'),
  berryItem('rawst-berry', 'Rawst Berry', 'percepcao', 'Percepção'),
```

Em `GLOBAL_ITEM_IDS`, adicionar os 6 ids: `'petaya-berry', 'leppa-berry', 'golden-nanab-berry', 'aguav-berry', 'sitrus-berry', 'rawst-berry'`.

- [ ] **Step 8: Testes e build**

Run: `npx vitest run src/game/marketFlow.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 9: Commit**

```bash
git add src/data/types.ts src/game/marketFlow.ts src/components/common/ItemsBar.tsx src/data/items.ts src/game/marketFlow.test.ts
git commit -m "feat(itens): 6 berries (cura 25% + +2 atributo permanente)"
```

---

## Task 8: Everstone (XP ×2 + bloqueia toda evolução)

**Files:**
- Modify: `src/engine/balance.ts`, `src/engine/leveling.ts`, `src/game/itemFlow.ts`, `src/game/marketFlow.ts`, `src/data/items.ts`
- Test: `src/game/itemFlow.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `applyXpGains(s, baseGains, rng)`, `addXp(p, amount, rng?)`, `evolveToLevel(p, rng?)`, `useRareCandy`, `useMoonStone`.
- Produces: `addXp` e `evolveToLevel` ganham param `blockEvolution` (default `false`); `EVERSTONE_XP_MULT`.

- [ ] **Step 1: Escrever o teste**

Criar/edit `src/game/itemFlow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import { applyXpGains } from './itemFlow.ts'

describe('Everstone', () => {
  it('dobra o XP e impede a evolução natural', () => {
    const base = createPokemon({ id: 'p1', speciesId: 1, level: 5, rng: createRng(1) }) // Bulbasaur evolui no 6
    const s = createInitialState(1)
    s.roster = [base]
    s.runItems = ['everstone']
    applyXpGains(s, new Map([['p1', 100000]]), createRng(1))
    // Subiu de nível (XP dobrado) mas NÃO evoluiu (continua Bulbasaur, speciesId 1).
    expect(s.roster[0]!.level).toBeGreaterThan(5)
    expect(s.roster[0]!.speciesId).toBe(1)
  })
  it('sem Everstone, evolui normalmente', () => {
    const base = createPokemon({ id: 'p1', speciesId: 1, level: 5, rng: createRng(1) })
    const s = createInitialState(1)
    s.roster = [base]
    applyXpGains(s, new Map([['p1', 100000]]), createRng(1))
    expect(getSpecies(s.roster[0]!.speciesId).evolvesTo === null || s.roster[0]!.speciesId !== 1).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/game/itemFlow.test.ts`
Expected: FAIL (evolui mesmo com everstone).

- [ ] **Step 3: Constante**

Em `src/engine/balance.ts`, após `STICKY_BARB_ENEMY_MULT`:

```typescript
/** Everstone: multiplicador de XP enquanto possuído (e impede toda evolução). */
export const EVERSTONE_XP_MULT = 2
```

- [ ] **Step 4: `blockEvolution` em leveling**

Em `src/engine/leveling.ts`, trocar `evolveToLevel` (linha 137):

```typescript
export function evolveToLevel(p: Pokemon, rng?: Rng, blockEvolution = false): Pokemon {
  if (blockEvolution) return p
  let current = p
  for (;;) {
    const evo = getSpecies(current.speciesId).evolvesTo
    if (!evo || current.level < evo.atLevel) return current
    const toId = rng ? rng.pick(evo.ids) : evo.ids[0]!
    current = evolveInto(current, toId)
  }
}
```

E `addXp` (linha 187), repassando o flag:

```typescript
export function addXp(p: Pokemon, amount: number, rng?: Rng, blockEvolution = false): XpResult {
  const gained = Math.max(0, Math.floor(amount * rarityXpRate(p.speciesId) * heartXpMultiplier(p.hearts)))
  let xp = p.xp + gained
  let level = p.level
  while (level < LEVEL_MAX && xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
  }
  const pokemon = evolveToLevel({ ...p, xp, level }, rng, blockEvolution)
  return { pokemon, levelsGained: level - p.level }
}
```

- [ ] **Step 5: Aplicar ×2 + bloqueio em `applyXpGains`**

Em `src/game/itemFlow.ts`, importar `EVERSTONE_XP_MULT` de `../engine/balance.ts` e trocar o loop final de aplicação:

```typescript
  const everstone = s.runItems.includes('everstone')
  const mult = everstone ? EVERSTONE_XP_MULT : 1
  for (const [id, xp] of total) {
    if (xp <= 0) continue
    const mon = findMon(s, id)
    if (mon) replaceMon(s, addXp(mon, Math.floor(xp * mult), rng, everstone).pokemon)
  }
```

- [ ] **Step 6: Bloquear evolução manual (Rare Candy / Moon Stone)**

Em `src/game/marketFlow.ts`:

`useRareCandy` (linha 124) — repassar o flag para não evoluir, mas ainda subir o nível:

```typescript
  const leveled = recomputeMaxHp(evolveToLevel({ ...mon, level: mon.level + 1 }, rng, s.runItems.includes('everstone')))
```

`useMoonStone` — adicionar, logo após `const item = getItem('moon-stone')` (linha 134):

```typescript
  if (s.runItems.includes('everstone')) return // Everstone impede toda evolução
```

- [ ] **Step 7: Catálogo + pool global**

Em `src/data/items.ts`, adicionar ao `ITEMS`:

```typescript
  {
    id: 'everstone',
    name: 'Everstone',
    type: 'passive',
    price: 700,
    description: 'Seus Pokémon não evoluem, mas ganham o dobro de experiência.',
    sprite: sprite('everstone'),
    effect: { kind: 'passive' },
  },
```

Em `GLOBAL_ITEM_IDS`, adicionar `'everstone'`.

- [ ] **Step 8: Testes e build**

Run: `npx vitest run src/game/itemFlow.test.ts src/engine/leveling.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 9: Commit**

```bash
git add src/engine/balance.ts src/engine/leveling.ts src/game/itemFlow.ts src/game/marketFlow.ts src/data/items.ts src/game/itemFlow.test.ts
git commit -m "feat(itens): everstone (2x XP, bloqueia toda evolucao)"
```

---

## Task 9: Estado do Poke Egg + compra (incuba ovo) + display na ItemsBar

**Files:**
- Modify: `src/engine/state.ts`, `src/engine/constants.ts`, `src/data/types.ts`, `src/game/marketFlow.ts`, `src/components/common/ItemsBar.tsx`, `src/data/items.ts`
- Test: `src/game/marketFlow.test.ts`

**Interfaces:**
- Consumes: `GameState`, `takeId`, `canAfford`, `markSold`.
- Produces: `IncubatingEgg`, `HatchResult`, campos `eggs`/`airBalloon`/`pendingHatches` no `GameState`; `EGG_INCUBATION_DAYS`; `ItemEffect` `{ kind: 'egg' }`.

- [ ] **Step 1: Tipos de estado e constante**

Em `src/engine/constants.ts`, adicionar:

```typescript
/** Poke Egg: dias de incubação até chocar (0/3 → 1/3 → 2/3 → choca). */
export const EGG_INCUBATION_DAYS = 3
/** Air Balloon: faixa de usos (missões) antes de estourar. */
export const AIR_BALLOON_USES_MIN = 20
export const AIR_BALLOON_USES_MAX = 30
```

Em `src/engine/state.ts`, adicionar perto de `ItemStack` (linha 341):

```typescript
/** Ovo (Poke Egg) chocando: incuba EGG_INCUBATION_DAYS dias e eclode no avanço de dia. */
export interface IncubatingEgg {
  id: string
  /** Dias já passados (0→3). Eclode ao atingir EGG_INCUBATION_DAYS. */
  daysElapsed: number
}

/** Eclosão aguardando o modal (fila em pendingHatches). */
export interface HatchResult {
  pokemon: Pokemon
  /** true = entrou no time; false = foi pro Computador (PC). */
  toTeam: boolean
}
```

No `GameState` (após `runItems`, linha 530):

```typescript
  /** Ovos (Poke Egg) chocando — incubam por dia e eclodem no avanço de dia. */
  eggs: IncubatingEgg[]
  /** Air Balloon: usos restantes antes de estourar (null = sem balão ativo). */
  airBalloon: { usesLeft: number } | null
  /** Eclosões aguardando exibição no modal (uma por vez). */
  pendingHatches: HatchResult[]
```

Em `createInitialState` (após `runItems: [],`, linha 620):

```typescript
    eggs: [],
    airBalloon: null,
    pendingHatches: [],
```

- [ ] **Step 2: Escrever o teste de compra**

Adicionar em `src/game/marketFlow.test.ts`:

```typescript
import { buyItem as buyItem2 } from './marketFlow.ts'

describe('Poke Egg', () => {
  it('compra adiciona um ovo incubando com daysElapsed 0', () => {
    const s = createInitialState(1)
    s.gold = 1000
    buyItem2(s, 'poke-egg')
    expect(s.eggs).toHaveLength(1)
    expect(s.eggs[0]!.daysElapsed).toBe(0)
    expect(s.gold).toBe(500)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/game/marketFlow.test.ts`
Expected: FAIL (`egg` não tratado; `s.eggs` indefinido).

- [ ] **Step 4: `ItemEffect` egg + compra**

Em `src/data/types.ts`, na união `ItemEffect`:

```typescript
  | { kind: 'egg' }
```

Em `src/game/marketFlow.ts`, importar `takeId` de `./runtime.ts` (junto de `findMon, replaceMon, takeRng`) e adicionar o caso em `buyItem`:

```typescript
    case 'egg': {
      if (!canAfford(s.gold, item)) return
      s.gold -= item.price
      ;(s.eggs ??= []).push({ id: takeId(s, 'egg'), daysElapsed: 0 })
      markSold(s, itemId)
      return
    }
```

- [ ] **Step 5: Display do ovo na ItemsBar**

Em `src/components/common/ItemsBar.tsx`, importar `EGG_INCUBATION_DAYS` de `../../engine/constants.ts` e, em `collectEntries`, após o loop dos passivos (antes de `return entries`):

```typescript
  // Ovos chocando (Poke Egg) — só leitura, mostra o progresso N/3.
  for (const egg of state.eggs ?? []) {
    entries.push({
      key: `egg-${egg.id}`,
      sprite: '/sprites/itens/poke-egg.png',
      title: `Poke Egg — chocando ${egg.daysElapsed}/${EGG_INCUBATION_DAYS}`,
      badge: `${egg.daysElapsed}/${EGG_INCUBATION_DAYS}`,
    })
  }
```

- [ ] **Step 6: Catálogo + pool global**

Em `src/data/items.ts`, adicionar ao `ITEMS`:

```typescript
  {
    id: 'poke-egg',
    name: 'Poke Egg',
    type: 'consumable',
    price: 500,
    description: 'Choca em 3 dias e revela um Pokémon de 1º estágio (rank B–S; pode ser shiny).',
    sprite: sprite('poke-egg'),
    effect: { kind: 'egg' },
  },
```

Em `GLOBAL_ITEM_IDS`, adicionar `'poke-egg'`.

- [ ] **Step 7: Testes e build**

Run: `npx vitest run src/game/marketFlow.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 8: Commit**

```bash
git add src/engine/state.ts src/engine/constants.ts src/data/types.ts src/game/marketFlow.ts src/components/common/ItemsBar.tsx src/data/items.ts src/game/marketFlow.test.ts
git commit -m "feat(itens): poke-egg compra e incubacao (estado + display)"
```

---

## Task 10: Eclosão do ovo (rolagem de rank/shiny/espécie + colocação no time/PC)

**Files:**
- Create: `src/engine/egg.ts`, `src/game/eggFlow.ts`
- Modify: `src/game/phaseFlow.ts`
- Test: `src/engine/egg.test.ts`, `src/game/eggFlow.test.ts`

**Interfaces:**
- Consumes: `createPokemon`, `baseStageSpecies`, `rollShiny`, `shinyChance`, `LEVEL_MIN`, `MAX_ROSTER_SIZE`, `EGG_INCUBATION_DAYS`, `takeRng`, `takeId`.
- Produces: `hatchEgg(rng, id, runItems): Pokemon`; `rollEggRankIndex(rng): number`; `incubateEggs(s): void`.

- [ ] **Step 1: Escrever o teste de `egg.ts`**

Criar `src/engine/egg.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createRng } from './rng.ts'
import { hatchEgg, rollEggRankIndex } from './egg.ts'
import { getSpecies } from '../data/pokemon/index.ts'
import { pokemonRankIndex } from './ranking.ts'

describe('rollEggRankIndex', () => {
  it('retorna 4 (B), 5 (A) ou 6 (S)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const idx = rollEggRankIndex(createRng(seed))
      expect([4, 5, 6]).toContain(idx)
    }
  })
})

describe('hatchEgg', () => {
  it('gera um Pokémon de 1º estágio (não evoluído)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const mon = hatchEgg(createRng(seed), `p${seed}`, [])
      // Espécie base: nenhuma forma evolui PARA ela (é forma inicial).
      expect(getSpecies(mon.speciesId)).toBeDefined()
      expect(mon.level).toBe(1)
    }
  })
  it('shiny sempre nasce rank S', () => {
    // Com Shiny Charm a chance é alta (20%); procura um shiny e confirma rank S.
    let found = false
    for (let seed = 0; seed < 500 && !found; seed++) {
      const mon = hatchEgg(createRng(seed), 'p', ['shiny-charm'])
      if (mon.shiny) {
        found = true
        expect(pokemonRankIndex(mon)).toBe(6)
      }
    }
    expect(found).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/egg.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `egg.ts`**

Criar `src/engine/egg.ts`:

```typescript
// Eclosão do Poke Egg: sorteia rank-alvo (40% B / 35% A / 25% S; shiny → S),
// escolhe uma espécie de 1º estágio e cria o Pokémon nível 1 nesse rank.
import type { Pokemon } from '../types/index.ts'
import type { Rng } from './rng.ts'
import { createPokemon } from './leveling.ts'
import { baseStageSpecies } from '../data/pokemon/index.ts'
import { rollShiny, shinyChance } from './shiny.ts'
import { LEVEL_MIN } from './constants.ts'

/** Rank-alvo do ovo: 40% B (4), 35% A (5), 25% S (6). */
export function rollEggRankIndex(rng: Rng): number {
  const r = rng.next()
  if (r < 0.4) return 4
  if (r < 0.75) return 5
  return 6
}

/** Choca um ovo num Pokémon de 1º estágio no rank sorteado (shiny → rank S). */
export function hatchEgg(rng: Rng, id: string, runItems: readonly string[]): Pokemon {
  const shiny = rollShiny(rng, shinyChance(runItems))
  const rankIndex = shiny ? 6 : rollEggRankIndex(rng)
  const speciesId = rng.pick(baseStageSpecies())
  return createPokemon({ id, speciesId, level: LEVEL_MIN, rng, rankCenter: rankIndex, shiny })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/egg.test.ts`
Expected: PASS

- [ ] **Step 5: Escrever o teste de `eggFlow.ts`**

Criar `src/game/eggFlow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { EGG_INCUBATION_DAYS } from '../engine/constants.ts'
import { incubateEggs } from './eggFlow.ts'

describe('incubateEggs', () => {
  it('avança a incubação e eclode no 3º dia, indo pro time quando há vaga', () => {
    const s = createInitialState(1)
    s.eggs = [{ id: 'egg1', daysElapsed: 0 }]
    incubateEggs(s) // 1/3
    expect(s.eggs[0]!.daysElapsed).toBe(1)
    incubateEggs(s) // 2/3
    incubateEggs(s) // choca
    expect(s.eggs).toHaveLength(0)
    expect(s.roster).toHaveLength(1)
    expect(s.pendingHatches).toHaveLength(1)
    expect(s.pendingHatches[0]!.toTeam).toBe(true)
  })
  it('vai pro PC quando o time está cheio', () => {
    const s = createInitialState(1)
    // Time cheio (6 placeholders mínimos via createPokemon seria ideal; aqui foca na regra de vaga).
    s.roster = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}` } as never))
    s.eggs = [{ id: 'egg1', daysElapsed: EGG_INCUBATION_DAYS - 1 }]
    incubateEggs(s)
    expect(s.box).toHaveLength(1)
    expect(s.pendingHatches[0]!.toTeam).toBe(false)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/game/eggFlow.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 7: Implementar `eggFlow.ts`**

Criar `src/game/eggFlow.ts`:

```typescript
// Fluxo do Poke Egg no GameState: incuba os ovos na virada do dia, eclode os que
// completaram 3 dias e enfileira o resultado para o modal de eclosão.
import type { GameState, IncubatingEgg } from '../engine/state.ts'
import { EGG_INCUBATION_DAYS } from '../engine/constants.ts'
import { MAX_ROSTER_SIZE } from '../engine/constants.ts'
import { hatchEgg } from '../engine/egg.ts'
import { takeId, takeRng } from './runtime.ts'

/** Avança 1 dia de incubação em todos os ovos; eclode os que chegaram a EGG_INCUBATION_DAYS. */
export function incubateEggs(s: GameState): void {
  const eggs = s.eggs ?? []
  const stillIncubating: IncubatingEgg[] = []
  for (const egg of eggs) {
    const daysElapsed = egg.daysElapsed + 1
    if (daysElapsed < EGG_INCUBATION_DAYS) {
      stillIncubating.push({ ...egg, daysElapsed })
      continue
    }
    const pokemon = hatchEgg(takeRng(s), takeId(s, 'p'), s.runItems)
    const toTeam = s.roster.length < MAX_ROSTER_SIZE
    if (toTeam) s.roster = [...s.roster, pokemon]
    else s.box = [...s.box, pokemon]
    if (!s.caughtSpecies.includes(pokemon.speciesId)) {
      s.caughtSpecies = [...s.caughtSpecies, pokemon.speciesId]
    }
    ;(s.pendingHatches ??= []).push({ pokemon, toTeam })
  }
  s.eggs = stillIncubating
}

/** Remove a eclosão da frente da fila (após o jogador fechar o modal). */
export function dismissHatch(s: GameState): void {
  if (!s.pendingHatches?.length) return
  s.pendingHatches = s.pendingHatches.slice(1)
}
```

- [ ] **Step 8: Disparar no avanço de dia**

Em `src/game/phaseFlow.ts`, importar `incubateEggs` de `./eggFlow.ts` e, dentro de `startNextDay`, adicionar a chamada após `healRoster(s)` (linha 258):

```typescript
  incubateEggs(s) // incuba/eclode ovos na virada do dia
```

- [ ] **Step 9: Rodar e ver passar + build**

Run: `npx vitest run src/engine/egg.test.ts src/game/eggFlow.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 10: Commit**

```bash
git add src/engine/egg.ts src/game/eggFlow.ts src/game/phaseFlow.ts src/engine/egg.test.ts src/game/eggFlow.test.ts
git commit -m "feat(itens): eclosao do poke-egg (rank/shiny/especie + time/PC)"
```

---

## Task 11: Modal de eclosão (DISMISS_HATCH + EggHatchModal + wiring no App)

**Files:**
- Create: `src/components/EggHatchModal/EggHatchModal.tsx`, `src/components/EggHatchModal/EggHatchModal.module.css`
- Modify: `src/game/actions.ts`, `src/game/reducer.ts`, `src/App.tsx`
- Test: `src/game/reducer.test.ts` (criar se não existir) ou `src/game/eggFlow.test.ts`

**Interfaces:**
- Consumes: `dismissHatch(s)`, `state.pendingHatches`, `Overlay`, `getSpecies`, `displayNameOf`.
- Produces: ação `{ type: 'DISMISS_HATCH' }`.

- [ ] **Step 1: Escrever o teste do reducer**

Adicionar em `src/game/eggFlow.test.ts`:

```typescript
import { reducer } from './reducer.ts'

describe('DISMISS_HATCH', () => {
  it('remove a primeira eclosão da fila', () => {
    let s = createInitialState(1)
    s.pendingHatches = [
      { pokemon: { id: 'a' } as never, toTeam: true },
      { pokemon: { id: 'b' } as never, toTeam: false },
    ]
    s = reducer(s, { type: 'DISMISS_HATCH' })
    expect(s.pendingHatches).toHaveLength(1)
    expect(s.pendingHatches[0]!.pokemon.id).toBe('b')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/game/eggFlow.test.ts`
Expected: FAIL (ação não existe no `GameAction`).

- [ ] **Step 3: Ação + reducer**

Em `src/game/actions.ts`, adicionar à união `GameAction`:

```typescript
  /** Fecha o modal de eclosão do ovo (remove a eclosão da frente da fila). */
  | { type: 'DISMISS_HATCH' }
```

Em `src/game/reducer.ts`, importar `dismissHatch` de `./eggFlow.ts` e adicionar o case:

```typescript
    case 'DISMISS_HATCH':
      dismissHatch(s)
      break
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/game/eggFlow.test.ts`
Expected: PASS

- [ ] **Step 5: Componente do modal**

Criar `src/components/EggHatchModal/EggHatchModal.tsx`:

```tsx
import type { Dispatch } from 'react'
import type { GameAction } from '../../game/actions.ts'
import type { HatchResult } from '../../engine/state.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { displayNameOf } from '../common/naming.ts'
import { Overlay } from '../common/Overlay.tsx'
import styles from './EggHatchModal.module.css'

interface Props {
  hatch: HatchResult
  dispatch: Dispatch<GameAction>
}

export function EggHatchModal({ hatch, dispatch }: Props) {
  const { pokemon, toTeam } = hatch
  const species = getSpecies(pokemon.speciesId)
  const sprite = pokemon.shiny ? species.shinySpritePath : species.spritePath
  return (
    <Overlay title="O OVO CHOCOU!" onClose={() => dispatch({ type: 'DISMISS_HATCH' })}>
      <div className={styles.body}>
        <img className={styles.sprite} src={sprite} alt="" />
        <p className={styles.name}>
          {displayNameOf(pokemon)}
          {pokemon.shiny ? ' ✨' : ''}
        </p>
        <p className={styles.dest}>{toTeam ? 'Foi direto para o seu time!' : 'Foi para o Computador (PC).'}</p>
        <button type="button" className={styles.ok} onClick={() => dispatch({ type: 'DISMISS_HATCH' })} data-sound="select">
          OK
        </button>
      </div>
    </Overlay>
  )
}
```

Criar `src/components/EggHatchModal/EggHatchModal.module.css`:

```css
.body { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 8px; }
.sprite { width: 96px; height: 96px; image-rendering: pixelated; }
.name { font-weight: 700; margin: 0; }
.dest { margin: 0; opacity: 0.85; }
.ok { padding: 8px 24px; cursor: pointer; }
```

(Se `Overlay` exigir props diferentes, espelhar o uso já feito em `ItemsBar.tsx`.)

- [ ] **Step 6: Wiring no App**

Em `src/App.tsx`, importar o modal:

```tsx
import { EggHatchModal } from './components/EggHatchModal/EggHatchModal.tsx'
```

Congelar o relógio enquanto há eclosão pendente — trocar a linha 61:

```tsx
  useGameClock(state, dispatch, uiPaused || levelingUp !== undefined || (state.pendingHatches?.length ?? 0) > 0)
```

E renderizar o modal junto do LevelUpModal (após a linha 121):

```tsx
      {state.pendingHatches?.[0] && <EggHatchModal hatch={state.pendingHatches[0]} dispatch={dispatch} />}
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/components/EggHatchModal src/game/actions.ts src/game/reducer.ts src/App.tsx src/game/eggFlow.test.ts
git commit -m "feat(itens): modal de eclosao do poke-egg"
```

---

## Task 12: air-balloon (time voa até estourar após 20–30 missões)

**Files:**
- Modify: `src/engine/secretEffects.ts` (`teamFlies`), `src/engine/missions.ts` (`travelRoute`), `src/game/marketFlow.ts` (compra), `src/game/missionFlow.ts` (decremento), `src/data/items.ts`
- Test: `src/engine/secretEffects.test.ts`, `src/game/marketFlow.test.ts`

**Interfaces:**
- Consumes: `teamFlies(team, runItems)`, `travelRoute(graph, gym, node, team, runItems)`, `acceptMission`, `takeRng`, `AIR_BALLOON_USES_MIN/MAX`.
- Produces: `teamFlies` ganha param `runItems`; decremento de `s.airBalloon` no despacho.

- [ ] **Step 1: Escrever os testes**

Em `src/engine/secretEffects.test.ts`:

```typescript
describe('teamFlies com air-balloon', () => {
  it('time voa enquanto o air-balloon está na run', () => {
    const mon = makeMon({ speciesId: 1 }) // sem habilidade Fly
    expect(teamFlies([mon, mon, mon])).toBe(false)
    expect(teamFlies([mon, mon, mon], ['air-balloon'])).toBe(true)
  })
})
```

Em `src/game/marketFlow.test.ts`:

```typescript
describe('air-balloon', () => {
  it('compra fixa usos em [20,30] e adiciona à run', () => {
    const s = createInitialState(1)
    s.gold = 2000
    buyItem(s, 'air-balloon')
    expect(s.runItems).toContain('air-balloon')
    expect(s.airBalloon!.usesLeft).toBeGreaterThanOrEqual(20)
    expect(s.airBalloon!.usesLeft).toBeLessThanOrEqual(30)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts src/game/marketFlow.test.ts`
Expected: FAIL (arity de `teamFlies`; `airBalloon` não setado).

- [ ] **Step 3: `teamFlies` aceita runItems**

Em `src/engine/secretEffects.ts`, trocar `teamFlies` (linha 472):

```typescript
export function teamFlies(team: readonly Pokemon[], runItems: readonly string[] = []): boolean {
  if (runItems.includes('air-balloon')) return true
  if (!teamHasFly(team)) return false
  return team.length === 1 || team.some((p) => secretLevelOf(p, 'sa-fly') === 2)
}
```

E na linha 553 (dentro de `teamTravelSpeedMultiplier`), passar `runItems`:

```typescript
  if (teamFlies(team, runItems)) speed += FLY_SPEED_BONUS
```

- [ ] **Step 4: `travelRoute` usa runItems no voo**

Em `src/engine/missions.ts`, na `travelRoute` (linha 273), trocar:

```typescript
  if (teamFlies(team, runItems)) {
```

- [ ] **Step 5: Compra do air-balloon (rola usos)**

Em `src/game/marketFlow.ts`, importar `AIR_BALLOON_USES_MAX`, `AIR_BALLOON_USES_MIN` de `../engine/constants.ts`. No `case 'passive':`, antes de `markSold(s, itemId)`, adicionar:

```typescript
      if (itemId === 'air-balloon') {
        s.airBalloon = { usesLeft: takeRng(s).int(AIR_BALLOON_USES_MIN, AIR_BALLOON_USES_MAX) }
      }
```

- [ ] **Step 6: Decremento por missão despachada**

Em `src/game/missionFlow.ts`, dentro de `acceptMission`, após a linha 116 (cálculo do `inbound`), adicionar:

```typescript
  // Air Balloon: cada missão despachada gasta 1 uso; estoura (some) ao zerar.
  if (s.airBalloon) {
    const usesLeft = s.airBalloon.usesLeft - 1
    if (usesLeft <= 0) {
      s.airBalloon = null
      s.runItems = s.runItems.filter((id) => id !== 'air-balloon')
    } else {
      s.airBalloon = { usesLeft }
    }
  }
```

- [ ] **Step 7: Catálogo + cidade (Cinnabar)**

Em `src/data/items.ts`, adicionar ao `ITEMS`:

```typescript
  {
    id: 'air-balloon',
    name: 'Air Balloon',
    type: 'passive',
    price: 1200,
    description: 'Todo o time voa (rota direta) até o balão estourar, após 20–30 missões.',
    sprite: sprite('air-balloon'),
    effect: { kind: 'passive' },
  },
```

Em `CITY_ITEM_IDS`: `6: ['charcoal', 'zoom-lens', 'air-balloon']`.

- [ ] **Step 8: Testes e build**

Run: `npx vitest run src/engine/secretEffects.test.ts src/game/marketFlow.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 9: Commit**

```bash
git add src/engine/secretEffects.ts src/engine/missions.ts src/game/marketFlow.ts src/game/missionFlow.ts src/data/items.ts src/engine/secretEffects.test.ts src/game/marketFlow.test.ts
git commit -m "feat(itens): air-balloon (time voa ate estourar em 20-30 missoes)"
```

---

## Task 13: silver-powder (+50% de velocidade por inseto) e fertilizer (berry diária)

**Files:**
- Modify: `src/engine/balance.ts`, `src/engine/secretEffects.ts` (`teamTravelSpeedMultiplier`), `src/game/phaseFlow.ts` (berry diária), `src/data/items.ts`
- Create: `src/game/fertilizerFlow.ts`
- Test: `src/engine/secretEffects.test.ts`, `src/game/fertilizerFlow.test.ts`

**Interfaces:**
- Consumes: `teamTravelSpeedMultiplier(team, runItems, electrified)`, `GameState`, `takeRng`, `deriveSeed`/`createRng`.
- Produces: `SILVER_POWDER_SPEED_PER_BUG`; `grantDailyBerry(s): void`.

- [ ] **Step 1: Teste do silver-powder**

Em `src/engine/secretEffects.test.ts` (usar o nome real exportado — `teamTravelSpeedMultiplier`):

```typescript
describe('silver-powder', () => {
  it('+50% de velocidade por inseto no esquadrão', () => {
    const bug = makeMon({ speciesId: 10 }) // Caterpie é bug
    const base = teamTravelSpeedMultiplier([bug], [])
    const um = teamTravelSpeedMultiplier([bug], ['silver-powder'])
    const dois = teamTravelSpeedMultiplier([bug, bug], ['silver-powder'])
    expect(um).toBeCloseTo(base + 0.5)
    expect(dois).toBeCloseTo(base + 1.0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: FAIL (sem bônus).

- [ ] **Step 3: Constante + bônus no multiplicador de viagem**

Em `src/engine/balance.ts`:

```typescript
/** Silver Powder: +50% de velocidade de viagem por Pokémon do tipo inseto no esquadrão. */
export const SILVER_POWDER_SPEED_PER_BUG = 0.5
```

Em `src/engine/secretEffects.ts`, adicionar `SILVER_POWDER_SPEED_PER_BUG` ao import de `./balance.ts` e, dentro de `teamTravelSpeedMultiplier`, antes da linha 557 (`speed *= itemTravelSpeedMultiplier(runItems)`):

```typescript
  // Silver Powder: +50% de velocidade por Pokémon inseto no esquadrão (acumula).
  if (runItems.includes('silver-powder')) {
    speed += SILVER_POWDER_SPEED_PER_BUG * team.filter((p) => p.types.includes('bug')).length
  }
```

- [ ] **Step 4: Teste da berry diária (fertilizer)**

Criar `src/game/fertilizerFlow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { findItem } from '../data/items.ts'
import { grantDailyBerry } from './fertilizerFlow.ts'

const BERRY_IDS = ['petaya-berry', 'leppa-berry', 'golden-nanab-berry', 'aguav-berry', 'sitrus-berry', 'rawst-berry']

describe('grantDailyBerry (fertilizer)', () => {
  it('sem fertilizer não dá berry', () => {
    const s = createInitialState(1)
    grantDailyBerry(s)
    expect(s.inventory).toHaveLength(0)
  })
  it('com fertilizer adiciona 1 berry aleatória ao inventário', () => {
    const s = createInitialState(1)
    s.runItems = ['fertilizer']
    grantDailyBerry(s)
    expect(s.inventory).toHaveLength(1)
    expect(BERRY_IDS).toContain(s.inventory[0]!.itemId)
    expect(findItem(s.inventory[0]!.itemId)?.effect.kind).toBe('berry')
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx vitest run src/game/fertilizerFlow.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 6: Implementar `fertilizerFlow.ts`**

Criar `src/game/fertilizerFlow.ts`:

```typescript
// Fertilizer: toda manhã concede 1 berry aleatória ao inventário (determinístico por dia).
import type { GameState } from '../engine/state.ts'
import { takeRng } from './runtime.ts'

const FERTILIZER_BERRIES = [
  'petaya-berry',
  'leppa-berry',
  'golden-nanab-berry',
  'aguav-berry',
  'sitrus-berry',
  'rawst-berry',
] as const

/** Se o jogador tem Fertilizer, adiciona 1 berry sorteada ao inventário. */
export function grantDailyBerry(s: GameState): void {
  if (!s.runItems.includes('fertilizer')) return
  const berryId = takeRng(s).pick([...FERTILIZER_BERRIES])
  const stack = s.inventory.find((i) => i.itemId === berryId)
  if (stack) stack.quantity += 1
  else s.inventory = [...s.inventory, { itemId: berryId, quantity: 1 }]
}
```

- [ ] **Step 7: Disparar no avanço de dia**

Em `src/game/phaseFlow.ts`, importar `grantDailyBerry` de `./fertilizerFlow.ts` e chamar dentro de `startNextDay`, logo após `incubateEggs(s)`:

```typescript
  grantDailyBerry(s) // Fertilizer: 1 berry aleatória por dia
```

- [ ] **Step 8: Catálogo + cidade (Celadon)**

Em `src/data/items.ts`, adicionar ao `ITEMS`:

```typescript
  {
    id: 'silver-powder',
    name: 'Silver Powder',
    type: 'passive',
    price: 800,
    description: 'Pokémon do tipo Inseto viajam +50% mais rápido (acumula por inseto no esquadrão).',
    sprite: sprite('silver-powder'),
    effect: { kind: 'passive' },
  },
  {
    id: 'fertilizer',
    name: 'Fertilizer',
    type: 'passive',
    price: 400,
    description: 'Todo dia você recebe uma berry aleatória.',
    sprite: sprite('fertilizer'),
    effect: { kind: 'passive' },
  },
```

Em `CITY_ITEM_IDS`: `3: ['grassy-seed', 'fertilizer', 'silver-powder']`.

- [ ] **Step 9: Testes e build**

Run: `npx vitest run src/engine/secretEffects.test.ts src/game/fertilizerFlow.test.ts && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 10: Commit**

```bash
git add src/engine/balance.ts src/engine/secretEffects.ts src/game/phaseFlow.ts src/game/fertilizerFlow.ts src/data/items.ts src/engine/secretEffects.test.ts src/game/fertilizerFlow.test.ts
git commit -m "feat(itens): silver-powder (velocidade por inseto) e fertilizer (berry diaria)"
```

---

## Task 14: Verificação final (suíte completa + tipos)

**Files:** nenhum (validação).

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 2: Build/tipos**

Run: `npm run build`
Expected: tsc -b + vite build sem erros.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros (corrigir imports não usados / ordenação se necessário).

- [ ] **Step 4: Conferir cobertura do catálogo**

Verificar manualmente em `src/data/items.ts` que `GLOBAL_ITEM_IDS` contém: 6 berries, `everstone`, `poke-egg`; e que `CITY_ITEM_IDS` está assim:
- 3 (Celadon): `grassy-seed`, `fertilizer`, `silver-powder`
- 4 (Fuchsia): `black-sludge`, `sticky-barb`, `big-nugget`
- 5 (Saffron): `twisted-spoon`, `wise-glasses`, `full-incense`
- 6 (Cinnabar): `charcoal`, `zoom-lens`, `air-balloon`
- 7 (Viridian): `amulet-coin`, `wide-lens`, `grip-claw`

- [ ] **Step 5: Commit final (se houve ajustes de lint)**

```bash
git add -A
git commit -m "chore(itens): ajustes finais de lint/tipos"
```

---

## Notas de revisão (self-review)

- **Cobertura do spec:** Berries (T7), Everstone (T8), Poke Egg (T9–T11), e os 15 itens de cidade (T2–T6, T12–T13) + Shiny Charm (T1). Todos cobertos.
- **`heal(p, amount)`** existe em `attributes.ts:149`; `applyDamage` em `attributes.ts:143`; `mapAttrs` em `attributes.ts:25`. Confirmados.
- **Ranks por IV:** B=4, A=5, S=6 (`RANKS`); `rankCenter` do `createPokemon` mira o rank; shiny força rank S nativamente.
- **Pontos de XP/evolução:** `applyXpGains` é o chokepoint de XP (missão/defesa/exploração); evolução só em `evolveToLevel` (via `addXp` e Rare Candy) e `evolveOneStage` (Moon Stone) — todos tratados na T8.
- **Saves antigos:** acessos a `s.eggs`/`s.pendingHatches`/`s.airBalloon` usam `?.`/`??=` para não quebrar saves sem os campos novos.
- **Decisões assumidas (do design):** berry usável com HP cheio (ganho de atributo é o principal); boosts de tipo empilham multiplicativamente; sticky-barb pode desmaiar o defensor.
