# Efeito climático Tempestade — raios e status Paralyze

**Data:** 2026-06-19
**Estado:** rascunho de design, aguardando revisão do usuário

## Contexto

A Chuva já existe como efeito climático (`engine/weather.ts`, `data/cityWeather.ts`),
hoje só em Cerulean: cada dia elegível (3–10) tem uma chance e uma quantidade de
pancadas potenciais definidas na manhã; cada pancada pré-computada de forma
**determinística e semeada** no `setupDay` (salt `WEATHER_SEED_SALT`); poças nascem,
crescem, secam e bloqueiam quem não surfa/voa — tudo **função pura de `now`**.

A regra "1/4 dos pontos" pedida já existe para poças: `puddleCountRange(n)` →
`max = ⌊n/4⌋`, onde `n` é o número de **pontos andáveis** (exceto ginásio, surf e
exploração — `puddleNodePool`).

Este documento especifica um **novo efeito climático: Tempestade**, com raios que
caem pelo mapa causando dano e aplicando um **novo status Paralyze**, habilitado
inicialmente em **Vermilion** (índice 2 — Elétrico/Dragão; hoje usa o grafo
placeholder de Pewter, o que é aceitável: a cidade ainda não está pronta).

## Decisões de design (confirmadas com o usuário)

1. **Status Paralyze:** ao ser atingido, o Pokémon (a) leva 1 de dano, (b) fica
   *paralisado* por 5s — **o sprite congela no ponto exato onde está** e a viagem só
   retoma depois (a missão demora 5s a mais) —, e (c) tem **-50% de poder em batalhas
   pelo resto do dia**. Reaplicar **não empilha** o -50%; **soma** outros 5s de
   paralisia (estende o congelamento).
2. **Alvos do raio:** apenas Pokémon **visíveis no mapa** (viajando/voltando, mais
   procuradores de captura). Quem está parado no ginásio, em missão no local
   (`onMission`), no Centro ou desmaiado **não** é atingido.
3. **Geometria do raio:** raio padrão **0,09** da largura do mapa.
   - Se o **ponto inicial sorteado já é água** (surf/poça): vira um **raio único
     0,15**, sem aplicar duas vezes ali.
   - Se o ponto inicial **não** é água mas a área **0,09 toca** um ponto de água:
     dispara um **secundário 0,045** centrado nesse ponto de água (1 dano + Paralyze
     de novo). Secundários **não** encadeiam (sem terciário).
4. **Agenda em Vermilion:** a cidade ganha **Chuva habilitada** + **Tempestade**. A
   tempestade tem **agenda própria** (chance + contagem do dia, igual à chuva) **E**
   toda chuva traz uma tempestade **sobreposta** à sua janela (poças → água para
   encadear). Múltiplos efeitos podem coexistir.
5. **Quantidade de raios por tempestade:** **escala com o dia** até o cap absoluto
   **⌊pontos/4⌋** (ex.: 20 pontos → até 5 raios). Cada raio cai num instante
   aleatório dos 15–30s, com **5s de aviso** antes.
6. **Alcance do -50%:** **só batalhas 1v1** (defesa de ginásio + Equipe Rocket, que
   usam o atributo Batalha). Não afeta missões normais.

### Decisões menores assumidas (confirmar na revisão)

- **Centro do raio:** sorteado de **todos** os pontos do grafo (`graph.nodes`), para
  poder cair sobre água. O **cap de quantidade** continua usando o pool andável
  (`puddleNodePool`) como denominador.
- **Múltiplos pontos de água na área primária:** **um secundário por ponto de água**
  dentro de 0,09, sem encadear adiante.
- **Paralisia (congelamento):** o sprite **congela na posição interpolada atual** por
  5s (análogo ao `weatherHold`, mas travando numa `MapPos` arbitrária, não num nó do
  grafo). Internamente: grava um `paralyzeHold = { pos, untilMs }` na missão/busca e
  desloca a janela da perna em `+5s` (semântica de "espera", `shiftStart = true`,
  reusando `shiftMissionTimestamps`) para o progresso retomar de onde congelou. Efeito
  líquido: 5s parado no lugar + missão 5s mais longa.
- **Duração da tempestade:** 15–30s (`STORM_EVENT_MIN_MS`/`MAX_MS`).

## Arquitetura

Camadas mantêm o padrão: `engine/` puro e determinístico, `game/` orquestra o tick,
`components/` só renderiza. Toda a lógica nova de tempestade fica em
**`engine/storm.ts`**; o resultado é guardado dentro do `WeatherSchedule` existente
(um único blob de estado climático e um único ponto de migração de save).

### 1. Dados e configuração — `data/cityWeather.ts`

- `WeatherEffectKind = 'rain' | 'storm'`.
- Nova `interface StormEffectConfig { kind: 'storm' }`; `WeatherEffectConfig` vira a
  união.
- Vermilion (índice 2): `{ effects: [{ kind: 'rain' }, { kind: 'storm' }] }`.
- Novo helper `cityHasStorm(cityIndex): boolean` (espelha `cityHasRain`).

**Estado (`engine/state.ts`):**
- `s.today.paralyzedBattleIds: string[]` — Pokémon com -50% de Batalha pelo resto do
  dia (limpo na virada).
- `MissionInstance`, `CaptureSearch` e `CaptureReturn` ganham
  `paralyzeHold?: { pos: MapPos; untilMs: number }` (espelha o `weatherHold`
  existente) — congela o sprite numa posição arbitrária por 5s. Ausente = sem
  paralisia em curso.

### 2. Constantes — `engine/balance.ts` (e `constants.ts` para o salt)

```
STORM_FIRST_ELIGIBLE_DAY      = 3      // dias 1–2 nunca têm clima
STORM_CHANCE_TOTAL_PERCENT    = 300    // orçamento somado dias 3–10 (tunável)
STORM_EVENT_MIN_MS            = 15_000
STORM_EVENT_MAX_MS            = 30_000
STORM_GAP_MS                  = 4_000  // folga entre tempestades próprias
STRIKE_WARNING_MS             = 5_000
STRIKE_RADIUS                 = 0.09
STRIKE_RADIUS_ON_WATER        = 0.15   // centro já é água
STRIKE_SECONDARY_RADIUS       = 0.045  // metade do padrão
STRIKE_DAMAGE                 = 1
STRIKE_MIN_PER_STORM          = 1      // piso do lerp por dia
PARALYZE_STUN_MS              = 5_000
PARALYZE_BATTLE_MULT          = 0.5
STORM_SEED_SALT               (em constants.ts, novo valor único)
```

### 3. Engine — `engine/storm.ts` (puro)

**Tipos**

```ts
interface StrikeCircle { cx: number; cy: number; radius: number }
interface Strike {
  warnAtMs: number          // surge o aviso vermelho
  strikeAtMs: number        // = warnAtMs + STRIKE_WARNING_MS; cai o raio
  circles: StrikeCircle[]   // primário (0,09|0,15) + secundários (0,045)
}
interface StormEvent { startMs: number; endMs: number; strikes: Strike[] }
```

`WeatherSchedule` ganha `storms: StormEvent[]`; `WeatherForecast` ganha
`stormChancePercent` e `potentialStormCount`. `emptyWeatherSchedule()` inclui
`storms: []` e os campos zerados.

**Agendamento**

- `maxStormTimes(day)` — espelha `maxRainTimes` (+1 a cada 2 dias, cap 4).
- `stormChanceForDay(seed, day)` — espelha `rainChanceForDay`, com `STORM_SEED_SALT`.
- `strikeCountForDay(day, poolSize)` — `cap = ⌊poolSize/4⌋`;
  `clamp(round(lerp(STRIKE_MIN_PER_STORM, cap, (day-3)/(TOTAL_DAYS-3))), 0, cap)`.
- `buildStorms(seed, day, city, rainEvents)`:
  - **Próprias:** mesma estrutura de janelas não-sobrepostas de `buildWeatherSchedule`
    (duração 15–30s, `STORM_GAP_MS`), cada uma ocorre por `rng.bool(chance/100)`.
  - **Acopladas:** para cada `rainEvent`, posiciona uma tempestade de 15–30s **dentro**
    de `[rainEvent.startMs, rainEvent.endMs]`.
  - Para cada tempestade: `strikeCountForDay(...)` raios; cada raio com `warnAtMs`
    aleatório na janela e `circles` resolvidos por `resolveStrikeCircles(...)`.
- `resolveStrikeCircles(center, strikeAtMs, city, rainSchedule)`:
  - `water = surfNodes ∪ {poças com puddleLevelAt>0 em strikeAtMs}`.
  - centro ∈ water → `[{center, 0.15}]`.
  - senão → primário `{center, 0.09}` + um `{waterNode, 0.045}` para cada `waterNode`
    com `dist(center, waterNode) ≤ 0.09`.
  - distância em **unidades de largura** (Y convertido por `mapH/mapW`).

**Derivações puras** (UI + tick):

- `activeStormAt(schedule, now): StormEvent | null`.
- `isStorming(schedule, now): boolean` (som/badge).
- `activeStrikeCirclesAt(schedule, now)` → círculos com fase `'warning'`
  (`warnAtMs ≤ now < strikeAtMs`) ou `'striking'` (janela curta pós-impacto, p/ animação).
- `strikesResolvingBetween(schedule, prevMs, nowMs)` → raios cujo `strikeAtMs ∈
  (prevMs, nowMs]` (robusto a saltos de tempo grandes).

`engine/weather.ts`: `buildWeatherSchedule` constrói a chuva e então chama
`buildStorms(seed, day, city, rain)` quando `cityHasStorm(city.index)`, anexando
`storms` e os campos de previsão.

### 4. Posições compartilhadas — `engine/travelerPositions.ts` (puro, NOVO)

Extrai a lógica hoje embutida em `CityMap.tsx` (`missionTravelerPos` + blocos de
captura) para um helper puro:

```ts
travelerPositionsAt(s: GameState, now: number): { pokemonId: string; pos: MapPos }[]
```

Cobre missões em `traveling`/`returning` (cada membro do time na posição do grupo) e
`captureSearches`/`captureReturns` em trânsito, honrando `paralyzeHold`, `weatherHold`,
`reroutePath` e mão única — **a mesma matemática que o jogador vê**. `paralyzeHold` tem
prioridade: enquanto `now < paralyzeHold.untilMs`, devolve `paralyzeHold.pos` (sprite
congelado). `CityMap.tsx` passa a importar e usar esse helper (remove a duplicação).

### 5. Orquestração — `game/stormFlow.ts` (NOVO) + `game/dayClock.ts`

- `processStorms(s, prevMs, nowMs)`:
  - Para cada raio em `strikesResolvingBetween(s.weather, prevMs, nowMs)`:
    - `positions = travelerPositionsAt(s, raio.strikeAtMs)`.
    - Para cada Pokémon cuja `pos` cai **dentro de qualquer** `circle` do raio:
      aplica `STRIKE_DAMAGE` (via caminho de dano existente, com `settleFaintTracked`
      e Sturdy) e `applyParalyze(s, id, pos, raio.strikeAtMs)` — reaproveitando a `pos`
      já computada para a detecção de acerto.
- `dayClock.tick`: guarda `prevMs = s.clock.dayElapsedMs` antes de avançar; após
  `processMissions/Defenses/Searches`, chama `processStorms(s, prevMs, now)` (se a run
  ainda está em `DAY`).

`applyParalyze(s, id, pos, now)`:
- `-50%`: adiciona `id` a `s.today.paralyzedBattleIds` (idempotente).
- **congelamento de 5s:** localiza a missão/busca do Pokémon e grava
  `paralyzeHold = { pos, untilMs: now + PARALYZE_STUN_MS }`, deslocando a janela da
  perna em curso em `+PARALYZE_STUN_MS` com semântica de espera (`shiftStart = true`,
  como o `weatherHold`). Reaplicar enquanto já congelado **estende** `untilMs` em mais
  5s e desloca a janela de novo. Atualiza a `pos` para a posição do novo impacto.
- Pokémon não-visíveis (idle/onMission/Centro) nunca são atingidos, então não há
  congelamento a aplicar fora de trânsito.

### 6. Batalha 1v1 — `engine/gymDefense.ts`

`resolveDefense(...)` recebe um novo campo `paralyzedIds: Set<string>` no objeto de
opções (junto de `sturdyAvailableIds`/`runItems`/`damagePerLoss`). Ao computar a
Batalha efetiva do seu Pokémon, se `paralyzedIds.has(p.id)` multiplica por
`PARALYZE_BATTLE_MULT`. Os chamadores (`defenseFlow.ts` e a batalha Rocket em
`missionFlow.ts`) passam `new Set(s.today.paralyzedBattleIds)`. Missões normais
(`engine/missions.ts`) **não** mudam.

### 7. UI

- **`StormOverlay`** em `CityMap.tsx` (irmão de `PuddleOverlay`): renderiza
  `activeStrikeCirclesAt(now)` — círculo **vermelho pulsante** na fase `warning` (5s),
  **amarelo expansivo** na fase `striking`. Diâmetro = `radius` convertido para % via
  aspecto do mapa. CSS Modules novo (`CityMap.module.css`), sem libs.
- **`WeatherBadge.tsx`**: passa a renderizar **todos** os efeitos ativos agora (🌧️ +
  ⛈️). Adiciona ícone/label de `storm` (⛈️ / "Tempestade").
- **Sprite congelado:** enquanto `paralyzeHold` ativo, o `MapTravelers` renderiza o
  grupo parado em `paralyzeHold.pos` (vindo do `travelerPositionsAt` compartilhado),
  com um efeito visual de paralisia (ex.: faíscas ⚡ / tremor leve) por cima.
- **Selo de paralisado:** Pokémon em `paralyzedBattleIds` recebem indicador ⚡ no card
  (`PokemonCard`) / sidebar, reusando o padrão visual de status existente.
- **Previsão da manhã:** exibe chance + contagem potencial de tempestades ao lado da
  chuva (tela de previsão do dia).

### 8. Persistência — `persistence/saveLoad.ts`

Bump da versão do schema + migração: saves antigos recebem `weather.storms = []`,
campos de previsão de tempestade zerados e `today.paralyzedBattleIds = []`.

## Testes (Vitest, engine pura)

- **`storm.test.ts`:** determinismo (mesmo seed → mesmo schedule);
  `maxStormTimes`/`stormChanceForDay`/`strikeCountForDay` (escala com o dia, cap
  ⌊pool/4⌋); acoplamento com chuva (1 tempestade por evento de chuva, dentro da
  janela); `resolveStrikeCircles` — centro-na-água (0,15 sem secundário) vs
  toque-em-água (0,09 + 0,045), sem terciário; distância respeita o aspecto do mapa.
- **`travelerPositions.test.ts`:** posições batem com a lógica antiga do CityMap
  (missão ida/volta, captura, `weatherHold`, mão única); `paralyzeHold` tem prioridade
  e devolve a `pos` congelada enquanto `now < untilMs`.
- **`stormFlow.test.ts`:** raio acerta só visíveis; aplica 1 dano + Paralyze; desmaio
  → Centro; salto de tempo grande (x3/aba oculta) não perde raios.
- **`gymDefense.test.ts`:** -50% de Batalha com id paralisado (defesa e Rocket);
  sem id, inalterado.
- **Paralyze:** atingir congela o sprite na posição por 5s (`paralyzeHold.pos`/`untilMs`)
  e desloca a janela da perna em +5s (missão 5s mais longa); reaplicar não empilha o
  -50% mas **estende** o congelamento por mais 5s; `paralyzedBattleIds` limpa na virada
  do dia.

## Fora de escopo

- Calibrar o grafo real de Vermilion (a cidade não está pronta; usa Pewter).
- Outros efeitos climáticos (sol, areia, neve).
- Interação de tipos com Paralyze (ex.: imunidade de Elétrico) — Paralyze atinge
  qualquer Pokémon na área, sem filtro de tipo.

## Riscos

- **Sincronia visão × acerto:** se o overlay e o `stormFlow` não usarem exatamente o
  mesmo helper de posição, o raio "erra" o que o jogador vê. Mitigação: o
  `travelerPositionsAt` compartilhado é a única fonte de verdade.
- **Migração de save:** esquecer um campo novo quebra saves. Mitigação: testes de
  migração + defaults vazios.
- **Balanceamento:** densidade de raios × dano pode ficar punitiva. Mitigação: tudo
  em `balance.ts`, semeado e reproduzível para tuning.
