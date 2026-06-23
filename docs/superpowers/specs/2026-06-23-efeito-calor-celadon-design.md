# Efeito climático "Calor" (Celadon) + habilidades de calor

**Data:** 2026-06-23
**Branch:** `feat/clima-calor-celadon` (de `origin/main`)
**Status:** design aprovado, pronto para plano de implementação.

## Objetivo

Adicionar um terceiro efeito climático — **Calor** — disponível a partir de **Celadon**
(índice de cidade `3`). O Calor é uma janela de tempo (como chuva e tempestade) que, enquanto
ativa, **reduz em 80% a velocidade de viagem a pé** de todos os times (missões *e*
captura/exploração). Aproveita-se para **ligar as habilidades de calor hoje inertes**: Ice Body,
Clear Body (imunidade) e Dry Skin (penalidade), além de **Chlorophyll** (imune + ganho de
velocidade), que já está no jogo aguardando o clima de calor existir.

Celadon também passa a ter chuva e tempestade, com fórmulas próprias.

## Requisitos (do pedido)

Para cada "pancada" (evento potencial) em Celadon, a chance é sorteada por dia assim:

| Efeito     | Chance por pancada            | Fórmula `{pisoBase, pisoPorDia, teto}` |
|------------|-------------------------------|----------------------------------------|
| Calor      | de `(20 + DiaAtual)%` até 50% | `{ 20, 1, 50 }`                        |
| Chuva      | de `(10 + DiaAtual)%` até 40% | `{ 10, 1, 40 }`                        |
| Tempestade | de `(5  + DiaAtual)%` até 20% | `{ 5,  1, 20 }`                        |

- **Duração** de cada Calor: **30–60s** de tempo de jogo.
- **Quantidade de pancadas/dia**: o mesmo min/max de chuva e tempestade (a curva
  `maxRainTimes(day)`: +1 a cada 3 dias, teto 6).
- **Efeito do Calor**: `−80%` de velocidade dos pokémons nas viagens (missões + captura/exploração).
- **Habilidades de calor** (hoje sem efeito): ganham comportamento agora.

## Por que isto encaixa no que já existe

O sistema de clima é determinístico e por-cidade:

- `data/cityWeather.ts` lista, por cidade e em ordem, os efeitos possíveis, cada um com uma
  `WeatherChanceFormula { pisoBase, pisoPorDia, teto }`. O sorteio do dia
  (`weatherChanceForDay`) faz `lo = min(pisoBase + pisoPorDia·dia, teto)` e sorteia em
  `[lo, teto]` — exatamente o formato "de `(X + Dia)%` até `teto`" do pedido.
- A agenda do dia (`s.weather`, tipo `WeatherSchedule`) é pré-computada em `setupDay` e
  reproduzível por `(seed, dia, cidade)`, com RNG isolado por salt. A presença de chuva/raio em
  qualquer instante é função pura de `now`.
- A chuva **não** desacelera ninguém por si: ela cria poças (obstáculos) e o **Swift Swim**
  *acelera* `+200%` enquanto chove. Esse ganho é integrado em degraus pelo `rainTravelMs`
  (`engine/rainSpeed.ts`), que **missão e captura já usam** (4 call-sites). O Calor é o inverso:
  um degrau de `×0,2` aplicado a todos, salvo imunes.

## Arquitetura

### 1. Modelo de dados por cidade — `data/cityWeather.ts`

- Estende `WeatherEffectKind` com `'heat'`.
- Novo `HeatEffectConfig { kind: 'heat'; chance: WeatherChanceFormula }` na união `WeatherEffectConfig`.
- Registra **Celadon (índice 3)** na ordem do pedido (a previsão da manhã segue a ordem da lista):

  ```ts
  3: {
    effects: [
      { kind: 'heat',  chance: { pisoBase: 20, pisoPorDia: 1, teto: 50 } },
      { kind: 'rain',  chance: { pisoBase: 10, pisoPorDia: 1, teto: 40 } },
      { kind: 'storm', chance: { pisoBase: 5,  pisoPorDia: 1, teto: 20 } },
    ],
  }
  ```

- Helpers novos espelhando chuva/tempestade: `cityHasHeat(i)`, `cityHeatChance(i)`.

### 2. Schedule do Calor — `engine/heat.ts` (novo, espelha `engine/storm.ts`)

O Calor é a janela mais simples: **sem sub-objetos** (não tem poça nem raio).

- `interface HeatEvent { startMs: number; endMs: number }`.
- `maxHeatTimes(day) = maxRainTimes(day)` — mesma curva de pancadas/dia.
- `heatChanceForDay(seed, day, cityIndex)` — usa `weatherChanceForDay(..., HEAT_CHANCE_SALT)`.
- `buildHeat(seed, day, city, extraChancePercent = 0, maxEvents?)` — gera janelas
  não-sobrepostas (duração 30–60s, folga `HEAT_GAP_MS`), cada uma ocorrendo por sorteio vs a
  chance do dia. Estrutura idêntica ao laço de chuvas próprias em `buildWeatherSchedule`.
- `activeHeatAt(events, now)`, `isHot(events, now)`.

**Constantes novas** em `engine/balance.ts`:

- `HEAT_EVENT_MIN_MS = 30_000`, `HEAT_EVENT_MAX_MS = 60_000` (duração 30–60s).
- `HEAT_GAP_MS = 4_000` (folga entre janelas, espelha `RAIN_GAP_MS`).
- `HEAT_SLOW_FACTOR = 0.2` (o `−80%`).
- `CHLOROPHYLL_HEAT_BONUS_L1 = 2`, `CHLOROPHYLL_HEAT_BONUS_L2 = 3` (espelham `SWIFT_SWIM_RAIN_BONUS = 2`).

**Salts novos** em `engine/constants.ts`: `HEAT_SEED_SALT`, `HEAT_CHANCE_SALT` (streams de RNG
isolados — não tocam chuva, tempestade nem o cursor da run).

### 3. `WeatherSchedule` e montagem do dia — `engine/weather.ts` + `engine/storm.ts`

- `WeatherSchedule` ganha `heat: HeatEvent[]`. `emptyWeatherSchedule()` inclui `heat: []`.
- `WeatherForecast` ganha `heatChancePercent` e `potentialHeatCount` (zerados no schedule vazio).
- `buildDayWeather(...)` ganha o parâmetro `extraHeatChancePercent` e passa a montar os três
  efeitos. **Precedência de orçamento** quando há cap de Own Tempo (`maxWeatherEvents`):
  **chuva → tempestade → calor** (o calor usa o que sobrar do teto). Documentado no código.
  - `heatCap = maxWeatherEvents > 0 ? max(0, maxWeatherEvents − rain.length − storms.length) : undefined`.

### 4. Integrador de viagem generalizado — `engine/rainSpeed.ts` → `weatherTravelMs`

Renomeia `rainTravelMs` → `weatherTravelMs` e atualiza os **4 call-sites** (missão ida/volta em
`game/missionFlow.ts`; captura ida/volta em `game/captureFlow.ts`).

- Os degraus de velocidade vêm da **união** das janelas de chuva e de calor.
- Taxa de cada trecho:

  ```
  rate = base × (quente && !imuneAoCalor ? HEAT_SLOW_FACTOR : 1)
       + (quente ? bônusChlorophyll : 0)
       + (chovendo && time tem Swift Swim ? SWIFT_SWIM_RAIN_BONUS : 0)
  ```

  onde `base = teamTravelSpeedMultiplier(...)`. O modelo é o do Swift Swim: bônus **aditivos** ao
  multiplicador; o calor é um fator **multiplicativo** `×0,2` sobre a base.
- **Atalho linear preservado** (regressão): se `schedule.heat` está vazio **e** (sem Swift Swim
  **ou** sem chuva) → `need / base`, idêntico ao comportamento atual.
- O `speedMult` **instantâneo** usado no `extraMs` do desvio/espera de poça
  (`applyWeatherHold` em `missionFlow.ts` e o trecho equivalente em `captureFlow.ts`) passa a
  incluir o fator de calor + bônus Chlorophyll, para o atraso do reroute ficar coerente com a taxa
  do momento.

### 5. Imunidade e habilidades de calor — `engine/secretEffects.ts` + `game/missionFlow.ts`

**Imunidade ao slowdown (nível de time, como Swift Swim / Lightning Rod):**

- `teamImmuneToHeat(team)` ← verdadeiro se algum membro despachado tem **qualquer** de:
  - **Ice Body** (≥ 1): "time não recebe efeito negativo do calor".
  - **Clear Body** (≥ 1): "time não recebe efeitos negativos de clima" — o slowdown de calor é um
    efeito negativo de clima, então a imunidade L1 se estende a ele (mesma família da paralisia do
    raio). *(Confirmado com o usuário.)*
  - **Chlorophyll** (≥ 1): quem ganha velocidade no calor não sofre o `−80%`.

**Chlorophyll — ganho de velocidade (novo nesta feature):**

- `teamHeatSpeedBonus(team)` ← maior bônus de Chlorophyll entre os membros: `0`, `2` (L1) ou
  `3` (L2). Aditivo, aplicado **só durante o calor**, dentro do integrador (item 4).
- Chlorophyll está nas linhas de **Bulbasaur (1)** e **Oddish (43)** — grama de Celadon.

**Dry Skin — liga as cláusulas de calor inertes (espelha a chuva):**

- **L1 e L2** — ao despachar **com calor ativo agora** (`isHot(s.weather, now)`): `−25%` de vida
  (`ceil(DRY_SKIN_RAIN_HEAL_FRAC · maxHp)`), com piso de **1** de vida (não desmaia no despacho).
  Espelha o `+25%` de cura da chuva, no mesmo ponto de `dispatchMission`.
- **L2** — em missão durante o calor: `−25%` nos atributos via `missionAttrMultiplier`
  (`× (1 − DRY_SKIN_MISSION_BONUS_L2)`, i.e. `×0,75`). Por ser `mult < 1`, é **anulado por
  Clear Body L2** (regra já existente — sem código novo). Espelha o `+25%` da chuva.
- O malefício do Dry Skin no calor é o **tradeoff da própria habilidade** (como na chuva ele
  cura): aplica sempre que quente, **independente** da imunidade de time do Ice Body — mantém a
  simetria com a chuva.

### 6. Previsão e UI

- **`components/screens/DayForecastPanel.tsx`**: nova linha "Calor" na previsão da manhã, na ordem
  da cidade (Calor → Chuva → Tempestade em Celadon). Ícone/cor de calor (sol/laranja) — CSS leve em
  `DayForecastPanel.module.css`.
- **`components/day/WeatherBadge.tsx`**: novo selo "Calor" quando `isHot(now)` (espelha os selos de
  chuva/tempestade que seguem `isRaining`/`isStorming`).
- `teamIsSpeedy(...)` em `secretEffects.ts` passa a marcar a aura de "veloz" também quando há
  Chlorophyll no time e está quente agora (efeito ao vivo, como o Swift Swim na chuva).

### 7. Persistência — `engine/constants.ts` + `persistence/saveLoad.ts`

- `SAVE_VERSION` 37 → **38**. `WeatherSchedule` ganha `heat`; a previsão ganha
  `heatChancePercent` / `potentialHeatCount`.
- Migração: inicia `heat: []` e zera os dois campos de previsão de calor — tudo recomputado no
  próximo `setupDay` (espelha a migração v33 da tempestade). Saves antigos não quebram.

### 8. Integração dos vieses de clima — `game/setup.ts`

Hoje `setupDay` calcula `rainDelta`/`stormDelta` (Cloud Nine, Overcoat) e `ownTempoCap`. O calor
entra de forma consistente:

- **Cloud Nine** ("+chuva / −outros efeitos"): o calor é "outro efeito" → recebe o mesmo `−Xpp`
  que a tempestade hoje recebe (`heatDelta -= CLOUD_NINE_OTHER_PP_*`).
- **Overcoat** ("−qualquer efeito"): aplica `−Xpp` também ao calor.
- **Own Tempo**: o calor entra no orçamento global `maxWeatherEvents` (precedência chuva →
  tempestade → calor, item 3).
- `setup.ts` calcula `heatDelta` ao lado de `rainDelta`/`stormDelta` e o repassa a
  `buildDayWeather`.

## Fluxo (resumo)

```
setupDay(seed, dia, cidade=Celadon)
  └─ buildDayWeather(seed, dia, city, rainDelta, stormDelta, heatDelta, ownTempoCap)
       ├─ chuva  (engine/weather.ts) → poças + Swift Swim
       ├─ tempestade (engine/storm.ts) → raios (encadeiam nas poças)
       └─ calor  (engine/heat.ts) → janelas 30–60s
  → s.weather = { rain, storms, heat, forecast }

despacho/tick de missão ou captura
  └─ weatherTravelMs(s.weather, now, distância, time, …)
       integra: base × (quente&&!imune ? 0,2 : 1) + bônusChlorophyll(quente) + bônusSwiftSwim(chovendo)
  └─ Dry Skin: se quente no despacho, −25% vida (piso 1); L2 −25% atributos (anulável por Clear Body L2)
```

## Testes (Vitest, espelhando os de tempestade/chuva)

- `engine/heat.test.ts` (novo): chance do dia bate com `{20,1,50}` (e colapso no teto quando
  `20 + dia ≥ 50`); `maxHeatTimes` = curva da chuva; `buildHeat` gera janelas 30–60s
  não-sobrepostas e respeita o sorteio; `isHot` / `activeHeatAt`.
- `engine/rainSpeed.test.ts` (estende): **regressão do Swift Swim** (sem calor, idêntico ao atual)
  + slowdown de calor isolado + **sobreposição chuva ∩ calor** + imunidade (Ice Body / Clear Body /
  Chlorophyll) cancela o degrau + **Chlorophyll** `+200%`/`+300%` no calor (com e sem chuva).
- `engine/secretEffects.test.ts` (estende): `teamImmuneToHeat` (Ice Body, Clear Body L1,
  Chlorophyll) e `teamHeatSpeedBonus` (0 / 2 / 3).
- Dry Skin (estende `game/drySkinClearBodyRework.test.ts`): `−25%` de vida no despacho com calor
  (piso 1) + `−25%` de atributos L2 no calor, anulado por Clear Body L2.
- `game/weatherAbilitiesSetup.test.ts` (estende): Cloud Nine / Overcoat / Own Tempo afetando o
  calor (`heatDelta` e orçamento).
- `data/cityWeather.test.ts` (estende): Celadon tem os 3 efeitos na ordem certa, com as fórmulas
  do pedido.
- Verificação final: `npm run build` (tsc -b) **e** `npm test`.

## Fora de escopo (YAGNI)

- **Som** próprio de calor e **overlay/tinta** de calor no mapa (a chuva tem `rainPlayer`, a
  tempestade `thunderPlayer`; o calor entra só com selo + previsão). Melhoria futura.
- Outras cidades além de Celadon terem calor (trivial depois: somar à lista da cidade).
- Berries / Gluttony e demais habilidades não relacionadas a calor.

## Decisões registradas

- **Alcance do `−80%`:** missões **e** captura/exploração (toda viagem a pé). Coberto de uma vez
  pela generalização do `weatherTravelMs`, já compartilhado pelos dois fluxos.
- **Clear Body L1** dá imunidade ao slowdown de calor (além de Ice Body), por ser "efeito negativo
  de clima".
- **Dry Skin** no calor aplica o `−25%` mesmo com time imune (tradeoff da própria habilidade,
  simétrico ao `+25%` da chuva).
- **Chlorophyll** entra **nesta feature** (não mais deferida): imune ao calor + `+200%/+300%` de
  velocidade, no mesmo integrador.
- **Modelagem do slowdown:** integrador único (`weatherTravelMs`) sobre a união das janelas —
  não um `heatTravelMs` separado (composição de integrais de funções-degrau sobrepostas é
  incorreta) nem slowdown chapado por perna (impreciso vs a janela de 30–60s).
