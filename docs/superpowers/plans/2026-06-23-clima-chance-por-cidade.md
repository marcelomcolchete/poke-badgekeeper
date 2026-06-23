# Chance de clima por cidade e por dia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o orçamento global de chance de chuva/tempestade (400%/300%) por uma fórmula por cidade e por efeito que cresce com o dia e estabiliza num teto, funcionando em qualquer dia (preparo para o modo infinito); e aumentar a contagem de pancadas (+1 a cada 3 dias, teto 6).

**Architecture:** Os parâmetros da fórmula (`pisoBase`, `pisoPorDia`, `teto`) passam a morar na config de cada efeito em `cityWeather.ts`. Uma função pura genérica `weatherChanceForDay(seed, day, formula, salt)` calcula a chance do dia (um valor por dia, sorteado em `[piso, teto]`, estável por `(seed, dia)`). `rainChanceForDay`/`stormChanceForDay` passam a receber o `cityIndex` e delegam à genérica usando salts dedicados. Tudo continua função pura de `(seed, day, city)`.

**Tech Stack:** TypeScript, Vitest. Engine determinística com RNG semeado (`src/engine/rng.ts`).

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-06-23-clima-chance-por-cidade-design.md`.
- Gate inalterado: dias `< WEATHER_FIRST_ELIGIBLE_DAY (=3)` → chance 0, schedule vazio.
- NUNCA usar `Math.random()`/`Date.now()` na engine — sempre via `Rng` (`createRng`/`deriveSeed`).
- Verificação: `npm run build` (tsc -b) + `npm test`. Não usar `tsc --noEmit`. Sem screenshots/preview.
- Determinismo: o RNG do clima é isolado do cursor da run; os salts da chance NÃO podem colidir com os do agendamento (`WEATHER_SEED_SALT`/`STORM_SEED_SALT` combinados com `day`).
- Parâmetros por cidade/efeito (verbatim do spec):
  - Cerulean (1) chuva: `pisoBase 40, pisoPorDia 1, teto 70`
  - Vermilion (2) chuva: `pisoBase 15, pisoPorDia 2, teto 60`
  - Vermilion (2) tempestade: `pisoBase 20, pisoPorDia 1, teto 50`
- Pancadas: `maxTimes(dia) = clamp(⌊dia/3⌋, 0, 6)`.

---

## File Structure

- `src/data/cityWeather.ts` — **modify**: tipo `WeatherChanceFormula`; campo `chance` nos configs de efeito; parâmetros em `CITY_WEATHER`; acessores `cityRainChance`/`cityStormChance`.
- `src/data/cityWeather.test.ts` — **modify**: testes dos acessores.
- `src/engine/constants.ts` — **modify**: `WEATHER_CHANCE_SALT`, `STORM_CHANCE_SALT`.
- `src/engine/weather.ts` — **modify**: `weatherChanceForDay`; `rainChanceForDay(seed, day, cityIndex)`; `maxRainTimes`/`RAIN_MAX_TIMES_CAP`; remover `RAIN_CHANCE_TOTAL_PERCENT`; importar `lerp`; passar `city.index` em `buildWeatherSchedule`.
- `src/engine/weather.test.ts` — **modify**: testes de `rainChanceForDay` (faixa/regime/cidade), `maxRainTimes` nova curva; remover import/uso de `RAIN_CHANCE_TOTAL_PERCENT`.
- `src/engine/storm.ts` — **modify**: `stormChanceForDay(seed, day, cityIndex)`; remover import de `STORM_CHANCE_TOTAL_PERCENT`; passar `city.index`.
- `src/engine/balance.ts` — **modify**: remover `STORM_CHANCE_TOTAL_PERCENT`.
- `src/engine/storm.test.ts` — **modify**: `maxStormTimes` nova curva; testes de `stormChanceForDay`.
- `src/game/weatherAbilitiesSetup.test.ts` — **modify**: `stormChanceForDay(seed, day)` → `stormChanceForDay(seed, day, 2)`.

---

## Task 1: Config de fórmula por cidade/efeito + acessores

**Files:**
- Modify: `src/data/cityWeather.ts`
- Test: `src/data/cityWeather.test.ts`

**Interfaces:**
- Consumes: nada (ponto de partida).
- Produces:
  - `interface WeatherChanceFormula { pisoBase: number; pisoPorDia: number; teto: number }`
  - `RainEffectConfig` e `StormEffectConfig` ganham `chance: WeatherChanceFormula`
  - `cityRainChance(cityIndex: number): WeatherChanceFormula | null`
  - `cityStormChance(cityIndex: number): WeatherChanceFormula | null`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `src/data/cityWeather.test.ts` (ajustar o import da primeira linha para incluir os novos nomes):

```ts
import { describe, expect, it } from 'vitest'
import { cityHasRain, cityHasStorm, cityRainChance, cityStormChance, getCityWeather } from './cityWeather.ts'
```

E acrescentar este bloco no fim do arquivo:

```ts
describe('cityWeather — fórmula de chance por cidade/efeito', () => {
  it('Cerulean (1): chuva 40/1/70, sem tempestade', () => {
    expect(cityRainChance(1)).toEqual({ pisoBase: 40, pisoPorDia: 1, teto: 70 })
    expect(cityStormChance(1)).toBeNull()
  })

  it('Vermilion (2): chuva 15/2/60 e tempestade 20/1/50', () => {
    expect(cityRainChance(2)).toEqual({ pisoBase: 15, pisoPorDia: 2, teto: 60 })
    expect(cityStormChance(2)).toEqual({ pisoBase: 20, pisoPorDia: 1, teto: 50 })
  })

  it('cidade sem clima (0): ambos null', () => {
    expect(cityRainChance(0)).toBeNull()
    expect(cityStormChance(0)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/data/cityWeather.test.ts`
Expected: FAIL — `cityRainChance`/`cityStormChance` não existem (erro de import/compilação).

- [ ] **Step 3: Implementar em `src/data/cityWeather.ts`**

Adicionar o tipo `WeatherChanceFormula` e o campo `chance` (logo após o `WeatherEffectKind`):

```ts
/** Parâmetros da chance de um efeito: piso cresce por dia até travar no teto (regime do infinito). */
export interface WeatherChanceFormula {
  /** Piso conceitual no "dia 0". */
  pisoBase: number
  /** Quanto o piso sobe por dia. */
  pisoPorDia: number
  /** Teto fixo: valor de regime quando o piso o alcança. */
  teto: number
}
```

Trocar as interfaces dos efeitos para carregar a fórmula:

```ts
/** Efeito de Chuva: deixa poças pelo mapa (água temporária) — ver engine/weather.ts. */
export interface RainEffectConfig {
  kind: 'rain'
  chance: WeatherChanceFormula
}

/** Efeito de Tempestade: raios que caem pelo mapa (dano + Paralyze) — ver engine/storm.ts. */
export interface StormEffectConfig {
  kind: 'storm'
  chance: WeatherChanceFormula
}
```

Embutir os parâmetros em `CITY_WEATHER`:

```ts
const CITY_WEATHER: Record<number, CityWeather> = {
  // Cerulean (Água/Gelo): só chuva.
  1: { effects: [{ kind: 'rain', chance: { pisoBase: 40, pisoPorDia: 1, teto: 70 } }] },
  // Vermilion (Elétrico/Dragão): chuva + tempestade (raios encadeiam nas poças).
  2: {
    effects: [
      { kind: 'rain', chance: { pisoBase: 15, pisoPorDia: 2, teto: 60 } },
      { kind: 'storm', chance: { pisoBase: 20, pisoPorDia: 1, teto: 50 } },
    ],
  },
}
```

Adicionar os acessores (após `cityHasStorm`):

```ts
/** Fórmula de chance de Chuva da cidade, ou null se ela não tem o efeito. */
export function cityRainChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'rain')
  return e ? e.chance : null
}

/** Fórmula de chance de Tempestade da cidade, ou null se ela não tem o efeito. */
export function cityStormChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'storm')
  return e ? e.chance : null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/data/cityWeather.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/data/cityWeather.ts src/data/cityWeather.test.ts
git commit -m "feat(clima): fórmula de chance por cidade/efeito em cityWeather"
```

---

## Task 2: Pancadas — nova curva (+1 a cada 3 dias, teto 6)

**Files:**
- Modify: `src/engine/weather.ts:112-117` (`RAIN_MAX_TIMES_CAP`, `maxRainTimes`)
- Test: `src/engine/weather.test.ts:85-97` (bloco `maxRainTimes`)
- Test: `src/engine/storm.test.ts:59-63` (teste `maxStormTimes`)

**Interfaces:**
- Consumes: nada novo.
- Produces: `maxRainTimes(day)` e `RAIN_MAX_TIMES_CAP` com novos valores; `maxStormTimes` segue `maxRainTimes` (inalterado em assinatura).

- [ ] **Step 1: Atualizar os testes para a nova curva**

Em `src/engine/weather.test.ts`, substituir o `it` dentro de `describe('maxRainTimes')` (linhas ~86-88) por:

```ts
  it('+1 a cada 3 dias, capado em 6', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(maxRainTimes)).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3])
    expect(maxRainTimes(18)).toBe(6)
    expect(maxRainTimes(30)).toBe(6) // teto segura no infinito
  })
```

Em `src/engine/storm.test.ts`, substituir o `it('maxStormTimes ...')` (linhas ~59-63) por:

```ts
  it('maxStormTimes segue a chuva: +1 a cada 3 dias, cap 6', () => {
    expect(maxStormTimes(2)).toBe(0)
    expect(maxStormTimes(3)).toBe(1)
    expect(maxStormTimes(10)).toBe(3)
    expect(maxStormTimes(18)).toBe(6)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/weather.test.ts src/engine/storm.test.ts -t "cada 3 dias|maxStormTimes"`
Expected: FAIL — valores antigos (teto 4, curva /2) não batem.

- [ ] **Step 3: Implementar a nova curva em `src/engine/weather.ts`**

Substituir as linhas 111-117:

```ts
/** Teto de pancadas potenciais por dia. */
export const RAIN_MAX_TIMES_CAP = 6

/** Quantas pancadas potenciais no dia: +1 a cada 3 dias, capado em 6 (dia 3→1, 6→2, …, 18→6). */
export function maxRainTimes(day: number): number {
  return clamp(Math.floor(day / 3), 0, RAIN_MAX_TIMES_CAP)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/weather.test.ts src/engine/storm.test.ts -t "cada 3 dias|maxStormTimes"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/weather.ts src/engine/weather.test.ts src/engine/storm.test.ts
git commit -m "feat(clima): pancadas +1 a cada 3 dias, teto 6"
```

---

## Task 3: Chance de chuva por fórmula (`weatherChanceForDay` + `rainChanceForDay`)

**Files:**
- Modify: `src/engine/constants.ts` (adicionar `WEATHER_CHANCE_SALT`)
- Modify: `src/engine/weather.ts` (import `lerp` e acessor; `weatherChanceForDay`; `rainChanceForDay`; remover `RAIN_CHANCE_TOTAL_PERCENT`; wiring em `buildWeatherSchedule`)
- Test: `src/engine/weather.test.ts` (bloco `rainChanceForDay`; remover import/uso de `RAIN_CHANCE_TOTAL_PERCENT`)

**Interfaces:**
- Consumes: `cityRainChance` (Task 1); `WeatherChanceFormula` (Task 1); `lerp`/`clamp` de `./math.ts`; `createRng`/`deriveSeed` de `./rng.ts`.
- Produces:
  - `WEATHER_CHANCE_SALT: number` (em `constants.ts`)
  - `weatherChanceForDay(seed: number, day: number, formula: WeatherChanceFormula, salt: number): number`
  - `rainChanceForDay(seed: number, day: number, cityIndex: number): number`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/engine/weather.test.ts`:

1. No import de `./weather.ts` (linhas 4-23), **remover** a linha `RAIN_CHANCE_TOTAL_PERCENT,` e **adicionar** `weatherChanceForDay,`.

2. Substituir todo o `describe('rainChanceForDay', () => { … })` (linhas ~58-83) por:

```ts
describe('rainChanceForDay (fórmula por cidade)', () => {
  it('Cerulean: chance do dia fica em [piso(dia), teto] e é estável por (seed,dia)', () => {
    for (const seed of SEEDS) {
      for (let day = 3; day <= 10; day++) {
        const lo = Math.min(40 + day, 70)
        const c = rainChanceForDay(seed, day, 1)
        expect(c).toBeGreaterThanOrEqual(lo)
        expect(c).toBeLessThanOrEqual(70)
        expect(rainChanceForDay(seed, day, 1)).toBe(c) // estável
      }
    }
  })

  it('regime do infinito: piso encosta no teto (Cerulean dia 30+ → 70)', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(rainChanceForDay(seed, 30, 1)).toBe(70)
      expect(rainChanceForDay(seed, 50, 1)).toBe(70)
    }
  })

  it('funciona além do dia 10 (não zera como o modelo antigo)', () => {
    expect(rainChanceForDay(424242, 15, 1)).toBeGreaterThan(0)
  })

  it('há variedade entre os dias (não é tudo igual)', () => {
    const values = Array.from({ length: 8 }, (_, i) => rainChanceForDay(424242, i + 3, 1))
    expect(new Set(values).size).toBeGreaterThan(1)
  })

  it('dias < 3 → 0%; cidade sem chuva (Pewter=0) → 0%', () => {
    expect(rainChanceForDay(5, 1, 1)).toBe(0)
    expect(rainChanceForDay(5, 2, 1)).toBe(0)
    expect(rainChanceForDay(5, 7, 0)).toBe(0)
  })
})

describe('weatherChanceForDay (genérica)', () => {
  it('faixa colapsa quando piso ≥ teto (sempre o teto)', () => {
    const f = { pisoBase: 100, pisoPorDia: 0, teto: 50 }
    for (const seed of SEEDS.slice(0, 5)) expect(weatherChanceForDay(seed, 7, f, 0xabc)).toBe(50)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/weather.test.ts`
Expected: FAIL — `weatherChanceForDay` não existe e `rainChanceForDay` ainda tem aridade 2.

- [ ] **Step 3: Implementar em `src/engine/constants.ts`**

Adicionar logo após `WEATHER_SEED_SALT` (linha 75) e `STORM_SEED_SALT` (linha 78):

```ts
/** Salt do SORTEIO da chance de chuva — distinto do agendamento para não correlacionar streams. */
export const WEATHER_CHANCE_SALT = 0x52436863 // 'RChc'
```

- [ ] **Step 4: Implementar em `src/engine/weather.ts`**

1. Atualizar imports do topo:

```ts
import { clamp, lerp } from './math.ts'
import { cityHasRain, cityRainChance, type WeatherChanceFormula } from '../data/cityWeather.ts'
import { DAY_LENGTH_MS, TOTAL_DAYS, WEATHER_SEED_SALT, WEATHER_CHANCE_SALT } from './constants.ts'
```

(Remover `TOTAL_DAYS` do import **somente se** ficar sem uso — ver passo 3 abaixo; manter `cityHasRain`.)

2. **Remover** a linha `export const RAIN_CHANCE_TOTAL_PERCENT = 400` (linha 27) e seu comentário associado (linhas 26-27).

3. Substituir toda a função `rainChanceForDay` (linhas ~119-135, incluindo o bloco de comentário acima) por:

```ts
/**
 * Chance (0–100) de chuva do dia para uma fórmula. Sorteia UM valor em [piso, teto], estável por
 * (seed, dia). Piso = min(pisoBase + pisoPorDia·dia, teto); quando o piso encosta no teto a faixa
 * colapsa e a chance fixa no teto (regime do modo infinito). Usa um salt próprio do sorteio.
 */
export function weatherChanceForDay(
  seed: number,
  day: number,
  formula: WeatherChanceFormula,
  salt: number,
): number {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY) return 0
  const lo = Math.min(formula.pisoBase + formula.pisoPorDia * day, formula.teto)
  const u = createRng(deriveSeed(seed, day, salt)).next()
  return clamp(Math.round(lerp(lo, formula.teto, u)), 0, 100)
}

/** Chance de chuva (%) do dia na cidade. 0 se dia < 3 ou se a cidade não tem chuva. */
export function rainChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = cityRainChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, WEATHER_CHANCE_SALT)
}
```

> Nota: `TOTAL_DAYS` deixa de ser usado por `rainChanceForDay`. Se nenhum outro ponto de `weather.ts` o usar, removê-lo do import de `./constants.ts` (o `tsc -b` vai acusar import órfão). Conferir com busca antes de remover.

4. Em `buildWeatherSchedule` (linha ~200), trocar:

```ts
  const chance = clamp(rainChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/engine/weather.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/constants.ts src/engine/weather.ts src/engine/weather.test.ts
git commit -m "feat(clima): chance de chuva por fórmula de cidade (sem orçamento global)"
```

---

## Task 4: Chance de tempestade por fórmula (`stormChanceForDay`)

**Files:**
- Modify: `src/engine/constants.ts` (adicionar `STORM_CHANCE_SALT`)
- Modify: `src/engine/balance.ts:362` (remover `STORM_CHANCE_TOTAL_PERCENT`)
- Modify: `src/engine/storm.ts` (imports; `stormChanceForDay`; wiring em `buildStorms` e `buildDayWeather`)
- Modify: `src/game/weatherAbilitiesSetup.test.ts` (assinatura nas linhas 93, 105, 158, 170)
- Test: `src/engine/storm.test.ts` (testes de `stormChanceForDay`)

**Interfaces:**
- Consumes: `cityStormChance` (Task 1); `weatherChanceForDay` (Task 3); `STORM_CHANCE_SALT` (este task).
- Produces: `stormChanceForDay(seed: number, day: number, cityIndex: number): number`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/engine/storm.test.ts`, adicionar `stormChanceForDay` ao import de `./storm.ts` (linhas 2-14) e acrescentar este bloco dentro de `describe('storm — agendamento', …)` (após o teste de `maxStormTimes`):

```ts
  it('stormChanceForDay: Vermilion em [piso(dia), 50], regime 50 no dia 30+', () => {
    for (let day = 3; day <= 10; day++) {
      const lo = Math.min(20 + day, 50)
      const c = stormChanceForDay(123, day, 2)
      expect(c).toBeGreaterThanOrEqual(lo)
      expect(c).toBeLessThanOrEqual(50)
    }
    expect(stormChanceForDay(123, 30, 2)).toBe(50)
  })

  it('stormChanceForDay: cidade sem tempestade (Cerulean=1) → 0; dia < 3 → 0', () => {
    expect(stormChanceForDay(123, 7, 1)).toBe(0)
    expect(stormChanceForDay(123, 2, 2)).toBe(0)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: FAIL — `stormChanceForDay` não exportado / aridade errada.

- [ ] **Step 3: Implementar `STORM_CHANCE_SALT` em `src/engine/constants.ts`**

Adicionar junto ao `WEATHER_CHANCE_SALT` (Task 3):

```ts
/** Salt do SORTEIO da chance de tempestade — distinto do agendamento e da chuva. */
export const STORM_CHANCE_SALT = 0x53436863 // 'SChc'
```

- [ ] **Step 4: Remover `STORM_CHANCE_TOTAL_PERCENT` de `src/engine/balance.ts`**

Apagar a linha 362 (`export const STORM_CHANCE_TOTAL_PERCENT = 300`) e qualquer comentário só dela.

- [ ] **Step 5: Implementar em `src/engine/storm.ts`**

1. Imports — remover `STORM_CHANCE_TOTAL_PERCENT` do import de `./balance.ts` (linha 25); adicionar a fórmula e o salt:

```ts
import { weatherChanceForDay, puddleLevelAt, puddleNodePool, type RainEvent, WEATHER_FIRST_ELIGIBLE_DAY, maxRainTimes } from './weather.ts'
import { cityHasStorm, cityStormChance } from '../data/cityWeather.ts'
import { DAY_LENGTH_MS, TOTAL_DAYS, STORM_SEED_SALT, STORM_CHANCE_SALT, MAP_ASPECT_W } from './constants.ts'
```

> Conferir se `TOTAL_DAYS` ainda é usado em `storm.ts` (ex.: `strikeCountForDay`). Está — manter no import.

2. Substituir toda a função `stormChanceForDay` (linhas ~81-94, com o comentário) por:

```ts
/** Chance de tempestade (%) do dia na cidade. 0 se dia < 3 ou se a cidade não tem tempestade. */
export function stormChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = cityStormChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, STORM_CHANCE_SALT)
}
```

3. Em `buildStorms` (linha ~151), trocar para passar a cidade:

```ts
  const chance = clamp(stormChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
```

4. Em `buildDayWeather` (linha ~270), trocar:

```ts
      stormChancePercent: clamp(stormChanceForDay(seed, day, city.index) + extraStormChancePercent, 0, 100),
```

- [ ] **Step 6: Atualizar `src/game/weatherAbilitiesSetup.test.ts`**

Nas linhas 93, 105, 158 e 170, trocar `stormChanceForDay(seed, day)` por `stormChanceForDay(seed, day, 2)` (todos esses testes operam em Vermilion). Atualizar o comentário stale na linha ~182 para `// Day 9: maxRainTimes=3, maxStormTimes=3 without cap` (opcional, mas recomendado).

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/engine/storm.test.ts src/game/weatherAbilitiesSetup.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/constants.ts src/engine/balance.ts src/engine/storm.ts src/engine/storm.test.ts src/game/weatherAbilitiesSetup.test.ts
git commit -m "feat(clima): chance de tempestade por fórmula de cidade (sem orçamento global)"
```

---

## Task 5: Varredura de regressão (build + suíte completa) e PR

**Files:** nenhum por padrão; corrigir fallout caso apareça.

**Interfaces:** consome tudo das tasks anteriores.

- [ ] **Step 1: Build de tipos**

Run: `npm run build`
Expected: sem erros. Se acusar import órfão (`TOTAL_DAYS` em `weather.ts`, `RAIN_CHANCE_TOTAL_PERCENT`/`STORM_CHANCE_TOTAL_PERCENT` em algum lugar), remover o import órfão e re-rodar.

- [ ] **Step 2: Suíte completa**

Run: `npm test`
Expected: tudo verde. Arquivos a observar (usam `rainChancePercent`/`stormChancePercent`, em geral por comparação RELATIVA — devem passar sem mudança): `src/persistence/saveLoad.test.ts`, `src/game/missionWeather.test.ts`, `src/game/cloudNineSetup.test.ts`, `src/game/captureWeather.test.ts`, `src/game/captureWeatherSwift.test.ts`, `src/game/drySkinClearBodyRework.test.ts`, `src/engine/secretEffects.test.ts`, `src/engine/rainSpeed.test.ts`.

Se algum teste falhar por assertar um valor ABSOLUTO de chance do modelo antigo (orçamento 400%/300% ou teto 4 de pancadas):
- Se o teste valida comportamento de habilidade/missão (delta relativo), recalcular o valor esperado a partir do novo `rainChanceForDay`/`stormChanceForDay`/`maxRainTimes` (preferir referenciar a função, como os testes já fazem, em vez de cravar número).
- Não relaxar asserts de comportamento real; só atualizar os que dependiam do número antigo.

- [ ] **Step 3: Commit (se houve correções no Step 2)**

```bash
git add -A
git commit -m "test(clima): ajusta asserts dependentes da chance/teto antigos"
```

- [ ] **Step 4: Abrir PR para main**

```bash
git push -u origin feat/clima-chance-por-cidade
gh pr create --base main --title "Chance de clima por cidade e por dia (preparo p/ modo infinito)" --body "$(cat <<'EOF'
## Resumo
- Troca o orçamento global de chance (400% chuva / 300% tempestade) por fórmula por cidade/efeito que cresce com o dia e estabiliza num teto — funciona em qualquer dia (preparo para o modo infinito).
- Chance do dia = sorteio único em `[piso, teto]`, estável por `(seed, dia)`; piso = `min(pisoBase + pisoPorDia·dia, teto)`.
- Parâmetros: Cerulean chuva 40/1/70; Vermilion chuva 15/2/60; Vermilion tempestade 20/1/50.
- Pancadas: `+1 a cada 3 dias`, teto 6 (era +1/2 dias, teto 4).

Spec: `docs/superpowers/specs/2026-06-23-clima-chance-por-cidade-design.md`
Plano: `docs/superpowers/plans/2026-06-23-clima-chance-por-cidade.md`

## Teste
- `npm run build` + `npm test` verdes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

- **Spec coverage:** fórmula por cidade/efeito (Task 1) ✓; `weatherChanceForDay` + salts dedicados (Task 3/4) ✓; `rainChanceForDay`/`stormChanceForDay` por cidade (Task 3/4) ✓; piso travado no teto (testes Task 3/4) ✓; pancadas +1/3 dias teto 6 (Task 2) ✓; remoção dos orçamentos globais (Task 3/4) ✓; previsão/`extraChancePercent`/agendamento inalterados (não tocados) ✓; testes listados no spec (Tasks 1-5) ✓.
- **Placeholder scan:** sem TBD/TODO; todo passo de código mostra o código.
- **Type consistency:** `WeatherChanceFormula`, `cityRainChance`/`cityStormChance`, `weatherChanceForDay(seed, day, formula, salt)`, `rainChanceForDay(seed, day, cityIndex)`, `stormChanceForDay(seed, day, cityIndex)` consistentes entre tasks e call-sites (`buildWeatherSchedule`, `buildStorms`, `buildDayWeather`, `weatherAbilitiesSetup.test.ts`).
