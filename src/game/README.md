# `game/` — orquestração em tempo real (Fase 3)

Camada que liga a UI à engine pura. A implementar na **Fase 3**:

- `actions.ts` — tipos de ação (`SEND_TEAM`, `ASSIGN_DEFENSE`, `BUY_ITEM`, `SET_SPEED`…).
- `reducer.ts` — aplica ações chamando a engine (`engine/`).
- `useGameClock.ts` — loop do dia (rAF/setInterval) com pausa/x2/x3; dispara spawns agendados.
- `useGameState.ts` — estado + dispatch + autosave no localStorage.

Regra: a engine permanece pura; o `game/` é o único lugar que toca `Date.now()`/timers.
