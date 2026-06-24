# Snowstorm + Sandstorm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new weather effects — Snowstorm (per-team accumulating slowdown → freeze → damage/fly-death) and Sandstorm (random-waypoint detour routing) — to the four currently weatherless cities (Fuchsia, Saffron, Cinnabar, Viridian).

**Architecture:** Each effect is, in the pre-computed `WeatherSchedule`, just a list of windows `{ startMs, endMs }` (like Heat). All behavior lives in the day tick: `game/snowFlow.ts::processSnow` mirrors `stormFlow.ts::processStorms` (per-container state mutation, position-dependent); `game/sandFlow.ts::applySandDetour` reuses the existing `reroutePath` detour mechanism. Snow and sand are orthogonal — sand picks the path, snow slows/freezes along it.

**Tech Stack:** TypeScript (strict), Vitest, React. Pure deterministic engine (seeded RNG via `deriveSeed`/`createRng`), runtime mutation in `game/*Flow.ts`.

## Global Constraints

- Determinism: schedules seeded by `deriveSeed(seed, day, SALT)` with **isolated salts** — never touch the run RNG cursor. Copy the pattern from `engine/heat.ts` / `engine/storm.ts`.
- Weather starts day 3 (`WEATHER_FIRST_ELIGIBLE_DAY`); days 1–2 never have weather.
- Build check: `npm run build` (tsc -b). Do NOT use `tsc --noEmit` (root tsconfig is solution-only).
- Tests: `npm test` (Vitest). TDD — write failing test first.
- Effect kinds added: `'snowstorm' | 'sandstorm'`. Cities: Fuchsia=4, Saffron=5, Cinnabar=6, Viridian=7. Pewter=0 stays weatherless.
- Exact tuning (chance `{pisoBase,pisoPorDia,teto}`): Fuchsia rain `{20,1,50}`/sand `{15,1,45}`/heat `{12,1,35}`; Saffron snow `{25,1,60}`/rain `{12,1,40}`/storm `{8,1,30}`; Cinnabar heat `{30,1,65}`/storm `{12,1,40}`/sand `{10,1,35}`; Viridian sand `{25,1,60}`/rain `{12,1,40}`/storm `{8,1,30}`/snow `{8,1,28}`.
- Mechanics: stack interval 2000ms, slow per stack ×0.8 (compound), max 5 stacks, freeze at 5th, freeze damage 1 HP / 2000ms, thaw 2000ms after window ends, reset stacks on leg arrival. Snowstorm window 40000–70000ms; sandstorm window 30000–60000ms; both gap 4000ms. Quantity/day = `maxRainTimes(day)`.
- Budget order (Own Tempo `maxWeatherEvents`): rain → storm → heat → snowstorm → sandstorm.
- Scope of both effects: missions (out/back) + capture searches + capture returns. Snowstorm flying container dies on freeze; ground members can faint but survivors continue. Clear Body = full snow immunity.

---

### Task 1: Constants, salts, save version

**Files:**
- Modify: `src/engine/balance.ts` (append near `HEAT_*` constants, ~line 376)
- Modify: `src/engine/constants.ts` (salts near line 92; `SAVE_VERSION` line 241)

**Interfaces:**
- Produces: `SNOW_EVENT_MIN_MS=40_000`, `SNOW_EVENT_MAX_MS=70_000`, `SNOW_GAP_MS=4_000`, `SAND_EVENT_MIN_MS=30_000`, `SAND_EVENT_MAX_MS=60_000`, `SAND_GAP_MS=4_000`, `SNOW_STACK_INTERVAL_MS=2_000`, `SNOW_SLOW_PER_STACK=0.8`, `SNOW_MAX_STACKS=5`, `SNOW_FREEZE_DAMAGE=1`, `SNOW_FREEZE_DAMAGE_INTERVAL_MS=2_000`, `SNOW_THAW_MS=2_000` (balance.ts); `SNOW_SEED_SALT`, `SNOW_CHANCE_SALT`, `SAND_SEED_SALT`, `SAND_CHANCE_SALT` (constants.ts); `SAVE_VERSION = 39`.

- [ ] **Step 1: Add balance constants.** In `src/engine/balance.ts`, after the heat block:

```ts
// ---- Snowstorm (nevasca) ----
export const SNOW_EVENT_MIN_MS = 40_000
export const SNOW_EVENT_MAX_MS = 70_000
export const SNOW_GAP_MS = 4_000
/** A cada 2s viajando sob nevasca, +1 stack. */
export const SNOW_STACK_INTERVAL_MS = 2_000
/** Velocidade = SNOW_SLOW_PER_STACK^stacks (composto). */
export const SNOW_SLOW_PER_STACK = 0.8
/** No 5º stack o time congela. */
export const SNOW_MAX_STACKS = 5
/** Dano por tique de congelamento (não-voador). */
export const SNOW_FREEZE_DAMAGE = 1
export const SNOW_FREEZE_DAMAGE_INTERVAL_MS = 2_000
/** Descongela este tempo após a janela de nevasca acabar. */
export const SNOW_THAW_MS = 2_000

// ---- Sandstorm (tempestade de areia) ----
export const SAND_EVENT_MIN_MS = 30_000
export const SAND_EVENT_MAX_MS = 60_000
export const SAND_GAP_MS = 4_000
```

- [ ] **Step 2: Add salts + bump version.** In `src/engine/constants.ts`, after `HEAT_CHANCE_SALT`:

```ts
export const SNOW_SEED_SALT = 0x536e6f77 // 'Snow'
export const SNOW_CHANCE_SALT = 0x4e436863 // 'NChc'
export const SAND_SEED_SALT = 0x53616e64 // 'Sand'
export const SAND_CHANCE_SALT = 0x44436863 // 'DChc'
```
And change `export const SAVE_VERSION = 38` → `39`.

- [ ] **Step 3: Verify build.** Run: `npm run build` — Expected: PASS (no usages yet, just new exports).

- [ ] **Step 4: Commit.**

```bash
git add src/engine/balance.ts src/engine/constants.ts
git commit -m "feat(clima): constantes e salts de snowstorm/sandstorm + SAVE_VERSION 39"
```

---

### Task 2: City weather config

**Files:**
- Modify: `src/data/cityWeather.ts`
- Test: `src/data/cityWeather.test.ts`

**Interfaces:**
- Consumes: `WeatherChanceFormula`.
- Produces: `WeatherEffectKind` includes `'snowstorm' | 'sandstorm'`; `SnowstormEffectConfig`, `SandstormEffectConfig`; helpers `cityHasSnow(i): boolean`, `citySnowChance(i): WeatherChanceFormula | null`, `cityHasSand(i): boolean`, `citySandChance(i): WeatherChanceFormula | null`; `CITY_WEATHER` entries for indices 4–7.

- [ ] **Step 1: Write failing tests.** Append to `src/data/cityWeather.test.ts`:

```ts
import { cityHasSnow, citySnowChance, cityHasSand, citySandChance, getCityWeather } from './cityWeather.ts'

describe('cidades novas com clima', () => {
  it('Saffron(5): snowstorm dominante, depois chuva e tempestade', () => {
    const kinds = getCityWeather(5)!.effects.map((e) => e.kind)
    expect(kinds).toEqual(['snowstorm', 'rain', 'storm'])
    expect(citySnowChance(5)).toEqual({ pisoBase: 25, pisoPorDia: 1, teto: 60 })
  })
  it('Viridian(7): sandstorm dominante + chuva/tempestade/snowstorm', () => {
    const kinds = getCityWeather(7)!.effects.map((e) => e.kind)
    expect(kinds).toEqual(['sandstorm', 'rain', 'storm', 'snowstorm'])
    expect(cityHasSnow(7)).toBe(true)
    expect(cityHasSand(7)).toBe(true)
    expect(citySandChance(7)).toEqual({ pisoBase: 25, pisoPorDia: 1, teto: 60 })
  })
  it('Fuchsia(4) tem sandstorm; Cinnabar(6) tem sandstorm; Pewter(0) sem clima', () => {
    expect(cityHasSand(4)).toBe(true)
    expect(cityHasSand(6)).toBe(true)
    expect(getCityWeather(0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- cityWeather` — Expected: FAIL (helpers/configs missing).

- [ ] **Step 3: Implement.** In `src/data/cityWeather.ts`:
  - Extend `WeatherEffectKind`: `'rain' | 'storm' | 'heat' | 'snowstorm' | 'sandstorm'`.
  - Add configs + union members:

```ts
export interface SnowstormEffectConfig { kind: 'snowstorm'; chance: WeatherChanceFormula }
export interface SandstormEffectConfig { kind: 'sandstorm'; chance: WeatherChanceFormula }
export type WeatherEffectConfig =
  | RainEffectConfig | StormEffectConfig | HeatEffectConfig
  | SnowstormEffectConfig | SandstormEffectConfig
```
  - Add `CITY_WEATHER` entries (verbatim tuning from Global Constraints):

```ts
  4: { effects: [
    { kind: 'rain', chance: { pisoBase: 20, pisoPorDia: 1, teto: 50 } },
    { kind: 'sandstorm', chance: { pisoBase: 15, pisoPorDia: 1, teto: 45 } },
    { kind: 'heat', chance: { pisoBase: 12, pisoPorDia: 1, teto: 35 } },
  ] },
  5: { effects: [
    { kind: 'snowstorm', chance: { pisoBase: 25, pisoPorDia: 1, teto: 60 } },
    { kind: 'rain', chance: { pisoBase: 12, pisoPorDia: 1, teto: 40 } },
    { kind: 'storm', chance: { pisoBase: 8, pisoPorDia: 1, teto: 30 } },
  ] },
  6: { effects: [
    { kind: 'heat', chance: { pisoBase: 30, pisoPorDia: 1, teto: 65 } },
    { kind: 'storm', chance: { pisoBase: 12, pisoPorDia: 1, teto: 40 } },
    { kind: 'sandstorm', chance: { pisoBase: 10, pisoPorDia: 1, teto: 35 } },
  ] },
  7: { effects: [
    { kind: 'sandstorm', chance: { pisoBase: 25, pisoPorDia: 1, teto: 60 } },
    { kind: 'rain', chance: { pisoBase: 12, pisoPorDia: 1, teto: 40 } },
    { kind: 'storm', chance: { pisoBase: 8, pisoPorDia: 1, teto: 30 } },
    { kind: 'snowstorm', chance: { pisoBase: 8, pisoPorDia: 1, teto: 28 } },
  ] },
```
  - Add helpers mirroring `cityHasHeat`/`cityHeatChance`:

```ts
export function cityHasSnow(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'snowstorm') ?? false
}
export function citySnowChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'snowstorm')
  return e ? e.chance : null
}
export function cityHasSand(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'sandstorm') ?? false
}
export function citySandChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'sandstorm')
  return e ? e.chance : null
}
```

- [ ] **Step 4: Run tests.** Run: `npm test -- cityWeather` — Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/data/cityWeather.ts src/data/cityWeather.test.ts
git commit -m "feat(clima): config de snowstorm/sandstorm em Fuchsia/Saffron/Cinnabar/Viridian"
```

---

### Task 3: Snow schedule engine (`engine/snow.ts`)

**Files:**
- Create: `src/engine/snow.ts`
- Test: `src/engine/snow.test.ts`
- Modify: `src/engine/weather.ts` (export `SnowEvent` type — see Task 5; for now declare locally and re-export)

**Interfaces:**
- Consumes: `weatherChanceForDay`, `maxRainTimes`, `WEATHER_FIRST_ELIGIBLE_DAY` (from `weather.ts`); `createRng`, `deriveSeed`; `DAY_LENGTH_MS`, `SNOW_SEED_SALT`, `SNOW_CHANCE_SALT`; `SNOW_EVENT_MIN_MS/MAX_MS/GAP_MS`; `cityHasSnow`, `citySnowChance`.
- Produces: `interface SnowEvent { startMs: number; endMs: number }`; `maxSnowTimes(day): number`; `snowChanceForDay(seed,day,cityIndex): number`; `buildSnow(seed,day,city,extraChancePercent?,maxEvents?): SnowEvent[]`; `activeSnowAt(events,now): SnowEvent | null`; `isSnowing(events,now): boolean`; `snowExposureMs(events,fromMs,toMs): number`; `snowWindowEndAt(events,now): number | null`.

- [ ] **Step 1: Write failing tests.** Create `src/engine/snow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getCity } from '../data/cities.ts'
import { buildSnow, isSnowing, snowExposureMs, snowChanceForDay, maxSnowTimes, snowWindowEndAt } from './snow.ts'

describe('snow schedule', () => {
  it('chance bate com a fórmula de Saffron {25,1,60}', () => {
    const c = snowChanceForDay(123, 5, 5)
    expect(c).toBeGreaterThanOrEqual(30) // piso dia5 = 30
    expect(c).toBeLessThanOrEqual(60)
  })
  it('maxSnowTimes = curva da chuva', () => {
    expect(maxSnowTimes(3)).toBe(1)
    expect(maxSnowTimes(30)).toBe(6)
  })
  it('é determinístico e gera janelas não-sobrepostas', () => {
    const city = getCity(5)
    const a = buildSnow(7, 9, city)
    const b = buildSnow(7, 9, city)
    expect(a).toEqual(b)
    for (let i = 1; i < a.length; i++) expect(a[i]!.startMs).toBeGreaterThanOrEqual(a[i - 1]!.endMs)
  })
  it('snowExposureMs soma a interseção com as janelas (robusto a saltos)', () => {
    const events = [{ startMs: 1000, endMs: 3000 }, { startMs: 5000, endMs: 6000 }]
    expect(snowExposureMs(events, 0, 10000)).toBe(3000) // 2000 + 1000
    expect(snowExposureMs(events, 2000, 5500)).toBe(1500) // 1000 + 500
  })
  it('snowWindowEndAt devolve o fim da janela ativa, ou null', () => {
    const events = [{ startMs: 1000, endMs: 3000 }]
    expect(snowWindowEndAt(events, 2000)).toBe(3000)
    expect(snowWindowEndAt(events, 4000)).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- snow` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/engine/snow.ts`** (mirror `engine/heat.ts`, add exposure helpers):

```ts
// Núcleo PURO da nevasca (Snowstorm). A agenda é só janelas (como o Calor); toda a mecânica de
// stacks/freeze/dano vive no runtime (game/snowFlow.ts). Semeada por SNOW_SEED_SALT.
import type { CityData } from '../data/types.ts'
import { createRng, deriveSeed } from './rng.ts'
import { DAY_LENGTH_MS, SNOW_SEED_SALT, SNOW_CHANCE_SALT } from './constants.ts'
import { SNOW_EVENT_MIN_MS, SNOW_EVENT_MAX_MS, SNOW_GAP_MS } from './balance.ts'
import { clamp } from './math.ts'
import { weatherChanceForDay, maxRainTimes, WEATHER_FIRST_ELIGIBLE_DAY } from './weather.ts'
import { cityHasSnow, citySnowChance } from '../data/cityWeather.ts'

export interface SnowEvent { startMs: number; endMs: number }

export function maxSnowTimes(day: number): number { return maxRainTimes(day) }

export function snowChanceForDay(seed: number, day: number, cityIndex: number): number {
  const formula = citySnowChance(cityIndex)
  if (!formula) return 0
  return weatherChanceForDay(seed, day, formula, SNOW_CHANCE_SALT)
}

export function buildSnow(seed: number, day: number, city: CityData, extraChancePercent = 0, maxEvents?: number): SnowEvent[] {
  if (day < WEATHER_FIRST_ELIGIBLE_DAY || !cityHasSnow(city.index)) return []
  const hasCap = maxEvents !== undefined
  const chance = clamp(snowChanceForDay(seed, day, city.index) + extraChancePercent, 0, 100)
  const maxTimes = hasCap ? Math.min(maxSnowTimes(day), maxEvents!) : maxSnowTimes(day)
  const rng = createRng(deriveSeed(seed, day, SNOW_SEED_SALT))
  const events: SnowEvent[] = []
  let cursor = 0
  for (let i = 0; i < maxTimes; i++) {
    const remainingAfter = maxTimes - 1 - i
    const duration = rng.int(SNOW_EVENT_MIN_MS, SNOW_EVENT_MAX_MS)
    const reserve = remainingAfter * (SNOW_EVENT_MIN_MS + SNOW_GAP_MS)
    const latestStart = DAY_LENGTH_MS - duration - SNOW_GAP_MS - reserve
    if (latestStart < cursor) break
    const start = rng.int(cursor, latestStart)
    const end = start + duration
    if (rng.bool(chance / 100)) events.push({ startMs: start, endMs: end })
    cursor = end + SNOW_GAP_MS
  }
  return events
}

export function activeSnowAt(events: readonly SnowEvent[], now: number): SnowEvent | null {
  for (const e of events) if (now >= e.startMs && now < e.endMs) return e
  return null
}
export function isSnowing(events: readonly SnowEvent[], now: number): boolean {
  return activeSnowAt(events, now) !== null
}
/** Soma dos ms em (fromMs, toMs] que caem dentro de alguma janela. Robusto a saltos grandes. */
export function snowExposureMs(events: readonly SnowEvent[], fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0
  let total = 0
  for (const e of events) {
    const lo = Math.max(fromMs, e.startMs)
    const hi = Math.min(toMs, e.endMs)
    if (hi > lo) total += hi - lo
  }
  return total
}
/** Fim da janela ativa em `now`, ou null se não há nevasca ativa. */
export function snowWindowEndAt(events: readonly SnowEvent[], now: number): number | null {
  const e = activeSnowAt(events, now)
  return e ? e.endMs : null
}
```

- [ ] **Step 4: Run tests.** Run: `npm test -- snow` — Expected: PASS. (Note: `weather.ts` will import `SnowEvent` in Task 5; no circular issue since snow.ts imports only functions from weather.ts.)

- [ ] **Step 5: Commit.**

```bash
git add src/engine/snow.ts src/engine/snow.test.ts
git commit -m "feat(clima): schedule puro da nevasca (engine/snow.ts)"
```

---

### Task 4: Sand schedule engine (`engine/sand.ts`)

**Files:**
- Create: `src/engine/sand.ts`
- Test: `src/engine/sand.test.ts`

**Interfaces:**
- Consumes: same weather/rng/constants as Task 3 with `SAND_*`; `cityHasSand`, `citySandChance`; `shortestPath`, `graphWithTunnels` (pathfinding); `travelRoute` (missions) for reachability; `Rng` type; `CityGraph`, `CityData`; `Pokemon`.
- Produces: `interface SandEvent { startMs: number; endMs: number }`; `maxSandTimes(day)`; `sandChanceForDay(...)`; `buildSand(...)`; `activeSandAt`; `isSanding`; `pickLostNode(rng, graph, originNode, destNode, team, runItems): string | null` — a reachable node (`≠ origin`, `≠ dest`), or `null` if none.

- [ ] **Step 1: Write failing tests.** Create `src/engine/sand.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getCity } from '../data/cities.ts'
import { graphWithTunnels } from './pathfinding.ts'
import { buildSand, isSanding, pickLostNode, sandChanceForDay } from './sand.ts'
import { createRng } from './rng.ts'

describe('sand schedule', () => {
  it('chance bate com Viridian {25,1,60}', () => {
    const c = sandChanceForDay(1, 5, 7)
    expect(c).toBeGreaterThanOrEqual(30)
    expect(c).toBeLessThanOrEqual(60)
  })
  it('determinístico', () => {
    const city = getCity(7)
    expect(buildSand(3, 9, city)).toEqual(buildSand(3, 9, city))
  })
  it('pickLostNode devolve um nó alcançável, ≠ origem e ≠ destino', () => {
    const city = getCity(7)
    const graph = graphWithTunnels(city.graph, [])
    const gym = city.siteNodes.gym
    const dest = Object.keys(graph.nodes).find((n) => n !== gym)!
    const team = [{ /* terrestre, sem surf */ }] as never
    const node = pickLostNode(createRng(42), graph, gym, dest, team, [])
    expect(node).not.toBeNull()
    expect(node).not.toBe(gym)
    expect(node).not.toBe(dest)
  })
})
```

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- sand` — Expected: FAIL.

- [ ] **Step 3: Implement `src/engine/sand.ts`.** Schedule mirrors `buildSnow` with `SAND_*`/`SAND_CHANCE_SALT`/`cityHasSand`/`citySandChance`. Add `pickLostNode`:

```ts
import type { CityGraph } from '../data/types.ts'
import type { Pokemon } from '../types/index.ts'
import { shortestPath } from './pathfinding.ts'
import type { Rng } from './rng.ts'

/**
 * Sorteia um nó "perdido" alcançável do `originNode` por este time, ≠ origem e ≠ destino.
 * Alcançável = shortestPath(origin→node) não-vazio (respeita Surf via o grafo já filtrado pelo
 * chamador; se o time surfa, o chamador deve passar um grafo que inclui as arestas de água — ver
 * nota no game/sandFlow). Determinístico: usa o `rng` passado. null se não há candidato.
 */
export function pickLostNode(
  rng: Rng,
  graph: CityGraph,
  originNode: string,
  destNode: string,
  _team: readonly Pokemon[],
  _runItems: readonly string[],
): string | null {
  const candidates = Object.keys(graph.nodes).filter(
    (n) => n !== originNode && n !== destNode && shortestPath(graph, originNode, n).length > 0,
  )
  if (candidates.length === 0) return null
  return rng.pick(candidates)
}
```
  > **Reachability note for the implementer:** `shortestPath` over the plain city graph excludes water edges. For Surf teams the caller (sandFlow) builds the route with `travelRoute` which already handles Surf/Fly; `pickLostNode` only needs a *walkable* candidate set, so the plain-graph reachability check is the correct conservative filter (a lost waypoint must be somewhere the team can actually stand). Fly teams: caller still uses `pickLostNode` then routes straight lines between origin→lost→dest (see Task 10).

- [ ] **Step 4: Run tests.** Run: `npm test -- sand` — Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/sand.ts src/engine/sand.test.ts
git commit -m "feat(clima): schedule puro da areia + pickLostNode (engine/sand.ts)"
```

---

### Task 5: WeatherSchedule + forecast fields

**Files:**
- Modify: `src/engine/weather.ts` (import/re-export `SnowEvent`/`SandEvent`; extend `WeatherSchedule`, `WeatherForecast`, `emptyWeatherSchedule`)
- Test: covered by Task 6 build + existing weather tests

**Interfaces:**
- Produces: `WeatherSchedule` gains `snow: SnowEvent[]` and `sand: SandEvent[]`; `WeatherForecast` gains `snowstormChancePercent`, `potentialSnowstormCount`, `sandstormChancePercent`, `potentialSandstormCount`; `emptyWeatherSchedule()` returns them empty/zero.

- [ ] **Step 1: Implement.** In `src/engine/weather.ts`:
  - Add imports: `import type { SnowEvent } from './snow.ts'` and `import type { SandEvent } from './sand.ts'` (type-only avoids cycles). Re-export: `export type { SnowEvent } from './snow.ts'`, `export type { SandEvent } from './sand.ts'`.
  - In `WeatherSchedule` add `snow: SnowEvent[]` and `sand: SandEvent[]`.
  - In `WeatherForecast` add the four number fields.
  - In `emptyWeatherSchedule()` add `snow: []`, `sand: []`, and the four forecast fields `= 0`.

- [ ] **Step 2: Verify build.** Run: `npm run build` — Expected: FAIL only where `buildDayWeather`/forecast literals omit the new fields (fixed in Task 6) and any exhaustive switch on forecast. If `storm.ts` forecast object errors, that's expected — proceed to Task 6.

- [ ] **Step 3: Commit (after Task 6 makes build green).** Defer commit; bundle with Task 6.

---

### Task 6: Assemble snow/sand into `buildDayWeather` + setup deltas

**Files:**
- Modify: `src/engine/storm.ts` (`buildDayWeather` signature + body; imports)
- Modify: `src/game/setup.ts` (compute `snowDelta`/`sandDelta`, pass to `buildDayWeather`)
- Test: `src/engine/storm.test.ts` (extend), `src/game/weatherAbilitiesSetup.test.ts` (extend)

**Interfaces:**
- Consumes: `buildSnow`, `snowChanceForDay`, `maxSnowTimes`, `cityHasSnow`; `buildSand`, `sandChanceForDay`, `maxSandTimes`, `cityHasSand`.
- Produces: `buildDayWeather(seed, day, city, extraRainChancePercent=0, extraStormChancePercent=0, extraHeatChancePercent=0, extraSnowChancePercent=0, extraSandChancePercent=0, maxWeatherEvents=0): WeatherSchedule` (two new params appended **before** `maxWeatherEvents`).

- [ ] **Step 1: Write failing test.** In `src/engine/storm.test.ts`:

```ts
it('buildDayWeather inclui snow/sand em Viridian e preenche a previsão', () => {
  const city = getCity(7)
  const w = buildDayWeather(99, 12, city)
  expect(Array.isArray(w.snow)).toBe(true)
  expect(Array.isArray(w.sand)).toBe(true)
  expect(w.forecast.sandstormChancePercent).toBeGreaterThan(0)
  expect(w.forecast.potentialSnowstormCount).toBe(maxSnowTimes(12))
})
it('orçamento Own Tempo: snow/sand entram após rain/storm/heat', () => {
  const city = getCity(7)
  const w = buildDayWeather(99, 30, city, 100, 100, 100, 100, 100, 2) // força ocorrência, cap 2
  const total = w.rain.length + w.storms.length + w.heat.length + w.snow.length + w.sand.length
  expect(total).toBeLessThanOrEqual(2)
})
```
Add imports for `getCity`, `maxSnowTimes` to the test.

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- storm` — Expected: FAIL.

- [ ] **Step 3: Implement in `storm.ts`.** Update signature and append, after the heat block in `buildDayWeather` (mirror the heat budget pattern):

```ts
import { buildSnow, snowChanceForDay, maxSnowTimes } from './snow.ts'
import { buildSand, sandChanceForDay, maxSandTimes } from './sand.ts'
import { cityHasSnow, cityHasSand } from '../data/cityWeather.ts'
// ... inside buildDayWeather, `result` being the schedule so far (after heat):
let withSnow = withHeatOrStorm // whatever the prior accumulator var is
if (cityHasSnow(city.index)) {
  const snowCap: number | undefined =
    maxWeatherEvents > 0 ? Math.max(0, maxWeatherEvents - withSnow.rain.length - withSnow.storms.length - withSnow.heat.length) : undefined
  const snow = buildSnow(seed, day, city, extraSnowChancePercent, snowCap)
  withSnow = { ...withSnow, snow, forecast: { ...withSnow.forecast,
    snowstormChancePercent: clamp(snowChanceForDay(seed, day, city.index) + extraSnowChancePercent, 0, 100),
    potentialSnowstormCount: maxSnowTimes(day) } }
}
let withSand = withSnow
if (cityHasSand(city.index)) {
  const sandCap: number | undefined =
    maxWeatherEvents > 0 ? Math.max(0, maxWeatherEvents - withSand.rain.length - withSand.storms.length - withSand.heat.length - withSand.snow.length) : undefined
  const sand = buildSand(seed, day, city, extraSandChancePercent, sandCap)
  withSand = { ...withSand, sand, forecast: { ...withSand.forecast,
    sandstormChancePercent: clamp(sandChanceForDay(seed, day, city.index) + extraSandChancePercent, 0, 100),
    potentialSandstormCount: maxSandTimes(day) } }
}
return withSand
```
  > Adjust the accumulator variable names to match the existing `buildDayWeather` (currently returns `withStorm` then the heat block returns a new object). Ensure the heat branch's early `return withStorm` (when no heat) is replaced so snow/sand still run — restructure to a single linear accumulator that always reaches the snow/sand blocks. Also ensure `emptyWeatherSchedule`-shaped forecast defaults exist when a city lacks an effect.

- [ ] **Step 4: Implement in `setup.ts`.** Mirror `heatDelta`. Add `snowDelta`/`sandDelta` accumulators (same Cloud Nine "other" / Overcoat penalties as storm/heat):

```ts
let snowDelta = 0
let sandDelta = 0
// inside the roster loop, alongside heatDelta:
if (cnLevel === 2) { snowDelta -= CLOUD_NINE_OTHER_PP_L2; sandDelta -= CLOUD_NINE_OTHER_PP_L2 }
else if (cnLevel === 1) { snowDelta -= CLOUD_NINE_OTHER_PP_L1; sandDelta -= CLOUD_NINE_OTHER_PP_L1 }
if (ocLevel === 2) { snowDelta -= OVERCOAT_PP_L2; sandDelta -= OVERCOAT_PP_L2 }
else if (ocLevel === 1) { snowDelta -= OVERCOAT_PP_L1; sandDelta -= OVERCOAT_PP_L1 }
```
And pass them: `buildDayWeather(s.run.seed, s.run.day, city, rainDelta, stormDelta, heatDelta, snowDelta, sandDelta, ownTempoCap)`.

- [ ] **Step 5: Run build + tests.** Run: `npm run build` then `npm test -- storm weatherAbilitiesSetup` — Expected: PASS.

- [ ] **Step 6: Commit (bundles Task 5).**

```bash
git add src/engine/weather.ts src/engine/storm.ts src/engine/storm.test.ts src/game/setup.ts src/game/weatherAbilitiesSetup.test.ts
git commit -m "feat(clima): snow/sand no WeatherSchedule, buildDayWeather e setup (orçamento + deltas)"
```

---

### Task 7: Per-container state fields

**Files:**
- Modify: `src/engine/state.ts` (`MissionInstance`, `CaptureSearch`, `CaptureReturn`)
- Test: build only (fields are additive/optional)

**Interfaces:**
- Produces: on all three container interfaces:

```ts
/** Nevasca (Snowstorm): estado da perna atual; limpo ao chegar no destino e ao descongelar. */
snow?: { stacks: number; exposureMs: number; frozenAtMs?: number; lastDrainMs?: number; thawAtMs?: number }
/** Sandstorm: marca que reroutePath é um desvio de areia (para recálculo ao acabar). */
sandDetour?: { lostNode: string }
```

- [ ] **Step 1: Add the two optional fields** to `MissionInstance`, `CaptureSearch`, `CaptureReturn` (place near `reroutePath`/`paralyzeHold`).

- [ ] **Step 2: Verify build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/engine/state.ts
git commit -m "feat(clima): estado de nevasca/areia por container (snow, sandDetour)"
```

---

### Task 8: Extract shared container helpers (`game/containers.ts`)

**Files:**
- Create: `src/game/containers.ts`
- Modify: `src/game/stormFlow.ts` (import from new module; delete local copies)
- Test: `src/game/stormFlow.test.ts` must still pass (regression)

**Interfaces:**
- Produces: `containerTeamIds(s, id): string[]`; `isInFlyingContainer(s, id): boolean`; `killFlyingContainer(s, id): void` — moved verbatim from `stormFlow.ts` (they currently live there at lines ~135–198).

- [ ] **Step 1: Create `src/game/containers.ts`** and move the three functions verbatim (with their imports: `GameState`, `findMon`, `replaceMon`, `settleFaintTracked`). Keep behavior identical.

- [ ] **Step 2: Update `stormFlow.ts`** to `import { containerTeamIds, isInFlyingContainer, killFlyingContainer } from './containers.ts'` and remove the local definitions.

- [ ] **Step 3: Run regression.** Run: `npm test -- stormFlow` — Expected: PASS (unchanged behavior).

- [ ] **Step 4: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/game/containers.ts src/game/stormFlow.ts
git commit -m "refactor(clima): extrai helpers de container compartilhados (game/containers.ts)"
```

---

### Task 9: Snowstorm runtime (`game/snowFlow.ts`)

**Files:**
- Create: `src/game/snowFlow.ts`
- Test: `src/game/snowFlow.test.ts`

**Interfaces:**
- Consumes: `snowExposureMs`, `snowWindowEndAt`, `isSnowing` (snow.ts); `containerTeamIds`, `isInFlyingContainer`, `killFlyingContainer` (containers.ts); `hasClearBody` (secretEffects.ts); `findMon`, `replaceMon`, `settleFaintTracked` (runtime.ts); `shiftMissionTimestamps` (missionFlow.ts); `travelerPositionsAt` (travelerPositions.ts) for the freeze position; `SNOW_*` constants.
- Produces: `processSnow(s: GameState, prevMs: number, nowMs: number): void`.

**Design of `processSnow`** (mirror `processStorms` iteration; operate on each traveling container):

For each container `ct` in `[missions(traveling|returning), captureSearches(traveling), captureReturns]`:
1. Resolve `teamIds = containerTeamIds(s, primaryId)`; if any has Clear Body → `ct.snow = undefined`; continue.
2. `exposure = snowExposureMs(s.weather.snow, prevMs, nowMs)`. If `exposure === 0` and not currently frozen → if `ct.snow?.thawAtMs != null && nowMs >= ct.snow.thawAtMs` clear `ct.snow`; continue.
3. Init `ct.snow ??= { stacks: 0, exposureMs: 0 }`. Add exposure: `ct.snow.exposureMs += exposure`. Compute `stacks = min(SNOW_MAX_STACKS, floor(ct.snow.exposureMs / SNOW_STACK_INTERVAL_MS))`.
4. **Slowdown (stacks 1–4):** apply extra delay for the distance covered this tick at rate `0.8^stacks`. Simplest faithful model: `extraMs = exposure * (1/0.8^stacks - 1)`; `shiftMissionTimestamps(mission, leg, extraMs)` (for missions; for captures shift their own `arriveAtMs`/`readyAtMs`/`departAtMs` like `freezeContainer` does). Store `ct.snow.stacks = stacks`.
5. **Freeze (stacks === 5):** if `ct.snow.frozenAtMs == null`: set `ct.snow.frozenAtMs = nowMs`, `ct.snow.lastDrainMs = nowMs`, `ct.snow.thawAtMs = (snowWindowEndAt(s.weather.snow, nowMs) ?? nowMs) + SNOW_THAW_MS`, and freeze position via a hold (reuse `paralyzeHold`-style: set `ct.paralyzeHold = { pos, untilMs: ct.snow.thawAtMs }` using the position from `travelerPositionsAt(s, nowMs)` for `primaryId`; this makes travelerPositions render frozen with zero extra code). Then: if `isInFlyingContainer(s, primaryId)` → `killFlyingContainer(s, primaryId)`; continue. Else drain: `drains = floor((nowMs - ct.snow.lastDrainMs)/SNOW_FREEZE_DAMAGE_INTERVAL_MS)`; for each member `-SNOW_FREEZE_DAMAGE*drains` HP (floor 0 → `settleFaintTracked`); `ct.snow.lastDrainMs += drains*interval`. Also `shiftMissionTimestamps` by the frozen elapsed so the leg ends later (mirror `freezeContainer`).
6. **Thaw:** when `nowMs >= ct.snow.thawAtMs`, clear `ct.snow` and the `paralyzeHold` if it was set by snow.
7. **Leg reset:** handled in Task 12 (advanceMission clears `ct.snow` on `traveling→inProgress` and freeOnReturn), mirroring `weatherHold`/`reroutePath` cleanup.

> Reuse `paralyzeHold` for the freeze position to avoid duplicating freeze logic in `travelerPositions.ts`. Because storm Paralyze and snow freeze never need to coexist on the same container at the same instant in a meaningful conflicting way (both just hold position), sharing the hold is safe; snow sets a longer `untilMs`.

- [ ] **Step 1: Write failing tests.** Create `src/game/snowFlow.test.ts`. Build a minimal `GameState` with a Saffron (index 5) snow window covering the whole day and one mission `traveling`. Use the test helpers already used by `stormFlow.test.ts` (read that file for the state-builder pattern). Cases:
  - After 2s of exposure → `mission.snow.stacks === 1`; arrive pushed later.
  - After 10s → `stacks === 5`, `frozenAtMs` set, `paralyzeHold` set.
  - Ground member loses 1 HP per 2s while frozen; reaching 0 → that member `fainted`, others remain `traveling`/team continues (`mission.status` not `resolved`).
  - Flying mission frozen → `killFlyingContainer` path: team fainted + `mission.result === 'failure'`.
  - Thaw: advance past `thawAtMs` → `mission.snow` cleared.
  - Clear Body member → `mission.snow` stays undefined (immune).
  - Big jump (prev=0, now=20000) applies stacks=5 and the right number of drains.

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- snowFlow` — Expected: FAIL.

- [ ] **Step 3: Implement `src/game/snowFlow.ts`** per the design above.

- [ ] **Step 4: Run tests.** Run: `npm test -- snowFlow` — Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/game/snowFlow.ts src/game/snowFlow.test.ts
git commit -m "feat(clima): runtime da nevasca (processSnow)"
```

---

### Task 10: Sandstorm runtime (`game/sandFlow.ts`)

**Files:**
- Create: `src/game/sandFlow.ts`
- Test: `src/game/sandFlow.test.ts`

**Interfaces:**
- Consumes: `isSanding` (sand.ts), `pickLostNode` (sand.ts); `getCity`; `graphWithTunnels`, `shortestPath`, `pointAlongPath` (pathfinding); `travelRoute` (missions); `createRng`, `deriveSeed`, `SAND_SEED_SALT`; `shiftMissionTimestamps` (missionFlow); `instantWeatherSpeed`/`weatherTravelMs` for timing.
- Produces: `applySandDetour(s: GameState, container, nowMs): void` (one entry per container kind, or a dispatcher iterating all travelers like `processSnow`).

**Design:**
1. Only for legs in transit (mission traveling/returning; search traveling; return). Determine `originNode` (gym for outbound/search, mission node for return) and `destNode`.
2. **Start detour:** if `isSanding(s.weather.sand, nowMs)` and `!ct.sandDetour` and no detour yet on this leg: derive `rng = createRng(deriveSeed(s.run.seed, hash(ct.id + legTag), SAND_SEED_SALT))`; `lost = pickLostNode(rng, graph, originNode, destNode, team, s.runItems)`; if `lost` exists: `ct.reroutePath = [...shortestPath(graph, origin, lost), ...shortestPath(graph, lost, dest).slice(1)]`; `ct.sandDetour = { lostNode: lost }`; compute extra distance and `shiftMissionTimestamps(..., extraMs)` (no shiftStart). For **flying** teams, route is straight lines — build a 3-node path `[origin, lost, dest]` and let `pointAlongPath` interpolate (fly already uses straight segments).
3. **End detour:** if `ct.sandDetour` and `!isSanding(nowMs)`: recompute straight from current position. Mirror the rain reroute "recalculate from current node" approach in `applyWeatherHold`/`planWeatherLeg`: set `ct.reroutePath` to the shortest path from the nearest upcoming node to `dest`, shorten timestamps proportionally, clear `ct.sandDetour`.
4. Determinism: the derived seed must be stable across ticks so re-entry doesn't re-roll. Use a fixed `legTag` (`'out'|'back'|'search'|'return'`).

> **Coexistence with rain:** after `applySandDetour` sets `reroutePath`, the existing `applyWeatherHold` (rain) runs next in the tick and may further reroute around puddles using the current `reroutePath` as the base leg (it already reads `mission.reroutePath ?? mission.path`). No special-casing needed beyond tick ordering (Task 12).

- [ ] **Step 1: Write failing tests.** Create `src/game/sandFlow.test.ts`. With Viridian (index 7) and a sand window covering the day:
  - Outbound mission: after `applySandDetour`, `mission.reroutePath` passes through `mission.sandDetour.lostNode`; `arriveAtMs` pushed later than the direct route.
  - Sand ends mid-leg → next `applySandDetour` clears `sandDetour` and `reroutePath` becomes a straight path to dest from the current node.
  - Flying mission also detours (`sandDetour` set; path has the lost waypoint).
  - Capture search + capture return both get detours.
  - `lostNode` deterministic across two calls with same state.

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- sandFlow` — Expected: FAIL.

- [ ] **Step 3: Implement `src/game/sandFlow.ts`.**

- [ ] **Step 4: Run tests.** Run: `npm test -- sandFlow` — Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/game/sandFlow.ts src/game/sandFlow.test.ts
git commit -m "feat(clima): runtime da areia (applySandDetour, reuso de reroutePath)"
```

---

### Task 11: Freeze position in travelerPositions (safety net)

**Files:**
- Modify: `src/engine/travelerPositions.ts`
- Test: `src/engine/travelerPositions.test.ts` (if exists; else add)

**Interfaces:** No new exports. Since Task 9 reuses `paralyzeHold` for the freeze, `travelerPositions` already renders the frozen position. This task only **verifies** that and adds a regression test; if a separate `snow.frozenAtMs` hold was used instead of `paralyzeHold`, add the same `if (c.snow?.frozenAtMs != null && now < c.snow.thawAtMs) return frozenPos` guard to all three `*TravelerPos`.

- [ ] **Step 1: Add regression test** asserting a frozen mission's traveler position equals the position at `frozenAtMs` (constant while frozen).
- [ ] **Step 2: Run.** Run: `npm test -- travelerPositions` — Expected: PASS (or implement the guard then PASS).
- [ ] **Step 3: Commit.**

```bash
git add src/engine/travelerPositions.ts src/engine/travelerPositions.test.ts
git commit -m "test(clima): posição congelada do snowstorm no mapa"
```

---

### Task 12: Wire into the day tick + leg reset + capture flow

**Files:**
- Modify: `src/game/dayClock.ts` (call sand → snow after rain hold; both before/after `processStorms` — order: `processMissions` (which runs `applyWeatherHold`), then `applySandDetour`+`processSnow` for all travelers)
- Modify: `src/game/missionFlow.ts` (`advanceMission`: clear `mission.snow` and `mission.sandDetour` on `traveling→inProgress`; `freeOnReturn` clears them)
- Modify: `src/game/captureFlow.ts` (clear `snow`/`sandDetour` on search arrival; integrate detour/snow if not done globally)
- Test: `src/game/missionWeather.test.ts` (extend) — end-to-end: a mission under snow arrives later; under sand takes a detour; integration of both in Viridian.

**Interfaces:** Decide call site: simplest is a single dispatcher in `dayClock.tick` after `processMissions`/`processSearches` and before `processStorms`:

```ts
import { applySandDetours } from './sandFlow.ts'
import { processSnow } from './snowFlow.ts'
// in tick(), after processSearches(s, now):
applySandDetours(s, now)   // sand first: defines the path
processSnow(s, prevMs, now) // snow second: speed/freeze over it
processStorms(s, prevMs, now)
```
where `applySandDetours(s, now)` iterates all travelers internally (cleaner than per-container calls).

- [ ] **Step 1: Write failing end-to-end tests** in `missionWeather.test.ts`:
  - Viridian, snow window over the whole day: a long mission's `returnEndsAtMs` is pushed out vs no-weather baseline; reaching freeze drains HP.
  - Viridian, sand window: `mission.reroutePath` includes the lost node; arrival later.
  - Reset: outbound accumulates stacks; after `traveling→inProgress` (advance past arriveAtMs) `mission.snow` is cleared; return accumulates fresh.

- [ ] **Step 2: Run, verify fail.** Run: `npm test -- missionWeather` — Expected: FAIL.

- [ ] **Step 3: Implement** the dispatcher `applySandDetours` in `sandFlow.ts` (iterates missions/searches/returns), wire into `dayClock.tick`, and add the `snow`/`sandDetour` cleanup in `advanceMission` (next to `mission.reroutePath = undefined; mission.weatherHold = undefined`) and `freeOnReturn`, plus capture arrival cleanup in `captureFlow.ts`.

- [ ] **Step 4: Run tests + build.** Run: `npm test -- missionWeather` then `npm run build` — Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/game/dayClock.ts src/game/missionFlow.ts src/game/captureFlow.ts src/game/sandFlow.ts src/game/missionWeather.test.ts
git commit -m "feat(clima): liga snow/sand no tick do dia + reset por perna"
```

---

### Task 13: Audio (snowPlayer / sandPlayer + useGameSounds)

**Files:**
- Create: `src/audio/snowPlayer.ts`, `src/audio/sandPlayer.ts` (copy `heatPlayer.ts`)
- Modify: `src/audio/useGameSounds.ts`
- Test: `src/audio/useGameSounds.test.ts` (extend)

**Interfaces:**
- Produces: `startSnow()/stopSnow()` (`/sounds/weather/snowstorm.mp3`), `startSand()/stopSand()` (`/sounds/weather/sandstorm.mp3`).

- [ ] **Step 1: Create players** as verbatim copies of `heatPlayer.ts` with the new `*_SRC` and renamed exports/module state.
- [ ] **Step 2: Write failing test** in `useGameSounds.test.ts`: entering a snow window in DAY phase calls `startSnow`; leaving calls `stopSnow` (mock the player module, mirror the existing rain/heat tests).
- [ ] **Step 3: Run, verify fail.** Run: `npm test -- useGameSounds` — Expected: FAIL.
- [ ] **Step 4: Wire `useGameSounds.ts`:** import `isSnowing`/`isSanding`, add `snowing`/`sanding` refs, toggle loops in the effect (mirror heat block), cleanup `stopSnow()/stopSand()` on unmount.
- [ ] **Step 5: Run tests.** Run: `npm test -- useGameSounds` — Expected: PASS.
- [ ] **Step 6: Commit.**

```bash
git add src/audio/snowPlayer.ts src/audio/sandPlayer.ts src/audio/useGameSounds.ts src/audio/useGameSounds.test.ts
git commit -m "feat(clima): som em loop de snowstorm e sandstorm"
```

---

### Task 14: UI — badge, forecast, map overlay

**Files:**
- Modify: `src/components/day/WeatherBadge.tsx`, `WeatherBadge.module.css`
- Modify: `src/components/screens/DayForecastPanel.tsx`, `DayForecastPanel.module.css`
- Modify: `src/components/day/CityMap.tsx` (frozen/sand visual, derived from state)
- Test: existing component tests if present; otherwise rely on build + manual.

**Interfaces:** `WEATHER_ICON`/`WEATHER_LABEL` gain `snowstorm: '❄️'`/`'Nevasca'`, `sandstorm: '🌪️'`/`'Tempestade de areia'`.

- [ ] **Step 1: WeatherBadge** — add icon/label entries + `styles.snowstorm`/`styles.sandstorm` (CSS tints). The DayScreen that picks the active badge must include `isSnowing`/`isSanding` — check `DayScreen.tsx` for how it chooses the current kind and extend it.
- [ ] **Step 2: DayForecastPanel** — render snowstorm/sandstorm rows (chance + potential count) in config order, reading the new forecast fields.
- [ ] **Step 3: CityMap overlay** — derive per-traveler frost tint from `container.snow?.stacks` (1–4 increasing, 5 = frozen crystal) and a light city tint while `isSnowing`/`isSanding`. Pure from state; no new state.
- [ ] **Step 4: Build.** Run: `npm run build` — Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add src/components
git commit -m "feat(clima): selo, previsão e overlay de snowstorm/sandstorm"
```

---

### Task 15: Persistence migration

**Files:**
- Modify: `src/persistence/saveLoad.ts`
- Test: `src/persistence/saveLoad.test.ts`

**Interfaces:** Migration to v39: ensure `weather.snow`/`weather.sand` default `[]`, the four forecast fields default `0`, and container `snow`/`sandDetour` default `undefined`. Since `weather` is recomputed at `setupDay`, the main concern is a save reloaded mid-day: clear or default the new fields so old saves don't crash.

- [ ] **Step 1: Write failing test** — load a v38-shaped save (no snow/sand) and assert post-migration `state.weather.snow === []`, `state.weather.sand === []`, forecast fields present, version 39. Mirror the existing heat (v38) migration test.
- [ ] **Step 2: Run, verify fail.** Run: `npm test -- saveLoad` — Expected: FAIL.
- [ ] **Step 3: Implement** the migration step (mirror the v37→v38 heat step: spread `emptyWeatherSchedule()` defaults onto a loaded schedule missing the fields; leave container fields untouched since optional).
- [ ] **Step 4: Run tests.** Run: `npm test -- saveLoad` — Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add src/persistence/saveLoad.ts src/persistence/saveLoad.test.ts
git commit -m "feat(clima): migração de save v39 (snow/sand)"
```

---

### Task 16: Full verification + PR

- [ ] **Step 1: Full build.** Run: `npm run build` — Expected: PASS (no type errors).
- [ ] **Step 2: Full test suite.** Run: `npm test` — Expected: all PASS.
- [ ] **Step 3: Push branch.** `git push -u origin feat/clima-snowstorm-sandstorm`
- [ ] **Step 4: Open PR to main** with `gh pr create --base main` summarizing the two effects, cities, and the spec/plan links.

---

## Self-Review

**Spec coverage:** §1 cityWeather→Task 2; §2 snow/sand schedules→Tasks 3–4; §3 WeatherSchedule/buildDayWeather→Tasks 5–6; §4 state fields→Task 7; §5 snowFlow→Task 9 (helpers Task 8); §6 sandFlow→Task 10; §7 travelerPositions→Task 9/11; §8 UI/audio→Tasks 13–14; §9 persistence→Task 15; §10 setup deltas→Task 6. All covered.

**Placeholder scan:** Test bodies in Tasks 9/10/12/14 describe cases rather than full code because they depend on the repo's existing state-builder test helpers (in `stormFlow.test.ts`/`missionWeather.test.ts`) — the implementer must read those files first and reuse the builders (noted in each task). This is a deliberate pointer, not a vague TODO.

**Type consistency:** `SnowEvent`/`SandEvent` defined in snow.ts/sand.ts, re-exported from weather.ts (Task 5), consumed by storm.ts (Task 6). `processSnow(s,prev,now)`, `applySandDetours(s,now)` names consistent across Tasks 9/10/12. `pickLostNode` signature consistent Tasks 4/10. `buildDayWeather` new param order (…heat, snow, sand, maxWeatherEvents) consistent Tasks 6 and the setup call.
