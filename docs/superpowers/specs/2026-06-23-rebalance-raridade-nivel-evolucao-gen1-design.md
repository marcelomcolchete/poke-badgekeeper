# Rebalanceamento Gen 1: raridade e nível de evolução

**Data:** 2026-06-23
**Escopo:** revisar **raridade** e **nível de evolução** de todas as linhas evolutivas
da Gen 1, linha por linha. Sem mexer em atributos base, habilidades secretas, gênero
ou `minWildLevel`.

## Objetivo

Recalibrar duas dimensões do balanceamento de cada linha, usando como referência
(somente leitura) a soma dos atributos base por estágio, os tipos e o par de
habilidades secretas da linha.

## Decisões de modelagem

- **Fonte de verdade:** `scripts/data/pokemon-balance.csv`. O import
  (`scripts/importPokemonCsv.ts`) regenera `species/evolutions/genders/minWildLevels.generated.ts`.
  Nunca editar os `.generated.ts` à mão.
- **Raridade é por linha:** um único valor aplicado a **todos os estágios** da linha
  (coluna `rarity` de cada linha-membro recebe o mesmo valor).
- **Nível de evolução é por passo:** cada passo de evolução tem seu próprio
  `evolve_atLevel` (escala 1–10), gravado na linha da forma que evolui.
- **Agrupamento da revisão:** por tipo primário (`type1`) da forma-base. Cada linha
  foi revisada uma única vez.
- **Fora de escopo:** atributos base, habilidades secretas (`SECRET_LINES`), gênero
  e `minWildLevel` permanecem como estão.

## Mudanças de raridade

| Linha (raiz) | id | De | Para |
|---|---|---|---|
| Bulbasaur | 1 | uncommon | rare |
| Charmander | 4 | uncommon | rare |
| Vulpix | 37 | epic | uncommon |
| Growlithe | 58 | rare | common |
| Squirtle | 7 | uncommon | rare |
| Poliwag | 60 | uncommon | common |
| Slowpoke | 79 | uncommon | rare |
| Seel | 86 | rare | common |
| Horsea | 116 | common | rare |
| Farfetch'd | 83 | epic | rare |
| Doduo | 84 | rare | uncommon |
| Chansey | 113 | epic | rare |
| Tauros | 128 | epic | rare |
| Sandshrew | 27 | rare | uncommon |
| Diglett | 50 | rare | common |
| Rhyhorn | 111 | uncommon | rare |

## Mudanças de nível de evolução

Notação: níveis por passo na ordem dos estágios. `3·6 → 4·8` = primeiro passo de 3
para 4, segundo passo de 6 para 8.

| Linha (raiz) | id | De | Para |
|---|---|---|---|
| Bulbasaur | 1 | 3·6 | 4·8 |
| Oddish | 43 | 4·5 | 3·8 |
| Bellsprout | 69 | 4·5 | 4·7 |
| Exeggcute | 102 | 4 | 7 |
| Charmander | 4 | 3·6 | 4·8 |
| Vulpix | 37 | 4 | 6 |
| Growlithe | 58 | 6 | 8 |
| Squirtle | 7 | 3·6 | 4·8 |
| Poliwag | 60 | 4·5 | 3·8 |
| Tentacool | 72 | 5 | 7 |
| Seel | 86 | 6 | 8 |
| Shellder | 90 | 4 | 7 |
| Krabby | 98 | 5 | 6 |
| Horsea | 116 | 3 | 5 |
| Goldeen | 118 | 4 | 6 |
| Staryu | 120 | 5 | 7 |
| Magikarp | 129 | 4 | 8 |
| Caterpie | 10 | 2·3 | 3·4 |
| Weedle | 13 | 2·3 | 2·5 |
| Paras | 46 | 4 | 5 |
| Venonat | 48 | 5 | 6 |
| Pidgey | 16 | 2·6 | 3·8 |
| Rattata | 19 | 4 | 6 |
| Spearow | 21 | 4 | 6 |
| Clefairy | 35 | 5 | 7 |
| Jigglypuff | 39 | 5 | 6 |
| Meowth | 52 | 4 | 5 |
| Doduo | 84 | 5 | 7 |
| Eevee | 133 | 5 | 8 |
| Ekans | 23 | 4 | 7 |
| Nidoran♀ | 29 | 3·5 | 4·7 |
| Nidoran♂ | 32 | 3·5 | 3·8 |
| Zubat | 41 | 4 | 7 |
| Grimer | 88 | 6 | 7 |
| Pikachu | 25 | 5 | 6 |
| Magnemite | 81 | 4 | 7 |
| Voltorb | 100 | 5 | 8 |
| Sandshrew | 27 | 4 | 7 |
| Diglett | 50 | 3 | 7 |
| Cubone | 104 | 3 | 5 |
| Rhyhorn | 111 | 5 | 7 |
| Mankey | 56 | 5 | 7 |
| Machop | 66 | 4·6 | 4·8 |
| Abra | 63 | 3·7 | 5·8 |
| Drowzee | 96 | 5 | 7 |
| Geodude | 74 | 4·6 | 4·8 |
| Omanyte | 138 | 7 | 6 |
| Gastly | 92 | 4·6 | 4·8 |
| Dratini | 147 | 4·7 | 5·9 |

## Linhas sem mudança

Tangela, Ponyta, Magmar, Moltres, Psyduck, Lapras, Scyther, Pinsir, Lickitung,
Kangaskhan, Ditto, Porygon, Snorlax, Koffing, Electabuzz, Zapdos, Onix, Kabuto,
Aerodactyl, Hitmonlee, Hitmonchan, Mr. Mime, Mewtwo, Mew, Jynx, Articuno.

## Follow-up: `minWildLevel` defasado (NÃO alterado aqui)

Como vários níveis de evolução subiram, a forma evoluída de muitas linhas passa a
ter `minWildLevel` **abaixo** do novo nível de evolução do passo que a gera — ou seja,
ela pode aparecer selvagem num nível em que a pré-evolução ainda nem teria evoluído.
Mantido como está por estar fora de escopo; registrado para decisão futura.

Casos (forma evoluída — `minWildLevel` atual `<` novo nível de evolução do passo):

| Forma | minWildLevel | Novo nível do passo |
|---|---|---|
| Ivysaur (2) | 3 | 4 |
| Venusaur (3) | 6 | 8 |
| Vileplume (45) | 5 | 8 |
| Victreebel (71) | 5 | 7 |
| Exeggutor (103) | 4 | 7 |
| Charmeleon (5) | 3 | 4 |
| Charizard (6) | 6 | 8 |
| Ninetales (38) | 4 | 6 |
| Arcanine (59) | 6 | 8 |
| Wartortle (8) | 3 | 4 |
| Blastoise (9) | 6 | 8 |
| Poliwrath (62) | 5 | 8 |
| Tentacruel (73) | 5 | 7 |
| Dewgong (87) | 6 | 8 |
| Cloyster (91) | 4 | 7 |
| Kingler (99) | 5 | 6 |
| Seadra (117) | 3 | 5 |
| Seaking (119) | 4 | 6 |
| Starmie (121) | 5 | 7 |
| Gyarados (130) | 4 | 8 |
| Metapod (11) | 2 | 3 |
| Butterfree (12) | 3 | 4 |
| Beedrill (15) | 3 | 5 |
| Parasect (47) | 4 | 5 |
| Venomoth (49) | 5 | 6 |
| Pidgeotto (17) | 2 | 3 |
| Pidgeot (18) | 6 | 8 |
| Raticate (20) | 4 | 6 |
| Fearow (22) | 4 | 6 |
| Clefable (36) | 5 | 7 |
| Wigglytuff (40) | 5 | 6 |
| Persian (53) | 4 | 5 |
| Dodrio (85) | 5 | 7 |
| Vaporeon (134) | 5 | 8 |
| Jolteon (135) | 5 | 8 |
| Flareon (136) | 5 | 8 |
| Arbok (24) | 4 | 7 |
| Nidorina (30) | 3 | 4 |
| Nidoqueen (31) | 5 | 7 |
| Nidoking (34) | 5 | 8 |
| Golbat (42) | 4 | 7 |
| Muk (89) | 6 | 7 |
| Raichu (26) | 5 | 6 |
| Magneton (82) | 4 | 7 |
| Electrode (101) | 5 | 8 |
| Sandslash (28) | 4 | 7 |
| Dugtrio (51) | 3 | 7 |
| Marowak (105) | 3 | 5 |
| Rhydon (112) | 5 | 7 |
| Primeape (57) | 5 | 7 |
| Machamp (68) | 6 | 8 |
| Kadabra (64) | 3 | 5 |
| Alakazam (65) | 7 | 8 |
| Hypno (97) | 5 | 7 |
| Golem (76) | 6 | 8 |
| Gengar (94) | 6 | 8 |
| Dragonair (148) | 4 | 5 |
| Dragonite (149) | 7 | 9 |

Oddish/Bellsprout/Poliwag/Weedle/Nidoran♂/Machop/Geodude/Gastly: o **primeiro** passo
ficou consistente (nível baixado ou mantido); só os passos listados acima ficaram
defasados.

## Procedimento de implementação

1. Editar `scripts/data/pokemon-balance.csv`: para cada linha alterada, ajustar
   `rarity` (em todos os estágios da linha) e `evolve_atLevel` (na linha do passo que
   evolui).
2. Reimportar: `node --experimental-strip-types scripts/importPokemonCsv.ts`.
   Confirmar `OK: N espécies …` e a regravação dos `.generated.ts`.
3. Verificar: `npm run build && npm test`. Sem preview (preferência do projeto: testes).
4. Não tocar em `secretAbilities.ts`, atributos base, gênero nem `minWildLevel`.
