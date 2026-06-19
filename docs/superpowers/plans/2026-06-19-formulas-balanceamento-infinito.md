# Fórmulas de balanceamento por dia (modo infinito) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os quatro arrays fixos de 10 dias (treinadores/dia, esquadrão/treinador, medalhas, dano) por fórmulas em função do dia, para prepararem o modo infinito.

**Architecture:** Funções puras na engine (`constants.ts`, `balance.ts`, `gymDefense.ts`, `timeline.ts`) calculadas a partir de `dia`, sem `clamp` em `TOTAL_DAYS` (só piso no dia 1). O tamanho do esquadrão passa a ser uma faixa `[min,max]` sorteada por treinador via o RNG que cada evento já possui. Sem mudança de schema/save.

**Tech Stack:** TypeScript (ESM, extensões `.ts` nos imports), Vitest, React/Vite. RNG determinístico `createRng`/`takeRng` (mulberry32).

## Global Constraints

- **Sem magic numbers:** todo número de tuning vira constante nomeada (`balance.ts` para knobs; `constants.ts` só para regras estruturais). Copiado do spec.
- **Imports com extensão `.ts`** (padrão do repo). Ex.: `from './balance.ts'`.
- **Determinismo:** nunca usar `Math.random()`/`Date.now()`; só `Rng`. `rng.int(a,b)` é inclusivo e lança se `b < a`.
- **Verificação de tipos:** usar `npm run build` (roda `tsc -b`), NÃO `tsc --noEmit` (tsconfig raiz é solution-only).
- **Testes:** `npx vitest run <arquivo>` para um arquivo; `npm test` para a suíte toda.
- **Save:** sem bump de `SAVE_VERSION` — tudo é derivado do dia, nada novo persistido.
- **Teto do esquadrão:** 6 (espelha `MAX_ROSTER_SIZE`). `min ≤ max` em todo dia.

---

### Task 1: Dano por golpe vira fórmula `ceil(dia/2)`

**Files:**
- Modify: `src/engine/constants.ts` (remove `HP_LOSS_BY_DAY`; reescreve `damageForDay`)
- Test: `src/data/balls.test.ts:80-87` (bloco "dano por dia")

**Interfaces:**
- Consumes: nada.
- Produces: `damageForDay(day: number): number` — agora `Math.ceil(Math.max(1, Math.round(day)) / 2)`, sem teto.

- [ ] **Step 1: Reescrever o teste do dano**

Em `src/data/balls.test.ts`, substituir o bloco `describe('dano por dia ...')` (linhas ~80-87) por:

```ts
describe('dano por dia (batalha e falha de missão)', () => {
  it('+1 a cada 2 dias: 1-2→1, 3-4→2, 9-10→5, sem teto', () => {
    expect([1, 2].map(damageForDay)).toEqual([1, 1])
    expect([3, 4].map(damageForDay)).toEqual([2, 2])
    expect([9, 10].map(damageForDay)).toEqual([5, 5])
    expect(damageForDay(11)).toBe(6)
    expect(damageForDay(20)).toBe(10)
  })

  it('dia ≤ 1 tem piso de dano 1', () => {
    expect(damageForDay(1)).toBe(1)
    expect(damageForDay(0)).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/data/balls.test.ts`
Expected: FAIL no bloco "dano por dia" (`damageForDay(10)` ainda devolve 4).

- [ ] **Step 3: Reescrever `damageForDay` e remover o array**

Em `src/engine/constants.ts`, apagar a constante `HP_LOSS_BY_DAY` (o bloco `export const HP_LOSS_BY_DAY = [...] as const`) e substituir a função `damageForDay` por:

```ts
/**
 * Dano de 1 golpe no dia dado (batalha/falha de missão): +1 a cada 2 dias, sem teto
 * (modo infinito). Dia 1-2 → 1, 3-4 → 2, …, 9-10 → 5. Piso no dia 1.
 */
export function damageForDay(day: number): number {
  const d = Math.max(1, Math.round(day))
  return Math.ceil(d / 2)
}
```

Conferir que `TOTAL_DAYS` continua exportado (ainda é usado em outros pontos); só a referência dentro de `damageForDay` sai.

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run src/data/balls.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/constants.ts src/data/balls.test.ts
git commit -m "feat(balance): dano por golpe vira ceil(dia/2) sem teto"
```

---

### Task 2: Treinadores por dia vira fórmula `ceil(dia/2)`

**Files:**
- Modify: `src/engine/balance.ts` (remove `DEFENSES_PER_DAY`)
- Modify: `src/engine/timeline.ts` (reescreve `defensesForDay`)
- Test: `src/engine/timeline.test.ts` (bloco "missionsForDay/defensesForDay" + imports)

**Interfaces:**
- Consumes: nada.
- Produces: `defensesForDay(day: number): number` — agora `Math.ceil(Math.max(1, Math.round(day)) / 2)`.

- [ ] **Step 1: Reescrever o teste de defesas**

Em `src/engine/timeline.test.ts`, remover `DEFENSES_PER_DAY` do import de `./balance.ts` (linha 6) e substituir o bloco `describe('missionsForDay/defensesForDay ...')` (linhas ~34-50) por:

```ts
describe('missionsForDay (tabela fixa) e defensesForDay (fórmula ceil(dia/2))', () => {
  it('missões seguem a tabela fixa, igual para todas as cidades', () => {
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      expect(missionsForDay(day)).toBe(MISSIONS_PER_DAY[day - 1])
    }
    expect(missionsForDay(1)).toBe(3)
    expect(missionsForDay(10)).toBe(8)
  })

  it('defesas = ceil(dia/2): dia 10=5, 20=10, 30=15, sem teto', () => {
    expect(defensesForDay(1)).toBe(1)
    expect(defensesForDay(5)).toBe(3)
    expect(defensesForDay(10)).toBe(5)
    expect(defensesForDay(20)).toBe(10)
    expect(defensesForDay(30)).toBe(15)
  })

  it('defesas crescem monotonicamente com o dia', () => {
    for (let day = 2; day <= 40; day++) {
      expect(defensesForDay(day)).toBeGreaterThanOrEqual(defensesForDay(day - 1))
    }
    expect(defensesForDay(40)).toBeGreaterThan(defensesForDay(10))
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/timeline.test.ts`
Expected: FAIL (import `DEFENSES_PER_DAY` removido / `defensesForDay(20)` ainda devolve 5).

- [ ] **Step 3: Remover o array e reescrever a função**

Em `src/engine/balance.ts`, apagar a linha `export const DEFENSES_PER_DAY = [...] as const` (manter `MISSIONS_PER_DAY`).

Em `src/engine/timeline.ts`, remover `DEFENSES_PER_DAY` do import de `./balance.ts` e reescrever:

```ts
/** Quantidade de defesas (batalhas) do dia: ceil(dia/2), sem teto (modo infinito). */
export function defensesForDay(day: number): number {
  return Math.ceil(Math.max(1, Math.round(day)) / 2)
}
```

Manter `missionsForDay`/`dayIndex` como estão (a tabela de missões não muda).

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run src/engine/timeline.test.ts`
Expected: PASS (inclusive o teste existente "quantidade casa com missionsForDay/defensesForDay", que usa `defensesForDay(6)` dinamicamente).

- [ ] **Step 5: Commit**

```bash
git add src/engine/balance.ts src/engine/timeline.ts src/engine/timeline.test.ts
git commit -m "feat(balance): treinadores por dia vira ceil(dia/2) sem teto"
```

---

### Task 3: Esquadrão por treinador vira faixa `[min,max]` sorteada

**Files:**
- Modify: `src/engine/balance.ts` (add knobs do esquadrão)
- Modify: `src/engine/gymDefense.ts` (remove `enemySquadSizeForDay`; add `squadSizeRange` + `rollSquadSize`)
- Modify: `src/game/setup.ts:138-139` (usa `rollSquadSize`)
- Modify: `src/game/missionFlow.ts:24,382-384` (usa `rollSquadSize`)
- Test: `src/engine/gymDefense.test.ts` (bloco "enemySquadSizeForDay" + imports)

**Interfaces:**
- Consumes: `Rng` (`./rng.ts`), `clamp` (`./math.ts`).
- Produces:
  - `squadSizeRange(day: number): { min: number; max: number }` — pura.
  - `rollSquadSize(rng: Rng, day: number): number` — sorteia inclusivo em `[min,max]`.
  - (remove `enemySquadSizeForDay`.)

- [ ] **Step 1: Adicionar os knobs em `balance.ts`**

Em `src/engine/balance.ts`, remover as constantes mortas do esquadrão antigo (`ENEMY_SQUAD_DAY1`, `ENEMY_SQUAD_DAY10`, `ENEMY_SQUAD_JITTER_FROM_DAY`) e adicionar:

```ts
/**
 * Defesa §4.4: tamanho do esquadrão invasor por treinador é uma FAIXA [min,max] sorteada,
 * que cresce com o dia e converge no teto 6. `min` sobe devagar (reta, atinge 6 ~dia 15);
 * `max` abre rápido (côncavo via raiz, atinge 6 ~dia 9). Pensado para o modo infinito.
 */
export const DEFENSE_SQUAD_MAX = 6
export const DEFENSE_SQUAD_MIN_SLOPE = 5 / 14
export const DEFENSE_SQUAD_MAX_SQRT_BASE = 9
```

- [ ] **Step 2: Reescrever o teste do esquadrão**

Em `src/engine/gymDefense.test.ts`: no import de `./constants.ts` (linha 3) remover `DEFENSE_SQUAD_BY_DAY` (deixar `ATTR_MAX`); no import de `./gymDefense.ts` trocar `enemySquadSizeForDay` por `squadSizeRange` e `rollSquadSize`. Substituir o bloco `describe('enemySquadSizeForDay ...')` (linhas ~367-382) por:

```ts
describe('squadSizeRange / rollSquadSize (faixa por dia, teto 6)', () => {
  it('âncoras: dia 1 = 1/1, dia 6 = 3/5, dia 10 = 4/6, dia 15 = 6/6', () => {
    expect(squadSizeRange(1)).toEqual({ min: 1, max: 1 })
    expect(squadSizeRange(6)).toEqual({ min: 3, max: 5 })
    expect(squadSizeRange(10)).toEqual({ min: 4, max: 6 })
    expect(squadSizeRange(15)).toEqual({ min: 6, max: 6 })
  })

  it('min ≤ max em todo dia e teto 6 (inclui modo infinito)', () => {
    for (let day = 1; day <= 60; day++) {
      const { min, max } = squadSizeRange(day)
      expect(min).toBeGreaterThanOrEqual(1)
      expect(min).toBeLessThanOrEqual(max)
      expect(max).toBeLessThanOrEqual(6)
    }
    expect(squadSizeRange(30)).toEqual({ min: 6, max: 6 })
  })

  it('rollSquadSize sorteia dentro da faixa do dia', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const day = 7
      const { min, max } = squadSizeRange(day)
      const size = rollSquadSize(createRng(seed), day)
      expect(size).toBeGreaterThanOrEqual(min)
      expect(size).toBeLessThanOrEqual(max)
    }
  })
})
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/gymDefense.test.ts`
Expected: FAIL (`squadSizeRange`/`rollSquadSize` não existem; import `DEFENSE_SQUAD_BY_DAY` removido).

- [ ] **Step 4: Implementar `squadSizeRange` + `rollSquadSize`**

Em `src/engine/gymDefense.ts`: remover `DEFENSE_SQUAD_BY_DAY` (e `TOTAL_DAYS`, se ficar sem uso) do import de `./constants.ts`; adicionar ao import de `./balance.ts` as constantes `DEFENSE_SQUAD_MAX`, `DEFENSE_SQUAD_MIN_SLOPE`, `DEFENSE_SQUAD_MAX_SQRT_BASE`. Substituir a função `enemySquadSizeForDay` (linhas ~143-151) por:

```ts
/**
 * Faixa [min,max] de Pokémon que um treinador invasor traz no dia (PLAN §4.4). `min` sobe
 * em reta (teto 6 ~dia 15); `max` abre rápido (côncavo, teto 6 ~dia 9). A dificuldade do dia
 * vem daqui (e da quantidade de treinadores), não da força por Pokémon. Vale p/ qualquer dia.
 */
export function squadSizeRange(day: number): { min: number; max: number } {
  const d = Math.max(1, Math.round(day))
  const min = clamp(Math.round(1 + (d - 1) * DEFENSE_SQUAD_MIN_SLOPE), 1, DEFENSE_SQUAD_MAX)
  const max = clamp(
    Math.round(1 + 5 * Math.sqrt((d - 1) / DEFENSE_SQUAD_MAX_SQRT_BASE)),
    1,
    DEFENSE_SQUAD_MAX,
  )
  return { min, max }
}

/** Sorteia (inclusive) o tamanho do esquadrão do treinador na faixa do dia. */
export function rollSquadSize(rng: Rng, day: number): number {
  const { min, max } = squadSizeRange(day)
  return rng.int(min, max)
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/gymDefense.test.ts`
Expected: PASS no novo bloco. (Outros blocos que passam `size` explícito a `generateDefenseEnemies`/`trainerSquadSpecies` seguem válidos.)

- [ ] **Step 6: Religar `setup.ts` e `missionFlow.ts`**

Em `src/game/setup.ts`: no import de `'../engine/gymDefense.ts'` trocar `enemySquadSizeForDay` por `rollSquadSize`. Em `buildDefense`, trocar a linha `const size = enemySquadSizeForDay(s.run.day)` por (sorteando com o RNG do evento, já criado acima dela):

```ts
  const size = rollSquadSize(rng, s.run.day)
```

Em `src/game/missionFlow.ts`: no import (linha ~24) trocar `enemySquadSizeForDay` por `rollSquadSize`. Em `setupRocketBattle`, trocar as duas linhas

```ts
  const size = enemySquadSizeForDay(s.run.day)
  const enemies = generateDefenseEnemies(takeRng(s), getTrainer(trainerId), size)
```

por (reaproveitando um único RNG; mantém o comportamento atual de Rocket sem medalha/dia=1 na geração dos inimigos):

```ts
  const rng = takeRng(s)
  const size = rollSquadSize(rng, s.run.day)
  const enemies = generateDefenseEnemies(rng, getTrainer(trainerId), size)
```

- [ ] **Step 7: Verificar build e suíte relacionada**

Run: `npm run build`
Expected: sem erros de tipo (nenhuma referência remanescente a `enemySquadSizeForDay`).

Run: `npx vitest run src/game/rocketFlow.test.ts src/game/reducer.test.ts`
Expected: PASS (`rocketFlow.test.ts:53` usa `toBeGreaterThan(0)`, compatível com a faixa).

- [ ] **Step 8: Commit**

```bash
git add src/engine/balance.ts src/engine/gymDefense.ts src/engine/gymDefense.test.ts src/game/setup.ts src/game/missionFlow.ts
git commit -m "feat(balance): esquadrao do treinador vira faixa [min,max] sorteada por dia"
```

---

### Task 4: Medalhas viram "piso de 10% na abertura + rampa até 100%"

**Files:**
- Modify: `src/engine/balance.ts` (substitui `MEDAL_UNLOCK_DAY`/`MEDAL_FULL_DAY` pelos novos params)
- Modify: `src/engine/gymDefense.ts` (reescreve `medalChancesForDay`)
- Test: `src/engine/gymDefense.test.ts` (bloco "medalhas dos invasores")

**Interfaces:**
- Consumes: `clamp` (`./math.ts`), `MEDAL_OPEN_CHANCE`, `MEDAL_OPEN_DAY`, `MEDAL_FULL_DAY` (`./balance.ts`).
- Produces: `medalChancesForDay(day): { bronze: number; silver: number; gold: number }` — acumuladas ("pelo menos esse tier"), ordenadas bronze ≥ silver ≥ gold. `rollMedalForDay` inalterada.

- [ ] **Step 1: Substituir os params de medalha em `balance.ts`**

Em `src/engine/balance.ts`, remover `export const MEDAL_FULL_DAY = 30` e `export const MEDAL_UNLOCK_DAY = {...}` e colocar:

```ts
/**
 * Probabilidade da medalha por dia ("piso de 10% na abertura + rampa até 100%"). Cada tier
 * abre num dia (MEDAL_OPEN_DAY) já com MEDAL_OPEN_CHANCE e a chance ACUMULADA ("pelo menos
 * esse tier") sobe linearmente até 100% no seu dia de saturação (MEDAL_FULL_DAY). Pensado p/
 * dias infinitos: do dia 30 em diante todo invasor sai Ouro. Bronze ≥ Prata ≥ Ouro sempre.
 */
export const MEDAL_OPEN_CHANCE = 0.1
export const MEDAL_OPEN_DAY = { bronze: 2, silver: 3, gold: 4 } as const
export const MEDAL_FULL_DAY = { bronze: 10, silver: 20, gold: 30 } as const
```

- [ ] **Step 2: Reescrever o teste das medalhas**

Em `src/engine/gymDefense.test.ts`, substituir o bloco `describe('medalhas dos invasores', ...)` (linhas ~406-439) por:

```ts
describe('medalhas dos invasores (piso de 10% + rampa)', () => {
  it('dia 1 zera tudo; aberturas: bronze d2, prata d3, ouro d4 (~10%)', () => {
    const d1 = medalChancesForDay(1)
    expect(d1).toEqual({ bronze: 0, silver: 0, gold: 0 })
    expect(medalChancesForDay(2).bronze).toBeCloseTo(0.1, 5)
    expect(medalChancesForDay(2).silver).toBe(0)
    expect(medalChancesForDay(3).silver).toBeCloseTo(0.1, 5)
    expect(medalChancesForDay(3).gold).toBe(0)
    expect(medalChancesForDay(4).gold).toBeCloseTo(0.1, 5)
  })

  it('acumuladas ordenadas (bronze ≥ prata ≥ ouro) e saturação por tier', () => {
    for (let day = 1; day <= 35; day++) {
      const { bronze, silver, gold } = medalChancesForDay(day)
      expect(bronze).toBeGreaterThanOrEqual(silver)
      expect(silver).toBeGreaterThanOrEqual(gold)
    }
    expect(medalChancesForDay(10).bronze).toBeCloseTo(1, 5)
    expect(medalChancesForDay(20).silver).toBeCloseTo(1, 5)
    const d30 = medalChancesForDay(30)
    expect(d30).toEqual({ bronze: 1, silver: 1, gold: 1 })
  })

  it('modo infinito: além do dia 30 segura em 100% (todo invasor Ouro)', () => {
    expect(medalChancesForDay(45)).toEqual({ bronze: 1, silver: 1, gold: 1 })
    for (let seed = 1; seed <= 50; seed++) {
      expect(rollMedalForDay(createRng(seed), 1)).toBeNull()
      expect(rollMedalForDay(createRng(seed), 30)).toBe('gold')
    }
  })
})
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/gymDefense.test.ts`
Expected: FAIL (fórmula antiga: prata abria no dia 6, etc.).

- [ ] **Step 4: Reescrever `medalChancesForDay`**

Em `src/engine/gymDefense.ts`, ajustar o import de `./balance.ts` (remover `MEDAL_UNLOCK_DAY` e o `MEDAL_FULL_DAY` antigo; adicionar `MEDAL_OPEN_CHANCE`, `MEDAL_OPEN_DAY`, `MEDAL_FULL_DAY`) e substituir a função `medalChancesForDay` (linhas ~117-127) por:

```ts
/**
 * Chance ACUMULADA ("pelo menos esse tier") de medalha por dia: cada tier abre no seu dia
 * (MEDAL_OPEN_DAY) já com MEDAL_OPEN_CHANCE e rampa linearmente até 100% no seu dia de
 * saturação (MEDAL_FULL_DAY). Bronze ≥ Prata ≥ Ouro sempre. Vale para qualquer dia.
 */
export function medalChancesForDay(day: number): { bronze: number; silver: number; gold: number } {
  const atLeast = (open: number, full: number): number => {
    if (day < open) return 0
    return clamp(MEDAL_OPEN_CHANCE + (1 - MEDAL_OPEN_CHANCE) * ((day - open) / (full - open)), 0, 1)
  }
  return {
    bronze: atLeast(MEDAL_OPEN_DAY.bronze, MEDAL_FULL_DAY.bronze),
    silver: atLeast(MEDAL_OPEN_DAY.silver, MEDAL_FULL_DAY.silver),
    gold: atLeast(MEDAL_OPEN_DAY.gold, MEDAL_FULL_DAY.gold),
  }
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/gymDefense.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/balance.ts src/engine/gymDefense.ts src/engine/gymDefense.test.ts
git commit -m "feat(balance): medalhas com piso de 10% na abertura e rampa por tier"
```

---

### Task 5: Verificação final — build, suíte completa e varredura de mortos

**Files:**
- Verify: repo inteiro.

**Interfaces:**
- Consumes: tudo das Tasks 1-4.
- Produces: nada (gate de qualidade).

- [ ] **Step 1: Build de tipos**

Run: `npm run build`
Expected: sem erros. Se acusar import não usado (ex.: `TOTAL_DAYS` em `gymDefense.ts`, `clamp` em algum arquivo), remover o import órfão.

- [ ] **Step 2: Buscar referências mortas**

Run: `git grep -nE "DEFENSE_SQUAD_BY_DAY|DEFENSES_PER_DAY|HP_LOSS_BY_DAY|enemySquadSizeForDay|MEDAL_UNLOCK_DAY|ENEMY_SQUAD_DAY"`
Expected: nenhuma ocorrência (fora de docs/plans). Se houver em código, corrigir.

- [ ] **Step 3: Suíte completa**

Run: `npm test`
Expected: todos os testes verdes.

- [ ] **Step 4: Commit (se algo foi ajustado no Step 1/2)**

```bash
git add -A
git commit -m "chore(balance): remove constantes mortas e imports orfaos das formulas por dia"
```

---

## Notas fora de escopo (não implementar aqui)

- Poder bruto do inimigo continua `Batalha-base ± IV` (sem escala por dia); `ENEMY_BASE_BATTLE`/`ENEMY_BATTLE_PER_DAY` seguem definidos e sem uso — ligar isso é um ajuste separado.
- O modo infinito em si (calendário > 10 dias) não é construído aqui.
