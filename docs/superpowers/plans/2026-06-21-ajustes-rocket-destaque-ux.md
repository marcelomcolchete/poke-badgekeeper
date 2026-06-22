# Ajustes de UX — Rocket, Destaque, Forecast e regras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 8 ajustes independentes de UX e regras (som/painel da Rocket, derrotas da Rocket no Destaque, nomes das habilidades secretas, ginásio indefendido, XP de exploração, cor/legibilidade do forecast e a escolha de habilidade no quadro do Destaque).

**Architecture:** Engine pura em `src/engine` (lógica/determinística, testada com Vitest); efeitos (som, RNG, React) em `src/game`, `src/audio` e `src/components`. Cada item é autônomo; cada task termina com um deliverable testável.

**Tech Stack:** TypeScript, React, CSS Modules, Vitest. Build via `npm run build` (tsc -b solution). Testes via `npx vitest run <arquivo>`.

## Global Constraints

- Build/tipos: usar `npm run build` (tsc -b), NUNCA `tsc --noEmit` (o tsconfig raiz é solution-only).
- Verificação: preferir testes Vitest + asserções leves; evitar screenshots/preview salvo se pedido.
- Gen 1 dataset; CSV de balanceamento é a fonte de verdade (não afetado aqui).
- Estrelas: `STARS_MIN = 0`, `STARS_MAX = 5`, `STARS_STEP = 0.5`. "1 estrela cheia" = `STARS_STEP * 2`.
- Som de "novo evento" reutilizado: `playSound('missionNew')`.
- Commits frequentes, um por task (mensagem em pt-BR, padrão `feat(...)`/`fix(...)`).
- Branch: `feat/ajustes-rocket-destaque-ux` (já criado a partir de `main`).

---

### Task 1: Item 4 — Nomes das habilidades secretas (sem "???")

**Files:**
- Modify: `src/components/day/MemberDetail.tsx:125`

**Interfaces:**
- Consumes: `kind.name` (já no escopo, de `SECRET_KINDS[id]`).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Trocar o placeholder pelo nome**

Em `src/components/day/MemberDetail.tsx`, na linha 125, trocar:

```tsx
{unlocked ? `${kind.name}${level === 2 ? '+' : ''}` : '? ? ?'}
```

por:

```tsx
{unlocked ? `${kind.name}${level === 2 ? '+' : ''}` : kind.name}
```

(O resto do tratamento "bloqueada" — medalha 🔒, sem cor de medalha, texto "Desbloqueie sendo o Destaque do Dia." — fica intacto; só o nome deixa de ser escondido.)

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK (sem erros de tipo).

- [ ] **Step 3: Commit**

```bash
git add src/components/day/MemberDetail.tsx
git commit -m "feat(secret): exibe o nome das duas habilidades secretas (sem ???)"
```

---

### Task 2: Item 1 — Som quando a Rocket aparece

**Files:**
- Modify: `src/audio/useGameSounds.ts`

**Interfaces:**
- Consumes: `state.theft` (`{ phase: 'armed'|'fleeing'|'atFarNode'|'battle'|'resolved' }`), `playSound('missionNew')`.
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Declarar o ref de anúncio**

Em `src/audio/useGameSounds.ts`, junto aos outros refs (após `const theftWarned = useRef(false)`, linha ~44), adicionar:

```ts
  const theftAnnounced = useRef(false)
```

- [ ] **Step 2: Tocar o som ao surgir a perseguição e rearmar ao encerrar**

No mesmo arquivo, logo ANTES do bloco `// 7) Roubo Rocket chegou ao nó mais distante...` (linha ~111), inserir:

```ts
    // 6b) Rocket apareceu (virou perseguível): toca o MESMO som de missão nova, uma vez.
    if (!first && state.theft?.phase === 'fleeing' && !theftAnnounced.current) {
      theftAnnounced.current = true
      playSound('missionNew')
    }
    if (!state.theft || state.theft.phase === 'resolved') {
      theftAnnounced.current = false
    }
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/audio/useGameSounds.ts
git commit -m "feat(rocket): toca som de novo evento quando a Rocket aparece"
```

---

### Task 3: Item 3 — Derrotas da Rocket contam pro Destaque do Dia

**Files:**
- Modify: `src/game/theftFlow.ts` (dentro de `completeTheftBattle`, ramo vitória, ~linha 320-334)
- Modify: `src/components/screens/SummaryScreen.tsx` (rótulo do feito, ~linha 352)
- Test: `src/game/theftFlow.test.ts`

**Interfaces:**
- Consumes: `theft.duels` (`{ youWon: boolean; yourId: string }[]`), `theft.enemies` (`EnemyUnit[]` com `battle`, `speciesId?`, `medal?`, `types?`), `s.today.defenseKills`.
- Produces: entradas em `s.today.defenseKills` provenientes de vitórias da Rocket → consumidas por `computeMvp` e pelas miniaturas do `MvpSquare` (já existentes).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `src/game/theftFlow.test.ts` um teste que monta um `theft` resolvido com vitória e verifica que cada duelo vencido virou um `defenseKills`. Modelo (ajustar imports já presentes no arquivo; usar `createInitialState`):

```ts
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { completeTheftBattle } from './theftFlow.ts'

describe('completeTheftBattle — derrotas da Rocket no Destaque', () => {
  it('registra um defenseKill por duelo vencido (defeaterId + speciesId)', () => {
    const s = createInitialState(1)
    s.theft = {
      phase: 'battle',
      won: true,
      resolved: true,
      trainerId: 'ROCKET',
      stolenId: undefined,
      chaserIds: ['a', 'b'],
      chaserArriveAtMs: [],
      chaserStartAtMs: [],
      targetNode: 'g',
      enemies: [
        { battle: 10, speciesId: 19, types: ['normal'] },
        { battle: 12, speciesId: 16, types: ['normal'] },
      ],
      duels: [
        { yourId: 'a', youWon: true },
        { yourId: 'b', youWon: true },
      ],
      xpSeed: 1,
    } as unknown as typeof s.theft

    completeTheftBattle(s)

    expect(s.today.defenseKills).toHaveLength(2)
    expect(s.today.defenseKills[0]).toMatchObject({ defeaterId: 'a', speciesId: 19 })
    expect(s.today.defenseKills[1]).toMatchObject({ defeaterId: 'b', speciesId: 16 })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npx vitest run src/game/theftFlow.test.ts`
Expected: FAIL no novo teste (`defenseKills` vazio — `toHaveLength(2)` falha).

- [ ] **Step 3: Registrar os kills no ramo de vitória**

Em `src/game/theftFlow.ts`, dentro de `completeTheftBattle`, no bloco `if (theft.won && theft.duels) { ... }`, dentro do `if (enemy) {`, adicionar o push espelhando o `assignDefense`:

```ts
      if (enemy) {
        const base = gymWinXp(enemy.battle) * THEFT_XP_MULTIPLIER
        xpById.set(duel.yourId, (xpById.get(duel.yourId) ?? 0) + base)
        // Conta a vitória contra a Rocket como "derrotado" do dia (Destaque + miniaturas).
        s.today.defenseKills.push({
          defeaterId: duel.yourId,
          speciesId: enemy.speciesId,
          enemyBattle: enemy.battle,
          enemyMedal: enemy.medal,
          enemyTypes: enemy.types,
        })
      }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/game/theftFlow.test.ts`
Expected: PASS.

- [ ] **Step 5: Ajustar o rótulo no resumo (genérico)**

Em `src/components/screens/SummaryScreen.tsx`, no `MvpSquare`, trocar o texto do feito de derrotas (~linha 352):

```tsx
          <b>{defeats}</b> {defeats === 1 ? 'derrotado na defesa' : 'derrotados na defesa'}
```

por:

```tsx
          <b>{defeats}</b> {defeats === 1 ? 'derrotado' : 'derrotados'}
```

- [ ] **Step 6: Verificar build + commit**

Run: `npm run build`
Expected: build OK.

```bash
git add src/game/theftFlow.ts src/game/theftFlow.test.ts src/components/screens/SummaryScreen.tsx
git commit -m "feat(rocket): derrotas da Rocket contam como derrotados do Destaque do Dia"
```

---

### Task 4: Item 5 — Ginásio indefendido tira 1 estrela (0 = game over)

**Files:**
- Modify: `src/game/defenseFlow.ts` (renomear e reescrever `loseRunByUndefendedGym`)
- Modify: `src/game/dayClock.ts:10` (import) e `:90` (chamada)
- Test: `src/game/defenseFlow.test.ts`

**Interfaces:**
- Consumes: `applyDomainStars(stars, delta)` (de `engine/approval.ts`), `STARS_MIN`, `STARS_STEP` (de `engine/constants.ts`), `s.approval.battleStars`, `s.today.defensesTotal`.
- Produces: `penalizeUndefendedGym(s: GameState): void` (substitui `loseRunByUndefendedGym`).

- [ ] **Step 1: Reescrever o teste (define o novo comportamento)**

Em `src/game/defenseFlow.test.ts`, substituir o `describe('loseRunByUndefendedGym', ...)` (linhas 9-19) por:

```ts
import { STARS_STEP } from '../engine/constants.ts'
// ...mantém os imports existentes, trocando loseRunByUndefendedGym por penalizeUndefendedGym
import { assignDefense, penalizeUndefendedGym } from './defenseFlow.ts'

describe('penalizeUndefendedGym', () => {
  it('tira 1 estrela cheia, exclui a defesa do ratio e NÃO encerra a run se sobrar estrela', () => {
    const s = createInitialState(1)
    s.approval.battleStars = 5
    s.today.defensesTotal = 2
    s.clock.speed = 1
    penalizeUndefendedGym(s)
    expect(s.approval.battleStars).toBe(4)
    expect(s.today.defensesTotal).toBe(1)
    expect(s.run.phase).not.toBe('GAMEOVER')
    expect(s.clock.speed).toBe(1)
  })

  it('chegar a 0 estrelas encerra a run com motivo gym e congela o relógio', () => {
    const s = createInitialState(1)
    s.approval.battleStars = STARS_STEP * 2 // exatamente 1 estrela cheia
    s.today.defensesTotal = 1
    s.clock.speed = 1
    penalizeUndefendedGym(s)
    expect(s.approval.battleStars).toBe(0)
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.run.gameOverReason).toBe('gym')
    expect(s.clock.speed).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/game/defenseFlow.test.ts`
Expected: FAIL (`penalizeUndefendedGym` não existe / import quebrado).

- [ ] **Step 3: Reescrever a função na engine de fluxo**

Em `src/game/defenseFlow.ts`, adicionar os imports no topo (junto aos demais imports de `../engine`):

```ts
import { applyDomainStars } from '../engine/approval.ts'
import { STARS_MIN, STARS_STEP } from '../engine/constants.ts'
```

Substituir o bloco `loseRunByUndefendedGym` (linhas 28-38) por:

```ts
/**
 * Ginásio indefendido (o timer de uma defesa ATIVA zerou sem ninguém lutar): tira 1 estrela
 * cheia de batalha (piso 0) e NÃO conta essa defesa no ratio do dia — a punição já é o −1
 * aqui, sem dupla punição no fim do dia. Só encerra a run se as estrelas chegarem a 0.
 */
export function penalizeUndefendedGym(s: GameState): void {
  s.today.defensesTotal = Math.max(0, s.today.defensesTotal - 1)
  s.approval.battleStars = applyDomainStars(s.approval.battleStars, -STARS_STEP * 2)
  if (s.approval.battleStars <= STARS_MIN) {
    s.run.phase = 'GAMEOVER'
    s.run.gameOverReason = 'gym'
    s.clock.speed = 0
  }
}
```

- [ ] **Step 4: Atualizar o call site no relógio do dia**

Em `src/game/dayClock.ts`:
- Linha 10: trocar o import `loseRunByUndefendedGym` por `penalizeUndefendedGym`:

```ts
import { expireDefense, penalizeUndefendedGym, spawnDefense } from './defenseFlow.ts'
```

- Linha 90: trocar a chamada:

```ts
      if (wasActive) penalizeUndefendedGym(s)
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/game/defenseFlow.test.ts`
Expected: PASS.

- [ ] **Step 6: Verificar build + suíte de fluxo (regressão do relógio/fim de jogo)**

Run: `npm run build`
Expected: build OK (nenhuma outra referência a `loseRunByUndefendedGym`).

Run: `npx vitest run src/game/dayClock.test.ts`
Expected: PASS (se o arquivo existir; se não, ignorar).

- [ ] **Step 7: Commit**

```bash
git add src/game/defenseFlow.ts src/game/dayClock.ts src/game/defenseFlow.test.ts
git commit -m "feat(gym): ginasio indefendido tira 1 estrela (0 = game over) em vez de derrota imediata"
```

---

### Task 5: Item 6 — Exploração dá 100 XP ao explorador (ao concluir)

**Files:**
- Modify: `src/engine/balance.ts` (constante `EXPLORATION_XP`)
- Modify: `src/game/captureFlow.ts` (`capturePick`, `captureDismiss`, helper)
- Test: `src/game/captureXp.test.ts` (criar)

**Interfaces:**
- Consumes: `applyXpGains(s, Map<string, number>, rng)` (de `./itemFlow.ts`), `takeRng(s)` (de `./runtime.ts`, já importado), `s.today.xpEarned`.
- Produces: `EXPLORATION_XP` (number, exportado de `engine/balance.ts`); XP de 100 aplicado ao `searcherId` ao concluir captura OU recusa.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/game/captureXp.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { makeMon } from '../engine/testkit.ts'
import { capturePick, captureDismiss } from './captureFlow.ts'
import { EXPLORATION_XP } from '../engine/balance.ts'

function withEncounter() {
  const s = createInitialState(1)
  const searcher = makeMon({ id: 's1' })
  s.roster = [searcher]
  s.encounters = [
    {
      searcherId: 's1',
      spotIndex: 0,
      level: 3,
      candidateSpeciesIds: [19],
      candidateLevels: [3],
      candidateSeeds: [1],
      candidateShiny: [false],
      searcherPerception: 0,
    },
  ] as unknown as typeof s.encounters
  return s
}

describe('exploração dá XP ao explorador (item 6)', () => {
  it('recusar (captureDismiss) credita 100 XP ao explorador', () => {
    const s = withEncounter()
    s.today.xpEarned = 0
    captureDismiss(s, 's1')
    expect(s.today.xpEarned).toBe(EXPLORATION_XP)
  })

  it('capturar (capturePick) credita 100 XP ao explorador', () => {
    const s = withEncounter()
    s.today.xpEarned = 0
    capturePick(s, 's1', 0)
    expect(s.today.xpEarned).toBe(EXPLORATION_XP)
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/game/captureXp.test.ts`
Expected: FAIL (`EXPLORATION_XP` não existe / `xpEarned` não muda).

- [ ] **Step 3: Adicionar a constante de balanceamento**

Em `src/engine/balance.ts`, logo após `export const MISSION_XP_POOL = 240` (linha 159), adicionar:

```ts
/** XP fixo concedido ao explorador ao concluir uma exploração (capturando OU recusando). */
export const EXPLORATION_XP = 100
```

- [ ] **Step 4: Aplicar o XP nas duas conclusões**

Em `src/game/captureFlow.ts`:

Adicionar o import de `applyXpGains` (junto ao import de `./runtime.ts`):

```ts
import { applyXpGains } from './itemFlow.ts'
import { EXPLORATION_XP } from '../engine/balance.ts'
```

Adicionar o helper (perto do topo, após os imports):

```ts
/** Concede o XP de exploração ao explorador e contabiliza no total do dia. */
function awardExplorationXp(s: GameState, searcherId: string): void {
  applyXpGains(s, new Map([[searcherId, EXPLORATION_XP]]), takeRng(s))
  s.today.xpEarned += EXPLORATION_XP
}
```

Em `capturePick`, ao FINAL da função (logo após `consumeSpot(s, encounter.spotIndex)`):

```ts
  awardExplorationXp(s, searcherId)
```

Em `captureDismiss`, ao FINAL da função (após `consumeSpot(s, encounter.spotIndex)`):

```ts
  awardExplorationXp(s, searcherId)
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/game/captureXp.test.ts`
Expected: PASS.

- [ ] **Step 6: Verificar regressões de captura (RNG/shiny/surf/clima)**

Run: `npx vitest run src/game/captureShiny.test.ts src/game/captureSurf.test.ts src/game/captureWeather.test.ts`
Expected: PASS (o XP é creditado depois da criação do capturado; se algum teste fixar o cursor de RNG pós-captura, ajustar conforme a falha).

- [ ] **Step 7: Build + commit**

Run: `npm run build`
Expected: build OK.

```bash
git add src/engine/balance.ts src/game/captureFlow.ts src/game/captureXp.test.ts
git commit -m "feat(captura): exploracao concede 100 XP ao explorador ao concluir"
```

---

### Task 6: Item 7 — Forecast da Rocket: rampa azul→vermelho + chip legível

**Files:**
- Modify: `src/engine/theft.ts` (rampa de 5 paradas + `ink`)
- Test: `src/engine/theft.test.ts`
- Modify: `src/components/screens/DayForecastPanel.tsx` (~linhas 116-126)
- Modify: `src/components/screens/DayForecastPanel.module.css` (`.rocketValue` → `.rocketChip`)

**Interfaces:**
- Consumes: `clamp`, `lerp` (de `./math.ts`), já importados.
- Produces: `theftChanceLabel(percent): { label: string; color: string; ink: string }` (acrescenta `ink`).

- [ ] **Step 1: Atualizar os testes (definem a rampa e a tinta)**

Em `src/engine/theft.test.ts`, substituir o teste `it('verde no piso, vermelho no teto (interpola)', ...)` (linhas 39-42) por:

```ts
  it('azul no piso, vermelho no teto (rampa 5 paradas)', () => {
    expect(theftChanceLabel(1).color).toBe('#3b82f6') // azul
    expect(theftChanceLabel(100).color).toBe('#e23b3b') // vermelho
  })
  it('tinta legível por luminância (meio claro → tinta escura; teto → tinta clara)', () => {
    expect(theftChanceLabel(100).ink).toBe('#ffffff')
    expect(theftChanceLabel(50).ink).toBe('#1a1a1a')
  })
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/engine/theft.test.ts`
Expected: FAIL (cor do piso ainda é verde; `ink` indefinido).

- [ ] **Step 3: Implementar a rampa e a tinta**

Em `src/engine/theft.ts`, substituir o bloco a partir do comentário `/** Componente RGB interpolado verde→vermelho ... */` e a função `theftChanceLabel` (linhas 35-54) por:

```ts
/** Componente RGB em hex de 2 dígitos. */
function hex2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
}

/** Rampa de 5 paradas: azul → verde → amarelo → laranja → vermelho. */
const THEFT_RAMP: readonly (readonly [number, number, number])[] = [
  [59, 130, 246], // azul    #3b82f6
  [46, 193, 106], // verde   #2ec16a
  [242, 198, 60], // amarelo #f2c63c
  [239, 140, 52], // laranja #ef8c34
  [226, 59, 59], // vermelho #e23b3b
]

/** Cor da rampa em t∈[0,1] (interpola entre as paradas adjacentes). */
function rampColor(t: number): [number, number, number] {
  const ct = clamp(t, 0, 1)
  const segs = THEFT_RAMP.length - 1
  const scaled = ct * segs
  const i = Math.min(Math.floor(scaled), segs - 1)
  const f = scaled - i
  const a = THEFT_RAMP[i]!
  const b = THEFT_RAMP[i + 1]!
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]
}

/** Tinta legível (escura/clara) pela luminância relativa da cor de fundo. */
function inkFor(r: number, g: number, b: number): string {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1a1a1a' : '#ffffff'
}

/**
 * Rótulo + cor + tinta da chance de roubo (B9): palavra por bucket e cor que percorre a rampa
 * azul→vermelho por (percent-1)/99. A tinta acompanha a luminância para o chip ficar legível.
 */
export function theftChanceLabel(percent: number): { label: string; color: string; ink: string } {
  const p = clamp(percent, 0, 100)
  const bucket = THEFT_LABEL_BUCKETS.find((b) => p <= b.upTo) ?? THEFT_LABEL_BUCKETS[THEFT_LABEL_BUCKETS.length - 1]!
  const t = p <= 1 ? 0 : p >= 100 ? 1 : (p - 1) / 99
  const [r, g, b] = rampColor(t)
  return { label: bucket.label, color: `#${hex2(r)}${hex2(g)}${hex2(b)}`, ink: inkFor(r, g, b) }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/engine/theft.test.ts`
Expected: PASS (incluindo os buckets já existentes, inalterados).

- [ ] **Step 5: Renderizar a palavra como chip colorido**

Em `src/components/screens/DayForecastPanel.tsx`, substituir o `<span>` do valor da Rocket (linhas 118-124) por:

```tsx
          <span
            className={styles.rocketChip}
            style={{ backgroundColor: theft.color, color: theft.ink }}
            title={`Chance de roubo hoje: ${state.run.theftChance}%`}
          >
            {theft.label}
          </span>
```

- [ ] **Step 6: Estilizar o chip (substitui `.rocketValue`)**

Em `src/components/screens/DayForecastPanel.module.css`, substituir o bloco `.rocketValue` (linhas 104-110) por:

```css
/* Palavra da Chance de Rocket como chip colorido (cor de fundo + tinta vêm do inline). */
.rocketChip {
  display: inline-block;
  max-width: 100%;
  font-family: var(--font-text);
  font-size: 12px;
  font-weight: bold;
  line-height: 1.15;
  text-align: center;
  padding: 4px 8px;
  border-radius: 999px;
  border: 2px solid rgba(0, 0, 0, 0.2);
}
```

- [ ] **Step 7: Build + commit**

Run: `npm run build`
Expected: build OK.

```bash
git add src/engine/theft.ts src/engine/theft.test.ts src/components/screens/DayForecastPanel.tsx src/components/screens/DayForecastPanel.module.css
git commit -m "feat(forecast): chance de Rocket em rampa azul->vermelho e chip legivel"
```

---

### Task 7: Item 2 — Painel da Rocket com layout de missão + R vermelho

**Files:**
- Modify: `src/components/day/TheftChasePanel.tsx`
- Modify: `src/components/day/Panels.module.css` (adicionar `.rocketEmblem`)

**Interfaces:**
- Consumes: classes existentes de `Panels.module.css` (`.dispatch`, `.radarSide`, `.missionReward`, `.stats`, `.selectedTeam`, `.selectedTitle`, `.chipList`, `.chip`, `.chipSprite`, `.chipName`, `.chipRemove`, `.picker`, `.confirm`), `THEFT_CHASERS_MAX`, `sortRoster`, `isAvailable`, `PokemonCard`, `Overlay`, `pokemonSpritePath`/`getSpecies` para os chips.
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Reescrever o componente com o grid de despacho**

Substituir todo o `src/components/day/TheftChasePanel.tsx` por:

```tsx
// Painel de perseguição (Feature B): escolhe até 3 Pokémon idle para ir atrás da Rocket. Reusa o
// layout do despacho de missão (grid radarSide + picker), com um R vermelho no lugar do radar.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { Pokemon } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { isAvailable, sortRoster } from '../../engine/roster.ts'
import { THEFT_CHASERS_MAX } from '../../engine/balance.ts'
import { getSpecies, pokemonSpritePath } from '../../data/pokemon/index.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

function monName(mon: Pokemon): string {
  return mon.nickname ?? getSpecies(mon.speciesId).displayName
}

export function TheftChasePanel({ state, dispatch, onClose }: Props) {
  const theft = state.theft
  const [picked, setPicked] = useState<string[]>([])
  if (!theft || (theft.phase !== 'fleeing' && theft.phase !== 'atFarNode')) return null

  const team: Pokemon[] = picked
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const toggle = (id: string): void =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < THEFT_CHASERS_MAX ? [...cur, id] : cur,
    )
  const remove = (id: string): void => setPicked((cur) => cur.filter((x) => x !== id))

  return (
    <Overlay title="EQUIPE ROCKET — PERSEGUIÇÃO" onClose={onClose} wide>
      <div className={styles.dispatch}>
        <div className={styles.radarSide}>
          <div className={styles.rocketEmblem} aria-hidden="true">R</div>
          <p className={styles.missionReward}>
            <span aria-hidden="true">⚔️</span> Recompensa: 3× XP no resgate
          </p>
          <div className={styles.stats}>
            <span>
              Perseguidores: <b>{picked.length}/{THEFT_CHASERS_MAX}</b>
            </span>
            <span>O relógio continua correndo!</span>
          </div>
          <div className={styles.selectedTeam}>
            <span className={styles.selectedTitle}>Selecionados ({picked.length}/{THEFT_CHASERS_MAX})</span>
            {team.length === 0 ? (
              <span className={styles.selectedEmpty}>Escolha até {THEFT_CHASERS_MAX} Pokémon idle ao lado.</span>
            ) : (
              <ul className={styles.chipList}>
                {team.map((mon) => (
                  <li key={mon.id} className={styles.chip}>
                    <img className={styles.chipSprite} src={pokemonSpritePath(mon)} alt="" draggable={false} />
                    <span className={styles.chipName}>{monName(mon)}</span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => remove(mon.id)}
                      aria-label={`Remover ${monName(mon)} da perseguição`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={styles.picker}>
          {sortRoster(state.roster).map((mon) => (
            <PokemonCard
              key={mon.id}
              pokemon={mon}
              selected={picked.includes(mon.id)}
              toggle
              disabled={!isAvailable(mon) || mon.status !== 'idle'}
              onClick={isAvailable(mon) && mon.status === 'idle' ? () => toggle(mon.id) : undefined}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className={styles.confirm}
        disabled={picked.length === 0}
        onClick={() => {
          dispatch({ type: 'DISPATCH_THEFT_CHASERS', chaserIds: picked })
          onClose()
        }}
      >
        Perseguir ▶ ({picked.length})
      </button>
    </Overlay>
  )
}
```

- [ ] **Step 2: Adicionar o estilo do emblema R**

Em `src/components/day/Panels.module.css`, ao final do arquivo, adicionar:

```css
/* Emblema "R" da Equipe Rocket (no lugar do radar, no painel de perseguição). */
.rocketEmblem {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 150px;
  font-family: var(--font-pixel);
  font-size: 96px;
  line-height: 1;
  color: #e23b3b;
  background: var(--c-panel);
  border: 3px solid var(--c-panel-border);
  border-radius: var(--radius-pixel);
  text-shadow:
    0 0 6px rgba(226, 59, 59, 0.7),
    0 0 18px rgba(226, 59, 59, 0.45);
  animation: rocketEmblemPulse 1.3s ease-in-out infinite;
}

@keyframes rocketEmblemPulse {
  0%, 100% { text-shadow: 0 0 6px rgba(226, 59, 59, 0.55), 0 0 14px rgba(226, 59, 59, 0.3); }
  50% { text-shadow: 0 0 10px rgba(226, 59, 59, 0.9), 0 0 26px rgba(226, 59, 59, 0.6); }
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build OK (sem imports não usados; `Pokemon` e `pokemonSpritePath` são usados).

- [ ] **Step 4: Verificar regressão de testes que renderizam o painel (se houver)**

Run: `npx vitest run src/components`
Expected: PASS (ou "no tests" — o painel não tem teste dedicado; o build é a checagem principal).

- [ ] **Step 5: Commit**

```bash
git add src/components/day/TheftChasePanel.tsx src/components/day/Panels.module.css
git commit -m "feat(rocket): painel de perseguicao no layout de missao com R vermelho brilhante"
```

---

### Task 8: Item 8 — Escolha de habilidade dentro do quadro Destaque + brilho

**Files:**
- Modify: `src/components/screens/SummaryScreen.tsx`
- Modify: `src/components/screens/SummaryScreen.module.css`

**Interfaces:**
- Consumes: `state.today.secretChoice` (`{ pokemonId: string }`), `secretLineFor`, `SECRET_KINDS`, `dispatch({ type: 'CHOOSE_SECRET', slot, level })`, `mvp` do `MvpSquare`.
- Produces: componente interno `SecretChoiceButtons` (reusado dentro do `MvpSquare` e no fallback).

- [ ] **Step 1: Extrair os botões de escolha em um componente reutilizável**

Em `src/components/screens/SummaryScreen.tsx`, adicionar (perto de `MvpSquare`, fora do componente principal):

```tsx
function SecretChoiceButtons({
  pair,
  picks,
  dispatch,
}: {
  pair: readonly string[]
  picks: readonly { slot: 0 | 1; level: 1 | 2 }[]
  dispatch: Dispatch<GameAction>
}) {
  if (picks.length === 0) {
    return (
      <>
        {([0, 1] as const).map((slot) => {
          const kind = SECRET_KINDS[pair[slot]!]
          return (
            <button
              key={slot}
              type="button"
              className={styles.secretChoiceBtn}
              onClick={() => dispatch({ type: 'CHOOSE_SECRET', slot, level: 1 })}
            >
              <b>{kind.name}</b>
              <span>{kind.effectL1}</span>
            </button>
          )
        })}
      </>
    )
  }
  const cur = picks[0]!
  const curKind = SECRET_KINDS[pair[cur.slot]!]
  const other = (cur.slot === 0 ? 1 : 0) as 0 | 1
  const otherKind = SECRET_KINDS[pair[other]!]
  return (
    <>
      <button
        type="button"
        className={styles.secretChoiceBtn}
        onClick={() => dispatch({ type: 'CHOOSE_SECRET', slot: cur.slot, level: 2 })}
      >
        <b>Aprofundar — {curKind.name}+</b>
        <span>{curKind.effectL2}</span>
      </button>
      <button
        type="button"
        className={styles.secretChoiceBtn}
        onClick={() => dispatch({ type: 'CHOOSE_SECRET', slot: other, level: 1 })}
      >
        <b>Ampliar — {otherKind.name}</b>
        <span>{otherKind.effectL1}</span>
      </button>
    </>
  )
}
```

- [ ] **Step 2: Aceitar a escolha dentro do `MvpSquare`**

Na assinatura de `MvpSquare`, acrescentar a prop opcional `secretChoice`:

```tsx
function MvpSquare({
  mvp,
  missions,
  defeats,
  heartsGained,
  killSpecies,
  secretChoice,
}: {
  mvp: Pokemon | undefined
  missions: number
  defeats: number
  heartsGained: number
  killSpecies: ReturnType<typeof getSpecies>[]
  secretChoice?: { pair: readonly string[]; picks: readonly { slot: 0 | 1; level: 1 | 2 }[]; dispatch: Dispatch<GameAction> }
}) {
```

Dentro do `MvpSquare`, logo após o fechamento da lista de feitos `</ol>` (antes de fechar a `<div className={styles.mvp}>`), inserir:

```tsx
      {secretChoice && (
        <div className={styles.secretChoiceInline}>
          <span className={styles.secretChoiceInlineTitle}>★ Escolha sua Habilidade Secreta</span>
          <div className={styles.secretChoiceOptions}>
            <SecretChoiceButtons pair={secretChoice.pair} picks={secretChoice.picks} dispatch={secretChoice.dispatch} />
          </div>
        </div>
      )}
```

- [ ] **Step 3: Ligar a escolha ao Destaque e manter o fallback**

No corpo do `SummaryScreen`, após a linha `const choicePending = Boolean(choice && choiceMon && choicePair)` (~linha 80), adicionar:

```tsx
  // A escolha aparece DENTRO do quadro do Destaque quando o pendente é o próprio MVP.
  const choiceInMvp = Boolean(choicePending && mvp && choice && mvp.id === choice.pokemonId)
```

Trocar a chamada de `<MvpSquare ... />` (linhas 109-115) para passar `secretChoice` quando couber:

```tsx
        <MvpSquare
          mvp={mvp}
          missions={summary.mvpMissions}
          defeats={summary.mvpDefeats}
          heartsGained={state.today.mvpHeartsGained}
          killSpecies={mvpKillSpecies}
          secretChoice={
            choiceInMvp && choicePair
              ? { pair: choicePair, picks: choicePicks, dispatch }
              : undefined
          }
        />
```

Substituir o bloco `{choicePending && choiceMon && choicePair && ( ... )}` (linhas 118-167) por um fallback que só renderiza quando a escolha NÃO está no MVP, reusando `SecretChoiceButtons`:

```tsx
      {choicePending && choiceMon && choicePair && !choiceInMvp && (
        <div className={styles.secretChoice}>
          <span className={styles.secretChoiceTitle}>
            ★ {displayNameOf(choiceMon)} virou Destaque — escolha sua Habilidade Secreta
          </span>
          <div className={styles.secretChoiceOptions}>
            <SecretChoiceButtons pair={choicePair} picks={choicePicks} dispatch={dispatch} />
          </div>
        </div>
      )}
```

- [ ] **Step 4: Estilo do bloco interno com brilho pulsante**

Em `src/components/screens/SummaryScreen.module.css`, após o bloco `.secretChoiceBtn span` (linha ~453), adicionar:

```css
/* Escolha de habilidade DENTRO do quadro do Destaque: chama atenção com brilho pulsante. */
.secretChoiceInline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 2px dashed var(--c-hud-accent);
}
.secretChoiceInlineTitle {
  font-family: var(--font-pixel);
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--c-hud-accent);
  text-align: center;
}
.secretChoiceInline .secretChoiceBtn {
  animation: secretChoiceGlow 1.3s ease-in-out infinite;
}
@keyframes secretChoiceGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 203, 5, 0); }
  50% { box-shadow: 0 0 14px 2px rgba(255, 203, 5, 0.65); }
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build OK (sem variáveis não usadas; `choiceInMvp`/`SecretChoiceButtons` usados).

- [ ] **Step 6: Verificar regressão de testes de tela (se houver)**

Run: `npx vitest run src/components/screens`
Expected: PASS (ou "no tests").

- [ ] **Step 7: Commit**

```bash
git add src/components/screens/SummaryScreen.tsx src/components/screens/SummaryScreen.module.css
git commit -m "feat(destaque): escolha de habilidade dentro do quadro do Destaque com brilho"
```

---

### Task 9: Verificação final + Pull Request

**Files:** nenhum (verificação e publicação).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 2: Suíte de testes completa**

Run: `npx vitest run`
Expected: todos os testes PASS.

- [ ] **Step 3: Lint (se configurado)**

Run: `npm run lint`
Expected: sem erros (se o script não existir, ignorar).

- [ ] **Step 4: Push do branch**

```bash
git push -u origin feat/ajustes-rocket-destaque-ux
```

- [ ] **Step 5: Abrir a PR**

```bash
gh pr create --base main --head feat/ajustes-rocket-destaque-ux \
  --title "Ajustes de UX: Rocket, Destaque, Forecast e regras (8 itens)" \
  --body "Implementa os 8 ajustes do spec docs/superpowers/specs/2026-06-21-ajustes-rocket-destaque-ux-design.md:
1. Som ao aparecer a Rocket (mesmo som de missão nova).
2. Painel de perseguição da Rocket no layout do despacho de missão, com R vermelho brilhante.
3. Derrotas da Rocket contam como derrotados do Destaque do Dia (com miniaturas).
4. Habilidades secretas mostram os nomes das duas (sem '???').
5. Ginásio indefendido tira 1 estrela (0 = game over) em vez de derrota imediata.
6. Exploração concede 100 XP ao explorador ao concluir (capturando ou recusando).
7. Chance de Rocket no forecast: rampa azul→vermelho + chip legível.
8. Escolha de habilidade movida para dentro do quadro do Destaque, com brilho.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: PR criada; imprime a URL.

---

## Self-Review

**Cobertura do spec (8 itens):**
1. Som da Rocket → Task 2. ✓
2. Painel da Rocket (layout missão + R) → Task 7. ✓
3. Derrotas Rocket no Destaque → Task 3. ✓
4. Nomes das habilidades secretas → Task 1. ✓
5. Ginásio indefendido −1 estrela → Task 4. ✓
6. Exploração 100 XP → Task 5. ✓
7. Forecast rampa + chip → Task 6. ✓
8. Escolha dentro do Destaque + brilho → Task 8. ✓
Verificação final + PR → Task 9. ✓

**Placeholders:** nenhum "TBD/TODO"; todo passo de código traz o código completo.

**Consistência de tipos/nomes:**
- `penalizeUndefendedGym` usado igual em `defenseFlow.ts`, `dayClock.ts` e no teste.
- `theftChanceLabel` retorna `{ label, color, ink }` em `theft.ts`, no teste e no consumo do `DayForecastPanel`.
- `EXPLORATION_XP` exportado em `balance.ts` e importado em `captureFlow.ts` + teste.
- `SecretChoiceButtons` com a mesma assinatura (`pair`, `picks`, `dispatch`) nos dois usos.
- `.rocketChip`, `.rocketEmblem`, `.secretChoiceInline`/`secretChoiceGlow` adicionados onde são referenciados.

**Riscos sinalizados:**
- Task 5: o net deve ser exatamente −1 estrela (decremento de `defensesTotal` evita dupla punição no `settleDay`). Coberto por teste.
- Task 5/6: renomear função e adicionar `takeRng` podem afetar testes existentes — passos de regressão incluídos (`dayClock`, `captureShiny`/`captureSurf`/`captureWeather`).
