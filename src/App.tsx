// Shell do jogo (PLAN §3/§5): liga estado+relógio e roteia pela fase da run.
// A engine/o reducer permanecem puros; os hooks cuidam de save e tempo real.

import { useState } from 'react'
import { createInitialState } from './engine/state.ts'
import { clearSave } from './persistence/saveLoad.ts'
import { pendingPoints } from './engine/leveling.ts'
import { isHired } from './engine/approval.ts'
import { TOTAL_DAYS } from './engine/constants.ts'
import { useGameState } from './game/useGameState.ts'
import { useGameClock } from './game/useGameClock.ts'
import { HomeScreen } from './components/screens/HomeScreen.tsx'
import { CitySelectScreen } from './components/screens/CitySelectScreen.tsx'
import { NewGameScreen } from './components/screens/NewGameScreen.tsx'
import { MorningScreen } from './components/screens/MorningScreen.tsx'
import { SummaryScreen } from './components/screens/SummaryScreen.tsx'
import { EndGameScreen } from './components/screens/EndGameScreen.tsx'
import { DayScreen } from './components/day/DayScreen.tsx'
import { LevelUpModal } from './components/LevelUpModal/LevelUpModal.tsx'
import { EggHatchModal } from './components/EggHatchModal/EggHatchModal.tsx'
import { MuteButton } from './audio/MuteButton.tsx'
import { useGameSounds } from './audio/useGameSounds.ts'
import { playSound } from './audio/sounds.ts'
import styles from './App.module.css'

// Nomes acessíveis que denotam cancelar/fechar/voltar → som de "deselect".
const DESELECT_RE = /\b(fechar|cancelar|voltar|sair|dispensar|descartar)\b|^[✕×✖]$/i

/** Decide o som de um botão da UI: 'select' (confirmar/escolher) ou 'deselect' (cancelar/fechar/desmarcar). */
function uiSoundFor(el: HTMLElement): 'select' | 'deselect' {
  const explicit = el.dataset.sound // override: data-sound="select|deselect"
  if (explicit === 'select' || explicit === 'deselect') return explicit
  const pressed = el.getAttribute('aria-pressed') // toggle: já selecionado → desmarca
  if (pressed === 'true') return 'deselect'
  if (pressed === 'false') return 'select'
  const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
  return DESELECT_RE.test(name) ? 'deselect' : 'select'
}

// Som global de UI: qualquer botão, sem instrumentar um a um (capture roda antes do onClick do botão).
function handleClickSound(e: React.MouseEvent): void {
  const el = (e.target as HTMLElement).closest<HTMLElement>('button, [role="button"]')
  if (el && !(el as HTMLButtonElement).disabled) playSound(uiSoundFor(el))
}

function freshState() {
  return createInitialState(Math.floor(Date.now()))
}

export default function App() {
  const [state, dispatch] = useGameState(freshState)
  const [uiPaused, setUiPaused] = useState(false)
  const [cityChosen, setCityChosen] = useState(false)
  // Menu principal antes de qualquer fluxo de jogo; "Modo História" entra no jogo.
  const [started, setStarted] = useState(false)

  const needsSetup = state.gym.types.length === 0
  // Pokémon do jogador esperando alocação de level-up (modal imediato, PLAN §4.1).
  const levelingUp = needsSetup ? undefined : state.roster.find((p) => pendingPoints(p) > 0)

  // O relógio congela com qualquer painel aberto OU enquanto há level-up a distribuir.
  useGameClock(state, dispatch, uiPaused || levelingUp !== undefined || (state.pendingHatches?.length ?? 0) > 0)

  // Sons disparados por transições do estado (nova missão, sucesso/fracasso, level-up, aviso).
  useGameSounds(state)

  const restart = (): void => {
    clearSave()
    window.location.reload()
  }

  // A foto fica atrás de tudo; o véu escurece em tudo que não é a Home:
  // setup (escolha de ginásio/iniciais) e run (Manhã/Dia/Resumo/Fim).
  const darkened = started
  // "Próximo Ginásio" (vitória): começo limpo na cidade seguinte — refaz a escolha de iniciais.
  const goToGym = (cityIndex: number): void => {
    dispatch({ type: 'RESET_TO_CITY', cityIndex, seed: Math.floor(Date.now()) })
    setCityChosen(true)
  }

  // Dia 10 alcançado: vitória se efetivado (média ≥ 3); senão é derrota (só "Voltar").
  const wonLastDay = isHired(state.approval.missionStars, state.approval.battleStars)

  return (
    <div className={styles.app} onClickCapture={handleClickSound}>
      <div className={styles.bgImage} aria-hidden />
      <div className={styles.bgVeil} aria-hidden data-dark={darkened || undefined} />
      <MuteButton />
      {!started ? (
        <HomeScreen onPlayStory={() => setStarted(true)} />
      ) : (
        <div className={styles.frame}>
          {needsSetup ? (
          cityChosen ? (
            <NewGameScreen state={state} dispatch={dispatch} />
          ) : (
            <CitySelectScreen
              onChoose={(cityIndex) => {
                dispatch({ type: 'SELECT_CITY', cityIndex })
                setCityChosen(true)
              }}
            />
          )
        ) : state.run.phase === 'GAMEOVER' ? (
          <EndGameScreen state={state} outcome="loss" onBack={restart} />
        ) : state.run.phase === 'SUMMARY' && state.run.day >= TOTAL_DAYS ? (
          <EndGameScreen
            state={state}
            outcome={wonLastDay ? 'win' : 'loss'}
            onBack={restart}
            onNextGym={goToGym}
          />
        ) : state.run.phase === 'SUMMARY' ? (
          <SummaryScreen state={state} dispatch={dispatch} onRestart={restart} />
        ) : state.run.phase === 'DAY' ? (
          <DayScreen state={state} dispatch={dispatch} onRestart={restart} onPauseChange={setUiPaused} />
          ) : (
            <MorningScreen state={state} dispatch={dispatch} />
          )}
        </div>
      )}
      {levelingUp && <LevelUpModal pokemon={levelingUp} dispatch={dispatch} />}
      {state.pendingHatches?.[0] && <EggHatchModal hatch={state.pendingHatches[0]} dispatch={dispatch} />}
    </div>
  )
}
