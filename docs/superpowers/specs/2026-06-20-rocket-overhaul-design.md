# Rocket Overhaul — Missões Especiais da Cidade + Evento de Roubo

**Data:** 2026-06-20
**Escopo:** dois subsistemas independentes (um design coeso, **dois planos de implementação**) + tweak de skill.

## Visão geral

Hoje existe um único conceito "rocket": missões difíceis (`special5`) que aparecem 2× por run
em dias determinísticos (`rocketDays`), com batalha pós-missão e **game over** se ignoradas.

Este overhaul divide isso em dois:

- **Feature A — Missões Especiais da Cidade (⭐):** o que hoje são "missões rocket" viram missões
  especiais por local, com aparição **estocástica e escalonante por local**, **sem batalha
  pós-missão**, **5× XP**, e penalidades de estrela (não mais game over).
- **Feature B — Evento de Roubo Rocket (🚨):** um evento **novo** de tempo real onde a Equipe
  Rocket aparece, rouba um Pokémon do ginásio e foge; o jogador persegue e batalha para recuperar.
- **Feature C — Skill `mapping-kanto-city-from-image`:** atualizar a legenda da imagem (RKT →
  SPEC) e o vocabulário (museum → specialMission).

O nome **"rocket"** passa a se referir **somente** ao evento de roubo (Feature B). As missões
deixam de ser "rocket".

---

## Renomeação transversal (vale para A e B)

`museum` não descreve nada — vira `specialMission`. A categoria de missão `rocket` vira `special`.

| De | Para | Onde |
|---|---|---|
| `CitySiteNodes.museum: string[]` | `CitySiteNodes.specialMission: string[]` | `data/types.ts`, todas as cidades em `cities.ts`, testes `cerulean`/`vermilion` |
| `SiteKind` `'museum'` | `'specialMission'` | `types/index.ts` (`SITE_KINDS`) |
| `MissionCategory` `'rocket'` | `'special'` | `types/index.ts`, `CATEGORY_SITE`, `timeline.ts` |
| template id `'rocket'`, nome `'Equipe Rocket'`, `themeIcon: 'R'` | id `'special'`, nome `'Missão Especial'`, `themeIcon: '⭐'` | `missionTemplates.ts` |

O `MissionCategory`/`SiteKind` `'rocket'`/`'museum'` deixa de existir no domínio de missões.

---

## Feature A — Missões Especiais da Cidade ⭐

### A1. Aparição estocástica por local (substitui `rocketDays`)

- Remover por completo `rocketDays(seed)` e a injeção determinística de 2 missões rocket por run
  (`timeline.ts`), e as constantes `ROCKET_DAY_MIN/MAX`, `ROCKET_MISSIONS_TOTAL`, `ROCKET_SEED_SALT`.
- **Novo estado persistido por local especial:** uma chance corrente, iniciando em **1%** quando a
  cidade começa. Armazenada como `run.specialChances: number[]`, indexada pela ordem dos nós
  `specialMission` da cidade.
- **No início de cada dia (abertura da fase DAY)**, para **cada** local especial,
  independentemente:
  - rola-se a chance corrente. Se **acertar** → agenda uma Missão Especial naquele local, em um dos
    3 momentos do dia (mesmo rateio das missões normais), e a chance daquele local **volta a 1%**.
  - se **errar** → a chance daquele local **cresce um valor aleatório inteiro entre +5 e +15 pontos
    percentuais** (teto 100%).
- Locais divergem naturalmente pela aleatoriedade. Celadon (2 locais) pode ter 0, 1 ou 2 missões
  especiais no mesmo dia, cada local com sua própria chance.
- **Não aparece na previsão do dia** — continua sendo surpresa.

### A2. Recompensa e dificuldade

- **5× o XP de uma missão normal:** pool `MISSION_XP_POOL × SPECIAL_XP_MULTIPLIER` (=5), dividido
  pelo time, aplicado direto na conclusão dos atributos.
- **Sem batalha pós-missão:** remover `setupRocketBattle`, `resolveRocketBattle`,
  `completeRocketBattle`, o tipo `RocketBattle` (no contexto de missão), o status de missão
  `'battle'` e o `RocketBattlePanel` do fluxo da missão. Concluiu os atributos = recompensa na hora.
- **Sem ouro** (o ouro antigo vinha só da batalha removida; missão especial é focada em XP).
- Dificuldade segue `special5` (3 principais + 2 secundárias), igual hoje. A escala por dia
  (`MISSION_DAY_SCALE` etc.) é mantida.

### A3. Penalidades por falha (não é mais game over)

Aplicadas na reconciliação de fim de dia (`phaseFlow.finalizeDay`), de modo que **nunca disparam
game over**:

- **Não enviou o time (missão especial expirou sem dispatch):** `missionStars → 0` (sobrescreve,
  mesmo que o desempenho normal do dia tenha sido bom). Continua vivo.
- **Enviou mas não concluiu:** `missionStars − 1` estrela cheia (piso 0).
- **Concluiu:** sem penalidade (só o XP 5×).

O game over por estrelas (`missionBefore + missionDelta < STARS_MIN`) continua valendo **só para o
desempenho normal** do dia; as penalidades da especial são aplicadas depois, com piso 0.

### A4. Interação com estrelas e estatísticas

- A Missão Especial **conta nas estatísticas do dia** (missões tentadas/concluídas exibidas, MVP,
  totais de XP) **como missão normal**.
- É **excluída do cálculo do delta normal de estrelas** (a razão `missionsCompleted/missionsTotal`).
  As regras explícitas de A3 são o **único** efeito da especial na trilha de estrelas (evita punição
  dupla). Implementação: separar, em `daySummary`/`phaseFlow`, o "total para exibição" (inclui
  especiais) do "total para razão de estrelas" (exclui especiais).

### A5. Identidade visual

- Emoji **⭐** substitui `themeIcon: 'R'` no marcador do mapa, no dispatch e no reveal.
- Template renomeado para **"Missão Especial"**.

### A6. Constantes (Feature A)

`balance.ts`/`constants.ts`:
- `SPECIAL_CHANCE_START = 1` (%)
- `SPECIAL_CHANCE_GROWTH_MIN = 5`, `SPECIAL_CHANCE_GROWTH_MAX = 15` (pontos percentuais)
- `SPECIAL_CHANCE_MAX = 100`
- `SPECIAL_XP_MULTIPLIER = 5`

### A7. Arquivos tocados (Feature A)

- `engine/balance.ts`, `engine/constants.ts` — novas constantes; remoção das constantes rocket.
- `engine/state.ts` — `run.specialChances: number[]`.
- `persistence/saveLoad.ts` — migração + bump de versão.
- `engine/timeline.ts` — rolagem por local no build do dia (substitui `rocketDays`).
- `engine/missions.ts` / `game/missionFlow.ts` — conclusão paga 5× XP direto; remoção do ramo de
  batalha.
- `engine/daySummary.ts`, `engine/approval.ts`, `game/phaseFlow.ts` — separar total exibição × total
  razão; aplicar penalidades A3.
- `data/missionTemplates.ts` — template `special`.
- UI: `MissionDispatch.tsx`, `MissionRevealModal.tsx`, `CityMap.tsx`, `ReportSidebar.tsx` — ⭐ e
  remoção de referências à batalha rocket. Remover `RocketBattlePanel.tsx` do fluxo de missão.

---

## Feature B — Evento de Roubo Rocket 🚨

### B1. Gatilho e chance (estado persistido por run)

- **Novo estado:** `run.theftChance`, iniciando em **1%**.
- **Uma rolagem no início do dia.** Se acertar → o roubo fica **armado** para o dia (máx. 1×/dia).
  Se errar → a chance **dobra**: 1→2→4→8→16→32→64→**100** (teto 100).
- A chance só **reseta para 1% quando o roubo de fato dispara**. Se o dia terminar sem disparar, a
  chance **continua dobrando** no dia seguinte.

### B2. Alvo e disparo adiado

**Quem pode ser roubado = Pokémon presente no ginásio:**
- ✅ `idle` (disponível).
- ✅ derrotado/fainted (KO no ginásio).
- ❌ fora do ginásio: `traveling`, `onMission`, `returning`, `defending`, buscadores de captura.
- ❌ `atCenter` (no Centro Pokémon).

**Disparo adiado:** se, no momento previsto, **não houver alvo elegível no ginásio**, o evento
**espera** e dispara **assim que** um Pokémon elegível estiver no ginásio. Se o dia acabar sem nunca
haver alvo, o roubo não acontece (chance continua dobrando — ver B1).

**Alvo:** um Pokémon elegível **aleatório** vira status `'stolen'`.

### B3. Aparição e fuga (tempo real, concorrente com o dia)

- A Rocket surge em um **nó adjacente ao ginásio**, com pop-up **"R" vermelho**.
- Foge em direção ao **nó mais distante do ginásio** (maior distância de caminho a partir do gym),
  na **velocidade de um Pokémon com 10 de agilidade** (reusa a curva de velocidade de viagem com
  agilidade efetiva 10).
- O dia **continua rodando** durante o evento (outras missões/defesas seguem).
- Renderizada no `CityMap` como traveler próprio (reuso da interpolação por caminho).

### B4. Perseguição (interceptação posicional)

- Dispatch para mandar **até 3 Pokémon idle** atrás da Rocket.
- Os perseguidores **pathfindam continuamente até a posição atual** da Rocket; se a posição de um
  encostar (limiar de distância) na Rocket — no caminho ou no ponto final — dispara a **batalha de
  resgate**.
- Pokémon mais rápidos alcançam antes; lentos podem não alcançar.

### B5. Ponto final + janela de 5s + som

- Quando a Rocket **chega ao nó mais distante**, toca o som de alerta (reuso de `'timeWarning'`, o
  mesmo da defesa de ginásio acabando) e começa uma **janela de 5 segundos**.
- Interceptou dentro dos 5s → batalha. Senão → **levam o Pokémon** (perda, ver B7).

### B6. Batalha de resgate

- Esquadrão Rocket **dimensionado pelo dia** (igual à defesa de ginásio), **duelos 1v1** com os
  perseguidores (aplicam dano de HP e podem desmaiar; reuso da engine de duelos de defesa).
- **Vitória:** recupera o Pokémon (volta a `idle`, mantém o HP que tinha — derrotado continua
  derrotado), **3× o XP de uma batalha de ginásio**.

### B7. Desfecho de falha

Tanto **perder a batalha** quanto a **Rocket escapar** (ninguém interceptou na janela de 5s):
- perde o Pokémon roubado (removido do roster);
- **todo o roster −1 coração**.

Em **qualquer** desfecho (vitória, derrota ou fuga), a chance de roubo **reseta para 1%**.

### B8. Indicador no sidebar

- Novo `PokemonStatus: 'stolen'`.
- `TeamSidebar` mostra um banner **"🚨 Roubado"** espelhando o overlay de "💀 Derrotado" (mesma
  estrutura `busyOverlay`/`busyBanner`), com cor própria — **roxo Rocket** (ex.: `#6b3d6e`).
- Visível enquanto o Pokémon está em posse da Rocket (durante fuga/perseguição/batalha).

### B9. Previsão do dia: "Chance de Rocket"

Substitui o bloco "Quantidade de Missões Rocket" (`???`) por **"Chance de Rocket"** em **palavras +
cor** (perigo = mais vermelho). Função `theftChanceLabel(percent) → { label, color }`:

| Chance | Palavra | Cor |
|---|---|---|
| ≤ 4% | Muito Improvável | verde |
| 8% | Improvável | verde-amarelo |
| 16% | Possível | amarelo |
| 32% | Provável | laranja |
| 64% | Muito Provável | vermelho-alaranjado |
| 100% | Inevitável | vermelho |

(Buckets alinhados à sequência 1→2→4→8→16→32→64→100; a cor interpola verde→vermelho.)

### B10. Constantes (Feature B)

- `THEFT_CHANCE_START = 1` (%)
- `THEFT_CHANCE_MAX = 100`
- (dobra a cada dia sem disparar)
- `THEFT_CHASERS_MAX = 3`
- `THEFT_FLEE_AGILITY = 10` (agilidade efetiva da Rocket na fuga)
- `THEFT_GRACE_MS = 5000` (janela no nó final)
- `THEFT_XP_MULTIPLIER = 3` (× XP de batalha de ginásio)
- `THEFT_INTERCEPT_DISTANCE` (limiar de proximidade para interceptar)

### B11. Arquivos tocados (Feature B)

- `engine/state.ts` — `run.theftChance` + `TheftEvent` (fase `armed | fleeing | atFarNode |
  battle | resolved`, nó final, id do Pokémon roubado, ids dos perseguidores, esquadrão, timers).
- `persistence/saveLoad.ts` — migração + bump de versão.
- `types/index.ts` — `PokemonStatus: 'stolen'`.
- Novo **`game/theftFlow.ts`** — espelha `rocketFlow`/`defenseFlow`: roll, spawn, disparo adiado,
  movimento, interceptação, resolução; integrado em `game/dayClock.tick`.
- `engine/travelerPositions.ts`, `engine/pathfinding.ts` — posição da Rocket e dos perseguidores;
  farthest-node por distância de caminho do gym (reuso/extensão).
- `components/day/CityMap.tsx` — render do "R" vermelho + perseguidores.
- `components/day/TeamSidebar.tsx` (+ CSS) — ramo `'stolen'`.
- Novo painel de dispatch dos perseguidores + painel de batalha de resgate (reuso de `BattleView`).
- `audio/useGameSounds.ts` — dispara `'timeWarning'` quando a Rocket chega ao nó final.
- `components/screens/DayForecastPanel.tsx` (+ CSS) — bloco "Chance de Rocket".

---

## Feature C — Skill `mapping-kanto-city-from-image`

Atualizar `.claude/skills/mapping-kanto-city-from-image/SKILL.md` (e `template.md` se necessário):

- **Legenda de leitura da imagem:** a linha
  `RKT | laranja | museum (Equipe Rocket) | convenção viva = ponto único`
  vira
  `SPEC | retângulo laranja + palavra "SPEC" | specialMission | ponto(s)` — e deixar explícito que
  **pode haver mais de um** local especial por cidade (ex.: Celadon com 2), cada um com seu nó.
- **Vocabulário:** trocar todas as menções a `museum`/`RKT`/`Equipe Rocket` por
  `specialMission`/`SPEC`/`Missão Especial` na `description`, na tabela de sítios, nos gotchas e no
  procedimento.
- Manter a regra de coordenadas/estimativa e o fluxo de confirmação inalterados.

---

## Decisões registradas (Q&A)

- Crescimento da chance da missão especial: **incremento aleatório 5–15pp/dia** (não taxa fixa).
- Zerar estrelas pela missão especial **não** encerra o jogo.
- Emoji da missão especial: **⭐**.
- Previsão "Chance de Rocket": **perigo** (Improvável=verde → Inevitável=vermelho).
- Roubo: **uma rolagem/dia**, horário aleatório; alvo **aleatório**; chance reseta p/ 1% ao disparar.
- Perseguição: **interceptação posicional**.
- Relógio **corre concorrente** durante o evento.
- Batalha de resgate: **squad como defesa de ginásio**, perseguidores **tomam dano/desmaiam**.
- Alvo do roubo: **presente no ginásio** (idle ou derrotado); **não** atCenter nem fora do ginásio.
- Sem alvo no disparo → **evento adiado** até haver alvo; reset da chance só ao disparar de fato.

## Fora de escopo

- Balanceamento fino dos buckets/cores da "Chance de Rocket" (ajustável depois).
- Segundo local especial de Celadon (a estrutura suporta; o cadastro do nó é trabalho de mapa).
