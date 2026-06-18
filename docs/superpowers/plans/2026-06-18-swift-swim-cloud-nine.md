# Swift Swim e Cloud Nine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativar as habilidades secretas Swift Swim (+200% de velocidade do time enquanto chove) e Cloud Nine (+25 pontos percentuais na chance de chuva do dia, por portador), reaproveitando o sistema de chuva já existente.

**Architecture:** O tempo de cada perna de viagem passa por um integrador puro (`engine/rainSpeed.ts`) que soma uma velocidade em degrau (base fora da chuva, base+bônus durante) sobre a agenda de chuva — determinística e conhecida no despacho. A posição do sprite continua linear (consistente nos extremos). Cloud Nine entra como parâmetro de chance em `buildWeatherSchedule`, contado no roster pelo `setupDay`. A aura visual existente (`speedy`) passa a acender ao vivo durante a chuva via um predicado puro.

**Tech Stack:** TypeScript, React 19, Vitest. Sem dependências novas.

## Global Constraints

- Imports SEMPRE com extensão `.ts`/`.tsx` (padrão do projeto).
- Funções de engine são PURAS; estado diário vem de `GameState`.
- Clima usa stream de RNG própria (`WEATHER_SEED_SALT`) — NÃO deslocar o cursor de RNG da run.
- Determinismo: tudo derivável de `(seed, dia, cidade)` e função de `now`.
- Rodar testes: `npm test` (= `vitest run`). Arquivo único: `npx vitest run <caminho>`.
- Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- Swift Swim = ×3 durante a chuva (aditivo na base). Cloud Nine = +25 pontos percentuais por portador, teto 100%.

---

### Task 1: Constantes, predicados e textos do catálogo

**Files:**
- Modify: `src/engine/balance.ts` (adicionar 2 constantes perto de `FLY_SPEED_BONUS`)
- Modify: `src/engine/secretEffects.ts` (adicionar `teamHasSwiftSwim`, `hasCloudNine`)
- Modify: `src/data/secretAbilities.ts:130-134` e `:215-219` (textos)
- Test: `src/engine/secretEffects.test.ts`

**Interfaces:**
- Produces: `SWIFT_SWIM_RAIN_BONUS: number` e `CLOUD_NINE_RAIN_CHANCE_BONUS_PP: number` (balance.ts); `teamHasSwiftSwim(team: readonly Pokemon[]): boolean` e `hasCloudNine(p: Pokemon): boolean` (secretEffects.ts).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/engine/secretEffects.test.ts`, adicionar ao bloco de imports de `./secretEffects.ts` os nomes `hasCloudNine` e `teamHasSwiftSwim`, e adicionar este `describe` ao final do arquivo:

```ts
describe('predicados de chuva (Swift Swim / Cloud Nine)', () => {
  it('teamHasSwiftSwim: true se ALGUÉM no time tem Swift Swim', () => {
    // Omanyte (138): [Swift Swim, Shell Armor, Weak Armor] → posição 1.
    const swimmer = makeMon({ speciesId: 138, secretCount: 1 })
    const plain = makeMon({ speciesId: 138, secretCount: 0 })
    expect(teamHasSwiftSwim([swimmer])).toBe(true)
    expect(teamHasSwiftSwim([plain])).toBe(false)
    expect(teamHasSwiftSwim([plain, swimmer])).toBe(true)
  })

  it('hasCloudNine: só com a habilidade desbloqueada (Psyduck 54, posição 3)', () => {
    expect(hasCloudNine(makeMon({ speciesId: 54, secretCount: 3 }))).toBe(true)
    expect(hasCloudNine(makeMon({ speciesId: 54, secretCount: 2 }))).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: FAIL — `hasCloudNine`/`teamHasSwiftSwim` não exportados.

- [ ] **Step 3: Adicionar as constantes em `src/engine/balance.ts`**

Logo após a linha `export const FLY_SPEED_BONUS = 0.5` (`balance.ts:233`):

```ts
/** Swift Swim: bônus ADITIVO de velocidade do time enquanto chove (×3 = base +2). */
export const SWIFT_SWIM_RAIN_BONUS = 2
/** Cloud Nine: pontos percentuais somados à chance de chuva do dia POR portador no roster. */
export const CLOUD_NINE_RAIN_CHANCE_BONUS_PP = 25
```

- [ ] **Step 4: Adicionar os predicados em `src/engine/secretEffects.ts`**

Logo após a função `hasSwiftSwim` (`secretEffects.ts:76-78`):

```ts
/** Algum Pokémon do time tem Swift Swim? (basta um para o time inteiro acelerar na chuva). */
export function teamHasSwiftSwim(team: readonly Pokemon[]): boolean {
  return team.some(hasSwiftSwim)
}
```

E logo após `hasForewarn` (`secretEffects.ts:106-108`):

```ts
export function hasCloudNine(p: Pokemon): boolean {
  return hasSecret(p, 'sa-cloud-nine')
}
```

- [ ] **Step 5: Atualizar os textos do catálogo em `src/data/secretAbilities.ts`**

Trocar o efeito do Swift Swim (`secretAbilities.ts:133`):

```ts
    effect: '+200% de velocidade do time enquanto chove.',
```

Trocar o efeito do Cloud Nine (`secretAbilities.ts:218`):

```ts
    effect: '+25 pontos percentuais na chance de chover hoje (acumula por portador).',
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/balance.ts src/engine/secretEffects.ts src/data/secretAbilities.ts src/engine/secretEffects.test.ts
git commit -m "feat: predicados e constantes de Swift Swim e Cloud Nine"
```

---

### Task 2: Módulo `rainSpeed` (núcleo do Swift Swim)

**Files:**
- Create: `src/engine/rainSpeed.ts`
- Test: `src/engine/rainSpeed.test.ts`

**Interfaces:**
- Consumes: `SWIFT_SWIM_RAIN_BONUS` (balance.ts); `graphTravelMs` (missions.ts); `teamHasSwiftSwim`, `teamTravelSpeedMultiplier` (secretEffects.ts); `WeatherSchedule` (weather.ts).
- Produces: `rainTravelMs(schedule: WeatherSchedule, startMs: number, distance: number, team: readonly Pokemon[], runItems?: readonly string[]): number` — duração (ms de jogo) de uma perna, integrando o Swift Swim na chuva; idêntico a `graphTravelMs(distance, team, baseMult)` quando não há swimmer ou não há chuva.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/engine/rainSpeed.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeMon } from './testkit.ts'
import { graphTravelMs } from './missions.ts'
import { SWIFT_SWIM_RAIN_BONUS } from './balance.ts'
import { rainTravelMs } from './rainSpeed.ts'
import { emptyWeatherSchedule, type WeatherSchedule } from './weather.ts'

// Omanyte (138): Swift Swim na posição 1 (sem Surf na linha). Mesma espécie sem habilidade = base.
const swimmer = () => makeMon({ speciesId: 138, secretCount: 1 })
const plain = () => makeMon({ speciesId: 138, secretCount: 0 })
const DIST = 100

/** Chuva cobrindo um intervalo [0, endMs] (sem poças — só a janela do evento). */
function rainUntil(endMs: number): WeatherSchedule {
  return {
    rain: [{ startMs: 0, endMs, puddles: [] }],
    forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1 },
  }
}

describe('rainTravelMs', () => {
  it('sem chuva → idêntico ao tempo linear (graphTravelMs com a base)', () => {
    const team = [swimmer()]
    expect(rainTravelMs(emptyWeatherSchedule(), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, 1), // base = 1 (HP cheio, sem Fly/Lagging)
    )
  })

  it('time SEM Swift Swim ignora a chuva', () => {
    const team = [plain()]
    expect(rainTravelMs(rainUntil(1_000_000), 0, DIST, team)).toBeCloseTo(graphTravelMs(DIST, team, 1))
  })

  it('chuva o trajeto todo → velocidade ×3 (1/3 do tempo)', () => {
    const team = [swimmer()]
    expect(rainTravelMs(rainUntil(1_000_000), 0, DIST, team)).toBeCloseTo(
      graphTravelMs(DIST, team, 1 + SWIFT_SWIM_RAIN_BONUS),
    )
  })

  it('chuva parcial → ×3 enquanto chove, base depois', () => {
    const team = [swimmer()]
    const need = graphTravelMs(DIST, team, 1) // "progresso" total a multiplicador 1
    const rainMs = Math.floor(need / 10) // chuva curta: cabe inteira no início (need > 3·rainMs)
    // Durante a chuva cobre rainMs·3 do progresso; o resto a ×1. Tempo = rainMs + (need − 3·rainMs).
    expect(rainTravelMs(rainUntil(rainMs), 0, DIST, team)).toBeCloseTo(need - 2 * rainMs)
  })

  it('distância zero → tempo zero (ex.: Sniper)', () => {
    expect(rainTravelMs(rainUntil(1_000_000), 0, 0, [swimmer()])).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/rainSpeed.test.ts`
Expected: FAIL — módulo `./rainSpeed.ts` não existe.

- [ ] **Step 3: Implementar `src/engine/rainSpeed.ts`**

```ts
// Tempo de viagem PURO sob chuva. O Swift Swim dá +200% de velocidade (×3) ENQUANTO chove.
// Como a agenda de chuva do dia é determinística e conhecida no despacho, o tempo de uma perna é
// a integral de uma velocidade em DEGRAU (base fora da chuva, base+bônus durante) sobre as janelas
// de chuva. Quem não tem Swift Swim no time — ou em dia/cidade sem chuva — cai no tempo linear de
// graphTravelMs (a integral vira uma reta). A integral do multiplicador ao longo do tempo deve
// igualar o "progresso necessário" = graphTravelMs(distance, team, 1).

import type { Pokemon } from '../types/index.ts'
import { SWIFT_SWIM_RAIN_BONUS } from './balance.ts'
import { graphTravelMs } from './missions.ts'
import { teamHasSwiftSwim, teamTravelSpeedMultiplier } from './secretEffects.ts'
import type { WeatherSchedule } from './weather.ts'

/** Trecho de velocidade constante a partir de `start` até `end` (chovendo ou não). */
interface SpeedSegment {
  start: number
  end: number
  raining: boolean
}

/** Segmentos de velocidade constante a partir de `startMs` (rain já é ordenado e sem sobreposição). */
function speedSegments(schedule: WeatherSchedule, startMs: number): SpeedSegment[] {
  const segs: SpeedSegment[] = []
  let cursor = startMs
  for (const ev of schedule.rain) {
    if (ev.endMs <= startMs) continue
    const rainStart = Math.max(ev.startMs, startMs)
    if (rainStart > cursor) segs.push({ start: cursor, end: rainStart, raining: false })
    segs.push({ start: rainStart, end: ev.endMs, raining: true })
    cursor = ev.endMs
  }
  // Cauda seca "infinita": garante que o laço sempre consome o progresso restante.
  segs.push({ start: cursor, end: Number.POSITIVE_INFINITY, raining: false })
  return segs
}

/**
 * Duração (ms de jogo) de uma perna de `distance` começando em `startMs`, considerando o Swift
 * Swim do time durante a chuva. Sem swimmer ou sem chuva → idêntico a graphTravelMs(distance,
 * team, baseMult) (linear).
 */
export function rainTravelMs(
  schedule: WeatherSchedule,
  startMs: number,
  distance: number,
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
): number {
  const baseMult = teamTravelSpeedMultiplier(team, runItems)
  const need = graphTravelMs(distance, team, 1) // progresso total a multiplicador 1
  if (need <= 0) return 0
  if (!teamHasSwiftSwim(team) || schedule.rain.length === 0) {
    return need / Math.max(baseMult, 0.0001)
  }
  let remaining = need
  for (const seg of speedSegments(schedule, startMs)) {
    const rate = Math.max(baseMult + (seg.raining ? SWIFT_SWIM_RAIN_BONUS : 0), 0.0001)
    const capacity = (seg.end - seg.start) * rate // Infinity no trecho seco final
    if (capacity >= remaining) return seg.start - startMs + remaining / rate
    remaining -= capacity
  }
  return need / Math.max(baseMult, 0.0001) // inalcançável (cauda infinita); satisfaz o tipo
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/rainSpeed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rainSpeed.ts src/engine/rainSpeed.test.ts
git commit -m "feat: integrador de tempo de viagem do Swift Swim (rainSpeed)"
```

---

### Task 3: Swift Swim nas missões (despacho + poças)

**Files:**
- Modify: `src/game/missionFlow.ts` (imports; `acceptMission` ~108-129; `applyWeatherHold` ~199)
- Test: `src/game/missionWeather.test.ts`

**Interfaces:**
- Consumes: `rainTravelMs` (rainSpeed.ts); `teamHasSwiftSwim`, `teamTravelSpeedMultiplier` (secretEffects.ts); `isRaining` (weather.ts); `SWIFT_SWIM_RAIN_BONUS` (balance.ts).

- [ ] **Step 1: Escrever o teste que falha**

Em `src/game/missionWeather.test.ts`, adicionar SOMENTE estes dois imports ao topo (o arquivo já importa `createPokemon`, `createRng`, `getCity`, `graphWithoutSurf`, `shortestPath`, `MissionInstance` e `WeatherSchedule`):

```ts
import { acceptMission } from './missionFlow.ts'
import { DAY_LENGTH_MS } from '../engine/constants.ts'
```

Adicionar este `describe` ao final do arquivo:

```ts
describe('Swift Swim acelera a ida da missão sob chuva', () => {
  // Chuva cobrindo o dia inteiro, sem poças (não interfere com desvio/espera).
  const rainAllDay: WeatherSchedule = {
    rain: [{ startMs: 0, endMs: DAY_LENGTH_MS, puddles: [] }],
    forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1 },
  }
  // Destino alcançável a pé (sem surf) a partir do ginásio de Cerulean.
  const gym = CERULEAN.siteNodes.gym
  const dest = Object.keys(CERULEAN.graph.nodes).find(
    (n) => shortestPath(DRY, gym, n).length >= 3,
  )!

  /** Estado pronto para despachar UMA missão 'available' em `dest`, com o roster dado. */
  function dispatchState(secretCount: number) {
    const s = createInitialState(1)
    s.run.cityIndex = 1
    s.weather = rainAllDay
    s.roster = [createPokemon({ id: 'p1', speciesId: 138 /* Omanyte */, level: 10, rng: createRng(1) })]
    s.roster[0].secretCount = secretCount // 1 = Swift Swim desbloqueado; 0 = sem habilidade
    s.roster[0].status = 'idle' // acceptMission só despacha quem está idle
    s.missions = [
      {
        id: 'm1',
        templateId: 'patrulha',
        requirement: {} as MissionInstance['requirement'],
        node: dest,
        path: [],
        returnPath: [],
        spawnAtMs: 0,
        expiresAtMs: 999_999,
        status: 'available',
        teamIds: [],
        acceptedAtMs: null,
        arriveAtMs: null,
        resolveAtMs: null,
        returnEndsAtMs: null,
        result: null,
        pSuccess: 0,
      },
    ]
    return s
  }

  it('time com Swift Swim chega antes do que sem, sob chuva', () => {
    const withSS = dispatchState(1)
    acceptMission(withSS, 'm1', ['p1'])
    const plain = dispatchState(0)
    acceptMission(plain, 'm1', ['p1'])

    const swiftArrive = withSS.missions[0]!.arriveAtMs!
    const plainArrive = plain.missions[0]!.arriveAtMs!
    expect(swiftArrive).toBeGreaterThan(0)
    expect(swiftArrive).toBeLessThan(plainArrive)
    // Chuva o dia todo → ×3 → ~1/3 do tempo de ida.
    expect(swiftArrive).toBeCloseTo(plainArrive / 3, 0)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/game/missionWeather.test.ts`
Expected: FAIL — `arriveAtMs` do time com Swift Swim igual ao base (a ida ainda não usa `rainTravelMs`).

- [ ] **Step 3: Trocar o cálculo da viagem em `acceptMission`**

No bloco de imports de `'../engine/missions.ts'` (`missionFlow.ts:28-34`), remover `graphTravelMs` (deixará de ser usado neste arquivo). No bloco de imports de `'../engine/secretEffects.ts'` (`missionFlow.ts:35-42`), adicionar `teamHasSwiftSwim`. Adicionar dois imports novos logo abaixo:

```ts
import { rainTravelMs } from '../engine/rainSpeed.ts'
import { isRaining } from '../engine/weather.ts'
import { SWIFT_SWIM_RAIN_BONUS } from '../engine/balance.ts'
```

(`SWIFT_SWIM_RAIN_BONUS` pode ser adicionado ao import de balance já existente em `missionFlow.ts:14-21`.)

Substituir as linhas `missionFlow.ts:108-110`:

```ts
  const speedMult = teamTravelSpeedMultiplier(team, s.runItems)
  const outMs = graphTravelMs(outbound.distance, team, speedMult)
  const inMs = graphTravelMs(inbound.distance, team, speedMult)
```

por:

```ts
  const outMs = rainTravelMs(s.weather, now, outbound.distance, team, s.runItems)
```

E substituir as linhas `missionFlow.ts:127-129`:

```ts
  mission.arriveAtMs = now + outMs
  mission.resolveAtMs = now + outMs + execution
  mission.returnEndsAtMs = now + outMs + execution + inMs
```

por (a volta começa em `resolveAtMs` e também integra a chuva):

```ts
  mission.arriveAtMs = now + outMs
  mission.resolveAtMs = mission.arriveAtMs + execution
  mission.returnEndsAtMs =
    mission.resolveAtMs + rainTravelMs(s.weather, mission.resolveAtMs, inbound.distance, team, s.runItems)
```

- [ ] **Step 4: Acelerar também o desvio de poça (Swift Swim) em `applyWeatherHold`**

Substituir a linha `missionFlow.ts:199`:

```ts
  const speedMult = teamTravelSpeedMultiplier(team, s.runItems)
```

por (durante a chuva o desvio também é mais rápido):

```ts
  const speedMult =
    teamTravelSpeedMultiplier(team, s.runItems) +
    (teamHasSwiftSwim(team) && isRaining(s.weather, nowMs) ? SWIFT_SWIM_RAIN_BONUS : 0)
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npx vitest run src/game/missionWeather.test.ts`
Expected: PASS (incluindo os testes de poça pré-existentes — times sem Swift Swim mantêm o comportamento).

- [ ] **Step 6: Commit**

```bash
git add src/game/missionFlow.ts src/game/missionWeather.test.ts
git commit -m "feat: Swift Swim acelera a viagem da missão sob chuva"
```

---

### Task 4: Swift Swim na captura/exploração (despacho + poças)

**Files:**
- Modify: `src/game/captureFlow.ts` (imports; `startSearch` ~42-45; `applySearchWeatherHold` ~87; `startReturn` ~167-168; `applyReturnWeatherHold` ~206)
- Test: `src/game/captureWeather.test.ts`

**Interfaces:**
- Consumes: `rainTravelMs` (rainSpeed.ts); `teamHasSwiftSwim`, `teamTravelSpeedMultiplier`, `teamSurfs` (secretEffects.ts); `isRaining` (weather.ts); `SWIFT_SWIM_RAIN_BONUS` (balance.ts).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/game/captureWeatherSwift.test.ts` (arquivo novo, para não conflitar com `captureWeather.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { getCity } from '../data/cities.ts'
import { graphWithoutSurf, shortestPath } from '../engine/pathfinding.ts'
import { DAY_LENGTH_MS } from '../engine/constants.ts'
import type { WeatherSchedule } from '../engine/weather.ts'
import { startSearch } from './captureFlow.ts'

const CERULEAN = getCity(1)
const DRY = graphWithoutSurf(CERULEAN.graph)

const rainAllDay: WeatherSchedule = {
  rain: [{ startMs: 0, endMs: DAY_LENGTH_MS, puddles: [] }],
  forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1 },
}

// Área de grama alcançável a pé a partir do ginásio.
const gym = CERULEAN.siteNodes.gym
const spot = Object.keys(CERULEAN.graph.nodes).find((n) => shortestPath(DRY, gym, n).length >= 3)!

function searchState(secretCount: number) {
  const s = createInitialState(1)
  s.run.cityIndex = 1
  s.weather = rainAllDay
  s.roster = [createPokemon({ id: 'p1', speciesId: 138 /* Omanyte */, level: 10, rng: createRng(1) })]
  s.roster[0].secretCount = secretCount
  s.roster[0].status = 'idle'
  s.captureSpots = [spot]
  s.captureSpotSpawnsAtMs = [0]
  return s
}

describe('Swift Swim acelera a exploração sob chuva', () => {
  it('explorador com Swift Swim chega antes na área', () => {
    const withSS = searchState(1)
    startSearch(withSS, 'p1', 0)
    const plain = searchState(0)
    startSearch(plain, 'p1', 0)

    const swiftArrive = withSS.captureSearches[0]!.arriveAtMs
    const plainArrive = plain.captureSearches[0]!.arriveAtMs
    expect(swiftArrive).toBeGreaterThan(0)
    expect(swiftArrive).toBeLessThan(plainArrive)
    expect(swiftArrive).toBeCloseTo(plainArrive / 3, 0)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/game/captureWeatherSwift.test.ts`
Expected: FAIL — chegada do explorador com Swift Swim igual à base.

- [ ] **Step 3: Atualizar imports de `src/game/captureFlow.ts`**

No import de `'../engine/missions.ts'` (`captureFlow.ts:15`), remover `graphTravelMs` (deixará de ser usado), mantendo `travelRoute`. No import de `'../engine/secretEffects.ts'` (`captureFlow.ts:18`), adicionar `teamHasSwiftSwim`. Adicionar imports novos:

```ts
import { rainTravelMs } from '../engine/rainSpeed.ts'
import { isRaining } from '../engine/weather.ts'
import { SWIFT_SWIM_RAIN_BONUS } from '../engine/balance.ts'
```

- [ ] **Step 4: Trocar o cálculo da ida em `startSearch`**

Substituir `captureFlow.ts:42-45`:

```ts
  const speedMult = teamTravelSpeedMultiplier([searcher], s.runItems)
  const oneWay = graphTravelMs(distance, [searcher], speedMult)
  const now = s.clock.dayElapsedMs
  const arriveAtMs = now + oneWay
```

por:

```ts
  const now = s.clock.dayElapsedMs
  const oneWay = rainTravelMs(s.weather, now, distance, [searcher], s.runItems)
  const arriveAtMs = now + oneWay
```

- [ ] **Step 5: Trocar o cálculo da volta em `startReturn`**

Substituir `captureFlow.ts:167-169`:

```ts
  const speedMult = teamTravelSpeedMultiplier([searcher], s.runItems)
  const oneWay = graphTravelMs(distance, [searcher], speedMult)
  const now = s.clock.dayElapsedMs
```

por:

```ts
  const now = s.clock.dayElapsedMs
  const oneWay = rainTravelMs(s.weather, now, distance, [searcher], s.runItems)
```

- [ ] **Step 6: Acelerar o desvio de poça (Swift Swim) nos dois weather-holds**

Em `applySearchWeatherHold`, substituir `captureFlow.ts:87`:

```ts
  const speedMult = teamTravelSpeedMultiplier(team, s.runItems)
```

por:

```ts
  const speedMult =
    teamTravelSpeedMultiplier(team, s.runItems) +
    (teamHasSwiftSwim(team) && isRaining(s.weather, nowMs) ? SWIFT_SWIM_RAIN_BONUS : 0)
```

Em `applyReturnWeatherHold`, fazer a MESMA substituição em `captureFlow.ts:206`.

- [ ] **Step 7: Rodar os testes e ver passar**

Run: `npx vitest run src/game/captureWeatherSwift.test.ts src/game/captureWeather.test.ts`
Expected: PASS (o `captureWeather.test.ts` pré-existente continua verde — sem Swift Swim, comportamento idêntico).

- [ ] **Step 8: Commit**

```bash
git add src/game/captureFlow.ts src/game/captureWeatherSwift.test.ts
git commit -m "feat: Swift Swim acelera a exploração/captura sob chuva"
```

---

### Task 5: Cloud Nine (chance de chuva do dia)

**Files:**
- Modify: `src/engine/weather.ts` (`buildWeatherSchedule` ~161-171)
- Modify: `src/game/setup.ts` (imports; `setupDay` ~75)
- Test: `src/engine/weather.test.ts`, `src/game/cloudNineSetup.test.ts` (novo)

**Interfaces:**
- Produces: `buildWeatherSchedule(seed, day, city, extraChancePercent?: number)` — o 4º parâmetro (default 0) soma à chance do dia (teto 100%).
- Consumes: `hasCloudNine` (secretEffects.ts); `CLOUD_NINE_RAIN_CHANCE_BONUS_PP` (balance.ts).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/engine/weather.test.ts`, adicionar este `describe` ao final:

```ts
describe('Cloud Nine (extraChancePercent em buildWeatherSchedule)', () => {
  it('soma os pontos percentuais à chance do dia, com teto de 100', () => {
    const seed = 7777
    const day = 7
    const base = buildWeatherSchedule(seed, day, CERULEAN, 0).forecast.rainChancePercent
    const boosted = buildWeatherSchedule(seed, day, CERULEAN, 25).forecast.rainChancePercent
    expect(boosted).toBe(Math.min(100, base + 25))
    expect(buildWeatherSchedule(seed, day, CERULEAN, 200).forecast.rainChancePercent).toBe(100)
  })

  it('não cria chuva em dia 1-2 nem em cidade sem chuva, mesmo com bônus alto', () => {
    expect(buildWeatherSchedule(1, 1, CERULEAN, 100).rain).toEqual([])
    expect(buildWeatherSchedule(1, 5, PEWTER, 100).rain).toEqual([])
  })
})
```

Criar `src/game/cloudNineSetup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { setupDay } from './setup.ts'

/** Estado em Cerulean (dia 7) com um roster dado, pronto para setupDay. */
function dayState(mons: ReturnType<typeof createPokemon>[]) {
  const s = createInitialState(123)
  s.run.cityIndex = 1
  s.run.day = 7
  s.roster = mons
  return s
}

describe('Cloud Nine no setupDay', () => {
  it('cada portador soma +25pp à chance de chuva do dia', () => {
    const noCN = dayState([createPokemon({ id: 'p1', speciesId: 19, level: 5, rng: createRng(1) })])
    setupDay(noCN)
    const cn = dayState([createPokemon({ id: 'p1', speciesId: 54 /* Psyduck */, level: 5, rng: createRng(1) })])
    cn.roster[0].secretCount = 3 // Cloud Nine desbloqueado (posição 3 da linha)
    setupDay(cn)
    expect(cn.weather.forecast.rainChancePercent).toBe(
      Math.min(100, noCN.weather.forecast.rainChancePercent + 25),
    )
  })
})
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run src/engine/weather.test.ts src/game/cloudNineSetup.test.ts`
Expected: FAIL — `buildWeatherSchedule` ainda não aceita `extraChancePercent`; `setupDay` não conta Cloud Nine.

- [ ] **Step 3: Adicionar o parâmetro em `buildWeatherSchedule` (`src/engine/weather.ts`)**

Trocar a assinatura (`weather.ts:161`):

```ts
export function buildWeatherSchedule(seed: number, day: number, city: CityData): WeatherSchedule {
```

por:

```ts
export function buildWeatherSchedule(
  seed: number,
  day: number,
  city: CityData,
  extraChancePercent = 0,
): WeatherSchedule {
```

E trocar a linha da chance (`weather.ts:165`):

```ts
  const chance = rainChanceForDay(seed, day)
```

por:

```ts
  const chance = clamp(rainChanceForDay(seed, day) + extraChancePercent, 0, 100)
```

(`clamp` já está importado em `weather.ts:19`.)

- [ ] **Step 4: Contar Cloud Nine no `setupDay` (`src/game/setup.ts`)**

Adicionar `hasCloudNine` ao import de `'../engine/secretEffects.ts'` já existente em `setup.ts` e `CLOUD_NINE_RAIN_CHANCE_BONUS_PP` ao import de `'../engine/balance.ts'` (ou criar o import se não houver). Trocar a linha `setup.ts:75`:

```ts
  s.weather = buildWeatherSchedule(s.run.seed, s.run.day, city)
```

por:

```ts
  const cloudNine = s.roster.filter(hasCloudNine).length
  s.weather = buildWeatherSchedule(
    s.run.seed,
    s.run.day,
    city,
    cloudNine * CLOUD_NINE_RAIN_CHANCE_BONUS_PP,
  )
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npx vitest run src/engine/weather.test.ts src/game/cloudNineSetup.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/weather.ts src/game/setup.ts src/engine/weather.test.ts src/game/cloudNineSetup.test.ts
git commit -m "feat: Cloud Nine soma chance de chuva por portador no setupDay"
```

---

### Task 6: Aura de velocidade ao vivo (Swift Swim no mapa)

**Files:**
- Modify: `src/engine/secretEffects.ts` (novo `teamIsSpeedy` + import de `isRaining`/`WeatherSchedule`)
- Modify: `src/components/day/CityMap.tsx` (imports; `MapTravelers` ~231)
- Test: `src/engine/secretEffects.test.ts`

**Interfaces:**
- Produces: `teamIsSpeedy(team: readonly Pokemon[], runItems: readonly string[], weather: WeatherSchedule, nowMs: number): boolean` — true quando o multiplicador de velocidade base já é >1 (Weak Armor/Fly) OU quando há Swift Swim no time e está chovendo agora.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/engine/secretEffects.test.ts`, adicionar `teamIsSpeedy` ao import de `./secretEffects.ts` e este `describe`:

```ts
describe('teamIsSpeedy (aura de velocidade ao vivo)', () => {
  const rainNow = {
    rain: [{ startMs: 0, endMs: 100_000, puddles: [] }],
    forecast: { rainChancePercent: 100, rainMmPerHour: 30, potentialRainCount: 1 },
  }
  const dry = { rain: [], forecast: { rainChancePercent: 0, rainMmPerHour: 0, potentialRainCount: 0 } }

  it('Swift Swim acende a aura SÓ enquanto chove', () => {
    const swimmer = makeMon({ speciesId: 138, secretCount: 1 })
    expect(teamIsSpeedy([swimmer], [], rainNow, 5_000)).toBe(true) // chovendo
    expect(teamIsSpeedy([swimmer], [], rainNow, 200_000)).toBe(false) // depois da chuva
    expect(teamIsSpeedy([swimmer], [], dry, 0)).toBe(false) // sem chuva
  })

  it('Weak Armor (HP faltante) mantém a aura como antes, sem depender de chuva', () => {
    // Onix (95): Weak Armor na posição 1; com HP faltante o multiplicador base passa de 1.
    const hurt = makeMon({ speciesId: 95, secretCount: 1, maxHp: 10, currentHp: 7 })
    expect(teamIsSpeedy([hurt], [], dry, 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: FAIL — `teamIsSpeedy` não exportado.

- [ ] **Step 3: Adicionar `teamIsSpeedy` em `src/engine/secretEffects.ts`**

No topo do arquivo, adicionar o import (logo após os outros imports de engine):

```ts
import { isRaining, type WeatherSchedule } from './weather.ts'
```

E adicionar a função logo após `teamSnipes` (`secretEffects.ts:244-246`):

```ts
/**
 * O time deve exibir a aura de "veloz" no mapa? Verdadeiro quando o multiplicador base já é >1
 * (Weak Armor/Fly/itens) OU quando há Swift Swim no time e está chovendo AGORA (efeito ao vivo).
 */
export function teamIsSpeedy(
  team: readonly Pokemon[],
  runItems: readonly string[],
  weather: WeatherSchedule,
  nowMs: number,
): boolean {
  return (
    teamTravelSpeedMultiplier(team, runItems) > 1 ||
    (teamHasSwiftSwim(team) && isRaining(weather, nowMs))
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/engine/secretEffects.test.ts`
Expected: PASS.

- [ ] **Step 5: Ligar a aura no `CityMap`**

Em `src/components/day/CityMap.tsx`, trocar o import (`CityMap.tsx:21-22`):

```ts
import { activePuddlesAt } from '../../engine/weather.ts'
import { teamTravelSpeedMultiplier } from '../../engine/secretEffects.ts'
```

por:

```ts
import { activePuddlesAt, isRaining } from '../../engine/weather.ts'
import { teamIsSpeedy } from '../../engine/secretEffects.ts'
```

(`isRaining` é importado para evitar quebra caso seja usado em outro ponto do arquivo; se o lint acusar import não usado, remova-o — `teamIsSpeedy` já recebe `state.weather`.)

Trocar a linha `CityMap.tsx:231`:

```ts
        const speedy = teamTravelSpeedMultiplier(team, state.runItems) > 1
```

por:

```ts
        const speedy = teamIsSpeedy(team, state.runItems, state.weather, now)
```

- [ ] **Step 6: Verificar tipo e lint do componente**

Run: `npm run typecheck && npm run lint`
Expected: sem erros. (Se `isRaining` ficar sem uso em `CityMap.tsx`, remova-o do import.)

- [ ] **Step 7: Commit**

```bash
git add src/engine/secretEffects.ts src/engine/secretEffects.test.ts src/components/day/CityMap.tsx
git commit -m "feat: aura de velocidade acende ao vivo com Swift Swim na chuva"
```

---

### Task 7: Verificação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 2: Typecheck e lint do projeto**

Run: `npm run typecheck && npm run lint`
Expected: sem erros. Em especial, confirmar que `graphTravelMs` foi removido dos imports de `missionFlow.ts` e `captureFlow.ts` (senão o lint acusa import não usado) e que nenhum import ficou órfão.

- [ ] **Step 3: Commit final (se algo foi ajustado)**

```bash
git add -A
git commit -m "chore: ajustes finais de Swift Swim e Cloud Nine"
```

(Se nada mudou, pular o commit.)

---

## Notas de implementação (escolhas conscientes)

- **Posição do sprite permanece LINEAR.** Só o horário de chegada (`arriveAtMs`/`returnEndsAtMs`) usa o integrador. Como `arriveAtMs` já reflete o tempo integrado, o sprite cobre a perna em menos tempo a ritmo visual uniforme; os extremos (fração 0 na largada, 1 na chegada) batem sempre, inclusive após desvio/espera de poça — por isso o `applyWeatherHold`/handlers de captura não precisam de recomputação especial. A diferença (não acelerar visivelmente no meio da perna) é cosmética e imperceptível no mapa top-down. Isto refina o item da spec que falava em "posição do sprite do mesmo integrador": o resultado observável (chegada mais cedo sob chuva + aura ao vivo) é preservado.
- **Desvio de poça sob chuva** usa o multiplicador efetivo (base + bônus se chovendo agora) só para estimar o `extraMs` do contorno — aproximação aceitável, localizada nos handlers.
- **Cloud Nine** nunca "cria" chuva onde ela é impossível: a guarda `day < 3 || !cityHasRain` continua antes do cálculo da chance.

## Cobertura da spec (auto-revisão)

- §1 textos do catálogo → Task 1 (steps 5).
- §2 modelo de velocidade / integrador → Task 2; despacho de missão/captura → Tasks 3, 4.
- §3 interação com poças → Tasks 3 (step 4) e 4 (step 6) + Nota de implementação.
- §4 aura visual → Task 6.
- §5 Cloud Nine (chance + setup + teto + guarda) → Task 5.
- §6 predicados/constantes → Task 1.
- Testes (§Testes) → distribuídos por task + Task 7 (suíte completa).
- Fora de escopo (Sand Rush etc.) → não tocados.
