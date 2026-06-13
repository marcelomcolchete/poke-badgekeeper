// Tela do Dia (PLAN §3.1): HUD no topo, mapa da cidade com marcadores, botões à
// esquerda (Time/Relatório/Desistir) e textbox na base. Abre os painéis conforme
// o jogador clica nos marcadores.

import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import type { GameSpeed } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { TOTAL_DAYS } from '../../engine/constants.ts'
import { missionGoal } from '../../engine/approval.ts'
import { Hud } from '../Hud/Hud.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { TeamPanel } from '../TeamPanel/TeamPanel.tsx'
import { CityMap } from './CityMap.tsx'
import { MissionDispatch } from './MissionDispatch.tsx'
import { DefensePanel } from './DefensePanel.tsx'
import { CapturePanel } from './CapturePanel.tsx'
import styles from './DayScreen.module.css'

type Selection =
  | { kind: 'mission'; id: string }
  | { kind: 'defense'; id: string }
  | { kind: 'capture'; spotIndex: number }
  | { kind: 'team' }
  | { kind: 'report' }
  | { kind: 'quit' }
  | null

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onRestart: () => void
  /** Avisa o App para congelar o relógio enquanto um painel está aberto. */
  onPauseChange: (paused: boolean) => void
}

export function DayScreen({ state, dispatch, onRestart, onPauseChange }: Props) {
  const [open, setOpen] = useState<Selection>(null)
  const close = (): void => setOpen(null)
  const setSpeed = (speed: GameSpeed): void => dispatch({ type: 'SET_SPEED', speed })

  // Abrir qualquer painel pausa o tempo (missões, defesa, captura…); fechar retoma.
  useEffect(() => {
    onPauseChange(open !== null)
    return () => onPauseChange(false)
  }, [open, onPauseChange])

  // Atalhos de teclado: 1/2/3 = velocidade; ` (tecla à esquerda do "1") e P = pausa/play.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '1') dispatch({ type: 'SET_SPEED', speed: 1 })
      else if (e.key === '2') dispatch({ type: 'SET_SPEED', speed: 2 })
      else if (e.key === '3') dispatch({ type: 'SET_SPEED', speed: 3 })
      else if (e.key === '`' || e.key === 'p' || e.key === 'P')
        dispatch({ type: 'SET_SPEED', speed: state.clock.speed === 0 ? 1 : 0 })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, state.clock.speed])

  return (
    <div className={styles.screen}>
      <CityMap
        state={state}
        onMission={(id) => setOpen({ kind: 'mission', id })}
        onDefense={(id) => setOpen({ kind: 'defense', id })}
        onSpot={(spotIndex) => setOpen({ kind: 'capture', spotIndex })}
      />

      <div className={styles.hudBar}>
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
      </div>

      <nav className={styles.sidebar} aria-label="Ações do treinador">
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actTeam}`}
          onClick={() => setOpen({ kind: 'team' })}
        >
          <span className={styles.actionIcon}>👥</span>
          <span className={styles.actionLabel}>Time</span>
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actReport}`}
          onClick={() => setOpen({ kind: 'report' })}
        >
          <span className={styles.actionIcon}>📋</span>
          <span className={styles.actionLabel}>Relatório</span>
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actQuit}`}
          onClick={() => setOpen({ kind: 'quit' })}
        >
          <span className={styles.actionIcon}>🚪</span>
          <span className={styles.actionLabel}>Desistir</span>
        </button>
      </nav>

      <div className={styles.textbox}>
        <Textbox>{dayHint(state)}</Textbox>
      </div>

      {open?.kind === 'mission' && (
        <MissionDispatch state={state} dispatch={dispatch} missionId={open.id} onClose={close} />
      )}
      {open?.kind === 'defense' && (
        <DefensePanel state={state} dispatch={dispatch} defenseId={open.id} onClose={close} />
      )}
      {open?.kind === 'capture' && (
        <CapturePanel state={state} dispatch={dispatch} spotIndex={open.spotIndex} onClose={close} />
      )}
      {open?.kind === 'team' && <TeamPanel state={state} dispatch={dispatch} onClose={close} />}
      {open?.kind === 'report' && <DayReport state={state} onClose={close} />}
      {open?.kind === 'quit' && <QuitConfirm onConfirm={onRestart} onClose={close} />}
    </div>
  )
}

function dayHint(state: GameState): string {
  if (state.defenses.some((d) => d.status === 'active')) {
    return 'Defesa no ginásio! Clique no símbolo de luta e monte um esquadrão (≥1).'
  }
  if (state.encounters.length > 0) return 'Um encontro de captura está pronto na área marcada!'
  const available = state.missions.filter((m) => m.status === 'available').length
  if (available > 0) return `${available} missão(ões) disponível(is). Clique num "!" para despachar seu time.`
  return 'Dia em andamento. Aguarde novas missões surgirem pela cidade…'
}

function DayReport({ state, onClose }: { state: GameState; onClose: () => void }) {
  const t = state.today
  const completed = t.missionResults.filter((m) => m.success).length
  const total = state.missions.length
  const goal = missionGoal(total) // metade do total, arredondando p/ cima (#6)
  const goalMet = total > 0 && completed >= goal
  const allDone = total > 0 && completed >= total
  return (
    <Overlay title="RELATÓRIO DO DIA" onClose={onClose}>
      <ul className={styles.report}>
        <li>Missões cumpridas: <b>{completed}</b> / {total}</li>
        <li>
          Meta do dia: <b className={goalMet ? styles.goalMet : undefined}>{goal}</b>
          {' '}<span className={styles.goalNote}>(★½ na meta · ★ em todas)</span>
        </li>
        <li>Defesas vencidas: <b>{t.defensesWon}</b> / {t.defensesTotal}</li>
        <li>Ouro do dia: <b>$ {t.goldEarned}</b></li>
        <li>Capturados: <b>{t.capturedIds.length}</b></li>
      </ul>
      <p className={styles.reward}>
        {allDone
          ? 'Todas as missões cumpridas — +1 estrela! ★'
          : goalMet
            ? 'Meta batida — +½ estrela! ★½'
            : `Faltam ${Math.max(0, goal - completed)} para a meta (½ estrela).`}
      </p>
    </Overlay>
  )
}

function QuitConfirm({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <Overlay title="DESISTIR" onClose={onClose}>
      <p className={styles.quitText}>Desistir abandona a run e apaga o progresso. Tem certeza?</p>
      <div className={styles.quitActions}>
        <button type="button" className={styles.quitYes} onClick={onConfirm}>
          Sim, desistir
        </button>
        <button type="button" className={styles.quitNo} onClick={onClose}>
          Não
        </button>
      </div>
    </Overlay>
  )
}
