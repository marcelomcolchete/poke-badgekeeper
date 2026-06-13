// Shell do jogo (PLAN §3/§5): liga estado+relógio e roteia pela fase da run.
// A engine/o reducer permanecem puros; os hooks cuidam de save e tempo real.

import { useState } from 'react'
import { createInitialState } from './engine/state.ts'
import { clearSave } from './persistence/saveLoad.ts'
import { useGameState } from './game/useGameState.ts'
import { useGameClock } from './game/useGameClock.ts'
import { CitySelectScreen } from './components/screens/CitySelectScreen.tsx'
import { NewGameScreen } from './components/screens/NewGameScreen.tsx'
import { MorningScreen } from './components/screens/MorningScreen.tsx'
import { SummaryScreen } from './components/screens/SummaryScreen.tsx'
import { DayScreen } from './components/day/DayScreen.tsx'
import styles from './App.module.css'

function freshState() {
  return createInitialState(Math.floor(Date.now()))
}

export default function App() {
  const [state, dispatch] = useGameState(freshState)
  const [uiPaused, setUiPaused] = useState(false)
  const [cityChosen, setCityChosen] = useState(false)
  useGameClock(state, dispatch, uiPaused)

  const restart = (): void => {
    clearSave()
    window.location.reload()
  }

  const needsSetup = state.gym.types.length === 0

  return (
    <div className={styles.app}>
      <div className={styles.frame}>
        {needsSetup ? (
          cityChosen ? (
            <NewGameScreen state={state} dispatch={dispatch} />
          ) : (
            <CitySelectScreen onChoose={() => setCityChosen(true)} />
          )
        ) : state.run.phase === 'SUMMARY' ? (
          <SummaryScreen state={state} dispatch={dispatch} onRestart={restart} />
        ) : state.run.phase === 'DAY' ? (
          <DayScreen state={state} dispatch={dispatch} onRestart={restart} onPauseChange={setUiPaused} />
        ) : (
          <MorningScreen state={state} dispatch={dispatch} />
        )}
      </div>
    </div>
  )
}
