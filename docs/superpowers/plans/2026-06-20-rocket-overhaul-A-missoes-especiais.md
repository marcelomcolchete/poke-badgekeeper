# Missões Especiais da Cidade — Implementation Plan (Feature A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar as antigas "missões Rocket" em **Missões Especiais da Cidade (⭐)**: aparição estocástica e escalonante POR LOCAL (substitui `rocketDays`), **sem batalha pós-missão**, **5× XP** direto na conclusão, e penalidades de estrela na reconciliação de fim de dia (nunca mais game over). Inclui a **renomeação transversal** (`museum`→`specialMission`, `MissionCategory` `'rocket'`→`'special'`, template id/nome/ícone) e o **tweak da skill** `mapping-kanto-city-from-image` (RKT→SPEC). Feature B (Evento de Roubo) NÃO está neste plano.

**Architecture:** Mudanças concentradas na engine pura (timeline/missions/balance/constants/state/daySummary/approval), no fluxo do jogo (missionFlow/dayClock/phaseFlow/setup/reducer/actions), na camada de dados (missionTemplates/types/cities), na persistência (saveLoad migração + bump) e em UI leve (CityMap/MissionDispatch/MissionRevealModal/ReportSidebar/DayScreen, remoção de RocketBattlePanel). Spec: `docs/superpowers/specs/2026-06-20-rocket-overhaul-design.md`.

**Tech Stack:** React + TypeScript + Vite + vitest.

## Global Constraints

- Build/tipos: usar `npm run build` (tsc -b), **NÃO** `tsc --noEmit` (o tsconfig raiz é solution-only).
- Testes: `npx vitest run` (arquivo único: `npx vitest run src/path/file.test.ts`).
- Comentários e textos de UI em **português** (PT-BR), espelhando o estilo existente do repo.
- Determinismo: a chance de cada local evolui via estado persistido `run.specialChances`, mutado no **abrir do dia** usando o RNG da run (`takeRng(s)`), **nunca** `Math.random`.
- `buildDaySchedule` continua **puro/semeado**; a rolagem estocástica das especiais é uma etapa SEPARADA em `setupDay` (que tem acesso ao `GameState`), não dentro de `buildDaySchedule`.
- DRY/YAGNI/TDD, commits frequentes. Seguir padrões existentes (status de missão, `markActive`, `replaceMon`, `takeRng`).
- `ROCKET_TRAINER_IDS`/`RocketTrainerId` em `src/types/index.ts` e o elenco Rocket em `src/data/trainers.ts` **PERMANECEM** — são reusados pela Feature B (Evento de Roubo). Não remover.
- Branch atual: `feat/escala-100-missoes` (commits vão direto nela).

---

## File Structure

**Modificados (engine):**
- `src/engine/constants.ts` — remove constantes Rocket (`ROCKET_SEED_SALT`); atualiza nota do `SAVE_VERSION` e bump.
- `src/engine/balance.ts` — remove `ROCKET_DAY_MIN/MAX`, `ROCKET_MISSIONS_TOTAL`, `ROCKET_GOLD_BONUS`, `ROCKET_XP_MULTIPLIER`; adiciona `SPECIAL_CHANCE_START/GROWTH_MIN/GROWTH_MAX/MAX` e `SPECIAL_XP_MULTIPLIER`.
- `src/engine/timeline.ts` — remove `rocketDays` e a injeção determinística; `MissionSlot` ganha `templateId?: 'special'` ainda opcional; expõe helper `rollSpecialMissions` (puro, recebe rng + chances + nº de locais) que decide hits/novas chances. `buildDaySchedule` deixa de injetar especiais.
- `src/engine/state.ts` — `RunInfo.specialChances: number[]`; remove o status `'battle'` de `MissionStatus`; remove `RocketBattle` e o campo `mission.rocket`; remove `'rocket'` de `gameOverReason`; inicializa `specialChances: []` em `createInitialState`.
- `src/engine/missions.ts` — sem mudança estrutural; o template `special` (gen `special5`) já cai no caminho de especiais de `generateRequirement` (comentário atualizado).
- `src/engine/daySummary.ts` — `DaySummaryInput`/`DaySummary` separam "total para exibição" de "total para razão" via filtro por `templateId === 'special'`.
- `src/engine/approval.ts` — sem mudança de assinatura; o `DailyProgress` continua recebendo só os totais NORMAIS (a separação é feita no chamador `phaseFlow`).

**Modificados (game):**
- `src/game/missionFlow.ts` — conclusão de especial paga 5× XP direto; REMOVE `setupRocketBattle`/`resolveRocketBattle`/`completeRocketBattle`/`loseRunByRocket` e o ramo `isRocket`.
- `src/game/dayClock.ts` — remove `loseRunByRocket` e o ramo `wasAvailableRocket`/game-over por expiração Rocket.
- `src/game/phaseFlow.ts` — `finalizeDay` separa total exibição × razão; aplica penalidades A3 (zera/−1, piso 0, sem game over); `resolveLeftovers` perde o ramo Rocket.
- `src/game/setup.ts` — `setupDay` rola as especiais (mutando `run.specialChances`) e injeta as instâncias; inicializa/redimensiona `specialChances` ao tamanho dos nós `specialMission`; `applyForewarn` filtra por `templateId !== 'special'`.
- `src/game/reducer.ts` — remove os cases `RESOLVE_ROCKET_BATTLE`/`COMPLETE_ROCKET_BATTLE` e os imports.
- `src/game/actions.ts` — remove as ações `RESOLVE_ROCKET_BATTLE`/`COMPLETE_ROCKET_BATTLE`.

**Modificados (dados/tipos):**
- `src/data/types.ts` — `CitySiteNodes.museum`→`specialMission`; `MissionTemplate.isRocket` removido.
- `src/types/index.ts` — `SITE_KINDS` `'museum'`→`'specialMission'`; `MISSION_CATEGORIES` `'rocket'`→`'special'`; `CATEGORY_SITE` chave/valor.
- `src/data/missionTemplates.ts` — `ROCKET_TEAM_TEMPLATE`→`SPECIAL_TEMPLATE` (id `'special'`, name `'Missão Especial'`, themeIcon `'⭐'`); `templatesForCategory` case `'special'`; `missionReward` remove o ramo `isRocket`.
- `src/data/cities.ts` — `nodesByKind` case `'specialMission'`; todos os blocos `*_SITE_NODES` (Pewter, Cerulean, Vermilion) trocam `museum:`→`specialMission:`.

**Modificados (persistência):**
- `src/persistence/saveLoad.ts` — migração v34→v35 (renomeia `siteNodes.museum`? não persiste; mas missões/instâncias `templateId 'rocket'` e o campo `mission.rocket`/status `'battle'` SÃO persistidos → limpar; inicializa `run.specialChances`).

**Modificados (UI):**
- `src/components/day/CityMap.tsx` — `isRocket`→`isSpecial` por `templateId === 'special'`; marcador `'⭐'`.
- `src/components/day/MissionRevealModal.tsx` — remove `rocketPending`/`onBattle`/botão "Batalhar" e a copy de batalha.
- `src/components/day/DayScreen.tsx` — remove `RocketBattlePanel`, a seleção `rocketBattle`, `startRocketBattle`, `onBattle`; `GuideMsgKind` `'rocket'`→`'special'`; `missionAnnouncement` usa `templateId === 'special'`.
- `src/components/day/ReportSidebar.tsx` — `MSG_META.rocket`→`special` com símbolo `'⭐'`.
- `src/components/day/ReportSidebar.module.css` — `.symRocket`/`.bubbleRocket`→`.symSpecial`/`.bubbleSpecial` (renome de classes referenciadas).

**Removidos:**
- `src/components/day/RocketBattlePanel.tsx` — deletado.
- `src/game/rocketFlow.test.ts` — substituído por `src/game/specialMissionFlow.test.ts`.

**Criados (testes):**
- `src/game/specialMissionFlow.test.ts` — conclusão de especial paga 5× XP; sem batalha.
- `src/engine/specialChances.test.ts` — `rollSpecialMissions` (hit reseta p/ 1, miss cresce 5–15pp cap 100).
- `src/game/specialPenalties.test.ts` — penalidades A3 e exclusão da razão de estrelas.

**Modificados (testes existentes):**
- `src/engine/timeline.test.ts` — remove tudo de `rocketDays`; ajusta `expectedMissionCount` (sem extra).
- `src/data/cerulean.test.ts` / `src/data/vermilion.test.ts` — `siteNodes.museum`→`specialMission`; troca os testes de "Rocket 2× via rocketDays" por "nodesForCategory(..., 'special') = ['x']".
- `src/data/data.test.ts` — `sn.museum`→`sn.specialMission` (linhas 59-equivalente e 155).
- `src/engine/missions.test.ts` — import `ROCKET_TEAM_TEMPLATE`→`SPECIAL_TEMPLATE` (se usado).

**Modificados (skill — Feature C):**
- `.claude/skills/mapping-kanto-city-from-image/SKILL.md` — legenda RKT→SPEC, vocabulário museum→specialMission, `description` frontmatter.
- `.claude/skills/mapping-kanto-city-from-image/template.md` — RKT→SPEC, `museum`→`specialMission`.

---

### Task 1: Renomeação dos tipos de domínio (`SiteKind`, `MissionCategory`, `CATEGORY_SITE`)

**Files:**
- Modify: `src/types/index.ts:187-208` (`SITE_KINDS`, `MISSION_CATEGORIES`, `CATEGORY_SITE`)
- Modify: `src/data/types.ts:77-94` (`CitySiteNodes.museum`→`specialMission`)
- Modify: `src/data/cities.ts:592-608` (`nodesByKind` case)

**Interfaces:**
- Consumes: nenhum novo.
- Produces:
  ```ts
  export const SITE_KINDS = ['gym', 'center', 'mart', 'specialMission', 'house', 'green'] as const
  export const MISSION_CATEGORIES = ['center', 'mart', 'house', 'freeArea', 'special'] as const
  export const CATEGORY_SITE: Record<MissionCategory, SiteKind> = {
    center: 'center', mart: 'mart', house: 'house', freeArea: 'green', special: 'specialMission',
  }
  // data/types.ts
  interface CitySiteNodes { gym: string; center: string; mart: string; specialMission: string[]; houses: string[]; green: string[] }
  ```

- [ ] **Step 1: Editar os tipos (compila-quebrado é esperado)**

Em `src/types/index.ts`, na const `SITE_KINDS` (linha 188), trocar `'museum'` por `'specialMission'`:
```ts
export const SITE_KINDS = ['gym', 'center', 'mart', 'specialMission', 'house', 'green'] as const
```
Na const `MISSION_CATEGORIES` (linha 197), trocar `'rocket'` por `'special'`:
```ts
export const MISSION_CATEGORIES = ['center', 'mart', 'house', 'freeArea', 'special'] as const
```
No `CATEGORY_SITE` (linhas 202-208), trocar a entrada `rocket: 'museum'` por `special: 'specialMission'` e atualizar o comentário acima (linha 201):
```ts
/** Sítio onde cada categoria de missão surge no mapa (a Missão Especial nasce no ponto specialMission). */
export const CATEGORY_SITE: Record<MissionCategory, SiteKind> = {
  center: 'center',
  mart: 'mart',
  house: 'house',
  freeArea: 'green',
  special: 'specialMission',
}
```

- [ ] **Step 2: Editar `CitySiteNodes`**

Em `src/data/types.ts`, no `interface CitySiteNodes` (linhas 84-89), trocar o campo `museum` por `specialMission` e o JSDoc:
```ts
  /**
   * Pontos onde a Missão Especial pode surgir (um por local especial da cidade, EM ORDEM).
   * Cidades com um único local usam lista de 1 elemento; Celadon pode ter 2 (['x', 'y']).
   * `run.specialChances` é indexado pela ordem desta lista.
   */
  specialMission: string[]
```
E no JSDoc do `interface CityData` (linha 120) trocar "museu" por "missão especial":
```ts
  /** Mapeamento sítio → ponto do grafo (ginásio, centro, mart, missão especial, casas, verdes). */
```

- [ ] **Step 3: Editar `nodesByKind`**

Em `src/data/cities.ts`, no `switch` de `nodesByKind` (linhas 594-607), trocar o case `'museum'` por `'specialMission'`:
```ts
    case 'specialMission':
      return siteNodes.specialMission
```

- [ ] **Step 4: Verificar que o build QUEBRA nos consumidores esperados**

Run: `npm run build`
Expected: FAIL — erros de tipo nos blocos `*_SITE_NODES` (`museum:` não existe mais), em `missionTemplates.ts` (`'rocket'`), `timeline.ts`, testes etc. Isso confirma que o rename atingiu os pontos certos; as próximas tasks resolvem cada um.

- [ ] **Step 5: Commit**
```bash
git add src/types/index.ts src/data/types.ts src/data/cities.ts
git commit -m "refactor(rename): SiteKind specialMission e MissionCategory special (tipos de dominio)"
```

---

### Task 2: Renomear os `*_SITE_NODES` das cidades (`museum`→`specialMission`)

**Files:**
- Modify: `src/data/cities.ts:173-180` (Pewter), `:284-291` (Cerulean), `:427-434` (Vermilion)

**Interfaces:**
- Consumes: `CitySiteNodes` (Task 1).
- Produces: nenhum novo (apenas dados).

- [ ] **Step 1: Pewter**

Em `PEWTER_SITE_NODES` (linha 177), trocar `museum: ['d'],` por:
```ts
  specialMission: ['d'], // 5 (ponto único da Missão Especial)
```

- [ ] **Step 2: Cerulean**

Em `CERULEAN_SITE_NODES` (linha 288), trocar a linha do `museum`:
```ts
  specialMission: ['x'], // 5.2 — ponto especial ÚNICO
```

- [ ] **Step 3: Vermilion**

Em `VERMILION_SITE_NODES` (linha 431), trocar:
```ts
  specialMission: ['x'], // SPEC — ponto especial único
```

- [ ] **Step 4: Build (ainda quebra fora de cities.ts)**

Run: `npm run build`
Expected: FAIL, mas SEM erros em `cities.ts` (os 3 blocos agora batem com o tipo). Restam erros em `missionTemplates.ts`/`timeline.ts`/testes.

- [ ] **Step 5: Commit**
```bash
git add src/data/cities.ts
git commit -m "refactor(rename): museum -> specialMission nos site nodes das cidades"
```

---

### Task 3: Renomear o template Rocket para Missão Especial

**Files:**
- Modify: `src/data/missionTemplates.ts:91-143`
- Modify: `src/data/types.ts:176-198` (remove `isRocket` de `MissionTemplate`)

**Interfaces:**
- Consumes: `MissionTemplate`, `MissionCategory`.
- Produces:
  ```ts
  export const SPECIAL_TEMPLATE: MissionTemplate // id 'special', name 'Missão Especial', themeIcon '⭐', gen 'special5'
  ```

- [ ] **Step 1: Substituir `ROCKET_TEAM_TEMPLATE` por `SPECIAL_TEMPLATE`**

Em `src/data/missionTemplates.ts`, trocar o bloco (linhas 91-104) por:
```ts
/**
 * Missão Especial da Cidade: aparição estocástica e escalonante por local (ver engine/timeline
 * → rollSpecialMissions e game/setup). Difícil como o antigo museu/Rocket (5 principais), rende
 * 5× o XP de uma missão normal e NÃO tem batalha pós-missão — a recompensa vem na conclusão.
 */
export const SPECIAL_TEMPLATE: MissionTemplate = {
  id: 'special',
  name: 'Missão Especial',
  themeIcon: '⭐',
  gen: 'special5',
  baseExecutionMs: 55 * SEC,
  danger: 3,
}
```

- [ ] **Step 2: Atualizar a lista e `templatesForCategory`**

Trocar `MISSION_TEMPLATES` (linhas 106-111) — substituir `ROCKET_TEAM_TEMPLATE` por `SPECIAL_TEMPLATE`:
```ts
export const MISSION_TEMPLATES: MissionTemplate[] = [
  ...NORMAL_TEMPLATES,
  POKECENTER_TEMPLATE,
  POKEMART_TEMPLATE,
  SPECIAL_TEMPLATE,
]
```
No `templatesForCategory` (linhas 123-135), trocar o case `'rocket'`:
```ts
    case 'special':
      return [SPECIAL_TEMPLATE]
```
Atualizar o comentário do topo do arquivo (linhas 1-5) e da seção das especiais (linha 70) trocando "Equipe Rocket"/"Museu" por "Missão Especial".

- [ ] **Step 3: Remover o ramo `isRocket` de `missionReward`**

Em `missionReward` (linhas 138-143), remover a linha:
```ts
  if (template.isRocket) return { icon: '⚔️', label: 'Batalha Rocket: ouro + 3× XP na vitória' }
```
(restam só `healOnSuccess` e `goldOnSuccess`; o resto retorna `null`).

- [ ] **Step 4: Remover `isRocket` de `MissionTemplate`**

Em `src/data/types.ts`, no `interface MissionTemplate` (linhas 193-197), remover o JSDoc + campo `isRocket?: boolean`.

- [ ] **Step 5: Build (ainda quebra em engine/UI/testes que usam isRocket/'rocket')**

Run: `npm run build`
Expected: FAIL com erros restantes em `timeline.ts`, `missionFlow.ts`, `CityMap.tsx`, etc. (sem erros em `missionTemplates.ts`/`types.ts`).

- [ ] **Step 6: Commit**
```bash
git add src/data/missionTemplates.ts src/data/types.ts
git commit -m "refactor(rename): template special (Missao Especial, icone estrela) sem isRocket"
```

---

### Task 4: Constantes de balanceamento da Missão Especial

**Files:**
- Modify: `src/engine/balance.ts:202-214` (remove constantes Rocket), adicionar novas
- Modify: `src/engine/constants.ts:62-63` (remove `ROCKET_SEED_SALT`)

**Interfaces:**
- Produces:
  ```ts
  export const SPECIAL_CHANCE_START = 1
  export const SPECIAL_CHANCE_GROWTH_MIN = 5
  export const SPECIAL_CHANCE_GROWTH_MAX = 15
  export const SPECIAL_CHANCE_MAX = 100
  export const SPECIAL_XP_MULTIPLIER = 5
  ```

- [ ] **Step 1: Remover constantes Rocket de `balance.ts`**

Em `src/engine/balance.ts`, remover o bloco (linhas 202-214): o JSDoc + `ROCKET_DAY_MIN`/`ROCKET_DAY_MAX`/`ROCKET_MISSIONS_TOTAL` e o `ROCKET_GOLD_BONUS`/`ROCKET_XP_MULTIPLIER`.

- [ ] **Step 2: Adicionar constantes da especial**

No lugar, inserir:
```ts
/**
 * Missão Especial da Cidade (⭐): cada local tem uma CHANCE corrente (%) que começa em
 * SPECIAL_CHANCE_START e é rolada no início de cada dia. Acertou → agenda a missão e a chance
 * volta a START; errou → cresce um inteiro aleatório em [GROWTH_MIN, GROWTH_MAX] pontos
 * percentuais, com teto SPECIAL_CHANCE_MAX. A conclusão paga SPECIAL_XP_MULTIPLIER× o pool de XP.
 */
export const SPECIAL_CHANCE_START = 1
export const SPECIAL_CHANCE_GROWTH_MIN = 5
export const SPECIAL_CHANCE_GROWTH_MAX = 15
export const SPECIAL_CHANCE_MAX = 100
export const SPECIAL_XP_MULTIPLIER = 5
```

- [ ] **Step 3: Remover `ROCKET_SEED_SALT` de `constants.ts`**

Em `src/engine/constants.ts`, remover (linhas 62-63) o JSDoc + `export const ROCKET_SEED_SALT = 0x526f636b`.

- [ ] **Step 4: Build (ainda quebra em timeline.ts que importa as removidas)**

Run: `npm run build`
Expected: FAIL — `timeline.ts` ainda importa `ROCKET_DAY_MIN/MAX`, `ROCKET_MISSIONS_TOTAL`, `ROCKET_SEED_SALT`; `missionFlow.ts` ainda importa `ROCKET_GOLD_BONUS`/`ROCKET_XP_MULTIPLIER`. Resolvido nas próximas tasks.

- [ ] **Step 5: Commit**
```bash
git add src/engine/balance.ts src/engine/constants.ts
git commit -m "feat(special): constantes da Missao Especial; remove constantes Rocket"
```

---

### Task 5: Estado `run.specialChances` + remoção de `RocketBattle`/status `'battle'`

**Files:**
- Modify: `src/engine/state.ts:23-38` (RunInfo), `:51-59` (MissionStatus), `:62-171` (MissionInstance/RocketBattle), `:527-554` (createInitialState)

**Interfaces:**
- Produces:
  ```ts
  interface RunInfo { /* … */ specialChances: number[]; gameOverReason?: 'gym' | 'stars' | 'fainted' }
  type MissionStatus = 'scheduled' | 'available' | 'traveling' | 'inProgress' | 'returning' | 'resolved'
  // RocketBattle removido; MissionInstance.rocket removido
  ```

- [ ] **Step 1: `RunInfo` ganha `specialChances`, perde `'rocket'` em `gameOverReason`**

Em `src/engine/state.ts`, no `interface RunInfo` (após `ballLevel`, linha 35), adicionar:
```ts
  /**
   * Chance corrente (%) de Missão Especial por LOCAL, indexada pela ordem de
   * `city.siteNodes.specialMission`. Inicia em SPECIAL_CHANCE_START quando a cidade começa;
   * rolada e mutada no abrir de cada dia (setupDay). Vazio antes de a cidade ser preparada.
   */
  specialChances: number[]
```
E na linha 37, trocar:
```ts
  gameOverReason?: 'gym' | 'stars' | 'fainted'
```

- [ ] **Step 2: Remover o status `'battle'`**

No `type MissionStatus` (linhas 51-59), remover a linha do `'battle'` (com seu comentário). Resultado:
```ts
export type MissionStatus =
  | 'scheduled'
  | 'available'
  | 'traveling'
  | 'inProgress'
  | 'returning'
  | 'resolved'
```

- [ ] **Step 3: Remover `mission.rocket` e a interface `RocketBattle`**

No `interface MissionInstance`, remover o JSDoc + campo `rocket?: RocketBattle` (linhas 147-152). Remover a interface `RocketBattle` inteira (linhas 155-171). Manter `xpAwards`/`xpSeed` (usados pela especial e pelas normais).

- [ ] **Step 4: Inicializar `specialChances: []`**

Em `createInitialState` (linha 529), trocar a montagem de `run`:
```ts
    run: { cityIndex: 0, day: 1, seed, phase: 'MORNING', ballLevel: 0, specialChances: [] },
```

- [ ] **Step 5: Build (ainda quebra em missionFlow/timeline/UI)**

Run: `npm run build`
Expected: FAIL — `missionFlow.ts` usa `mission.rocket`/status `'battle'`/`RocketBattle`; `DuelLog` import pode ficar órfão (remover se necessário em step seguinte). Resolvido nas próximas tasks.

- [ ] **Step 6: Commit**
```bash
git add src/engine/state.ts
git commit -m "feat(special): run.specialChances; remove RocketBattle e status battle"
```

---

### Task 6: `rollSpecialMissions` puro + remoção de `rocketDays` (timeline)

**Files:**
- Create test: `src/engine/specialChances.test.ts`
- Modify: `src/engine/timeline.ts:10-50` (imports + `MissionSlot`), `:67-78` (remove `rocketDays`), `:166-209` (`buildDaySchedule`)

**Interfaces:**
- Consumes: `Rng`, `SPECIAL_CHANCE_START/GROWTH_MIN/GROWTH_MAX/MAX`.
- Produces:
  ```ts
  export interface SpecialRoll {
    /** Índices (em city.siteNodes.specialMission) que ACERTARAM hoje — uma missão cada. */
    hits: number[]
    /** Novas chances correntes por local (resetadas a START nos hits; crescidas nos misses). */
    nextChances: number[]
  }
  /** Rola, por local, a chance corrente; hit → agenda + reset; miss → cresce 5–15pp (cap 100). */
  export function rollSpecialMissions(rng: Rng, chances: readonly number[]): SpecialRoll
  ```
- Nota: `buildDaySchedule` deixa de injetar especiais; quem injeta é `setupDay` (Task 8), usando `rollSpecialMissions` + `spawnTimesAcrossSegments`. `MissionSlot.templateId` continua opcional e passa a valer `'special'`.

- [ ] **Step 1: Escrever o teste de `rollSpecialMissions`**

Criar `src/engine/specialChances.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'
import { rollSpecialMissions } from './timeline.ts'
import {
  SPECIAL_CHANCE_GROWTH_MAX,
  SPECIAL_CHANCE_GROWTH_MIN,
  SPECIAL_CHANCE_MAX,
  SPECIAL_CHANCE_START,
} from './balance.ts'

describe('rollSpecialMissions', () => {
  it('chance 100% sempre acerta e reseta o local para START', () => {
    const r = rollSpecialMissions(createRng(1), [100])
    expect(r.hits).toEqual([0])
    expect(r.nextChances).toEqual([SPECIAL_CHANCE_START])
  })

  it('miss faz a chance crescer entre GROWTH_MIN e GROWTH_MAX pontos (cap 100)', () => {
    // chance 1% → quase sempre erra; o crescimento fica na faixa esperada.
    for (let seed = 1; seed <= 50; seed++) {
      const r = rollSpecialMissions(createRng(seed), [SPECIAL_CHANCE_START])
      if (r.hits.length === 0) {
        const grown = r.nextChances[0] as number
        expect(grown).toBeGreaterThanOrEqual(SPECIAL_CHANCE_START + SPECIAL_CHANCE_GROWTH_MIN)
        expect(grown).toBeLessThanOrEqual(SPECIAL_CHANCE_START + SPECIAL_CHANCE_GROWTH_MAX)
      } else {
        expect(r.nextChances[0]).toBe(SPECIAL_CHANCE_START)
      }
    }
  })

  it('o crescimento nunca passa do teto SPECIAL_CHANCE_MAX', () => {
    const r = rollSpecialMissions(createRng(3), [99])
    // 99 + (5..15) seria > 100; se errar, fica capado em 100.
    expect((r.nextChances[0] as number)).toBeLessThanOrEqual(SPECIAL_CHANCE_MAX)
  })

  it('cada local é independente (lista de chances vira lista do mesmo tamanho)', () => {
    const r = rollSpecialMissions(createRng(7), [100, 1])
    expect(r.nextChances).toHaveLength(2)
    expect(r.hits).toContain(0) // o de 100% acerta
    expect(r.nextChances[0]).toBe(SPECIAL_CHANCE_START)
  })

  it('lista vazia → sem hits, sem chances', () => {
    expect(rollSpecialMissions(createRng(1), [])).toEqual({ hits: [], nextChances: [] })
  })
})
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run src/engine/specialChances.test.ts`
Expected: FAIL — `rollSpecialMissions` ainda não existe.

- [ ] **Step 3: Remover `rocketDays` e seus imports**

Em `src/engine/timeline.ts`:
- No import de `./constants.ts` (linha 10), remover `ROCKET_SEED_SALT`.
- No import de `./balance.ts` (linhas 11-21), remover `ROCKET_DAY_MAX`, `ROCKET_DAY_MIN`, `ROCKET_MISSIONS_TOTAL` e adicionar `SPECIAL_CHANCE_GROWTH_MAX`, `SPECIAL_CHANCE_GROWTH_MIN`, `SPECIAL_CHANCE_MAX`, `SPECIAL_CHANCE_START`.
- Remover a função `rocketDays` inteira (linhas 67-78) e seu JSDoc.
- No import de `./rng.ts` (linha 9): `deriveSeed` pode ficar órfão se só `rocketDays` o usava — remover se `npm run build` apontar `noUnusedLocals`. (verificar; `createRng` permanece.)

- [ ] **Step 4: Implementar `rollSpecialMissions` + ajustar `clamp`**

Adicionar a `clamp` já está importado. Inserir (após `segmentCounts`/`spawnTimesAcrossSegments`, antes de `buildDaySchedule`):
```ts
export interface SpecialRoll {
  /** Índices (em city.siteNodes.specialMission) que ACERTARAM hoje — uma missão cada. */
  hits: number[]
  /** Novas chances correntes por local (reset a START nos hits; crescidas nos misses, cap MAX). */
  nextChances: number[]
}

/**
 * Rola, POR LOCAL e de forma independente, a chance corrente de Missão Especial. Acertou →
 * o índice entra em `hits` e a chance volta a SPECIAL_CHANCE_START; errou → cresce um inteiro
 * aleatório em [GROWTH_MIN, GROWTH_MAX] pontos percentuais, com teto SPECIAL_CHANCE_MAX. Puro:
 * toda aleatoriedade vem do `rng` recebido (o chamador usa takeRng no abrir do dia).
 */
export function rollSpecialMissions(rng: Rng, chances: readonly number[]): SpecialRoll {
  const hits: number[] = []
  const nextChances = chances.map((chance, i) => {
    if (rng.bool(chance / 100)) {
      hits.push(i)
      return SPECIAL_CHANCE_START
    }
    const growth = rng.int(SPECIAL_CHANCE_GROWTH_MIN, SPECIAL_CHANCE_GROWTH_MAX)
    return Math.min(SPECIAL_CHANCE_MAX, chance + growth)
  })
  return { hits, nextChances }
}
```

- [ ] **Step 5: Remover a injeção determinística de `buildDaySchedule`**

Em `buildDaySchedule` (linhas 166-209), remover o bloco "2) Missão EXTRA da Equipe Rocket" inteiro (linhas 178-191). Renumerar os comentários 3)/4) para 2)/3). O `MissionSlot.templateId` continua no tipo (linha 48-49) com o JSDoc atualizado:
```ts
  /** Template fixo (Missão Especial); ausente = sorteia da categoria. */
  templateId?: string
```
`buildDaySchedule` passa a montar só as missões normais (sem especiais).

- [ ] **Step 6: Rodar o teste de chances + build**

Run: `npx vitest run src/engine/specialChances.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: ainda FAIL em `setup.ts` (precisa injetar as especiais), `missionFlow.ts`, testes de timeline/cerulean/vermilion — resolvidos nas próximas tasks.

- [ ] **Step 7: Commit**
```bash
git add src/engine/timeline.ts src/engine/specialChances.test.ts
git commit -m "feat(special): rollSpecialMissions puro; remove rocketDays da timeline"
```

---

### Task 7: Conclusão da especial paga 5× XP; remover batalha Rocket (missionFlow)

**Files:**
- Modify: `src/game/missionFlow.ts:1-48` (imports), `:268-328` (`resolveMissionNow`), `:382-491` (remover funções Rocket)
- Create test: `src/game/specialMissionFlow.test.ts`
- Delete: `src/game/rocketFlow.test.ts`

**Interfaces:**
- Consumes: `SPECIAL_XP_MULTIPLIER`, `MISSION_XP_POOL`.
- Produces: `resolveMissionNow`/`freeOnReturn` inalterados na assinatura; conclusão de `templateId === 'special'` no sucesso grava `xpAwards = pool*5 / time`. Remove `setupRocketBattle`, `resolveRocketBattle`, `completeRocketBattle`, `loseRunByRocket`.

- [ ] **Step 1: Escrever o novo teste**

Criar `src/game/specialMissionFlow.test.ts`:
```ts
// Missão Especial da Cidade (Feature A): conclusão paga 5× o pool de XP direto, SEM batalha.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createMissionInstance } from '../engine/missions.ts'
import { zeroAttrs } from '../engine/attributes.ts'
import { createRng } from '../engine/rng.ts'
import { MISSION_XP_POOL, SPECIAL_XP_MULTIPLIER } from '../engine/balance.ts'
import { makeMon } from '../engine/testkit.ts'
import { freeOnReturn, resolveMissionNow } from './missionFlow.ts'
import type { GameState } from '../engine/state.ts'

/** Estado com 1 Missão Especial 'inProgress', time despachado e exigência trivial (sucesso certo). */
function specialState(): GameState {
  const s = createInitialState(1)
  s.run.day = 5
  s.roster = [makeMon({ id: 'p1', status: 'onMission', baseAttrs: { ...zeroAttrs(), batalha: 50 } })]
  const mission = createMissionInstance({
    id: 'm1',
    rng: createRng(1),
    day: 5,
    category: 'special',
    node: 'd',
    spawnAtMs: 0,
    lifetimeMs: 40_000,
    templateId: 'special',
  })
  mission.teamIds = ['p1']
  mission.status = 'inProgress'
  mission.requirement = zeroAttrs() // P_sucesso = 1
  s.missions = [mission]
  return s
}

describe('Missão Especial', () => {
  it('ao concluir vai direto para returning (sem status battle)', () => {
    const s = specialState()
    resolveMissionNow(s, s.missions[0]!)
    const m = s.missions[0]!
    expect(m.status).toBe('returning')
    expect(m.result).toBe('success')
  })

  it('paga 5× o pool de XP (time de 1 leva tudo), aplicado na volta', () => {
    const s = specialState()
    resolveMissionNow(s, s.missions[0]!)
    const m = s.missions[0]!
    expect(m.xpAwards?.['p1']).toBe(MISSION_XP_POOL * SPECIAL_XP_MULTIPLIER)
    const before = s.today.xpEarned
    freeOnReturn(s, m)
    expect(m.status).toBe('resolved')
    expect(s.today.xpEarned).toBe(before + MISSION_XP_POOL * SPECIAL_XP_MULTIPLIER)
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx vitest run src/game/specialMissionFlow.test.ts`
Expected: FAIL — hoje a especial (`isRocket`) entraria em batalha; além disso o XP é o pool normal.

- [ ] **Step 3: Ajustar imports e remover funções Rocket**

Em `src/game/missionFlow.ts`:
- No import de `../../types/index.ts` → `../types/index.ts` (linha 6): remover `TrainerId` se ficar órfão após remover Rocket.
- No import de `./state.ts` (linha 8): remover `MissionStatus`? Não — `MissionStatus` ainda é usado por `OCCUPYING_STATUSES`. Manter.
- No import de `../engine/balance.ts` (linhas 14-22): remover `ROCKET_GOLD_BONUS`, `ROCKET_XP_MULTIPLIER`; adicionar `SPECIAL_XP_MULTIPLIER`.
- Remover imports que só a batalha Rocket usava se ficarem órfãos: `generateDefenseEnemies`, `resolveDefense`, `rollSquadSize` (de `../engine/gymDefense.ts`), `goldForDefense` (de `../engine/economy.ts`), `getTrainer` (de `../data/trainers.ts`), `applyBattleSecretRuntime` (de `./defenseFlow.ts`). **Verificar uso restante** antes de remover cada um (rodar `npm run build` ao fim aponta órfãos via `noUnusedLocals`). `goldForMart` permanece.
- Remover o bloco inteiro "Equipe Rocket (batalha após a parte de atributos)" (linhas 382-491): funções `setupRocketBattle`, `resolveRocketBattle`, `completeRocketBattle`, `loseRunByRocket`.

- [ ] **Step 4: Pagar 5× XP na especial em `resolveMissionNow`**

Em `resolveMissionNow` (linhas 268-328), remover o bloco "Equipe Rocket" (linhas 291-296: o `if (template.isRocket && outcome.success) { setupRocketBattle… return }`). Em seguida, ao montar `mission.xpAwards` no sucesso (linhas 313-318), aplicar o multiplicador para a especial:
```ts
  if (outcome.success) {
    // Pool de XP dividido entre os participantes; a Missão Especial paga SPECIAL_XP_MULTIPLIER×.
    const pool = template.id === 'special' ? MISSION_XP_POOL * SPECIAL_XP_MULTIPLIER : MISSION_XP_POOL
    const share = team.length > 0 ? Math.floor(pool / team.length) : 0
    mission.xpAwards = Object.fromEntries(team.map((p) => [p.id, share]))
    applyMissionRewards(s, template, team)
  }
```
(O `freeOnReturn` já aplica `mission.xpAwards` — nada a mudar lá.)

- [ ] **Step 5: Deletar o teste antigo**

Run: `git rm src/game/rocketFlow.test.ts`

- [ ] **Step 6: Rodar testes + build**

Run: `npx vitest run src/game/specialMissionFlow.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: ainda FAIL em `dayClock.ts` (importa `loseRunByRocket`), `phaseFlow.ts` (importa `resolveRocketBattle`/`completeRocketBattle`), `reducer.ts`/`actions.ts`, UI. Resolvidos a seguir.

- [ ] **Step 7: Commit**
```bash
git add src/game/missionFlow.ts src/game/specialMissionFlow.test.ts
git rm src/game/rocketFlow.test.ts
git commit -m "feat(special): conclusao paga 5x XP direto; remove batalha Rocket do missionFlow"
```

---

### Task 8: `setupDay` rola e injeta as Missões Especiais; inicializa `specialChances`

**Files:**
- Modify: `src/game/setup.ts:14-58` (imports + `setupDay`), `:93-102` (`applyForewarn`), `:163-209` (`autoSeedRun`/`startRun`)

**Interfaces:**
- Consumes: `rollSpecialMissions`, `spawnTimesAcrossSegments`? (não exportado) — usar a infra existente. Como `spawnTimesAcrossSegments` é privada na timeline, expor uma forma de obter horários. Decisão: exportar `spawnTimesAcrossSegments` da `timeline.ts` OU adicionar um helper. **Escolha:** exportar `spawnTimesAcrossSegments(rng, count, day)` da timeline (já existe, só faltava `export`).
- Produces: `setupDay` injeta missões especiais (template `'special'`, lifetime `DEFENSE_LIFETIME_MS`) e persiste `s.run.specialChances`.

- [ ] **Step 1: Exportar `spawnTimesAcrossSegments` na timeline**

Em `src/engine/timeline.ts`, prefixar `export` na função `spawnTimesAcrossSegments` (linha 115).

- [ ] **Step 2: Inicializar/redimensionar `specialChances` e injetar as especiais em `setupDay`**

Em `src/game/setup.ts`:
- Imports (linha 14): adicionar `rollSpecialMissions`, `spawnTimesAcrossSegments` ao import de `../engine/timeline.ts`.
- Import de `../engine/balance.ts` (linhas 22-27): adicionar `SPECIAL_CHANCE_START`.
- Import de `../engine/rng.ts`: adicionar/garantir `createRng`, `deriveSeed` (já presentes).
- Adicionar `takeRng`? `setupDay` é chamado a partir do reducer; usar `takeRng(s)` de `./runtime.ts` (adicionar ao import da linha 29). **Importante:** o roll usa `takeRng(s)` (RNG da run), satisfazendo o determinismo via `rngCursor`.

Logo no começo de `setupDay` (após `const city = getCity(...)`, linha 42), garantir o tamanho de `specialChances`:
```ts
  // Garante uma chance corrente por local especial da cidade (inicia em START; preserva as
  // existentes ao trocar de dia, perde tamanho só se a cidade mudou o nº de locais).
  const specialCount = city.siteNodes.specialMission.length
  if (s.run.specialChances.length !== specialCount) {
    s.run.specialChances = Array.from(
      { length: specialCount },
      (_, i) => s.run.specialChances[i] ?? SPECIAL_CHANCE_START,
    )
  }
```
Depois de montar `s.missions = schedule.missions.map(...)` (linha 44-59), injetar as especiais:
```ts
  // Missões Especiais (⭐): rolagem ESTOCÁSTICA por local no abrir do dia (muta a chance persistida).
  // Determinístico via takeRng (cursor da run). Hits viram instâncias 'special' com timer longo,
  // distribuídas nos 3 momentos como as demais (não aparecem na previsão — surpresa).
  const specialRng = takeRng(s)
  const roll = rollSpecialMissions(specialRng, s.run.specialChances)
  s.run.specialChances = roll.nextChances
  if (roll.hits.length > 0) {
    const times = spawnTimesAcrossSegments(specialRng, roll.hits.length, s.run.day)
    roll.hits.forEach((siteIndex, k) => {
      const nodes = city.siteNodes.specialMission
      const node = nodes[siteIndex] ?? city.siteNodes.gym
      s.missions.push(
        createMissionInstance({
          id: takeId(s, 'm'),
          rng: createRng(deriveSeed(s.run.seed, s.run.day * 1000 + siteIndex)),
          day: s.run.day,
          category: 'special',
          node,
          spawnAtMs: times[k] ?? 0,
          lifetimeMs: DEFENSE_LIFETIME_MS,
          templateId: 'special',
        }),
      )
    })
  }
```
(Manter a ordenação? As missões normais já vêm ordenadas; especiais são empurradas ao fim. A UI/relógio promove por `spawnAtMs`, então a ordem do array não importa funcionalmente — não reordenar para manter simples.)

- [ ] **Step 3: `setupDay` — lifetime das demais e `applyForewarn`**

Em `setupDay`, o `lifetimeMs` das missões NORMAIS (linha 48) hoje testa `slot.templateId === 'rocket'`. Como `buildDaySchedule` não injeta mais especiais, simplificar para sempre `MISSION_LIFETIME_MS`:
```ts
    const lifetimeMs = MISSION_LIFETIME_MS
```
(remover `DEFENSE_LIFETIME_MS` do cálculo do map — ele segue importado para as especiais injetadas e para `buildDefense`.)
Em `applyForewarn` (linha 96), trocar o filtro `m.templateId !== 'rocket'` por `m.templateId !== 'special'`:
```ts
  const movable = s.missions.filter((m) => m.templateId !== 'special' && m.spawnAtMs > 0)
```

- [ ] **Step 4: Inicializar `specialChances` no bootstrap**

`autoSeedRun` e `startRun` partem de `createInitialState` (que já põe `specialChances: []`). `setupDay` redimensiona ao entrar no DAY, então nada mais a fazer. (Sanidade: não preencher aqui evita duplicar a lógica.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: ainda FAIL em `dayClock.ts`/`phaseFlow.ts`/`reducer.ts`/`actions.ts`/UI/testes. Mas `setup.ts` deve compilar.

- [ ] **Step 6: Commit**
```bash
git add src/game/setup.ts src/engine/timeline.ts
git commit -m "feat(special): setupDay rola e injeta Missoes Especiais; specialChances por cidade"
```

---

### Task 9: `dayClock` — remover game-over por expiração Rocket

**Files:**
- Modify: `src/game/dayClock.ts:10` (import), `:51-83` (`processMissions`)

**Interfaces:**
- Consumes: `expireMission`, `promoteMission`, `advanceMission` (sem `loseRunByRocket`).

- [ ] **Step 1: Remover `loseRunByRocket` do import**

Em `src/game/dayClock.ts` (linha 10), trocar:
```ts
import { advanceMission, expireMission, promoteMission } from './missionFlow.ts'
```

- [ ] **Step 2: Limpar `processMissions`**

Em `processMissions` (linhas 51-83), remover a variável `wasAvailableRocket` (linhas 55-56), o uso de `getMissionTemplate` (verificar se ainda é usado no arquivo; se não, remover o import da linha 9), e no ramo de expiração de pop-up (linhas 70-74) tirar `if (wasAvailableRocket) loseRunByRocket(s)`:
```ts
    if (mission.status === 'available' && now >= mission.expiresAtMs) {
      expireMission(s, mission)
      continue
    }
```
(O comentário das linhas 53-59 deve ser reescrito: a expiração de uma especial não é mais game over — vira penalidade de estrela no fim do dia.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: FAIL ainda em `phaseFlow.ts`/`reducer.ts`/`actions.ts`/UI/testes.

- [ ] **Step 4: Commit**
```bash
git add src/game/dayClock.ts
git commit -m "fix(special): remove game-over por expiracao Rocket no dayClock"
```

---

### Task 10: Remover ações/cases Rocket do reducer e actions

**Files:**
- Modify: `src/game/reducer.ts:12,57-61`
- Modify: `src/game/actions.ts:32-35`

**Interfaces:** nenhuma nova (remoção).

- [ ] **Step 1: `actions.ts`**

Em `src/game/actions.ts`, remover as duas variantes da união (linhas 32-35): `RESOLVE_ROCKET_BATTLE` e `COMPLETE_ROCKET_BATTLE` (com seus comentários).

- [ ] **Step 2: `reducer.ts`**

Em `src/game/reducer.ts`:
- Import (linha 12): trocar para `import { acceptMission } from './missionFlow.ts'` (remover `completeRocketBattle`, `resolveRocketBattle`).
- Remover os cases `RESOLVE_ROCKET_BATTLE` e `COMPLETE_ROCKET_BATTLE` (linhas 57-61).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: FAIL em `phaseFlow.ts`/UI/testes apenas.

- [ ] **Step 4: Commit**
```bash
git add src/game/reducer.ts src/game/actions.ts
git commit -m "refactor(special): remove acoes RESOLVE/COMPLETE_ROCKET_BATTLE"
```

---

### Task 11: Penalidades A3 + exclusão da razão de estrelas (daySummary + phaseFlow)

**Files:**
- Modify: `src/engine/daySummary.ts:10-69` (input/output + build)
- Modify: `src/game/phaseFlow.ts:24-30` (imports), `:57-110` (`finalizeDay`), `:166-185` (`resolveLeftovers`)
- Create test: `src/game/specialPenalties.test.ts`

**Interfaces:**
- Produces (daySummary): novos campos derivados, sem quebrar os existentes:
  ```ts
  interface DaySummary { /* … */ specialAttempted: number; specialCompleted: number }
  ```
  e `missionsCompleted`/`missionsTotal` continuam contando **tudo** (exibição). A RAZÃO de estrelas usa contagens separadas computadas no `phaseFlow`.
- Comportamento (phaseFlow.finalizeDay):
  - `DailyProgress.missionsCompleted/missionsTotal` = só NORMAIS (`templateId !== 'special'`).
  - Game over por estrela vale só para o desempenho NORMAL (inalterado).
  - Depois, penalidades da especial aplicadas com piso 0, **sem** game over:
    - não despachada/expirada (resultado `expired`, time vazio) → `missionStars = 0`.
    - despachada e falhou (resultado `failure`, time não-vazio) → `missionStars − 1` (piso 0).
    - concluída → nada.

- [ ] **Step 1: Escrever o teste de penalidades**

Criar `src/game/specialPenalties.test.ts`:
```ts
// Penalidades da Missão Especial (Feature A — A3/A4): aplicadas no fim do dia, nunca game over,
// e EXCLUÍDAS da razão normal de estrelas.

import { describe, expect, it } from 'vitest'
import { autoSeedRun } from './setup.ts'
import { finalizeDay } from './phaseFlow.ts'
import type { GameState } from '../engine/state.ts'

/** Estado pronto para finalizar o dia com `missionResults` controlados. */
function dayWith(results: GameState['today']['missionResults']): GameState {
  const s = autoSeedRun(1)
  s.run.phase = 'DAY'
  s.run.day = 3
  s.approval.missionStars = 3
  s.approval.battleStars = 3
  s.today.missionResults = results
  // Sem defesas: a trilha de batalhas fica neutra (total 0 → delta 0).
  s.today.defensesTotal = 0
  s.today.defensesWon = 0
  return s
}

describe('penalidades da Missão Especial', () => {
  it('especial NÃO despachada (expired) zera missionStars sem game over', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: false, teamIds: [] }, // expirada, sem dispatch
    ])
    finalizeDay(s)
    expect(s.approval.missionStars).toBe(0)
    expect(s.run.phase).not.toBe('GAMEOVER')
  })

  it('especial despachada e falha tira 1 estrela cheia (piso 0)', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: false, teamIds: ['p1'] }, // tentou e falhou
    ])
    const before = 3
    finalizeDay(s)
    // desempenho normal: 1/1 → +1; depois −1 da especial → volta a 3.
    expect(s.approval.missionStars).toBe(before)
    expect(s.run.phase).not.toBe('GAMEOVER')
  })

  it('especial concluída não penaliza (só conta no total de exibição)', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: true, teamIds: ['p1'] },
    ])
    finalizeDay(s)
    // 1 normal cumprida de 1 normal → +1; especial cumprida não mexe na razão nem penaliza.
    expect(s.approval.missionStars).toBe(3.5)
    expect(s.run.phase).not.toBe('GAMEOVER')
  })

  it('a razão de estrelas IGNORA a especial (não conta como missão a mais não cumprida)', () => {
    const s = dayWith([
      { templateId: 'patrulha', success: true, teamIds: ['p1'] },
      { templateId: 'palestra', success: true, teamIds: ['p1'] },
      { templateId: 'special', success: true, teamIds: ['p1'] },
    ])
    finalizeDay(s)
    // 2/2 normais → +1 (não 2/3); especial concluída não penaliza.
    expect(s.approval.missionStars).toBe(3.5)
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx vitest run src/game/specialPenalties.test.ts`
Expected: FAIL — hoje a especial entra na razão e não há penalidade dedicada.

- [ ] **Step 3: daySummary — separar exibição × razão**

Em `src/engine/daySummary.ts`:
- Em `DaySummary` (linhas 25-46) adicionar:
```ts
  /** Missões especiais tentadas (despachadas ou expiradas) — exibição. */
  specialAttempted: number
  /** Missões especiais concluídas — exibição. */
  specialCompleted: number
```
- Em `buildDaySummary` (linhas 49-69), computar (sem alterar `missionsCompleted`/`missionsTotal`, que seguem contando TUDO para exibição):
```ts
  const special = input.missionResults.filter((m) => m.templateId === 'special')
  // …no objeto de retorno:
  specialAttempted: special.length,
  specialCompleted: special.filter((m) => m.success).length,
```

- [ ] **Step 4: phaseFlow — razão só-normais, penalidades depois**

Em `src/game/phaseFlow.ts`:
- Imports (linhas 24-30): trocar para `import { expireMission, freeOnReturn, resolveMissionNow } from './missionFlow.ts'` (remover `completeRocketBattle`, `resolveRocketBattle`).
- Import de `../engine/constants.ts` (linha 9): adicionar `STARS_MIN` (já está) e `STARS_STEP` (para o −1 = 2 passos) → na verdade usar `applyDomainStars` para o piso. Adicionar `STARS_STEP`:
```ts
import { STARS_MIN, STARS_STEP, TOTAL_DAYS } from '../engine/constants.ts'
```
Adicionar import de `applyDomainStars` já presente (linha 12-17). Garantir `applyDomainStars` no import de `../engine/approval.ts`.

- Em `finalizeDay`, trocar a montagem de `progress` (linhas 66-71) para excluir as especiais da razão:
```ts
  const normalResults = s.today.missionResults.filter((r) => r.templateId !== 'special')
  const progress: DailyProgress = {
    missionsCompleted: normalResults.filter((r) => r.success).length,
    missionsTotal: normalResults.length,
    battlesWon: s.today.defensesWon,
    battlesTotal: s.today.defensesTotal,
  }
```
- O bloco de game-over por estrela (linhas 78-85) fica inalterado (usa `missionBefore + missionDelta`, agora baseado só nas normais).
- Após gravar `missionAfter`/`battleAfter` (linhas 87-89) e ANTES de montar o `summary`, aplicar as penalidades da especial:
```ts
  // Penalidades da Missão Especial (A3) — aplicadas DEPOIS do desempenho normal, com piso 0 e
  // SEM game over. Não despachada (expired, time vazio) zera; despachada e falha tira 1 cheia.
  const specials = s.today.missionResults.filter((r) => r.templateId === 'special')
  const expiredSpecial = specials.some((r) => r.teamIds.length === 0 && !r.success)
  const failedSpecial = specials.some((r) => r.teamIds.length > 0 && !r.success)
  if (expiredSpecial) {
    s.approval.missionStars = STARS_MIN
  } else if (failedSpecial) {
    s.approval.missionStars = applyDomainStars(s.approval.missionStars, -STARS_STEP * 2)
  }
```
(Colocar isto após a linha 88 `s.approval.battleStars = battleAfter`; o `missionAfter` já foi gravado em `s.approval.missionStars`, então a penalidade sobrescreve a partir do valor pós-normal.)
- Atualizar `buildDaySummary({...})` para passar `missionStarsAfter: s.approval.missionStars` em vez de `missionAfter` (linha ~93) para o resumo refletir a penalidade:
```ts
    missionStarsAfter: s.approval.missionStars,
```

- Em `resolveLeftovers` (linhas 166-185), remover o tratamento Rocket: simplificar para
```ts
  for (const mission of s.missions) {
    if (mission.status === 'scheduled' || mission.status === 'available') {
      expireMission(s, mission)
    } else if (mission.status === 'traveling' || mission.status === 'inProgress') {
      resolveMissionNow(s, mission)
      freeOnReturn(s, mission)
    } else if (mission.status === 'returning') {
      freeOnReturn(s, mission)
    }
  }
```
(O ramo `'battle'` e `resolveRocketBattle`/`completeRocketBattle` somem.)

- [ ] **Step 5: Rodar os testes-alvo + suíte de phaseFlow/approval/daySummary**

Run: `npx vitest run src/game/specialPenalties.test.ts`
Expected: PASS.
Run: `npx vitest run src/engine/daySummary.test.ts src/engine/approval.test.ts`
Expected: PASS (ajustar quaisquer asserts de `DaySummary` que checavam o shape — adicionar `specialAttempted`/`specialCompleted` se algum teste compara objeto completo).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: FAIL só em UI (CityMap/MissionRevealModal/DayScreen/ReportSidebar/RocketBattlePanel) e testes de timeline/cerulean/vermilion/data.

- [ ] **Step 7: Commit**
```bash
git add src/engine/daySummary.ts src/game/phaseFlow.ts src/game/specialPenalties.test.ts
git commit -m "feat(special): penalidades A3 no fim do dia + razao de estrelas ignora especiais"
```

---

### Task 12: UI — ⭐ e remoção da batalha Rocket

**Files:**
- Modify: `src/components/day/CityMap.tsx:377-385`
- Modify: `src/components/day/ReportSidebar.tsx:35` + `ReportSidebar.module.css:528-601`
- Modify: `src/components/day/MissionRevealModal.tsx:24-208`
- Modify: `src/components/day/DayScreen.tsx:23-64,148-159,252-282`
- Delete: `src/components/day/RocketBattlePanel.tsx`

**Interfaces:** nenhuma nova (UI).

- [ ] **Step 1: CityMap — marcador ⭐**

Em `src/components/day/CityMap.tsx` (linhas 377-385), trocar `isRocket` por `isSpecial` via `templateId`:
```ts
      // Disponível: "!" (ou "⭐" da Missão Especial) com o anel esvaziando até expirar.
      const isSpecial = mission.templateId === 'special'
      return {
        iconClass: styles.bang,
        ringColor: 'var(--c-hud-accent)',
        content: isSpecial ? '⭐' : '!',
        fraction: timerFraction(mission, now),
        pulse: true,
        ariaLabel: isSpecial ? 'Missão Especial disponível' : 'Missão disponível',
      }
```
Remover o import órfão de `getMissionTemplate` se ele só era usado aqui — **verificar** (linha 18 e o uso em `missionReward(getMissionTemplate(...))` na linha 413 ainda exige `getMissionTemplate`; manter o import).

- [ ] **Step 2: ReportSidebar — símbolo ⭐**

Em `src/components/day/ReportSidebar.tsx` (linha 35), trocar a entrada `rocket`:
```ts
  special: { symbol: '⭐', symClass: styles.symSpecial, bubbleClass: styles.bubbleSpecial },
```
Em `src/components/day/ReportSidebar.module.css`, renomear as classes `.symRocket`→`.symSpecial` (linha 529) e `.bubbleRocket`→`.bubbleSpecial` (linhas 595, 600) e atualizar o comentário da linha 528.

- [ ] **Step 3: MissionRevealModal — remover batalha**

Em `src/components/day/MissionRevealModal.tsx`:
- Remover `onBattle?` da `Props` (linhas 28-29) e do destructuring (linha 69).
- Remover `const rocketPending = …` (linha 72).
- No `<Overlay>` (linha 115): `onClose={onClose}`.
- Remover o bloco `{settled && rocketPending && (...)}` (linhas 138-142).
- Trocar `{settled && !rocketPending && (` por `{settled && (` (linha 144).
- Trocar o `{rocketPending ? (...) : (...)}` (linhas 191-204) só pelo botão "Continuar":
```tsx
        <button type="button" className={styles.continue} onClick={onClose} disabled={!settled}>
          Continuar ▶
        </button>
```

- [ ] **Step 4: DayScreen — remover RocketBattlePanel e fluxo**

Em `src/components/day/DayScreen.tsx`:
- Remover o import `RocketBattlePanel` (linha 23).
- Em `Selection` (linhas 29-35): remover a variante `{ kind: 'rocketBattle'; id: string }`.
- Em `GuideMsgKind` (linha 46) e seu comentário (linha 44): trocar `'rocket'` por `'special'` e a descrição.
- Em `missionAnnouncement` (linhas 55-64): trocar `if (tpl.isRocket)` por `if (tpl.id === 'special')` e o texto:
```ts
  if (tpl.id === 'special')
    return { kind: 'special', text: 'Missão Especial à vista! Despache seu time para cumpri-la.' }
```
- Remover `startRocketBattle` (linhas 152-159).
- Remover o bloco `{open?.kind === 'rocketBattle' && (...)}` (linhas 258-260).
- No `<MissionRevealModal>` (linhas 275-282): remover a prop `onBattle={startRocketBattle}`.

- [ ] **Step 5: Deletar RocketBattlePanel**

Run: `git rm src/components/day/RocketBattlePanel.tsx`

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: FAIL só nos testes de dados (timeline/cerulean/vermilion/data/missions) — UI compila.

- [ ] **Step 7: Commit**
```bash
git add src/components/day/CityMap.tsx src/components/day/ReportSidebar.tsx src/components/day/ReportSidebar.module.css src/components/day/MissionRevealModal.tsx src/components/day/DayScreen.tsx
git rm src/components/day/RocketBattlePanel.tsx
git commit -m "feat(special): UI com icone estrela; remove RocketBattlePanel e fluxo de batalha"
```

---

### Task 13: Atualizar testes de dados/engine ao novo domínio

**Files:**
- Modify: `src/engine/timeline.test.ts:1-167`
- Modify: `src/data/cerulean.test.ts:1-123`
- Modify: `src/data/vermilion.test.ts:1-103`
- Modify: `src/data/data.test.ts:59-equivalente,155`
- Modify: `src/engine/missions.test.ts:6` (import)

**Interfaces:** nenhuma nova (testes).

- [ ] **Step 1: timeline.test.ts**

- Remover o import de `rocketDays` (linha 10) e a função `expectedMissionCount` (linhas 17-21); onde ela era usada (linha 65), trocar por `missionsForDay(6)`:
```ts
    expect(sched.missions).toHaveLength(missionsForDay(6))
```
- Remover o teste "missão da Equipe Rocket surge nos 2 dias semeados…" (linhas 142-160) por completo.
- O teste "áreas verdes são só captura… (freeArea)" e os demais permanecem; `buildDaySchedule` agora nunca produz `'special'` (as especiais são injetadas em `setupDay`), então pode-se adicionar um asserção: nenhuma missão de `buildDaySchedule` tem `category === 'special'`:
```ts
  it('buildDaySchedule não injeta especiais (isso é responsabilidade do setupDay)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (let day = 1; day <= TOTAL_DAYS; day++) {
        const cats = buildDaySchedule(seed, day, PEWTER).missions.map((m) => m.category)
        expect(cats).not.toContain('special')
      }
    }
  })
```

- [ ] **Step 2: cerulean.test.ts**

- Remover o import de `rocketDays` (linha 3).
- Em "todos os sítios de missão existem no grafo" (linha 59): trocar `...sn.museum` por `...sn.specialMission`.
- Em "todo sítio é alcançável…" (linha 69): trocar `...siteNodes.museum` por `...siteNodes.specialMission`.
- Substituir o teste "a Rocket tem um ÚNICO ponto (x)…" (linhas 90-108) por um que cobre só o mapeamento de sítio (sem `rocketDays`/`buildDaySchedule`):
```ts
  it('a Missão Especial tem um ÚNICO ponto (x)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['x'])
    expect(siteNodes.specialMission).toEqual(['x'])
  })
```
- O teste "'m' (antiga 2ª Rocket) virou área de exploração/captura" (linhas 110-113): manter, mas trocar `nodesForCategory(siteNodes, 'rocket')` por `'special'`.
- Remover o teste "em dias sem Rocket não há missão Rocket" (linhas 115-122).

- [ ] **Step 3: vermilion.test.ts**

Espelhar Cerulean: remover import `rocketDays` (linha 3); `...sn.museum`→`...sn.specialMission` (linha 44) e em "todo sítio…" (linha 53); substituir o teste de Rocket 2× (linhas 70-88) por:
```ts
  it('a Missão Especial tem um ÚNICO ponto (x)', () => {
    expect(nodesForCategory(siteNodes, 'special')).toEqual(['x'])
    expect(siteNodes.specialMission).toEqual(['x'])
  })
```
Ajustar "as áreas verdes … (não hospedam Rocket)" (linhas 90-93) trocando `'rocket'`→`'special'`. Remover "em dias sem Rocket…" (linhas 95-102).

- [ ] **Step 4: data.test.ts**

Trocar `...sn.museum` por `...sn.specialMission` nas duas ocorrências (na varredura de sítios das cidades, ~linha 155, e qualquer outra). Não há asserção sobre `isRocket`.

- [ ] **Step 5: missions.test.ts**

Em `src/engine/missions.test.ts` (linha 6), trocar o import `ROCKET_TEAM_TEMPLATE` por `SPECIAL_TEMPLATE` se ele for usado no arquivo; se `ROCKET_TEAM_TEMPLATE` não for referenciado no corpo, apenas remover do import. Verificar com grep antes.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS (toda a suíte). Investigar qualquer teste remanescente que referencie `rocket`/`museum`/`isRocket` e ajustá-lo no mesmo espírito.

- [ ] **Step 7: Build final**

Run: `npm run build`
Expected: PASS — sem erros de tipo, sem imports órfãos.

- [ ] **Step 8: Commit**
```bash
git add src/engine/timeline.test.ts src/data/cerulean.test.ts src/data/vermilion.test.ts src/data/data.test.ts src/engine/missions.test.ts
git commit -m "test(special): testes de dados/engine no dominio specialMission"
```

---

### Task 14: Migração de save (v34 → v35) + bump

**Files:**
- Modify: `src/engine/constants.ts:151-216` (nota + `SAVE_VERSION`)
- Modify: `src/persistence/saveLoad.ts:437-444` (nova migração antes do guard final)

**Interfaces:**
- Produces: `SAVE_VERSION = 35`.

> **Justificativa da migração:** `siteNodes` NÃO é persistido (vem de `data/cities.ts`), então o rename `museum`→`specialMission` não precisa migração de dados. **O que É persistido e precisa de saneamento:** (a) `run.specialChances` (novo campo) — inicializar `[]`; (b) instâncias de missão com `templateId === 'rocket'`, campo `mission.rocket` e status `'battle'` — limpar (descartar essas missões e liberar Pokémon presos), pois o template `'rocket'` não existe mais e o status `'battle'` saiu do tipo; (c) `run.gameOverReason === 'rocket'` — passthrough (string antiga inofensiva, mas a tela de fim já não a produz). A categoria `'rocket'` em missões antigas também é descartada junto com a limpeza de (b).

- [ ] **Step 1: Implementar a migração v34→v35**

Em `src/persistence/saveLoad.ts`, antes do guard `if (version !== SAVE_VERSION)` (linha 442), inserir:
```ts
  // v34 → v35: Missões Especiais da Cidade substituem a missão Rocket. Inicia run.specialChances
  // vazio (setupDay redimensiona ao entrar no dia); descarta missões antigas de Rocket (templateId
  // 'rocket' / status 'battle' / com mission.rocket), liberando Pokémon presos nelas.
  if (version === 34) {
    const run = state.run as Record<string, unknown> | undefined
    const missions = state.missions as Array<Record<string, unknown>> | undefined
    const stranded = Array.isArray(missions)
      ? new Set(
          missions
            .filter((m) => m.templateId === 'rocket' || m.status === 'battle' || m.rocket)
            .flatMap((m) => (m.teamIds as string[] | undefined) ?? []),
        )
      : new Set<string>()
    const roster = state.roster as Array<Record<string, unknown>> | undefined
    state = {
      ...state,
      run: run && typeof run === 'object' ? { specialChances: [], ...run } : run,
      missions: Array.isArray(missions)
        ? missions.filter((m) => !(m.templateId === 'rocket' || m.status === 'battle' || m.rocket))
        : missions,
      roster: Array.isArray(roster)
        ? roster.map((p) =>
            stranded.has(p.id as string) && p.status !== 'fainted' ? { ...p, status: 'idle' } : p,
          )
        : roster,
    } as typeof state
    version = 35
  }
```

- [ ] **Step 2: Bump + nota do schema**

Em `src/engine/constants.ts`, adicionar ao bloco de notas do `SAVE_VERSION` (após a linha 214 da v34) e trocar a versão:
```ts
 * v35: Missões Especiais da Cidade. run.specialChances (chance por local) inicia vazio
 * (setupDay redimensiona); remove a missão Rocket (templateId 'rocket', status 'battle',
 * mission.rocket) e a batalha pós-missão — a especial paga 5× XP direto. A migração descarta
 * missões Rocket antigas e libera Pokémon presos. */
export const SAVE_VERSION = 35
```

- [ ] **Step 3: Rodar testes de saveLoad + suíte**

Run: `npx vitest run src/persistence/saveLoad.test.ts`
Expected: PASS (se houver testes que validam a cadeia de migração; adicionar um caso se o arquivo de teste já cobrir bumps anteriores — espelhar o estilo existente).
Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/persistence/saveLoad.ts src/engine/constants.ts
git commit -m "feat(special): migracao v35 (specialChances; descarta missoes Rocket antigas)"
```

---

### Task 15: Feature C — skill `mapping-kanto-city-from-image` (RKT→SPEC, museum→specialMission)

**Files:**
- Modify: `.claude/skills/mapping-kanto-city-from-image/SKILL.md` (frontmatter `description` linha 3; Step 0 linha 26-27; legenda linha 94; procedimento linha 105; gotchas; checklist)
- Modify: `.claude/skills/mapping-kanto-city-from-image/template.md` (linhas 13-19, 45-50, 67-77)

**Interfaces:** nenhuma (docs/skill). Sem testes de código.

- [ ] **Step 1: SKILL.md — frontmatter**

Na linha 3 (`description`), trocar `HOUSE/CP/GRASS/RKT/MART/GYM` por `HOUSE/CP/GRASS/SPEC/MART/GYM` e `site mapping (gym/center/mart/museum/houses/green)` por `site mapping (gym/center/mart/specialMission/houses/green)`.

- [ ] **Step 2: SKILL.md — Step 0**

Na linha 27, trocar "museu de ponto único" por "specialMission de ponto(s)".

- [ ] **Step 3: SKILL.md — legenda**

Na tabela de pop-ups (linha 94), substituir a linha RKT por:
```
| SPEC | retângulo laranja + palavra "SPEC" | `specialMission` | ponto(s) — pode haver mais de um (ex.: Celadon com 2), cada um com seu nó |
```

- [ ] **Step 4: SKILL.md — procedimento, gotchas e Step 0 do mapeamento de sítios**

- Linha 3 do procedimento de leitura (linha 105, "pop-ups (palavra + ponto…)"): nenhuma troca de termo necessária, mas garantir que não restou "museum".
- Onde aparecer `museum` / `RKT` / "Equipe Rocket" no corpo (Step 0, gotchas, "Depois da estrutura"), trocar por `specialMission` / `SPEC` / "Missão Especial".

- [ ] **Step 5: template.md**

- Linha 13-19 ("Pop-ups"): trocar `RKT→museum (convenção viva — hoje ponto único)` por `SPEC→specialMission (um nó por local; pode haver >1)`.
- Linha 19: a lista de `kind` deve trocar `museum` por `specialMission`.
- Skeleton (linhas 45-50): trocar `museum: [/* ponto(s) RKT … */]` por `specialMission: [/* ponto(s) SPEC */]`.
- Checklist (linha 76): trocar "Rocket: `nodesForCategory(siteNodes, 'rocket')` bate com o `museum` vivo" por "Missão Especial: `nodesForCategory(siteNodes, 'special')` bate com o `specialMission` vivo".

- [ ] **Step 6: Verificação por leitura (read-back)**

Run: `git diff --stat .claude/skills/mapping-kanto-city-from-image`
Confirmar que não resta nenhuma ocorrência de `RKT`, `museum` ou `Equipe Rocket` nos dois arquivos da skill:
Run: `npx vitest run` (sanidade geral — a skill não tem testes, mas garante que nada do repo quebrou).
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add .claude/skills/mapping-kanto-city-from-image/SKILL.md .claude/skills/mapping-kanto-city-from-image/template.md
git commit -m "docs(skill): mapping-kanto-city-from-image usa SPEC/specialMission (RKT->SPEC)"
```

---

### Task 16: Verificação final

**Files:** nenhum (validação).

- [ ] **Step 1: Build + suíte completa**

Run: `npm run build`
Expected: sem erros de tipo.
Run: `npx vitest run`
Expected: toda a suíte verde.

- [ ] **Step 2: Varredura de resíduos**

Run (Grep): procurar por `isRocket`, `RocketBattle`, `rocketDays`, `loseRunByRocket`, `ROCKET_DAY`, `ROCKET_MISSIONS`, `ROCKET_GOLD`, `ROCKET_XP`, `RESOLVE_ROCKET`, `COMPLETE_ROCKET`, `'battle'` (status), `.museum`, `'rocket'` (categoria) em `src/`.
Expected: zero ocorrências em código de produção (exceto `ROCKET_TRAINER_IDS`/`RocketTrainerId`/elenco Rocket, que PERMANECEM para a Feature B). Quaisquer sobras → corrigir e commitar.

- [ ] **Step 3: Conferência leve (opcional, sem screenshot)**

Conforme preferência registrada (evitar screenshots/preview): se desejado, inspecionar via DOM leve que o marcador da especial mostra ⭐ e que não há painel de batalha. Caso contrário, prosseguir.

- [ ] **Step 4: Commit final (se houver resíduos corrigidos)**
```bash
git add -A
git commit -m "chore(special): varredura final de residuos Rocket"
```

---

## Self-Review

### Cobertura da spec → task

| Item da spec | Task(s) |
|---|---|
| Rename `CitySiteNodes.museum`→`specialMission` (types.ts + todas as cidades + nodesByKind/nodesForCategory) | 1, 2 |
| Rename `SiteKind` `'museum'`→`'specialMission'`; `MissionCategory` `'rocket'`→`'special'`; `CATEGORY_SITE` | 1 |
| Rename template id `'rocket'`→`'special'`, name `'Equipe Rocket'`→`'Missão Especial'`, themeIcon `'R'`→`'⭐'`; `templatesForCategory`/`missionReward` | 3 |
| Novas constantes `SPECIAL_CHANCE_START/GROWTH_MIN/GROWTH_MAX/MAX`, `SPECIAL_XP_MULTIPLIER`; remoção das constantes Rocket | 4 |
| `run.specialChances: number[]` + init `[]` + redimensionamento por cidade | 5, 8 |
| saveLoad migração + bump de versão | 14 |
| timeline: remover `rocketDays` + injeção; rolagem por local; reset/crescimento; manter `buildDaySchedule` puro; mutação no abrir do dia (setupDay) | 6, 8 |
| missionFlow: especial paga 5× XP direto; remover `setupRocketBattle`/`resolveRocketBattle`/`completeRocketBattle`/`loseRunByRocket`/ramo `isRocket`/status `'battle'` | 5, 7 |
| dayClock: remover game-over por expiração Rocket | 9 |
| reducer/actions: remover `RESOLVE_ROCKET_BATTLE`/`COMPLETE_ROCKET_BATTLE` | 10 |
| Penalidades A3 (zera/−1, piso 0, sem game over) | 11 |
| A4: especial fora da razão de estrelas mas dentro de stats/MVP/XP (total exibição × razão) | 11 |
| UI ⭐ em dispatch/reveal/map/report; remover copy de batalha; remover RocketBattlePanel | 12 |
| Feature C: SKILL.md/template.md RKT→SPEC, museum→specialMission, description frontmatter | 15 |
| Testes (repurpose rocketFlow.test.ts; timeline/cerulean/vermilion/data) | 6, 7, 11, 13 |
| Verificação final | 16 |

Nota sobre A4 (estatísticas/MVP): `daySummary.buildDaySummary` mantém `missionsCompleted`/`missionsTotal` contando TUDO (inclui especiais) → o MVP (`computeMvp` sobre `missionResults`) e o XP (`today.xpEarned`) já incluem a especial naturalmente. A separação afeta **apenas** a razão de estrelas, feita no `phaseFlow` filtrando `templateId !== 'special'` (Task 11). Não foi preciso tocar `approval.ts` (sua assinatura recebe os totais já filtrados).

### Placeholder scan

Varredura do plano por "TBD"/"similar to"/"add error handling"/reticências de código: nenhuma encontrada. Todo step de código traz código real. Os únicos pontos com "verificar" são checagens de imports órfãos (consequência de `noUnusedLocals`), com a instrução explícita de usar `npm run build` para apontá-los — não são código incompleto.

### Type-consistency note

Nomes consistentes entre tasks: `SPECIAL_TEMPLATE` (Task 3) é o id `'special'` referenciado em `templatesForCategory` (3), `setupDay` (8), `resolveMissionNow` (7), CityMap/DayScreen (12), testes (6/11/13). `rollSpecialMissions`/`SpecialRoll` (Task 6) consumidos em `setupDay` (8) e testados em `specialChances.test.ts` (6). `run.specialChances` (Task 5) inicializado em `createInitialState` (5), redimensionado/mutado em `setupDay` (8), migrado em saveLoad (14). `DaySummary.specialAttempted/specialCompleted` (Task 11) são adições aditivas (não quebram consumidores). `applyForewarn`/`lifetimeMs` em setup usam `templateId === 'special'` consistente com a injeção. `gameOverReason` perde `'rocket'` (Task 5) e nenhum produtor remanescente o emite (dayClock/phaseFlow ajustados em 9/11).

### Riscos / ambiguidades registrados

1. **Onde mutar `run.specialChances` dado o timeline puro/semeado:** resolvido pondo a rolagem em `setupDay` (tem `GameState`), via `takeRng(s)`. `buildDaySchedule` segue puro. Risco: `takeRng` avança o `rngCursor` — outros consumidores do mesmo dia (clima/dig) usam sub-seeds derivados de `(seed, salt, dia)` e NÃO `takeRng`, então não há colisão de cursor; ainda assim, posicionar a chamada de `takeRng` de forma estável dentro de `setupDay` (sempre executada, mesmo com 0 locais — `rollSpecialMissions([])` consome 0 do rng pois o `.map` sobre lista vazia não chama `rng.bool`) **muda o cursor de modo determinístico**. Confirmar que `setupDay` é a única coisa que avança o cursor antes do tick do dia.
2. **`rollSpecialMissions` com lista vazia não consome RNG** — bom para determinismo, mas significa que cidades sem locais especiais não gastam cursor; ok.
3. **Exclusão da razão de estrelas vs. dupla punição:** a penalidade A3 sobrescreve `missionStars` DEPOIS do delta normal. No caso "expirou", zera independentemente do desempenho normal (spec explícita). No caso "falhou despachada", subtrai 1 cheia do valor pós-normal com piso 0 (via `applyDomainStars(-STARS_STEP*2)`). Risco: se o jogador tinha 0 estrelas normais e a normal já o salvou do game-over, a penalidade pode levar a 0 — mas **sem** disparar game-over (a checagem de game-over já passou). Isso é o comportamento desejado pela spec ("nunca dispara game over").
4. **Detecção "expirou sem dispatch" via `teamIds.length === 0 && !success`:** `expireMission` empurra `{ teamIds: [] }`, e uma especial despachada-e-falha tem `teamIds.length > 0`. Caso-limite: especial despachada que falha e cujo `freeOnReturn` reusa o mesmo `missionResults` — confirmado que só há UM push por missão (em `resolveMissionNow` ou `expireMission`). Não há push duplicado.
5. **`MISSION_LIFETIME_MS` vs `DEFENSE_LIFETIME_MS` para a especial:** mantido o timer longo (`DEFENSE_LIFETIME_MS`) como o Rocket tinha, dando janela de reação. Não está cravado na spec; decisão registrada (reuso do comportamento anterior).
6. **`autoSeedRun` em `specialPenalties.test.ts`:** usa o bootstrap headless; se ele não preencher `specialChances`, tudo bem — o teste seta `missionResults` direto e chama `finalizeDay`, que não toca `specialChances`. Sem risco.
7. **`daySummary.test.ts` pode comparar o objeto completo de `DaySummary`** — os novos campos `specialAttempted/specialCompleted` podem quebrar um `toEqual` exato. Task 11 Step 5 prevê ajustar.
