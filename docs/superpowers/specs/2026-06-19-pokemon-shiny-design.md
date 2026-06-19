# Sistema de Pokémon Shiny — Design

**Data:** 2026-06-19
**Status:** aprovado para planejamento

## Objetivo

Adicionar Pokémon shiny ao jogo. Um shiny tem 1% de chance de surgir nas
superfícies que **criam** um Pokémon do jogador, é **sempre rank S** e usa uma
**sprite própria** (a sprite shiny da PokéAPI, baixada do mesmo CDN das normais).

Pokémon de inimigos/treinadores (defesa, Rocket) **nunca** são shiny — eles não
entram no roster do jogador.

## Regra central: determinismo

Toda decisão de shiny é uma **rolagem determinística derivada de um seed que já
existe** (nunca `Math.random()`). O jogo já garante que o card de preview é
exatamente o Pokémon obtido (mesma natureza/IVs/rank), porque preview e
obtenção recriam o Pokémon a partir do mesmo seed. O shiny segue o mesmo
princípio: preview = resultado, e o pré-aviso no mapa concorda com o que será
capturado.

Constantes novas em `src/engine/constants.ts`:

- `SHINY_CHANCE = 0.01`
- `SHINY_SEED_SALT` — sal dedicado para `deriveSeed`, isolando a rolagem de
  shiny das demais sequências de RNG.

Rolagem padrão: `createRng(deriveSeed(...)).next() < SHINY_CHANCE`
(`Rng.next()` devolve `[0, 1)`).

### Por que decidir o shiny FORA de `createPokemon`

`createPokemon` recebe um flag `shiny?: boolean` já decidido; não sorteia shiny
internamente. Alternativa rejeitada: sortear dentro de `createPokemon` — isso
deslocaria a sequência de RNG (alocações/gênero/natureza/IVs) e quebraria o
determinismo e os testes existentes. Decidindo fora e passando o flag, as
sequências atuais ficam intactas.

## Modelo de dados

- `Pokemon` ganha `shiny?: boolean` (`src/types/index.ts`). Ausente = não-shiny.
  Saves antigos seguem válidos sem migração.
- `CaptureEncounter` (`src/engine/state.ts`) ganha `candidateShiny?: boolean[]`,
  paralelo a `candidateSeeds`/`candidateLevels`. Ausente = todos não-shiny
  (saves antigos).
- `SpeciesBase` (`src/data/types.ts`) ganha `shinySpritePath: string`
  (auto-gerado), análogo a `spritePath`.

## Onde o shiny é sorteado (3 superfícies)

### 1. Iniciais (`startRun`, `src/game/setup.ts`)

1% por inicial escolhido, derivado de `pick.seed`
(`createRng(deriveSeed(pick.seed, SHINY_SEED_SALT)).next() < SHINY_CHANCE`).
Passa `shiny` para `createPokemon`. A tela de novo jogo (`NewGameScreen`)
computa o mesmo a partir do mesmo `seed`, então o card do preview já mostra a
sprite shiny e o badge.

### 2. Captura / exploração (`captureFlow.ts`)

1% **por candidato** (são 2 candidatos — `CAPTURE_CHOICES = 2`), independentes:
ambos podem ser shiny, mas pela probabilidade geralmente ≤ 1
(P(exatamente um) ≈ 1,98%, P(ambos) ≈ 0,01%).

A rolagem é derivada de `(run.seed, dia, spotIndex, slot)`, **independente** do
explorador e do `candidateSeed`. Isso permite saber se há shiny no spot **antes**
de mandar o explorador (pré-aviso no mapa) e que o encontro concorde depois.

Helper puro novo (ex.: `engine/shiny.ts`):

```
candidateIsShiny(seed, day, spotIndex, slot): boolean
  = createRng(deriveSeed(seed, SHINY_SEED_SALT, day, spotIndex, slot)).next() < SHINY_CHANCE
```

- **`setupDay`** computa, por spot, se algum slot é shiny → marca o spot para a
  folha amarela (pré-aviso desde que o spot surge no mapa).
- **`readySearch`** computa por candidato o mesmo `candidateIsShiny(...)` e grava
  em `encounter.candidateShiny[]`.
- **`capturePick`** lê `encounter.candidateShiny[candidateIndex]` e passa `shiny`
  para `createPokemon`.
- **`EncounterChoice`** passa `shiny: encounter.candidateShiny?.[i]` para
  `previewPokemon`, então o card já mostra sprite shiny + rank S + badge.

### 3. Item Fossil Stone (`grantFossil`, `src/game/marketFlow.ts`)

1% no momento do grant, sorteado do RNG da run (`takeRng`). É uma surpresa (sem
preview). Quando shiny, sobrepõe o `rankCenter` F–S sorteado (vira rank S).

## Shiny ⇒ sempre rank S

`createPokemon` (`src/engine/leveling.ts`) ganha `shiny?: boolean` em
`NewPokemonSpec`. Quando `true`, os 6 IVs são forçados à banda S via
`ivForRankIndex(rng, RANKS.length - 1)` (sorteia 8–10 por eixo), sobrepondo
qualquer `rankCenter`. Os IVs são o **último** consumo de RNG da criação, então
mesmo que o caminho shiny saque uma quantidade diferente do caminho normal, nada
posterior é deslocado. O `shiny` decidido também é gravado no Pokémon resultante.

`previewPokemon` (`src/components/common/preview.ts`) ganha a opção `shiny`,
repassada a `createPokemon`, para iniciais e candidatos exibirem corretamente.

## Sprites & exibição

### Geração

`scripts/buildPokemonData.ts`:

- Baixa também a sprite shiny de
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/<id>.png`
  para `public/sprites/pokemons/gen1/shiny/<id>.png`.
- Emite `shinySpritePath: "/sprites/pokemons/gen1/shiny/<id>.png"` em
  `species.generated.ts`.

### Helper de exibição

Helper único (ex.: em `src/components/common/visual.ts` ou
`src/data/pokemon/index.ts`):

```
pokemonSpritePath(p: { speciesId: number; shiny?: boolean }): string
  → shiny ? species.shinySpritePath : species.spritePath
```

### Call-sites a trocar (exibem Pokémon do jogador / candidatos)

`PokemonCard`, `MemberDetail`, `BoxPanel`, `TeamSidebar`, `EncounterChoice`,
`ExplorerPick`, `MissionDispatch`, `MissionRevealModal`, `CityMap` (sprite do
viajante), `ReportSidebar` (Pokémon capturado).

**Não trocar:** `BattleView`/`DefensePanel` (sprites de inimigos/treinadores) e
`CapturePokedex` (Pokédex é por espécie, não por indivíduo).

### Badge ✨

Badge ✨ discreto no card e no detalhe do Pokémon, além da sprite shiny, para
deixar inequívoco mesmo em sprites pequenas.

### Folha amarela (pré-aviso)

`CityMap.tsx`, `explorationVisual` / marcador de exploração: o estado base do
spot usa `🌿` (`--c-grass-dark`). Quando o spot tem shiny hoje (calculado em
`setupDay`), o marcador base usa folha amarela (ex.: `🍂` e cor de acento
amarela). O pré-aviso vale a partir do surgimento do spot no mapa; os estados
"a caminho / explorando / pronto / voltando" seguem como hoje.

## Testes

- **Determinismo:** mesmo `seed` ⇒ mesmo `shiny`; preview = captura para
  candidatos shiny; iniciais shiny estáveis por `pick.seed`.
- **Probabilidade:** rolagem por candidato é 1%; sobre N seeds, frequência bate
  com `SHINY_CHANCE` dentro de tolerância.
- **Rank S:** todo shiny tem `pokemonRank === 'S'` (todos os IVs na banda S).
- **Fossil Stone:** quando shiny, sobrepõe o rank sorteado e vira S.
- **Pré-aviso:** `setupDay` marca o spot como shiny exatamente quando algum slot
  é shiny por `candidateIsShiny`.
- **Retrocompat:** Pokémon/encontros sem `shiny`/`candidateShiny` se comportam
  como não-shiny.

## Fora de escopo (YAGNI)

- Shiny em inimigos/treinadores/Rocket.
- Modificadores de taxa de shiny (itens/habilidades que aumentam o 1%).
- Shiny como recompensa de missões centro/mercado/casa (essas missões não criam
  Pokémon do jogador hoje).
