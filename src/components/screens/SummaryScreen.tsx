// Resumo do dia (PLAN §3/§4.7): aprovação, ouro, missões, defesas, capturas e baixas.
// No dia 10 mostra o resultado da cidade (efetivado se > 3 estrelas).

import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { TOTAL_DAYS } from '../../engine/constants.ts'
import { buildDaySummary } from '../../engine/daySummary.ts'
import { isHired } from '../../engine/approval.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { Textbox } from '../Textbox/Textbox.tsx'
import { Stars } from '../common/Stars.tsx'
import styles from './SummaryScreen.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onRestart: () => void
}

export function SummaryScreen({ state, dispatch, onRestart }: Props) {
  const summary = buildDaySummary({
    day: state.run.day,
    starsBefore: state.today.starsBefore,
    starsAfter: state.approval.stars,
    missionResults: state.today.missionResults,
    defensesWon: state.today.defensesWon,
    defensesTotal: state.today.defensesTotal,
    goldEarned: state.today.goldEarned,
    capturedIds: state.today.capturedIds,
    roster: state.roster,
  })
  const delta = summary.starsAfter - summary.starsBefore
  const mvp = summary.mvpId ? state.roster.find((p) => p.id === summary.mvpId) : undefined
  const lastDay = state.run.day >= TOTAL_DAYS

  return (
    <div className={styles.screen}>
      <span className={styles.title}>RESUMO — DIA {summary.day}/{TOTAL_DAYS}</span>

      <div className={styles.approval}>
        <Stars value={summary.starsAfter} />
        <span className={styles.delta} data-sign={delta >= 0 ? 'up' : 'down'}>
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(1)}
        </span>
      </div>

      <ul className={styles.rows}>
        <Row label="Missões cumpridas" value={`${summary.missionsCompleted}/${summary.missionsTotal}`} />
        <Row label="Defesas vencidas" value={`${summary.defensesWon}/${summary.defensesTotal}`} />
        <Row label="Ouro do dia" value={`$ ${summary.goldEarned}`} accent />
        <Row label="Capturados" value={`${summary.captured}`} />
        <Row label="Desmaiados" value={`${summary.fainted}`} />
        <Row
          label="Destaque"
          value={mvp ? getSpecies(mvp.speciesId).displayName : '—'}
        />
      </ul>

      {lastDay ? (
        <FinalResult hired={isHired(summary.starsAfter)} stars={summary.starsAfter} onRestart={onRestart} />
      ) : (
        <>
          <Textbox>Bom trabalho! Pronto para o próximo dia?</Textbox>
          <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'ADVANCE_PHASE' })}>
            Próximo dia ▶
          </button>
        </>
      )}
    </div>
  )
}

function FinalResult({ hired, stars, onRestart }: { hired: boolean; stars: number; onRestart: () => void }) {
  return (
    <>
      <Textbox>
        {hired
          ? `Período encerrado com ${stars.toFixed(1)} estrelas — você foi EFETIVADO! Rumo à próxima cidade.`
          : `Período encerrado com ${stars.toFixed(1)} estrelas. Não foi dessa vez (precisa de mais de 3).`}
      </Textbox>
      <button type="button" className={styles.primary} onClick={onRestart}>
        Novo jogo ▶
      </button>
    </>
  )
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <li className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={accent ? styles.rowAccent : styles.rowValue}>{value}</span>
    </li>
  )
}
