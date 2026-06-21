# Habilidades Secretas nível 1/2 — Fase 2: Escolha do jogador + UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Tornar o desbloqueio de Habilidade Secreta INTERATIVO: ao ser Destaque do Dia, o jogador escolhe na tela de resumo — 1º destaque escolhe qual das 2 habilidades (nível 1); 2º destaque escolhe Aprofundar (a mesma vira nível 2) ou Ampliar (a outra no nível 1).

**Architecture:** `finalizeDay` deixa de aplicar o desbloqueio automaticamente; em vez disso REGISTRA uma escolha pendente (`today.secretChoice = { pokemonId }`) quando o Destaque é elegível. A `SummaryScreen` mostra os botões de escolha; ao clicar, despacha `CHOOSE_SECRET { slot, level }`, que chama `chooseSecretAbility(s, slot, level)` — valida e aplica o pick, grava `today.secretUnlock` (reveal) e limpa `secretChoice`. O botão "Próximo dia" fica bloqueado enquanto a escolha estiver pendente.

**Tech Stack:** TypeScript (ESM, `.ts` imports), Vitest, React. Build `npm run build` (tsc -b). Testes `npm test`.

## Global Constraints

- Verificação: `npm run build` e `npm test` (NÃO `tsc --noEmit`). Sem preview.
- `.ts` nas importações.
- Fonte de verdade: spec `docs/superpowers/specs/2026-06-21-habilidades-secretas-nivel-2-design.md` §1 (mecânica) e §1 "Onde a escolha aparece".
- Regras da escolha (invariantes):
  - 1º destaque (picks `[]`): escolher slot 0 OU 1 → nível 1. Resultado `[{slot, level:1}]`.
  - 2º destaque (picks `[{slot:S, level:1}]`): **Aprofundar** → `[{slot:S, level:2}]`; **Ampliar** → `[{slot:S,level:1},{slot:outro,level:1}]`.
  - Máx. 2 destaques: se picks já tem 2 itens OU 1 item no nível 2 → SEM escolha (não elegível).
- `chooseSecretAbility` deve VALIDAR a legalidade e ser no-op em entrada ilegal (não corromper estado).
- NÃO mudar magnitudes de efeito (isso é a Fase 3). Esta fase é só fluxo + UI.
- Reusar estilos/é-padrões existentes da `SummaryScreen.module.css` (botão `.primary` etc.).

## Data/flow reference (estado atual, pós-Fase 1)

- `Pokemon.secretPicks?: Array<{ slot: 0|1; level: 1|2 }>`.
- `src/data/secretAbilities.ts`: `secretLineFor(speciesId): readonly [SecretId,SecretId]|null`, `secretLevelOf`, `activeSecrets`, `SECRET_KINDS[id].{name,effectL1,effectL2}`.
- `today.secretUnlock: { pokemonId; slot:0|1; level:1|2; choice:'first'|'deepen'|'widen' } | null`.
- `phaseFlow.ts` `finalizeDay` chama `unlockSecretAbility(s, summary.mvpId)` (Fase 1, mínimo). Será trocado.
- Reducer (`src/game/reducer.ts`) despacha ações para flows; ações em `src/game/actions.ts`.
- `SummaryScreen.tsx`: bloco de reveal já existe (linhas ~111-130), lê `secretLineFor(mon.speciesId)[unlock.slot]`.

---

### Task 1: Estado — campo `secretChoice` em `DayTally`

**Files:**
- Modify: `src/engine/state.ts` (`DayTally` interface + `emptyTally`)

**Interfaces:**
- Produces: `DayTally.secretChoice: { pokemonId: string } | null` (escolha de Habilidade Secreta pendente do Destaque de hoje; null se nenhuma). `emptyTally()` inicializa `secretChoice: null`.

- [ ] **Step 1: Adicionar o campo na interface**

Em `src/engine/state.ts`, na interface `DayTally`, logo APÓS o campo `secretUnlock`, adicionar:

```ts
  /**
   * Escolha de Habilidade Secreta PENDENTE do Destaque do Dia (resolvida pelo jogador na tela de
   * resumo via CHOOSE_SECRET). null = nenhuma escolha pendente. Ao resolver, vira `secretUnlock`.
   */
  secretChoice: { pokemonId: string } | null
```

- [ ] **Step 2: Inicializar em `emptyTally`**

No objeto retornado por `emptyTally()`, adicionar após `secretUnlock: null,`:

```ts
    secretChoice: null,
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: pode falhar SÓ em `phaseFlow.ts` (a função antiga) — será tratado na Task 2. `state.ts` compila.

- [ ] **Step 4: Commit**

```bash
git add src/engine/state.ts
git commit -m "feat(secret): campo secretChoice (escolha pendente) em DayTally"
```

---

### Task 2: Flow — `prepareSecretChoice` + `chooseSecretAbility`

**Files:**
- Modify: `src/game/phaseFlow.ts` (substitui `unlockSecretAbility`; ajusta a chamada em `finalizeDay`)
- Modify/replace: `src/game/secretUnlock.test.ts` (testa as duas funções novas)

**Interfaces:**
- Consumes: `secretLineFor`, `secretLevelOf` (`src/data/secretAbilities.ts`).
- Produces:
  - `prepareSecretChoice(s: GameState, mvpId: string | null): void` — define `s.today.secretUnlock = null`; se o MVP existe, tem linha, e está elegível (picks `[]` OU 1 pick nível 1), define `s.today.secretChoice = { pokemonId: mvpId }`; senão `s.today.secretChoice = null`. NÃO muta `secretPicks`.
  - `chooseSecretAbility(s: GameState, slot: 0 | 1, level: 1 | 2): void` — aplica a escolha do pokemon em `s.today.secretChoice`, validando legalidade; grava `secretPicks` novo + `s.today.secretUnlock` (com `choice`) e limpa `s.today.secretChoice`. No-op se não há escolha pendente ou a transição é ilegal.
  - REMOVE `unlockSecretAbility`.

- [ ] **Step 1: Reescrever o teste (TDD)**

Substituir o conteúdo de `src/game/secretUnlock.test.ts` por:

```ts
import { describe, expect, it } from 'vitest'
import { makeMon } from '../engine/testkit.ts'
import { secretLevelOf } from '../data/secretAbilities.ts'
import { prepareSecretChoice, chooseSecretAbility } from './phaseFlow.ts'
import { createInitialState, type GameState } from '../engine/state.ts'

function stateWith(mon: ReturnType<typeof makeMon>): GameState {
  const s = createInitialState(1)
  s.roster = [mon]
  return s
}

describe('prepareSecretChoice', () => {
  it('Destaque sem picks → escolha pendente (1º destaque), sem mutar picks', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 })) // Squirtle [surf, torrent]
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toEqual({ pokemonId: 'p1' })
    expect(s.today.secretUnlock).toBeNull()
    expect(s.roster[0]!.secretPicks ?? []).toEqual([])
  })

  it('Destaque com 1 pick nível 1 → escolha pendente (2º destaque)', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toEqual({ pokemonId: 'p1' })
  })

  it('Destaque já com 2 picks → sem escolha', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }, { slot: 1, level: 1 }] }))
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toBeNull()
  })

  it('Destaque com 1 pick nível 2 → sem escolha', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 2 }] }))
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toBeNull()
  })

  it('sem MVP ou sem linha → sem escolha', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 19 })) // Rattata: sem linha secreta
    prepareSecretChoice(s, 'p1')
    expect(s.today.secretChoice).toBeNull()
    prepareSecretChoice(s, null)
    expect(s.today.secretChoice).toBeNull()
  })
})

describe('chooseSecretAbility', () => {
  it('1º destaque: escolhe slot 1 → nível 1, reveal choice=first', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 }))
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 1, 1)
    expect(s.roster[0]!.secretPicks).toEqual([{ slot: 1, level: 1 }])
    expect(s.today.secretUnlock).toMatchObject({ pokemonId: 'p1', slot: 1, level: 1, choice: 'first' })
    expect(s.today.secretChoice).toBeNull()
  })

  it('2º destaque aprofundar: mesmo slot → nível 2, choice=deepen', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 0, 2)
    expect(s.roster[0]!.secretPicks).toEqual([{ slot: 0, level: 2 }])
    expect(s.today.secretUnlock).toMatchObject({ slot: 0, level: 2, choice: 'deepen' })
  })

  it('2º destaque ampliar: outro slot → nível 1, choice=widen', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7, secretPicks: [{ slot: 0, level: 1 }] }))
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 1, 1)
    expect(secretLevelOf(s.roster[0]!, 'sa-surf')).toBe(1)
    expect(secretLevelOf(s.roster[0]!, 'sa-torrent')).toBe(1)
    expect(s.today.secretUnlock).toMatchObject({ slot: 1, level: 1, choice: 'widen' })
  })

  it('rejeita escolha ilegal (sem escolha pendente, ou transição inválida)', () => {
    const s = stateWith(makeMon({ id: 'p1', speciesId: 7 }))
    // sem secretChoice pendente
    chooseSecretAbility(s, 0, 1)
    expect(s.roster[0]!.secretPicks ?? []).toEqual([])
    // pendente, mas tentar nível 2 no 1º destaque (ilegal)
    s.today.secretChoice = { pokemonId: 'p1' }
    chooseSecretAbility(s, 0, 2)
    expect(s.roster[0]!.secretPicks ?? []).toEqual([])
    expect(s.today.secretChoice).toEqual({ pokemonId: 'p1' }) // permanece pendente
  })
})
```

- [ ] **Step 2: Rodar (RED)**

Run: `npm test -- secretUnlock`
Expected: FALHA (`prepareSecretChoice`/`chooseSecretAbility` não existem).

- [ ] **Step 3: Implementar as duas funções e ajustar `finalizeDay`**

Em `src/game/phaseFlow.ts`, substituir a função `unlockSecretAbility` por:

```ts
/**
 * Destaque do Dia: REGISTRA uma escolha de Habilidade Secreta pendente (resolvida pelo jogador na
 * tela de resumo). Elegível se o MVP tem linha e ainda não usou os 2 destaques: picks vazio
 * (1º destaque) ou 1 pick no nível 1 (2º destaque). Não muta `secretPicks`.
 */
export function prepareSecretChoice(s: GameState, mvpId: string | null): void {
  s.today.secretUnlock = null
  s.today.secretChoice = null
  if (!mvpId) return
  const mon = s.roster.find((p) => p.id === mvpId)
  if (!mon || !secretLineFor(mon.speciesId)) return
  const picks = mon.secretPicks ?? []
  const eligible = picks.length === 0 || (picks.length === 1 && picks[0]?.level === 1)
  if (eligible) s.today.secretChoice = { pokemonId: mvpId }
}

/**
 * Aplica a escolha do jogador para o Pokémon em `today.secretChoice`: grava `secretPicks` e o
 * `secretUnlock` (reveal). Valida a legalidade da transição; no-op se ilegal ou sem escolha pendente.
 * - 1º destaque (picks []): `(slot, 1)` → `[{slot,1}]`, choice 'first'.
 * - 2º destaque aprofundar: `(slotAtual, 2)` → `[{slot,2}]`, choice 'deepen'.
 * - 2º destaque ampliar: `(outroSlot, 1)` → adiciona, choice 'widen'.
 */
export function chooseSecretAbility(s: GameState, slot: 0 | 1, level: 1 | 2): void {
  const pending = s.today.secretChoice
  if (!pending) return
  const mon = s.roster.find((p) => p.id === pending.pokemonId)
  if (!mon || !secretLineFor(mon.speciesId)) return
  const picks = mon.secretPicks ?? []

  let next: { slot: 0 | 1; level: 1 | 2 }[] | null = null
  let choice: 'first' | 'deepen' | 'widen' | null = null

  if (picks.length === 0) {
    // 1º destaque: só nível 1, slot 0 ou 1.
    if (level === 1) {
      next = [{ slot, level: 1 }]
      choice = 'first'
    }
  } else if (picks.length === 1 && picks[0]?.level === 1) {
    const cur = picks[0]
    if (slot === cur.slot && level === 2) {
      next = [{ slot: cur.slot, level: 2 }]
      choice = 'deepen'
    } else if (slot !== cur.slot && level === 1) {
      next = [cur, { slot, level: 1 }]
      choice = 'widen'
    }
  }

  if (!next || !choice) return // transição ilegal: mantém pendente
  s.roster = s.roster.map((p) => (p.id === mon.id ? { ...p, secretPicks: next } : p))
  s.today.secretUnlock = { pokemonId: mon.id, slot, level, choice }
  s.today.secretChoice = null
}
```

Na `finalizeDay`, trocar a chamada `unlockSecretAbility(s, summary.mvpId)` por
`prepareSecretChoice(s, summary.mvpId)`. (Manter `applyDailyHearts(s, summary.mvpId)` e o resto.)
Conferir que o import da linha ~22 ainda traz `secretLineFor` (e `secretLevelOf` se usado).

- [ ] **Step 4: Rodar (GREEN)**

Run: `npm test -- secretUnlock`
Expected: PASS (todos os casos).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: falha só no reducer/SummaryScreen se referenciarem o nome antigo — Tasks 3-4. `phaseFlow.ts` compila.

- [ ] **Step 6: Commit**

```bash
git add src/game/phaseFlow.ts src/game/secretUnlock.test.ts
git commit -m "feat(secret): prepareSecretChoice + chooseSecretAbility (escolha do jogador)"
```

---

### Task 3: Ação `CHOOSE_SECRET` + wiring no reducer

**Files:**
- Modify: `src/game/actions.ts` (novo membro do union `GameAction`)
- Modify: `src/game/reducer.ts` (import + case)
- Modify: `src/game/reducer.test.ts` (teste do case)

**Interfaces:**
- Consumes: `chooseSecretAbility` (Task 2).
- Produces: ação `{ type: 'CHOOSE_SECRET'; slot: 0 | 1; level: 1 | 2 }`; reducer chama `chooseSecretAbility(s, action.slot, action.level)`.

- [ ] **Step 1: Adicionar a ação**

Em `src/game/actions.ts`, no union `GameAction`, adicionar:

```ts
  /** Resolve a escolha de Habilidade Secreta do Destaque na tela de resumo (Fase 2). */
  | { type: 'CHOOSE_SECRET'; slot: 0 | 1; level: 1 | 2 }
```

- [ ] **Step 2: Teste do reducer (TDD)**

Em `src/game/reducer.test.ts`, adicionar (seguir o padrão dos testes existentes do arquivo —
verificar como montam `state`/dispatcham):

```ts
it('CHOOSE_SECRET aplica a escolha pendente do Destaque', () => {
  let s = createInitialState(1)
  s.roster = [makeMon({ id: 'p1', speciesId: 7 })] // Squirtle [surf, torrent]
  s.today.secretChoice = { pokemonId: 'p1' }
  s = reducer(s, { type: 'CHOOSE_SECRET', slot: 0, level: 1 })
  expect(s.roster[0]!.secretPicks).toEqual([{ slot: 0, level: 1 }])
  expect(s.today.secretUnlock).toMatchObject({ slot: 0, level: 1, choice: 'first' })
  expect(s.today.secretChoice).toBeNull()
})
```

(Importar `createInitialState` e `makeMon` como os outros testes do arquivo já fazem; se o arquivo
ainda não importa `makeMon`, adicione `import { makeMon } from '../engine/testkit.ts'`.)

- [ ] **Step 3: Rodar (RED)**

Run: `npm test -- reducer`
Expected: FALHA (ação desconhecida / tipo).

- [ ] **Step 4: Wiring no reducer**

Em `src/game/reducer.ts`: adicionar ao import de `./phaseFlow.ts`:
`import { advancePhase, setSpeed, chooseSecretAbility } from './phaseFlow.ts'` e um case:

```ts
    case 'CHOOSE_SECRET':
      chooseSecretAbility(s, action.slot, action.level)
      break
```

- [ ] **Step 5: Rodar (GREEN) + build**

Run: `npm test -- reducer`
Expected: PASS.
Run: `npm run build`
Expected: falha só na SummaryScreen (Task 4) se ainda usa algo antigo. reducer/actions compilam.

- [ ] **Step 6: Commit**

```bash
git add src/game/actions.ts src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat(secret): acao CHOOSE_SECRET no reducer"
```

---

### Task 4: UI da escolha na `SummaryScreen` + bloqueio do "Próximo dia"

**Files:**
- Modify: `src/components/screens/SummaryScreen.tsx`
- Modify: `src/components/screens/SummaryScreen.module.css` (estilos dos botões de escolha)

**Interfaces:**
- Consumes: `state.today.secretChoice`, `state.today.secretUnlock`, `secretLineFor`, `SECRET_KINDS`, ação `CHOOSE_SECRET`.
- Produces: bloco de escolha; botão "Próximo dia" só aparece quando não há escolha pendente.

- [ ] **Step 1: Calcular a escolha pendente**

Em `SummaryScreen.tsx`, após o cálculo de `unlock`/`unlockedAbility` (linha ~73), adicionar:

```tsx
  // Escolha de Habilidade Secreta pendente do Destaque (Fase 2).
  const choice = state.today.secretChoice
  const choiceMon = choice ? state.roster.find((p) => p.id === choice.pokemonId) : undefined
  const choicePair = choiceMon ? secretLineFor(choiceMon.speciesId) : null
  const choicePicks = choiceMon?.secretPicks ?? []
  const choicePending = Boolean(choice && choiceMon && choicePair)
```

- [ ] **Step 2: Renderizar o bloco de escolha**

Logo ANTES do bloco de reveal existente (`{unlockedAbility && ...}`), inserir:

```tsx
      {choicePending && choiceMon && choicePair && (
        <div className={styles.secretChoice}>
          <span className={styles.secretChoiceTitle}>
            ★ {displayNameOf(choiceMon)} virou Destaque — escolha sua Habilidade Secreta
          </span>
          <div className={styles.secretChoiceOptions}>
            {choicePicks.length === 0
              ? ([0, 1] as const).map((slot) => {
                  const kind = SECRET_KINDS[choicePair[slot]]
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
                })
              : (() => {
                  const cur = choicePicks[0]!
                  const curKind = SECRET_KINDS[choicePair[cur.slot]]
                  const other = (cur.slot === 0 ? 1 : 0) as 0 | 1
                  const otherKind = SECRET_KINDS[choicePair[other]]
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
                })()}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Bloquear "Próximo dia" enquanto pendente**

Trocar a seção final `{lastDay ? (<FinalResult .../>) : (<>...Próximo dia...</>)}` para esconder o
botão de avançar quando `choicePending`:

```tsx
      {lastDay ? (
        <FinalResult
          missionStars={summary.missionStarsAfter}
          battleStars={summary.battleStarsAfter}
          roster={state.roster}
          onRestart={onRestart}
        />
      ) : choicePending ? (
        <Textbox>Escolha a Habilidade Secreta do seu Destaque para continuar.</Textbox>
      ) : (
        <>
          <Textbox>Bom trabalho! Pronto para o próximo dia?</Textbox>
          <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'ADVANCE_PHASE' })}>
            Próximo dia ▶
          </button>
        </>
      )}
```

- [ ] **Step 4: CSS dos botões de escolha**

Em `src/components/screens/SummaryScreen.module.css`, adicionar (seguir as variáveis de tema já
usadas no arquivo — reusar cores de `.secretReveal`/`.primary` existentes):

```css
.secretChoice {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
}
.secretChoiceTitle {
  font-weight: 700;
  color: var(--c-hud-accent);
  text-align: center;
}
.secretChoiceOptions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.secretChoiceBtn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 240px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  border: 2px solid var(--c-hud-accent);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
}
.secretChoiceBtn:hover {
  background: rgba(255, 203, 5, 0.15);
}
.secretChoiceBtn b {
  color: var(--c-hud-accent);
}
.secretChoiceBtn span {
  font-size: 0.85em;
  opacity: 0.9;
}
```

> Conferir no `.module.css` quais variáveis de cor existem (ex.: `--c-hud-accent`) e reusar; se o
> nome diferir, usar o que o arquivo já usa para o reveal.

- [ ] **Step 5: Build + suíte completa + verificação leve de DOM**

Run: `npm run build`
Expected: PASS.
Run: `npm test`
Expected: toda a suíte verde.

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/SummaryScreen.tsx src/components/screens/SummaryScreen.module.css
git commit -m "feat(secret): UI de escolha da Habilidade Secreta no resumo"
```

---

## Self-Review (Fase 2)

- **Cobertura:** escolha 1º destaque (slot) → Task 2/4; escolha 2º destaque (aprofundar/ampliar) →
  Task 2/4; pendência em estado → Task 1; ação/reducer → Task 3; UI + bloqueio do avanço → Task 4.
- **Sem placeholders:** todo código está nas tasks; os `// …`/comentários apontam verificações
  concretas (variáveis de CSS, padrão de teste do reducer).
- **Consistência de tipos:** `chooseSecretAbility(s, slot:0|1, level:1|2)`; ação `CHOOSE_SECRET
  {slot,level}`; `secretChoice:{pokemonId}|null`; `secretUnlock` choice ∈ first|deepen|widen — usados
  igualmente nas Tasks 1-4.

## Fora de escopo (fases seguintes)
- Magnitudes de efeito por nível (Fase 3) e efeitos novos de batalha/clima (Fase 4).
- Skill `managing-pokemon-species` + PR (Fase 5).
