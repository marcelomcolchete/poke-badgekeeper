# Design — Itens globais + itens de cidade

Data: 2026-06-25
Branch: `feat/itens-globais-e-cidades`

## Objetivo

Adicionar 23 itens novos ao jogo (8 no pool global, 15 distribuídos por 5 cidades)
e uma alteração de balanceamento no Shiny Charm. Os itens cobrem consumíveis
(berries, ovo), passivos de run (boosts de tipo/missão/ouro/viagem) e mecânicas
novas (incubação de ovo, balão com contador, berry diária).

## Princípios de arquitetura

Estender o sistema de itens existente, sem criar um paralelo:

- **`ItemEffect` tipado** para o que o jogador compra/usa e precisa de fluxo próprio:
  `berry`, `egg`, `instantGold`. Para modificadores passivos de run, usar
  `{ kind: 'passive' }` + checagem por id nos hooks do engine — mesmo padrão já
  usado por `thick-club`, `eviolite`, `mystic-water`, etc.
- **Constantes em `src/engine/balance.ts`** para todo número de balanceamento
  (multiplicadores 1.5, 0.75, +5, faixas 20–30, etc.). Nada hardcoded espalhado.
- **Campos novos no `GameState`** apenas onde há estado temporal: `eggs`,
  `airBalloon`, `pendingHatches`.
- **Determinismo total**: toda rolagem (shiny/rank/espécie do ovo, usos do balão,
  berry diária da fertilizer) usa o RNG semeado existente (`createRng`/`deriveSeed`).

Alternativa descartada: tratar berry/ovo/big-nugget como `passive` genérico com
if por id. Rejeitada porque esses três têm fluxo de compra/uso distinto (alvo,
incubação, payout) que merece tipo próprio e validação.

## Índices de cidade (canônico, de `CITIES`)

Pewter 0 · Cerulean 1 · Vermilion 2 · **Celadon 3 · Fuchsia 4 · Saffron 5 ·
Cinnabar 6 · Viridian 7**.

---

## 1. Pool GLOBAL (disponível em todas as cidades)

Adicionar os ids abaixo a `GLOBAL_ITEM_IDS` em `src/data/items.ts`.

### 1.1 Berries (6) — consumível, alvo único, 100 cada

Usadas igual à Potion (alvo único via seletor da `ItemsBar`). Efeito ao usar:

- Cura **25% do HP máximo** do alvo (cap no maxHp).
- Concede **+2 permanente** num atributo via `permaBonus[attr]` (clamp em
  `ATTR_MAX = 60`, mesmo mecanismo do Moxie).
- Alvo precisa estar **vivo** (status ≠ `fainted`). Não revive.
- O +2 é sempre aplicado; a cura é o que pode ser parcial/cap. Diferente da
  Potion, a berry é usável mesmo com HP cheio (porque o ganho de atributo é o
  valor principal) — mas isso é decisão de UX, ver "Pontos em aberto".

Novo `ItemEffect`: `{ kind: 'berry'; attr: AttrKey; healPct: number; statAmount: number }`
com `healPct: 0.25`, `statAmount: 2`.

Mapeamento berry → atributo:

| id (sprite)        | atributo      |
|--------------------|---------------|
| `petaya-berry`     | batalha       |
| `leppa-berry`      | inteligencia  |
| `golden-nanab-berry` | carisma     |
| `aguav-berry`      | agilidade     |
| `sitrus-berry`     | resistencia   |
| `rawst-berry`      | percepcao     |

### 1.2 Everstone — passivo, 700

Enquanto em `runItems`:

- Todo EXP ganho é **×2** (constante `EVERSTONE_XP_MULT = 2`).
- **Bloqueia toda evolução**: natural (por nível), Moon Stone e Rare Candy.
  - `evolveToLevel` retorna o Pokémon inalterado.
  - Rare Candy continua dando +1 nível e XP, mas não evolui.
  - Moon Stone não evolui (no-op enquanto Everstone estiver na run).

O multiplicador de XP é aplicado na distribuição de XP (ver
`src/game/itemFlow.ts` `applyXpGains`) e em qualquer outro ponto que conceda XP
(ex.: Rare Candy), via helper `expMultiplier(runItems)`.

### 1.3 Poke Egg — consumível especial, 500

Compra adiciona um ovo incubando ao estado; **não** entra em `inventory`/`runItems`.

- Estado por ovo: `{ id: string; daysElapsed: number }` em `state.eggs`.
- Exibição na `ItemsBar`: "Chocando 0/3 → 1/3 → 2/3" (não usável manualmente).
- A cada avanço de dia, `daysElapsed += 1`. Ao completar **3 dias** (`daysElapsed`
  chega a 3), o ovo eclode.
- Eclosão (rolagem determinística, seed derivada de `seed + eggId + day`):
  1. Rola shiny via `shinyChance(runItems)` = `SHINY_CHANCE (0.01)` + bônus do
     Shiny Charm (agora 0.19) se possuído.
  2. Se shiny → rank **S**. Senão rola rank: **40% B / 35% A / 25% S**
     (`EGG_RANK_WEIGHTS`).
  3. Sorteia uniformemente uma espécie de **1º estágio** (forma base, sem
     pré-evolução) cujo rank seja o sorteado. Cria Pokémon nível 1 com
     `createPokemon` (shiny já nasce rank S no sistema atual — consistente).
  4. Coloca no time se `roster.length < MAX_ROSTER_SIZE`, senão no `box` (PC).
- Enfileira um item em `state.pendingHatches` para o modal.
- **Vários ovos simultâneos** são suportados; cada um eclode no seu dia e gera
  seu próprio modal (fila processada um a um).

Novo `ItemEffect`: `{ kind: 'egg' }`.

Pool de espécies: derivar das espécies cuja forma é base (não evoluída de nada)
e cujo rank ∈ {B, A, S}. Reusar o sistema de rank existente (`RANKS`,
`rankOf`/equivalente em `src/engine`).

---

## 2. Celadon (cidade 3)

Adicionar a `CITY_ITEM_IDS[3]`.

- **grassy-seed** — passivo, 1000. +50% poder de batalha p/ Pokémon tipo Grama.
  Espelha `thick-club`: nova const `GRASSY_SEED_BATTLE_MULT = 1.5`, checagem em
  `itemBattleMultiplier` (`p.types.includes('grass')`).
- **fertilizer** — passivo, 400. Toda manhã, adiciona **1 berry aleatória** (das
  6) ao `inventory`. Rolagem determinística (seed + dia). Hook no fluxo de manhã/
  avanço de dia.
- **silver-powder** — passivo, 800. Viagem do esquadrão **+50% por inseto** no
  esquadrão (acumula). Fator de velocidade = `1 + 0.5 * nBugs` onde `nBugs` =
  nº de membros do esquadrão com tipo `bug`. Const
  `SILVER_POWDER_SPEED_PER_BUG = 0.5`. Aplicado no tempo de viagem em
  `travelRoute` (tempo dividido pelo fator). Como o esquadrão tem no máx
  `MAX_DISPATCH = 3`, o teto é +150%.

---

## 3. Fuchsia (cidade 4)

Adicionar a `CITY_ITEM_IDS[4]`.

- **black-sludge** — passivo, 1000. +50% poder de batalha p/ tipo Venenoso
  (`poison`). Const `BLACK_SLUDGE_BATTLE_MULT = 1.5` em `itemBattleMultiplier`.
- **sticky-barb** — passivo, 600. Em **cada duelo** da defesa de ginásio: o
  defensor perde **1 HP** e o poder do oponente daquele duelo é **×0.75**.
  Consts `STICKY_BARB_HP_COST = 1`, `STICKY_BARB_ENEMY_MULT = 0.75`. Hook no loop
  de duelo em `resolveDefense` (`src/engine/gymDefense.ts`): aplicar o
  multiplicador ao `enemyEff` antes do cálculo de `pWin`, e subtrair 1 do HP do
  defensor por duelo. O HP não pode ir abaixo de... (definir: pode desmaiar se
  chegar a 0 — comportamento normal de duelo).
- **big-nugget** — compra instantânea, 0. Ao comprar: `gold += 200` (×1.5 →
  300 se `amulet-coin` na run). Não entra em inventário. Novo `ItemEffect`:
  `{ kind: 'instantGold'; amount: 200 }`, tratado em `buyItem`. Const
  `BIG_NUGGET_GOLD = 200`. Comprável 1×/dia por slot (regra padrão de
  `purchasedItems`).

---

## 4. Saffron (cidade 5)

Adicionar a `CITY_ITEM_IDS[5]`.

- **twisted-spoon** — passivo, 1000. +50% poder de batalha p/ tipo Psíquico
  (`psychic`). Const `TWISTED_SPOON_BATTLE_MULT = 1.5`.
- **wise-glasses** — passivo, 1000. +50% poder do time em missões **Ensino**
  (template `ensino`). Via `missionTypeItemMultiplier`.
- **full-incense** — passivo, 800. Exploração atrai **+1** Pokémon (2 → 3).
  `CAPTURE_CHOICES` (constante hoje) vira função
  `effectiveCaptureChoices(runItems)` = `2 + (runItems.includes('full-incense') ? 1 : 0)`.
  Propagar `runItems` aos call sites de captura (`captureFlow.ts`, `capture.ts`).

---

## 5. Cinnabar (cidade 6)

Adicionar a `CITY_ITEM_IDS[6]`.

- **charcoal** — passivo, 1000. +50% poder de batalha p/ tipo Fogo (`fire`).
  Const `CHARCOAL_BATTLE_MULT = 1.5`.
- **zoom-lens** — passivo, 1000. +50% poder do time em missões **Escolta**
  (template `escolta`). Via `missionTypeItemMultiplier`.
- **air-balloon** — passivo com contador, 1200. Enquanto ativo, o time inteiro
  **voa** (rota em linha reta ignorando terreno — mesmo efeito de `teamFlies`).
  Ao comprar, sorteia `usesLeft` em **20–30** (determinístico, seed + dia) e
  grava em `state.airBalloon = { usesLeft }`. Cada **missão despachada** gasta 1
  uso; ao chegar a 0, o balão estoura (remove o efeito). Consts
  `AIR_BALLOON_USES_MIN = 20`, `AIR_BALLOON_USES_MAX = 30`. Hook: `travelRoute`
  considera `airBalloon?.usesLeft > 0` como "team flies"; decremento no
  despacho de missão.

---

## 6. Viridian (cidade 7)

Adicionar a `CITY_ITEM_IDS[7]`.

- **amulet-coin** — passivo, 800. **+50% de ouro de todas as fontes**: defesa de
  ginásio, missão Pokémart e payout do big-nugget. Wrapper
  `applyGoldBonus(amount, runItems)` = `amount * (runItems.includes('amulet-coin') ? 1.5 : 1)`,
  arredondado, aplicado em todos os pontos de ganho de ouro
  (`defenseFlow.ts`, `missionFlow.ts`, `buyItem` do big-nugget). Const
  `AMULET_COIN_GOLD_MULT = 1.5`.
- **wide-lens** — passivo, 1000. +50% poder do time em missões **Investigação**
  (template `investigacao`). Via `missionTypeItemMultiplier`.
- **grip-claw** — passivo, 500. **+5 fixo** no poder de batalha do defensor em
  duelos de defesa. Const `GRIP_CLAW_BATTLE_FLAT = 5`. Hook em `resolveDefense`:
  somar 5 ao `yourEff` (após multiplicadores de item/tipo).

---

## 7. Mudança de balanceamento (à parte)

- **Shiny Charm**: `SHINY_CHARM_BONUS` de **0.04 → 0.19** em
  `src/engine/constants.ts`. Com base 1%, o charm passa a dar **20%** de shiny.
  Afeta **todas** as rolagens de shiny (capturas e o ovo). Atualizar testes que
  fixam o valor 0.04 (`src/engine/shiny.test.ts`).

---

## Hooks técnicos (resumo)

| Mecânica | Arquivo | Ponto |
|---|---|---|
| Batalha por tipo (grassy/sludge/spoon/charcoal) | `src/engine/itemEffects.ts` | `itemBattleMultiplier` |
| sticky-barb / grip-claw | `src/engine/gymDefense.ts` | loop de duelo em `resolveDefense` |
| Missão por tipo (wise/zoom/wide) | `src/engine/secretEffects.ts` ou `missions.ts` | novo `missionTypeItemMultiplier(template, runItems)` no poder do time |
| Viagem (silver-powder / air-balloon) | `src/engine/missions.ts` (`travelRoute`) | velocidade por inseto; override de voo |
| Ouro (amulet-coin) | `src/game/defenseFlow.ts`, `src/game/missionFlow.ts` | wrapper `applyGoldBonus` |
| Captura (full-incense) | `src/engine/capture.ts`, `src/game/captureFlow.ts` | `effectiveCaptureChoices(runItems)` |
| EXP/Evo (everstone) | `src/game/itemFlow.ts`, `src/engine/leveling.ts` | `expMultiplier`; bloqueio em `evolveToLevel`/moon-stone/rare-candy |
| Berry (uso) | `src/game/marketFlow.ts` | novo ramo em `applyItem` (heal + permaBonus) |
| Ovo + fertilizer | fluxo de avanço de dia / manhã | incubação, eclosão, berry diária |
| big-nugget | `src/game/marketFlow.ts` | `buyItem` ramo `instantGold` |
| Catálogo / loja | `src/data/items.ts` | `ITEMS`, `GLOBAL_ITEM_IDS`, `CITY_ITEM_IDS[3..7]` |

## Estado novo (`src/engine/state.ts`)

- `eggs: IncubatingEgg[]` — `{ id: string; daysElapsed: number }`.
- `airBalloon: { usesLeft: number } | null`.
- `pendingHatches: HatchResult[]` — fila p/ o modal de eclosão
  (`{ pokemon: Pokemon; toTeam: boolean }` ou similar).

## UI

- **`ItemsBar`**: berries como consumível com seletor de alvo; ovos como display
  "Chocando N/3" (não clicável); passivos read-only (já existe).
- **`EggHatchModal`** (novo): mostra o Pokémon chocado (sprite, nome, shiny) e se
  foi pro time ou PC. Botão para dispensar → ação que remove da fila
  `pendingHatches`. Se houver vários, mostra um por vez.
- **Mercado**: novos itens renderizam automaticamente (sprite/preço/descrição já
  vêm do `ItemData`). Sprites já presentes em `public/sprites/itens/`.

## Determinismo & testes

- Toda rolagem usa RNG semeado. Ovo: seed derivada de `seed + eggId + day`.
  Balão: `seed + dia` na compra. Fertilizer: `seed + dia`.
- Testes a cobrir: mapeamento berry→atributo + cura + cap de permaBonus;
  Everstone (×2 XP, bloqueio de evolução nas 3 vias); eclosão (distribuição de
  rank, shiny→S, colocação time/PC, fila de modais); multiplicadores de
  batalha por tipo; sticky-barb (−1 HP + ×0.75) e grip-claw (+5); mult por tipo
  de missão; silver-powder (acúmulo por inseto); air-balloon (faixa 20–30 e
  estouro); amulet-coin (todas as fontes incl. big-nugget); full-incense
  (2→3); Shiny Charm 0.19 (atualizar teste existente).
- Build/tipos: validar com `npm run build` (tsc -b), não `tsc --noEmit`.

## Fora de escopo

- Sprites extras presentes mas não citados: `black-belt.png`, `explorer-kit.png`,
  `soul-dew.png` — ficam sem uso (não entram no catálogo).

## Pontos em aberto (decisões de UX a confirmar na implementação)

- Berry com HP cheio: permitir uso (ganho de atributo é o principal) — assumido
  **sim**. Reavaliar se o seletor de alvo deve bloquear alvos cheios.
- Empilhamento de itens de batalha por tipo (ex.: um Pokémon Grama/Veneno com
  grassy-seed e black-sludge) multiplica os dois — assumido **sim** (mesma
  semântica multiplicativa de `itemBattleMultiplier` atual).
