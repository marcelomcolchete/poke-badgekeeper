// Shell do jogo (PLAN §3/§5): liga estado+relógio e roteia pela fase da run.
// A engine/o reducer permanecem puros; os hooks cuidam de save e tempo real.

import { useState } from 'react'
import { createInitialState } from './engine/state.ts'
import { clearSave } from './persistence/saveLoad.ts'
import { pendingPoints } from './engine/leveling.ts'
import { useGameState } from './game/useGameState.ts'
import { useGameClock } from './game/useGameClock.ts'
import { CitySelectScreen } from './components/screens/CitySelectScreen.tsx'
import { NewGameScreen } from './components/screens/NewGameScreen.tsx'
import { MorningScreen } from './components/screens/MorningScreen.tsx'
import { SummaryScreen } from './components/screens/SummaryScreen.tsx'
import { GameOverScreen } from './components/screens/GameOverScreen.tsx'
import { DayScreen } from './components/day/DayScreen.tsx'
import { LevelUpModal } from './components/LevelUpModal/LevelUpModal.tsx'
import { MuteButton } from './audio/MuteButton.tsx'
import { useGameSounds } from './audio/useGameSounds.ts'
import { playSound } from './audio/sounds.ts'
import styles from './App.module.css'

// Som de clique global: qualquer botão da UI, sem precisar instrumentar um a um.
function handleClickSound(e: React.MouseEvent): void {
  if ((e.target as HTMLElement).closest('button, [role="button"]')) playSound('click')
}

function freshState() {
  return createInitialState(Math.floor(Date.now()))
}

export default function App() {
  const [state, dispatch] = useGameState(freshState)
  const [uiPaused, setUiPaused] = useState(false)
  const [cityChosen, setCityChosen] = useState(false)

  const needsSetup = state.gym.types.length === 0
  // Pokémon do jogador esperando alocação de level-up (modal imediato, PLAN §4.1).
  const levelingUp = needsSetup ? undefined : state.roster.find((p) => pendingPoints(p) > 0)

  // O relógio congela com qualquer painel aberto OU enquanto há level-up a distribuir.
  useGameClock(state, dispatch, uiPaused || levelingUp !== undefined)

  // Sons disparados por transições do estado (nova missão, sucesso/fracasso, level-up, aviso).
  useGameSounds(state)

  const restart = (): void => {
    clearSave()
    window.location.reload()
  }

  return (
    <div className={styles.app} onClickCapture={handleClickSound}>
      <MuteButton />
      <div className={styles.frame}>
        {needsSetup ? (
          cityChosen ? (
            <NewGameScreen state={state} dispatch={dispatch} />
          ) : (
            <CitySelectScreen onChoose={() => setCityChosen(true)} />
          )
        ) : state.run.phase === 'GAMEOVER' ? (
          <GameOverScreen onRestart={restart} />
        ) : state.run.phase === 'SUMMARY' ? (
          <SummaryScreen state={state} dispatch={dispatch} onRestart={restart} />
        ) : state.run.phase === 'DAY' ? (
          <DayScreen state={state} dispatch={dispatch} onRestart={restart} onPauseChange={setUiPaused} />
        ) : (
          <MorningScreen state={state} dispatch={dispatch} />
        )}
      </div>
      {levelingUp && <LevelUpModal pokemon={levelingUp} dispatch={dispatch} />}
    </div>
  )
}
