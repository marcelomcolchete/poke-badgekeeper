# Roubo Rocket — Clicar no pop-up + pausar ao perseguir

**Data:** 2026-06-20
**Escopo:** ajuste de UX do Evento de Roubo Rocket (Feature B do rocket-overhaul). Um plano só.
**Branch:** `feat/rocket-overhaul` (mesmo do PR #80 — os commits entram no PR existente).

## Contexto

O Evento de Roubo Rocket já está implementado. Hoje:
- O painel de perseguição (`TheftChasePanel`) abre por um **botão flutuante** "🚨 Perseguir a Rocket"
  (`DayScreen.tsx`), visível nas fases `fleeing`/`atFarNode`.
- O pop-up "R" da Rocket no mapa (`CityMap.tsx`) é um `<div>` **não clicável**.
- Abrir o painel de perseguição **NÃO pausa** o tempo — a condição de pausa
  (`DayScreen.tsx:124`) cobre `open`/`memberId`/`revealId`, mas não `chaseOpen`.

## Objetivo

1. Abrir a perseguição **clicando no pop-up "R"** da Rocket no mapa.
2. **Remover** o botão flutuante (a perseguição passa a abrir só pelo pop-up, igual
   missões/defesas, que abrem clicando no marcador).
3. Ao abrir o menu de escolha do time, **pausar o tempo** — exatamente como o despacho de
   missão. "É como se fosse uma missão."

## Mudanças

### 1. Pop-up "R" clicável (`src/components/day/CityMap.tsx`)
- Converter o `<div className={styles.rocket}>` (~linha 276) em `<button type="button">` com
  `onClick`, espelhando `MissionMarker`/`DefenseMarker`.
- Adicionar a prop `onTheft: () => void` à interface `Props` do `CityMap` (ao lado de
  `onMission`/`onDefense`/`onSpot`) e chamá-la no clique do "R".
- `aria-label="Equipe Rocket — perseguir"`.
- O "R" só é renderizado quando `theftPos` retorna posição (fases `fleeing`/`atFarNode`),
  então a clicabilidade já fica limitada à fuga; nenhuma guarda extra de fase é necessária.

### 2. CSS do "R" como botão (`src/components/day/CityMap.module.css`)
- Ajustar `.rocket` para se comportar como botão: `cursor: pointer`, `border: none`,
  `background: transparent` no wrapper (mantendo o visual atual do "R" vermelho), preservando
  tamanho/posição. Garantir área de clique confortável.

### 3. Remover o botão flutuante (`src/components/day/DayScreen.tsx`)
- Remover o bloco condicional do botão `🚨 Perseguir a Rocket` (~linhas 244-248).
- Passar `onTheft={() => setChaseOpen(true)}` ao `<CityMap>`.
- Remover o CSS `.theftAlert` e `@keyframes theftPulse` de `DayScreen.module.css`.

### 4. Pausar ao abrir o menu (`src/components/day/DayScreen.tsx:124`)
- Incluir `chaseOpen` na condição de pausa:
  `onPauseChange(open !== null || memberId !== null || revealId !== null || chaseOpen)`.
- Efeito: abrir o `TheftChasePanel` congela o relógio (Rocket para de fugir; a janela de 5s
  de `atFarNode` congela) enquanto se escolhe o time; fechar (despachar **ou** cancelar) retoma
  de onde parou — mesmo comportamento do despacho de missão.

## Fora de escopo / inalterado

- A fase `battle` continua igual: o `TheftBattlePanel` abre sozinho e `enterTheftBattle` já
  zera `clock.speed`.
- Regras de despacho dos perseguidores (até 3) e a lógica do `theftFlow` não mudam.

## Verificação

- `npm run build` (tsc -b) e `npx vitest run` verdes.
- Os componentes de UI (DayScreen/CityMap) não têm testes unitários hoje; a mudança de
  pausa é lógica trivial (uma condição booleana). Validação por build + suíte existente — sem
  inventar teste de UI frágil.

## Decisões registradas (Q&A)

- Botão flutuante: **removido** (perseguição abre só pelo pop-up "R", consistente com os demais
  marcadores do mapa).
