# Ajustes de UI (manhã, captura, defesa, fim de jogo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 7 ajustes independentes de UI/UX: caixa dos contadores da manhã, aura de velocidade, atributos coloridos na captura, ginásio indefeso zerando estrelas, sprites de líderes por cidade, fontes da tela final e breakdown de habilidades/itens na missão.

**Architecture:** Mudanças localizadas em componentes React + CSS Modules, mais duas mudanças de engine puras e testáveis (zerar `battleStars`; nova função `missionEffectBreakdown`). Spec: `docs/superpowers/specs/2026-06-20-ajustes-ui-missoes-fim-de-jogo-design.md`.

**Tech Stack:** React + TypeScript, CSS Modules, Vitest. Build via `npm run build` (tsc -b + vite). Testes via `npm test` (vitest run).

## Global Constraints

- Gen 1 (Kanto) apenas; dataset existente é fonte de verdade.
- Build/tipos: usar `npm run build` (tsc -b), NÃO `tsc --noEmit`.
- Sem mudança de balanceamento — B5 apenas exibe o que a engine já calcula.
- Nenhum emoji na aura de velocidade (A2). O "R" do Rocket (A1) usa fonte pixel/bold, cor `--c-dialog-cursor`.
- Cores existentes a reaproveitar: nature up `#2f8f3f`, nature down `#e05050`; tema `--c-ink` #1c4a2c, `--c-panel-border` #2f8f50, `--c-panel` #f4fbf2, `--c-dialog-cursor` #e02020.
- Textos de UI em português.

---

### Task 1: B2 — Ginásio indefeso zera estrelas de batalha

**Files:**
- Modify: `src/game/defenseFlow.ts:32-36` (`loseRunByUndefendedGym`)
- Test: `src/game/defenseFlow.test.ts` (criar)

**Interfaces:**
- Consumes: `createInitialState(seed)` de `../engine/state.ts`; `loseRunByUndefendedGym(s)` de `./defenseFlow.ts`.
- Produces: nenhuma assinatura nova (comportamento ajustado).

- [ ] **Step 1: Write the failing test**

Criar `src/game/defenseFlow.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { loseRunByUndefendedGym } from './defenseFlow.ts'

describe('loseRunByUndefendedGym', () => {
  it('zera as estrelas de batalha e encerra a run com motivo gym', () => {
    const s = createInitialState(1)
    s.approval.battleStars = 5
    loseRunByUndefendedGym(s)
    expect(s.approval.battleStars).toBe(0)
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.run.gameOverReason).toBe('gym')
    expect(s.clock.speed).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/defenseFlow.test.ts`
Expected: FAIL em `expect(s.approval.battleStars).toBe(0)` (recebe 5).

- [ ] **Step 3: Implement the change**

Em `src/game/defenseFlow.ts`, dentro de `loseRunByUndefendedGym`, adicionar a linha de zerar estrelas:

```ts
export function loseRunByUndefendedGym(s: GameState): void {
  s.run.phase = 'GAMEOVER'
  s.run.gameOverReason = 'gym'
  s.approval.battleStars = 0
  s.clock.speed = 0
}
```

Atualizar o comentário do bloco acima para mencionar o zeramento (acrescentar ao final): `Zera as estrelas de batalha (ginásio abandonado).`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/defenseFlow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/defenseFlow.ts src/game/defenseFlow.test.ts
git commit -m "fix(defense): ginasio indefeso zera estrelas de batalha"
```

---

### Task 2: B3 — Sprite do líder por cidade

**Files:**
- Modify: `src/data/endgameVerdict.ts:56-70` (`GYM_LEADERS`, `gymLeaderFor`)
- Test: `src/data/endgameVerdict.test.ts:32-40` (atualizar caso do fallback)

**Interfaces:**
- Consumes: `gymLeaderFor(cityIndex): GymLeader` de `./endgameVerdict.ts`.
- Produces: `GYM_LEADERS` completo (índices 0–7).

- [ ] **Step 1: Update the test to expect real leaders**

Em `src/data/endgameVerdict.test.ts`, substituir o bloco `describe('gymLeaderFor', …)` (linhas 32–40) por:

```ts
describe('gymLeaderFor', () => {
  it('mapeia cada cidade de Kanto ao seu líder', () => {
    expect(gymLeaderFor(0).name).toBe('Brock')
    expect(gymLeaderFor(1).name).toBe('Misty')
    expect(gymLeaderFor(2).name).toBe('Lt. Surge')
    expect(gymLeaderFor(3).name).toBe('Erika')
    expect(gymLeaderFor(4).name).toBe('Koga')
    expect(gymLeaderFor(5).name).toBe('Sabrina')
    expect(gymLeaderFor(6).name).toBe('Blaine')
    expect(gymLeaderFor(7).name).toBe('Giovanni')
  })
  it('cada líder tem um sprite gen3', () => {
    for (let i = 0; i < 8; i++) {
      expect(gymLeaderFor(i).sprite).toMatch(/\/sprites\/trainers\/gen3\/.+\.png$/)
    }
  })
  it('índice fora da faixa cai no fallback genérico', () => {
    expect(gymLeaderFor(99).name).toBe('Líder do Ginásio')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/data/endgameVerdict.test.ts`
Expected: FAIL em `gymLeaderFor(2).name` (recebe 'Líder do Ginásio').

- [ ] **Step 3: Complete the GYM_LEADERS map**

Em `src/data/endgameVerdict.ts`, substituir o objeto `GYM_LEADERS` (linhas 57–60) por:

```ts
const GYM_LEADERS: Partial<Record<number, GymLeader>> = {
  0: { name: 'Brock', sprite: '/sprites/trainers/gen3/brock-gen3.png' },
  1: { name: 'Misty', sprite: '/sprites/trainers/gen3/misty-gen3.png' },
  2: { name: 'Lt. Surge', sprite: '/sprites/trainers/gen3/ltsurge-gen3.png' },
  3: { name: 'Erika', sprite: '/sprites/trainers/gen3/erika-gen3.png' },
  4: { name: 'Koga', sprite: '/sprites/trainers/gen3/koga-gen3.png' },
  5: { name: 'Sabrina', sprite: '/sprites/trainers/gen3/sabrina-gen3.png' },
  6: { name: 'Blaine', sprite: '/sprites/trainers/gen3/blaine-gen3.png' },
  7: { name: 'Giovanni', sprite: '/sprites/trainers/gen3/giovanni-gen3.png' },
}
```

Atualizar o comentário acima (linha 56) para: `/** Líder de cada cidade de Kanto (índices 0–7). Fallback genérico só para índices fora da faixa. */`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/data/endgameVerdict.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify sprites exist**

Run: `ls public/sprites/trainers/gen3/ltsurge-gen3.png public/sprites/trainers/gen3/erika-gen3.png public/sprites/trainers/gen3/koga-gen3.png public/sprites/trainers/gen3/sabrina-gen3.png public/sprites/trainers/gen3/blaine-gen3.png public/sprites/trainers/gen3/giovanni-gen3.png`
Expected: os 6 caminhos listados sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/data/endgameVerdict.ts src/data/endgameVerdict.test.ts
git commit -m "fix(endgame): sprite do lider correto por cidade (8 lideres de Kanto)"
```

---

### Task 3: B4 — Contraste das fontes da tela final

**Files:**
- Modify: `src/components/screens/EndGameScreen.module.css` (`.panelTitle` ~363, `.tilePct` ~303)

**Interfaces:** nenhuma (CSS only).

- [ ] **Step 1: Trocar a cor dos títulos de painel**

Em `src/components/screens/EndGameScreen.module.css`, na regra `.panelTitle`, trocar `color: var(--c-hud-accent);` por `color: var(--c-ink);`.

- [ ] **Step 2: Trocar a cor das porcentagens**

Na regra `.tilePct`, trocar `color: var(--c-hud-accent);` por `color: var(--c-panel-border);`.

NÃO alterar `.colHeading` (está sobre o scrim escuro do herói).

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/EndGameScreen.module.css
git commit -m "fix(endgame): cores legiveis nos titulos e porcentagens (contraste)"
```

---

### Task 4: A1 — Caixa dos contadores do dia

**Files:**
- Modify: `src/components/screens/DayForecastPanel.tsx:76-89` (bloco `<dl>`)
- Modify: `src/components/screens/DayForecastPanel.module.css:66-97` (`.counts`, `.count`, `.rocket`)

**Interfaces:**
- Consumes: `missions`, `defenses` (já calculados no componente).
- Produces: nenhuma assinatura nova.

- [ ] **Step 1: Substituir o markup dos contadores**

Em `src/components/screens/DayForecastPanel.tsx`, trocar todo o bloco `<dl className={styles.counts}> … </dl>` (linhas 76–89) por:

```tsx
      <div className={styles.counts}>
        <div className={styles.count}>
          <span className={styles.countIcon} aria-hidden="true">🎯</span>
          <span className={styles.countValue}>{missions}</span>
          <span className={styles.countLabel}>Missões</span>
        </div>
        <div className={styles.count}>
          <span className={styles.countIcon} aria-hidden="true">⚔️</span>
          <span className={styles.countValue}>{defenses}</span>
          <span className={styles.countLabel}>Batalhas</span>
        </div>
        <div className={styles.count}>
          <span className={`${styles.countIcon} ${styles.rocketIcon}`} aria-hidden="true">R</span>
          <span
            className={`${styles.countValue} ${styles.rocketValue}`}
            title="A previsão não revela os dias da Equipe Rocket"
          >
            ???
          </span>
          <span className={styles.countLabel}>Rocket</span>
        </div>
      </div>
```

- [ ] **Step 2: Substituir o CSS dos contadores**

Em `src/components/screens/DayForecastPanel.module.css`, substituir todo o bloco de `.counts` em diante (linhas 66–97, de `/* Contagens do dia. */` até o fim do arquivo) por:

```css
/* Contagens do dia — caixa neutra (igual aos demais painéis), 3 mini-células. */
.counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 0;
  background: var(--c-panel);
  border: 3px solid var(--c-panel-border);
  border-radius: var(--radius-pixel);
  padding: 12px 14px;
}

.count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.countIcon {
  font-size: 22px;
  line-height: 1;
}

/* "R" da Equipe Rocket no mesmo estilo do marcador do mapa. */
.rocketIcon {
  font-family: var(--font-pixel);
  font-weight: 700;
  font-size: 18px;
  color: var(--c-dialog-cursor);
}

.countValue {
  font-family: var(--font-text);
  font-size: 20px;
  font-weight: bold;
  color: var(--c-ink);
}

.rocketValue {
  color: var(--c-hp-low);
  letter-spacing: 2px;
}

.countLabel {
  font-family: var(--font-text);
  font-size: 13px;
  color: var(--c-ink-muted);
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/DayForecastPanel.tsx src/components/screens/DayForecastPanel.module.css
git commit -m "feat(manha): contadores do dia em caixa com simbolos (missoes/batalhas/rocket)"
```

---

### Task 5: A2 — Aura de velocidade como streaks de movimento

**Files:**
- Modify: `src/components/day/CityMap.module.css:56-148` (`.speedy .traveler`, `.speedAura`, `.speedAura::before`, `@keyframes speedFlash`, `@keyframes speedDash`)

**Interfaces:** nenhuma (CSS only). O markup em `CityMap.tsx` (`<span className={styles.speedAura} />`) permanece.

- [ ] **Step 1: Suavizar o bob dos sprites velozes**

Em `src/components/day/CityMap.module.css`, na regra `.speedy .traveler` (linhas 58–61), reduzir o brilho redondo: trocar o bloco por:

```css
.speedy .traveler {
  animation: bob 0.4s ease-in-out infinite;
}
```

(remove o `filter: drop-shadow(...)` ciano).

- [ ] **Step 2: Reescrever a aura como streaks horizontais**

Substituir as regras `.speedAura` (104–118) e `.speedAura::before` (121–134) e os keyframes `speedFlash` (136–141) e `speedDash` (144–148) por:

```css
/* Streaks de movimento: três traços horizontais atrás do grupo, fluindo para trás
   e sumindo, sem brilho redondo nem emoji. */
.speedAura {
  position: absolute;
  top: 50%;
  right: 100%;
  width: 26px;
  height: 18px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: -1;
  background:
    linear-gradient(90deg, transparent, rgba(150, 225, 255, 0.95)) top / 100% 2px no-repeat,
    linear-gradient(90deg, transparent, rgba(150, 225, 255, 0.75)) center / 78% 2px no-repeat,
    linear-gradient(90deg, transparent, rgba(150, 225, 255, 0.95)) bottom / 92% 2px no-repeat;
  animation: speedStreak 0.45s linear infinite;
}

@keyframes speedStreak {
  0% {
    opacity: 0.25;
    transform: translateY(-50%) translateX(4px);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.25;
    transform: translateY(-50%) translateX(-4px);
  }
}
```

(O `.speedAura::before` e os dois keyframes antigos deixam de existir.)

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/day/CityMap.module.css
git commit -m "feat(mapa): aura de velocidade como streaks de movimento (sem brilho redondo)"
```

---

### Task 6: B1 — Atributos coloridos + total no encontro de captura

**Files:**
- Modify: `src/components/day/EncounterChoice.tsx:46-94` (cálculo da natureza + bloco `.encStats`)
- Modify: `src/components/day/Panels.module.css:442-470` (adicionar classes de cor + total)

**Interfaces:**
- Consumes: `getNatureEntry(mon.nature)` → `{ boosted?: AttrKey, reduced?: AttrKey }`; `effectiveAttr(mon, k)`; `ATTR_KEYS`.
- Produces: nenhuma assinatura nova.

- [ ] **Step 1: Colorir os atributos e adicionar o total**

Em `src/components/day/EncounterChoice.tsx`, substituir o bloco `.encStats` (linhas 87–94) por:

```tsx
              <span className={styles.encStats}>
                {ATTR_KEYS.map((k) => {
                  const cls =
                    nature?.boosted === k
                      ? styles.encStatUp
                      : nature?.reduced === k
                        ? styles.encStatDown
                        : ''
                  return (
                    <span key={k} className={styles.encStat}>
                      <span className={styles.encStatLbl}>{ATTR_SHORT_PT[k]}</span>
                      <b className={cls}>{effectiveAttr(mon, k)}</b>
                    </span>
                  )
                })}
                <span className={`${styles.encStat} ${styles.encStatTotal}`}>
                  <span className={styles.encStatLbl}>TOT</span>
                  <b>{ATTR_KEYS.reduce((sum, k) => sum + effectiveAttr(mon, k), 0)}</b>
                </span>
              </span>
```

(`nature` já está disponível na linha 47: `const nature = mon.nature ? getNatureEntry(mon.nature) : null`.)

- [ ] **Step 2: Adicionar as classes de cor e total no CSS**

Em `src/components/day/Panels.module.css`, logo após a regra `.encStat b` (que termina na linha 470), inserir:

```css
.encStatUp {
  color: #2f8f3f;
}

.encStatDown {
  color: #e05050;
}

/* Célula do total — ocupa destaque na grade de 3 colunas. */
.encStatTotal {
  background: rgba(0, 0, 0, 0.12);
}

.encStatTotal b {
  color: var(--c-ink);
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/day/EncounterChoice.tsx src/components/day/Panels.module.css
git commit -m "feat(captura): atributos coloridos pela natureza + total de stats no encontro"
```

---

### Task 7: B5a — Função de breakdown de efeitos da missão (engine)

**Files:**
- Modify: `src/engine/secretEffects.ts` (adicionar tipo + função ao final, antes do fim do arquivo)
- Test: `src/engine/secretEffects.test.ts` (adicionar bloco describe)

**Interfaces:**
- Consumes: `MissionSecretCtx` (já existe em `secretEffects.ts`); predicados `hasHustle`, `hasTorrent`, `hasRivalry`, `hasAnalytic`, `hasBattleArmor`, `hasClearBody`, `hasWeakArmor`, `teamHasQuickFeet`; constantes de `./balance.ts`; `hasRunItem`, `notFinalEvolution` de `./itemEffects.ts`; `hasSecret` de `../data/secretAbilities.ts`.
- Produces:
  ```ts
  export interface MissionEffectEntry {
    id: string
    source: 'ability' | 'item'
    label: string
    kind: 'attr' | 'speed'
    direction: 'gain' | 'loss' | 'info'
    value: string
    reason: string
  }
  export function missionEffectBreakdown(ctx: MissionSecretCtx): MissionEffectEntry[]
  ```
- Escopo: cobre efeitos de ATRIBUTO e os de VELOCIDADE não-roteamento (Weak Armor, Quick Feet, Lagging Tail). Fly/Surf/Sniper continuam nas linhas dedicadas da UI e NÃO entram aqui.

- [ ] **Step 1: Write the failing tests**

Em `src/engine/secretEffects.test.ts`, adicionar imports necessários no topo (se já houver imports de `makeMon`/`getMissionTemplate`, reutilizar; senão acrescentar):

```ts
import { missionEffectBreakdown } from './secretEffects.ts'
import { makeMon } from './testkit.ts'
import { getMissionTemplate } from '../data/missionTemplates.ts'
import { zeroAttrs } from './attributes.ts'
import type { MissionSecretCtx } from './secretEffects.ts'
```

E o bloco de testes:

Espécies usadas (linhas secretas reais, ver `src/data/secretAbilities.ts`): Onix `speciesId 95` com `secretCount 1` = Weak Armor (1ª da linha); Nidoran♀ `speciesId 29` com `secretCount 2` = Hustle (2ª da linha — Rivalry, sua 1ª, só ativa com aliado do mesmo gênero, então não aparece num time de 1).

```ts
describe('missionEffectBreakdown', () => {
  const baseCtx = (over: Partial<MissionSecretCtx>): MissionSecretCtx => ({
    team: [],
    template: getMissionTemplate('patrulha'),
    runtime: {},
    runItems: [],
    ...over,
  })

  it('time sem efeitos → lista vazia', () => {
    const mon = makeMon({ id: 'p1', speciesId: 1, secretCount: 0 })
    expect(missionEffectBreakdown(baseCtx({ team: [mon] }))).toEqual([])
  })

  it('Hustle aparece como perda de atributo', () => {
    const mon = makeMon({ id: 'p1', speciesId: 29, secretCount: 2 }) // Nidoran♀ #2 = Hustle
    const entries = missionEffectBreakdown(baseCtx({ team: [mon] }))
    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'hustle', direction: 'loss', value: '−10%', kind: 'attr' }),
    )
  })

  it('Lagging Tail gera ganho de atributo e perda de velocidade', () => {
    const mon = makeMon({ id: 'p1', speciesId: 1, secretCount: 0 })
    const entries = missionEffectBreakdown(baseCtx({ team: [mon], runItems: ['lagging-tail'] }))
    const attr = entries.find((e) => e.id === 'lagging-tail' && e.kind === 'attr')
    const speed = entries.find((e) => e.id === 'lagging-tail' && e.kind === 'speed')
    expect(attr).toMatchObject({ direction: 'gain', value: '+50%', source: 'item' })
    expect(speed).toMatchObject({ direction: 'loss', value: '−50%' })
  })

  it('Weak Armor com HP faltante vira ganho de velocidade proporcional', () => {
    // Onix #1 = Weak Armor; 2 de HP faltante × 20% = +40%.
    const mon = makeMon({ id: 'p1', speciesId: 95, secretCount: 1, maxHp: 5, currentHp: 3 })
    const entries = missionEffectBreakdown(baseCtx({ team: [mon] }))
    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'weak-armor', kind: 'speed', direction: 'gain', value: '+40%' }),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/engine/secretEffects.test.ts`
Expected: FAIL com "missionEffectBreakdown is not a function" (ou erro de import).

- [ ] **Step 3: Implement the function**

Em `src/engine/secretEffects.ts`, adicionar ao final do arquivo:

```ts
// ---- Breakdown legível dos efeitos da missão (UI) ----

/** Uma contribuição de habilidade/item exibida no despacho (já formatada). */
export interface MissionEffectEntry {
  id: string
  source: 'ability' | 'item'
  label: string
  kind: 'attr' | 'speed'
  direction: 'gain' | 'loss' | 'info'
  value: string
  reason: string
}

/** Formata um multiplicador (1.1 → '+10%', 0.9 → '−10%'). */
function fmtMult(mult: number): string {
  const p = Math.round((mult - 1) * 100)
  return `${p >= 0 ? '+' : '−'}${Math.abs(p)}%`
}

/** Formata um acréscimo fracionário (0.4 → '+40%'). */
function fmtAdd(frac: number): string {
  return `+${Math.round(frac * 100)}%`
}

/**
 * Lista os efeitos ATIVOS de habilidades/itens sobre ATRIBUTOS e VELOCIDADE (não-roteamento)
 * do time selecionado, já formatados para exibição. Fly/Surf/Sniper têm linhas próprias na UI
 * e não entram aqui. Apenas leitura — não muda nada.
 */
export function missionEffectBreakdown(ctx: MissionSecretCtx): MissionEffectEntry[] {
  const { team, template, runtime, runItems } = ctx
  const out: MissionEffectEntry[] = []
  let hasAttrLoss = false
  const push = (e: MissionEffectEntry): void => {
    if (e.kind === 'attr' && e.direction === 'loss') hasAttrLoss = true
    out.push(e)
  }

  // --- Atributos: itens passivos ---
  if (runItems.includes('eviolite') && team.some(notFinalEvolution)) {
    push({ id: 'eviolite', source: 'item', label: 'Eviolite', kind: 'attr', direction: 'gain',
      value: fmtMult(EVIOLITE_MISSION_MULT), reason: 'Pokémon que ainda evolui' })
  }
  if (runItems.includes('lagging-tail')) {
    push({ id: 'lagging-tail', source: 'item', label: 'Lagging Tail', kind: 'attr', direction: 'gain',
      value: fmtMult(LAGGING_TAIL_MISSION_MULT), reason: 'todos os atributos' })
  }

  // --- Atributos: habilidades ---
  const rivalryActive = team.some(
    (p) => hasRivalry(p) && team.some((o) => o.id !== p.id && o.gender === p.gender),
  )
  if (rivalryActive) {
    push({ id: 'rivalry', source: 'ability', label: 'Rivalry', kind: 'attr', direction: 'gain',
      value: fmtAdd(RIVALRY_ATTR_PER_ALLY), reason: 'por aliado do mesmo gênero' })
  }
  if (team.some((p) => hasSecret(p, 'sa-rock-head'))) {
    if (template.id === 'escolta') {
      push({ id: 'rock-head', source: 'ability', label: 'Rock Head', kind: 'attr', direction: 'gain',
        value: fmtMult(ROCK_HEAD_ESCORT_MULT), reason: 'em Escolta' })
    } else if (template.id === 'ensino') {
      push({ id: 'rock-head', source: 'ability', label: 'Rock Head', kind: 'attr', direction: 'loss',
        value: fmtMult(ROCK_HEAD_STUDY_MULT), reason: 'em Ensino' })
    }
  }
  if (team.some(hasAnalytic)) {
    if (template.id === 'ensino') {
      push({ id: 'analytic', source: 'ability', label: 'Analytic', kind: 'attr', direction: 'gain',
        value: fmtMult(ANALYTIC_STUDY_MULT), reason: 'em Ensino' })
    } else if (template.id === 'patrulha') {
      push({ id: 'analytic', source: 'ability', label: 'Analytic', kind: 'attr', direction: 'loss',
        value: fmtMult(ANALYTIC_PATROL_MULT), reason: 'em Patrulha' })
    }
  }
  if (team.some((p) => hasTorrent(p) && team.some((o) => o.id !== p.id && o.types.includes('water')))) {
    push({ id: 'torrent', source: 'ability', label: 'Torrent', kind: 'attr', direction: 'gain',
      value: fmtMult(TORRENT_MISSION_MULT), reason: 'com aliado do tipo Água' })
  }
  if (team.some((p) => hasBattleArmor(p) && runtime[p.id]?.battleArmorPending)) {
    push({ id: 'battle-armor', source: 'ability', label: 'Battle Armor', kind: 'attr', direction: 'gain',
      value: fmtMult(BATTLE_ARMOR_MISSION_MULT), reason: 'após batalhar na defesa' })
  }
  if (team.some(hasHustle)) {
    push({ id: 'hustle', source: 'ability', label: 'Hustle', kind: 'attr', direction: 'loss',
      value: fmtMult(HUSTLE_MISSION_MULT), reason: 'troca atributo por poder de batalha' })
  }
  if (hasAttrLoss && team.some(hasClearBody)) {
    push({ id: 'clear-body', source: 'ability', label: 'Clear Body', kind: 'attr', direction: 'info',
      value: '', reason: 'anula reduções de atributo do time' })
  }

  // --- Velocidade (não-roteamento) ---
  const missingHp = team.reduce(
    (sum, p) => (hasWeakArmor(p) ? sum + Math.max(0, p.maxHp - p.currentHp) : sum),
    0,
  )
  if (missingHp > 0) {
    push({ id: 'weak-armor', source: 'ability', label: 'Weak Armor', kind: 'speed', direction: 'gain',
      value: fmtAdd(WEAK_ARMOR_SPEED_PER_MISSING_HP * missingHp), reason: 'por HP faltante' })
  }
  if (teamHasQuickFeet(team)) {
    push({ id: 'quick-feet', source: 'ability', label: 'Quick Feet', kind: 'speed', direction: 'gain',
      value: fmtAdd(QUICK_FEET_SPEED_BONUS), reason: 'despachado sozinho' })
  }
  if (runItems.includes('lagging-tail')) {
    push({ id: 'lagging-tail', source: 'item', label: 'Lagging Tail', kind: 'speed', direction: 'loss',
      value: fmtMult(LAGGING_TAIL_TRAVEL_MULT), reason: 'viagem mais lenta' })
  }

  return out
}
```

Garantir que `EVIOLITE_MISSION_MULT`, `LAGGING_TAIL_MISSION_MULT`, `LAGGING_TAIL_TRAVEL_MULT`, `RIVALRY_ATTR_PER_ALLY`, `ROCK_HEAD_ESCORT_MULT`, `ROCK_HEAD_STUDY_MULT`, `ANALYTIC_STUDY_MULT`, `ANALYTIC_PATROL_MULT`, `TORRENT_MISSION_MULT`, `BATTLE_ARMOR_MISSION_MULT`, `HUSTLE_MISSION_MULT`, `WEAK_ARMOR_SPEED_PER_MISSING_HP`, `QUICK_FEET_SPEED_BONUS` estão importados de `./balance.ts` (a maioria já está; adicionar os que faltarem), e `notFinalEvolution` de `./itemEffects.ts` (já importado `itemMissionMultiplier`/`itemTravelSpeedMultiplier` desse módulo — acrescentar `notFinalEvolution`). `hasSecret` já é importado de `../data/secretAbilities.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/engine/secretEffects.test.ts`
Expected: PASS (todos os casos novos).

- [ ] **Step 5: Run full type build**

Run: `npm run build`
Expected: build sem erros (imports completos).

- [ ] **Step 6: Commit**

```bash
git add src/engine/secretEffects.ts src/engine/secretEffects.test.ts
git commit -m "feat(missions): funcao missionEffectBreakdown (efeitos legiveis por habilidade/item)"
```

---

### Task 8: B5b — Lista de efeitos no despacho de missão (UI)

**Files:**
- Modify: `src/components/day/MissionDispatch.tsx:15-28` (imports), `:78-138` (substituir a linha `boosted` pela lista)
- Modify: `src/components/day/Panels.module.css` (adicionar classes da lista de efeitos)

**Interfaces:**
- Consumes: `missionEffectBreakdown(ctx)` de `../../engine/secretEffects.ts`; `ctx` já montado em `MissionDispatch` (linhas 67–72). O tipo de cada entrada é inferido no `.map`, sem precisar importar `MissionEffectEntry`.
- Produces: nenhuma assinatura nova.

> Atenção (`noUnusedLocals: true`): ao remover o uso de `boosted`, o import `teamHasAttrBoost` fica órfão e quebra o build. Por isso o Step 1 **troca** `teamHasAttrBoost` por `missionEffectBreakdown` no import (não adiciona).

- [ ] **Step 1: Trocar o import**

Em `src/components/day/MissionDispatch.tsx`, no import de `../../engine/secretEffects.ts` (linhas 15–21), **substituir** `teamHasAttrBoost` por `missionEffectBreakdown` na lista importada (os demais — `teamSecretSum`, `teamSnipes`, `teamTravelSpeedMultiplier`, `type MissionSecretCtx` — permanecem).

- [ ] **Step 2: Calcular o breakdown (substituindo `boosted`)**

Trocar a linha `const boosted = teamHasAttrBoost(ctx)` (linha 78) por:

```tsx
  const effects = missionEffectBreakdown(ctx)
```

(A variável `boosted` deixa de existir; seu único uso no JSX é removido no Step 3.)

- [ ] **Step 3: Substituir a linha genérica pela lista**

Substituir o bloco `{boosted && ( … )}` (linhas 114–118) por:

```tsx
          {effects.length > 0 && (
            <ul className={styles.effectList}>
              {effects.map((e) => (
                <li
                  key={`${e.id}-${e.kind}`}
                  className={`${styles.effectRow} ${
                    e.direction === 'gain'
                      ? styles.effectGain
                      : e.direction === 'loss'
                        ? styles.effectLoss
                        : styles.effectInfo
                  }`}
                >
                  <span className={styles.effectName}>{e.label}</span>
                  {e.value && <span className={styles.effectValue}>{e.value}</span>}
                  <span className={styles.effectReason}>{e.reason}</span>
                </li>
              ))}
            </ul>
          )}
```

(Este era o único uso de `boosted`, já removido no Step 2.)

- [ ] **Step 4: Adicionar o CSS da lista**

Em `src/components/day/Panels.module.css`, logo após a regra `.missionReward` (que termina por volta da linha 52), inserir:

```css
/* Lista de efeitos ativos da missão (habilidades/itens) — ganho verde, perda vermelha. */
.effectList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.effectRow {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-pixel);
  border-left: 4px solid transparent;
  font-family: var(--font-text);
  font-size: 13px;
  background: var(--c-panel);
}

.effectGain {
  border-left-color: #2f8f3f;
}

.effectLoss {
  border-left-color: #e05050;
}

.effectInfo {
  border-left-color: var(--c-panel-border);
}

.effectName {
  font-weight: bold;
  color: var(--c-ink);
}

.effectGain .effectValue {
  color: #2f8f3f;
  font-weight: bold;
}

.effectLoss .effectValue {
  color: #e05050;
  font-weight: bold;
}

.effectReason {
  color: var(--c-ink-muted);
  font-size: 12px;
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: build sem erros (sem variável `boosted` não usada).

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: toda a suíte verde.

- [ ] **Step 7: Commit**

```bash
git add src/components/day/MissionDispatch.tsx src/components/day/Panels.module.css
git commit -m "feat(missions): lista detalhada de efeitos por habilidade/item no despacho"
```

---

### Task 9: Verificação final + Pull Request

**Files:** nenhum (validação e entrega).

- [ ] **Step 1: Build + testes completos**

Run: `npm run build && npm test`
Expected: build sem erros e toda a suíte de testes verde.

- [ ] **Step 2: Conferência visual leve (opcional, sem screenshot)**

Se desejado, subir o dev server e inspecionar via DOM os ajustes visuais (A1, A2, B1, B4) — sem depender de screenshot, conforme preferência registrada. Caso contrário, prosseguir.

- [ ] **Step 3: Abrir PR para main**

```bash
git push -u origin feat/escala-100-missoes
gh pr create --base main --head feat/escala-100-missoes \
  --title "Ajustes de UI: manhã, captura, defesa e fim de jogo" \
  --body "$(cat <<'EOF'
## Resumo
Lote de 7 ajustes de UI/UX (spec: docs/superpowers/specs/2026-06-20-ajustes-ui-missoes-fim-de-jogo-design.md):

- **A1** Contadores do dia (missões/batalhas/rocket) em caixa com símbolos (⚔️ batalhas, R vermelho rocket).
- **A2** Aura de velocidade redesenhada como streaks de movimento (sem brilho redondo/emoji).
- **B1** Atributos coloridos pela natureza + total de stats no encontro de captura.
- **B2** Ginásio indefeso zera estrelas de batalha e encerra a run.
- **B3** Sprite do líder correto por cidade (8 líderes de Kanto).
- **B4** Cores legíveis nos títulos/porcentagens da tela final.
- **B5** Lista detalhada de efeitos por habilidade/item no despacho de missão.

## Testes
- `npm run build` e `npm test` verdes.
- Novos testes: B2 (battleStars), B3 (líderes por cidade), B5 (missionEffectBreakdown).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR criado contra `main`. Reportar a URL.

---

## Notas de execução

- A branch atual é `feat/escala-100-missoes` (não é a `main`) — os commits vão direto nela; o PR final aponta para `main`.
- Tasks 1, 2 e 7 são TDD (teste falha → implementa → passa). Tasks 3, 4, 5, 6, 8 são UI/CSS: validar com `npm run build` (e a suíte no fim).
- Ordem recomendada: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 (independentes; pode paralelizar, mas 8 depende de 7).
