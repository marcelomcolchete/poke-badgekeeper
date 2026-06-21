# Habilidades Secretas nível 1/2 — Fase 3: Magnitudes por nível — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Fazer cada Habilidade Secreta JÁ EXISTENTE escalar pelo nível (1/2), com as magnitudes do spec §3, incluindo as reescritas de fórmula (Rollout, Sturdy+, Explosion+, Reckless+, Vital Spirit+, Weak Armor, Shell Armor, Quick Feet+).

**Architecture:** Os helpers de magnitude em `src/engine/secretEffects.ts` passam a derivar o nível via `secretLevelOf(p, id)` e a retornar a constante L1 ou L2 (novas constantes em `balance.ts`). Os consumidores (gymDefense battle loop, missionAttrMultiplier, damageTaken, teamTravelSpeedMultiplier) chamam os helpers; onde a FÓRMULA muda (Rollout aditivo dobrando; Sturdy sem limite; Explosion total; Reckless meio-dano; Vital Spirit combate), o laço de batalha é ajustado. Esta fase NÃO mexe em clima/storm nem no ciclo de missão de Fase 4.

**Tech Stack:** TypeScript (ESM, `.ts` imports), Vitest, React. Build `npm run build` (tsc -b). Testes `npm test`.

## Global Constraints

- Verificação: `npm run build` e `npm test`. Sem preview.
- `.ts` nas importações. TDD (teste falha antes de implementar). Commits frequentes.
- **Fonte de verdade dos valores:** spec `docs/superpowers/specs/2026-06-21-habilidades-secretas-nivel-2-design.md` §3.
- **Nível:** usar `secretLevelOf(p, id): 0|1|2` (já existe em `src/data/secretAbilities.ts`). `level===2` = "+".
- **Padrão de constante:** para cada magnitude que muda por nível, criar par em `balance.ts` (ex.: `ROCK_HEAD_ESCORT_MULT` vira `ROCK_HEAD_ESCORT_MULT_L1 = 1.4` / `_L2 = 1.8`); ou um helper que recebe o nível. Manter os nomes existentes onde o valor não muda; renomear/duplicar onde muda. Atualizar TODOS os consumidores e o `missionEffectBreakdown`.
- **Mapa de seams (file:line) — usar como referência** (estado atual):
  - `missionAttrMultiplier`/`missionEffectBreakdown`: `secretEffects.ts` (Rock Head L193-195, Analytic L197-200, Torrent L202-204, Battle Armor L205, Hustle L206, Rivalry L189-191).
  - Battle loop `resolveDefense`: `gymDefense.ts` L304-388 (Rollout L323, Hustle L325, Rivalry L327-329, Regenerator L346-350, Pressure L337-338, Explosion L359-369, Reckless L381-385, Sturdy L301-302/L371-378).
  - `damageTaken`: `secretEffects.ts` L328-333 (consumido em `missions.ts` L201 e `gymDefense.ts` L370).
  - `teamTravelSpeedMultiplier`: `secretEffects.ts` L302-319; `teamHasQuickFeet` L272-274.
- **Não** mexer (Fase 4): Moxie permanente, auto-win por tipo, Pressure-rework "início do combate", Lightning Rod imunidade de viagem, Volt Absorb, Static novo, Cloud Nine/Overcoat/Own Tempo, Dry Skin, Clear Body, Natural Cure, Water Absorb, Sniper, Forewarn, Fly-raio. (Pressure e Thick Fat também ficam para a Fase 4 por trocarem semântica.)
- Magnitudes desta fase (spec §3):
  - Rock Head: escolta ×1.4 (L1) / ×1.8 (L2); ensino ×0.6 (L1) / ×0.2 (L2).
  - Analytic: ensino ×1.4 / ×1.8; patrulha ×0.6 / ×0.2.
  - Torrent: ×1.25 (L1) / ×1.5 (L2).
  - Battle Armor: ×1.25 (L1) / ×1.5 (L2).
  - Hustle: missão ×0.9/×0.7; batalha +0.10/+0.30.
  - Rivalry: atributo +0.10/+0.20 por aliado; batalha +0.10/+0.20.
  - Regenerator: +1 HP (L1) / cura total (L2) por vitória.
  - Rollout: bônus de Batalha p/ próximo = 2,4,8,16,32 (teto) no L1; 4,8,16,32,64 (teto) no L2 — ADITIVO.
  - Sturdy: L1 1×/dia; L2 sem limite (nunca desmaia).
  - Explosion: L1 metade da vida máx + derrota o inimigo; L2 toda a vida + derrota TODOS os inimigos.
  - Reckless: L1 retry; L2 retry tomando METADE do dano.
  - Vital Spirit: L1 retry de missão (já existe); L2 também retry de COMBATE sem perder vida.
  - Weak Armor: SEM dobro de dano; velocidade +0.15/ponto (L1) / +0.25 (L2).
  - Shell Armor: dano = ceil(raw/2) (L1) / ceil(raw/3) (L2).
  - Quick Feet: L1 +100% mov sozinho; L2 +100% mov para o time inteiro.

---

### Task 1: Mission multipliers por nível (Rock Head, Analytic, Torrent, Battle Armor, Hustle-missão, Rivalry-atributo)

**Files:** Modify `src/engine/balance.ts`, `src/engine/secretEffects.ts`; Test `src/engine/secretEffects.test.ts`.

**Interfaces:**
- Produces: constantes L1/L2 em balance.ts; `missionAttrMultiplier`/`missionEffectBreakdown` escalam por `secretLevelOf`. As funções de magnitude permanecem chamadas dos mesmos pontos.

- [ ] **Step 1 (RED):** Em `secretEffects.test.ts`, adicionar/ajustar testes que fixam, por nível, o `missionAttrMultiplier` para um Pokémon com cada habilidade no L1 e no L2 (use espécies cujas linhas têm a habilidade no slot conhecido — derive de `SECRET_LINES`; ex.: Rhyhorn 111 slot0 Rock Head, Staryu 120 slot0 Analytic, Squirtle 7 slot1 Torrent, Nidoran♀ 29 slot1 Hustle, Onix 95... etc.). Asserts: Rock Head escolta L1 ×1.4 / L2 ×1.8; ensino L1 ×0.6 / L2 ×0.2; Analytic ensino/patrulha 1.4/0.6 e 1.8/0.2; Torrent 1.25/1.5; Battle Armor (runtime pending) 1.25/1.5; Hustle missão 0.9/0.7; Rivalry +0.10/+0.20 por aliado. Rodar: `npm test -- secretEffects` → FAIL.
- [ ] **Step 2 (GREEN):** Em `balance.ts` criar pares `_L1`/`_L2` (valores acima) substituindo os singulares onde mudam (`ROCK_HEAD_ESCORT_MULT`, `ROCK_HEAD_STUDY_MULT`, `ANALYTIC_STUDY_MULT`, `ANALYTIC_PATROL_MULT`, `TORRENT_MISSION_MULT`, `BATTLE_ARMOR_MISSION_MULT`, `HUSTLE_MISSION_MULT`, `RIVALRY_ATTR_PER_ALLY`). Em `secretEffects.ts` `missionAttrMultiplier`: para cada habilidade, escolher o valor por `secretLevelOf(p, 'sa-...')`. Atualizar `missionEffectBreakdown` para mostrar o valor do nível certo. Rodar: `npm test -- secretEffects` → PASS.
- [ ] **Step 3:** `npm run build` (corrigir consumidores das constantes renomeadas) + `npm test` (suíte verde). Commit: `feat(secret): multiplicadores de missao por nivel (Fase 3)`.

---

### Task 2: Battle bonuses por nível simples (Hustle-batalha, Rivalry-batalha, Regenerator)

**Files:** Modify `src/engine/balance.ts`, `src/engine/secretEffects.ts`, `src/engine/gymDefense.ts`; Test `src/engine/gymDefense.test.ts`/`secretEffects.test.ts`.

**Interfaces:**
- Produces: `hustleBattleBonus(p)` e `rivalryBattleBonus(p)` retornam L1/L2 (0.10/0.30 e 0.10/0.20); Regenerator no win cura `+1` (L1) ou cura TOTAL (L2) — ajustar a linha de cura em `resolveDefense` por `secretLevelOf(you,'sa-regenerator')`.

- [ ] **Step 1 (RED):** Testes: `hustleBattleBonus`/`rivalryBattleBonus` por nível; um teste de `resolveDefense` (ou função de cura) que comprova Regenerator L2 cura HP cheio numa vitória vs L1 cura +1. Rodar focado → FAIL.
- [ ] **Step 2 (GREEN):** balance: `HUSTLE_BATTLE_BONUS_L1/L2` (0.10/0.30), `RIVALRY_BATTLE_BONUS_L1/L2` (0.10/0.20). secretEffects: helpers por nível. gymDefense L346-350: se `secretLevelOf(you,'sa-regenerator')===2` → `currentHp = you.maxHp`; senão `+REGENERATOR_HEAL_PER_WIN`. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): hustle/rivalry/regenerator por nivel (Fase 3)`.

---

### Task 3: Rollout — bônus aditivo dobrando (2→32 / 4→64)

**Files:** Modify `src/engine/balance.ts`, `src/engine/secretEffects.ts`, `src/engine/gymDefense.ts`; Test `src/engine/gymDefense.test.ts`/`secretEffects.test.ts`.

**Interfaces:**
- Produces: novo helper `rolloutBattleBonus(p, frontWins): number` (ADITIVO) = 0 se sem Rollout ou `frontWins < 1`; senão `min(cap, start * 2^(frontWins-1))` com `start=2,cap=32` (L1) ou `start=4,cap=64` (L2). REMOVE `rolloutBonusPerWin` (multiplicativo).

- [ ] **Step 1 (RED):** Teste de `rolloutBattleBonus`: L1 sequência frontWins 1..6 → 2,4,8,16,32,32; L2 → 4,8,16,32,64,64; frontWins 0 → 0; sem Rollout → 0. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** balance: `ROLLOUT_START_L1=2, ROLLOUT_CAP_L1=32, ROLLOUT_START_L2=4, ROLLOUT_CAP_L2=64` (remover `ROLLOUT_BATTLE_BONUS`). secretEffects: implementar `rolloutBattleBonus`. gymDefense L323: trocar `yourEff *= 1 + rolloutBonusPerWin(you) * frontWins` por `yourEff += rolloutBattleBonus(you, frontWins)` (ADITIVO, após os multiplicadores; ordem: aplicar o add depois dos `*=`). Atualizar testes de gymDefense que assumiam o rollout multiplicativo. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): rollout aditivo dobrando por nivel (Fase 3)`.

---

### Task 4: Reescritas de fórmula no combate (Sturdy+, Explosion+, Reckless+, Vital Spirit+ combate)

**Files:** Modify `src/engine/gymDefense.ts`, `src/engine/secretEffects.ts`, `src/engine/balance.ts`; Test `src/engine/gymDefense.test.ts`.

**Interfaces:**
- Consumes: `secretLevelOf`.
- Produces:
  - **Sturdy:** `canSturdy` permite uso ILIMITADO quando `secretLevelOf(you,'sa-sturdy')===2` (não consome o 1×/dia; L1 mantém 1×/dia).
  - **Explosion:** se `secretLevelOf===2` → perde TODA a vida (desmaia) e derrota TODOS os inimigos restantes (`theirs = enemies.length`); L1 mantém metade + 1 inimigo.
  - **Reckless:** na retentativa (sobreviveu e tenta de novo), se `secretLevelOf===2` o dano tomado é METADE (`ceil(loss/2)`); L1 igual.
  - **Vital Spirit+:** ao PERDER um duelo, se `secretLevelOf(you,'sa-vital-spirit')===2`, tenta de novo SEM perder vida (não passa a vez, não aplica dano) — espelha Reckless mas sem dano. (Guard anti-loop já existe.)

- [ ] **Step 1 (RED):** Testes de `resolveDefense`: Sturdy+ sobrevive a múltiplas quedas no mesmo dia; Explosion+ zera o esquadrão inimigo ao explodir; Reckless+ toma metade do dano na retentativa; Vital Spirit+ retoma o duelo sem perder HP. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** Implementar os 4 ramos no laço de `resolveDefense` por `secretLevelOf`. Para Explosion total, setar `theirs = enemies.length` e `currentHp` via `applyDamage(you, you.currentHp)` (zera) respeitando Sturdy+ se aplicável. Cuidar da ordem com Sturdy/Reckless. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): sturdy+/explosion+/reckless+/vital-spirit+ no combate (Fase 3)`.

---

### Task 5: damageTaken + Weak Armor (sem dobro; velocidade por nível) + Shell Armor (½/⅓)

**Files:** Modify `src/engine/balance.ts`, `src/engine/secretEffects.ts`; Test `src/engine/secretEffects.test.ts`.

**Interfaces:**
- Produces:
  - `damageTaken(p, raw)`: Shell Armor → `Math.ceil(raw / 2)` (L1) ou `Math.ceil(raw / 3)` (L2); Weak Armor NÃO altera mais o dano (remover o ramo do dobro). Precedência: Shell Armor.
  - `teamTravelSpeedMultiplier`: Weak Armor add por ponto de HP faltante = `0.15` (L1) / `0.25` (L2) — `secretLevelOf` do portador.

- [ ] **Step 1 (RED):** Testes: `damageTaken` Shell Armor L1 (3→2, 4→2, 1→1) e L2 (3→1, 4→2); Weak Armor não altera dano (raw passa igual); `teamTravelSpeedMultiplier` com Onix (Weak Armor) HP faltante → +0.15/ponto L1 e +0.25 L2. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** balance: remover `WEAK_ARMOR_DAMAGE_MULT`; `SHELL_ARMOR_DIVISOR_L1=2`, `_L2=3` (remover `SHELL_ARMOR_DAMAGE`); `WEAK_ARMOR_SPEED_PER_MISSING_HP_L1=0.15`, `_L2=0.25`. Implementar em `damageTaken`/`teamTravelSpeedMultiplier`. Atualizar `missionEffectBreakdown` (Weak Armor mostra +15%/+25% por nível) e quaisquer testes que assumiam dobro de dano. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): weak-armor sem dobro + shell-armor fracionado por nivel (Fase 3)`.

---

### Task 6: Quick Feet+ (time inteiro)

**Files:** Modify `src/engine/secretEffects.ts`; Test `src/engine/secretEffects.test.ts`.

**Interfaces:**
- Produces: `teamHasQuickFeet(team)` true quando (a) despachado sozinho com Quick Feet (qualquer nível), OU (b) algum membro tem Quick Feet nível 2 (time inteiro). O bônus de velocidade (`QUICK_FEET_SPEED_BONUS`) é o mesmo; muda só a condição.

- [ ] **Step 1 (RED):** Testes: Quick Feet L1 sozinho → speedy; L1 em time de 2 → não; L2 em time de 2 → speedy. Rodar → FAIL.
- [ ] **Step 2 (GREEN):** Ajustar `teamHasQuickFeet`: `(team.length===1 && hasQuickFeet(team[0])) || team.some(p => secretLevelOf(p,'sa-quick-feet')===2)`. Rodar → PASS.
- [ ] **Step 3:** build + `npm test`. Commit: `feat(secret): quick-feet+ time inteiro (Fase 3)`.

---

## Self-Review (Fase 3)
- Cobertura: todos os efeitos de magnitude/fórmula EXISTENTES do spec §3 que NÃO dependem de clima/ciclo-de-missão estão cobertos (T1-T6). Pressure, Thick Fat, Moxie, Natural Cure, Water Absorb, Sniper, Forewarn, Swift Swim+, Surf-na-água e tudo de clima ficam para a Fase 4.
- Consistência: todos os helpers escalam por `secretLevelOf(p, id)`; constantes em pares `_L1`/`_L2`.

## Fora de escopo → Fase 4
Pressure (rework início-de-combate), Thick Fat+/Ice Body+ (auto-win), Moxie (permanente), Natural Cure, Water Absorb, Sniper, Forewarn, Swift Swim+ (missão na chuva), Surf (só na água), Fly (raio), Lightning Rod (imunidade de viagem), Volt Absorb, Static (novo), Cloud Nine, Overcoat, Own Tempo, Dry Skin, Clear Body.
