# Habilidades Secretas — Linhas de Grama e Inseto (Celadon Gym)

Data: 2026-06-23

## Contexto

Nenhuma das 11 linhas evolutivas de tipo Grama/Inseto (usadas na Celadon Gym) tem
habilidade secreta cadastrada. Habilidades secretas são **por LINHA evolutiva**: cada
linha tem 2 slots (0 e 1), cada um com nível 1 ("base") e 2 ("+"). O conteúdo (nome +
`effectL1`/`effectL2`) vive em [`src/data/secretAbilities.ts`](../../../src/data/secretAbilities.ts);
a lógica de cada efeito vive na engine, amarrada pelo `SecretId`. A linha é mapeada pela
raiz evolutiva em `SECRET_LINES`.

Este spec cadastra as 11 linhas e implementa as habilidades novas necessárias.

## Mapa das 11 linhas

| Raiz | Linha | Slot 0 | Slot 1 |
|---|---|---|---|
| 1 | Bulbasaur → Venusaur | `sa-chlorophyll` 🆕 | `sa-overgrow` 🆕 |
| 43 | Oddish → Vileplume | `sa-chlorophyll` 🆕 | `sa-spore` 🆕 |
| 69 | Bellsprout → Victreebel | `sa-gluttony` 🆕 | `sa-hustle` ✅ |
| 102 | Exeggcute → Exeggutor | `sa-harvest` 🆕 | `sa-analytic` ✅ |
| 114 | Tangela | `sa-regenerator` ✅ | `sa-leaf-guard` 🆕 |
| 10 | Caterpie → Butterfree | `sa-tinted-lens` 🆕 | `sa-fly` ✅ |
| 13 | Weedle → Beedrill | `sa-sniper` ✅ | `sa-swarm` 🆕 |
| 46 | Paras → Parasect | `sa-spore` 🆕 | `sa-dig` ✅ |
| 48 | Venonat → Venomoth | `sa-fly` ✅ | `sa-forewarn` ✅ |
| 123 | Scyther | `sa-quick-feet` ✅ | `sa-fly` ✅ |
| 127 | Pinsir | `sa-dig` ✅ | `sa-moxie` ✅ |

✅ já existe (só cadastro) · 🆕 nova. São **8 habilidades novas distintas**:
`sa-chlorophyll`, `sa-overgrow`, `sa-spore`, `sa-gluttony`, `sa-harvest`,
`sa-leaf-guard`, `sa-tinted-lens`, `sa-swarm`. (Algumas se repetem entre linhas:
`sa-chlorophyll` em 1 e 43; `sa-spore` em 43 e 46; `sa-fly` em 10/48/123;
`sa-dig` em 46/127.)

## Habilidades existentes reaproveitadas (zero engine)

`sa-hustle`, `sa-analytic`, `sa-regenerator`, `sa-fly`, `sa-sniper`, `sa-dig`,
`sa-forewarn`, `sa-quick-feet`, `sa-moxie`. Já implementadas — entram só via `SECRET_LINES`.

## Habilidades novas

Cada nova precisa de entrada na união `SecretId` e no catálogo `SECRET_KINDS`
(nome + `effectL1`/`effectL2`). As de Tier A também precisam de lógica na engine + testes;
as de Tier B nascem inertes (sem efeito até existir um pré-requisito do jogo), exatamente
como o `sa-sand-rush` hoje.

### Tier A — efeito + testes agora

#### `sa-overgrow` — clone do Torrent para Grama
- effectL1: `+25% nos atributos com outro aliado do tipo Grama na missão.`
- effectL2: `+50%.`
- Implementação: branch em `missionAttrMultiplier`
  ([secretEffects.ts:251](../../../src/engine/secretEffects.ts)) espelhando o bloco do
  Torrent ([secretEffects.ts:275](../../../src/engine/secretEffects.ts)), trocando
  `o.types.includes('water')` por `'grass'`. Linha correspondente no
  `missionEffectBreakdown` (label "Overgrow", razão "com aliado do tipo Grama").
- Constantes: `OVERGROW_MISSION_MULT_L1 = 1.25`, `OVERGROW_MISSION_MULT_L2 = 1.5`.

#### `sa-swarm` — clone do Torrent para Inseto
- effectL1: `+25% nos atributos com outro aliado do tipo Inseto na missão.`
- effectL2: `+50%.`
- Implementação: idem Overgrow, com `o.types.includes('bug')`. Label "Swarm".
- Constantes: `SWARM_MISSION_MULT_L1 = 1.25`, `SWARM_MISSION_MULT_L2 = 1.5`.

#### `sa-spore` — buff diário aleatório
- effectL1: `No início do dia, +10% em um atributo aleatório (vale o dia).`
- effectL2: `No início do dia, +10% em três atributos aleatórios.`
- Mecânica: usa o campo já existente `p.dayBuffs` (aditivo flat, lido em
  [`effectiveAttr`](../../../src/engine/attributes.ts) — `attributes.ts:76`). Para cada
  atributo sorteado, grava `dayBuffs[key] += round(0.10 × p.baseAttrs[key])`
  (10% do valor-base, arredondado). L1 sorteia 1 dos 6 eixos; L2 sorteia 3 eixos
  **distintos**.
- Hook de manhã: aplicar em `startNextDay`
  ([phaseFlow.ts:248](../../../src/game/phaseFlow.ts)) **após** `healRoster` (que zera
  `dayBuffs`) e antes do dia rodar; como `resistencia` afeta o HP máximo, chamar
  `recomputeMaxHp` no Pokémon depois de gravar os buffs. RNG determinístico vindo do
  stream do dia (mesma convenção dos outros sorteios diários) para manter replays.
- Constantes: `SPORE_ATTR_BONUS_FRACTION = 0.10`, `SPORE_ATTRS_COUNT_L2 = 3`.

#### `sa-leaf-guard` — escudo de dano do time
- effectL1: `Numa missão fracassada, só ele perde vida (toma o dano normal); os outros do
  time são poupados. Com 2+ portadores, o de maior vida absorve.`
- effectL2: `Vale também na derrota do ginásio: no lugar de cada aliado que perderia vida,
  ele toma metade daquele dano (4 → 2); os demais não perdem vida.`
- L1 (missão): em `resolveMission` ([missions.ts:201](../../../src/engine/missions.ts)),
  antes de `team.map(... damageTaken ...)`, detectar portadores de `sa-leaf-guard` no time.
  Se houver, escolher o **portador de maior `currentHp`** (desempate estável: menor `id`);
  só esse Pokémon recebe `damageTaken(holder, damage)`; todos os outros recebem 0.
  Sem portador, comportamento atual inalterado.
- L2 (ginásio): em `gymDefense.resolveDefense`
  ([gymDefense.ts:282](../../../src/engine/gymDefense.ts)), onde o dano de derrota é
  aplicado aos Pokémon do jogador. Redirecionar todo dano que cada Pokémon (incluindo o
  próprio portador) sofreria para o portador escolhido (maior HP), **pela metade**
  (`ceil(dano / 2)`) por aliado; os aliados ficam em 0. Vale só se algum portador tem
  `sa-leaf-guard` nível 2. (L1 não atua no ginásio.)
- Constantes: `LEAF_GUARD_GYM_DAMAGE_DIVISOR = 2`.
- Detalhe de implementação a confirmar no plano: a forma exata como `resolveDefense`
  acumula/aplica HP perdido por duelo (ler a função inteira antes de integrar).

#### `sa-tinted-lens` — compensa desvantagem de tipo
- effectL1: `Quando está em desvantagem de tipo no duelo, sua Batalha conta ×1.5
  (compensa o golpe fraco).`
- effectL2: `×2.0.`
- Implementação: em `gymDefense`, onde se calcula a Batalha efetiva do duelo via
  `effectiveBattle`/`typeAdvantageMultiplier`
  ([gymDefense.ts:80-98](../../../src/engine/gymDefense.ts)). Se
  `typeAdvantageMultiplier(you.types, enemy.types) < 1` e o Pokémon tem `sa-tinted-lens`,
  multiplicar sua Batalha efetiva por 1.5 (L1) ou 2.0 (L2) antes de calcular `pWin`
  ([gymDefense.ts:347](../../../src/engine/gymDefense.ts)). Só atua em desvantagem
  (multiplicador de tipo < 1); em vantagem/neutro não faz nada.
- Constantes: `TINTED_LENS_BATTLE_MULT_L1 = 1.5`, `TINTED_LENS_BATTLE_MULT_L2 = 2.0`.

### Tier B — cadastradas, inertes até o pré-requisito existir

Só `SecretId` + `SECRET_KINDS` + predicado `has...`; sem fiação de efeito. O texto avisa
da inércia (padrão do `sa-sand-rush`).

#### `sa-chlorophyll` — velocidade no sol/calor
- effectL1: `+200% de velocidade do time sob sol/calor (sem efeito até existir clima de
  calor).`
- effectL2: `+300% de velocidade do time sob sol/calor (sem efeito até existir clima de
  calor).`
- Pré-requisito ausente: clima de calor/sol. Quando existir, espelhar a fiação do
  Swift Swim (chuva) trocando a condição climática.

#### `sa-gluttony` — XP por berry
- effectL1: `Cada berry usada nele concede +100 de XP (sem efeito até existirem berries).`
- effectL2: `+200 de XP por berry.`
- Pré-requisito ausente: itens "berry". Quando existirem, conceder XP via
  [`addXp`](../../../src/engine/leveling.ts) no fluxo de uso de item.

#### `sa-harvest` — berry diária
- effectL1: `Recebe 1 berry aleatória toda manhã (sem efeito até existirem berries).`
- effectL2: `Recebe 2 berries aleatórias toda manhã.`
- Pré-requisito ausente: itens "berry" + inventário. Quando existirem, dar berry no hook
  de manhã (mesmo ponto do Spore).

## Arquivos tocados

- [`src/data/secretAbilities.ts`](../../../src/data/secretAbilities.ts) — união `SecretId`
  (+8), `SECRET_KINDS` (+8 entradas), `SECRET_LINES` (+11 entradas).
- [`src/engine/balance.ts`](../../../src/engine/balance.ts) — constantes novas.
- [`src/engine/secretEffects.ts`](../../../src/engine/secretEffects.ts) — predicados
  (`hasOvergrow`, `hasSwarm`, `hasSpore`, `hasLeafGuard`, `hasTintedLens`, `hasChlorophyll`,
  `hasGluttony`, `hasHarvest`); branches de Overgrow/Swarm em `missionAttrMultiplier` e no
  breakdown; helper de seleção do portador de Leaf Guard.
- [`src/engine/missions.ts`](../../../src/engine/missions.ts) — Leaf Guard L1 em
  `resolveMission`.
- [`src/engine/gymDefense.ts`](../../../src/engine/gymDefense.ts) — Tinted Lens e
  Leaf Guard L2.
- [`src/game/phaseFlow.ts`](../../../src/game/phaseFlow.ts) (e/ou
  [`src/game/setup.ts`](../../../src/game/setup.ts)) — hook de manhã do Spore.
- Testes (abaixo).

## Plano de testes (TDD)

- **Catálogo/linhas** ([secretAbilities.test.ts](../../../src/data/secretAbilities.test.ts)):
  todas as 11 raízes mapeiam para o par esperado; `secretLineFor` resolve as evoluções
  (ex.: Venusaur → raiz 1); todo `SecretId` usado em `SECRET_LINES` existe em `SECRET_KINDS`.
- **Overgrow/Swarm**: `missionAttrMultiplier` dá +25%/+50% com outro aliado Grama/Inseto e
  1.0 sem aliado do tipo; aparece no `missionEffectBreakdown`.
- **Spore**: hook de manhã grava `dayBuffs` em 1 eixo (L1) / 3 eixos distintos (L2) de forma
  determinística com RNG fixo; `recomputeMaxHp` reflete buff de resistência; buffs zeram no
  dia seguinte.
- **Leaf Guard L1**: missão fracassada com 1 portador → só ele perde vida; 2 portadores → só
  o de maior HP; sem portador → dano distribuído como hoje.
- **Leaf Guard L2**: derrota no ginásio → portador toma `ceil(dano/2)` por aliado que
  perderia vida; aliados em 0; L1 não atua no ginásio.
- **Tinted Lens**: em desvantagem de tipo, Batalha efetiva ×1.5 (L1) / ×2.0 (L2); em
  vantagem/neutro, sem efeito.

## Fora de escopo

- Implementar clima de calor/sol (Chlorophyll fica inerte).
- Implementar itens "berry"/inventário (Gluttony e Harvest ficam inertes).
- Qualquer mudança no CSV de balanceamento (habilidades secretas não vivem no CSV).
- Habilidades de outras linhas/tipos.

## Premissas

- Os valores de Overgrow/Swarm igualam o Torrent (+25%/+50%), confirmado.
- Spore = +10% do valor-base do atributo, como buff do dia, confirmado.
- Leaf Guard L1 = portador toma o dano normal de fracasso (só blinda os outros);
  L2 no ginásio = portador toma metade do dano de cada aliado poupado, confirmado.
- Tinted Lens atua só quando o portador está em desvantagem de tipo, confirmado.
