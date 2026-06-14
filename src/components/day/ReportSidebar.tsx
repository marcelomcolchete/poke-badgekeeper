// Coluna fixa à direita na fase Dia: relatório ao vivo do dia — progresso de
// missões rumo à meta, defesas, ouro e capturas. Substitui o antigo modal.

import type { GameState } from '../../engine/state.ts'
import type { Pokemon } from '../../types/index.ts'
import type { GuideMessage } from './DayScreen.tsx'
import { STARS_MAX } from '../../engine/constants.ts'
import { missionGoal } from '../../engine/approval.ts'
import { computeMvp } from '../../engine/daySummary.ts'
import { clamp } from '../../engine/math.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { displayNameOf } from '../common/naming.ts'
import styles from './ReportSidebar.module.css'

interface Props {
  state: GameState
  messages: GuideMessage[]
}

export function ReportSidebar({ state, messages }: Props) {
  const t = state.today
  const { mvpId, mvpMissions } = computeMvp(t.missionResults)
  const mvp = mvpId ? state.roster.find((p) => p.id === mvpId) : undefined
  const completed = t.missionResults.filter((m) => m.success).length
  const total = state.missions.length
  const goal = missionGoal(total)
  const goalMet = total > 0 && completed >= goal
  const allDone = total > 0 && completed >= total
  const remaining = Math.max(0, goal - completed)

  const completedPct = total > 0 ? clamp(completed / total, 0, 1) * 100 : 0
  const goalPct = total > 0 ? clamp(goal / total, 0, 1) * 100 : 0
  const starsPct = `${(state.approval.stars / STARS_MAX) * 100}%`

  return (
    <aside className={styles.panel} aria-label="Relatório do dia">
      <header className={styles.head}>
        <span className={styles.title}>RELATÓRIO</span>
        <span className={styles.stars} aria-label={`${state.approval.stars} de ${STARS_MAX} estrelas`}>
          <span className={styles.starsOff}>{'★'.repeat(STARS_MAX)}</span>
          <span className={styles.starsOn} style={{ width: starsPct }}>
            {'★'.repeat(STARS_MAX)}
          </span>
        </span>
      </header>

      <section className={styles.missions}>
        <div className={styles.missionTop}>
          <span className={styles.label}>Missões cumpridas</span>
          <span className={styles.big}>
            {completed}
            <span className={styles.of}> / {total}</span>
          </span>
        </div>
        <div className={styles.bar}>
          <span className={styles.barFill} style={{ width: `${completedPct}%` }} />
          {total > 0 && (
            <span
              className={styles.goalMark}
              style={{ left: `${goalPct}%` }}
              title={`Meta: ${goal}`}
              aria-hidden="true"
            />
          )}
        </div>
        <p className={`${styles.hint} ${goalMet ? styles.hintGood : ''}`}>
          {allDone
            ? 'Todas cumpridas — +1 estrela! ★'
            : goalMet
              ? 'Meta batida — +½ estrela! ★½'
              : `Faltam ${remaining} para a meta (½ estrela).`}
        </p>
      </section>

      <ul className={styles.stats}>
        <li className={styles.stat}>
          <span className={styles.statIcon}>🎯</span>
          <span className={styles.statVal}>{goal}</span>
          <span className={styles.statLabel}>Meta do dia</span>
        </li>
        <li className={styles.stat}>
          <span className={styles.statIcon}>⚔️</span>
          <span className={styles.statVal}>
            {t.defensesWon}
            <span className={styles.statSub}>/{state.defenses.length}</span>
          </span>
          <span className={styles.statLabel}>Batalhas previstas</span>
        </li>
      </ul>

      <ul className={`${styles.stats} ${styles.statsThree}`}>
        <li className={styles.stat}>
          <span className={styles.statIcon}>💰</span>
          <span className={styles.statVal}>$ {t.goldEarned}</span>
          <span className={styles.statLabel}>Ouro do dia</span>
        </li>
        <li className={styles.stat}>
          <span className={styles.statIcon}>🔴</span>
          <span className={styles.statVal}>{t.capturedIds.length}</span>
          <span className={styles.statLabel}>Capturados</span>
        </li>
        <li className={styles.stat}>
          <span className={styles.statIcon}>⭐</span>
          <span className={styles.statVal}>{t.xpEarned}</span>
          <span className={styles.statLabel}>XP do dia</span>
        </li>
      </ul>

      <DayMvp mvp={mvp} missions={mvpMissions} />

      <section className={styles.guide} aria-label="Mensagens do guia">
        <div className={styles.guideHead}>
          <span className={styles.guideAvatar} aria-hidden="true">
            👤
          </span>
          <span className={styles.guideName}>Antigo Líder</span>
        </div>
        <div className={styles.log}>
          {messages.map((m) => (
            <div key={m.id} className={styles.msg}>
              <span className={styles.msgAvatar} aria-hidden="true">
                👤
              </span>
              <p className={styles.bubble}>{m.text}</p>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

/** Destaque do dia ao vivo: o mesmo MVP que aparece no resumo final (compacto). */
function DayMvp({ mvp, missions }: { mvp: Pokemon | undefined; missions: number }) {
  if (!mvp) {
    return (
      <div className={`${styles.mvp} ${styles.mvpEmpty}`}>
        <span className={styles.mvpBadge}>★ DESTAQUE DO DIA</span>
        <span className={styles.mvpEmptyText}>Nenhuma missão concluída ainda.</span>
      </div>
    )
  }
  const species = getSpecies(mvp.speciesId)
  return (
    <div className={styles.mvp}>
      <span className={styles.mvpBadge}>★ DESTAQUE DO DIA</span>
      <div className={styles.mvpRow}>
        <img className={styles.mvpSprite} src={species.spritePath} alt={species.displayName} />
        <span className={styles.mvpInfo}>
          <span className={styles.mvpName}>{displayNameOf(mvp)}</span>
          <span className={styles.mvpDeed}>
            {missions} {missions === 1 ? 'missão' : 'missões'} hoje
          </span>
        </span>
      </div>
    </div>
  )
}
