# Rebalanceamento de XP, corações e XP de ginásio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalancear a progressão de XP (curva de corações `2^(c−3)`, nova tabela de XP por nível, XP de ginásio cheio) e deixar o multiplicador de afinidade visível, com corações dourados pulsantes no máximo.

**Architecture:** Mudanças isoladas de balanceamento na engine (`hearts.ts`, `balance.ts`, `leveling.ts`, `gymDefense.ts`) consumidas pelas fórmulas puras já existentes, mais um ajuste de UI no componente `Hearts`. Sem migração de save — os campos `hearts`/`xp` já existem; só mudam as fórmulas que os interpretam.

**Tech Stack:** TypeScript, Vitest, React (CSS Modules).

## Global Constraints

- Sem magic numbers nos módulos: knobs de tuning ficam em `src/engine/balance.ts`; regras estruturais em `src/engine/constants.ts`. Copiar valores verbatim da spec.
- Verificação por `npm run build` (tsc -b) + Vitest. **Sem screenshots/preview** (preferência registrada).
- Comentários em pt-BR, no estilo do arquivo vizinho.
- Curva de corações exata nos 6 pontos inteiros: 0=⅛, 1=¼, 2=½, 3=1, 4=2, 5=4 — fórmula `2 ** (c − 3)`.
- Tabela de XP por nível (1→2 … 9→10): `[100, 300, 500, 700, 900, 1100, 1300, 1500, 2000]`.
- XP de ginásio = `Math.round(enemyBattle)` (sem ×0,5, sem teto).
- Missão especial **não muda** (já é pool 1200 dividido entre participantes).

---

### Task 1: Nova curva do multiplicador de XP por coração

Troca `heartXpMultiplier` para `2^(c−3)`, remove as constantes do modelo antigo e atualiza os testes que dependiam do multiplicador antigo (em `hearts.test.ts` e nos testes de `leveling.test.ts` que usam `addXp`).

**Files:**
- Modify: `src/engine/hearts.ts` (função `heartXpMultiplier` + comentários)
- Modify: `src/engine/constants.ts:138-139` (remover `HEARTS_XP_PER`, `HEARTS_XP_MAX_BONUS`)
- Test: `src/engine/hearts.test.ts` (bloco `heartXpMultiplier`)
- Test: `src/engine/leveling.test.ts` (neutralizar corações nos testes de `addXp`)

**Interfaces:**
- Consumes: `heartsOf(c)` (já existe, capa em `[0,5]` passo 0,5).
- Produces: `heartXpMultiplier(c: number | undefined): number` = `2 ** (heartsOf(c) − 3)`. Consumido por `addXp` (leveling.ts) e pelo componente `Hearts` (Task 5).

- [ ] **Step 1: Atualizar o teste do multiplicador (vai falhar)**

Substituir o bloco `describe('heartXpMultiplier — ...')` em `src/engine/leveling`/`hearts.test.ts` por:

```ts
describe('heartXpMultiplier — curva 2^(c−3)', () => {
  it('bate exato nos 6 pontos inteiros', () => {
    expect(heartXpMultiplier(0)).toBeCloseTo(1 / 8)
    expect(heartXpMultiplier(1)).toBeCloseTo(1 / 4)
    expect(heartXpMultiplier(2)).toBeCloseTo(1 / 2)
    expect(heartXpMultiplier(3)).toBeCloseTo(1)
    expect(heartXpMultiplier(4)).toBeCloseTo(2)
    expect(heartXpMultiplier(5)).toBeCloseTo(4)
  })

  it('padrão (ausente = 2 corações) rende metade da XP', () => {
    expect(heartXpMultiplier(undefined)).toBeCloseTo(1 / 2)
  })

  it('interpola os meios-corações geometricamente', () => {
    expect(heartXpMultiplier(2.5)).toBeCloseTo(Math.SQRT1_2) // ≈0,707
    expect(heartXpMultiplier(4.5)).toBeCloseTo(2 * Math.SQRT2) // ≈2,83
  })

  it('satura no teto de 5 corações (×4) acima do limite', () => {
    expect(heartXpMultiplier(99)).toBeCloseTo(4)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/engine/hearts.test.ts`
Expected: FAIL (o multiplicador antigo retorna 1, 1.2, 1.5…).

- [ ] **Step 3: Implementar a nova curva em `hearts.ts`**

Em `src/engine/hearts.ts`, trocar o import e a função. Remover `HEARTS_XP_MAX_BONUS` e `HEARTS_XP_PER` do import (deixar `HEARTS_MAX`, `HEARTS_MIN`, `HEARTS_START`, `HEARTS_STEP`):

```ts
// Corações de afinidade por Pokémon (0–5, passo 0,5). Puro: só números.
// O multiplicador de XP segue a curva 2^(c−3): 0♥=⅛, 1♥=¼, 2♥=½, 3♥=1, 4♥=2, 5♥=4
// (meios-corações interpolam geometricamente). No fim do dia o Pokémon ganha/perde
// corações conforme o desempenho (ver dailyHeartDelta).

import {
  HEARTS_MAX,
  HEARTS_MIN,
  HEARTS_START,
  HEARTS_STEP,
} from './constants.ts'
import { clamp, roundToStep } from './math.ts'
```

```ts
/** Multiplicador de XP pelos corações: 2^(c−3). 3♥ = neutro (×1); 5♥ = ×4; 0♥ = ⅛. */
export function heartXpMultiplier(hearts: number | undefined): number {
  return 2 ** (heartsOf(hearts) - 3)
}
```

- [ ] **Step 4: Remover as constantes obsoletas em `constants.ts`**

Em `src/engine/constants.ts`, no bloco de corações (linhas ~130-139), apagar as duas últimas linhas e ajustar o comentário:

```ts
/**
 * Corações por Pokémon: 0 a 5, passo de 0,5. Novos Pokémon (capturados/escolhidos) começam com 2.
 * O multiplicador de XP segue a curva 2^(coração − 3) (ver engine/hearts.ts).
 */
export const HEARTS_MIN = 0
export const HEARTS_MAX = 5
export const HEARTS_START = 2
export const HEARTS_STEP = 0.5
```

(Remover `HEARTS_XP_PER` e `HEARTS_XP_MAX_BONUS`.)

- [ ] **Step 5: Neutralizar corações nos testes de `addXp` (`leveling.test.ts`)**

Esses testes assumiam o multiplicador antigo (~×1,2 a 2♥) e quebram com ×½. Fixe os corações em **3** (neutro, ×1) para isolar a lógica de raridade/nível. Em `src/engine/leveling.test.ts`:

No bloco `pendingPoints / allocatePoint`, troque a criação por uma versão com `hearts: 3`:

```ts
const lvl1 = { ...createPokemon({ id: 'p', speciesId: 19, level: 1, rng: rng() }), hearts: 3 }
```

```ts
const base = { ...createPokemon({ id: 'r', speciesId: 7, level: 1, rng: rng() }), hearts: 3 }
```

No bloco `XP por raridade`:

```ts
const common = { ...createPokemon({ id: 'c', speciesId: 19, level: 1, rng: rng() }), hearts: 3 }
const legend = { ...createPokemon({ id: 'l', speciesId: 150, level: 1, rng: rng() }), hearts: 3 }
```

No bloco `evolução`, os dois `createPokemon` que recebem `addXp` (`bulba` no teste "evolui ao atingir o nível de evolução"):

```ts
const bulba = { ...createPokemon({ id: 'b', speciesId: 1, level: 1, rng: rng() }), hearts: 3 }
```

E no bloco `addXp e nível máximo`, os mons que recebem `addXp`:

```ts
const mon = { ...createPokemon({ id: 'm', speciesId: 1, level: 1, rng: rng() }), hearts: 3 }
```
```ts
const mon = { ...createPokemon({ id: 'm', speciesId: 1, level: 3, rng: rng() }), hearts: 3 }
```

(Os testes que **não** chamam `addXp` — createPokemon puro, ranking, evolveOneStage — ficam intactos.)

- [ ] **Step 6: Rodar a suíte afetada**

Run: `npx vitest run src/engine/hearts.test.ts src/engine/leveling.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/hearts.ts src/engine/constants.ts src/engine/hearts.test.ts src/engine/leveling.test.ts
git commit -m "feat(xp): multiplicador de corações vira curva 2^(c-3)"
```

---

### Task 2: Nova tabela de XP por nível (lookup)

`xpToNext` deixa de ser `XP_TO_NEXT_BASE × level` e passa a ler de um array.

**Files:**
- Modify: `src/engine/balance.ts:29-30` (remover `XP_TO_NEXT_BASE`, adicionar `XP_TO_NEXT`)
- Modify: `src/engine/leveling.ts:13,19-22` (import + `xpToNext`)
- Test: `src/engine/leveling.test.ts` (bloco `xpToNext`)

**Interfaces:**
- Consumes: `LEVEL_MAX` (=10, já existe).
- Produces: `XP_TO_NEXT: readonly number[]` (índice = L−1) e `xpToNext(level: number): number` (Infinity em L≥10). Consumido por `addXp`.

- [ ] **Step 1: Atualizar o teste de `xpToNext` (vai falhar)**

Substituir o bloco `describe('xpToNext', ...)` em `src/engine/leveling.test.ts` por:

```ts
describe('xpToNext', () => {
  it('segue a tabela de XP por nível', () => {
    expect(xpToNext(1)).toBe(100)
    expect(xpToNext(2)).toBe(300)
    expect(xpToNext(5)).toBe(900)
    expect(xpToNext(9)).toBe(2000)
  })

  it('é crescente e Infinity no nível máximo', () => {
    expect(xpToNext(1)).toBeLessThan(xpToNext(2))
    expect(xpToNext(LEVEL_MAX)).toBe(Infinity)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/engine/leveling.test.ts -t xpToNext`
Expected: FAIL (`xpToNext(2)` ainda retorna 200).

- [ ] **Step 3: Substituir a constante em `balance.ts`**

Em `src/engine/balance.ts`, trocar a linha `export const XP_TO_NEXT_BASE = 100`:

```ts
/** XP §4.1: XP para subir do nível L → L+1 (índice = L − 1). Nível 10 é o topo (Infinity). */
export const XP_TO_NEXT = [100, 300, 500, 700, 900, 1100, 1300, 1500, 2000] as const
```

- [ ] **Step 4: Atualizar `xpToNext` em `leveling.ts`**

Trocar o import na linha 13:

```ts
import { RARITY_XP_RATE, XP_TO_NEXT } from './balance.ts'
```

E a função:

```ts
/** XP para subir do nível `level` → `level+1`; Infinity no nível máximo (PLAN §4.1). */
export function xpToNext(level: number): number {
  if (level >= LEVEL_MAX) return Infinity
  return XP_TO_NEXT[level - 1] ?? Infinity
}
```

- [ ] **Step 5: Rodar a suíte de leveling**

Run: `npx vitest run src/engine/leveling.test.ts`
Expected: PASS (os demais testes usam `xpToNext()` simbolicamente e continuam válidos).

- [ ] **Step 6: Commit**

```bash
git add src/engine/balance.ts src/engine/leveling.ts src/engine/leveling.test.ts
git commit -m "feat(xp): nova tabela de XP por nível (lookup)"
```

---

### Task 3: XP de ginásio = poder de Batalha cheio do derrotado

`gymWinXp` passa a devolver a Batalha cheia do inimigo derrotado, sem fator e sem teto.

**Files:**
- Modify: `src/engine/gymDefense.ts:26-28,109-115` (import + `gymWinXp`)
- Modify: `src/engine/balance.ts:166-170` (remover `GYM_XP_PER_BATTLE_POWER`, `GYM_XP_CAP_PER_WIN`)
- Test: `src/engine/gymDefense.test.ts:32-45` (bloco `gymWinXp`)

**Interfaces:**
- Produces: `gymWinXp(enemyBattle: number): number` = `Math.round(enemyBattle)`. Consumido por `reducer` (já usa via função, sem mudança de teste).

- [ ] **Step 1: Atualizar o teste de `gymWinXp` (vai falhar)**

Substituir o bloco `describe('gymWinXp ...')` (linhas 32-45) em `src/engine/gymDefense.test.ts` por:

```ts
describe('gymWinXp — poder de Batalha cheio do desafiante derrotado', () => {
  it('rende a Batalha cheia (sem ×0,5, sem teto)', () => {
    expect(gymWinXp(20)).toBe(20)
    expect(gymWinXp(40)).toBe(40)
    expect(gymWinXp(90)).toBe(90)
  })

  it('não satura em valores altos', () => {
    expect(gymWinXp(200)).toBe(200)
  })

  it('arredonda valores fracionários', () => {
    expect(gymWinXp(15.4)).toBe(15)
  })
})
```

(O import de `ATTR_MAX` permanece — ainda é usado adiante em `gymDefense.test.ts:529`.)

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/engine/gymDefense.test.ts -t gymWinXp`
Expected: FAIL (`gymWinXp(20)` ainda retorna 10).

- [ ] **Step 3: Atualizar `gymWinXp` em `gymDefense.ts`**

Remover `GYM_XP_CAP_PER_WIN` e `GYM_XP_PER_BATTLE_POWER` do bloco de import de `./balance.ts` (linhas 27-28). Trocar a função (linhas 109-115):

```ts
/**
 * XP por duelo vencido = poder de Batalha CHEIO do desafiante derrotado (§4.4, ajuste).
 * Sem fator e sem teto: derrubar um inimigo de 90 de Batalha rende 90 de XP.
 */
export function gymWinXp(enemyBattle: number): number {
  return Math.round(enemyBattle)
}
```

- [ ] **Step 4: Remover as constantes em `balance.ts`**

Em `src/engine/balance.ts`, apagar o bloco (linhas ~163-170):

```ts
export const GYM_XP_PER_BATTLE_POWER = 0.5
export const GYM_XP_CAP_PER_WIN = 30
```

junto do comentário de doc associado.

- [ ] **Step 5: Rodar gymDefense + reducer**

Run: `npx vitest run src/engine/gymDefense.test.ts src/game/reducer.test.ts`
Expected: PASS (`reducer.test.ts:238` usa `gymWinXp()` via função e adapta sozinho: agora 20+40 = 60).

- [ ] **Step 6: Commit**

```bash
git add src/engine/gymDefense.ts src/engine/balance.ts src/engine/gymDefense.test.ts
git commit -m "feat(xp): XP de ginásio = poder de Batalha cheio do derrotado"
```

---

### Task 4: Display do multiplicador + corações dourados pulsantes no 5

`Hearts` ganha um rótulo fixo com o multiplicador (`×N XP`) e destaque dourado pulsante quando cheio (5 corações).

**Files:**
- Modify: `src/components/common/Hearts.tsx`
- Modify: `src/components/common/common.module.css` (após `.heartsOn`, ~linha 100)
- Test: `src/components/common/Hearts.test.ts` (Create — testa o helper de rótulo)

**Interfaces:**
- Consumes: `heartsOf`, `heartXpMultiplier` (de `engine/hearts.ts`), `HEARTS_MAX`.
- Produces: `xpMultiplierLabel(hearts: number): string` (exportado de `Hearts.tsx`) — rótulo compacto por passo de coração; e o JSX com `.heartsXp` + `.heartsGold`.

- [ ] **Step 1: Escrever o teste do helper de rótulo (vai falhar)**

Create `src/components/common/Hearts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { xpMultiplierLabel } from './Hearts.tsx'

describe('xpMultiplierLabel', () => {
  it('usa frações limpas nos corações inteiros', () => {
    expect(xpMultiplierLabel(0)).toBe('⅛')
    expect(xpMultiplierLabel(1)).toBe('¼')
    expect(xpMultiplierLabel(2)).toBe('½')
    expect(xpMultiplierLabel(3)).toBe('1')
    expect(xpMultiplierLabel(4)).toBe('2')
    expect(xpMultiplierLabel(5)).toBe('4')
  })

  it('usa 2 casas (vírgula) nos meios-corações', () => {
    expect(xpMultiplierLabel(2.5)).toBe('0,71')
    expect(xpMultiplierLabel(4.5)).toBe('2,83')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/components/common/Hearts.test.ts`
Expected: FAIL (`xpMultiplierLabel` não existe).

- [ ] **Step 3: Reescrever `Hearts.tsx`**

Substituir o conteúdo de `src/components/common/Hearts.tsx` por:

```tsx
import { HEARTS_MAX } from '../../engine/constants.ts'
import { heartsOf, heartXpMultiplier } from '../../engine/hearts.ts'
import styles from './common.module.css'

/** Rótulo compacto do multiplicador de XP por nível de afinidade (passos de 0,5). */
const XP_MULT_LABEL: Record<number, string> = {
  0: '⅛',
  0.5: '0,18',
  1: '¼',
  1.5: '0,35',
  2: '½',
  2.5: '0,71',
  3: '1',
  3.5: '1,41',
  4: '2',
  4.5: '2,83',
  5: '4',
}

/** Texto do multiplicador de XP exibido ao lado dos corações (sem o '×'). */
export function xpMultiplierLabel(hearts: number): string {
  return XP_MULT_LABEL[hearts] ?? heartXpMultiplier(hearts).toFixed(2).replace('.', ',')
}

/** Corações 0–5 (passos de 0,5) por sobreposição de largura — afinidade do Pokémon. */
export function Hearts({ value }: { value: number | undefined }) {
  const hearts = heartsOf(value)
  const pct = `${(hearts / HEARTS_MAX) * 100}%`
  const label = xpMultiplierLabel(hearts)
  const full = hearts === HEARTS_MAX
  const onClass = full ? `${styles.heartsOn} ${styles.heartsGold}` : styles.heartsOn
  return (
    <span className={styles.hearts} aria-label={`${hearts} de ${HEARTS_MAX} corações — ×${label} de XP`}>
      <span className={styles.heartsOff}>{'♥'.repeat(HEARTS_MAX)}</span>
      <span className={onClass} style={{ width: pct }}>
        {'♥'.repeat(HEARTS_MAX)}
      </span>
      <span className={styles.heartsXp} aria-hidden="true">{`×${label} XP`}</span>
    </span>
  )
}
```

- [ ] **Step 4: Rodar o teste do helper**

Run: `npx vitest run src/components/common/Hearts.test.ts`
Expected: PASS.

- [ ] **Step 5: Adicionar o CSS do rótulo e do pulso dourado**

Em `src/components/common/common.module.css`, após o bloco `.heartsOn` (~linha 100), acrescentar:

```css
.heartsXp {
  margin-left: 6px;
  font-size: 0.78em;
  font-weight: 600;
  color: var(--c-text-muted, #8a8f98);
  vertical-align: middle;
}

.heartsGold {
  color: var(--c-star-on, gold);
  animation: heartsPulse 1.1s ease-in-out infinite;
}

@keyframes heartsPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .heartsGold {
    animation: none;
  }
}
```

- [ ] **Step 6: Verificar build de tipos + tudo verde**

Run: `npm run build`
Expected: tsc -b sem erros e build OK.

- [ ] **Step 7: Commit**

```bash
git add src/components/common/Hearts.tsx src/components/common/common.module.css src/components/common/Hearts.test.ts
git commit -m "feat(ui): rótulo do multiplicador de XP e corações dourados pulsantes no 5"
```

---

### Task 5: Verificação final da suíte completa

Garante que nada quebrou fora do escopo previsto.

**Files:** nenhum (só execução).

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm run test`
Expected: PASS (todos os arquivos).

- [ ] **Step 2: Build final de tipos**

Run: `npm run build`
Expected: sem erros de tipo; build conclui.

- [ ] **Step 3 (se algo falhar fora do previsto):** investigar o teste vermelho, confirmar se depende do multiplicador/tabela antigos e ajustar a expectativa (mantendo a INTENÇÃO do teste). Não relaxar asserções para "passar".

---

## Self-Review

**Spec coverage:**
- §1 curva de corações `2^(c−3)` + remoção de constantes → Task 1. ✓
- §2 nova tabela de XP (lookup) + remoção de `XP_TO_NEXT_BASE` → Task 2. ✓
- §3 rótulo fixo do multiplicador + pulso dourado no 5 + `prefers-reduced-motion` → Task 4. ✓
- §4 XP de ginásio cheio + remoção de constantes → Task 3. ✓
- §5 missão especial sem mudança → confirmado na spec; nenhuma task (correto). ✓
- Testes afetados (leveling por causa do multiplicador) → tratados na Task 1, Step 5. ✓

**Placeholder scan:** sem TBD/TODO; todo passo de código mostra o código. ✓

**Type consistency:** `heartXpMultiplier`, `xpToNext`, `XP_TO_NEXT`, `gymWinXp`, `xpMultiplierLabel` usados com as mesmas assinaturas entre tasks. `ATTR_MAX` confirmado ainda em uso em gymDefense.test.ts:529 (import preservado). `reducer.test.ts` usa `gymWinXp()` via função (sem edição). ✓
