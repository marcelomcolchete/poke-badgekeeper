// Tela do Dia (PLAN §3.1) — dashboard em 3 colunas: coluna do TIME à esquerda,
// mapa da cidade ao centro (HUD no topo + textbox na base) e RELATÓRIO à direita.
// O desistir virou um ícone no header; painéis de evento abrem como modais por cima.

import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { GameSpeed } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { TOTAL_DAYS } from '../../engine/constants.ts'
import { Hud } from '../Hud/Hud.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { CityMap } from './CityMap.tsx'
import { TeamSidebar } from './TeamSidebar.tsx'
import { ReportSidebar } from './ReportSidebar.tsx'
import { MemberDetail } from './MemberDetail.tsx'
import { MissionDispatch } from './MissionDispatch.tsx'
import { MissionRevealModal } from './MissionRevealModal.tsx'
import { DefensePanel } from './DefensePanel.tsx'
import { CapturePanel } from './CapturePanel.tsx'
import styles from './DayScreen.module.css'

type Selection =
  | { kind: 'mission'; id: string }
  | { kind: 'defense'; id: string }
  | { kind: 'capture'; spotIndex: number }
  | { kind: 'quit' }
  | null

export interface GuideMessage {
  id: number
  text: string
}

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onRestart: () => void
  /** Avisa o App para congelar o relógio enquanto um painel está aberto. */
  onPauseChange: (paused: boolean) => void
}

export function DayScreen({ state, dispatch, onRestart, onPauseChange }: Props) {
  const [open, setOpen] = useState<Selection>(null)
  // Membro do time aberto em detalhe (coluna esquerda → modal).
  const [memberId, setMemberId] = useState<string | null>(null)
  // Histórico de falas do guia (antigo líder): acumula cada dica nova do dia.
  const [messages, setMessages] = useState<GuideMessage[]>(() => [
    { id: 0, text: 'Bem-vindo ao ginásio! Eu te guio durante o dia — fica de olho aqui.' },
    { id: 1, text: dayHint(state) },
  ])
  const msgCounter = useRef(2)
  const lastMsg = useRef(dayHint(state))
  // Missão a revelar (modal de conclusão com os gráficos) e controles de "já visto".
  const [revealId, setRevealId] = useState<string | null>(null)
  const revealedMissions = useRef<Set<string>>(new Set())
  const seenEncounters = useRef<Set<string>>(new Set())
  const close = (): void => setOpen(null)
  const setSpeed = (speed: GameSpeed): void => dispatch({ type: 'SET_SPEED', speed })

  // Abrir qualquer painel/detalhe OU revelar uma missão pausa o tempo; fechar retoma.
  useEffect(() => {
    onPauseChange(open !== null || memberId !== null || revealId !== null)
    return () => onPauseChange(false)
  }, [open, memberId, revealId, onPauseChange])

  // Conclusão de missão (#2): ao resolver, abre o modal de revelação (uma vez por missão).
  useEffect(() => {
    if (revealId !== null || open !== null) return
    const resolved = state.missions.find(
      (m) =>
        (m.result === 'success' || m.result === 'failure') &&
        m.teamIds.length > 0 &&
        !revealedMissions.current.has(m.id),
    )
    if (resolved) setRevealId(resolved.id)
  }, [state.missions, revealId, open])

  // Captura (#6): assim que o encontro fica pronto, abre o modal de escolha e pausa.
  useEffect(() => {
    if (revealId !== null || open !== null) return
    const encounter = state.encounters.find((e) => !seenEncounters.current.has(e.searcherId))
    if (encounter) {
      seenEncounters.current.add(encounter.searcherId)
      setOpen({ kind: 'capture', spotIndex: encounter.spotIndex })
    }
  }, [state.encounters, revealId, open])

  const closeReveal = (): void => {
    if (revealId) revealedMissions.current.add(revealId)
    setRevealId(null)
  }
  const revealMission = revealId ? state.missions.find((m) => m.id === revealId) : undefined

  // Fala do guia: sempre que a dica contextual muda, registra uma nova mensagem no histórico.
  useEffect(() => {
    const text = dayHint(state)
    if (text === lastMsg.current) return
    lastMsg.current = text
    setMessages((prev) => [...prev, { id: msgCounter.current++, text }])
  }, [state])

  // Atalhos de teclado: 1/2/3 = velocidade; 4 = pausa/play (segue a ordem dos botões).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '1') dispatch({ type: 'SET_SPEED', speed: 1 })
      else if (e.key === '2') dispatch({ type: 'SET_SPEED', speed: 2 })
      else if (e.key === '3') dispatch({ type: 'SET_SPEED', speed: 3 })
      else if (e.key === '4')
        dispatch({ type: 'SET_SPEED', speed: state.clock.speed === 0 ? 1 : 0 })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, state.clock.speed])

  return (
    <div className={styles.screen}>
      <TeamSidebar state={state} onSelect={setMemberId} />

      <div className={styles.stage}>
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
            onQuit={() => setOpen({ kind: 'quit' })}
          />
        </div>
      </div>

      <ReportSidebar state={state} messages={messages} />

      {open?.kind === 'mission' && (
        <MissionDispatch state={state} dispatch={dispatch} missionId={open.id} onClose={close} />
      )}
      {open?.kind === 'defense' && (
        <DefensePanel state={state} dispatch={dispatch} defenseId={open.id} onClose={close} />
      )}
      {open?.kind === 'capture' && (
        <CapturePanel state={state} dispatch={dispatch} spotIndex={open.spotIndex} onClose={close} />
      )}
      {open?.kind === 'quit' && <QuitConfirm onConfirm={onRestart} onClose={close} />}

      {memberId && (
        <MemberDetail
          state={state}
          dispatch={dispatch}
          pokemonId={memberId}
          onClose={() => setMemberId(null)}
        />
      )}

      {revealMission && (
        <MissionRevealModal state={state} mission={revealMission} onClose={closeReveal} />
      )}
    </div>
  )
}

function dayHint(state: GameState): string {
  if (state.defenses.some((d) => d.status === 'active')) {
    return 'Defesa no ginásio! Clique no símbolo de luta e monte um esquadrão (≥1).'
  }
  if (state.encounters.length > 0) return 'Um encontro de captura está pronto na área marcada!'
  // O dia só fecha quando todos voltarem ao ginásio (#3) — avisa no encerramento.
  const overtime = state.clock.dayElapsedMs >= state.clock.dayLengthMs
  if (overtime) return 'Tempo esgotado — encerrando o dia assim que o time voltar ao ginásio…'
  const available = state.missions.filter((m) => m.status === 'available').length
  if (available > 0) return `${available} missão(ões) disponível(is). Clique num "!" para despachar seu time.`
  return 'Dia em andamento. Aguarde novas missões surgirem pela cidade…'
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
