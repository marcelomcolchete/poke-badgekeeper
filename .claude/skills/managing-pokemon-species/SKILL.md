---
name: managing-pokemon-species
description: Use when asked to cadastrar (criar) ou alterar um Pokémon (espécie) no poke-badgekeeper — definir/ajustar raridade, nível de evolução, e as habilidades secretas da linha (2 por linha, cada uma com nível 1/2), incluindo implementar uma habilidade secreta nova. Dataset é Gen 1; o CSV de balanceamento é a fonte de verdade.
---

# Cadastrar / alterar uma espécie de Pokémon

## Visão geral

O dataset é Gen 1. `scripts/data/pokemon-balance.csv` é a **fonte de verdade** do
balanceamento; `scripts/importPokemonCsv.ts` regenera 4 arquivos a partir dele:
`species.generated.ts`, `evolutions.generated.ts`, `genders.generated.ts`,
`minWildLevels.generated.ts`. **Nunca edite os `.generated.ts` à mão.** As
habilidades secretas ficam em `src/data/secretAbilities.ts` (dados/texto) e
`src/engine/secretEffects.ts` (lógica).

> Design autoritativo do modelo de nível 1/2: `docs/superpowers/specs/2026-06-21-habilidades-secretas-nivel-2-design.md`.

> **Step 0 — sempre primeiro:** leia o estado vivo, pois o repo muda rápido e o
> código vence esta skill se divergir:
> - `scripts/data/pokemon-balance.csv` (header/colunas atuais)
> - `src/data/secretAbilities.ts` (`SecretId`, `SECRET_KINDS`, `SECRET_LINES`, `SECRET_LINE_BY_SPECIES`, `lineRootId`)
> - `src/engine/secretEffects.ts` (predicados `hasSecret`/`secretLevelOf` e costuras existentes)
> - `src/types/index.ts` (`RARITIES`) e `src/engine/balance.ts` (`RARITY_DRAW_WEIGHT`)

## Pergunte ao usuário

1. **Criar** uma espécie nova ou **alterar** uma existente? Qual (id/nome)?
2. **Sempre** (criar e alterar):
   - **Raridade**: `common | uncommon | rare | epic | legend`.
   - **Nível de evolução**: para qual id evolui (`evolvesTo_id`, pode ser vazio) e
     em que nível (`evolve_atLevel`, escala 1–10). Vazio se não evolui.
   - **Habilidades secretas**: o **par** da linha — dois ids (`[slot0, slot1]`), cada
     um com `effectL1` e `effectL2`. O indivíduo desbloqueia ao ser Destaque do Dia
     (máx. 2× na vida): 1ª vez escolhe um dos dois (nível 1); 2ª vez escolhe
     **Aprofundar** (aquele vira nível 2, "+") ou **Ampliar** (o outro → nível 1).
     Progresso fica em `pokemon.secretPicks: Array<{slot:0|1; level:1|2}>`.
3. **Só ao criar**, também: `id` (≥ 152), `name` (minúsculo, estilo PokéAPI),
   `displayName`, `type1`/`type2`, os 6 `baseAttrs` (batalha, inteligencia,
   carisma, agilidade, resistencia, percepcao), `gender_rate`
   (oitavos-fêmea: 0=100% macho, 8=100% fêmea, -1=sem gênero), `minWildLevel`, e a
   **sprite** em `public/sprites/pokemons/gen1/<id>.png` (avise que o arquivo
   precisa existir).

## Campo → onde vai

| Campo | Coluna do CSV | Arquivo gerado |
|---|---|---|
| raridade | `rarity` | `species.generated.ts` |
| tipos | `type1`, `type2` | `species.generated.ts` |
| atributos base | `batalha`…`percepcao` | `species.generated.ts` |
| evolui para / nível | `evolvesTo_id`, `evolve_atLevel` | `evolutions.generated.ts` |
| gênero | `gender_rate` | `genders.generated.ts` |
| nível selvagem mín. | `minWildLevel` | `minWildLevels.generated.ts` |
| displayName/sprite (id novo) | — (derivados no import) | `species.generated.ts` |
| habilidades secretas | — | `src/data/secretAbilities.ts` (+ `secretEffects.ts` se nova) |

> O CSV tem colunas derivadas (`total`, `chance_female_%`, `chance_male_%`) só de
> conferência — preencha de forma coerente; o import ignora as que não usa.

## Procedimento

1. **Step 0** acima.
2. **Editar o CSV**: adicione (criar) ou ajuste (alterar) a linha em
   `scripts/data/pokemon-balance.csv`, preenchendo todas as colunas do header.
3. **Reimportar**: `node --experimental-strip-types scripts/importPokemonCsv.ts`.
   Confirme `OK: N espécies …` e que os `.generated.ts` foram regravados.
4. **Habilidades secretas** em `src/data/secretAbilities.ts`:
   - ache a raiz da linha com `lineRootId(speciesId)`;
   - grave o par `[id0, id1]` (slot 0 e slot 1) em `SECRET_LINES[root]`.
     Cada id já tem `effectL1` e `effectL2` definidos em `SECRET_KINDS`.
   - **Se** a linha for divergente (raiz compartilhada por evoluções diferentes —
     padrão Eevee), use `SECRET_LINE_BY_SPECIES[speciesId]` para não vazar o par
     para os irmãos.
5. **Habilidade NOVA** (id de habilidade ainda não existe): ver seção abaixo.
6. **Verificar**: `npm run build && npm test`. Não use preview (preferência do
   projeto: testes).

## Implementar uma habilidade secreta nova

Decida primeiro a **viabilidade** com os sistemas atuais:

- **Viável** (o efeito usa batalha/atributos/viagem/clima já existentes):
  1. adicione o id ao union `SecretId` e ao catálogo `SECRET_KINDS` com `name`,
     `effectL1` (texto do nível 1) e `effectL2` (texto do nível 2, o "+"). O nível 2
     é o upgrade do **mesmo id** — **não crie um id separado `*-plus`**;
  2. adicione um predicado usando `hasSecret(p, id)` (nível ≥ 1) e/ou
     `secretLevelOf(p, id)` (retorna 0/1/2) em `src/engine/secretEffects.ts`;
  3. implemente a lógica de forma **level-aware** na(s) costura(s) certa(s) da engine:
     use `secretLevelOf` para escalar magnitudes entre nível 1 e nível 2. Constantes
     em `src/engine/balance.ts` (espelhe o padrão de `swift-swim`/`cloud-nine` em
     `docs/superpowers/specs/2026-06-18-swift-swim-cloud-nine-design.md`);
  4. escreva testes do efeito para ambos os níveis.
- **Inviável** (depende de sistema que não existe — status de confusão/congelamento,
  tempestade de areia, calor/frio): apenas catalogue em `SECRET_KINDS` com `effectL1`
  e `effectL2` terminando em `(sem efeito até existir …)`, como os ids já marcados
  assim, e registre como follow-up. Não invente o sistema faltante aqui.

## Gotchas

- **Linha divergente (Eevee):** `lineRootId` colapsa todos os eeveelutions na raiz
  133; use `SECRET_LINE_BY_SPECIES` para dar um par próprio a um ramo.
- **Não edite `.generated.ts`** — eles são regerados; edite o CSV e reimporte.
- **Sprite obrigatória** para espécie nova: `public/sprites/pokemons/gen1/<id>.png`.
- O import preserva displayName/sprite de espécies existentes; para id novo ele
  deriva (`displayName` capitalizado, sprite por id). Ajuste o CSV/`displayName`
  depois se o nome de exibição for especial (ex.: `Nidoran♀`).
- **O "+" não é um id separado** — é o nível 2 do mesmo id. Não existem ids
  `*-plus` no sistema atual.
- O progresso por indivíduo fica em `pokemon.secretPicks` (array de `{slot, level}`);
  nenhum campo `secretCount` existe mais (migrado na versão de save 37).
- Sempre finalize com `npm run build && npm test`.
