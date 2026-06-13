# `game/` — orquestração em tempo real (Fase 3)

Camada que liga a UI à engine pura. A engine permanece pura; o `game/` é o único
lugar que toca `Date.now()`/timers (nos hooks). O reducer é **puro e determinístico**.

- `actions.ts` — união de ações (`TICK`, `SET_SPEED`, `ADVANCE_PHASE`, `ACCEPT_MISSION`,
  `ASSIGN_DEFENSE`, `START_SEARCH`, `CAPTURE_*`, `BUY_ITEM`, `USE_ITEM`, `ALLOCATE_POINT`).
- `reducer.ts` — aplica a ação a um rascunho (clone) chamando a engine; entrada intacta.
- `runtime.ts` — ids e sub-seeds de RNG determinísticos a partir de contadores no estado.
- `setup.ts` — `setupDay` (agenda → eventos `scheduled`) e `autoSeedRun` (bootstrap provisório).
- `dayClock.ts` — processa o `TICK`: spawn, expiração e resolução por tempo; fecha o dia aos 180s.
- `missionFlow.ts` · `defenseFlow.ts` · `captureFlow.ts` · `marketFlow.ts` · `phaseFlow.ts`
  — os fluxos por domínio chamados pelo reducer.
- `useGameState.ts` — `useReducer` + carga do save + autosave debounced.
- `useGameClock.ts` — loop rAF: tempo de parede × velocidade → `TICK`.

Fases do dia: **MORNING → DAY → SUMMARY → (próximo dia)**. A captura acontece DENTRO do
DAY pelos spots do mapa (§4.5); a fase `CAPTURE` do enum fica reservada à tela de captura
(Fase 4). O fluxo interativo de novo jogo (sorteio de tipos + inicial, §3) também é Fase 4.
