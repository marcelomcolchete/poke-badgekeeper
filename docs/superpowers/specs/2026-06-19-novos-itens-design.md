# Design: novos itens (Vermilion + gerais) e alteração da Fossil Stone

Data: 2026-06-19

## Objetivo

Adicionar 5 itens novos e alterar 1 existente:

- **Vermilion (cidade 2):** `electirizer`, `dragon-fang`, `magnet`
- **Alteração:** `fossil-stone` deixa de dar um fóssil e vira passivo de batalha
- **Gerais (todas as cidades):** `Shiny Charm`, `Moon Stone`

Vermilion é tematicamente "Elétrico/Dragão" e é a única cidade com Tempestade
(`cityHasStorm(2) === true`), então os três itens próprios encaixam ali e o
`electirizer` realmente dispara.

---

## 1. `electirizer` — passivo, 650g, Vermilion

### Comportamento

Enquanto o item estiver na run (`runItems`), sempre que um Pokémon seu é
**atingido por um raio** da Tempestade:

- Ele **continua sofrendo o efeito normal do raio** (−1 HP, Paralyze = −50% em
  batalha pelo resto do dia, congela 5s). O item **não anula** o perigo.
- **Além disso**, ganha **+50% de bônus no sucesso da próxima missão**.
- Cada raio **empilha**: 2 raios antes de despachar = +100%.
- O bônus é **por-Pokémon** e fica guardado até esse Pokémon ser **despachado
  numa missão**, quando é **consumido** (snapshot no envio → aplicado no cálculo
  → carga zerada). Não é por-dia: se não usar hoje, persiste até a próxima
  missão.

### Implementação

- **Estado** (`engine/state.ts`): novo campo `electirizerCharges: Record<string, number>`
  (id do Pokémon → nº de cargas). Inicializa `{}`. Saves antigos sem o campo caem
  em `{}` (sem migração obrigatória).
- **Disparo** (`game/stormFlow.ts`, `processStorms`): ao processar um Pokémon
  atingido, se `runItems` inclui `electirizer`, incrementa `electirizerCharges[id]`.
  Fica junto da aplicação de dano/Paralyze já existente.
- **Snapshot no despacho** (`game/missionFlow.ts`): ao criar a missão, para cada
  `teamId` com carga > 0, copia a soma das cargas para um campo da missão (ex.:
  `mission.electirizerBonus: number`, somando todos os membros — ver nota abaixo)
  e zera `electirizerCharges[id]`.
- **Aplicação** (`engine/itemEffects.ts`, `itemMissionMultiplier`): a função
  recebe (ou a missão repassa) o bônus do Pokémon e multiplica por
  `(1 + ELECTIRIZER_MISSION_BONUS · stacks)`.
- **Constante** (`engine/balance.ts`): `ELECTIRIZER_MISSION_BONUS = 0.5`.

> **Nota de granularidade:** o bônus é por-Pokémon (a carga é por id). Como o
> multiplicador de missão já é avaliado por Pokémon em `itemMissionMultiplier(p, …)`,
> o snapshot deve ser **por-Pokémon na missão** (ex.:
> `mission.electirizerBonus: Record<string, number>`), não um número único do time.
> Cada membro aplica só a própria carga.

### Texto (PT)

> "Quando um Pokémon seu é atingido por um raio, ele ganha +50% na próxima missão
> (acumula a cada raio)."

---

## 2. `dragon-fang` — passivo, 1000g, Vermilion

Clone exato de `thick-club`, mas para tipo **Dragão**: +50% em **batalhas**
(gym defense) para Pokémon `types.includes('dragon')`.

- `engine/itemEffects.ts`, `itemBattleMultiplier`: nova checagem.
- `engine/balance.ts`: `DRAGON_FANG_BATTLE_MULT = 1.5`.
- Texto: "Pokémon do tipo Dragão ganham +50% em batalhas."

## 3. `magnet` — passivo, 1000g, Vermilion

Clone exato de `thick-club`, mas para tipo **Elétrico**: +50% em **batalhas**
para Pokémon `types.includes('electric')`.

- `engine/balance.ts`: `MAGNET_BATTLE_MULT = 1.5`.
- Texto: "Pokémon do tipo Elétrico ganham +50% em batalhas."

---

## 4. Alteração: `fossil-stone` vira passivo

De consumível (recebe um fóssil aleatório) → **passivo**: +50% em **batalhas**
para Pokémon **fóssil**.

- "Fóssil" = whitelist das 5 espécies `[138, 139, 140, 141, 142]`
  (Omanyte/Omastar/Kabuto/Kabutops/Aerodactyl). Não existe "tipo fóssil".
- Continua em **Pewter (cidade 0)**.
- **Preço: 800 → 1000** (alinha com `thick-club`/`mystic-water`).
- **Tipo: `consumable` → `passive`**, `effect.kind: 'fossilStone'` → `'passive'`.

### Consequência aceita

Isso **remove a única fonte gratuita de fóssil** do jogo (decisão confirmada
com o usuário). Remove a função `grantFossil` e o branch `fossilStone` em
`game/marketFlow.ts`, e o `FOSSIL_SPECIES_IDS` migra para onde a checagem de
batalha precisar (ex.: helper `isFossilSpecies(speciesId)` em local
compartilhado — `engine/itemEffects.ts` ou um util de espécies).

### Implementação

- `engine/itemEffects.ts`, `itemBattleMultiplier`: se `runItems` tem
  `fossil-stone` e `isFossilSpecies(p.speciesId)`, multiplica por
  `FOSSIL_STONE_BATTLE_MULT = 1.5`.
- `data/types.ts`: remove `{ kind: 'fossilStone' }` de `ItemEffect`.
- `game/marketFlow.ts`: remove `grantFossil` e o `case 'fossilStone'`.
- **Saves antigos:** `fossil-stone` era consumível (nunca entrou em `runItems`),
  então nenhum save o carrega como passivo possuído. Compras antigas registradas
  no dia não guardam `effect.kind`. Sem migração.

---

## 5. `Shiny Charm` — passivo, 1000g, geral

+4% na chance de shiny: de `SHINY_CHANCE = 0.01` (1%) para **5%** enquanto
possuído.

### Implementação

O shiny é determinístico: `shinyFor(...parts)` compara `rng.next()` contra
`SHINY_CHANCE`. Para o charm, passamos a **chance efetiva** pelos call sites que
têm contexto de run:

- `engine/shiny.ts`: `rollShiny`/`shinyFor`/`spotHasShiny` ganham um parâmetro
  opcional de chance (default `SHINY_CHANCE`). `engine/balance.ts` ou
  `constants.ts`: `SHINY_CHARM_BONUS = 0.04` (chance efetiva = `0.01 + 0.04`).
- Call sites com run:
  - `game/captureFlow.ts` (`candidateShiny`): passa `0.05` se `runItems` tem
    `shiny-charm`, senão `0.01`.
  - `components/day/CityMap.tsx` (`spotHasShiny`): idem, lê `runItems` do estado.
- **Monotônico:** mesmo saque de `rng.next()` contra um limiar maior → tudo que
  era shiny a 1% continua shiny a 5%, e alguns novos viram shiny. Comprar **nunca
  des-shinya** nada. O mapa reflete a chance maior imediatamente após a compra.
- O **inicial** (`game/setup.ts` / `NewGameScreen.tsx`) é decidido antes de
  qualquer item → permanece 1% (não passa o bônus).

### Texto

> "Aumenta em +4% a chance de encontrar Pokémon shiny."

---

## 6. `Moon Stone` — consumível, 700g, geral

Escolhe um Pokémon para **evoluir ignorando o requisito de nível**.

### Comportamento

- Ao comprar, abre um **modal de seleção** (reusa o padrão do Rare Candy em
  `MorningScreen.tsx`) listando **todos** os Pokémon **do time E da caixa (PC)**
  que têm evolução pendente (`getSpecies(speciesId).evolvesTo !== null`).
- **Não pode ser comprado** se nenhum Pokémon (time ou caixa) for evoluível —
  espelha a checagem `anyLevelable` do Rare Candy, mas com elegibilidade de
  evolução e abrangendo `roster` + `box`.
- Ao escolher: evolui **um estágio**, **ramo aleatório** (igual à evolução por
  nível — `rng.pick(evo.ids)`), **mantendo o nível atual** e preservando o % de
  HP (mesma lógica de `evolveInto`).

### Implementação

- `engine/leveling.ts`: novo helper `evolveOneStage(p, rng)` — pega
  `getSpecies(p.speciesId).evolvesTo`; se `null`, retorna `p` inalterado; senão
  `evolveInto(p, rng.pick(evo.ids))` **sem** checar `atLevel`. Um único estágio
  (não encadeia como `evolveToLevel`).
- `data/types.ts`: `ItemEffect` ganha `{ kind: 'moonStone' }`.
- `game/marketFlow.ts`: `case 'moonStone'` abre o fluxo de seleção (não evolui
  direto — depende do alvo escolhido), análogo ao `rareCandy`. A evolução em si
  roda quando o alvo é confirmado, via `replaceMon` (que já cobre roster + box).
- `components/screens/MorningScreen.tsx`: estado/modal de Moon Stone listando
  `[...roster, ...box]` evoluíveis; `shopState` desabilita a compra se nenhum
  evoluível.

### Texto

> "Escolha um Pokémon para evoluir na hora, mesmo sem o nível."

---

## Catálogo / cidades (`data/items.ts`)

- **Novas entradas em `ITEMS`:** `electirizer`, `dragon-fang`, `magnet`,
  `shiny-charm`, `moon-stone`. Alterar a entrada `fossil-stone`.
- **`GLOBAL_ITEM_IDS`:** adicionar `shiny-charm`, `moon-stone`.
- **`CITY_ITEM_IDS[2]`** (Vermilion, hoje inexistente): `['electirizer', 'dragon-fang', 'magnet']`.
- **`CITY_ITEM_IDS[0]`** (Pewter): mantém `fossil-stone` (agora passivo).

## Sprites

Todas já existem em `public/sprites/itens/`: `electirizer.png`,
`dragon-fang.png`, `magnet.png`, `shiny-charm.png`, `moon-stone.png`,
`fossil-stone.png`. (O teste `data/items.test.ts` valida que cada item tem
sprite — coberto.)

## Constantes novas (`engine/balance.ts`)

| Constante | Valor |
|---|---|
| `DRAGON_FANG_BATTLE_MULT` | 1.5 |
| `MAGNET_BATTLE_MULT` | 1.5 |
| `FOSSIL_STONE_BATTLE_MULT` | 1.5 |
| `ELECTIRIZER_MISSION_BONUS` | 0.5 |
| `SHINY_CHARM_BONUS` | 0.04 |

## Resumo de arquivos tocados

- `data/items.ts` — 5 entradas novas + alterar fossil-stone; global/city ids
- `data/types.ts` — `ItemEffect`: remove `fossilStone`, adiciona `moonStone`
- `engine/balance.ts` — 5 constantes novas
- `engine/itemEffects.ts` — battle: dragon/electric/fossil; mission: electirizer;
  helper `isFossilSpecies`
- `engine/shiny.ts` (+ `constants.ts`) — chance efetiva parametrizável (charm)
- `engine/leveling.ts` — `evolveOneStage`
- `engine/state.ts` — `electirizerCharges`; campo de snapshot na missão
- `game/stormFlow.ts` — incrementa carga ao acertar com electirizer
- `game/missionFlow.ts` — snapshot + consumo das cargas no despacho
- `game/marketFlow.ts` — remove fossil/grantFossil; adiciona moonStone
- `game/captureFlow.ts` — passa chance shiny do charm
- `components/day/CityMap.tsx` — passa chance shiny do charm (`spotHasShiny`)
- `components/screens/MorningScreen.tsx` — modal Moon Stone (time + caixa) +
  elegibilidade de compra

## Testes (alto nível)

- `itemEffects`: dragon-fang/magnet/fossil-stone aplicam ×1.5 só ao tipo/espécie
  certo e só em batalha; electirizer aplica +50%/stack só na missão.
- `stormFlow`: acerto de raio com electirizer incrementa carga; sem o item, não.
- `missionFlow`: carga é consumida (snapshot + zera) ao despachar.
- `shiny`: com charm, chance efetiva 5% e monotonicidade (nada deixa de ser
  shiny); sem charm, 1%.
- `leveling`: `evolveOneStage` evolui 1 estágio, mantém nível, ignora `atLevel`,
  preserva % HP, sorteia ramo; espécie final retorna inalterada.
- `items.test.ts`: sprites/ids dos novos itens; fossil-stone agora passivo.
- `marketFlow`: Moon Stone evolui o alvo (roster e box); bloqueio de compra sem
  evoluível.
