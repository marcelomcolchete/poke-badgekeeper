# Chance de clima por cidade e por dia (preparo para o modo infinito) — Design

## Problema

Hoje a chance de chuva e de tempestade é um **orçamento global** distribuído entre os 8 dias
elegíveis (3–10): `RAIN_CHANCE_TOTAL_PERCENT = 400` e `STORM_CHANCE_TOTAL_PERCENT = 300`,
repartidos por pesos aleatórios normalizados (`rainChanceForDay`/`stormChanceForDay`). Isso
trava o clima no dia 10: para `day > TOTAL_DAYS` o índice cai fora do array de pesos e a chance
vira 0% — ao contrário das fórmulas de balanceamento (treinadores/esquadrão/dano), que já foram
preparadas para o modo infinito.

Além disso a chance de chuva é **global**, não depende da cidade — só os tipos de efeito é que
são por cidade (`cityWeather.ts`).

## Objetivo

Trocar o orçamento global por uma **fórmula por cidade e por efeito** cuja chance **cresce com o
dia** e **estabiliza num teto** (valor de regime do infinito), funcionando em qualquer dia sem
depender de `TOTAL_DAYS`. Também aumentar o alcance da contagem de pancadas.

Não-objetivos: construir o modo infinito em si; mexer no agendamento de janelas, na geometria do
raio, nas poças ou na previsão da manhã.

## Decisões (do brainstorming)

- **Uma chance por dia.** Sorteia-se um único valor na faixa `[piso, teto]`, estável por
  `(seed, dia)`, e **todas as pancadas daquele dia** usam essa probabilidade (`rng.bool`). Casa
  com a arquitetura atual e mantém a previsão da manhã como um número exato.
- **Fórmula por cidade e por efeito**, morando na config de `cityWeather.ts` (abordagem coesa,
  alinhada à intenção já documentada: "adicionar efeito futuro = acrescentar à lista aqui").
- **Pancadas:** `+1 a cada 3 dias`, teto **6** (era +1 a cada 2 dias, teto 4).
- **Piso travado no teto:** quando `piso ≥ teto`, a faixa colapsa e a chance fixa no teto — esse é
  o valor de regime do modo infinito.

## Fórmulas

### Chance por dia (uma por dia)

```
lo = min(pisoBase + pisoPorDia * dia, teto)
hi = teto
u  = uniforme[0,1) de rng(seed, dia, <salt do efeito>)
chance(dia) = clamp(round(lerp(lo, hi, u)), 0, 100)
```

Dias `< WEATHER_FIRST_ELIGIBLE_DAY (=3)` → 0 (gate inalterado).

Parâmetros por cidade/efeito:

| cidade | efeito | pisoBase | pisoPorDia | teto |
|--------|--------|----------|------------|------|
| Cerulean (1) | chuva | 40 | 1 | 70 |
| Vermilion (2) | chuva | 15 | 2 | 60 |
| Vermilion (2) | tempestade | 20 | 1 | 50 |

### Pancadas por dia

```
maxTimes(dia) = clamp(⌊dia / 3⌋, 0, 6)
```

`maxStormTimes` continua espelhando `maxRainTimes`. Dia 3→1, 6→2, 9→3, 12→4, 15→5, 18→6.

### Tabelas

Faixa `[piso, teto]` por dia:

| dia | Cerulean chuva | Verm. chuva | Verm. tempestade | pancadas |
|-----|----------------|-------------|------------------|----------|
| 3   | 43–70          | 21–60       | 23–50            | 1        |
| 6   | 46–70          | 27–60       | 26–50            | 2        |
| 9   | 49–70          | 33–60       | 29–50            | 3        |
| 10  | 50–70          | 35–60       | 30–50            | 3        |

Regime infinito (piso = teto): Cerulean chuva fixa em **70%** a partir do **dia 30**; Vermilion
chuva fixa em **60%** a partir do **dia 23**; Vermilion tempestade fixa em **50%** a partir do
**dia 30**.

## Arquitetura

### `src/data/cityWeather.ts`

Cada config de efeito ganha a fórmula:

```ts
export interface WeatherChanceFormula {
  pisoBase: number    // piso conceitual no "dia 0"
  pisoPorDia: number  // quanto o piso sobe por dia
  teto: number        // teto fixo = regime do modo infinito
}
export interface RainEffectConfig  { kind: 'rain';  chance: WeatherChanceFormula }
export interface StormEffectConfig { kind: 'storm'; chance: WeatherChanceFormula }
```

`CITY_WEATHER` passa a embutir os parâmetros da tabela acima. Acrescentam-se acessores para a
fórmula de cada efeito de uma cidade, ex.:

```ts
export function cityRainChance(cityIndex: number): WeatherChanceFormula | null
export function cityStormChance(cityIndex: number): WeatherChanceFormula | null
```

(retornam `null` quando a cidade não tem o efeito — `cityHasRain`/`cityHasStorm` continuam
derivando disso).

### `src/engine/constants.ts`

- `WEATHER_CHANCE_SALT` e `STORM_CHANCE_SALT`: salts **novos e dedicados** ao sorteio da chance,
  para não colidir com o stream do agendamento (que usa `deriveSeed(seed, dia, WEATHER_SEED_SALT)`
  / `STORM_SEED_SALT`).

### `src/engine/weather.ts`

- Nova função genérica pura:
  ```ts
  export function weatherChanceForDay(
    seed: number, day: number, formula: WeatherChanceFormula, salt: number,
  ): number
  ```
  implementa a fórmula de chance acima.
- `rainChanceForDay(seed, day, cityIndex)` passa a ler `cityRainChance(cityIndex)` e delegar a
  `weatherChanceForDay(..., WEATHER_CHANCE_SALT)`; retorna 0 se a cidade não tem chuva ou dia < 3.
- `maxRainTimes(day) = clamp(⌊day/3⌋, 0, 6)`; `RAIN_MAX_TIMES_CAP: 4 → 6`.
- Remover `RAIN_CHANCE_TOTAL_PERCENT`.
- `buildWeatherSchedule` passa `city.index` a `rainChanceForDay`. Resto inalterado (janelas,
  folgas, poças, `extraChancePercent` somado após o sorteio).

### `src/engine/storm.ts`

- `stormChanceForDay(seed, day, cityIndex)` lê `cityStormChance(cityIndex)` e delega a
  `weatherChanceForDay(..., STORM_CHANCE_SALT)`; 0 se a cidade não tem tempestade ou dia < 3.
- `maxStormTimes` continua `= maxRainTimes(day)`.
- Remover `STORM_CHANCE_TOTAL_PERCENT` (de `balance.ts`).
- `buildStorms`/`buildDayWeather` passam `city.index`. Resto inalterado.

### `src/engine/balance.ts`

- Remover `STORM_CHANCE_TOTAL_PERCENT`.

## Capacidade do dia (nota)

`DAY_LENGTH_MS = 180_000` é fixo. Com pancadas de chuva de no mínimo 30s + 4s de folga, **6
chuvas não cabem** num dia (≈5 é o máximo real); o agendador já corta sozinho via `break` quando
`latestStart < cursor`. O teto 6 é um limite de fórmula que raramente satura para chuva no dia
atual; para tempestade (15–30s) cabe folgado. Não é problema — é o comportamento esperado e fica
melhor se um dia futuro do modo infinito for mais longo.

## O que NÃO muda

- Gate dos dias 1–2 (`WEATHER_FIRST_ELIGIBLE_DAY`).
- Agendamento de janelas e folgas (chuva e tempestade), inclusive a tempestade acoplada por chuva.
- Geometria do raio, poças (níveis/secagem), pontos de água.
- Previsão da manhã: `rainAtLeastOnceChance(perEventPercent, count)` e os campos do
  `WeatherForecast`. `perEventPercent` continua sendo a chance do dia; `count` continua sendo
  `maxTimes`.
- `extraChancePercent` (Own Tempo / habilidades): somado **após** o sorteio, com `clamp(…,0,100)`.
- Pureza: tudo continua função pura de `(seed, day, city)`; RNG do clima isolado do cursor da run.

## Testes

- `src/engine/weather.test.ts`: substituir asserts ligados a `RAIN_CHANCE_TOTAL_PERCENT` e ao
  teto 4. Cobrir: chance dentro de `[piso(dia), teto]`; estabilidade por `(seed,dia)`; piso preso
  ao teto no regime (ex.: dia 30+ Cerulean → 70); chance 0 para dia < 3 e cidade sem chuva;
  `maxRainTimes` na nova curva (3→1 … 18→6); funcionamento para `day > 10` (não-zero).
- `src/engine/storm.test.ts`: idem para tempestade (`stormChanceForDay`, teto 50, dia 30+);
  `maxStormTimes` segue `maxRainTimes`.
- `src/data/cityWeather.test.ts`: novos acessores de fórmula; Cerulean sem tempestade → storm
  chance null.
- Ajustar asserts que fixavam valores antigos em `weatherAbilitiesSetup.test.ts`,
  `missionWeather.test.ts`, `cloudNineSetup.test.ts`, `captureWeather*.test.ts`,
  `drySkinClearBodyRework.test.ts` (somente onde dependiam da chance/teto antigos).

## Verificação

`npm run build` (tsc -b) + `npm test`. Sem screenshots/preview.
