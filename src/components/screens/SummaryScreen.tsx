// Resumo do dia (PLAN §3/§4.7): aprovação, ouro, missões, defesas, capturas e baixas.
// No dia 10 mostra o resultado da cidade (efetivado se > 3 estrelas).

import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { TOTAL_DAYS } from '../../engine/constants.ts'
import { buildDaySummary } from '../../engine/daySummary.ts'
import { isHired } from '../../engine/approval.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import type { Pokemon } from '../../types/index.ts'
import { Textbox } from '../Textbox/Textbox.tsx'
import { Stars } from '../common/Stars.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
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
      <div className={styles.header}>
        <span className={styles.title}>RESUMO — DIA {summary.day}/{TOTAL_DAYS}</span>
        <div className={styles.approval}>
          <Stars value={summary.starsAfter} />
          <span className={styles.delta} data-sign={delta >= 0 ? 'up' : 'down'}>
            {delta >= 0 ? '▲ +' : '▼ '}
            {delta.toFixed(1)}
          </span>
        </div>
      </div>

      <MvpCard mvp={mvp} missions={summary.mvpMissions} />

      <div className={styles.tiles}>
        <Tile label="Missões" value={`${summary.missionsCompleted}/${summary.missionsTotal}`} icon="🎯" />
        <Tile label="Defesas" value={`${summary.defensesWon}/${summary.defensesTotal}`} icon="🛡️" />
        <Tile label="Ouro" value={`$${summary.goldEarned}`} icon="💰" accent />
        <Tile label="Capturados" value={`${summary.captured}`} icon="⚪" />
        <Tile label="Desmaiados" value={`${summary.fainted}`} icon="💤" danger={summary.fainted > 0} />
        <Tile label="Disponíveis" value={`${summary.available}`} icon="✨" />
      </div>

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

function MvpCard({ mvp, missions }: { mvp: Pokemon | undefined; missions: number }) {
  if (!mvp) {
    return (
      <div className={`${styles.mvp} ${styles.mvpEmpty}`}>
        <span className={styles.mvpBadge}>★ DESTAQUE</span>
        <span className={styles.mvpEmptyText}>Nenhuma missão concluída hoje.</span>
      </div>
    )
  }
  const species = getSpecies(mvp.speciesId)
  const symbol = genderSymbol(mvp.gender)
  return (
    <div className={styles.mvp}>
      <span className={styles.mvpBadge}>★ DESTAQUE DO DIA</span>
      <div className={styles.mvpRow}>
        <img className={styles.mvpSprite} src={species.spritePath} alt={species.displayName} />
        <div className={styles.mvpInfo}>
          <span className={styles.mvpName}>
            {displayNameOf(mvp)}
            {symbol && (
              <span className={styles.mvpGender} style={{ color: genderColor(mvp.gender) }}>
                {symbol}
              </span>
            )}
            <span className={styles.mvpLevel}>Nv {mvp.level}</span>
          </span>
          <span className={styles.mvpTypes}>
            {mvp.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
          <span className={styles.mvpDeed}>
            Venceu <b>{missions}</b> {missions === 1 ? 'missão' : 'missões'} hoje
          </span>
        </div>
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  icon,
  accent = false,
  danger = false,
}: {
  label: string
  value: string
  icon: string
  accent?: boolean
  danger?: boolean
}) {
  const cls = [styles.tile, accent ? styles.tileAccent : '', danger ? styles.tileDanger : ''].join(' ')
  return (
    <div className={cls}>
      <span className={styles.tileIcon}>{icon}</span>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}
