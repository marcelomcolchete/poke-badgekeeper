# Swift Swim e Cloud Nine — habilidades secretas de chuva

**Data:** 2026-06-18
**Estado:** aprovado (design), pronto para plano de implementação

## Contexto

A chuva já existe como efeito climático em Cerulean (`engine/weather.ts`,
`data/cityWeather.ts`): cada dia elegível (3–10) tem uma chance de chuva, eventos
de 30–50s pré-computados de forma determinística no `setupDay`, e poças que
bloqueiam quem não surfa/voa. Duas habilidades secretas foram catalogadas como
"(sem efeito até existir clima)" mas já poderiam funcionar agora que a chuva
existe:

- **Swift Swim** (`sa-swift-swim`): "+200% de velocidade do time durante chuva."
- **Cloud Nine** (`sa-cloud-nine`): "+25% de chance de chover ao longo do dia."

Este documento especifica a implementação das duas. As outras habilidades
desabilitadas (Sand Rush, Dry Skin, Overcoat, Ice Body, Own Tempo) dependem de
areia/calor/frio/status que **não existem** e ficam fora de escopo.

## Decisões de design

- **Swift Swim — magnitude e alcance:** +200% = velocidade **×3** enquanto chove.
  Vale em **toda viagem a pé** — missões e exploração/captura, ida e volta. É
  **aditivo** na base (soma com Weak Armor, Fly, etc.).
- **Swift Swim — modelo de tempo:** tempo real ("chuva ao vivo"). Como a agenda de
  chuva é totalmente determinística e conhecida no despacho, posição do sprite e
  horário de chegada saem do **mesmo integrador** (sem dessincronia).
- **Cloud Nine — método:** **+25 pontos percentuais** na chance de chuva do dia
  (não multiplicativo), com teto de 100%.
- **Cloud Nine — empilhamento:** **por portador** no roster (igual ao Forewarn:
  "cada portador antecipa mais uma"). N portadores → +25·N pontos percentuais.
- **Aura visual:** reaproveita a aura `speedy` existente (igual ao Weak Armor),
  sem CSS novo.

## Arquitetura

### 1. Dados e texto — `data/secretAbilities.ts`

- **Swift Swim** (`sa-swift-swim`): remover "(sem efeito até existir clima)".
  Texto novo: *"+200% de velocidade do time enquanto chove."*
- **Cloud Nine** (`sa-cloud-nine`): texto novo:
  *"+25 pontos percentuais na chance de chover hoje (acumula por portador)."*
- **Sand Rush** (`sa-sand-rush`): permanece com o aviso de desabilitada.

### 2. Swift Swim — modelo de velocidade (núcleo)

A velocidade do time vira uma **função degrau** do tempo:

```
m(t) = m₀ + (time tem swimmer && chovendo em t ? SWIFT_SWIM_RAIN_BONUS : 0)
```

onde `m₀` é o multiplicador constante atual de
`teamTravelSpeedMultiplier(team, runItems)` (Weak Armor / Fly / Lagging Tail) e
`SWIFT_SWIM_RAIN_BONUS = 2` (aditivo → ×3 durante a chuva). "Chovendo em t" usa a
janela do **evento de chuva** (`isRaining` / `activeRainEvent`), não a secagem da
poça.

Como a agenda de chuva é conhecida por inteiro no despacho, a distância percorrida
desde o início da perna é a **integral fechada** dessa função degrau:

```
covered(t) = (1/k) · [ m₀·(t − legStart) + SWIFT_SWIM_RAIN_BONUS·rainyMs(legStart, t) ]
```

onde `k = TRAVEL_MS_PER_DISTANCE · agilityTravelFactor(team)` (a mesma constante de
`graphTravelMs`) e `rainyMs(a,b)` é o total de tempo de chuva em `[a,b]`.

**Novo módulo puro `engine/rainSpeed.ts`:**

- `rainyMsBetween(schedule, a, b): number` — soma das interseções das janelas de
  chuva (`schedule.rain[i].startMs..endMs`) com `[a,b]`.
- `swiftLegArrivalMs({ schedule, startMs, distance, team, runItems }): number` —
  inverte a integral para achar o `t` em que `covered(t) = distance`, caminhando
  pelas (≤4) janelas de chuva. Usado no despacho para gravar `arriveAtMs` /
  `returnEndsAtMs`.
- `swiftLegFraction({ schedule, startMs, distance, team, runItems, nowMs }): number`
  — `covered(nowMs) / distance`, com clamp em `[0,1]`. Usado para a posição do
  sprite.

**Backward-compat:** time sem swimmer, ou dia/cidade sem chuva, tem `m(t) = m₀`
constante → a integral vira reta e o comportamento é idêntico ao atual. Por isso o
caminho do integrador só é exercido por times Swift Swim sob chuva; todos os
demais seguem o `elapsedFraction` linear de hoje. Risco isolado.

**Pontos de costura:**

- `game/missionFlow.ts` (`acceptMission`): se o time é Swift Swim e há chuva no
  dia, `arriveAtMs`/`resolveAtMs`/`returnEndsAtMs` derivam de `swiftLegArrivalMs`
  por perna; senão, mantém o cálculo atual via `graphTravelMs(... speedMult)`.
- `game/captureFlow.ts` (ida e volta da exploração/captura): mesmo tratamento.
- A posição do sprite (`missionTravelerPos` em `CityMap.tsx` e os blocos de
  captura/retorno) usa `swiftLegFraction` em vez de `elapsedFraction` para times
  Swift Swim sob chuva.

### 3. Swift Swim — interação com poças

Poças bloqueiam apenas quem não surfa/voa. Um time Swift Swim **não-surfista** sob
chuva continua sujeito a desvio/espera (`planWeatherLeg` em `weatherTravel.ts`,
aplicado por `applyWeatherHold` no `missionFlow.ts` e pelo fluxo equivalente em
`captureFlow.ts`). Composição:

- O tratamento de poça continua mudando o **caminho** (reroute) e inserindo
  **esperas** (progresso congelado).
- Para times Swift Swim, a chegada da perna é **recalculada pelo integrador**
  (`swiftLegArrivalMs` sobre o caminho/distância atuais) quando o caminho muda
  (reroute) ou uma espera resolve — em vez do delta-shift incremental atual. A
  espera é um intervalo de **taxa zero** (nenhuma distância coberta), e o
  integrador já lida com isso porque `covered` só avança com o tempo de
  movimento.
- Times **não-Swift** seguem exatamente o fluxo de delta-shift de hoje
  (`shiftMissionTimestamps`), sem mudança.

Este é o ponto de maior cuidado/teste, mas é **estreito**: boa parte da linha de
água também desbloqueia Surf, e um time surfista ignora poça (`teamSurfs` →
`applyWeatherHold` retorna cedo). O caso real é "Swift Swim, sem Surf, sem voo,
debaixo de chuva".

### 4. Swift Swim — aura visual

Em `CityMap.tsx` (hoje em `teamTravelSpeedMultiplier(team, runItems) > 1`), o flag
`speedy` passa a ser:

```ts
teamTravelSpeedMultiplier(team, runItems) > 1
  || (teamHasSwiftSwim(team) && isRaining(state.weather, now))
```

A aura acende/apaga **em tempo real** junto com a chuva. Reusa o `speedAura`
existente — sem CSS novo.

### 5. Cloud Nine — chance de chuva

`game/setup.ts` (`setupDay`) conta os portadores no roster e passa o bônus para a
construção da agenda:

```ts
const cloudNine = s.roster.filter(hasCloudNine).length
s.weather = buildWeatherSchedule(s.run.seed, s.run.day, city,
  cloudNine * CLOUD_NINE_RAIN_CHANCE_BONUS_PP)
```

`engine/weather.ts` (`buildWeatherSchedule`) ganha um parâmetro
`extraChancePercent = 0` e aplica:

```ts
const chance = clamp(rainChanceForDay(seed, day) + extraChancePercent, 0, 100)
```

- A guarda atual (`day < WEATHER_FIRST_ELIGIBLE_DAY || !cityHasRain(...)` →
  `emptyWeatherSchedule`) **permanece**: Cloud Nine não faz chover em dia 1–2 nem
  em cidade sem chuva — só reforça onde já é possível.
- A chance turbinada alimenta tanto `forecast.rainChancePercent` (a previsão da
  manhã reflete o número) quanto os sorteios `rng.bool(chance/100)` de cada
  evento.
- O RNG do clima é a stream própria salgada (`WEATHER_SEED_SALT`) e o número de
  draws não muda (continua `maxRainTimes` eventos), então o cursor de RNG da run
  (missões/captura/defesa) permanece intacto.

### 6. Predicados e constantes

- `engine/secretEffects.ts`: adicionar `teamHasSwiftSwim(team)` e `hasCloudNine(p)`.
  (`hasSwiftSwim(p)` já existe.)
- `engine/balance.ts`: `SWIFT_SWIM_RAIN_BONUS = 2`,
  `CLOUD_NINE_RAIN_CHANCE_BONUS_PP = 25`.

## Testes

- **`rainSpeed` (novo):** integral/inversa coerentes; sem chuva = comportamento
  linear; chuva parcial na perna; múltiplas janelas; espera como intervalo de taxa
  zero.
- **Swift Swim (`missionWeather`/`captureWeather`):** time Swift Swim chega antes
  sob chuva; `arriveAtMs` bate com `swiftLegFraction(now=arrive) == 1`; reroute por
  poça recalcula a chegada corretamente.
- **Aura (`CityMap`):** `speedy` liga durante a chuva para time Swift Swim e
  desliga quando para (e segue ligada para Weak Armor como hoje).
- **Cloud Nine (`weather`/`setup`):** +25pp por portador; teto em 100%; sem chuva
  em dia 1–2 e em cidade sem chuva mesmo com portadores; determinismo da run
  preservado (cursor de RNG da run inalterado).

## Fora de escopo

Sand Rush, Dry Skin, Overcoat (dependem de tempestade de areia / calor / frio que
não existem), Ice Body e Own Tempo (dependem de status de congelamento / confusão
que não existem). Permanecem com o aviso de desabilitadas no catálogo.
