# Efeito Calor (Celadon) + Habilidades de Calor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o efeito climático "Calor" a partir de Celadon (índice 3) — janela de 30–60s que reduz 80% a velocidade de viagem (missões + captura) — e ligar as habilidades de calor (Ice Body, Clear Body, Dry Skin) + a Chlorophyll recém-mergeada (imune + velocidade), com selo, previsão e som.

**Architecture:** O Calor é um terceiro efeito determinístico por cidade (`data/cityWeather.ts`), com agenda própria (`engine/heat.ts`, salt isolado) montada em `buildDayWeather`. O slowdown é integrado em degraus pelo `rainTravelMs` generalizado para `weatherTravelMs` (união das janelas chuva+calor), já compartilhado por missão e captura. Imunidade e bônus de velocidade são predicados de time em `engine/secretEffects.ts`.

**Tech Stack:** TypeScript, Vitest, React (Vite). RNG determinístico (`createRng`/`deriveSeed`).

## Global Constraints

- **Build/tipos:** verificar com `npm run build` (tsc -b), NÃO `tsc --noEmit` (o tsconfig raiz é solution-only).
- **Determinismo:** toda agenda climática é função pura de `(seed, dia, cidade)`; RNG do calor usa salts próprios e NÃO toca o cursor de RNG da run.
- **Celadon = cityIndex `3`** (Cerulean=1, Vermilion=2 já têm clima).
- **Fórmulas de chance (por pancada):** Calor `{ pisoBase: 20, pisoPorDia: 1, teto: 50 }`; Chuva `{ 10, 1, 40 }`; Tempestade `{ 5, 1, 20 }`.
- **Duração do Calor:** 30–60s. **Pancadas/dia:** mesma curva de chuva (`maxRainTimes`).
- **Slowdown:** `HEAT_SLOW_FACTOR = 0.2` (−80%), multiplicativo sobre a base; só atinge viagem a pé (missão + captura).
- **Chlorophyll:** `+200%`/`+300%` aditivos (`= 2`/`= 3`, espelham `SWIFT_SWIM_RAIN_BONUS = 2`) e implica imunidade.
- **Imunidade ao calor (nível de time):** Ice Body, Clear Body (≥1) ou Chlorophyll.
- **Dry Skin no calor:** `−25%` de vida no despacho (piso 1); L2 `−25%` de atributos em missão (anulado por Clear Body L2 — regra já existente).
- **Som:** loop com fade, best-effort (falha em silêncio), respeita mute + volume mestre.

---

## File Structure

- `src/data/cityWeather.ts` — adiciona `'heat'`, `HeatEffectConfig`, Celadon(3), `cityHasHeat`/`cityHeatChance`.
- `src/engine/constants.ts` — `HEAT_SEED_SALT`, `HEAT_CHANCE_SALT`; bump `SAVE_VERSION` 37→38.
- `src/engine/balance.ts` — `HEAT_EVENT_MIN_MS`, `HEAT_EVENT_MAX_MS`, `HEAT_GAP_MS`, `HEAT_SLOW_FACTOR`, `CHLOROPHYLL_HEAT_BONUS_L1`, `CHLOROPHYLL_HEAT_BONUS_L2`.
- `src/engine/weather.ts` — `WeatherSchedule.heat`, forecast `heatChancePercent`/`potentialHeatCount`, `emptyWeatherSchedule`.
- `src/engine/heat.ts` (novo) — `HeatEvent`, `maxHeatTimes`, `heatChanceForDay`, `buildHeat`, `activeHeatAt`, `isHot`.
- `src/engine/storm.ts` — `buildDayWeather` monta o calor.
- `src/engine/secretEffects.ts` — `hasChlorophyll`, `teamImmuneToHeat`, `teamHeatSpeedBonus`; Dry Skin L2 no calor.
- `src/engine/rainSpeed.ts` — `rainTravelMs` → `weatherTravelMs` + `instantWeatherSpeed`.
- `src/game/missionFlow.ts`, `src/game/captureFlow.ts` — usam `weatherTravelMs`/`instantWeatherSpeed`; Dry Skin no despacho.
- `src/game/setup.ts`, `src/components/screens/DayForecastPanel.tsx` — `heatDelta` (Cloud Nine/Overcoat/Own Tempo).
- `src/components/day/WeatherBadge.tsx`, `src/components/day/DayScreen.tsx`, `src/components/screens/DayForecastPanel.tsx` (+`.module.css`) — selo + linha de previsão.
- `src/audio/heatPlayer.ts` (novo), `src/audio/useGameSounds.ts` — som.
- `src/persistence/saveLoad.ts` — migração v37→v38.

---

## Task 1: Modelo de dados por cidade (Calor + Celadon)

**Files:**
- Modify: `src/data/cityWeather.ts`
- Test: `src/data/cityWeather.test.ts`

**Interfaces:**
- Produces: `cityHasHeat(cityIndex: number): boolean`, `cityHeatChance(cityIndex: number): WeatherChanceFormula | null`; tipo `'heat'` em `WeatherEffectKind`; Celadon(3) registrado.

- [ ] **Step 1: Escrever os testes que falham** — em `src/data/cityWeather.test.ts`, adicionar:

```ts
import { cityHasHeat, cityHeatChance } from './cityWeather.ts'

describe('cityWeather — Calor (Celadon)', () => {
  it('Celadon (índice 3) tem calor, chuva e tempestade', () => {
    expect(cityHasHeat(3)).toBe(true)
    expect(cityHasRain(3)).toBe(true)
    expect(cityHasStorm(3)).toBe(true)
  })

  it('Celadon (3): fórmulas do pedido', () => {
    expect(cityHeatChance(3)).toEqual({ pisoBase: 20, pisoPorDia: 1, teto: 50 })
    expect(cityRainChance(3)).toEqual({ pisoBase: 10, pisoPorDia: 1, teto: 40 })
    expect(cityStormChance(3)).toEqual({ pisoBase: 5, pisoPorDia: 1, teto: 20 })
  })

  it('Celadon lista os efeitos na ordem calor → chuva → tempestade', () => {
    expect(getCityWeather(3)!.effects.map((e) => e.kind)).toEqual(['heat', 'rain', 'storm'])
  })

  it('cidades sem calor retornam null/false', () => {
    expect(cityHasHeat(1)).toBe(false)
    expect(cityHeatChance(2)).toBeNull()
  })
})
```

Ajustar o import do topo do arquivo de teste para incluir `cityHasRain, cityRainChance` (já importados) — já presentes.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/data/cityWeather.test.ts`
Expected: FAIL (`cityHasHeat`/`cityHeatChance` não existem; índice 3 ausente).

- [ ] **Step 3: Implementar** — em `src/data/cityWeather.ts`:

Trocar a linha do tipo:
```ts
export type WeatherEffectKind = 'rain' | 'storm' | 'heat'
```

Adicionar a config e estender a união (após `StormEffectConfig`):
```ts
/** Efeito de Calor: janela quente que reduz a velocidade de viagem — ver engine/heat.ts. */
export interface HeatEffectConfig {
  kind: 'heat'
  chance: WeatherChanceFormula
}

export type WeatherEffectConfig = RainEffectConfig | StormEffectConfig | HeatEffectConfig
```

Registrar Celadon no `CITY_WEATHER` (após o índice 2):
```ts
  // Celadon (Grama/Inseto): calor + chuva + tempestade (na ordem da previsão).
  3: {
    effects: [
      { kind: 'heat', chance: { pisoBase: 20, pisoPorDia: 1, teto: 50 } },
      { kind: 'rain', chance: { pisoBase: 10, pisoPorDia: 1, teto: 40 } },
      { kind: 'storm', chance: { pisoBase: 5, pisoPorDia: 1, teto: 20 } },
    ],
  },
```

Adicionar os helpers (após `cityStormChance`):
```ts
/** A cidade tem o efeito de Calor habilitado? */
export function cityHasHeat(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'heat') ?? false
}

/** Fórmula de chance de Calor da cidade, ou null se ela não tem o efeito. */
export function cityHeatChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'heat')
  return e ? e.chance : null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/data/cityWeather.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/cityWeather.ts src/data/cityWeather.test.ts
git commit -m "feat(clima): Calor por cidade — Celadon (indice 3) + helpers"
```

---

## Task 2: Estrutura do schedule (constantes, salts, campo `heat`, previsão)

**Files:**
- Modify: `src/engine/balance.ts`, `src/engine/constants.ts`, `src/engine/weather.ts`
- Modify (corrigir literais): `src/engine/rainSpeed.test.ts`, `src/engine/secretEffects.test.ts`, `src/engine/weather.test.ts`, `src/game/captureWeather.test.ts`, `src/game/captureWeatherSwift.test.ts`, `src/game/drySkinClearBodyRework.test.ts`, `src/game/missionWeather.test.ts`, `src/persistence/saveLoad.test.ts`
- Test: `src/engine/weather.test.ts`

**Interfaces:**
- Produces: `WeatherSchedule.heat: HeatEvent[]`; `WeatherForecast.heatChancePercent`/`potentialHeatCount`; constantes `HEAT_EVENT_MIN_MS=30_000`, `HEAT_EVENT_MAX_MS=60_000`, `HEAT_GAP_MS=4_000`, `HEAT_SLOW_FACTOR=0.2`, `CHLOROPHYLL_HEAT_BONUS_L1=2`, `CHLOROPHYLL_HEAT_BONUS_L2=3`; salts `HEAT_SEED_SALT`, `HEAT_CHANCE_SALT`.
- Consumes: `type HeatEvent` de `engine/heat.ts` (criado na Task 3 — neste passo o campo é tipado via `import type`, que não exige o runtime ainda; a Task 3 cria o arquivo. Para manter o build verde ANTES da Task 3, declare o tipo localmente conforme o Step 3).

- [ ] **Step 1: Escrever o teste que falha** — em `src/engine/weather.test.ts`, adicionar:

```ts
it('emptyWeatherSchedule inclui heat vazio e previsão de calor zerada', () => {
  const s = emptyWeatherSchedule()
  expect(s.heat).toEqual([])
  expect(s.forecast.heatChancePercent).toBe(0)
  expect(s.forecast.potentialHeatCount).toBe(0)
})
```

Garantir que `emptyWeatherSchedule` está importado no topo do teste (se não estiver, adicionar ao import de `./weather.ts`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/weather.test.ts`
Expected: FAIL (`heat`/`heatChancePercent` ausentes).

- [ ] **Step 3: Implementar a estrutura.**

Em `src/engine/balance.ts` (junto das constantes de tempestade, perto de `STORM_GAP_MS`):
```ts
/** Calor: duração de um evento (ms de jogo) e folga entre eventos. */
export const HEAT_EVENT_MIN_MS = 30_000
export const HEAT_EVENT_MAX_MS = 60_000
export const HEAT_GAP_MS = 4_000
/** Calor: fator multiplicativo da velocidade de viagem enquanto quente (0.2 = −80%). */
export const HEAT_SLOW_FACTOR = 0.2
/** Chlorophyll: bônus ADITIVO de velocidade do time no calor (espelha SWIFT_SWIM_RAIN_BONUS). */
export const CHLOROPHYLL_HEAT_BONUS_L1 = 2
export const CHLOROPHYLL_HEAT_BONUS_L2 = 3
```

Em `src/engine/constants.ts` (após `STORM_CHANCE_SALT`):
```ts
/** Sub-seed do Calor: agenda própria do dia (independe de chuva/tempestade). */
export const HEAT_SEED_SALT = 0x48656174 // 'Heat'
/** Salt do SORTEIO da chance de Calor — distinto do agendamento e dos demais efeitos. */
export const HEAT_CHANCE_SALT = 0x48436863 // 'HChc'
```

Em `src/engine/weather.ts`:
- Adicionar o import de tipo (após o import de `StormEvent`):
```ts
import type { HeatEvent } from './heat.ts'
```
- No `WeatherForecast`, adicionar os dois campos (após `potentialStormCount`):
```ts
  /** Chance de calor do dia (0–100). 0 se a cidade não tem calor. */
  heatChancePercent: number
  /** Quantas janelas de calor podem ocorrer hoje (0–6). */
  potentialHeatCount: number
```
- No `WeatherSchedule`, adicionar o campo (após `storms`):
```ts
  /** Janelas de calor do dia (slowdown), ordenadas por startMs. Vazio se não há calor. */
  heat: HeatEvent[]
```
- Em `emptyWeatherSchedule()`, incluir `heat: []` e os dois campos de previsão zerados:
```ts
export function emptyWeatherSchedule(): WeatherSchedule {
  return {
    rain: [],
    storms: [],
    heat: [],
    forecast: {
      rainChancePercent: 0,
      rainMmPerHour: 0,
      potentialRainCount: 0,
      stormChancePercent: 0,
      potentialStormCount: 0,
      heatChancePercent: 0,
      potentialHeatCount: 0,
    },
  }
}
```

- [ ] **Step 4: Corrigir os literais de `WeatherSchedule`/`WeatherForecast` nos testes** (para o build voltar a compilar). Em CADA um dos arquivos abaixo, todo objeto literal que monta um `WeatherSchedule` deve ganhar `heat: []`, e todo `forecast` literal deve ganhar `heatChancePercent: 0, potentialHeatCount: 0`:

- `src/engine/rainSpeed.test.ts` (função `rainUntil`)
- `src/engine/secretEffects.test.ts`
- `src/engine/weather.test.ts`
- `src/game/captureWeather.test.ts`
- `src/game/captureWeatherSwift.test.ts`
- `src/game/drySkinClearBodyRework.test.ts`
- `src/game/missionWeather.test.ts`
- `src/persistence/saveLoad.test.ts`

Exemplo (em `rainSpeed.test.ts`, `rainUntil`):
```ts
function rainUntil(endMs: number): WeatherSchedule {
  return {
    rain: [{ startMs: 0, endMs, puddles: [] }],
    storms: [],
    heat: [],
    forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 0, potentialHeatCount: 0 },
  }
}
```

Localizar cada literal com:
```bash
grep -rn "storms: \[\]\|rainChancePercent:" src/engine src/game src/persistence --include=*.ts
```

- [ ] **Step 5: Rodar build + o teste**

Run: `npm run build && npx vitest run src/engine/weather.test.ts`
Expected: build PASS; teste PASS.

> Nota: `engine/heat.ts` ainda não existe; o `import type { HeatEvent }` é apagado na compilação (type-only), então o build passa. A Task 3 cria o arquivo.

- [ ] **Step 6: Commit**

```bash
git add src/engine/balance.ts src/engine/constants.ts src/engine/weather.ts src/engine/rainSpeed.test.ts src/engine/secretEffects.test.ts src/engine/weather.test.ts src/game/captureWeather.test.ts src/game/captureWeatherSwift.test.ts src/game/drySkinClearBodyRework.test.ts src/game/missionWeather.test.ts src/persistence/saveLoad.test.ts
git commit -m "feat(clima): estrutura do schedule de Calor (campo heat, previsao, constantes/salts)"
```

---

## Task 3: Agenda do Calor (`engine/heat.ts`)

**Files:**
- Create: `src/engine/heat.ts`
- Test: `src/engine/heat.test.ts`

**Interfaces:**
- Produces:
  - `interface HeatEvent { startMs: number; endMs: number }`
  - `maxHeatTimes(day: number): number`
  - `heatChanceForDay(seed: number, day: number, cityIndex: number): number`
  - `buildHeat(seed: number, day: number, city: CityData, extraChancePercent?: number, maxEvents?: number): HeatEvent[]` (`maxEvents` undefined = sem cap; número = cap, 0 permitido)
  - `activeHeatAt(events: readonly HeatEvent[], now: number): HeatEvent | null`
  - `isHot(events: readonly HeatEvent[], now: number): boolean`
- Consumes: `weatherChanceForDay`, `maxRainTimes`, `WEATHER_FIRST_ELIGIBLE_DAY` (de `weather.ts`); `cityHasHeat`, `cityHeatChance` (de `cityWeather.ts`).

- [ ] **Step 1: Escrever os testes que falham** — criar `src/engine/heat.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getCity } from '../data/cities.ts'
import { DAY_LENGTH_MS } from './constants.ts'
import { HEAT_EVENT_MIN_MS, HEAT_EVENT_MAX_MS, HEAT_GAP_MS } from './balance.ts'
import { buildHeat, heatChanceForDay, maxHeatTimes, isHot, activeHeatAt } from './heat.ts'
import { maxRainTimes } from './weather.ts'

const CELADON = getCity(3)

describe('heat — chance do dia', () => {
  it('Celadon: chance fica em [20+dia, 50] e colapsa no teto quando 20+dia ≥ 50', () => {
    const c = heatChanceForDay(123, 5, 3)
    expect(c).toBeGreaterThanOrEqual(25)
    expect(c).toBeLessThanOrEqual(50)
    expect(heatChanceForDay(123, 40, 3)).toBe(50) // 20+40 ≥ 50 → trava no teto
  })
  it('cidade sem calor → 0', () => {
    expect(heatChanceForDay(123, 5, 1)).toBe(0)
  })
  it('dias < 3 → 0', () => {
    expect(heatChanceForDay(123, 2, 3)).toBe(0)
  })
})

describe('heat — quantidade/curva', () => {
  it('maxHeatTimes espelha a curva da chuva', () => {
    for (const d of [3, 6, 9, 18, 30]) expect(maxHeatTimes(d)).toBe(maxRainTimes(d))
  })
})

describe('heat — buildHeat', () => {
  it('chance 100% (extra) → janelas não-sobrepostas, 30–60s, dentro do dia', () => {
    const events = buildHeat(7, 9, CELADON, 100)
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      const dur = e.endMs - e.startMs
      expect(dur).toBeGreaterThanOrEqual(HEAT_EVENT_MIN_MS)
      expect(dur).toBeLessThanOrEqual(HEAT_EVENT_MAX_MS)
      expect(e.startMs).toBeGreaterThanOrEqual(0)
      expect(e.endMs).toBeLessThanOrEqual(DAY_LENGTH_MS)
    }
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.startMs).toBeGreaterThanOrEqual(events[i - 1]!.endMs + HEAT_GAP_MS)
    }
  })
  it('chance −100% (extra) → nenhuma janela ocorre', () => {
    expect(buildHeat(7, 9, CELADON, -100)).toEqual([])
  })
  it('maxEvents = 0 → cap zero (sem janelas), distinto de "sem cap"', () => {
    expect(buildHeat(7, 9, CELADON, 100, 0)).toEqual([])
  })
  it('determinístico por (seed, dia, cidade)', () => {
    expect(buildHeat(7, 9, CELADON, 100)).toEqual(buildHeat(7, 9, CELADON, 100))
  })
})

describe('heat — isHot/activeHeatAt', () => {
  it('isHot true dentro da janela, false fora', () => {
    const events = [{ startMs: 1000, endMs: 2000 }]
    expect(isHot(events, 1500)).toBe(true)
    expect(isHot(events, 2000)).toBe(false)
    expect(activeHeatAt(events, 1500)).toEqual({ startMs: 1000, endMs: 2000 })
    expect(activeHeatAt(events, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/heat.test.ts`
Expected: FAIL (módulo `./heat.ts` não existe).

- [ ] **Step 3: Implementar `src/engine/heat.ts`:**

```ts
// Núcleo PURO do efeito climático Calor (3º efeito, após Chuva e Tempestade). A agenda é semeada
// (HEAT_SEED_SALT) e pré-computada em setupDay, então a presença de calor em qualquer instante é
// FUNÇÃO PURA de `now`. O efeito (−80% de velocidade de viagem) vive no integrador weatherTravelMs
// (engine/rainSpeed.ts), que aplica o degrau sobre as janelas de calor.

import type { CityData } from '../data/types.ts'
import { createRng, deriveSeed } from './rng.ts'
import { DAY_LENGTH_MS, HEAT_SEED_SALT, HEAT_CHANCE_SALT } from './constants.ts'
import { HEAT_EVENT_MIN_MS, HEAT_EVENT_MAX_MS, HEAT_GAP_MS } from './balance.ts'
import { clamp } from './math.ts'
import { weatherChanceForDay, maxRainTimes, WEATHER_FIRST_ELIGIBLE_DAY } from './weather.ts'
import { cityHasHeat, cityHeatChance } from '../data/cityWeather.ts'

/** Uma janela de calor: intervalo [startMs, endMs] (sem sub-objetos — calor não tem poça/raio). */
export interface HeatEvent {
  startMs: number
  endMs: number
}

/** Teto de janelas de calor por dia: espelha a curva da chuva. */
export function maxHeatTimes(day: number): number {
  return maxRainTimes(day)
}

/** Chance de calor (%) do dia na cidade. 0 se dia < 3 ou se a cidade não tem calor. */
export function heatChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = cityHeatChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, HEAT_CHANCE_SALT)
}

/**
 * Janelas de calor do dia (não-sobrepostas, duração 30–60s, folga HEAT_GAP_MS), cada uma ocorrendo
 * por sorteio vs a chance do dia. RNG próprio (HEAT_SEED_SALT) — não toca o cursor da run.
 * `maxEvents` undefined = sem cap; número = cap do TOTAL de janelas (0 permitido → nenhuma).
 */
export function buildHeat(
  seed: number,
  day: number,
  city: CityData,
  extraChancePercent = 0,
  maxEvents?: number,
): HeatEvent[] {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY || !cityHasHeat(city.index)) return []
  const hasCap = maxEvents !== undefined
  const chance = clamp(heatChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
  const maxTimes = hasCap ? Math.min(maxHeatTimes(day), maxEvents!) : maxHeatTimes(day)
  const rng = createRng(deriveSeed(seed, day, HEAT_SEED_SALT))
  const events: HeatEvent[] = []
  let cursor = 0
  for (let i = 0; i < maxTimes; i++) {
    const remainingAfter = maxTimes - 1 - i
    const duration = rng.int(HEAT_EVENT_MIN_MS, HEAT_EVENT_MAX_MS)
    const reserve = remainingAfter * (HEAT_EVENT_MIN_MS + HEAT_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - HEAT_GAP_MS - reserve
    if (latestStart < cursor) break
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    if (rng.bool(chance / 100)) events.push({ startMs: start, endMs: end })
    cursor = end + HEAT_GAP_MS
  }
  return events
}

/** Janela de calor ATIVA em `now`, ou null. */
export function activeHeatAt(events: readonly HeatEvent[], now: number): HeatEvent | null {
  for (const e of events) if (now >= e.startMs && now < e.endMs) return e
  return null
}

/** Está quente em `now`? (selo/efeitos/som seguem isto.) */
export function isHot(events: readonly HeatEvent[], now: number): boolean {
  return activeHeatAt(events, now) !== null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/heat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/heat.ts src/engine/heat.test.ts
git commit -m "feat(clima): engine/heat — agenda deterministica do Calor"
```

---

## Task 4: `buildDayWeather` monta o Calor

**Files:**
- Modify: `src/engine/storm.ts` (`buildDayWeather`)
- Modify (call-sites, manter compilando): `src/game/setup.ts:142`, `src/components/screens/DayForecastPanel.tsx:51`
- Test: `src/engine/storm.test.ts`

**Interfaces:**
- Produces: `buildDayWeather(seed, day, city, extraRainChancePercent?, extraStormChancePercent?, extraHeatChancePercent?, maxWeatherEvents?): WeatherSchedule` (novo parâmetro `extraHeatChancePercent` ANTES de `maxWeatherEvents`).

- [ ] **Step 1: Escrever o teste que falha** — em `src/engine/storm.test.ts`, adicionar (usa `getCity(3)`):

```ts
describe('buildDayWeather — Calor (Celadon)', () => {
  const CELADON = getCity(3)
  it('inclui janelas de calor e a previsão de calor', () => {
    const s = buildDayWeather(7, 9, CELADON, 0, 0, 100) // extraHeat 100% força ocorrência
    expect(s.heat.length).toBeGreaterThan(0)
    expect(s.forecast.heatChancePercent).toBeGreaterThan(0)
    expect(s.forecast.potentialHeatCount).toBe(maxStormTimes(9)) // mesma curva
  })
  it('Own Tempo (cap total) corta o calor por último: chuva → tempestade → calor', () => {
    // cap = 1 evento no dia: a chuva/tempestade consomem o orçamento e o calor fica sem slot.
    const s = buildDayWeather(7, 9, CELADON, 100, 100, 100, 1)
    expect(s.rain.length + s.storms.length + s.heat.length).toBeLessThanOrEqual(1)
    expect(s.heat.length).toBe(0)
  })
  it('cidade sem calor não ganha heat', () => {
    const s = buildDayWeather(7, 9, getCity(2), 0, 0, 100)
    expect(s.heat).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: FAIL (assinatura sem `extraHeatChancePercent`; `heat` não montado).

- [ ] **Step 3: Implementar.** Em `src/engine/storm.ts`:

- Adicionar imports:
```ts
import { cityHasHeat } from '../data/cityWeather.ts'
import { buildHeat, heatChanceForDay, maxHeatTimes } from './heat.ts'
```
(`cityHasStorm` já é importado; manter.)

- Substituir `buildDayWeather` por:
```ts
export function buildDayWeather(
  seed: number,
  day: number,
  city: CityData,
  extraRainChancePercent = 0,
  extraStormChancePercent = 0,
  extraHeatChancePercent = 0,
  maxWeatherEvents = 0,
): WeatherSchedule {
  // Orçamento (Own Tempo): chuva recebe slots primeiro; tempestade e depois calor usam o restante.
  const base = buildWeatherSchedule(seed, day, city, extraRainChancePercent, maxWeatherEvents > 0 ? maxWeatherEvents : 0)

  let withStorm = base
  if (cityHasStorm(city.index)) {
    const stormCap: number | undefined =
      maxWeatherEvents > 0 ? Math.max(0, maxWeatherEvents - base.rain.length) : undefined
    const storms = buildStorms(seed, day, city, base.rain, extraStormChancePercent, stormCap)
    withStorm = {
      ...base,
      storms,
      forecast: {
        ...base.forecast,
        stormChancePercent: clamp(stormChanceForDay(seed, day, city.index) + extraStormChancePercent, 0, 100),
        potentialStormCount: maxStormTimes(day),
      },
    }
  }

  if (!cityHasHeat(city.index)) return withStorm
  // Calor usa o orçamento restante após chuva + tempestade (undefined = sem cap; número = cap, 0 ok).
  const heatCap: number | undefined =
    maxWeatherEvents > 0 ? Math.max(0, maxWeatherEvents - withStorm.rain.length - withStorm.storms.length) : undefined
  const heat = buildHeat(seed, day, city, extraHeatChancePercent, heatCap)
  return {
    ...withStorm,
    heat,
    forecast: {
      ...withStorm.forecast,
      heatChancePercent: clamp(heatChanceForDay(seed, day, city.index) + extraHeatChancePercent, 0, 100),
      potentialHeatCount: maxHeatTimes(day),
    },
  }
}
```

- [ ] **Step 4: Atualizar os 2 call-sites para a nova assinatura (passar `0` por ora; o viés vem na Task 9).**

Em `src/game/setup.ts` (a chamada `s.weather = buildDayWeather(...)`), inserir `0,` antes de `ownTempoCap`:
```ts
  s.weather = buildDayWeather(
    s.run.seed,
    s.run.day,
    city,
    rainDelta,
    stormDelta,
    0, // extraHeatChancePercent — preenchido na Task 9 (Cloud Nine/Overcoat)
    ownTempoCap,
  )
```

Em `src/components/screens/DayForecastPanel.tsx` (a chamada `buildDayWeather(...)`), inserir `0,` antes de `ownTempoCap`:
```ts
  const forecast = buildDayWeather(
    state.run.seed,
    state.run.day,
    city,
    rainDelta,
    stormDelta,
    0, // extraHeatChancePercent — preenchido na Task 9
    ownTempoCap,
  ).forecast
```

- [ ] **Step 5: Rodar build + testes de clima**

Run: `npm run build && npx vitest run src/engine/storm.test.ts`
Expected: build PASS; testes PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/storm.ts src/game/setup.ts src/components/screens/DayForecastPanel.tsx src/engine/storm.test.ts
git commit -m "feat(clima): buildDayWeather monta o Calor (orcamento chuva->tempestade->calor)"
```

---

## Task 5: Predicados de calor (imunidade + bônus Chlorophyll)

**Files:**
- Modify: `src/engine/secretEffects.ts`
- Test: `src/engine/secretEffects.test.ts`

**Interfaces:**
- Produces: `hasChlorophyll(p): boolean`, `teamImmuneToHeat(team): boolean`, `teamHeatSpeedBonus(team): number` (0 / 2 / 3).
- Consumes: `hasIceBody`, `hasClearBody` (já existem); `CHLOROPHYLL_HEAT_BONUS_L1/L2` (Task 2).

> Espécies para teste (linhas reais): Chlorophyll → Bulbasaur `1` (slot 0); Clear Body → Tentacool `72` (slot 0). Ice Body ainda não está atribuído a nenhuma linha (em catálogo, inerte) — testado indiretamente pelo predicado.

- [ ] **Step 1: Escrever os testes que falham** — em `src/engine/secretEffects.test.ts`:

```ts
import { teamImmuneToHeat, teamHeatSpeedBonus, hasChlorophyll } from './secretEffects.ts'
import { CHLOROPHYLL_HEAT_BONUS_L1, CHLOROPHYLL_HEAT_BONUS_L2 } from './balance.ts'

describe('habilidades de calor', () => {
  const chloroL1 = () => makeMon({ speciesId: 1, secretPicks: [{ slot: 0, level: 1 }] }) // Bulbasaur Chlorophyll
  const chloroL2 = () => makeMon({ speciesId: 1, secretPicks: [{ slot: 0, level: 2 }] })
  const clearBody = () => makeMon({ speciesId: 72, secretPicks: [{ slot: 0, level: 1 }] }) // Tentacool Clear Body
  const plain = () => makeMon({ speciesId: 16, secretPicks: [] })

  it('teamImmuneToHeat: Chlorophyll e Clear Body imunizam; sem nada, não', () => {
    expect(teamImmuneToHeat([chloroL1()])).toBe(true)
    expect(teamImmuneToHeat([clearBody()])).toBe(true)
    expect(teamImmuneToHeat([plain()])).toBe(false)
    expect(teamImmuneToHeat([plain(), clearBody()])).toBe(true)
  })
  it('teamHeatSpeedBonus: 0 sem Chlorophyll, +2 (L1), +3 (L2), maior do time', () => {
    expect(teamHeatSpeedBonus([plain()])).toBe(0)
    expect(teamHeatSpeedBonus([chloroL1()])).toBe(CHLOROPHYLL_HEAT_BONUS_L1)
    expect(teamHeatSpeedBonus([chloroL2()])).toBe(CHLOROPHYLL_HEAT_BONUS_L2)
    expect(teamHeatSpeedBonus([chloroL1(), chloroL2()])).toBe(CHLOROPHYLL_HEAT_BONUS_L2)
  })
  it('hasChlorophyll reflete o nível desbloqueado', () => {
    expect(hasChlorophyll(chloroL1())).toBe(true)
    expect(hasChlorophyll(plain())).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: FAIL (funções não existem).

- [ ] **Step 3: Implementar.** Em `src/engine/secretEffects.ts`:

- Adicionar ao import de `./balance.ts` (entre os já existentes):
```ts
  CHLOROPHYLL_HEAT_BONUS_L1,
  CHLOROPHYLL_HEAT_BONUS_L2,
```
- Após `hasIceBody` (perto da linha 125), adicionar o predicado e os helpers de time:
```ts
export function hasChlorophyll(p: Pokemon): boolean {
  return hasSecret(p, 'sa-chlorophyll')
}

/** Imune ao slowdown de calor (nível de time): Ice Body, Clear Body (≥1) ou Chlorophyll. */
export function teamImmuneToHeat(team: readonly Pokemon[]): boolean {
  return team.some((p) => hasIceBody(p) || hasClearBody(p) || hasChlorophyll(p))
}

/** Bônus ADITIVO de velocidade do time no calor (Chlorophyll): 0, +2 (L1) ou +3 (L2). */
export function teamHeatSpeedBonus(team: readonly Pokemon[]): number {
  let bonus = 0
  for (const p of team) {
    const lv = secretLevelOf(p, 'sa-chlorophyll')
    if (lv === 2) bonus = Math.max(bonus, CHLOROPHYLL_HEAT_BONUS_L2)
    else if (lv === 1) bonus = Math.max(bonus, CHLOROPHYLL_HEAT_BONUS_L1)
  }
  return bonus
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/secretEffects.ts src/engine/secretEffects.test.ts
git commit -m "feat(clima): predicados de calor — teamImmuneToHeat e teamHeatSpeedBonus (Chlorophyll)"
```

---

## Task 6: Integrador generalizado (`weatherTravelMs` + `instantWeatherSpeed`)

**Files:**
- Modify: `src/engine/rainSpeed.ts`
- Modify (call-sites): `src/game/missionFlow.ts:43,119,147`, `src/game/captureFlow.ts:18,53,184`
- Test: `src/engine/rainSpeed.test.ts`

**Interfaces:**
- Produces:
  - `weatherTravelMs(schedule, startMs, distance, team, runItems?, electrified?): number` (renomeia `rainTravelMs`; mesma assinatura)
  - `instantWeatherSpeed(schedule, nowMs, team, runItems?, electrified?): number` (taxa instantânea: base × fator de calor + bônus chlorophyll + bônus swift swim)
- Consumes: `teamImmuneToHeat`, `teamHeatSpeedBonus`, `teamHasSwiftSwim`, `teamTravelSpeedMultiplier`; `HEAT_SLOW_FACTOR`, `SWIFT_SWIM_RAIN_BONUS`.

- [ ] **Step 1: Escrever os testes que falham** — reescrever `src/engine/rainSpeed.test.ts` para usar `weatherTravelMs` e cobrir calor. Substituir o import e o `describe`, e ADICIONAR os casos de calor:

```ts
import { weatherTravelMs, instantWeatherSpeed } from './rainSpeed.ts'
import { HEAT_SLOW_FACTOR } from './balance.ts'
// (manter os imports existentes: makeMon, graphTravelMs, SWIFT_SWIM_RAIN_BONUS, teamTravelSpeedMultiplier, emptyWeatherSchedule, WeatherSchedule)

// Bulbasaur(1) Chlorophyll slot 0; Tentacool(72) Clear Body slot 0; Pidgey(16) sem habilidade.
const chloro = () => makeMon({ speciesId: 1, secretPicks: [{ slot: 0, level: 1 }] })
const clearBody = () => makeMon({ speciesId: 72, secretPicks: [{ slot: 0, level: 1 }] })
const noone = () => makeMon({ speciesId: 16, secretPicks: [] })

/** Calor cobrindo [0, endMs]. */
function heatUntil(endMs: number): WeatherSchedule {
  return {
    rain: [], storms: [], heat: [{ startMs: 0, endMs }],
    forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 100, potentialHeatCount: 1 },
  }
}
```

Renomear todas as chamadas `rainTravelMs(` → `weatherTravelMs(` no arquivo (Swift Swim — regressão intacta). Adicionar:

```ts
describe('weatherTravelMs — Calor', () => {
  it('time normal: calor o trajeto todo → ×0.2 (5× o tempo linear)', () => {
    const team = [noone()]
    const need = graphTravelMs(DIST, team, 1)
    expect(weatherTravelMs(heatUntil(1_000_000), 0, DIST, team)).toBeCloseTo(need / HEAT_SLOW_FACTOR)
  })
  it('imune (Clear Body): calor não afeta → tempo linear', () => {
    const team = [clearBody()]
    expect(weatherTravelMs(heatUntil(1_000_000), 0, DIST, team)).toBeCloseTo(graphTravelMs(DIST, team, 1))
  })
  it('Chlorophyll: imune + bônus → ×(1+2)=×3 (1/3 do tempo)', () => {
    const team = [chloro()]
    expect(weatherTravelMs(heatUntil(1_000_000), 0, DIST, team)).toBeCloseTo(graphTravelMs(DIST, team, 3))
  })
  it('calor parcial (time normal): ×0.2 enquanto quente, base depois', () => {
    const team = [noone()]
    const need = graphTravelMs(DIST, team, 1)
    const hotMs = Math.floor(need / 10) // janela curta no início
    // Durante o calor cobre hotMs·0.2 do progresso; resto a ×1. Tempo = hotMs + (need − 0.2·hotMs).
    expect(weatherTravelMs(heatUntil(hotMs), 0, DIST, team)).toBeCloseTo(need + 0.8 * hotMs)
  })
})

describe('instantWeatherSpeed', () => {
  it('time normal quente → base × 0.2', () => {
    const team = [noone()]
    expect(instantWeatherSpeed(heatUntil(1000), 500, team)).toBeCloseTo(teamTravelSpeedMultiplier(team, []) * HEAT_SLOW_FACTOR)
  })
  it('fora do calor → base', () => {
    const team = [noone()]
    expect(instantWeatherSpeed(heatUntil(1000), 2000, team)).toBeCloseTo(teamTravelSpeedMultiplier(team, []))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/rainSpeed.test.ts`
Expected: FAIL (`weatherTravelMs`/`instantWeatherSpeed` não existem).

- [ ] **Step 3: Implementar.** Substituir o conteúdo de `src/engine/rainSpeed.ts` por:

```ts
// Tempo de viagem PURO sob clima — generaliza chuva (Swift Swim acelera) e Calor (slowdown −80%,
// salvo imunes; Chlorophyll acelera). O tempo de uma perna é a integral de uma velocidade em DEGRAU
// sobre a UNIÃO das janelas de chuva e calor. Sem efeito relevante → tempo linear de graphTravelMs.

import type { Pokemon } from '../types/index.ts'
import { SWIFT_SWIM_RAIN_BONUS, HEAT_SLOW_FACTOR } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import {
  teamHasSwiftSwim,
  teamTravelSpeedMultiplier,
  teamImmuneToHeat,
  teamHeatSpeedBonus,
} from './secretEffects.ts'
import type { WeatherSchedule } from './weather.ts'

/** Trecho de velocidade constante a partir de `start` até `end`, com flags de chuva/calor. */
interface SpeedSegment {
  start: number
  end: number
  raining: boolean
  hot: boolean
}

/** Bordas da união das janelas de chuva e calor (≥ startMs), com flags por trecho + cauda base infinita. */
function speedSegments(schedule: WeatherSchedule, startMs: number): SpeedSegment[] {
  const bounds = new Set<number>([startMs])
  for (const ev of schedule.rain) {
    if (ev.endMs > startMs) { bounds.add(Math.max(ev.startMs, startMs)); bounds.add(ev.endMs) }
  }
  for (const ev of schedule.heat) {
    if (ev.endMs > startMs) { bounds.add(Math.max(ev.startMs, startMs)); bounds.add(ev.endMs) }
  }
  const sorted = [...bounds].filter((b) => b >= startMs).sort((a, b) => a - b)
  const segs: SpeedSegment[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!
    const end = sorted[i + 1]!
    const mid = (start + end) / 2
    segs.push({
      start,
      end,
      raining: schedule.rain.some((ev) => mid >= ev.startMs && mid < ev.endMs),
      hot: schedule.heat.some((ev) => mid >= ev.startMs && mid < ev.endMs),
    })
  }
  const tail = sorted.length > 0 ? sorted[sorted.length - 1]! : startMs
  segs.push({ start: tail, end: Number.POSITIVE_INFINITY, raining: false, hot: false })
  return segs
}

/** Velocidade INSTANTÂNEA do time em `nowMs` (base × fator calor + bônus chlorophyll + bônus swift swim). */
export function instantWeatherSpeed(
  schedule: WeatherSchedule,
  nowMs: number,
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
  electrified?: Record<string, 1 | 2>,
): number {
  const base = teamTravelSpeedMultiplier(team, runItems, electrified)
  const hot = schedule.heat.some((ev) => nowMs >= ev.startMs && nowMs < ev.endMs)
  const raining = schedule.rain.some((ev) => nowMs >= ev.startMs && nowMs < ev.endMs)
  const immune = teamImmuneToHeat(team)
  const rate =
    base * (hot && !immune ? HEAT_SLOW_FACTOR : 1) +
    (hot ? teamHeatSpeedBonus(team) : 0) +
    (raining && teamHasSwiftSwim(team) ? SWIFT_SWIM_RAIN_BONUS : 0)
  return Math.max(rate, 0.0001)
}

/**
 * Duração (ms de jogo) de uma perna de `distance` começando em `startMs`, integrando o clima
 * (Swift Swim na chuva, slowdown/Chlorophyll no calor). Sem efeito relevante → tempo linear.
 */
export function weatherTravelMs(
  schedule: WeatherSchedule,
  startMs: number,
  distance: number,
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
  electrified?: Record<string, 1 | 2>,
): number {
  const baseMult = teamTravelSpeedMultiplier(team, runItems, electrified)
  const need = graphTravelMs(distance, team, 1)
  if (need <= 0) return 0
  const swiftActive = teamHasSwiftSwim(team) && schedule.rain.length > 0
  const immune = teamImmuneToHeat(team)
  const heatBonus = teamHeatSpeedBonus(team)
  const heatActive = schedule.heat.length > 0 && (!immune || heatBonus > 0)
  if (!swiftActive && !heatActive) {
    return need / Math.max(baseMult, 0.0001)
  }
  let remaining = need
  for (const seg of speedSegments(schedule, startMs)) {
    const heatFactor = seg.hot && !immune ? HEAT_SLOW_FACTOR : 1
    const rate = Math.max(
      baseMult * heatFactor +
        (seg.hot ? heatBonus : 0) +
        (seg.raining && teamHasSwiftSwim(team) ? SWIFT_SWIM_RAIN_BONUS : 0),
      0.0001,
    )
    const capacity = (seg.end - seg.start) * rate
    if (capacity >= remaining) return seg.start - startMs + remaining / rate
    remaining -= capacity
  }
  return need / Math.max(baseMult, 0.0001)
}
```

- [ ] **Step 4: Atualizar os 4 call-sites.**

`src/game/missionFlow.ts`:
- Linha 43: `import { weatherTravelMs } from '../engine/rainSpeed.ts'`
- Linha 119: `const outMs = weatherTravelMs(s.weather, now, outbound.distance, team, s.runItems, s.today.electrified)`
- Linha 147: `mission.resolveAtMs + weatherTravelMs(s.weather, mission.resolveAtMs, inbound.distance, team, s.runItems, s.today.electrified)`

`src/game/captureFlow.ts`:
- Linha 18: `import { weatherTravelMs } from '../engine/rainSpeed.ts'`
- Linhas 53 e 184: trocar `rainTravelMs(` por `weatherTravelMs(` (mesmos argumentos).

- [ ] **Step 5: Rodar build + teste**

Run: `npm run build && npx vitest run src/engine/rainSpeed.test.ts`
Expected: build PASS; testes PASS (Swift Swim regressão + Calor).

- [ ] **Step 6: Commit**

```bash
git add src/engine/rainSpeed.ts src/engine/rainSpeed.test.ts src/game/missionFlow.ts src/game/captureFlow.ts
git commit -m "feat(clima): weatherTravelMs generaliza chuva+calor (slowdown 80%, Chlorophyll)"
```

---

## Task 7: Velocidade instantânea do reroute usa `instantWeatherSpeed`

**Files:**
- Modify: `src/game/missionFlow.ts` (`applyWeatherHold`, ~linha 221), `src/game/captureFlow.ts` (~linhas 98 e 223)
- Test: `src/engine/rainSpeed.test.ts` (já cobre `instantWeatherSpeed` na Task 6 — este passo é refator de consistência, validado por build + suíte)

**Interfaces:**
- Consumes: `instantWeatherSpeed` (Task 6).

- [ ] **Step 1: Substituir o `speedMult` inline por `instantWeatherSpeed`.**

Em `src/game/missionFlow.ts`, no `applyWeatherHold`, trocar o bloco:
```ts
  const speedMult =
    teamTravelSpeedMultiplier(team, s.runItems, s.today.electrified) +
    (teamHasSwiftSwim(team) && isRaining(s.weather, nowMs) ? SWIFT_SWIM_RAIN_BONUS : 0)
```
por:
```ts
  const speedMult = instantWeatherSpeed(s.weather, nowMs, team, s.runItems, s.today.electrified)
```
Adicionar `instantWeatherSpeed` ao import de `'../engine/rainSpeed.ts'` (junto de `weatherTravelMs`). Remover imports que ficarem sem uso (`SWIFT_SWIM_RAIN_BONUS`, `teamHasSwiftSwim`, `isRaining`) SOMENTE se não forem usados em outro ponto do arquivo — verificar com:
```bash
grep -n "SWIFT_SWIM_RAIN_BONUS\|teamHasSwiftSwim\|isRaining" src/game/missionFlow.ts
```
(`isRaining` é usado no despacho para a cura da chuva — manter; idem o que sobrar.)

Em `src/game/captureFlow.ts`, fazer a mesma troca nos DOIS blocos `const speedMult = teamTravelSpeedMultiplier(...) + (teamHasSwiftSwim(...) ...)` (ida ~98 e volta ~223) por:
```ts
  const speedMult = instantWeatherSpeed(s.weather, nowMs, team, s.runItems, s.today.electrified)
```
Adicionar `instantWeatherSpeed` ao import de `'../engine/rainSpeed.ts'`. Limpar imports órfãos com a mesma verificação por `grep`.

- [ ] **Step 2: Rodar build + suíte de clima/captura**

Run: `npm run build && npx vitest run src/game/captureWeather.test.ts src/game/captureWeatherSwift.test.ts src/game/missionWeather.test.ts`
Expected: build PASS; testes PASS.

- [ ] **Step 3: Commit**

```bash
git add src/game/missionFlow.ts src/game/captureFlow.ts
git commit -m "refactor(clima): reroute usa instantWeatherSpeed (inclui fator de calor)"
```

---

## Task 8: Dry Skin no calor (despacho −25% vida; L2 −25% atributos)

**Files:**
- Modify: `src/game/missionFlow.ts` (despacho, ~linhas 151–162), `src/engine/secretEffects.ts` (`missionAttrMultiplier`)
- Test: `src/game/drySkinClearBodyRework.test.ts`

**Interfaces:**
- Consumes: `isHot` (de `engine/heat.ts`), `DRY_SKIN_RAIN_HEAL_FRAC`, `DRY_SKIN_MISSION_BONUS_L2` (já existem).

> Jynx(124) tem Dry Skin no slot 0.

- [ ] **Step 1: Escrever os testes que falham** — em `src/game/drySkinClearBodyRework.test.ts`, adicionar (helper de schedule quente igual ao das outras suítes, com `heat`):

```ts
import { isHot } from '../engine/heat.ts'

function hotSchedule(): WeatherSchedule {
  return {
    rain: [], storms: [], heat: [{ startMs: 0, endMs: 1_000_000 }],
    forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0, stormChancePercent: 0, potentialStormCount: 0, heatChancePercent: 100, potentialHeatCount: 1 },
  }
}

describe('Dry Skin — calor', () => {
  it('L2: −25% de atributos em missão enquanto quente', () => {
    const jynx = makeMon({ speciesId: 124, secretPicks: [{ slot: 0, level: 2 }], maxHp: 8, currentHp: 8 })
    const ctx = makeMissionCtx([jynx], { weather: hotSchedule(), nowMs: 100 })
    expect(missionAttrMultiplier(jynx, ctx)).toBeCloseTo(1 - DRY_SKIN_MISSION_BONUS_L2)
  })
})
```

> Use o mesmo padrão de `makeMissionCtx`/contexto já presente no arquivo (espelhe o teste de `+25%` da chuva que usa `weather`+`nowMs`). Se o arquivo monta o ctx inline, replique aquele formato adicionando `weather: hotSchedule(), nowMs: 100`.

Para o despacho (−25% de vida), adicionar um teste no estilo já existente de "cura na chuva" do arquivo, trocando chuva por `hotSchedule()` e esperando perda:
```ts
it('despacho no calor: Dry Skin perde 25% da vida (piso 1)', () => {
  // espelha o teste de cura na chuva: monta GameState com s.weather = hotSchedule(), despacha e
  // verifica currentHp = max(1, hp − ceil(0.25·maxHp)).
})
```
Implemente esse teste copiando a estrutura do teste de cura na chuva já presente (mesma montagem de `GameState`/`dispatchMission`), apenas com `hotSchedule()` e a expectativa de perda.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/game/drySkinClearBodyRework.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**

Em `src/engine/secretEffects.ts`:
- Adicionar ao import de `'./weather.ts'`: manter `isRaining`; e adicionar import novo `import { isHot } from './heat.ts'`.
- No `missionAttrMultiplier`, logo após o bloco do Dry Skin L2 da chuva, adicionar:
```ts
  // Dry Skin L2: −25% de atributos em missão enquanto QUENTE (espelha o +25% da chuva).
  if (
    secretLevelOf(p, 'sa-dry-skin') === 2 &&
    ctx.weather !== undefined &&
    ctx.nowMs !== undefined &&
    isHot(ctx.weather.heat, ctx.nowMs)
  ) {
    mult *= 1 - DRY_SKIN_MISSION_BONUS_L2
  }
```
(`DRY_SKIN_MISSION_BONUS_L2` já está importado.) O cancelamento por Clear Body L2 (`mult < 1` → 1) já ocorre no bloco existente abaixo — não mexer.

Em `src/game/missionFlow.ts`:
- Adicionar `import { isHot } from '../engine/heat.ts'`.
- No bloco de despacho, após `const raining = isRaining(s.weather, now)`, adicionar `const hot = isHot(s.weather.heat, now)`.
- Dentro do `for (const p of team)`, após o bloco de cura do Dry Skin na chuva, adicionar:
```ts
    if (hasDrySkin(p) && hot) {
      healed = Math.max(1, healed - Math.ceil(DRY_SKIN_RAIN_HEAL_FRAC * p.maxHp))
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/game/drySkinClearBodyRework.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/secretEffects.ts src/game/missionFlow.ts src/game/drySkinClearBodyRework.test.ts
git commit -m "feat(clima): Dry Skin no calor — -25% vida no despacho e -25% atributos L2"
```

---

## Task 9: Vieses de clima incluem o Calor (Cloud Nine / Overcoat / Own Tempo)

**Files:**
- Modify: `src/game/setup.ts`, `src/components/screens/DayForecastPanel.tsx`
- Test: `src/game/weatherAbilitiesSetup.test.ts`

**Interfaces:**
- Consumes: `CLOUD_NINE_OTHER_PP_L1/L2`, `OVERCOAT_PP_L1/L2`, `OWN_TEMPO_CAP_L1/L2` (já importados nesses arquivos).

- [ ] **Step 1: Escrever o teste que falha** — em `src/game/weatherAbilitiesSetup.test.ts`, adicionar um caso espelhando os de tempestade, em Celadon (índice 3), verificando que Cloud Nine/Overcoat reduzem `forecast.heatChancePercent` e que Own Tempo limita o total incluindo calor. Exemplo (ajuste ao kit de montagem do arquivo):

```ts
it('Cloud Nine reduz a chance de calor (é "outro efeito") em Celadon', () => {
  const base = setupCityDay({ cityIndex: 3, day: 9, seed: 7, roster: [plainMon()] })
  const cloud = setupCityDay({ cityIndex: 3, day: 9, seed: 7, roster: [cloudNineMon()] })
  expect(cloud.weather.forecast.heatChancePercent).toBeLessThan(base.weather.forecast.heatChancePercent)
})
```
> Use os helpers já existentes no arquivo (montagem de roster/seed e a função que roda o setup do dia). Espelhe o teste análogo de tempestade que já existe ali.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/game/weatherAbilitiesSetup.test.ts`
Expected: FAIL (calor ainda recebe `0` de delta).

- [ ] **Step 3: Implementar.**

Em `src/game/setup.ts`, no laço que acumula `rainDelta`/`stormDelta`, adicionar `heatDelta` (o calor é "outro efeito" como a tempestade):
```ts
  let rainDelta = 0
  let stormDelta = 0
  let heatDelta = 0
  for (const p of s.roster) {
    const cnLevel = secretLevelOf(p, 'sa-cloud-nine')
    if (cnLevel === 2) { rainDelta += CLOUD_NINE_RAIN_PP_L2; stormDelta -= CLOUD_NINE_OTHER_PP_L2; heatDelta -= CLOUD_NINE_OTHER_PP_L2 }
    else if (cnLevel === 1) { rainDelta += CLOUD_NINE_RAIN_PP_L1; stormDelta -= CLOUD_NINE_OTHER_PP_L1; heatDelta -= CLOUD_NINE_OTHER_PP_L1 }
    const ocLevel = secretLevelOf(p, 'sa-overcoat')
    if (ocLevel === 2) { rainDelta -= OVERCOAT_PP_L2; stormDelta -= OVERCOAT_PP_L2; heatDelta -= OVERCOAT_PP_L2 }
    else if (ocLevel === 1) { rainDelta -= OVERCOAT_PP_L1; stormDelta -= OVERCOAT_PP_L1; heatDelta -= OVERCOAT_PP_L1 }
  }
```
E passar `heatDelta` no lugar do `0` inserido na Task 4:
```ts
  s.weather = buildDayWeather(
    s.run.seed,
    s.run.day,
    city,
    rainDelta,
    stormDelta,
    heatDelta,
    ownTempoCap,
  )
```

Em `src/components/screens/DayForecastPanel.tsx`, replicar exatamente: acrescentar `let heatDelta = 0`, somar `heatDelta` nos mesmos ramos de Cloud Nine/Overcoat, e passar `heatDelta` no lugar do `0` da chamada `buildDayWeather`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/game/weatherAbilitiesSetup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/setup.ts src/components/screens/DayForecastPanel.tsx src/game/weatherAbilitiesSetup.test.ts
git commit -m "feat(clima): Cloud Nine/Overcoat/Own Tempo incluem o Calor no orcamento e na previsao"
```

---

## Task 10: UI — selo e linha de previsão do Calor

**Files:**
- Modify: `src/components/day/WeatherBadge.tsx`, `src/components/day/DayScreen.tsx` (~linhas 219–222), `src/components/screens/DayForecastPanel.tsx`, `src/components/screens/DayForecastPanel.module.css`, `src/components/day/WeatherBadge.module.css`
- Test: build + verificação visual (sem suíte de componente para esses elementos)

**Interfaces:**
- Consumes: `isHot` (de `engine/heat.ts`), `rainAtLeastOnceChance`, `forecast.heatChancePercent`/`potentialHeatCount`.

- [ ] **Step 1: Selo + aura de veloz.** Em `src/components/day/WeatherBadge.tsx`, estender os mapas para `heat`:
```ts
const WEATHER_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️', storm: '⛈️', heat: '☀️' }
const WEATHER_LABEL: Record<WeatherEffectKind, string> = { rain: 'Chovendo', storm: 'Tempestade', heat: 'Calor' }
```
Em `src/components/day/WeatherBadge.module.css`, adicionar uma classe `.heat` (cor quente, ex.: fundo laranja translúcido) espelhando `.rain`/`.storm` existentes.

Estender a aura de "veloz" para Chlorophyll no calor — em `src/engine/secretEffects.ts`, no `teamIsSpeedy`, trocar:
```ts
  return (
    teamTravelSpeedMultiplier(team, runItems) > 1 ||
    (teamHasSwiftSwim(team) && isRaining(weather, nowMs))
  )
```
por:
```ts
  return (
    teamTravelSpeedMultiplier(team, runItems) > 1 ||
    (teamHasSwiftSwim(team) && isRaining(weather, nowMs)) ||
    (teamHeatSpeedBonus(team) > 0 && isHot(weather.heat, nowMs))
  )
```
(`isHot` já fica importado de `./heat.ts` após a Task 8; `teamHeatSpeedBonus` é local ao arquivo.)

- [ ] **Step 2: Render do selo.** Em `src/components/day/DayScreen.tsx`:
- Adicionar `import { isHot } from '../../engine/heat.ts'`.
- Na condição do bloco de selos (~219), incluir o calor:
```tsx
{(isRaining(state.weather, state.clock.dayElapsedMs) ||
  isStorming(state.weather.storms, state.clock.dayElapsedMs) ||
  isHot(state.weather.heat, state.clock.dayElapsedMs)) && (
  <div className={/* contêiner existente */}>
    {isHot(state.weather.heat, state.clock.dayElapsedMs) && <WeatherBadge kind="heat" />}
    {isRaining(state.weather, state.clock.dayElapsedMs) && <WeatherBadge kind="rain" />}
    {isStorming(state.weather.storms, state.clock.dayElapsedMs) && <WeatherBadge kind="storm" />}
  </div>
)}
```
(Manter o className/contêiner exatamente como está no arquivo; só adicionar o ramo de calor primeiro.)

- [ ] **Step 3: Previsão.** Em `src/components/screens/DayForecastPanel.tsx`:
- Estender os mapas:
```ts
const EFFECT_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️', storm: '⛈️', heat: '☀️' }
const EFFECT_NAME: Record<WeatherEffectKind, string> = { rain: 'Chuva', storm: 'Tempestade', heat: 'Calor' }
```
- Calcular a chance combinada do calor (após `stormChance`):
```ts
  const heatChance = rainAtLeastOnceChance(forecast.heatChancePercent, forecast.potentialHeatCount)
```
- Na condição do bloco "tem clima", incluir `heatChance`:
```ts
  {weather && (rainChance > 0 || stormChance > 0 || heatChance > 0) ? (
```
- No `weather.effects.map(...)`, adicionar o ramo do calor (antes do ramo de chuva, seguindo a ordem da cidade):
```tsx
              effect.kind === 'heat' && heatChance > 0 ? (
                <div key="heat" className={styles.effect}>
                  <span className={styles.effectIcon} aria-hidden="true">{EFFECT_ICON.heat}</span>
                  <span className={styles.effectName}>{EFFECT_NAME.heat}</span>
                  <span className={styles.effectChance}>{heatChance}%</span>
                </div>
              ) : effect.kind === 'rain' && rainChance > 0 ? (
```
(O restante da cadeia ternária permanece igual.)
- Em `DayForecastPanel.module.css`, se houver cor por efeito, adicionar a variante de calor; senão, nada a fazer.

- [ ] **Step 4: Verificar build + tipos (exaustividade dos `Record<WeatherEffectKind, …>`)**

Run: `npm run build`
Expected: PASS (todos os mapas por `WeatherEffectKind` cobrem `heat`).

- [ ] **Step 5: Commit**

```bash
git add src/components/day/WeatherBadge.tsx src/components/day/WeatherBadge.module.css src/components/day/DayScreen.tsx src/components/screens/DayForecastPanel.tsx src/components/screens/DayForecastPanel.module.css
git commit -m "feat(clima): selo e previsao do Calor na UI"
```

---

## Task 11: Som do Calor (`heatPlayer` + `useGameSounds`)

**Files:**
- Create: `src/audio/heatPlayer.ts`
- Modify: `src/audio/useGameSounds.ts`
- Test: `src/audio/useGameSounds.test.ts`

**Interfaces:**
- Produces: `startHeat(): void`, `stopHeat(): void`.
- Consumes: `isHot` (de `engine/heat.ts`).

- [ ] **Step 1: Criar `src/audio/heatPlayer.ts`** — cópia fiel de `rainPlayer.ts` com a fonte do calor:

```ts
// Player do som de calor — loop com fade in/out, espelha rainPlayer. Best-effort: erros (autoplay
// bloqueado, arquivo ausente) falham em silêncio. Respeita mute + volume mestre.

import { getVolume, isMuted, subscribeMuted, subscribeVolume } from './sounds.ts'

const HEAT_SRC = '/sounds/weather/heat.mp3'
const HEAT_BASE_VOLUME = 0.5
const FADE_STEP = 0.04
const FADE_MS = 80

let el: HTMLAudioElement | null = null
let intended = false
let fadeTimer: ReturnType<typeof setInterval> | null = null

function ensureEl(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!el) {
    el = new Audio(HEAT_SRC)
    el.loop = true
    el.preload = 'auto'
    el.volume = 0
  }
  return el
}

function targetVolume(): number {
  return intended && !isMuted() ? HEAT_BASE_VOLUME * getVolume() : 0
}

function stopFade(): void {
  if (fadeTimer !== null) { clearInterval(fadeTimer); fadeTimer = null }
}

function ensureFade(): void {
  if (fadeTimer !== null) return
  fadeTimer = setInterval(() => {
    const a = el
    if (!a) return stopFade()
    const t = targetVolume()
    if (t > 0 && a.paused) void a.play().catch(() => {})
    if (a.volume < t) a.volume = Math.min(t, a.volume + FADE_STEP)
    else if (a.volume > t) a.volume = Math.max(t, a.volume - FADE_STEP)
    if (Math.abs(a.volume - t) < 1e-3) {
      a.volume = t
      if (t === 0) { a.pause(); a.currentTime = 0 }
      stopFade()
    }
  }, FADE_MS)
}

export function startHeat(): void {
  const a = ensureEl()
  if (!a) return
  intended = true
  void a.play().catch(() => {})
  ensureFade()
}

export function stopHeat(): void {
  intended = false
  if (!el) return
  ensureFade()
}

subscribeMuted(() => { if (el) ensureFade() })
subscribeVolume(() => { if (el) ensureFade() })
```

- [ ] **Step 2: Escrever o teste que falha** — em `src/audio/useGameSounds.test.ts`, espelhar os testes de chuva (mockar `./heatPlayer.ts` e verificar `startHeat`/`stopHeat` ao entrar/sair de janela de calor na fase DAY). Seguir o mesmo padrão de mock usado para `./rainPlayer.ts` no arquivo. Exemplo de asserção:

```ts
it('chama startHeat ao entrar em janela de calor e stopHeat ao sair (fase DAY)', () => {
  // monta estado DAY com s.weather.heat = [{ startMs: 0, endMs: 10_000 }]
  // tick em now=5_000 → startHeat chamado; tick em now=11_000 → stopHeat chamado
})
```
> Reaproveite a infra de mock/montagem já presente para a chuva; só troque `rainPlayer`→`heatPlayer`, `isRaining`→`isHot(state.weather.heat, …)` e o schedule para conter `heat`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/audio/useGameSounds.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar a ligação.** Em `src/audio/useGameSounds.ts`:
- Imports: `import { startHeat, stopHeat } from './heatPlayer.ts'` e `import { isHot } from '../engine/heat.ts'`.
- Adicionar um ref ao lado de `raining`: `const hot = useRef(false)`.
- No tique, ao lado do bloco da chuva (após o item 5), adicionar:
```ts
    const isHotNow = state.run.phase === 'DAY' && isHot(state.weather.heat, now)
    if (isHotNow && !hot.current) startHeat()
    else if (!isHotNow && hot.current) stopHeat()
    hot.current = isHotNow
```
(Confirme como `raining.current` é atualizado no arquivo e espelhe — se houver uma linha `raining.current = isRain`, faça o mesmo para `hot`.)
- No cleanup de unmount (`useEffect(() => () => stopRain(), [])`), adicionar `stopHeat()`:
```ts
  useEffect(() => () => { stopRain(); stopHeat() }, [])
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/audio/useGameSounds.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/audio/heatPlayer.ts src/audio/useGameSounds.ts src/audio/useGameSounds.test.ts
git commit -m "feat(clima): som de Calor em loop (heatPlayer) ligado por isHot"
```

---

## Task 12: Migração de save v37 → v38

**Files:**
- Modify: `src/engine/constants.ts` (`SAVE_VERSION`), `src/persistence/saveLoad.ts`
- Test: `src/persistence/saveLoad.test.ts`

**Interfaces:**
- Consumes: estrutura de `WeatherSchedule.heat` + previsão de calor.

- [ ] **Step 1: Escrever o teste que falha** — em `src/persistence/saveLoad.test.ts`, adicionar um caso que parte de um save v37 (sem `heat`) e verifica que após carregar/migrar o schedule tem `heat: []` e a previsão tem os campos zerados. Espelhar o teste análogo da migração v33 (storms). Exemplo:

```ts
it('migra v37 → v38: weather.heat = [] e previsão de calor zerada', () => {
  const v37 = makeSaveAtVersion(37) // helper já usado para outras versões no arquivo
  const loaded = loadFromString(JSON.stringify(v37))
  expect(loaded!.weather.heat).toEqual([])
  expect(loaded!.weather.forecast.heatChancePercent).toBe(0)
  expect(loaded!.weather.forecast.potentialHeatCount).toBe(0)
})
```
> Use os helpers de versão já presentes no arquivo (o mesmo padrão dos testes de v33/v36). Se o arquivo constrói o save por objeto, garanta `version: 37`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/persistence/saveLoad.test.ts`
Expected: FAIL (sem ramo v37→v38; `heat` ausente).

- [ ] **Step 3: Implementar.**

Em `src/engine/constants.ts`:
- Atualizar o comentário de versões adicionando a linha do v38 (antes da constante) e trocar o valor:
```ts
 * v38: efeito Calor. WeatherSchedule ganha `heat` e a previsão ganha heatChancePercent/
 * potentialHeatCount. A migração inicia heat vazio e a previsão de calor zerada (recalculados no
 * próximo setupDay). */
export const SAVE_VERSION = 38
```

Em `src/persistence/saveLoad.ts`, após o bloco que termina em `version = 37` (último ramo antes do `if (version !== SAVE_VERSION) return null`), adicionar:
```ts
  // v37 → v38: efeito Calor. weather ganha heat + previsão de calor; recalculado no próximo
  // setupDay. Aqui só garante a estrutura para saves no meio do dia.
  if (version === 37) {
    const weather = state.weather as Record<string, unknown> | undefined
    const forecast = (weather?.forecast as Record<string, unknown> | undefined) ?? {}
    state = {
      ...state,
      weather:
        weather && typeof weather === 'object'
          ? {
              ...weather,
              heat: Array.isArray(weather.heat) ? weather.heat : [],
              forecast: { heatChancePercent: 0, potentialHeatCount: 0, ...forecast },
            }
          : weather,
    } as typeof state
    version = 38
  }
```

> Verifique o número da última versão real no arquivo com `grep -n "version = 3" src/persistence/saveLoad.ts`; se já houver versões acima de 37, encadeie o novo ramo após a MAIOR (ajuste o `if (version === N)` para o N correto e `SAVE_VERSION = N+1`). O spec assume 37→38.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/persistence/saveLoad.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/constants.ts src/persistence/saveLoad.ts src/persistence/saveLoad.test.ts
git commit -m "feat(clima): migracao de save v37->v38 (weather.heat + previsao de calor)"
```

---

## Task 13: Verificação final e Pull Request

**Files:** nenhum (verificação + PR).

- [ ] **Step 1: Build + suíte completa**

Run: `npm run build && npm test`
Expected: build PASS; TODA a suíte PASS.

- [ ] **Step 2: Lint (se o projeto roda no CI)**

Run: `npx eslint src --max-warnings=0`
Expected: sem erros. (Corrigir imports órfãos eventualmente deixados nas Tasks 6–7.)

- [ ] **Step 3: Push do branch**

```bash
git push -u origin feat/clima-calor-celadon
```

- [ ] **Step 4: Abrir o PR para `main`**

```bash
gh pr create --base main --head feat/clima-calor-celadon \
  --title "feat(clima): efeito Calor em Celadon + habilidades de calor" \
  --body "$(cat <<'EOF'
## Resumo
- Novo efeito climático **Calor** a partir de Celadon (índice 3): janelas de 30–60s que reduzem 80% a velocidade de viagem (missões + captura).
- Celadon ganha calor + chuva + tempestade com fórmulas próprias (`{20,1,50}` / `{10,1,40}` / `{5,1,20}`).
- Liga as habilidades de calor: **Ice Body**/**Clear Body** (imunidade), **Dry Skin** (−25% vida no despacho; L2 −25% atributos) e **Chlorophyll** (imune + 200%/300% de velocidade).
- Integrador `weatherTravelMs` (ex-`rainTravelMs`) generaliza chuva + calor sobre a união das janelas; `instantWeatherSpeed` para o reroute.
- Selo, linha de previsão e **som** de calor (`heatPlayer`, `heat.mp3`).
- Vieses Cloud Nine/Overcoat/Own Tempo incluem o calor. Migração de save v37→v38.

## Verificação
- `npm run build` e `npm test` passam.

Spec: `docs/superpowers/specs/2026-06-23-efeito-calor-celadon-design.md`
Plano: `docs/superpowers/plans/2026-06-23-efeito-calor-celadon.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR criado contra `main`. Reportar o link ao usuário.

---

## Self-Review (preenchido)

**Cobertura do spec:**
- §1 Modelo de dados → Task 1. §2 Schedule/constantes/salts → Tasks 2–3. §3 `WeatherSchedule`/`buildDayWeather` → Tasks 2, 4. §4 Integrador → Tasks 6–7. §5 Imunidade/Dry Skin/Chlorophyll → Tasks 5, 6, 8. §6 Previsão/UI/aura → Tasks 9, 10; som → Task 11. §7 Persistência → Task 12. §8 Vieses → Task 9. Verificação + PR → Task 13. ✔ Sem lacunas.
- `teamIsSpeedy` (aura de veloz com Chlorophyll) do spec §6: coberto na **Task 10, Step 1** (estende a condição com o ramo de calor/Chlorophyll). ✔

**Placeholders:** não há TBD/TODO. Os pontos que dependem do formato exato de helpers de teja (`makeMissionCtx`, helpers de versão de save, mocks de áudio) instruem a espelhar um teste irmão já existente no MESMO arquivo — não são placeholders de implementação, e sim reuso de infra local.

**Consistência de tipos:** `weatherTravelMs`/`instantWeatherSpeed` (Task 6) usadas com a mesma assinatura na Task 7. `buildHeat(..., maxEvents?)` (Task 3) chamada com `heatCap: number | undefined` (Task 4) — semântica "undefined = sem cap; 0 = nenhuma" consistente. `isHot(events, now)` recebe sempre `schedule.heat`. `teamHeatSpeedBonus`/`teamImmuneToHeat` (Task 5) consumidas nas Tasks 6, 10. `heatChanceForDay`/`maxHeatTimes` (Task 3) consumidas na Task 4. ✔
