# Habilidades Secretas nível 1/2 — Fase 4: Efeitos novos (batalha / missão / clima) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Implementar/retrabalhar os efeitos de Habilidade Secreta que NÃO eram simples magnitude: auto-win por tipo, Pressure de início-de-combate, Moxie permanente, ciclo de missão (Natural Cure/Water Absorb/Sniper/Forewarn/Swift Swim+), e os efeitos de clima/tempestade (Lightning Rod imunidade de viagem, Volt Absorb, Fly-raio, Static novo, Cloud Nine/Overcoat/Own Tempo, Dry Skin, Clear Body).

**Architecture:** Reusa os mesmos pontos da engine (gymDefense battle loop, missionFlow acceptMission, missionAttrMultiplier, stormFlow processStorms, setup/weather chance). Efeitos por nível via `secretLevelOf`. Onde a semântica troca (Pressure, Static, Water Absorb), o código antigo é substituído. Persistências novas: bônus permanente de atributo (Moxie) e flag de "eletrizado" do dia (Volt Absorb) via campos próprios.

**Tech Stack:** TypeScript (ESM, `.ts` imports), Vitest, React. Build `npm run build`. Testes `npm test`.

## Global Constraints
- Verificação: `npm run build` e `npm test`. Sem preview. `.ts` imports. TDD. Commits frequentes.
- **Fonte de verdade:** spec §3 (efeitos) e §5 (costuras). Map de seams no histórico desta sessão.
- Nível via `secretLevelOf(p, id)`; `level===2` = "+".
- Constantes novas/ajustadas em `balance.ts` (pares `_L1`/`_L2` onde aplicável).
- **Não** reintroduzir comportamento antigo onde o spec troca (ex.: Static-batalha sai; Pressure
  vira início-de-combate; Water Absorb deixa de dar XP).

## Seam reference (estado atual)
- Battle loop: `gymDefense.ts` `resolveDefense` (Pressure L337-338 atual `enemyEff *= PRESSURE_ENEMY_MULT`; Thick Fat L331 `×1.5 vs ice`; Static L339-340/L357; Moxie L333 temp).
- `effectiveAttr`: `attributes.ts` L72-81 (clamp 0..ATTR_MAX=60).
- Mission dispatch: `missionFlow.ts` `acceptMission` L86-151 (Natural Cure L138-143; Water Absorb XP L144-150). Sniper: `missions.ts travelRoute` distance=0. Forewarn: `setup.ts applyForewarn`.
- Storm: `stormFlow.ts processStorms` L115-140 (hit → -1 HP + applyParalyze). `travelerPositionsAt`.
- Weather chance: `setup.ts` (`hasCloudNine` → extraRainChancePercent). `weather.ts buildWeatherSchedule`; `storm.ts buildStorms`. Event caps: `maxRainTimes`/`maxStormTimes`.
- Predicados existentes em `secretEffects.ts`: faltam `hasIceBody`, `hasOvercoat`, `hasOwnTempo`, `hasVoltAbsorb`, `hasDrySkin` (criar).

---

### Task 1: Pressure (início-de-combate, não-acumula) + auto-win por tipo (Thick Fat+ / Ice Body+)

**Files:** `src/engine/gymDefense.ts`, `src/engine/secretEffects.ts`, `src/engine/balance.ts`, `src/engine/gymDefense.test.ts`.

- **Pressure:** no INÍCIO do combate, reduz a Batalha de TODOS os inimigos por 15% (L1) / 30% (L2).
  **Não acumula** entre portadores: usa o MAIOR nível presente no esquadrão. Implementar como um
  fator único `enemyPressureMult` calculado uma vez antes do laço (a partir do maior
  `secretLevelOf(p,'sa-pressure')` no `squad`), aplicado a `enemyEff` de todo duelo. Remover o
  Pressure por-lutador atual (L337-338).
- **Thick Fat+ (`sa-thick-fat` L2):** auto-vence duelos contra oponentes do tipo **Gelo** (pWin=1).
  Substituir o `×1.5 vs ice` atual (L331): no L1 Thick Fat fica INERTE (texto "não congela", sem
  efeito de batalha — ver spec); só L2 tem efeito (auto-win vs Gelo).
- **Ice Body+ (`sa-ice-body` L2):** auto-vence duelos contra oponentes do tipo **Fogo**. Criar
  `hasIceBody` predicado (já existe `secretLevelOf`). L1 inerte (calor).
- Aplicar auto-win: se `secretLevelOf(you,'sa-thick-fat')===2 && enemy.types.includes('ice')` OU
  `secretLevelOf(you,'sa-ice-body')===2 && enemy.types.includes('fire')` → `pWin = 1`
  (vitória garantida nesse duelo), antes do `rng.bool`.

- [ ] **Step 1 (RED):** Tests em gymDefense.test.ts: Pressure L1 reduz enemyEff 15% e L2 30%, com 2 portadores L1+L2 → usa 30% (não soma); Thick Fat+ sempre vence vs Gelo (mesmo com batalha baixa); Ice Body+ vs Fogo; Thick Fat L1 sem efeito de batalha. Rodar focado → FAIL.
- [ ] **Step 2 (GREEN):** balance: `PRESSURE_ENEMY_MULT_L1=0.85`, `_L2=0.70` (remover 0.75). Implementar `enemyPressureMult` pré-laço; auto-win; `hasIceBody`. Remover ThickFat ×1.5 e Pressure por-lutador. Atualizar testes antigos de Pressure/ThickFat. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): pressure inicio-combate + auto-win thick-fat+/ice-body+ (Fase 4)`.

---

### Task 2: Moxie — permanente +1 Batalha (teto 60) + temporário +5 (teto 25) no L2

**Files:** `src/types/index.ts`, `src/engine/attributes.ts`, `src/engine/gymDefense.ts`, `src/engine/balance.ts`, `src/engine/secretEffects.ts`, tests.

- **Persistência:** adicionar `Pokemon.permaBonus?: Partial<Attrs>` (bônus permanente por eixo,
  sobrevive ao dia e à evolução). Incluir em `effectiveAttr`: `+ (p.permaBonus?.[key] ?? 0)` antes
  do clamp (teto 60 já aplica o cap do Moxie).
- **Moxie L1:** a cada Pokémon derrotado em batalha, +1 PERMANENTE em `permaBonus.batalha`
  (gravado no `result`/roster do `resolveDefense`; o efeito do duelo). O efeito temporário atual
  (`yourEff += MOXIE_BATTLE_PER_WIN * frontWins`) é SUBSTITUÍDO: no L1 NÃO há mais o temp; o ganho é
  permanente. Aplicar o +1 ao vencer (na ramificação `youWon`).
- **Moxie L2:** mantém o +1 permanente E adiciona um temporário acumulável de +5 por vitória na
  sequência, teto +25, aplicado a `yourEff` no duelo (`min(25, 5*frontWins)`).
- Como `resolveDefense` é pura e retorna `squad` (com HP), ela já devolve cópias dos Pokémon; o
  `permaBonus` atualizado precisa ser propagado de volta ao roster pelo chamador (`defenseFlow.ts`
  já aplica `resolution.squad` ao roster — confirmar que `permaBonus` é preservado).

- [ ] **Step 1 (RED):** Tests: `effectiveAttr` soma `permaBonus` e respeita teto 60; `resolveDefense` Moxie L1 incrementa `permaBonus.batalha` por vitória (e capa em 60 no efetivo); Moxie L2 dá +1 permanente E +5/+10/... temporário (teto 25) no `yourEff`. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** tipo + effectiveAttr + gymDefense (substituir Moxie temp por permanente; L2 soma o temp). balance: `MOXIE_PERMA_PER_WIN=1`, `MOXIE_TEMP_PER_WIN_L2=5`, `MOXIE_TEMP_CAP_L2=25` (remover/realocar `MOXIE_BATTLE_PER_WIN`). Garantir propagação do `permaBonus` no `defenseFlow`. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): moxie permanente +1 (teto 60) + temp L2 (Fase 4)`.

---

### Task 3: Ciclo de missão — Natural Cure, Water Absorb (novo), Sniper (tempo), Forewarn

**Files:** `src/game/missionFlow.ts`, `src/engine/missions.ts`, `src/game/setup.ts`, `src/engine/state.ts` (SecretRuntime), `src/engine/secretEffects.ts` (missionAttrMultiplier), `src/engine/balance.ts`, tests.

- **Natural Cure:** L1 +2 HP ao sair em missão (já existe); L2 cura TOTAL (`p.maxHp`). Branch por nível em `acceptMission` L138-143.
- **Water Absorb (NOVO):** REMOVER o XP atual (L144-150). Em vez disso, quando a rota passa pela água, marcar `secretRuntime[id].waterAbsorbPending = level` (1 ou 2) para o portador; em `missionAttrMultiplier`, se `waterAbsorbPending` está setado, ×1.30 (L1) / ×1.50 (L2); consumir o pending ao resolver a próxima missão (espelhar `battleArmorPending` em `applyMissionSecretRuntime`). Adicionar `waterAbsorbPending?: 1|2` em `SecretRuntime`.
- **Sniper:** L1 a missão demora o DOBRO do tempo (multiplicar `outMs`+`execution`+volta por 2 quando o despacho é Sniper solo L1); L2 tempo NORMAL. Hoje Sniper faz distance=0 (sem viagem) — manter o "atua do ginásio" mas L1 dobra a duração de execução. Ajustar onde a duração é montada (`acceptMission` / `executionMs`).
- **Forewarn:** L1 antecipa 1 missão por portador (já existe `applyForewarn`); L2 antecipa 2 por portador. Em `setup.ts applyForewarn`, contar `secretLevelOf(p,'sa-forewarn')` (1 ou 2) somando 1 ou 2 por portador.

- [ ] **Step 1 (RED):** Tests: Natural Cure L2 cura total no dispatch; Water Absorb pending dá +30%/+50% na missão e some depois (missionAttrMultiplier + runtime); Sniper L1 dobra a duração e L2 normal; Forewarn L2 antecipa 2 por portador. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** implementar as 4. balance: `WATER_ABSORB_MISSION_MULT_L1=1.30`, `_L2=1.50`, `SNIPER_TIME_MULT_L1=2`; `NATURAL_CURE_MISSION_HEAL` (L1 fica). Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): natural-cure/water-absorb/sniper/forewarn por nivel (Fase 4)`.

---

### Task 4: Swift Swim+ (bônus de missão na chuva) + Surf (só na água)

**Files:** `src/engine/secretEffects.ts`, `src/engine/rainSpeed.ts`/`missions.ts`, `src/engine/balance.ts`, tests.

- **Swift Swim+ (`sa-swift-swim` L2):** além do +200% de velocidade na chuva (L1), dá **+30% de
  atributos em missões** enquanto chove. Integrar em `missionAttrMultiplier` (precisa do clima/horário
  no ctx — ver como Swift Swim de velocidade já recebe o clima; pode exigir passar
  `isRaining(weather, now)` ao ctx da missão). Se a infra não comporta clima no ctx, escopar e
  reportar.
- **Surf (`sa-surf`) "só na água":** o emoji/aura de surf e o +100% de velocidade valem SÓ no trecho
  de água, não a viagem inteira. Hoje o surf habilita cruzar a água; verificar se há bônus de
  velocidade de surf hoje (provavelmente não há um separado). Se a mudança exigir interpolação
  por-segmento (saber quando o sprite está sobre um nó de água), e isso for invasivo, IMPLEMENTAR o
  que for viável (ex.: marcar `surfing` por-segmento) e ESCALAR o resto como follow-up documentado.

- [ ] **Step 1 (RED):** Test Swift Swim+ missão na chuva → +30% atributos. (Surf-na-água: teste do que for implementado.) Rodar → FAIL.
- [ ] **Step 2 (GREEN):** implementar Swift Swim+ no multiplicador de missão; Surf-na-água conforme viabilidade. balance: `SWIFT_SWIM_MISSION_BONUS_L2=0.30`. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): swift-swim+ missao na chuva (+ surf so-na-agua se viavel) (Fase 4)`.

> Se Surf-só-na-água exigir refactor grande da interpolação, reporte como DONE_WITH_CONCERNS e deixe follow-up.

---

### Task 5: Chance de clima — Cloud Nine, Overcoat, Own Tempo

**Files:** `src/game/setup.ts`, `src/engine/weather.ts`, `src/engine/storm.ts`, `src/engine/secretEffects.ts`, `src/engine/balance.ts`, `src/components/screens/DayForecastPanel.tsx` (forecast), tests.

- **Cloud Nine:** hoje +25pp chuva por portador. Novo: **+10pp chuva** e **−10pp outros climas**
  (tempestade) por portador. Aplicar o −10pp ao `extraChancePercent` da tempestade (storm) e +10pp
  à chuva. Acumula por portador.
- **Overcoat (NOVO):** −10pp (L1) / −20pp (L2) na chance de QUALQUER clima, acumula por portador.
  Criar `hasOvercoat`. Aplicar à chuva E à tempestade.
- **Own Tempo (NOVO):** limita o nº de eventos climáticos do dia a 2 (L1) / 1 (L2). **Não acumula**:
  maior nível presente. Aplicar capando `maxRainTimes`/`maxStormTimes` (ou o total de eventos)
  no setup quando houver portador. Criar `hasOwnTempo`.

- [ ] **Step 1 (RED):** Tests (engine puro, semeado): Cloud Nine ajusta chuva +10/tempestade −10 por portador; Overcoat −10/−20; Own Tempo capa eventos a 2/1 (maior nível). Rodar → FAIL.
- [ ] **Step 2 (GREEN):** implementar no setup/weather/storm + predicados + constantes (`CLOUD_NINE_RAIN_PP=10`, `CLOUD_NINE_OTHER_PP=10`, `OVERCOAT_PP_L1=10`, `_L2=20`, `OWN_TEMPO_CAP_L1=2`, `_L2=1`). Atualizar o forecast (DayForecastPanel) que espelha a conta. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): cloud-nine/overcoat/own-tempo chance de clima (Fase 4)`.

---

### Task 6: Tempestade — Lightning Rod imunidade de viagem, Volt Absorb, Fly-raio

**Files:** `src/game/stormFlow.ts`, `src/engine/secretEffects.ts`, `src/engine/state.ts` (flag eletrizado), `src/engine/balance.ts`, tests.

- **Lightning Rod (`sa-lightning-rod` L1, time):** se o time que carrega o Pokémon atingido tem um
  portador de Lightning Rod (qualquer nível), o time fica **imune** ao raio: em `processStorms`, ao
  detectar acerto, se o container (missão/captura) tem um Lightning Rod no time → PULAR dano/Paralyze.
- **Volt Absorb (`sa-volt-absorb`):** se o Pokémon atingido tem Volt Absorb → NÃO toma dano/Paralyze;
  em vez disso fica **eletrizado** o resto do dia: +30%/+30% (L1) ou +90%/+90% (L2) de movimento e
  atributos. Persistir via `today.electrified: Record<string, 1|2>` (id → nível). Aplicar o buff de
  movimento em `teamTravelSpeedMultiplier` e o de atributos em `missionAttrMultiplier`. Criar
  `hasVoltAbsorb`.
- **Fly-raio:** se o Pokémon atingido está VOANDO (a missão/captura é `flying`), o time **morre e
  perde a missão**: marcar os membros como fainted (HP 0) e expirar/fracassar a missão. (Lightning
  Rod e Volt Absorb têm precedência — imunidade/absorção cancelam a morte.)

- [ ] **Step 1 (RED):** Tests (stormFlow): time com Lightning Rod não toma dano de um strike; portador de Volt Absorb não toma dano e fica eletrizado (electrified setado) com buff de movimento/atributos; voador atingido → time fainted + missão falha; precedência LRod/Volt sobre Fly-morte. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** implementar em processStorms (ordem: imunidade LRod → absorção Volt → morte Fly → dano/paralyze normal) + buffs de eletrizado nos multiplicadores + estado. balance: `VOLT_ABSORB_BONUS_L1=0.30`, `_L2=0.90`. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): lightning-rod imunidade + volt-absorb + fly-raio na tempestade (Fase 4)`.

---

### Task 7: Static (novo) — remove paralisia de batalha; XP/movimento por segundo parado; atração do raio (escopo)

**Files:** `src/engine/gymDefense.ts` (remover Static-batalha), `src/game/stormFlow.ts`/`missionFlow.ts` (parado), `src/engine/secretEffects.ts`, `src/engine/balance.ts`, tests.

- **Remover o Static de batalha** (paralisar o inimigo) — não faz mais parte do efeito.
- **Parado em missão dá benefício:** enquanto um portador de Static está PARADO em missão
  (`paralyzeHold` por raio, ou `weatherHold` por poça), o time ganha **+1 XP por segundo parado**
  (L1) e **+10% de movimento por segundo parado, máx 100%** (L2 — mantém o L1). Implementar somando
  o tempo parado: quando um hold termina (ou no settle), creditar XP proporcional aos segundos
  parados; e aplicar o bônus de movimento ao retomar.
- **Atração do raio ("raios sempre caem no ponto mais próximo dele"):** a geometria da tempestade é
  PRÉ-COMPUTADA e cega à posição/abilidade. Implementar isto exige enviesar os centros dos strikes
  para os nós dos portadores de Static — uma mudança no `storm.ts`/`setupDay` que precisa conhecer
  os portadores no roster. **Escopo:** implementar SE for viável de forma limpa (ex.: passar os nós
  dos portadores de Static ao `buildStorms` para sortear alguns centros perto deles); se for
  invasivo/arriscado, IMPLEMENTAR o resto (XP/mov parado) e DEIXAR a atração como follow-up
  documentado (reportar DONE_WITH_CONCERNS). Não quebrar a reprodutibilidade semeada da tempestade.

- [ ] **Step 1 (RED):** Tests: Static-batalha removido (inimigo não é mais paralisado por derrotar o portador); XP/mov por segundo parado creditado. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** implementar remoção + parado-benefício; atração conforme viabilidade. balance: `STATIC_XP_PER_SEC=1`, `STATIC_MOVE_PER_SEC_L2=0.10`, `STATIC_MOVE_CAP_L2=1.0`. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): static novo (parado da XP/mov; remove paralisia de batalha) (Fase 4)`.

---

### Task 8: Dry Skin + Clear Body (rework)

**Files:** `src/game/missionFlow.ts`/`stormFlow.ts`, `src/engine/secretEffects.ts`, `src/engine/balance.ts`, tests.

- **Dry Skin (NOVO):** ao sair em missão, **+25% de vida na chuva** (calor/frio inertes por ora) —
  só a parte da chuva funciona. L2: além disso, **+25% de bônus de atributos** em missão quando sai
  na chuva (calor/frio inertes). Criar `hasDrySkin`. Aplicar a cura no `acceptMission` (se chovendo
  no instante) e o bônus em `missionAttrMultiplier` (se chovendo).
- **Clear Body (rework):** L1 — o time NÃO recebe efeitos negativos de clima (ex.: Paralyze do raio):
  em `processStorms`, se o time tem Clear Body, pular o Paralyze (mas o dano? spec diz "efeitos
  negativos de clima" → pular Paralyze e dano de raio). L2 — além disso, o time não recebe **debuffs
  de habilidade** em missão: o clamp de `mult < 1 → 1` no `missionAttrMultiplier` que hoje é do Clear
  Body (qualquer nível) passa a exigir **nível 2** para anular debuffs de habilidade; o nível 1 passa
  a ser só a imunidade de clima. (Ajustar: hoje Clear Body L≥1 já anula debuff de atributo; novo: L1
  = clima, L2 = clima + debuff de habilidade.)

- [ ] **Step 1 (RED):** Tests: Dry Skin cura 25% ao sair na chuva; Dry Skin+ dá +25% atributos na chuva; Clear Body L1 imune ao Paralyze do raio mas NÃO anula debuff de habilidade; Clear Body L2 anula debuff de habilidade. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** implementar. balance: `DRY_SKIN_RAIN_HEAL_FRAC=0.25`, `DRY_SKIN_MISSION_BONUS_L2=0.25`. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): dry-skin + clear-body rework por nivel (Fase 4)`.

---

## Self-Review (Fase 4)
- Cobertura: todos os efeitos restantes do spec §3. Inertes (Sand Rush; Thick Fat L1 congelamento;
  Ice Body L1 calor; Dry Skin calor/frio) ficam catalogados sem efeito — sem implementação aqui.
- Riscos conhecidos: Surf-só-na-água (T4) e Static-atração (T7) podem ficar como follow-up se o
  refactor for grande — documentar claramente, não hackear.
- Consistência: novos predicados `hasIceBody/hasOvercoat/hasOwnTempo/hasVoltAbsorb/hasDrySkin`;
  novos campos `permaBonus` (Pokemon), `electrified` (today), `waterAbsorbPending` (SecretRuntime).

## Fase 5 (depois): atualizar a skill `managing-pokemon-species` (2 por linha; nível 1/2; modelo de desbloqueio) + abrir o PR para `main`.
