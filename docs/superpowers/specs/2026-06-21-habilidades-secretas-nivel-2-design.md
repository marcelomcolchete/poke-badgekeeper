# Habilidades Secretas — modelo nível 1/2 com escolha (design)

**Data:** 2026-06-21
**Status:** aprovado (design) — pronto para writing-plans
**Áreas:** `src/data/secretAbilities.ts`, `src/engine/secretEffects.ts`, `src/game/phaseFlow.ts`,
`src/persistence/saveLoad.ts`, UI de resumo/time, e várias costuras de engine (batalha, missão,
viagem, clima/tempestade).

## Objetivo

Trocar o modelo atual de **3 habilidades secretas por linha** (desbloqueadas uma por vez a cada
Destaque do Dia, todas no mesmo "nível") por um modelo de **2 habilidades por linha, cada uma com
nível 1 e nível 2 (+)**, desbloqueadas por **escolha** do jogador em no máximo **2 destaques na
vida** do indivíduo.

## 1. Mecânica de desbloqueio

- Cada **linha evolutiva** tem um **par fixo** de 2 habilidades (slots `0` e `1`).
- Cada habilidade tem **nível 1** (base) e **nível 2** (`+`, upgrade).
- **Regra geral:** o nível 2 **inclui** o nível 1 — é sempre estritamente melhor.
- **1º destaque:** o jogador escolhe **uma** das duas habilidades do par → desbloqueia no **nível 1**.
- **2º destaque:** o jogador escolhe entre:
  - **Aprofundar:** a habilidade já desbloqueada sobe para **nível 2 (+)**. Fim: **1 habilidade "+"**.
  - **Ampliar:** desbloqueia a **outra** habilidade do par no **nível 1**. Fim: **2 habilidades nível 1**.
- **Limite:** no máximo **2 destaques que concedem habilidade** por indivíduo (na vida). O progresso
  fica gravado no indivíduo e sobrevive à evolução (como hoje). Mantém-se **1 Destaque do Dia por dia**.
- Estados finais possíveis: **uma habilidade no "+"** ou **as duas no nível 1** (nunca as duas no "+").

### Onde a escolha aparece (UX)

A escolha acontece **no momento do destaque** (tela de resumo do dia), quando o `secretUnlock` é
revelado. No 1º destaque: escolher qual das 2 habilidades do par. No 2º destaque: escolher
**Aprofundar (+)** ou **Ampliar (desbloquear a outra)**. Detalhe visual fica para a fase de plano da
UI; o estado e as opções são determinados pela engine.

## 2. Modelo de dados

### Indivíduo (`src/types/index.ts`)

Substituir `secretCount?: number` por um registro das habilidades desbloqueadas com seus níveis:

```ts
/** Uma habilidade secreta desbloqueada do par da linha, com seu nível. */
export interface SecretPick {
  slot: 0 | 1   // qual das duas habilidades do par
  level: 1 | 2  // 1 = base, 2 = "+"
}

// no Pokemon:
secretPicks?: SecretPick[]
```

Invariantes (garantidas pelo fluxo de desbloqueio):
- `[]` — 0 destaques.
- `[{slot:S, level:1}]` — 1º destaque (uma habilidade nível 1).
- `[{slot:S, level:2}]` — 2º destaque, aprofundou (uma "+").
- `[{slot:0, level:1}, {slot:1, level:1}]` — 2º destaque, ampliou (duas nível 1).

### Catálogo (`src/data/secretAbilities.ts`)

- **Um id por habilidade** (sem `*-plus`). `SecretId` perde `sa-dig-plus`, `sa-fly-plus`,
  `sa-surf-plus`.
- `SecretKind` ganha **dois textos**: `effectL1` e `effectL2` (substituem o `effect` único).
- `SECRET_LINES` e `SECRET_LINE_BY_SPECIES` passam de tripla `[SecretId, SecretId, SecretId]` para
  **par** `[SecretId, SecretId]` (os dois slots da linha). `SECRET_MAX` deixa de existir (ou vira o
  conceito de "2 slots / 2 níveis").

### Funções derivadas (substituem `secretCountOf`/`unlockedSecretIds`/`hasSecret`)

```ts
/** Nível de uma habilidade neste indivíduo: 0 = não desbloqueada, 1, ou 2. */
export function secretLevelOf(p: Pokemon, id: SecretId): 0 | 1 | 2

/** Tem a habilidade (nível ≥ 1)? Açúcar sobre secretLevelOf > 0. */
export function hasSecret(p: Pokemon, id: SecretId): boolean

/** Lista das habilidades ativas (id + nível) deste indivíduo, na ordem do par. */
export function activeSecrets(p: Pokemon): Array<{ id: SecretId; level: 1 | 2 }>
```

Os predicados atuais (`hasSurf`, `hasFly`, `hasDigPlus`, …) viram consultas a `secretLevelOf`:
`hasSurf = secretLevelOf(p,'sa-surf') >= 1`; o antigo `hasSurfPlus` =
`secretLevelOf(p,'sa-surf') === 2`. As funções de efeito passam a **receber o nível** quando a
magnitude muda entre L1 e L2.

### Migração de saves (`src/persistence/saveLoad.ts`)

Jogo em desenvolvimento — mapeamento **best-effort** por contagem antiga, sem inventar "+":
`secretCount` antigo `0 → []`; `1 → [{slot:0, level:1}]`; `2` ou `3` `→ [{slot:0,level:1},{slot:1,level:1}]`.
Nova versão de save; a escolha que não existia antes assume o slot 0 / caminho "ampliar".

## 3. Catálogo de efeitos (nível 1 → nível 2)

> Convenção: o nível 2 **inclui** o nível 1 salvo onde indicado. "(inerte)" = depende de sistema
> climático ainda não implementado; catalogar com texto "(sem efeito até existir …)".

### Travessia / viagem
- **Surf** — L1: atravessa pontos de água; +100% de velocidade **enquanto está efetivamente na
  água** e o **emoji/aura de surf** só aparece na água; só despachado sozinho. L2: leva o **time
  inteiro** pela água. *(ajuste vs hoje: hoje o bônus/emoji valem a viagem toda; passar a valer só
  no trecho de água.)*
- **Fly** — L1: voa em linha reta do ginásio à tarefa (caminho curto), **sem** bônus de velocidade;
  **risco:** se for atingido por um raio (tempestade), o Pokémon/time **morre e perde a missão** se
  estiver a caminho. Só sozinho. L2: leva o **time inteiro** voando (mantém o risco do raio).
- **Dig** — L1: abre 2 buracos ligando 2 pontos; o time atravessa por baixo. L2: um dos buracos
  aparece **sempre no ginásio**. *(inalterado)*
- **Quick Feet** — L1: +100% de movimento despachado **sozinho**. L2: +100% de movimento para o
  **time inteiro**.

### Velocidade por condição
- **Weak Armor** — L1: **+15%** de velocidade do time por ponto de vida faltante; **sem** o dobro de
  dano (remover a desvantagem do `damageTaken`). L2: **+25%** por ponto de vida faltante.
- **Swift Swim** — L1: +200% de velocidade do time enquanto chove. L2: mantém o +200% **e** **+30%
  de atributos** em missões enquanto chove.

### Combate
- **Rollout** — L1: o bônus de Batalha para o **próximo** oponente **dobra a cada abate** na
  sequência: +2 → +4 → +8 → +16 → **+32 (teto)**; reinicia a cada batalha. L2: começa em +4:
  +4 → +8 → +16 → +32 → **+64 (teto)**.
- **Rivalry** — L1: +10% nos atributos por aliado do mesmo gênero na missão; +10% de Batalha contra
  oponente do mesmo gênero. L2: **+20% / +20%**.
- **Hustle** — L1: +10% de Batalha / −10% de atributos em missões. L2: **+30% / −30%**.
- **Sturdy** — L1: ao desmaiar em batalha, fica com 1 de vida (**1×/dia**). L2: **nunca desmaia** em
  batalha — sempre fica com 1 de vida (sem limite diário).
- **Explosion** — L1: ao ser derrotado, explode: perde **metade** da vida máxima (pode morrer) e
  derrota quem o derrotou. L2: explode perdendo **toda** a vida (morre) e **derrota todos** os
  Pokémon inimigos.
- **Reckless** — L1: ao perder um combate, perde vida e tenta de novo sem passar a vez. L2: na
  retentativa **toma metade do dano** que tomaria.
- **Pressure** — L1: no **início do combate**, reduz a Batalha dos inimigos em **15%**. L2: **30%**.
  **Não acumula** entre portadores: vale só o de **maior nível**.
- **Moxie** — L1: ao derrotar um Pokémon, **+1 no atributo Batalha permanente** (resto do jogo), até
  o teto **60**. L2: mantém o +1 permanente **e** ganha **+5 temporário** acumulável para a próxima
  batalha: +5 → +10 → +15 → +20 → **+25 (teto)**.
- **Regenerator** — L1: +1 de vida por Pokémon derrotado em batalha. L2: **cura toda a vida** a cada
  Pokémon derrotado.
- **Thick Fat** — L1: *seu time não pode ser congelado em tempestade de gelo* **(inerte)**. L2:
  **sempre vence** batalhas contra Pokémon do tipo **Gelo**.
- **Ice Body** — L1: *seu time não recebe efeito negativo do calor* **(inerte)**. L2: **sempre
  vence** batalhas contra Pokémon do tipo **Fogo**.
- **Battle Armor** — L1: após uma batalha (ginásio/Rocket), **+25%** em todos os atributos na próxima
  missão. L2: **+50%**.
- **Vital Spirit** — L1: ao falhar uma missão, o time tenta de novo 1× (mesma chance). L2: mantém o
  L1 **e** ao perder um combate, **tenta de novo sem perder vida**.

### Defesa / dano recebido
- **Shell Armor** — L1: recebe **metade** do dano em combate e missão (arredonda p/ cima: 3→2). L2:
  recebe **1/3** do dano (3× menos: 3→1).
- **Natural Cure** — L1: ao sair em missão, +2 de vida. L2: ao sair em missão, **cura toda a vida**.

### Missões (multiplicadores)
- **Rock Head** — L1: **+40%** em escolta / **−40%** em ensino. L2: **+80% / −80%**.
- **Analytic** — L1: **+40%** em ensino / **−40%** em patrulha. L2: **+80% / −80%**.
- **Torrent** — L1: **+25%** nos atributos com outro aliado do tipo Água na missão. L2: **+50%**.
- **Water Absorb** — L1: sempre que a rota passa pela água, **+30%** de atributos na **próxima
  missão**. L2: **+50%**. *(padrão "pendente p/ próxima missão", como o Battle Armor.)*
- **Sniper** — L1: faz missões sem sair do ginásio (à distância, só sozinho), mas a missão **demora o
  dobro** do tempo. L2: a missão demora o **tempo normal**.
- **Forewarn** — L1: antecipa **1** missão do dia (cada portador antecipa mais uma). L2: antecipa
  **2** missões (por portador).

### Clima / tempestade
- **Lightning Rod** — L1: **o time inteiro** que sai na missão fica **imune ao efeito/dano de raio**
  (basta o portador estar despachado). L2: mantém a imunidade **e** quando o oponente é do tipo
  **Elétrico**, assume o duelo no lugar de quem está na frente.
- **Volt Absorb** — L1: ao ser atingido por um raio, **absorve** (não toma o dano) e fica eletrizado
  pelo resto do dia: **+30%** de movimento e **+30%** nos atributos. L2: **+90% / +90%**.
- **Static** — L1: os raios **sempre caem no ponto mais próximo** dele (marca vermelha, cai após
  **5s**); e, parado em missão, o time ganha **+1 de XP por segundo parado** (ex.: paralisado por
  raio, caminho bloqueado por chuva). L2: mantém o L1 **e** o time ganha **+10% de movimento por
  segundo parado** (máx **100%**).
- **Cloud Nine** — L1: **+10pp** na chance de chuva hoje e **−10pp** na chance de outros efeitos
  climáticos (**acumula** por portador). L2: **+20pp / −20pp**.
- **Overcoat** — L1: **−10pp** na chance de qualquer efeito climático acontecer no dia (**acumula**
  por portador). L2: **−20pp**.
- **Own Tempo** — L1: no máximo **2** efeitos climáticos podem acontecer no dia. L2: no máximo **1**.
  **Não acumula**: vale só o de **maior nível** (como o Pressure).
- **Dry Skin** — L1: ao sair em missão, **−25% de vida no calor** / **+25% de vida na chuva ou
  frio** (só **chuva** existe hoje → a parte da chuva já funciona; calor/frio ficam **inertes** até o
  clima existir). L2: mantém o L1 **e** **−25% de bônus** de missão no calor / **+25% de bônus** na
  chuva ou frio.
- **Clear Body** — L1: o time **não recebe efeitos negativos de clima** (ex.: paralisia por raio).
  L2: mantém o L1 **e** o time **não recebe debuffs de habilidades secretas** (ex.: −40% do Analytic
  em Patrulha).

### Inertes (catalogar com texto, sem efeito por ora)
- **Sand Rush** — depende de **tempestade de areia** (não existe). L1/L2 inertes (ex.: +200%/+300%
  de velocidade do time em tempestade de areia). Follow-up.

## 4. Linhas (par por linha)

Slots na ordem listada (slot 0, slot 1). A ordem é só de exibição — o jogador escolhe no destaque.

**Vermilion (Elétrico)**
- 25 Pikachu→Raichu: `[sa-static, sa-dig]`
- 81 Magnemite→Magneton: `[sa-sturdy, sa-analytic]`
- 100 Voltorb→Electrode: `[sa-explosion, sa-rollout]`
- 125 Electabuzz: `[sa-vital-spirit, sa-volt-absorb]`
- 145 Zapdos: `[sa-fly, sa-pressure]`

**Pewter / Ground / Fóssil**
- 27 Sandshrew→Sandslash: `[sa-rollout, sa-dig]`
- 29 Nidoran♀→Nidorina→Nidoqueen: `[sa-rivalry, sa-hustle]`
- 32 Nidoran♂→Nidorino→Nidoking: `[sa-rivalry, sa-hustle]`
- 50 Diglett→Dugtrio: `[sa-dig, sa-sand-rush]`
- 74 Geodude→Graveler→Golem: `[sa-sturdy, sa-explosion]`
- 95 Onix: `[sa-sturdy, sa-weak-armor]`
- 104 Cubone→Marowak: `[sa-battle-armor, sa-lightning-rod]`
- 111 Rhyhorn→Rhydon: `[sa-rock-head, sa-reckless]`
- 138 Omanyte→Omastar: `[sa-swift-swim, sa-shell-armor]`
- 140 Kabuto→Kabutops: `[sa-battle-armor, sa-swift-swim]`
- 142 Aerodactyl: `[sa-fly, sa-rock-head]`

**Dragão**
- 147 Dratini→Dragonair→Dragonite: `[sa-surf, sa-fly]`

**Cerulean (Água/Gelo)**
- 7 Squirtle→Wartortle→Blastoise: `[sa-surf, sa-torrent]`
- 54 Psyduck→Golduck: `[sa-surf, sa-cloud-nine]`
- 60 Poliwag→Poliwhirl→Poliwrath: `[sa-surf, sa-water-absorb]`
- 72 Tentacool→Tentacruel: `[sa-clear-body, sa-surf]`
- 79 Slowpoke→Slowbro: `[sa-regenerator, sa-own-tempo]`
- 86 Seel→Dewgong: `[sa-surf, sa-thick-fat]`
- 90 Shellder→Cloyster: `[sa-shell-armor, sa-overcoat]`
- 98 Krabby→Kingler: `[sa-dig, sa-shell-armor]`
- 116 Horsea→Seadra: `[sa-surf, sa-sniper]`
- 118 Goldeen→Seaking: `[sa-surf, sa-swift-swim]`
- 120 Staryu→Starmie: `[sa-analytic, sa-natural-cure]`
- 124 Jynx: `[sa-dry-skin, sa-forewarn]`
- 129 Magikarp→Gyarados: `[sa-surf, sa-moxie]`
- 131 Lapras: `[sa-surf, sa-shell-armor]`
- 144 Articuno: `[sa-fly, sa-pressure]`

**Eeveelutions (override por espécie)**
- 134 Vaporeon: `[sa-surf, sa-water-absorb]`
- 135 Jolteon: `[sa-quick-feet, sa-volt-absorb]`

## 5. Costuras de engine (onde cada efeito liga)

- **`secretEffects.ts`** — funções de magnitude passam a ler `secretLevelOf` e escalar por nível.
  Constantes novas/ajustadas em `balance.ts` (ex.: `ROLLOUT_*`, `ROCK_HEAD_*`, `ANALYTIC_*`,
  `WEAK_ARMOR_SPEED_PER_MISSING_HP` L1/L2, `SHELL_ARMOR_*`, `PRESSURE_*`, etc.).
- **`damageTaken`** — Weak Armor deixa de dobrar; Shell Armor vira `ceil(raw/2)` (L1) / `ceil(raw/3)`
  (L2).
- **Batalha (`gymDefense.ts`/fluxos de combate)** — Rollout (snowball por abate), Moxie (perm +
  temp), Regenerator, Sturdy, Explosion, Reckless, Pressure, Vital Spirit (retry de combate L2),
  Static (paralisia removida; novo efeito é de clima/parado), Thick Fat L2 / Ice Body L2 (auto-win
  por tipo), Lightning Rod L2 (assume duelo vs Elétrico).
- **Missão (`missionFlow.ts`/`missionAttrMultiplier`)** — Rock Head, Analytic, Torrent, Hustle,
  Battle Armor, Water Absorb (pendente próx. missão), Rivalry, Clear Body (anula debuffs de
  habilidade no L2), Sniper (tempo da missão), Forewarn (antecipação), Natural Cure / Dry Skin (HP e
  bônus ao sair).
- **Viagem (`teamTravelSpeedMultiplier`/pathfinding)** — Surf (só na água), Fly (sem speed; risco de
  raio), Quick Feet, Weak Armor, Swift Swim.
- **Clima/tempestade (`storm.ts`/`stormFlow.ts`/`weather.ts`)** — Lightning Rod (imunidade do time),
  Volt Absorb (absorve + buff), Static (atração do raio + XP/mov parado), Cloud Nine / Overcoat
  (ajuste de chance), Own Tempo (cap de eventos/dia), Clear Body (imunidade a negativos de clima),
  Fly (morte por raio).
- **`phaseFlow.ts` (`unlockSecretAbility`)** — reescrever para o fluxo de 2 destaques com escolha:
  1º destaque → escolher slot (nível 1); 2º destaque → aprofundar (nível 2) ou ampliar (outro slot
  nível 1). Atualizar `today.secretUnlock` para carregar as opções/decisão.
- **UI** — `TeamSidebar`/`MemberDetail` (mostrar nível e "+"), `SummaryScreen` (reveal + escolha do
  destaque). Limpeza: remover textos "(sem efeito até existir a tempestade)" desatualizados.

## 6. Limpezas correlatas

- Remover ids `sa-dig-plus`, `sa-fly-plus`, `sa-surf-plus` do union e do catálogo (viram nível 2).
- Corrigir descrições inertes desatualizadas (a tempestade **existe**: Volt Absorb e Static ligam
  agora; só permanecem inertes os que dependem de **areia / calor / frio / congelamento**).
- Atualizar a skill `managing-pokemon-species` (3 → 2 habilidades por linha; nível 1/2; novo modelo
  de desbloqueio).

## 7. Plano de testes

- **`secretAbilities.test.ts`** — `secretLevelOf`/`hasSecret`/`activeSecrets` para cada estado
  (`[]`, 1 slot L1, 1 slot L2, 2 slots L1); `secretLineFor` retorna pares; override de espécie
  (Vaporeon/Jolteon) não vaza para os irmãos.
- **`secretEffects.test.ts`** — para cada habilidade alterada, asserts de magnitude por nível
  (Rollout 2→32 / 4→64; Rock Head 40/80; Shell Armor ½/⅓ com arredondamento; Weak Armor sem dobro de
  dano; Pressure não acumula; Moxie permanente com teto 60; etc.).
- **`phaseFlow`** — fluxo de desbloqueio: 1º destaque grava 1 slot L1; 2º aprofundar → L2; 2º ampliar
  → 2 slots L1; trava no 2º (não há 3º).
- **Clima** — Lightning Rod imuniza o time; Volt Absorb buffa em vez de dar dano; Static atrai o raio
  e dá XP/mov parado; Own Tempo limita nº de eventos; Cloud Nine/Overcoat ajustam chance; Fly morre
  no raio.
- **Batalha** — Thick Fat L2 / Ice Body L2 auto-win por tipo; Explosion L2 derrota todos; Sturdy L2
  nunca desmaia; Reckless L2 meia-dano; Vital Spirit L2 retry de combate.
- **Migração** — `saveLoad.test.ts`: secretCount antigo 0/1/2/3 mapeia para os `secretPicks`
  esperados.
- Fechar com `npm run build` (tsc -b) e `npm test`. Sem preview (preferência do projeto).

## 8. Dependências e follow-ups

- **Inertes até existir clima:** Sand Rush (areia), Thick Fat L1 (congelamento), Ice Body L1 (calor),
  Dry Skin calor/frio. Catalogar com texto "(sem efeito até existir …)"; não implementar o clima
  faltante aqui.
- **Auto-win por tipo (Thick Fat L2 / Ice Body L2)** depende de o motor de batalha expor o tipo do
  oponente — confirmar a costura no plano.
- **Moxie L1 permanente** introduz crescimento de atributo gravado no indivíduo (novo) — definir
  onde persistir (provável `pokemon.baseAttrs`/bônus permanente) no plano.
