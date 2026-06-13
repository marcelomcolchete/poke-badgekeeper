import { useEffect, useState } from 'react'
import { Hud } from './components/Hud/Hud.tsx'
import { createInitialState } from './engine/state.ts'
import type { GameState } from './engine/state.ts'
import { loadGame, saveGame } from './persistence/saveLoad.ts'
import { TOTAL_DAYS } from './engine/constants.ts'
import type { GameSpeed } from './types/index.ts'
import styles from './App.module.css'

/**
 * Shell mínimo da Fase 0: prova que o projeto roda (Vite + React + CSS Modules),
 * exercitando a engine (estado inicial), a persistência (autosave) e a paleta retrô.
 * O mapa da cidade, popups e demais telas chegam nas Fases 3–4.
 */
export default function App() {
  const [state, setState] = useState<GameState>(
    () => loadGame() ?? createInitialState(Math.floor(Date.now())),
  )

  useEffect(() => {
    saveGame(state, Date.now())
  }, [state])

  const setSpeed = (speed: GameSpeed) => {
    setState((prev) => ({ ...prev, clock: { ...prev.clock, speed } }))
  }

  return (
    <div className={styles.app}>
      <div className={styles.frame}>
        <Hud
          day={state.run.day}
          totalDays={TOTAL_DAYS}
          elapsedMs={state.clock.dayElapsedMs}
          dayLengthMs={state.clock.dayLengthMs}
          speed={state.clock.speed}
          gold={state.gold}
          stars={state.approval.stars}
          onSpeedChange={setSpeed}
        />

        <div className={styles.stage}>
          <span className={styles.badge}>FASE 0 — SCAFFOLD</span>
          <span className={styles.title}>Poke BadgeKeeper</span>
          <span className={styles.subtitle}>
            Engine, persistência e estilo prontos. O mapa da cidade vem nas próximas fases.
          </span>
        </div>

        <div className={styles.dialog}>
          Bem-vindo, novo líder de ginásio! Você tem 10 dias para provar seu valor em Pewter.
          <span className={styles.cursor}>▼</span>
        </div>
      </div>
    </div>
  )
}
