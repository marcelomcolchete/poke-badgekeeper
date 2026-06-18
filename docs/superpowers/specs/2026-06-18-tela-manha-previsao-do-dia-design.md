# Tela da manhã: "Previsão do Dia" + time compacto

**Data:** 2026-06-18
**Branch:** a definir (a partir de `origin/main`)

## Objetivo

Repensar a tela da manhã (`MorningScreen`) para:

1. Trocar o painel de clima por uma seção **"Previsão do Dia"** que reúne, num só lugar:
   - **Previsão do Tempo** (efeitos climáticos do dia; hoje só chuva, extensível);
   - **Quantidade de Missões**, **Quantidade de Batalhas** e **Quantidade de Missões Rocket**.
2. Colocar **ao lado** da "Previsão do Dia" a seção **"Seu Time"**, redesenhada como cartas
   **compactas** (sem o gráfico hexagonal), com a opção **Computador** para trocar Pokémon com o PC.
3. **Abaixo** das duas colunas, manter o **Mercado** como está hoje, seguido dos **itens ativos**, do
   texto **"Prepare-se…"** e do botão **"Começar o dia ▶"**.

## Contexto / estado atual

- `MorningScreen.tsx` hoje renderiza, em ordem vertical: cabeçalho → `WeatherForecastPanel` →
  Mercado → `ItemsBar` → bloco "Prepare-se / Começar o dia" → seção "Seu Time" (com `PokemonCard`
  completo, incluindo o radar `HexRadar`) e os botões **Computador** e **Gerenciar**.
- `WeatherForecastPanel.tsx`: mostra "PREVISÃO DO TEMPO". Para `rain`, exibe **3** estatísticas
  (Chance de Chuva = `forecast.rainChancePercent`, Quantidade de Chuva em mm/h, Pancadas possíveis =
  `forecast.potentialRainCount`). **Retorna `null`** em cidades sem clima.
- `engine/weather.ts`: `buildWeatherSchedule(seed, day, city, extraChancePercent = 0).forecast`
  expõe `rainChancePercent` (chance **por pancada**, 0–100, já somado o bônus de Cloud Nine quando
  passado), `rainMmPerHour` e `potentialRainCount` (0–4). Função pura, determinística.
- `engine/secretEffects.ts`: `hasCloudNine(p)`; `engine/balance.ts`:
  `CLOUD_NINE_RAIN_CHANCE_BONUS_PP = 25`.
- `engine/timeline.ts`: `missionsForDay(day)` (missões **normais**, tabela fixa), `defensesForDay(day)`
  (batalhas/defesas), `rocketDays(seed)` (os **2 dias** distintos da run com missão Rocket — máx. 1/dia).
- `components/common/ItemsBar.tsx`: já mostra os itens ativos e permite **usar Potion/Revive**
  (consumíveis clicáveis com seletor de alvo). Permanece intacta.
- `components/BoxPanel/BoxPanel.tsx`: o "Computador" (troca time ↔ PC). Permanece intacto.
- `components/TeamPanel/TeamPanel.tsx`: o "Gerenciar" — distribui pontos pendentes (`ALLOCATE_POINT`)
  e usa Potion/Revive. **Deixa de ser acessível na manhã.**
- `components/day/MemberDetail.tsx`: **no dia** já permite distribuir pontos pendentes (`ALLOCATE_POINT`).

## Layout final

```
┌─ MANHÃ — DIA x/10 ································ $gold  🎯★★  ⚔️★ ─┐
│ ┌── PREVISÃO DO DIA ───────────┐  ┌── SEU TIME (4/6) ──────────┐  │
│ │  PREVISÃO DO TEMPO           │  │ [sprite] [sprite] [sprite] │  │
│ │   🌧️ Chuva  —  Chance 94%    │  │  nome     nome     nome    │  │
│ │   (ou ☀️ Tempo firme)        │  │  Nv 12    Nv 9     Nv 14   │  │
│ │                              │  │  ♥♥♥      ♥♥       ♥♥♥     │  │
│ │  Missões ............. 5     │  │ [sprite] ...               │  │
│ │  Batalhas ............ 2     │  │                            │  │
│ │  Missões Rocket ...... ???   │  │      [ Computador (3) ▸ ]  │  │
│ └──────────────────────────────┘  └────────────────────────────┘  │
│ ┌── MERCADO — ITENS DO DIA ─────────────────────────────────────┐ │
│ │  [bola] [item] [item] [item] [item]                           │ │
│ └────────────────────────────────────────────────────────────────┘│
│  ITENS: [ícones ativos]                                            │
│  Prepare-se: compre itens e monte seu time. Pronto para começar?   │
│              [ Começar o dia ▶ ]                                   │
└────────────────────────────────────────────────────────────────────┘
```

- Topo em **duas colunas** (`Previsão do Dia` × `Seu Time`) via grid flexível que **empilha** em
  telas estreitas.
- Mercado, itens ativos e bloco "Prepare-se / Começar o dia" ocupam a **largura inteira** abaixo.

## "Previsão do Dia" (`DayForecastPanel`)

Seção sempre renderizada (independe de a cidade ter clima). Título: **"PREVISÃO DO DIA"**. Contém:

### Bloco interno "Previsão do Tempo"

- Itera `weather.effects` (extensível a múltiplos efeitos). Hoje só `rain`.
- **Chuva:** mostra **uma única** % = chance de **pelo menos uma pancada** no dia.
- Sem clima na cidade **ou** chance resultante 0 → estado **☀️ "Tempo firme"** (sol, sem números).
- Pronto para crescer: cada efeito futuro vira sua própria linha/card no mesmo bloco.
- **Fidelidade ao dia real (Cloud Nine):** `buildWeatherSchedule` agora aceita um 4º parâmetro
  `extraChancePercent` (bônus de chuva por portador de Cloud Nine), e `setupDay` o passa. Para a
  previsão "bater com o que vai acontecer", o painel calcula o **mesmo** bônus
  (`roster.filter(hasCloudNine).length * CLOUD_NINE_RAIN_CHANCE_BONUS_PP`) e o repassa — corrigindo
  uma defasagem do painel atual, que ignora Cloud Nine.

#### Fórmula da chance de chuva

`p` = `forecast.rainChancePercent` (chance por pancada, 0–100). `n` = `forecast.potentialRainCount`.

```
rainAtLeastOnceChance(p, n) = round( (1 − (1 − p/100)^n) × 100 )   // resultado 0–100
```

Casos: `p=60, n=3 → 94`; `p=0 → 0`; `n=0 → 0`; `p=100 → 100`. Helper **puro** em `engine/weather.ts`,
testado isoladamente.

### Contagens do dia (linhas `dt`/`dd`, reaproveitando o visual atual de estatística)

| Linha | Fonte | Observação |
| ----- | ----- | ---------- |
| Quantidade de Missões | `missionsForDay(day)` | Só missões **normais** (Rocket conta à parte). |
| Quantidade de Batalhas | `defensesForDay(day)` | Defesas do ginásio. |
| Quantidade de Missões Rocket | **sempre `???`** | Mascarado na manhã — preserva o mistério dos 2 dias-surpresa. |

A linha Rocket aparece **todo dia**, sempre com `???` (a previsão nunca revela se hoje é dia de
Rocket). Mantém a categoria visível sem entregar o evento.

## "Seu Time" (`TeamSummary`)

- Cartas **compactas**, uma por Pokémon do roster: **sprite + nome + Nv + corações** (`Hearts`).
  **Sem** `HexRadar`, HP bar, EXP, tipos ou natureza. Grade compacta para caber ao lado da previsão.
- Título: **"SEU TIME (n/6)"** (`state.roster.length`/`MAX_ROSTER_SIZE`).
- Botão **"Computador (n) ▸"** → abre o `BoxPanel` existente (troca time ↔ PC). **Sem** botão
  "Gerenciar".

## Mercado + rodapé (inalterados, reposicionados)

Abaixo das duas colunas, na ordem:

1. **MERCADO — ITENS DO DIA** — exatamente como hoje (Pokébola evolutiva fixa à esquerda + itens do
   dia; comprar marca **VENDIDO**; Rare Candy abre o seletor de alvo). Nenhuma mudança de lógica.
2. **`ItemsBar`** (itens ativos) — inalterada.
3. Bloco **"Prepare-se… / Começar o dia ▶"** (`Textbox` + botão `ADVANCE_PHASE`) — inalterado.

## Arquivos

- **Novo** `components/screens/DayForecastPanel.tsx` + `.module.css` — "PREVISÃO DO DIA" (bloco de
  clima "Previsão do Tempo" + as 3 contagens). Substitui o uso de `WeatherForecastPanel` na manhã.
  A lógica de clima do `WeatherForecastPanel` é absorvida pelo novo painel como sub-bloco interno.
- **Removido** `components/screens/WeatherForecastPanel.tsx` + `.module.css` — só `MorningScreen` os
  consumia (confirmado por busca); viram código morto.
- **Removido** `components/TeamPanel/TeamPanel.tsx` + `.module.css` — só `MorningScreen` os consumia;
  a alocação de pontos que ele fazia continua disponível no dia via `MemberDetail`.
- **Novo** `components/screens/TeamSummary.tsx` + `.module.css` — time compacto + botão Computador.
- **Editado** `components/screens/MorningScreen.tsx` — novo layout em 2 colunas + rodapé; remove o
  uso de `PokemonCard`, `TeamPanel` e `WeatherForecastPanel` (e o botão "Gerenciar") na manhã; passa
  a usar `DayForecastPanel` e `TeamSummary`. Estado/handlers de `BoxPanel` (Computador) e do Rare
  Candy permanecem.
- **Editado** `engine/weather.ts` — novo helper puro `rainAtLeastOnceChance(p, n)`.
- **Editado** `MorningScreen.module.css` — grid de 2 colunas do topo; estilos do time antigo
  (`roster`/`rosterCard`) saem; estilos de Mercado/rodapé permanecem.

## Testes

O projeto roda Vitest em `environment: 'node'` e coleta **apenas** `src/**/*.test.ts` — não há
harness de DOM (jsdom/testing-library) e os componentes não são testados por render. Seguimos esse
padrão: a lógica testável vive em funções **puras** (`.ts`); os componentes ficam finos e são
verificados por `typecheck`/`lint`/`build`.

- **Unitário** `rainAtLeastOnceChance` (em `weather.test.ts`): `60,3→94`; `0,_→0`; `_,0→0`;
  `100,_→100`; arredondamento (`50,2→75`).
- **Componentes** (`DayForecastPanel`, `TeamSummary`): sem teste de render (sem harness de DOM no
  projeto). Mantidos finos — toda a lógica não trivial é o helper puro acima. Verificação por
  `npm run typecheck`, `npm run lint` e `npm run build`.

## Tradeoffs registrados

- Remover "Gerenciar" tira a **distribuição de pontos pendentes da manhã**; ela continua disponível
  **no dia** via `MemberDetail`. Potion/Revive seguem usáveis pela `ItemsBar`. Aceito conforme o
  pedido ("o botão gerenciar não precisa").

## Fora de escopo (YAGNI)

- Não mexer na engine de clima/missões/Rocket além do helper puro de %.
- Não adicionar novos efeitos climáticos agora (só deixar o bloco extensível).
- Não alterar o `BoxPanel`, a `ItemsBar`, o Mercado nem o fluxo de Rare Candy.
