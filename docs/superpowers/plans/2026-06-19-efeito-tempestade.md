# Efeito climático Tempestade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um efeito climático "Tempestade" (raios que caem pelo mapa, causam 1 de dano e aplicam o status Paralyze) em Vermilion, junto com chuva.

**Architecture:** Lógica de tempestade num módulo puro `engine/storm.ts` (agendamento determinístico + geometria dos raios), composta sobre o `WeatherSchedule` existente. A aplicação de dano/Paralyze acontece em runtime no `dayClock` (depende da posição dos Pokémon). O status Paralyze congela o sprite por 5s e dá -50% de Batalha em batalhas 1v1 pelo resto do dia.

**Tech Stack:** Vite + React 19 + TypeScript (strict, sem `any`), Vitest, CSS Modules. Engine pura e determinística (RNG semeado, sem `Date.now()`/`Math.random()`).

## Global Constraints

- TypeScript **strict, sem `any`**. Arquivos ~200 linhas, funções ~30 linhas.
- Engine (`engine/`) e dados (`data/`) **puros**: sem React, sem `Date.now()`/`Math.random()` — sempre via `Rng` semeado (`createRng`/`deriveSeed`).
- Sem magic numbers: toda constante de balanceamento em `engine/balance.ts`; salts e invariantes estruturais em `engine/constants.ts`.
- Comentários em **português** (padrão do repositório), explicando o "porquê".
- Distâncias no mapa usam a correção de aspecto 16:9 via `segmentLength` (`engine/pathfinding.ts`); um "raio = fração da largura" compara com `radius * MAP_ASPECT_W`.
- Determinismo: o schedule da tempestade é função pura de `(seed, day, city, rainEvents)`; só a detecção de acerto/aplicação é runtime.
- Rodar testes com `npx vitest run <arquivo>`.

---

### Task 1: Configuração da cidade + constantes + tipos de estado

**Files:**
- Modify: `src/data/cityWeather.ts`
- Modify: `src/engine/constants.ts` (salt + bump de SAVE_VERSION)
- Modify: `src/engine/balance.ts` (constantes de balanceamento)
- Test: `src/data/cityWeather.test.ts` (criar)

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces:
  - `type WeatherEffectKind = 'rain' | 'storm'`
  - `interface StormEffectConfig { kind: 'storm' }`
  - `cityHasStorm(cityIndex: number): boolean`
  - Constantes em `balance.ts`: `STORM_CHANCE_TOTAL_PERCENT`, `STORM_EVENT_MIN_MS`, `STORM_EVENT_MAX_MS`, `STORM_GAP_MS`, `STRIKE_WARNING_MS`, `STRIKE_RADIUS`, `STRIKE_RADIUS_ON_WATER`, `STRIKE_SECONDARY_RADIUS`, `STRIKE_DAMAGE`, `STRIKE_MIN_PER_STORM`, `PARALYZE_STUN_MS`, `PARALYZE_BATTLE_MULT`.
  - Constante em `constants.ts`: `STORM_SEED_SALT`.

- [ ] **Step 1: Escrever o teste de configuração da cidade**

Criar `src/data/cityWeather.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cityHasRain, cityHasStorm, getCityWeather } from './cityWeather.ts'

describe('cityWeather — Tempestade', () => {
  it('Vermilion (índice 2) tem chuva E tempestade', () => {
    expect(cityHasRain(2)).toBe(true)
    expect(cityHasStorm(2)).toBe(true)
  })

  it('Cerulean (índice 1) tem chuva mas não tempestade', () => {
    expect(cityHasRain(1)).toBe(true)
    expect(cityHasStorm(1)).toBe(false)
  })

  it('cidade sem clima não tem nenhum efeito', () => {
    expect(getCityWeather(0)).toBeNull()
    expect(cityHasStorm(0)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/data/cityWeather.test.ts`
Expected: FAIL — `cityHasStorm` não existe; Vermilion não tem clima configurado.

- [ ] **Step 3: Implementar a config de tempestade em `cityWeather.ts`**

Substituir o tipo `WeatherEffectKind`, a união `WeatherEffectConfig`, o mapa `CITY_WEATHER` e adicionar `cityHasStorm`:

```ts
/** Tipos de efeito climático conhecidos. Futuro: 'sun' | 'sandstorm' | 'snow' … */
export type WeatherEffectKind = 'rain' | 'storm'

/** Efeito de Chuva: deixa poças pelo mapa (água temporária) — ver engine/weather.ts. */
export interface RainEffectConfig {
  kind: 'rain'
}

/** Efeito de Tempestade: raios que caem pelo mapa (dano + Paralyze) — ver engine/storm.ts. */
export interface StormEffectConfig {
  kind: 'storm'
}

export type WeatherEffectConfig = RainEffectConfig | StormEffectConfig
```

No mapa `CITY_WEATHER`, adicionar Vermilion (índice 2):

```ts
const CITY_WEATHER: Record<number, CityWeather> = {
  // Cerulean (Água/Gelo): só chuva.
  1: { effects: [{ kind: 'rain' }] },
  // Vermilion (Elétrico/Dragão): chuva + tempestade (raios encadeiam nas poças).
  2: { effects: [{ kind: 'rain' }, { kind: 'storm' }] },
}
```

Adicionar o helper ao fim do arquivo:

```ts
/** A cidade tem o efeito de Tempestade habilitado? */
export function cityHasStorm(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'storm') ?? false
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/data/cityWeather.test.ts`
Expected: PASS.

- [ ] **Step 5: Adicionar as constantes de balanceamento em `balance.ts`**

Adicionar ao fim de `src/engine/balance.ts` (após as constantes de clima existentes):

```ts
// ---- Tempestade (raios + Paralyze) — efeito climático de Vermilion -------------------
/** Orçamento de chance de tempestade somado entre os dias elegíveis (3–10), próprio. */
export const STORM_CHANCE_TOTAL_PERCENT = 300
/** Duração de um evento de tempestade (ms de jogo). */
export const STORM_EVENT_MIN_MS = 15_000
export const STORM_EVENT_MAX_MS = 30_000
/** Folga mínima entre tempestades PRÓPRIAS (as acopladas à chuva podem sobrepor). */
export const STORM_GAP_MS = 4_000
/** Aviso vermelho antes do impacto do raio. */
export const STRIKE_WARNING_MS = 5_000
/** Raio do efeito (fração da largura do mapa): padrão, quando o centro já é água, e secundário. */
export const STRIKE_RADIUS = 0.09
export const STRIKE_RADIUS_ON_WATER = 0.15
export const STRIKE_SECONDARY_RADIUS = 0.045
/** Dano de um raio. */
export const STRIKE_DAMAGE = 1
/** Piso de raios por tempestade (o teto escala com o dia até ⌊pontos/4⌋). */
export const STRIKE_MIN_PER_STORM = 1
/** Paralyze: tempo de congelamento do sprite e multiplicador de Batalha em batalhas 1v1. */
export const PARALYZE_STUN_MS = 5_000
export const PARALYZE_BATTLE_MULT = 0.5
```

- [ ] **Step 6: Adicionar o salt e o bump de versão em `constants.ts`**

Em `src/engine/constants.ts`, após `WEATHER_SEED_SALT`:

```ts
/** Sub-seed da Tempestade: agenda própria do dia + distribuição da chance na run (independe da chuva). */
export const STORM_SEED_SALT = 0x53746f72 // 'Stor'
```

E trocar a versão do save (a migração entra na Task 8 — o número já sobe aqui):

```ts
export const SAVE_VERSION = 33
```

Adicionar ao bloco de comentário do histórico de versões, logo antes de `export const SAVE_VERSION`:

```ts
 * v33: efeito Tempestade. WeatherSchedule ganha `storms` e a previsão ganha
 * stormChancePercent/potentialStormCount; today ganha paralyzedBattleIds; missões/buscas
 * ganham paralyzeHold opcional. A migração inicia storms vazio, previsão de tempestade
 * zerada e paralyzedBattleIds vazio (recalculados no próximo setupDay). */
```

- [ ] **Step 7: Commit**

```bash
git add src/data/cityWeather.ts src/data/cityWeather.test.ts src/engine/constants.ts src/engine/balance.ts
git commit -m "feat: config de Tempestade em Vermilion + constantes (cityHasStorm)"
```

---

### Task 2: Geometria do raio (`engine/storm.ts` — parte 1)

**Files:**
- Create: `src/engine/storm.ts`
- Test: `src/engine/storm.test.ts` (criar)

**Interfaces:**
- Consumes: `STRIKE_RADIUS`, `STRIKE_RADIUS_ON_WATER`, `STRIKE_SECONDARY_RADIUS` (Task 1); `segmentLength`, `MAP_ASPECT_W` (existentes); `puddleLevelAt`, `RainEvent` (de `weather.ts`); `CityData` (de `data/types.ts`); `MapPos` (de `types/index.ts`).
- Produces:
  - `interface StrikeCircle { cx: number; cy: number; radius: number }`
  - `interface Strike { warnAtMs: number; strikeAtMs: number; circles: StrikeCircle[] }`
  - `interface StormEvent { startMs: number; endMs: number; strikes: Strike[] }`
  - `pointInCircle(circle: StrikeCircle, p: MapPos): boolean`
  - `waterNodesAt(city: CityData, rainEvents: readonly RainEvent[], nowMs: number): Set<string>`
  - `resolveStrikeCircles(center: string, strikeAtMs: number, city: CityData, rainEvents: readonly RainEvent[]): StrikeCircle[]`

- [ ] **Step 1: Escrever os testes de geometria**

Criar `src/engine/storm.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  pointInCircle,
  resolveStrikeCircles,
  type StrikeCircle,
} from './storm.ts'
import type { CityData } from '../data/types.ts'
import type { RainEvent } from './weather.ts'
import { STRIKE_RADIUS, STRIKE_RADIUS_ON_WATER, STRIKE_SECONDARY_RADIUS } from './balance.ts'

// Cidade mínima de teste: 3 pontos numa linha horizontal + um ponto de água (surf).
function testCity(): CityData {
  return {
    index: 99,
    name: 'Test',
    primaryType: 'electric',
    secondaryType: 'dragon',
    starters: [],
    mapImage: '',
    coverImage: '',
    mapW: 1920,
    mapH: 1080,
    graph: {
      nodes: {
        a: { x: 0.1, y: 0.5 },
        b: { x: 0.15, y: 0.5 }, // ~5% da largura à direita de 'a' (dentro de 0,09)
        c: { x: 0.9, y: 0.5 }, // longe
        w: { x: 0.16, y: 0.5 }, // água, dentro de 0,09 de 'a'
      },
      adj: { a: ['b'], b: ['a'], c: [], w: [] },
      markers: {},
      surfNodes: ['w'],
    },
    siteNodes: { gym: 'a', center: 'b', mart: 'b', museum: ['c'], houses: ['b'], green: ['c'] },
    trainers: [],
  }
}

describe('storm — geometria', () => {
  const noRain: RainEvent[] = []

  it('pointInCircle respeita o aspecto 16:9 (raio = fração da largura)', () => {
    const circle: StrikeCircle = { cx: 0.5, cy: 0.5, radius: STRIKE_RADIUS }
    expect(pointInCircle(circle, { x: 0.5, y: 0.5 })).toBe(true)
    expect(pointInCircle(circle, { x: 0.5 + STRIKE_RADIUS - 0.001, y: 0.5 })).toBe(true)
    expect(pointInCircle(circle, { x: 0.5 + STRIKE_RADIUS + 0.01, y: 0.5 })).toBe(false)
  })

  it('centro fora da água + água dentro do raio → primário 0,09 + secundário 0,045', () => {
    const circles = resolveStrikeCircles('a', 0, testCity(), noRain)
    expect(circles).toHaveLength(2)
    expect(circles[0]?.radius).toBe(STRIKE_RADIUS)
    expect(circles[1]?.radius).toBe(STRIKE_SECONDARY_RADIUS)
    // O secundário nasce no ponto de água 'w'.
    expect(circles[1]?.cx).toBeCloseTo(0.16)
  })

  it('centro JÁ na água → raio único 0,15, sem secundário', () => {
    const circles = resolveStrikeCircles('w', 0, testCity(), noRain)
    expect(circles).toHaveLength(1)
    expect(circles[0]?.radius).toBe(STRIKE_RADIUS_ON_WATER)
  })

  it('sem água por perto → só o primário', () => {
    const circles = resolveStrikeCircles('c', 0, testCity(), noRain)
    expect(circles).toHaveLength(1)
    expect(circles[0]?.radius).toBe(STRIKE_RADIUS)
  })

  it('uma poça ativa conta como água para o encadeamento', () => {
    const rain: RainEvent[] = [
      { startMs: 0, endMs: 10_000, puddles: [{ node: 'b', startMs: 0, eventEndMs: 10_000, endMs: 11_000 }] },
    ]
    // Centro 'a', poça em 'b' (dentro de 0,09): secundário a partir de 'b'.
    const circles = resolveStrikeCircles('a', 5_000, testCity(), rain)
    expect(circles.some((c) => c.radius === STRIKE_SECONDARY_RADIUS && Math.abs(c.cx - 0.15) < 1e-6)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: FAIL — `./storm.ts` não existe.

- [ ] **Step 3: Implementar a geometria em `engine/storm.ts`**

Criar `src/engine/storm.ts` com o cabeçalho e a parte de geometria:

```ts
// Núcleo PURO do efeito climático Tempestade (2º efeito, após a Chuva). O schedule é semeado
// (STORM_SEED_SALT) e pré-computado em setupDay, então a presença/área de qualquer raio em
// qualquer instante é FUNÇÃO PURA de `now` (como as poças). A detecção de acerto e a aplicação
// de dano/Paralyze ficam no runtime (game/stormFlow.ts), pois dependem da posição dos Pokémon.
//
// Geometria do raio (ver docs/superpowers/specs/2026-06-19-efeito-tempestade-design.md):
// - raio padrão STRIKE_RADIUS (fração da largura); se o CENTRO já é água, vira único
//   STRIKE_RADIUS_ON_WATER; senão, cada ponto de água DENTRO do primário gera um secundário
//   STRIKE_SECONDARY_RADIUS (sem encadear adiante).

import type { MapPos } from '../types/index.ts'
import type { CityData } from '../data/types.ts'
import { MAP_ASPECT_W } from './constants.ts'
import { segmentLength } from './pathfinding.ts'
import { puddleLevelAt, type RainEvent } from './weather.ts'
import {
  STRIKE_RADIUS,
  STRIKE_RADIUS_ON_WATER,
  STRIKE_SECONDARY_RADIUS,
} from './balance.ts'

/** Um círculo do efeito do raio: centro (coords normalizadas) + raio (fração da largura). */
export interface StrikeCircle {
  cx: number
  cy: number
  radius: number
}

/** Um raio: aviso (vermelho), impacto (amarelo) e os círculos atingidos no impacto. */
export interface Strike {
  warnAtMs: number
  strikeAtMs: number
  circles: StrikeCircle[]
}

/** Um evento de tempestade: janela [start, end] e os raios que caem nela. */
export interface StormEvent {
  startMs: number
  endMs: number
  strikes: Strike[]
}

/** Um ponto está dentro do círculo? Usa a distância 16:9-corrigida (raio = fração da largura). */
export function pointInCircle(circle: StrikeCircle, p: MapPos): boolean {
  return segmentLength({ x: circle.cx, y: circle.cy }, p) <= circle.radius * MAP_ASPECT_W
}

/** Pontos de água em `nowMs`: surfNodes (fixos) + poças ativas da chuva nesse instante. */
export function waterNodesAt(
  city: CityData,
  rainEvents: readonly RainEvent[],
  nowMs: number,
): Set<string> {
  const water = new Set<string>(city.graph.surfNodes ?? [])
  for (const ev of rainEvents) {
    for (const p of ev.puddles) {
      if (puddleLevelAt(p, nowMs) > 0) water.add(p.node)
    }
  }
  return water
}

/**
 * Círculos de UM raio centrado em `center`, no instante `strikeAtMs`:
 * - centro é água → único STRIKE_RADIUS_ON_WATER;
 * - senão → primário STRIKE_RADIUS + um secundário STRIKE_SECONDARY_RADIUS por ponto de água
 *   dentro do primário (sem encadear adiante).
 */
export function resolveStrikeCircles(
  center: string,
  strikeAtMs: number,
  city: CityData,
  rainEvents: readonly RainEvent[],
): StrikeCircle[] {
  const pos = city.graph.nodes[center]
  if (!pos) return []
  const water = waterNodesAt(city, rainEvents, strikeAtMs)
  if (water.has(center)) {
    return [{ cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS_ON_WATER }]
  }
  const circles: StrikeCircle[] = [{ cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS }]
  const primary: StrikeCircle = { cx: pos.x, cy: pos.y, radius: STRIKE_RADIUS }
  for (const node of water) {
    const wp = city.graph.nodes[node]
    if (wp && pointInCircle(primary, wp)) {
      circles.push({ cx: wp.x, cy: wp.y, radius: STRIKE_SECONDARY_RADIUS })
    }
  }
  return circles
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/storm.ts src/engine/storm.test.ts
git commit -m "feat: geometria dos raios da Tempestade (resolveStrikeCircles)"
```

---

### Task 3: Agendamento da Tempestade (`engine/storm.ts` — parte 2)

**Files:**
- Modify: `src/engine/storm.ts`
- Modify: `src/engine/weather.ts` (campo `storms` no `WeatherSchedule` + campos de previsão)
- Test: `src/engine/storm.test.ts` (adicionar)

**Interfaces:**
- Consumes: `STORM_CHANCE_TOTAL_PERCENT`, `STORM_EVENT_MIN_MS`, `STORM_EVENT_MAX_MS`, `STORM_GAP_MS`, `STRIKE_WARNING_MS`, `STRIKE_MIN_PER_STORM` (Task 1); `STORM_SEED_SALT` (Task 1); `createRng`, `deriveSeed` (existentes); `DAY_LENGTH_MS`, `TOTAL_DAYS` (existentes); `WEATHER_FIRST_ELIGIBLE_DAY`, `maxRainTimes`, `RainEvent` (de `weather.ts`); `resolveStrikeCircles` (Task 2).
- Produces:
  - `maxStormTimes(day: number): number`
  - `stormChanceForDay(seed: number, day: number): number`
  - `strikeCountForDay(day: number, poolSize: number): number`
  - `buildStorms(seed: number, day: number, city: CityData, rainEvents: readonly RainEvent[], extraChancePercent?: number): StormEvent[]`
  - `activeStormAt(storms: readonly StormEvent[], nowMs: number): StormEvent | null`
  - `isStorming(storms: readonly StormEvent[], nowMs: number): boolean`
  - Em `weather.ts`: `WeatherSchedule.storms: StormEvent[]`, `WeatherForecast.stormChancePercent` e `.potentialStormCount`; `emptyWeatherSchedule()` inclui ambos.

- [ ] **Step 1: Estender o `WeatherSchedule` e o `WeatherForecast` em `weather.ts`**

Em `src/engine/weather.ts`, adicionar o import de tipo (erasable, sem ciclo de runtime) logo após os imports existentes:

```ts
import type { StormEvent } from './storm.ts'
```

Adicionar dois campos a `WeatherForecast` (a interface existente):

```ts
  /** Chance de tempestade do dia (0–100). 0 se a cidade não tem tempestade. */
  stormChancePercent: number
  /** Quantas tempestades PRÓPRIAS podem cair hoje (0–4). */
  potentialStormCount: number
```

Adicionar o campo `storms` a `WeatherSchedule`:

```ts
  /** Eventos de tempestade do dia (raios), ordenados por startMs. Vazio se não há tempestade. */
  storms: StormEvent[]
```

Atualizar `emptyWeatherSchedule()` para incluir os novos campos:

```ts
export function emptyWeatherSchedule(): WeatherSchedule {
  return {
    rain: [],
    storms: [],
    forecast: {
      rainChancePercent: 0,
      rainMmPerHour: 0,
      potentialRainCount: 0,
      stormChancePercent: 0,
      potentialStormCount: 0,
    },
  }
}
```

> Nota: `buildWeatherSchedule` (rain) continua preenchendo `storms: []` e os campos de previsão de tempestade zerados — a composição com a tempestade entra na Task 4. Atualizar o objeto literal retornado por `buildWeatherSchedule` para incluir `storms: []` e os dois campos de previsão zerados, mantendo o retorno válido.

- [ ] **Step 2: Escrever os testes de agendamento**

Adicionar a `src/engine/storm.test.ts`:

```ts
import {
  buildStorms,
  maxStormTimes,
  strikeCountForDay,
  activeStormAt,
  isStorming,
} from './storm.ts'

describe('storm — agendamento', () => {
  it('strikeCountForDay escala com o dia até o cap ⌊pool/4⌋', () => {
    // pool 20 → cap 5. Dia 3 = piso 1; dia 10 = cap 5.
    expect(strikeCountForDay(3, 20)).toBe(1)
    expect(strikeCountForDay(10, 20)).toBe(5)
    expect(strikeCountForDay(10, 20)).toBeLessThanOrEqual(Math.floor(20 / 4))
    // pool minúsculo → cap 0.
    expect(strikeCountForDay(10, 2)).toBe(0)
  })

  it('maxStormTimes cresce +1 a cada 2 dias, cap 4', () => {
    expect(maxStormTimes(2)).toBe(0)
    expect(maxStormTimes(3)).toBe(1)
    expect(maxStormTimes(10)).toBe(4)
  })

  it('é determinístico: mesmo seed/dia → mesmo schedule', () => {
    const a = buildStorms(123, 8, testCity(), [])
    const b = buildStorms(123, 8, testCity(), [])
    expect(a).toEqual(b)
  })

  it('acopla uma tempestade a CADA evento de chuva, dentro da janela', () => {
    const rain: RainEvent[] = [{ startMs: 50_000, endMs: 90_000, puddles: [] }]
    // chance 0 zera as PRÓPRIAS; só sobram as acopladas (1 por chuva).
    const storms = buildStorms(1, 5, testCity(), rain, -1000)
    const coupled = storms.filter((s) => s.startMs >= 50_000 && s.endMs <= 90_000 + 30_000)
    expect(coupled.length).toBeGreaterThanOrEqual(1)
    const s = coupled[0]!
    expect(s.startMs).toBeGreaterThanOrEqual(50_000)
    expect(s.startMs).toBeLessThanOrEqual(90_000)
  })

  it('activeStormAt/isStorming refletem a janela', () => {
    const storms = [{ startMs: 1_000, endMs: 2_000, strikes: [] }]
    expect(isStorming(storms, 1_500)).toBe(true)
    expect(isStorming(storms, 2_500)).toBe(false)
    expect(activeStormAt(storms, 1_500)?.startMs).toBe(1_000)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: FAIL — `buildStorms`/`strikeCountForDay`/etc. não existem.

- [ ] **Step 4: Implementar o agendamento em `storm.ts`**

Adicionar os imports no topo de `src/engine/storm.ts`:

```ts
import { createRng, deriveSeed, type Rng } from './rng.ts'
import { DAY_LENGTH_MS, TOTAL_DAYS, STORM_SEED_SALT } from './constants.ts'
import { clamp, lerp } from './math.ts'
import {
  WEATHER_FIRST_ELIGIBLE_DAY,
  maxRainTimes,
} from './weather.ts'
import {
  STORM_CHANCE_TOTAL_PERCENT,
  STORM_EVENT_MIN_MS,
  STORM_EVENT_MAX_MS,
  STORM_GAP_MS,
  STRIKE_WARNING_MS,
  STRIKE_MIN_PER_STORM,
} from './balance.ts'
```

> Antes de usar `lerp`, conferir se existe em `engine/math.ts`. Se não existir, adicionar:
> ```ts
> /** Interpolação linear entre a e b por t∈[0,1]. */
> export function lerp(a: number, b: number, t: number): number {
>   return a + (b - a) * t
> }
> ```

Adicionar as funções de agendamento (ao fim do arquivo):

```ts
/** Teto de tempestades PRÓPRIAS por dia (espelha a chuva): +1 a cada 2 dias, cap 4. */
export function maxStormTimes(day: number): number {
  return maxRainTimes(day) // mesma curva da chuva
}

/**
 * Chance própria de tempestade (%) por dia elegível (3–10): pesos sorteados na MESMA stream da
 * run (estável e variada), normalizados para o orçamento STORM_CHANCE_TOTAL_PERCENT. Dias < 3 → 0.
 */
export function stormChanceForDay(seed: number, day: number): number {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY) return 0
  const rng = createRng(deriveSeed(seed, STORM_SEED_SALT))
  const span = TOTAL_DAYS - WEATHER_FIRST_ELIGIBLE_DAY + 1
  const weights = Array.from({ length: span }, () => 0.5 + rng.next())
  const sum = weights.reduce((a, b) => a + b, 0)
  const idx = day - WEATHER_FIRST_ELIGIBLE_DAY
  const raw = (weights[idx] ?? 0) * (STORM_CHANCE_TOTAL_PERCENT / sum)
  return clamp(Math.round(raw), 0, 100)
}

/** Quantos raios numa tempestade: escala com o dia (piso STRIKE_MIN_PER_STORM) até ⌊pool/4⌋. */
export function strikeCountForDay(day: number, poolSize: number): number {
  const cap = Math.floor(poolSize / 4)
  if (cap <= 0) return 0
  const progress = clamp((day - WEATHER_FIRST_ELIGIBLE_DAY) / (TOTAL_DAYS - WEATHER_FIRST_ELIGIBLE_DAY), 0, 1)
  return clamp(Math.round(lerp(STRIKE_MIN_PER_STORM, cap, progress)), 0, cap)
}

/** Pontos onde uma poça pode cair — base do cap de raios (andáveis, exceto ginásio/surf/exploração). */
function stormPoolSize(city: CityData): number {
  const surf = new Set(city.graph.surfNodes ?? [])
  const gym = city.siteNodes.gym
  return Object.keys(city.graph.nodes).filter(
    (id) => id !== gym && !surf.has(id) && !/^g\d/.test(id),
  ).length
}

/** Cria os raios de UMA tempestade [start, end]: count escala com o dia; cada raio sorteia centro/tempo. */
function rollStrikes(
  rng: Rng,
  city: CityData,
  rainEvents: readonly RainEvent[],
  day: number,
  start: number,
  end: number,
): Strike[] {
  const count = strikeCountForDay(day, stormPoolSize(city))
  if (count === 0) return []
  const ids = Object.keys(city.graph.nodes)
  if (ids.length === 0) return []
  const strikes: Strike[] = []
  for (let k = 0; k < count; k++) {
    const center = rng.pick(ids)
    const warnAtMs = rng.int(start, end)
    const strikeAtMs = warnAtMs + STRIKE_WARNING_MS
    strikes.push({ warnAtMs, strikeAtMs, circles: resolveStrikeCircles(center, strikeAtMs, city, rainEvents) })
  }
  strikes.sort((a, b) => a.strikeAtMs - b.strikeAtMs)
  return strikes
}

/**
 * Agenda das tempestades do dia: as PRÓPRIAS (janelas não-sobrepostas, cada uma ocorre por
 * chance) + uma ACOPLADA dentro da janela de cada evento de chuva (poças → água p/ encadear).
 * Reprodutível por (seed, day, city, rainEvents). `extraChancePercent` permite testes/ajustes.
 */
export function buildStorms(
  seed: number,
  day: number,
  city: CityData,
  rainEvents: readonly RainEvent[],
  extraChancePercent = 0,
): StormEvent[] {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY) return []
  const rng = createRng(deriveSeed(seed, day, STORM_SEED_SALT))
  const chance = clamp(stormChanceForDay(seed, day) + extraChancePercent, 0, 100)
  const maxTimes = maxStormTimes(day)
  const storms: StormEvent[] = []

  // Próprias: mesma estrutura de janelas da chuva (duração 15–30s, folga STORM_GAP_MS).
  let cursor = 0
  for (let i = 0; i < maxTimes; i++) {
    const remainingAfter = maxTimes - 1 - i
    const duration = rng.int(STORM_EVENT_MIN_MS, STORM_EVENT_MAX_MS)
    const reserve = remainingAfter * (STORM_EVENT_MIN_MS + STORM_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - STORM_GAP_MS - reserve
    if (latestStart < cursor) break
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    if (rng.bool(chance / 100)) {
      storms.push({ startMs: start, endMs: end, strikes: rollStrikes(rng, city, rainEvents, day, start, end) })
    }
    cursor = end + STORM_GAP_MS
  }

  // Acopladas: uma tempestade DENTRO da janela de cada chuva (15–30s, encaixada).
  for (const rain of rainEvents) {
    const window = rain.endMs - rain.startMs
    const duration = Math.min(rng.int(STORM_EVENT_MIN_MS, STORM_EVENT_MAX_MS), Math.max(STORM_EVENT_MIN_MS, window))
    const latestStart = Math.max(rain.startMs, rain.endMs - duration)
    const start = rng.int(rain.startMs, latestStart)
    const end = start + duration
    storms.push({ startMs: start, endMs: end, strikes: rollStrikes(rng, city, rainEvents, day, start, end) })
  }

  storms.sort((a, b) => a.startMs - b.startMs)
  return storms
}

/** Tempestade ATIVA em `nowMs`, ou null. */
export function activeStormAt(storms: readonly StormEvent[], nowMs: number): StormEvent | null {
  for (const s of storms) if (nowMs >= s.startMs && nowMs < s.endMs) return s
  return null
}

/** Está em tempestade em `nowMs`? (selo/efeitos seguem isto.) */
export function isStorming(storms: readonly StormEvent[], nowMs: number): boolean {
  return activeStormAt(storms, nowMs) !== null
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: PASS.

- [ ] **Step 6: Garantir que o resto da engine ainda compila/passa**

Run: `npx vitest run src/engine/weather.test.ts`
Expected: PASS (o `emptyWeatherSchedule` e `buildWeatherSchedule` agora retornam `storms`/campos novos; se o teste de weather comparar o objeto inteiro, ajustar o esperado para incluir `storms: []` e os campos de previsão zerados).

- [ ] **Step 7: Commit**

```bash
git add src/engine/storm.ts src/engine/storm.test.ts src/engine/weather.ts
git commit -m "feat: agenda da Tempestade (buildStorms, escala por dia, acoplada à chuva)"
```

---

### Task 4: Derivações de runtime + composição com a chuva

**Files:**
- Modify: `src/engine/storm.ts` (derivações `activeStrikeCirclesAt`, `strikesResolvingBetween`, composição `buildDayWeather`)
- Test: `src/engine/storm.test.ts` (adicionar)

**Interfaces:**
- Consumes: `buildWeatherSchedule`, `WeatherSchedule` (de `weather.ts`); `cityHasStorm` (de `data/cityWeather.ts`); `STRIKE_WARNING_MS` (Task 1).
- Produces:
  - `type StrikePhase = 'warning' | 'striking'`
  - `activeStrikeCirclesAt(storms, nowMs): { phase: StrikePhase; circles: StrikeCircle[] }[]`
  - `strikesResolvingBetween(storms, prevMs, nowMs): Strike[]`
  - `buildDayWeather(seed, day, city, extraRainChancePercent?): WeatherSchedule` — compõe chuva + tempestade num único schedule.

- [ ] **Step 1: Escrever os testes das derivações + composição**

Adicionar a `src/engine/storm.test.ts`:

```ts
import { activeStrikeCirclesAt, strikesResolvingBetween, buildDayWeather } from './storm.ts'
import { getCity } from '../data/cities.ts'
import { STRIKE_WARNING_MS } from './balance.ts'

describe('storm — runtime e composição', () => {
  const storms = [
    {
      startMs: 0,
      endMs: 30_000,
      strikes: [
        { warnAtMs: 1_000, strikeAtMs: 1_000 + STRIKE_WARNING_MS, circles: [{ cx: 0.5, cy: 0.5, radius: 0.09 }] },
      ],
    },
  ]

  it('fase warning enquanto warnAtMs ≤ now < strikeAtMs', () => {
    const at = activeStrikeCirclesAt(storms, 2_000)
    expect(at).toHaveLength(1)
    expect(at[0]?.phase).toBe('warning')
  })

  it('fase striking logo após o impacto', () => {
    const at = activeStrikeCirclesAt(storms, 1_000 + STRIKE_WARNING_MS + 100)
    expect(at[0]?.phase).toBe('striking')
  })

  it('strikesResolvingBetween captura o impacto no intervalo (robusto a saltos)', () => {
    const hit = strikesResolvingBetween(storms, 0, 1_000 + STRIKE_WARNING_MS + 50)
    expect(hit).toHaveLength(1)
    const miss = strikesResolvingBetween(storms, 0, 1_000) // antes do impacto
    expect(miss).toHaveLength(0)
  })

  it('buildDayWeather compõe chuva + tempestade em Vermilion e é determinístico', () => {
    const city = getCity(2) // Vermilion
    const a = buildDayWeather(777, 9, city)
    const b = buildDayWeather(777, 9, city)
    expect(a).toEqual(b)
    expect(a.forecast.stormChancePercent).toBeGreaterThanOrEqual(0)
    // storms é array (pode ser vazio conforme sorteio, mas o campo existe).
    expect(Array.isArray(a.storms)).toBe(true)
  })

  it('buildDayWeather não adiciona tempestade em cidade sem o efeito', () => {
    const cerulean = getCity(1)
    const w = buildDayWeather(777, 9, cerulean)
    expect(w.storms).toEqual([])
    expect(w.forecast.stormChancePercent).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: FAIL — funções novas não existem.

- [ ] **Step 3: Implementar as derivações + composição em `storm.ts`**

Adicionar imports:

```ts
import type { WeatherSchedule } from './weather.ts'
import { buildWeatherSchedule } from './weather.ts'
import { cityHasStorm } from '../data/cityWeather.ts'
```

Adicionar ao fim de `storm.ts`:

```ts
export type StrikePhase = 'warning' | 'striking'

/** Quanto tempo o círculo amarelo do impacto fica visível (animação) após cair. */
const STRIKE_FLASH_MS = 600

/** Círculos visíveis em `nowMs`: em aviso (vermelho) ou no flash do impacto (amarelo). */
export function activeStrikeCirclesAt(
  storms: readonly StormEvent[],
  nowMs: number,
): { phase: StrikePhase; circles: StrikeCircle[] }[] {
  const out: { phase: StrikePhase; circles: StrikeCircle[] }[] = []
  for (const storm of storms) {
    for (const strike of storm.strikes) {
      if (nowMs >= strike.warnAtMs && nowMs < strike.strikeAtMs) {
        out.push({ phase: 'warning', circles: strike.circles })
      } else if (nowMs >= strike.strikeAtMs && nowMs < strike.strikeAtMs + STRIKE_FLASH_MS) {
        out.push({ phase: 'striking', circles: strike.circles })
      }
    }
  }
  return out
}

/** Raios cujo impacto cai em (prevMs, nowMs] — robusto a saltos grandes de tempo (x3/aba oculta). */
export function strikesResolvingBetween(
  storms: readonly StormEvent[],
  prevMs: number,
  nowMs: number,
): Strike[] {
  const out: Strike[] = []
  for (const storm of storms) {
    for (const strike of storm.strikes) {
      if (strike.strikeAtMs > prevMs && strike.strikeAtMs <= nowMs) out.push(strike)
    }
  }
  return out
}

/**
 * Schedule climático completo do dia (chuva + tempestade), reprodutível por (seed, day, city).
 * A tempestade só entra se a cidade a tem; os raios usam os eventos de chuva para encadear nas
 * poças. Substitui chamadas diretas a buildWeatherSchedule no setup/forecast.
 */
export function buildDayWeather(
  seed: number,
  day: number,
  city: CityData,
  extraRainChancePercent = 0,
): WeatherSchedule {
  const base = buildWeatherSchedule(seed, day, city, extraRainChancePercent)
  if (!cityHasStorm(city.index)) return base
  const storms = buildStorms(seed, day, city, base.rain)
  return {
    ...base,
    storms,
    forecast: {
      ...base.forecast,
      stormChancePercent: stormChanceForDay(seed, day),
      potentialStormCount: maxStormTimes(day),
    },
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/storm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/storm.ts src/engine/storm.test.ts
git commit -m "feat: derivações de runtime + buildDayWeather (compõe chuva + tempestade)"
```

---

### Task 5: Estado de Paralyze + posições compartilhadas dos viajantes

**Files:**
- Modify: `src/engine/state.ts` (campos `paralyzeHold` + `today.paralyzedBattleIds`)
- Create: `src/engine/travelerPositions.ts`
- Modify: `src/components/day/CityMap.tsx` (consumir o novo helper)
- Test: `src/engine/travelerPositions.test.ts` (criar)

**Interfaces:**
- Consumes: `MapPos`, `GameState`, `MissionInstance`, `CaptureSearch`, `CaptureReturn` (de `state.ts`); `pointAlongPath`, `graphWithTunnels` (de `pathfinding.ts`); `getCity` (de `data/cities.ts`); `CityGraph` (de `data/types.ts`).
- Produces:
  - Em `state.ts`: `paralyzeHold?: { pos: MapPos; untilMs: number }` em `MissionInstance`, `CaptureSearch`, `CaptureReturn`; `today.paralyzedBattleIds: string[]` (incluído em `emptyTally`).
  - `elapsedFraction(now, start, end): number`
  - `missionTravelerPos(graph: CityGraph, m: MissionInstance, now: number): MapPos | null`
  - `searchTravelerPos(graph: CityGraph, c: CaptureSearch, now: number): MapPos | null`
  - `returnTravelerPos(graph: CityGraph, r: CaptureReturn, now: number): MapPos`
  - `travelerPositionsAt(s: GameState, now: number): { id: string; pos: MapPos }[]`

- [ ] **Step 1: Adicionar os campos de estado em `state.ts`**

Em `src/engine/state.ts`, adicionar a `MissionInstance` (após `weatherHold`):

```ts
  /**
   * Paralyze (Tempestade): congela o sprite numa posição arbitrária por 5s. `pos` é onde o raio
   * acertou; `untilMs` é quando descongela. Ausente = sem paralisia em curso.
   */
  paralyzeHold?: { pos: MapPos; untilMs: number }
```

Adicionar o MESMO campo a `CaptureSearch` e a `CaptureReturn` (após o respectivo `weatherHold`).

Adicionar a `DayTally` (interface), junto dos demais campos:

```ts
  /** Pokémon (ids) com -50% de Batalha pelo resto do dia (Paralyze da Tempestade). */
  paralyzedBattleIds: string[]
```

Adicionar a `emptyTally()` (objeto retornado):

```ts
    paralyzedBattleIds: [],
```

- [ ] **Step 2: Escrever o teste de paridade das posições**

Criar `src/engine/travelerPositions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { missionTravelerPos, elapsedFraction } from './travelerPositions.ts'
import type { MissionInstance } from './state.ts'
import type { CityGraph } from '../data/types.ts'

const graph: CityGraph = {
  nodes: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
  adj: { a: ['b'], b: ['a'] },
  markers: {},
}

function baseMission(over: Partial<MissionInstance>): MissionInstance {
  return {
    id: 'm1', templateId: 'house', requirement: {} as never, node: 'b',
    path: ['a', 'b'], spawnAtMs: 0, expiresAtMs: 0, status: 'traveling', teamIds: ['p1'],
    acceptedAtMs: 0, arriveAtMs: 1000, resolveAtMs: null, returnEndsAtMs: null,
    result: null, pSuccess: null, ...over,
  }
}

describe('travelerPositions', () => {
  it('elapsedFraction satura em [0,1]', () => {
    expect(elapsedFraction(500, 0, 1000)).toBeCloseTo(0.5)
    expect(elapsedFraction(-100, 0, 1000)).toBe(0)
    expect(elapsedFraction(2000, 0, 1000)).toBe(1)
  })

  it('interpola a posição na ida (meio do caminho)', () => {
    const pos = missionTravelerPos(graph, baseMission({}), 500)
    expect(pos?.x).toBeCloseTo(0.5)
  })

  it('paralyzeHold tem prioridade: devolve a pos congelada enquanto now < untilMs', () => {
    const m = baseMission({ paralyzeHold: { pos: { x: 0.42, y: 0.42 }, untilMs: 800 } })
    expect(missionTravelerPos(graph, m, 500)?.x).toBeCloseTo(0.42)
    // após untilMs, volta a interpolar
    expect(missionTravelerPos(graph, m, 900)?.x).not.toBeCloseTo(0.42)
  })

  it('inProgress não aparece no mapa (null)', () => {
    expect(missionTravelerPos(graph, baseMission({ status: 'inProgress' }), 500)).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/engine/travelerPositions.test.ts`
Expected: FAIL — `./travelerPositions.ts` não existe.

- [ ] **Step 4: Implementar `engine/travelerPositions.ts`**

Criar o arquivo extraindo a lógica de posição hoje embutida em `CityMap.tsx` (acrescentando a prioridade do `paralyzeHold`):

```ts
// Posição dos Pokémon "em trânsito" no mapa (PLAN §3.1), pura e compartilhada entre a UI
// (CityMap) e a aplicação dos raios da Tempestade (game/stormFlow). É a ÚNICA fonte de verdade:
// o que o jogador vê é exatamente o que o raio acerta. Honra paralyzeHold (congelamento) e
// weatherHold (poça), reroutePath e mão única.

import type { MapPos } from '../types/index.ts'
import type { CityGraph } from '../data/types.ts'
import type { CaptureReturn, CaptureSearch, GameState, MissionInstance } from './state.ts'
import { getCity } from '../data/cities.ts'
import { graphWithTunnels, pointAlongPath } from './pathfinding.ts'
import { clamp } from './math.ts'

/** Fração [0,1] do tempo decorrido entre dois instantes (start→end). */
export function elapsedFraction(now: number, start: number, end: number): number {
  return end > start ? clamp((now - start) / (end - start), 0, 1) : 1
}

/** Posição congelada por paralisia (Paralyze) em `now`, ou null se não há hold ativo. */
function paralyzePos(
  hold: { pos: MapPos; untilMs: number } | undefined,
  now: number,
): MapPos | null {
  return hold && now < hold.untilMs ? { ...hold.pos } : null
}

/** Posição do time de uma missão em deslocamento (ida/volta), ou null (no local/parada). */
export function missionTravelerPos(graph: CityGraph, m: MissionInstance, now: number): MapPos | null {
  if (m.path.length === 0) return null
  const frozen = paralyzePos(m.paralyzeHold, now)
  if (frozen) return frozen
  if (m.weatherHold && now < m.weatherHold.untilMs) {
    const held = graph.nodes[m.weatherHold.node]
    if (held) return { ...held }
  }
  if (m.status === 'traveling' && m.acceptedAtMs !== null && m.arriveAtMs !== null) {
    const out = m.reroutePath ?? m.path
    return pointAlongPath(graph, out, elapsedFraction(now, m.acceptedAtMs, m.arriveAtMs))
  }
  if (m.status === 'returning' && m.resolveAtMs !== null && m.returnEndsAtMs !== null) {
    const back = m.reroutePath ?? m.returnPath ?? [...m.path].reverse()
    return pointAlongPath(graph, back, elapsedFraction(now, m.resolveAtMs, m.returnEndsAtMs))
  }
  return null
}

/** Posição de um procurador a caminho (fase 'traveling'), ou null (já procurando/no local). */
export function searchTravelerPos(graph: CityGraph, c: CaptureSearch, now: number): MapPos | null {
  if (c.phase !== 'traveling') return null
  const frozen = paralyzePos(c.paralyzeHold, now)
  if (frozen) return frozen
  if (c.weatherHold && now < c.weatherHold.untilMs) {
    const held = graph.nodes[c.weatherHold.node]
    if (held) return { ...held }
  }
  const out = c.reroutePath ?? c.path
  return pointAlongPath(graph, out, elapsedFraction(now, c.departAtMs, c.arriveAtMs))
}

/** Posição de um procurador voltando ao ginásio. */
export function returnTravelerPos(graph: CityGraph, r: CaptureReturn, now: number): MapPos {
  const frozen = paralyzePos(r.paralyzeHold, now)
  if (frozen) return frozen
  if (r.weatherHold && now < r.weatherHold.untilMs) {
    const held = graph.nodes[r.weatherHold.node]
    if (held) return { ...held }
  }
  const back = r.reroutePath ?? (r.path[0] === r.node ? r.path : [...r.path].reverse())
  return pointAlongPath(graph, back, elapsedFraction(now, r.departAtMs, r.arriveAtMs))
}

/** Posições de TODOS os Pokémon visíveis no mapa em `now` (um item por Pokémon). */
export function travelerPositionsAt(s: GameState, now: number): { id: string; pos: MapPos }[] {
  const city = getCity(s.run.cityIndex)
  const graph = graphWithTunnels(city.graph, s.today.digTunnels)
  const out: { id: string; pos: MapPos }[] = []
  for (const m of s.missions) {
    const pos = missionTravelerPos(graph, m, now)
    if (pos) for (const id of m.teamIds) out.push({ id, pos })
  }
  for (const c of s.captureSearches) {
    const pos = searchTravelerPos(graph, c, now)
    if (pos) out.push({ id: c.searcherId, pos })
  }
  for (const r of s.captureReturns) {
    out.push({ id: r.searcherId, pos: returnTravelerPos(graph, r, now) })
  }
  return out
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/engine/travelerPositions.test.ts`
Expected: PASS.

- [ ] **Step 6: Refatorar `CityMap.tsx` para usar o helper compartilhado**

Em `src/components/day/CityMap.tsx`:
- Adicionar o import: `import { elapsedFraction, missionTravelerPos, searchTravelerPos, returnTravelerPos } from '../../engine/travelerPositions.ts'`.
- **Remover** a função local `elapsedFraction` (linhas 71–74) e a função local `missionTravelerPos` (linhas 197–218) — agora vêm do helper.
- No `MapTravelers`, trocar o cálculo das posições de captura para usar `searchTravelerPos`/`returnTravelerPos` em vez do cálculo inline. Para a busca:

```tsx
      {state.captureSearches.map((c) => {
        const pos = searchTravelerPos(graph, c, now)
        if (!pos) return null
        return (
          <TravelerGroup key={`s-${c.searcherId}`} pos={pos} ids={[c.searcherId]} roster={state.roster} flying={c.flying} surfing={c.surfing} />
        )
      })}
      {state.captureReturns.map((r) => {
        const pos = returnTravelerPos(graph, r, now)
        return (
          <TravelerGroup key={`r-${r.searcherId}`} pos={pos} ids={[r.searcherId]} roster={state.roster} flying={r.flying} surfing={r.surfing} />
        )
      })}
```

> `remainingFraction` e `timerFraction` permanecem locais no CityMap (usados pelos anéis dos marcadores).

- [ ] **Step 7: Rodar a suíte e o type-check para garantir que nada quebrou**

Run: `npx vitest run` e `npx tsc --noEmit`
Expected: PASS / sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add src/engine/state.ts src/engine/travelerPositions.ts src/engine/travelerPositions.test.ts src/components/day/CityMap.tsx
git commit -m "feat: posições compartilhadas dos viajantes + estado de Paralyze"
```

---

### Task 6: -50% de Batalha no `gymDefense`

**Files:**
- Modify: `src/engine/gymDefense.ts`
- Modify: `src/game/defenseFlow.ts` (passar `paralyzedIds`)
- Modify: `src/game/missionFlow.ts` (passar `paralyzedIds` na batalha Rocket)
- Test: `src/engine/gymDefense.test.ts` (adicionar)

**Interfaces:**
- Consumes: `PARALYZE_BATTLE_MULT` (Task 1); `s.today.paralyzedBattleIds` (Task 5).
- Produces: `ResolveDefenseOpts.paralyzedIds?: ReadonlySet<string>` aplicado em `resolveDefense`.

- [ ] **Step 1: Escrever o teste do -50%**

Adicionar a `src/engine/gymDefense.test.ts` (seguir o padrão de criação de Pokémon já usado no arquivo; abaixo um esqueleto com `createPokemon`):

```ts
import { PARALYZE_BATTLE_MULT } from './balance.ts'

describe('resolveDefense — Paralyze (-50% Batalha)', () => {
  it('um Pokémon paralisado luta com metade da Batalha efetiva', () => {
    const rng = createRng(1)
    const you = makeMonWithBattle('p1', 40) // helper local do arquivo de teste
    const enemy: EnemyUnit = { battle: 30, types: ['normal'] }
    // Sem paralisia: 40 vs 30 → vitória garantida (pWin clamp 1).
    const normal = resolveDefense(createRng(1), [you], [enemy])
    expect(normal.duels[0]?.pWin).toBe(1)
    // Com paralisia: 20 vs 30 → pWin ≈ 0,667.
    const para = resolveDefense(rng, [you], [enemy], { paralyzedIds: new Set(['p1']) })
    expect(para.duels[0]?.pWin).toBeCloseTo((40 * PARALYZE_BATTLE_MULT) / 30, 5)
  })

  it('sem id paralisado, nada muda', () => {
    const you = makeMonWithBattle('p1', 40)
    const enemy: EnemyUnit = { battle: 30, types: ['normal'] }
    const r = resolveDefense(createRng(1), [you], [enemy], { paralyzedIds: new Set(['outro']) })
    expect(r.duels[0]?.pWin).toBe(1)
  })
})
```

> Se o arquivo de teste ainda não tem um `makeMonWithBattle`, criar um helper local que monte um `Pokemon` com `baseAttrs.batalha` = valor desejado, `ivs`/`allocations` zerados, `types: ['normal']`, `currentHp/maxHp` altos (ex.: 10), `status: 'idle'`, `passives: []`, `gender: 'genderless'`, `nickname: null`, `nature: null`. Reaproveitar qualquer factory já existente no arquivo, se houver.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/engine/gymDefense.test.ts`
Expected: FAIL — `paralyzedIds` ainda não reduz a Batalha.

- [ ] **Step 3: Implementar o -50% em `gymDefense.ts`**

Adicionar o import:

```ts
import { PARALYZE_BATTLE_MULT } from './balance.ts'
```

Adicionar o campo a `ResolveDefenseOpts`:

```ts
  /** Pokémon (ids) paralisados pela Tempestade: lutam com metade da Batalha (Paralyze). */
  paralyzedIds?: ReadonlySet<string>
```

Em `resolveDefense`, logo após calcular `yourEff` com os multiplicadores de item/Rollout/Hustle (após a linha do Thick Fat e antes/depois do Moxie — basta ser antes de `duelWinProbability`), aplicar:

```ts
    // Paralyze (Tempestade): seu Pokémon paralisado hoje luta com metade da Batalha.
    if (opts.paralyzedIds?.has(you.id)) yourEff *= PARALYZE_BATTLE_MULT
```

> Colocar essa linha junto das outras que ajustam `yourEff` (ex.: imediatamente após o bloco do Moxie `if (hasMoxie(you)) yourEff += ...`), antes de `const enemyEff = ...`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/engine/gymDefense.test.ts`
Expected: PASS.

- [ ] **Step 5: Passar `paralyzedIds` nos chamadores**

Em `src/game/defenseFlow.ts`, localizar a chamada a `resolveDefense(...)` e adicionar a opção `paralyzedIds: new Set(s.today.paralyzedBattleIds)` ao objeto de `opts` (junto de `sturdyAvailableIds`/`runItems`/`damagePerLoss`).

Em `src/game/missionFlow.ts`, na função `resolveRocketBattle`, a chamada a `resolveDefense(takeRng(s), team, mission.rocket.enemies, { ... })` recebe a mesma opção:

```ts
    paralyzedIds: new Set(s.today.paralyzedBattleIds),
```

- [ ] **Step 6: Rodar a suíte e o type-check**

Run: `npx vitest run src/engine/gymDefense.test.ts src/game/rocketFlow.test.ts` e `npx tsc --noEmit`
Expected: PASS / sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/engine/gymDefense.ts src/engine/gymDefense.test.ts src/game/defenseFlow.ts src/game/missionFlow.ts
git commit -m "feat: Paralyze reduz a Batalha em 50% nas batalhas 1v1"
```

---

### Task 7: Aplicação dos raios no tick (`game/stormFlow.ts` + `dayClock`)

**Files:**
- Create: `src/game/stormFlow.ts`
- Modify: `src/game/dayClock.ts` (chamar `processStorms` com `prevMs`)
- Modify: `src/game/missionFlow.ts` (exportar `shiftMissionTimestamps`)
- Test: `src/game/stormFlow.test.ts` (criar)

**Interfaces:**
- Consumes: `travelerPositionsAt` (Task 5); `strikesResolvingBetween`, `pointInCircle` (Tasks 2/4); `STRIKE_DAMAGE`, `PARALYZE_STUN_MS` (Task 1); `findMon`, `replaceMon` (de `runtime.ts`); `shiftMissionTimestamps` (exportada de `missionFlow.ts`).
- Produces:
  - `applyParalyze(s: GameState, id: string, pos: MapPos, now: number): void`
  - `processStorms(s: GameState, prevMs: number, nowMs: number): void`

- [ ] **Step 1: Exportar `shiftMissionTimestamps` de `missionFlow.ts`**

Em `src/game/missionFlow.ts`, trocar `function shiftMissionTimestamps(` por `export function shiftMissionTimestamps(` (a assinatura e o corpo não mudam).

- [ ] **Step 2: Escrever os testes do stormFlow**

Criar `src/game/stormFlow.test.ts`. Montar um estado mínimo com uma missão em `traveling` cujo time está no meio do caminho e um raio que cai naquela posição:

```ts
import { describe, expect, it } from 'vitest'
import { processStorms } from './stormFlow.ts'
import { autoSeedRun } from './setup.ts'
import type { GameState } from '../engine/state.ts'
import type { StormEvent } from '../engine/storm.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'

// Cria um estado com 1 Pokémon despachado numa missão em trânsito; devolve {state, pos, id}.
function travelingState(): { s: GameState; id: string; pos: { x: number; y: number } } {
  const s = autoSeedRun(42)
  s.run.phase = 'DAY'
  const mon = s.roster[0]!
  const id = mon.id
  // Missão sintética em trânsito, no meio da ida (a→b), com o time ocupando-a.
  s.roster[0] = { ...mon, status: 'traveling', currentHp: 5, maxHp: 5 }
  const city = getCityGraphFor(s) // ver nota abaixo
  s.missions = [
    {
      id: 'm1', templateId: 'house', requirement: {} as never, node: dest(city),
      path: pathFor(city), spawnAtMs: 0, expiresAtMs: 999_999, status: 'traveling',
      teamIds: [id], acceptedAtMs: 0, arriveAtMs: 10_000, resolveAtMs: null,
      returnEndsAtMs: null, result: null, pSuccess: null,
    },
  ]
  const pos = travelerPositionsAt(s, 5_000).find((t) => t.id === id)!.pos
  return { s, id, pos }
}
```

> Nota de teste: para evitar dependência do grafo real, montar o teste com uma cidade cujo grafo seja conhecido OU derivar `pos` via `travelerPositionsAt` (como acima) e então criar o raio EXATAMENTE nessa `pos`. O importante é que o círculo do raio contenha `pos`. Use helpers locais simples (`dest`, `pathFor`, `getCityGraphFor`) que leiam `getCity(s.run.cityIndex).graph` e escolham dois pontos adjacentes a partir do ginásio.

Casos a cobrir:

```ts
describe('stormFlow — aplicação dos raios', () => {
  it('raio que cobre a posição do time aplica 1 de dano e Paralyze', () => {
    const { s, id, pos } = travelingState()
    const storm: StormEvent = {
      startMs: 0, endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    const before = s.roster.find((p) => p.id === id)!.currentHp
    processStorms(s, 0, 6_000)
    const after = s.roster.find((p) => p.id === id)!
    expect(after.currentHp).toBe(before - 1)
    expect(s.today.paralyzedBattleIds).toContain(id)
    // congelamento: paralyzeHold setado na missão
    expect(s.missions[0]!.paralyzeHold?.untilMs).toBe(5_000 + 5_000)
  })

  it('raio longe do time não acerta ninguém', () => {
    const { s, id } = travelingState()
    const storm: StormEvent = {
      startMs: 0, endMs: 30_000,
      strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: 0.99, cy: 0.99, radius: 0.01 }] }],
    }
    s.weather = { ...s.weather, storms: [storm] }
    const before = s.roster.find((p) => p.id === id)!.currentHp
    processStorms(s, 0, 6_000)
    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(before)
    expect(s.today.paralyzedBattleIds).not.toContain(id)
  })

  it('salto de tempo grande não perde o raio (intervalo prevMs..now)', () => {
    const { s, id, pos } = travelingState()
    s.weather = {
      ...s.weather,
      storms: [{ startMs: 0, endMs: 30_000, strikes: [{ warnAtMs: 0, strikeAtMs: 4_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }] }],
    }
    const before = s.roster.find((p) => p.id === id)!.currentHp
    processStorms(s, 0, 20_000) // salto que atravessa o impacto
    expect(s.roster.find((p) => p.id === id)!.currentHp).toBe(before - 1)
  })

  it('dano não vira fainted no meio do trânsito (status preservado)', () => {
    const { s, id, pos } = travelingState()
    s.roster[0] = { ...s.roster.find((p) => p.id === id)!, currentHp: 1 }
    s.weather = {
      ...s.weather,
      storms: [{ startMs: 0, endMs: 30_000, strikes: [{ warnAtMs: 0, strikeAtMs: 5_000, circles: [{ cx: pos.x, cy: pos.y, radius: 0.2 }] }] }],
    }
    processStorms(s, 0, 6_000)
    const after = s.roster.find((p) => p.id === id)!
    expect(after.currentHp).toBe(0)
    expect(after.status).toBe('traveling') // não 'fainted' aqui
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/game/stormFlow.test.ts`
Expected: FAIL — `./stormFlow.ts` não existe.

- [ ] **Step 4: Implementar `game/stormFlow.ts`**

```ts
// Aplicação dos raios da Tempestade no runtime (PLAN §clima): a geometria/horário são puros
// (engine/storm), mas QUEM é atingido depende da posição dos Pokémon — então a detecção de
// acerto e a aplicação de dano/Paralyze acontecem no tick do dia, como o dano de missão.

import type { MapPos } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { pointInCircle, strikesResolvingBetween } from '../engine/storm.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'
import { STRIKE_DAMAGE, PARALYZE_STUN_MS } from '../engine/balance.ts'
import { findMon, replaceMon } from './runtime.ts'
import { shiftMissionTimestamps } from './missionFlow.ts'

/**
 * Aplica o Paralyze a um Pokémon atingido: -50% de Batalha pelo resto do dia (idempotente) e
 * congela o sprite na posição do impacto por 5s, deslocando a janela da perna em curso (a missão
 * demora 5s a mais). Reaplicar estende o congelamento por mais 5s. `pos` é a posição já computada
 * na detecção de acerto.
 */
export function applyParalyze(s: GameState, id: string, pos: MapPos, now: number): void {
  if (!s.today.paralyzedBattleIds.includes(id)) s.today.paralyzedBattleIds.push(id)

  // Missão em trânsito (ida/volta) com este Pokémon no time.
  const mission = s.missions.find(
    (m) => m.teamIds.includes(id) && (m.status === 'traveling' || m.status === 'returning'),
  )
  if (mission) {
    const active = mission.paralyzeHold && now < mission.paralyzeHold.untilMs
    const untilMs = (active ? mission.paralyzeHold!.untilMs : now) + PARALYZE_STUN_MS
    mission.paralyzeHold = { pos: { ...pos }, untilMs }
    shiftMissionTimestamps(mission, mission.status === 'traveling' ? 'out' : 'back', PARALYZE_STUN_MS, true)
    return
  }
  // Procurador de captura a caminho.
  const search = s.captureSearches.find((c) => c.searcherId === id && c.phase === 'traveling')
  if (search) {
    const active = search.paralyzeHold && now < search.paralyzeHold.untilMs
    const untilMs = (active ? search.paralyzeHold!.untilMs : now) + PARALYZE_STUN_MS
    search.paralyzeHold = { pos: { ...pos }, untilMs }
    search.arriveAtMs += PARALYZE_STUN_MS
    search.readyAtMs += PARALYZE_STUN_MS
    search.departAtMs += PARALYZE_STUN_MS
    return
  }
  // Procurador voltando ao ginásio.
  const ret = s.captureReturns.find((r) => r.searcherId === id)
  if (ret) {
    const active = ret.paralyzeHold && now < ret.paralyzeHold.untilMs
    const untilMs = (active ? ret.paralyzeHold!.untilMs : now) + PARALYZE_STUN_MS
    ret.paralyzeHold = { pos: { ...pos }, untilMs }
    ret.arriveAtMs += PARALYZE_STUN_MS
    ret.departAtMs += PARALYZE_STUN_MS
  }
}

/**
 * Processa os raios cujo impacto cai em (prevMs, nowMs]: para cada Pokémon VISÍVEL no mapa dentro
 * de algum círculo, reduz 1 de HP (preservando o status de trânsito — o desmaio é realizado no
 * settle normal da missão) e aplica Paralyze.
 */
export function processStorms(s: GameState, prevMs: number, nowMs: number): void {
  if (s.weather.storms.length === 0) return
  for (const strike of strikesResolvingBetween(s.weather.storms, prevMs, nowMs)) {
    const positions = travelerPositionsAt(s, strike.strikeAtMs)
    const hit = new Set<string>()
    for (const { id, pos } of positions) {
      if (hit.has(id)) continue
      if (strike.circles.some((c) => pointInCircle(c, pos))) hit.add(id)
    }
    for (const id of hit) {
      const mon = findMon(s, id)
      if (!mon) continue
      const pos = positions.find((t) => t.id === id)!.pos
      // Reduz HP SEM virar fainted aqui (preserva 'traveling'/'returning'); settle normal cuida.
      replaceMon(s, { ...mon, currentHp: Math.max(0, mon.currentHp - STRIKE_DAMAGE) })
      applyParalyze(s, id, pos, strike.strikeAtMs)
    }
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/game/stormFlow.test.ts`
Expected: PASS.

- [ ] **Step 6: Ligar `processStorms` no `dayClock`**

Em `src/game/dayClock.ts`:
- Adicionar o import: `import { processStorms } from './stormFlow.ts'`.
- Em `tick`, capturar `prevMs` ANTES de avançar o relógio e chamar `processStorms` após `processSearches` e o `checkTeamWipeout` (e antes do fechamento do dia):

```ts
export function tick(s: GameState, deltaMs: number): void {
  if (s.run.phase !== 'DAY') return
  const prevMs = s.clock.dayElapsedMs
  const now = s.clock.dayElapsedMs + Math.max(0, deltaMs)
  s.clock.dayElapsedMs = now
  const overtime = now >= s.clock.dayLengthMs

  processMissions(s, now, overtime)
  processDefenses(s, now, overtime)
  if (s.run.phase !== 'DAY') return
  processSearches(s, now)

  processStorms(s, prevMs, now)

  checkTeamWipeout(s)
  if (s.run.phase !== 'DAY') return

  if (overtime && dayComplete(s)) finalizeDay(s)
}
```

> `processStorms` reduz HP; o `checkTeamWipeout` logo abaixo usa `isFainted` (baseado em HP ≤ 0), então um wipe causado por raios também encerra a run corretamente.

- [ ] **Step 7: Rodar a suíte de orquestração e o type-check**

Run: `npx vitest run src/game` e `npx tsc --noEmit`
Expected: PASS / sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/game/stormFlow.ts src/game/stormFlow.test.ts src/game/dayClock.ts src/game/missionFlow.ts
git commit -m "feat: raios aplicam dano + Paralyze no tick do dia (processStorms)"
```

---

### Task 8: Setup do dia + previsão da manhã + migração de save

**Files:**
- Modify: `src/game/setup.ts` (usar `buildDayWeather`)
- Modify: `src/components/screens/DayForecastPanel.tsx` (usar `buildDayWeather` + chance de tempestade)
- Modify: `src/persistence/saveLoad.ts` (migração v32 → v33)
- Test: `src/game/cloudNineSetup.test.ts` (ajustar se comparar weather) e `src/persistence/saveLoad.test.ts` (adicionar caso v32→v33)

**Interfaces:**
- Consumes: `buildDayWeather` (Task 4); `emptyWeatherSchedule` (existente).
- Produces: `s.weather` agora inclui `storms` após `setupDay` em cidades com tempestade.

- [ ] **Step 1: Trocar `buildWeatherSchedule` por `buildDayWeather` no setup**

Em `src/game/setup.ts`:
- Trocar o import `import { buildWeatherSchedule } from '../engine/weather.ts'` por `import { buildDayWeather } from '../engine/storm.ts'`.
- Em `setupDay`, substituir a chamada:

```ts
  s.weather = buildDayWeather(
    s.run.seed,
    s.run.day,
    city,
    cloudNine * CLOUD_NINE_RAIN_CHANCE_BONUS_PP,
  )
```

- [ ] **Step 2: Atualizar a previsão da manhã**

Em `src/components/screens/DayForecastPanel.tsx`:
- Trocar o import de `buildWeatherSchedule` para `buildDayWeather` (de `../../engine/storm.ts`); manter `rainAtLeastOnceChance` (de `weather.ts`).
- Trocar a chamada que monta `forecast` para `buildDayWeather(...)` (mesmos argumentos).
- Estender os mapas de ícone/nome e renderizar a tempestade quando houver chance:

```ts
const EFFECT_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️', storm: '⛈️' }
const EFFECT_NAME: Record<WeatherEffectKind, string> = { rain: 'Chuva', storm: 'Tempestade' }
```

Calcular a chance combinada de tempestade (espelha a chuva) e renderizar o efeito 'storm' no `.map(effect => ...)` com `stormChance`:

```ts
  const stormChance = rainAtLeastOnceChance(forecast.stormChancePercent, forecast.potentialStormCount)
```

No bloco que percorre `weather.effects`, adicionar o ramo para `'storm'` (espelhando o de `'rain'`, usando `stormChance` e os ícones/nomes de tempestade). A condição de "tempo firme" passa a considerar `rainChance > 0 || stormChance > 0`.

- [ ] **Step 3: Escrever o teste de migração v32 → v33**

Adicionar a `src/persistence/saveLoad.test.ts` um caso que carrega um save v32 sem `storms`/`paralyzedBattleIds` e confirma que o load preenche os defaults:

```ts
it('migra v32 → v33: adiciona storms, previsão de tempestade e paralyzedBattleIds', () => {
  const v32 = {
    version: 32,
    savedAtMs: 0,
    state: {
      // estado mínimo válido o suficiente para a migração (reusar um factory de teste do arquivo)
      ...minimalV32State(),
      weather: { rain: [], forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0 } },
      today: { ...minimalToday() }, // sem paralyzedBattleIds
    },
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(v32))
  const loaded = loadGame()
  expect(loaded).not.toBeNull()
  expect(loaded!.weather.storms).toEqual([])
  expect(loaded!.weather.forecast.stormChancePercent).toBe(0)
  expect(loaded!.today.paralyzedBattleIds).toEqual([])
})
```

> Reaproveitar os factories/helpers de estado já usados no arquivo de teste de saveLoad. Se o teste existente carrega um save "atual" e o reescreve, basta espelhar esse padrão para a versão 32.

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run src/persistence/saveLoad.test.ts`
Expected: FAIL — sem a migração, `storms`/`paralyzedBattleIds` ficam ausentes.

- [ ] **Step 5: Implementar a migração v32 → v33**

Em `src/persistence/saveLoad.ts`, antes da linha `if (version !== SAVE_VERSION) return null`, adicionar:

```ts
  // v32 → v33: efeito Tempestade. weather ganha storms + previsão de tempestade; today ganha
  // paralyzedBattleIds; missões/buscas ganham paralyzeHold opcional (ausente = sem paralisia).
  // Tudo é recalculado no próximo setupDay; aqui só garante a estrutura para saves no meio do dia.
  if (version === 32) {
    const weather = state.weather as Record<string, unknown> | undefined
    const forecast = (weather?.forecast as Record<string, unknown> | undefined) ?? {}
    const today = state.today as Record<string, unknown> | undefined
    state = {
      ...state,
      weather:
        weather && typeof weather === 'object'
          ? {
              ...weather,
              storms: Array.isArray(weather.storms) ? weather.storms : [],
              forecast: { stormChancePercent: 0, potentialStormCount: 0, ...forecast },
            }
          : weather,
      today: today && typeof today === 'object' ? { paralyzedBattleIds: [], ...today } : today,
    } as typeof state
    version = 33
  }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/persistence/saveLoad.test.ts`
Expected: PASS.

- [ ] **Step 7: Rodar a suíte inteira + type-check**

Run: `npx vitest run` e `npx tsc --noEmit`
Expected: PASS / sem erros. (Se `cloudNineSetup.test.ts` comparar `s.weather` por igualdade total, ajustar o esperado para incluir `storms` e os campos de previsão.)

- [ ] **Step 8: Commit**

```bash
git add src/game/setup.ts src/components/screens/DayForecastPanel.tsx src/persistence/saveLoad.ts src/persistence/saveLoad.test.ts
git commit -m "feat: setupDay/previsão usam buildDayWeather + migração de save v33"
```

---

### Task 9: UI — overlay dos raios, selo de tempestade, sprite congelado

**Files:**
- Modify: `src/components/day/CityMap.tsx` (StormOverlay + sprite congelado)
- Modify: `src/components/day/CityMap.module.css` (estilos dos círculos + paralisia)
- Modify: `src/components/day/WeatherBadge.tsx` (ícone/label de 'storm')
- Modify: `src/components/day/DayScreen.tsx` (renderizar o selo de tempestade)
- Modify: `src/components/PokemonCard/PokemonCard.tsx` (selo ⚡ de paralisado — opcional, ver passo)

**Interfaces:**
- Consumes: `activeStrikeCirclesAt`, `isStorming` (de `storm.ts`); `MAP_ASPECT_W` (para dimensionar o círculo em %); `state.today.paralyzedBattleIds`.
- Produces: efeito visual dos raios e do status (sem novas exportações de engine).

- [ ] **Step 1: Adicionar `WeatherEffectKind` 'storm' no badge**

Em `src/components/day/WeatherBadge.tsx`, estender os mapas:

```ts
const WEATHER_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️', storm: '⛈️' }
const WEATHER_LABEL: Record<WeatherEffectKind, string> = { rain: 'Chovendo', storm: 'Tempestade' }
```

(O componente já indexa por `kind`; nenhuma outra mudança é necessária.)

- [ ] **Step 2: Renderizar o selo de tempestade no DayScreen**

Em `src/components/day/DayScreen.tsx`, adicionar o import `import { isStorming } from '../../engine/storm.ts'` e, ao lado do bloco do selo de chuva, renderizar também o de tempestade (ambos podem aparecer juntos):

```tsx
        {isStorming(state.weather.storms, state.clock.dayElapsedMs) && (
          <div className={styles.weatherFloatStorm}>
            <WeatherBadge kind="storm" />
          </div>
        )}
```

> Se `styles.weatherFloatStorm` não existir, reusar `styles.weatherFloat` com um pequeno deslocamento, ou empilhar os dois selos no mesmo container. Decisão visual: empilhar verticalmente os selos ativos no `weatherFloat`.

- [ ] **Step 3: Implementar o `StormOverlay` no CityMap**

Em `src/components/day/CityMap.tsx`:
- Importar: `import { activeStrikeCirclesAt } from '../../engine/storm.ts'` e `import { MAP_ASPECT_W } from '../../engine/constants.ts'`.
- Renderizar o overlay logo após o `<PuddleOverlay .../>`:

```tsx
        <StormOverlay strikes={activeStrikeCirclesAt(state.weather.storms, now)} />
```

- Adicionar o componente (perto de `PuddleOverlay`):

```tsx
/** Círculos dos raios: vermelho pulsante no aviso (5s), amarelo no impacto. Diâmetro = 2·raio. */
function StormOverlay({
  strikes,
}: {
  strikes: { phase: 'warning' | 'striking'; circles: { cx: number; cy: number; radius: number }[] }[]
}) {
  return (
    <>
      {strikes.flatMap((s, i) =>
        s.circles.map((c, j) => {
          // raio é fração da largura; em % da largura o diâmetro é 2·raio·100. A altura usa o
          // mesmo valor em px (círculo real), então convertemos via aspecto no width/height.
          const widthPct = c.radius * 2 * 100
          return (
            <div
              key={`strike-${i}-${j}`}
              className={`${styles.strike} ${s.phase === 'warning' ? styles.strikeWarn : styles.strikeHit}`}
              style={{
                left: `${c.cx * 100}%`,
                top: `${c.cy * 100}%`,
                width: `${widthPct}%`,
                aspectRatio: '1 / 1',
              }}
              aria-hidden="true"
            />
          )
        }),
      )}
    </>
  )
}
```

> O `aspect-ratio: 1/1` mantém o elemento circular em px (o palco é 16:9, e `width` em % da largura define o diâmetro). O `MAP_ASPECT_W` fica disponível caso seja preciso afinar a conversão; comece com `aspect-ratio`.

- [ ] **Step 4: Estilos do overlay e da paralisia**

Em `src/components/day/CityMap.module.css`, adicionar (espelhando `.puddle`, que é posicionado absoluto e centralizado):

```css
.strike {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 5;
}
.strikeWarn {
  border: 2px solid rgba(220, 40, 40, 0.9);
  background: rgba(220, 40, 40, 0.18);
  animation: strikePulse 0.6s ease-in-out infinite;
}
.strikeHit {
  border: 3px solid rgba(245, 215, 60, 1);
  background: rgba(245, 215, 60, 0.35);
  animation: strikeFlash 0.6s ease-out forwards;
}
@keyframes strikePulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
@keyframes strikeFlash {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(0.6); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
}
/* Sprite paralisado: leve tremor + tom elétrico. */
.paralyzed {
  animation: paralyzeShake 0.18s linear infinite;
  filter: drop-shadow(0 0 3px rgba(245, 215, 60, 0.9));
}
@keyframes paralyzeShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
}
```

- [ ] **Step 5: Sprite congelado/paralisado no `TravelerGroup`**

Em `CityMap.tsx`, marcar visualmente os grupos que estão com `paralyzeHold` ativo. No `MapTravelers`, ao montar cada `TravelerGroup` de missão, derivar `paralyzed`:

```tsx
        const paralyzed = !!m.paralyzeHold && now < m.paralyzeHold.untilMs
        return (
          <TravelerGroup
            key={`m-${m.id}`}
            pos={pos}
            ids={m.teamIds}
            roster={state.roster}
            speedy={speedy}
            flying={m.flying}
            surfing={m.surfing}
            paralyzed={paralyzed}
          />
        )
```

Adicionar a prop `paralyzed?: boolean` ao `TravelerGroup` e aplicar a classe no container:

```tsx
    <div
      className={`${styles.travelers} ${speedy ? styles.speedy : ''} ${flying ? styles.flying : ''} ${surfing ? styles.surfing : ''} ${paralyzed ? styles.paralyzed : ''}`}
      style={posStyle(pos)}
    >
```

Fazer o mesmo (derivar `paralyzed` de `c.paralyzeHold`/`r.paralyzeHold`) para os grupos de busca e retorno de captura.

- [ ] **Step 6: (Opcional) Selo ⚡ de paralisado no card**

Em `src/components/PokemonCard/PokemonCard.tsx`, se o card recebe a informação de "paralisado hoje" (via prop), exibir um pequeno ⚡. Se o card NÃO tem acesso a `paralyzedBattleIds`, **pular este passo** (o feedback no mapa já cobre o MVP) e registrar a pendência no resumo final. Não inventar fluxo de props novo aqui sem necessidade.

- [ ] **Step 7: Verificação no preview (apenas DOM/console, sem screenshot)**

Conforme a preferência registrada (verificação econômica), validar via DOM/console:
- `preview_start` (se ainda não rodando), depois `preview_console_logs` e `preview_logs` para garantir ausência de erros de runtime.
- `preview_snapshot` para confirmar que o DayScreen renderiza (não é necessário screenshot).

> Só rodar o preview se a engine estiver compilando e os testes passando. Não pedir validação manual ao usuário.

- [ ] **Step 8: Type-check + suíte completa**

Run: `npx tsc --noEmit` e `npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 9: Commit**

```bash
git add src/components/day/CityMap.tsx src/components/day/CityMap.module.css src/components/day/WeatherBadge.tsx src/components/day/DayScreen.tsx src/components/PokemonCard/PokemonCard.tsx
git commit -m "feat: UI da Tempestade — overlay dos raios, selo e sprite paralisado"
```

---

## Notas de implementação

- **Dependência de módulos:** `storm.ts` depende de `weather.ts` (tipos, `puddleLevelAt`, `WEATHER_FIRST_ELIGIBLE_DAY`, `maxRainTimes`, `buildWeatherSchedule`). `weather.ts` usa apenas `import type { StormEvent }` de `storm.ts` (apagado em runtime — sem ciclo de runtime). A composição (`buildDayWeather`) vive em `storm.ts`, e os chamadores (`setup.ts`, `DayForecastPanel.tsx`) passam a chamá-la.
- **Faint em trânsito:** os raios reduzem HP preservando o status de viagem; o desmaio é realizado no `settle` normal da missão/volta (`settleFaintTracked`), que já manda ao Centro e conta em `today.faints`. O `checkTeamWipeout` (HP-based) ainda encerra a run se os raios zerarem todo mundo.
- **Determinismo:** `buildStorms` usa um RNG próprio (`STORM_SEED_SALT`) — não toca o cursor da run (missões/captura/defesa intactas).

## Self-Review

- **Cobertura do spec:** §1 dados/estado → Tasks 1, 5; §2 constantes → Task 1; §3 storm.ts (agenda+geometria+derivações) → Tasks 2–4; §4 travelerPositions → Task 5; §5 stormFlow/dayClock/applyParalyze → Task 7; §6 gymDefense -50% → Task 6; §7 UI → Task 9; §8 saveLoad → Task 8. Acoplamento chuva→tempestade e Vermilion com chuva → Tasks 1 e 4. Previsão da manhã → Task 8.
- **Placeholders:** os passos de teste do `stormFlow` (Task 7) e da migração (Task 8) descrevem helpers de montagem de estado em vez de código 100% literal porque dependem de factories já existentes nos respectivos arquivos de teste; o executor deve reaproveitá-los (indicado em nota). Todo o código de produção está completo.
- **Consistência de tipos:** `StormEvent`/`Strike`/`StrikeCircle` definidos na Task 2 e usados nas Tasks 3,4,7,9; `paralyzeHold`/`paralyzedBattleIds` definidos na Task 5 e consumidos nas Tasks 6,7,9; `buildDayWeather`/`activeStrikeCirclesAt`/`strikesResolvingBetween` definidos na Task 4 e consumidos nas Tasks 7,8,9; `shiftMissionTimestamps` exportada na Task 7. `pointInCircle` (Task 2) usado na Task 7.
