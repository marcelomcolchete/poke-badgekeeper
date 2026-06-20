# Roubo Rocket — Clicar no pop-up + pausar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir a perseguição da Rocket clicando no pop-up "R" do mapa (removendo o botão flutuante) e pausar o tempo enquanto o menu de escolha do time está aberto.

**Architecture:** Mudança puramente de UI em `CityMap.tsx` (pop-up "R" vira botão com `onTheft`) e `DayScreen.tsx` (remove botão flutuante, liga `onTheft`, adiciona `chaseOpen` à condição de pausa existente). Nenhuma mudança de engine/estado.

**Tech Stack:** React + TypeScript + Vite + vitest.

## Global Constraints

- Build com `npm run build` (tsc -b) — nunca `tsc --noEmit`. Testes com `npx vitest run`.
- Comentários em PT-BR seguindo o estilo do repo.
- Não alterar engine/`theftFlow`/estado — só UI.
- Branch: `feat/rocket-overhaul` (commits entram no PR #80).
- Spec: `docs/superpowers/specs/2026-06-20-roubo-rocket-clicar-pausar-design.md`.

---

### Task 1: Pop-up "R" clicável + remover botão flutuante + pausar

**Files:**
- Modify: `src/components/day/CityMap.tsx` (Props ~37-42; render do "R" ~271-285)
- Modify: `src/components/day/CityMap.module.css` (`.rocket`)
- Modify: `src/components/day/DayScreen.tsx` (pausa ~124; botão flutuante ~244-248; `<CityMap>` ~209-214)
- Modify: `src/components/day/DayScreen.module.css` (`.theftAlert`, `@keyframes theftPulse`)

**Interfaces:**
- Produces: `CityMap` passa a aceitar a prop `onTheft: () => void`.
- Consumes: `DayScreen` já tem `setChaseOpen` e o estado `chaseOpen`.

- [ ] **Step 1: `CityMap` — adicionar prop `onTheft`**

Em `src/components/day/CityMap.tsx`, na interface `Props` (junto de `onMission`/`onDefense`/`onSpot`):

```tsx
interface Props {
  state: GameState
  onMission: (id: string) => void
  onDefense: (id: string) => void
  onSpot: (spotIndex: number) => void
  onTheft: () => void
}
```

E na assinatura do componente:

```tsx
export function CityMap({ state, onMission, onDefense, onSpot, onTheft }: Props) {
```

- [ ] **Step 2: `CityMap` — repassar `onTheft` ao `MapTravelers`**

`MapTravelers` é quem renderiza o "R". Passar a prop adiante. Trocar a chamada (~linha 139):

```tsx
        <MapTravelers state={state} graph={graph} now={now} onTheft={onTheft} />
```

E a assinatura de `MapTravelers` (~linha 230):

```tsx
function MapTravelers({ state, graph, now, onTheft }: { state: GameState; graph: CityGraph; now: number; onTheft: () => void }) {
```

- [ ] **Step 3: `CityMap` — "R" vira `<button>` clicável**

No bloco do roubo dentro de `MapTravelers` (~linhas 271-285), trocar o `<div className={styles.rocket}>` por um `<button>`:

```tsx
      {state.theft && (() => {
        const rocketPos = theftPos(graph, state.theft, now)
        return (
          <>
            {rocketPos && (
              <button
                type="button"
                className={styles.rocket}
                style={posStyle(rocketPos)}
                onClick={onTheft}
                aria-label="Equipe Rocket — perseguir"
              >
                R
              </button>
            )}
            {chaserPositionsAt(state, now).map(({ id, pos }) => (
              <TravelerGroup key={`chaser-${id}`} pos={pos} ids={[id]} roster={state.roster} />
            ))}
          </>
        )
      })()}
```

- [ ] **Step 4: CSS — `.rocket` como botão**

Em `src/components/day/CityMap.module.css`, no seletor `.rocket`, garantir aparência de botão clicável sem fundo/borda padrão. Adicionar (ou mesclar com o existente) — manter o visual atual do "R" vermelho, só acrescentar:

```css
.rocket {
  /* (manter as regras atuais de posição/cor/tamanho do "R") */
  cursor: pointer;
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
}
```

> Ao implementar: ler o bloco `.rocket` atual e MESCLAR estas linhas, preservando cor/tamanho/posição existentes (não sobrescrever a cor vermelha do "R").

- [ ] **Step 5: `DayScreen` — ligar `onTheft` e remover o botão flutuante**

Em `src/components/day/DayScreen.tsx`:

1. No `<CityMap>` (~209-214), adicionar a prop:

```tsx
        <CityMap
          state={state}
          onMission={(id) => setOpen({ kind: 'mission', id })}
          onDefense={(id) => setOpen({ kind: 'defense', id })}
          onSpot={(spotIndex) => setOpen({ kind: 'capture', spotIndex })}
          onTheft={() => setChaseOpen(true)}
        />
```

2. Remover o bloco do botão flutuante (~244-248):

```tsx
        {/* Botão flutuante de perseguição Rocket (Feature B): visível enquanto a Rocket está em fuga. */}
        {(state.theft?.phase === 'fleeing' || state.theft?.phase === 'atFarNode') && (
          <button type="button" className={styles.theftAlert} onClick={() => setChaseOpen(true)}>
            🚨 Perseguir a Rocket
          </button>
        )}
```

(deletar essas linhas inteiras)

3. Atualizar o comentário do estado `chaseOpen` (~81-82) para refletir a nova origem:

```tsx
  // Painel de perseguição da Rocket (Feature B): abre clicando no pop-up "R" do mapa.
  const [chaseOpen, setChaseOpen] = useState(false)
```

- [ ] **Step 6: `DayScreen` — pausar o tempo com `chaseOpen`**

Na condição de pausa (~124), incluir `chaseOpen`:

```tsx
  // Abrir qualquer painel/detalhe OU revelar uma missão pausa o tempo; fechar retoma.
  useEffect(() => {
    onPauseChange(open !== null || memberId !== null || revealId !== null || chaseOpen)
    return () => onPauseChange(false)
  }, [open, memberId, revealId, chaseOpen, onPauseChange])
```

(incluir `chaseOpen` também no array de dependências do `useEffect`)

- [ ] **Step 7: CSS — remover `.theftAlert` e `@keyframes theftPulse`**

Em `src/components/day/DayScreen.module.css`, remover o seletor `.theftAlert` e o `@keyframes theftPulse` (não há mais consumidores após o Step 5).

- [ ] **Step 8: Verificar build + suíte**

Run: `npm run build`
Expected: tsc -b + vite build verdes, zero erros (em especial: nenhum aviso de `theftAlert` não usado, nenhuma prop faltando em `CityMap`).

Run: `npx vitest run`
Expected: suíte inteira verde (638/638 ou o total atual), sem regressões.

- [ ] **Step 9: Commit**

```bash
git add src/components/day/CityMap.tsx src/components/day/CityMap.module.css src/components/day/DayScreen.tsx src/components/day/DayScreen.module.css
git commit -m "feat(theft): clicar no 'R' abre a perseguicao e pausa o tempo (remove botao flutuante)"
```

---

## Self-Review

**1. Spec coverage:**
- Pop-up "R" clicável → Steps 1-4. ✅
- Remover botão flutuante → Steps 5(2), 7. ✅
- Pausar ao abrir o menu → Step 6. ✅
- CSS do "R" como botão → Step 4. ✅

**2. Placeholder scan:** Sem TBD/TODO; todo código é literal. O único "ler e mesclar" (Step 4) é intencional (preservar regras de cor existentes do `.rocket`), com instrução explícita.

**3. Type consistency:** `onTheft: () => void` é usado de forma idêntica em `CityMap` Props, na assinatura do componente, no `MapTravelers` e no `<CityMap>` do `DayScreen`. `chaseOpen`/`setChaseOpen` já existem.
