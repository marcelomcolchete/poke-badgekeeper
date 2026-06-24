# Efeitos climáticos "Snowstorm" (nevasca) e "Sandstorm" (tempestade de areia)

**Data:** 2026-06-24
**Branch:** `feat/clima-snowstorm-sandstorm` (de `origin/main`)
**Status:** design aprovado, pronto para plano de implementação.

## Objetivo

Adicionar dois efeitos climáticos novos (4º e 5º), distribuídos por **quatro cidades hoje sem
clima**:

- **Snowstorm (nevasca)** — efeito de **estado acumulado por time**: a cada 2s viajando sob a
  nevasca, o time perde velocidade (−20% composto), até congelar e tomar dano; voadores morrem ao
  congelar.
- **Sandstorm (tempestade de areia)** — efeito de **roteamento**: o time não vai direto à missão;
  primeiro se "perde" indo a um ponto aleatório do mapa, e só então segue ao destino.

Aproveita-se para dar clima às cidades **Fuchsia (4)**, **Saffron (5)**, **Cinnabar (6)** e
**Viridian (7)**, cada uma com um conjunto temático de efeitos (incluindo chuva/tempestade/calor já
existentes). **Pewter (0)** permanece sem clima.

## Requisitos (do pedido)

### Snowstorm

- A cada **2s** que um time passa **viajando** (a caminho de / voltando de **qualquer** missão)
  sob a nevasca, **−20% de velocidade** (composto: `0,8^stacks`), mostrando um efeito de
  congelamento, até **5 vezes**.
- No **5º stack** o time **congela**: para no lugar e **perde 1 de vida a cada 2s**.
  **Pokémon voadores (fly) morrem ao congelar** (time desmaia, missão falha).
- Quando a nevasca **termina**, o time **descongela 2s depois** e volta à velocidade normal (zera
  os stacks).
- **Stacks só sobem viajando** e **resetam ao chegar no destino de cada perna** (ex.: +2 na ida,
  zera ao chegar na missão, +4 na volta).
- Pokémon **sem fly** que zera HP pelo congelamento **desmaia, mas os sobreviventes seguem** a
  missão (pode falhar depois pela regra normal).
- **Clear Body** dá imunidade total à nevasca (sem stacks, sem freeze, sem dano) — espelha a
  imunidade do Clear Body à tempestade.
- Alcance: **toda viagem** — missões (ida/volta), buscas e retornos de captura.

### Sandstorm

- Pokémon que saem em missão sob sandstorm **nunca vão direto**: primeiro tentam ir a um **ponto
  aleatório qualquer no mapa** (como se estivessem perdidos) e depois seguem à missão.
- Se a sandstorm **acaba** no meio do trajeto, **recalculam da posição atual** e vão direto ao
  destino.
- Vale **também na volta** da missão, em **buscas/retornos de captura** e para **times voadores**
  (fly também desvia).
- O ponto aleatório é **1 por perna**, sempre **alcançável** pelo time (respeita Surf), semeado
  (determinístico).

### Distribuição por cidade (chance por evento e ordem da previsão)

Fórmula `{ pisoBase, pisoPorDia, teto }` (igual aos efeitos atuais: `lo = min(pisoBase +
pisoPorDia·dia, teto)`, sorteia em `[lo, teto]`). Quantidade/dia = curva `maxRainTimes(day)`
(+1 a cada 3 dias, teto 6). Durações: **snowstorm 40–70s**, **sandstorm 30–60s**.

| Cidade (índice)  | Efeitos (ordem da previsão) | `{ pisoBase, pisoPorDia, teto }` |
|------------------|-----------------------------|----------------------------------|
| **Fuchsia (4)**  | Chuva                       | `{ 20, 1, 50 }`                  |
|                  | Sandstorm                   | `{ 15, 1, 45 }`                  |
|                  | Calor                       | `{ 12, 1, 35 }`                  |
| **Saffron (5)**  | Snowstorm ⭐                 | `{ 25, 1, 60 }`                  |
|                  | Chuva                       | `{ 12, 1, 40 }`                  |
|                  | Tempestade                  | `{ 8,  1, 30 }`                  |
| **Cinnabar (6)** | Calor ⭐                     | `{ 30, 1, 65 }`                  |
|                  | Tempestade                  | `{ 12, 1, 40 }`                  |
|                  | Sandstorm                   | `{ 10, 1, 35 }`                  |
| **Viridian (7)** | Sandstorm ⭐                 | `{ 25, 1, 60 }`                  |
|                  | Chuva                       | `{ 12, 1, 40 }`                  |
|                  | Tempestade                  | `{ 8,  1, 30 }`                  |
|                  | Snowstorm                   | `{ 8,  1, 28 }`                  |

Nenhuma cidade junta **snowstorm + calor** (evita dois slowdowns brigando). **Viridian** junta
snowstorm + sandstorm, que **podem se sobrepor** no tempo.

## Por que isto encaixa no que já existe

O sistema de clima é determinístico e por-cidade:

- `data/cityWeather.ts` lista, por cidade e em ordem, os efeitos possíveis, cada um com uma
  `WeatherChanceFormula`. O sorteio do dia (`weatherChanceForDay`) já é o formato do pedido.
- A agenda do dia (`s.weather: WeatherSchedule`) é pré-computada em `setupDay`, reproduzível por
  `(seed, dia, cidade)`, com RNG isolado por salt. **Snowstorm e sandstorm são, no schedule, apenas
  janelas `{ startMs, endMs }`** (como o Calor) — toda a complexidade vive no runtime do tick.
- **Snowstorm** combina dois padrões já testados:
  1. `game/stormFlow.ts::processStorms(s, prevMs, nowMs)` — muta HP/desmaio/morte-voadora por tick,
     dependente de posição, robusto a saltos de tempo.
  2. `game/missionFlow.ts::applyWeatherHold` e `stormFlow.ts::freezeContainer` — já **congelam um
     container** numa posição e **empurram os timestamps** da perna (`shiftMissionTimestamps`).
- **Sandstorm** reusa o mecanismo de **`reroutePath`** (hoje usado pelo desvio de poças) +
  `pointAlongPath` + recálculo a partir da posição atual.

## Arquitetura

### 1. Modelo de dados por cidade — `data/cityWeather.ts`

- Estende `WeatherEffectKind` com `'snowstorm' | 'sandstorm'`.
- Novos `SnowstormEffectConfig { kind: 'snowstorm'; chance }` e
  `SandstormEffectConfig { kind: 'sandstorm'; chance }` na união `WeatherEffectConfig`.
- Registra Fuchsia(4)/Saffron(5)/Cinnabar(6)/Viridian(7) com as fórmulas da tabela acima.
- Helpers novos espelhando os existentes: `cityHasSnow(i)`, `citySnowChance(i)`,
  `cityHasSand(i)`, `citySandChance(i)`.

### 2. Schedules — `engine/snow.ts` e `engine/sand.ts` (novos, espelham `engine/heat.ts`)

Ambos só janelas (sem sub-objetos no schedule):

- `engine/snow.ts`:
  - `maxSnowTimes(day) = maxRainTimes(day)`.
  - `snowChanceForDay(seed, day, cityIndex)` via `weatherChanceForDay(..., SNOW_CHANCE_SALT)`.
  - `buildSnow(seed, day, city, extraChancePercent = 0, maxEvents?)` — janelas 40–70s
    não-sobrepostas, folga `SNOW_GAP_MS`, cada uma por sorteio (estrutura idêntica a `buildHeat`).
  - `activeSnowAt(events, now)`, `isSnowing(events, now)`, e
    `snowExposureMs(events, fromMs, toMs)` — soma da interseção de `(fromMs, toMs]` com as janelas
    (usada pelo runtime; pura e testável).
  - `snowWindowEndAt(events, now)` — fim da janela ativa em `now` (para calcular `thawAtMs`).
- `engine/sand.ts`:
  - `maxSandTimes(day) = maxRainTimes(day)`, `sandChanceForDay(...)` via `SAND_CHANCE_SALT`.
  - `buildSand(...)` — janelas 30–60s não-sobrepostas (espelha `buildHeat`).
  - `activeSandAt(events, now)`, `isSanding(events, now)`.
  - `pickLostNode(rng, graph, originNode, destNode, team, runItems)` — sorteia um nó **alcançável**
    do `originNode` pelo time (respeita Surf via a mesma checagem de `travelRoute`), `≠ origem` e
    `≠ destino`. Determinístico (RNG passado pelo chamador, semeado).

**Constantes** (`engine/balance.ts`):
`SNOW_EVENT_MIN_MS=40_000`, `SNOW_EVENT_MAX_MS=70_000`, `SNOW_GAP_MS=4_000`,
`SAND_EVENT_MIN_MS=30_000`, `SAND_EVENT_MAX_MS=60_000`, `SAND_GAP_MS=4_000`,
`SNOW_STACK_INTERVAL_MS=2_000`, `SNOW_SLOW_PER_STACK=0.8`, `SNOW_MAX_STACKS=5`,
`SNOW_FREEZE_DAMAGE=1`, `SNOW_FREEZE_DAMAGE_INTERVAL_MS=2_000`, `SNOW_THAW_MS=2_000`.

**Salts** (`engine/constants.ts`): `SNOW_SEED_SALT`, `SNOW_CHANCE_SALT`, `SAND_SEED_SALT`,
`SAND_CHANCE_SALT` (streams isolados — não tocam o cursor da run nem os outros climas).

### 3. `WeatherSchedule` e montagem do dia — `engine/weather.ts` + `engine/storm.ts`

- `WeatherSchedule` ganha `snow: SnowEvent[]` e `sand: SandEvent[]` (tipos exportados de
  `snow.ts`/`sand.ts` ou re-declarados em `weather.ts`, seguindo `HeatEvent`).
  `emptyWeatherSchedule()` inclui ambos vazios.
- `WeatherForecast` ganha `snowstormChancePercent` / `potentialSnowstormCount` e
  `sandstormChancePercent` / `potentialSandstormCount` (zerados no schedule vazio).
- `buildDayWeather(...)` ganha `extraSnowChancePercent` e `extraSandChancePercent` e anexa os dois
  novos efeitos. **Precedência de orçamento Own Tempo** (`maxWeatherEvents`):
  **chuva → tempestade → calor → snowstorm → sandstorm** (cada um usa o que sobrar do teto).

### 4. Estado por container — `engine/state.ts`

Os três containers que já têm `paralyzeHold`/`weatherHold`/`reroutePath` (`MissionInstance`,
`CaptureSearch`, `CaptureReturn`) ganham:

```ts
/** Estado da nevasca para esta perna (limpo ao chegar no destino e ao descongelar). */
snow?: {
  stacks: number          // 0..5 na perna atual
  exposureMs: number      // tempo viajado sob nevasca nesta perna (gera os stacks)
  frozenAtMs?: number     // instante em que atingiu 5 stacks (início do freeze)
  lastDrainMs?: number    // instante do último -1 HP (a cada 2s congelado)
  thawAtMs?: number       // descongela aqui (fim da janela ativa + SNOW_THAW_MS)
}
/** Marca que reroutePath é um desvio de sandstorm (para recálculo ao acabar). */
sandDetour?: { lostNode: string }
```

`reroutePath` (já existe nos três) é reusado pelo sandstorm.

### 5. Runtime do Snowstorm — `game/snowFlow.ts` (novo, espelha `stormFlow.ts`)

`processSnow(s, prevMs, nowMs)` no tick do dia (`advanceDay`/onde `processStorms` já é chamado).
Para cada container **em perna de viagem** (`traveling`/`returning`; busca `traveling`; retorno):

1. **Imunidade Clear Body:** se o time do container tem Clear Body → limpa qualquer `snow` e pula
   (reusa `hasClearBody` + `containerTeamIds`).
2. **Sem nevasca ativa agora:** não acumula. Se havia `snow` e a janela acabou, agenda/respeita
   `thawAtMs` (passo 6).
3. **Acúmulo:** `exposureMs += snowExposureMs(s.weather.snow, prevMs, nowMs)` (limitado à fração em
   que o container realmente viajou na janela). `stacks = min(SNOW_MAX_STACKS,
   floor(exposureMs / SNOW_STACK_INTERVAL_MS))`.
4. **Slowdown (stacks 1–4):** taxa `SNOW_SLOW_PER_STACK^stacks`. O atraso extra do trecho viajado
   neste tick é empurrado via `shiftMissionTimestamps(..., extraMs)` (mesma técnica de
   `applyWeatherHold`; o `speedMult` instantâneo passa a considerar a nevasca).
5. **Freeze (5º stack):** grava `frozenAtMs = nowMs` e `thawAtMs = snowWindowEndAt(...) +
   SNOW_THAW_MS`. A posição congela (ver §7) e os timestamps deslocam pelo tempo parado.
   - **Voador** (`container.flying`) → morte imediata: reusa `killFlyingContainer` (time desmaia,
     missão `resolved/failure`; busca/retorno removidos).
   - **Terrestre** → enquanto `nowMs < thawAtMs`: a cada `SNOW_FREEZE_DAMAGE_INTERVAL_MS` desde
     `lastDrainMs`, `−SNOW_FREEZE_DAMAGE` HP por membro. Se um membro chega a 0,
     `settleFaintTracked` (desmaia) e **sobreviventes seguem**. Robusto a saltos: aplica
     `floor((nowMs − lastDrainMs)/interval)` drenos de uma vez.
6. **Thaw:** quando `nowMs ≥ thawAtMs` (nevasca acabou + 2s), limpa `snow`; velocidade/posição
   voltam ao normal e os timestamps seguem deslocados (a perna apenas terminou mais tarde).
7. **Reset por perna:** na transição `traveling→inProgress` e no fim da volta
   (`freeOnReturn`), limpa `snow` (espelha a limpeza de `weatherHold`/`reroutePath` que já ocorre
   em `advanceMission`). O nó aleatório do sandstorm é meio-de-perna e **não** reseta.

**Refactor alvo:** extrair `killFlyingContainer`, `containerTeamIds`, `isInFlyingContainer` de
`stormFlow.ts` para `game/containers.ts` compartilhado; `snowFlow` e `stormFlow` reusam. Mantém os
dois flows enxutos e a morte-voadora consistente entre raio e gelo.

### 6. Runtime do Sandstorm — `game/sandFlow.ts` (novo, espelha o desvio de `applyWeatherHold`)

`applySandDetour(s, container, nowMs)` no tick (antes de `processSnow`, para o caminho existir
quando o gelo agir sobre ele). Para todo viajante (missões, buscas, retornos; **inclui fly**):

1. **Início de perna sob sandstorm sem desvio:** se `isSanding(now)` e a perna ainda não tem
   `sandDetour`, sorteia `lostNode = pickLostNode(rngSemeado, …)` (seed derivado de
   `(run.seed, container.id, perna, SAND_SEED_SALT)` — determinístico e estável no replanejamento),
   monta `reroutePath = caminhoMaisCurto(origem→lostNode) ++ caminhoMaisCurto(lostNode→destino)`,
   grava `sandDetour = { lostNode }` e estica os timestamps (`shiftMissionTimestamps`, **sem**
   `shiftStart` — o sprite continua andando, só a perna ficou mais longa).
2. **Sandstorm acaba no meio (`sandDetour` setado e `!isSanding(now)`):** recalcula o caminho reto
   da **posição atual** (nó corrente da rota) até o destino — idêntico ao recálculo do reroute de
   chuva — encurta os timestamps proporcionalmente, limpa `sandDetour`.
3. **Coexistência com chuva** (Saffron/Viridian têm ambos): após (1)/(2), o desvio de poças
   (`applyWeatherHold`) continua agindo **sobre** o `reroutePath` resultante — sandstorm escolhe o
   waypoint; a chuva desvia das poças dentro desse caminho.
4. **Ortogonalidade com snow:** sandstorm só escreve `reroutePath`/`sandDetour`; snow escreve
   `snow` + timestamps. Ordem no tick: **sand → (chuva) → snow**.

### 7. Posições no mapa — `engine/travelerPositions.ts`

Os três `*TravelerPos` (missão/busca/retorno) passam a honrar o **freeze da nevasca** como já
fazem com `paralyzeHold`/`weatherHold`: se `c.snow?.frozenAtMs != null` e `now < c.snow.thawAtMs`,
retornam a posição congelada (o ponto onde estava no `frozenAtMs`). Isso mantém a regra "o que o
jogador vê é o que o efeito atinge" (a mesma posição usada por `processSnow`).

### 8. Previsão e UI

- **`components/day/WeatherBadge.tsx`**: ícones `snowstorm: '❄️'`, `sandstorm: '🌪️'`; rótulos
  `'Nevasca'` / `'Tempestade de areia'`. Selo ativo quando `isSnowing`/`isSanding` na fase DAY
  (espelha chuva/tempestade/calor).
- **`components/screens/DayForecastPanel.tsx`**: novas linhas na previsão da manhã com chance +
  quantidade potencial, na ordem da config da cidade. CSS leve em `DayForecastPanel.module.css`.
- **`components/day/CityMap.tsx`**: derivação **pura** do estado para overlay — tom gelado no
  sprite por nível de stack (1–4) e "cristalizado" quando congelado (5); leve tinta de cidade
  durante nevasca/sandstorm. Sem novo estado de UI.

**Som** (espelha `audio/heatPlayer.ts`):

- Novos `audio/snowPlayer.ts` (`/sounds/weather/snowstorm.mp3`) e `audio/sandPlayer.ts`
  (`/sounds/weather/sandstorm.mp3`), cópias do `heatPlayer`: loop com fade in/out, respeitam mute +
  volume mestre, best-effort. Exportam `startSnow/stopSnow` e `startSand/stopSand`.
- `audio/useGameSounds.ts`: refs `snowing`/`sanding`; no tique,
  `isSnowingNow = phase === 'DAY' && isSnowing(s.weather.snow, now)` (idem sand), ligando/desligando
  os loops; cleanup no unmount `stopSnow()/stopSand()`.

### 9. Persistência — `engine/constants.ts` + `persistence/saveLoad.ts`

- `SAVE_VERSION` +1. `WeatherSchedule` ganha `snow`/`sand`; a previsão ganha os quatro campos
  novos; os containers ganham `snow`/`sandDetour` opcionais.
- Migração: inicia `snow: []`, `sand: []`, zera os campos de previsão e deixa os campos de
  container `undefined` — tudo recomputado no próximo `setupDay` (espelha a migração do calor).
  Saves antigos não quebram.

### 10. Vieses de clima — `game/setup.ts`

`setupDay` já calcula `rainDelta`/`stormDelta`/`heatDelta` (Cloud Nine, Overcoat) e o cap de Own
Tempo. Snowstorm e sandstorm entram de forma consistente:

- **Cloud Nine** ("+chuva / −outros efeitos"): snowstorm e sandstorm são "outros efeitos" →
  recebem o mesmo `−Xpp` que tempestade/calor recebem hoje.
- **Overcoat** ("−qualquer efeito"): aplica `−Xpp` aos dois.
- **Own Tempo**: ambos entram no orçamento global (precedência da §3).
- `setup.ts` calcula `snowDelta`/`sandDelta` e os repassa a `buildDayWeather`.

## Fluxo (resumo)

```
setupDay(seed, dia, cidade)
  └─ buildDayWeather(seed, dia, city, rainΔ, stormΔ, heatΔ, snowΔ, sandΔ, ownTempoCap)
       ├─ chuva / tempestade / calor (já existem)
       ├─ snowstorm (engine/snow.ts) → janelas 40–70s
       └─ sandstorm (engine/sand.ts) → janelas 30–60s
  → s.weather = { rain, storms, heat, snow, sand, forecast }

tick do dia (por container em viagem)
  ├─ applySandDetour : reroutePath = origem→nó aleatório→destino; recalcula reto ao acabar
  ├─ applyWeatherHold: desvia/espera poças sobre o caminho atual (chuva)
  └─ processSnow     : exposição→stacks (×0,8^n); 5º = freeze (parar + dano; voador morre);
                       descongela 2s após a janela; reset ao chegar no destino; Clear Body imune
```

## Testes (Vitest, espelhando os de tempestade/chuva/calor)

- `engine/snow.test.ts` / `engine/sand.test.ts` (novos): determinismo do schedule por
  `(seed,dia,cidade)`; chance bate com as fórmulas (e colapso no teto); `maxSnowTimes/maxSandTimes`
  = curva da chuva; janelas não-sobrepostas com a duração certa; `snowExposureMs` (interseção
  correta, robusta a saltos); `pickLostNode` sempre alcançável e `≠ origem/destino` (respeita
  Surf).
- `game/snowFlow.test.ts` (novo): acúmulo de stacks por 2s viajando; slowdown composto `0,8^n`;
  freeze no 5º stack; dano `−1 HP/2s`; **faint de membro com sobreviventes seguindo**; **morte
  voadora** ao congelar; **thaw 2s após a janela**; **reset por perna** (ida acumula, zera ao
  chegar, volta acumula de novo); **Clear Body imune**; robustez a saltos grandes de tempo
  (x3/aba oculta).
- `game/sandFlow.test.ts` (novo): desvio na ida e na volta (caminho passa pelo `lostNode`);
  recálculo reto ao acabar a sandstorm; **fly também desvia**; escopo capturas (busca/retorno);
  determinismo do `lostNode`; coexistência com poças de chuva.
- `engine/state.test.ts` / `persistence/saveLoad.test.ts` (estendem): migração de save antigo
  (snow/sand vazios; campos de container `undefined`); round-trip dos novos campos.
- `data/cityWeather.test.ts` (estende): Fuchsia/Saffron/Cinnabar/Viridian com os efeitos na ordem
  e fórmulas da tabela; Pewter sem clima.
- Previsão (`DayForecastPanel`) e `audio/useGameSounds.test.ts` (estendem): linhas/badges novos;
  `startSnow/stopSnow` e `startSand/stopSand` ao entrar/sair das janelas na fase DAY.
- `game/weatherAbilitiesSetup.test.ts` (estende): Cloud Nine / Overcoat / Own Tempo afetando
  snow/sand (`snowDelta`/`sandDelta` e orçamento).
- Verificação final: `npm run build` (tsc -b) **e** `npm test`.

## Decisões registradas

- **Snowstorm = runtime (A1)**, não integrador puro: estado por container mutado no tick, espelhando
  `processStorms` + os holds de poça/Paralyze (slowdown em granularidade de tick, aproximação já
  aceita pelo código em `applyWeatherHold`).
- **Sandstorm = reuso de `reroutePath` (S1)**: waypoint aleatório semeado; recálculo reto ao acabar
  (idêntico ao reroute de chuva).
- **Snowstorm + sandstorm são ortogonais** (Viridian): sand define o caminho; snow age na
  velocidade/freeze sobre ele. Ordem no tick: sand → chuva → snow.
- **Slowdown composto** `0,8^n` (não linear); o **freeze no 5º stack** é uma parada dura separada
  (com dano/morte-voadora), além da curva.
- **Stacks resetam ao chegar no destino da perna**; o nó aleatório do sandstorm não reseta.
- **Clear Body** = imunidade total à nevasca (consistente com a imunidade à tempestade).
- **Voador morre ao congelar** (espelha a morte-voadora do raio); **terrestre** pode desmaiar pelo
  dano, mas os **sobreviventes seguem**.
- **Alcance** de ambos: missões + buscas + retornos de captura (toda viagem).
- **Distribuição**: 4 cidades novas com clima; Pewter permanece sem.

## Fora de escopo (YAGNI)

- Habilidade específica nova de gelo/areia (ex.: imunidade à areia, Snow Cloak) — Clear Body já
  cobre a imunidade do snowstorm; ampliar depois é trivial (somar à checagem de imunidade).
- Coexistência snowstorm + calor (nenhuma cidade as combina hoje).
- Animações elaboradas de partículas (gelo/areia) além do overlay derivado simples.
