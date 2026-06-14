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
  const { mvpId, mvpMissions, mvpDefeats } = computeMvp(t.missionResults, t.defenseKills)
  const mvp = mvpId ? state.roster.find((p) => p.id === mvpId) : undefined
  const mvpKillSpecies = mvpId
    ? t.defenseKills
        .filter((k) => k.defeaterId === mvpId && k.speciesId !== undefined)
        .map((k) => getSpecies(k.speciesId as number))
    : []
  const completed = t.missionResults.filter((m) => m.success).length
  const failedMissions = t.missionResults.length - completed
  const total = state.missions.length
  const battlesTotal = state.defenses.length
  const captured = t.capturedIds.at(-1)
  const capturedMon = captured ? state.roster.find((p) => p.id === captured) : undefined
  const capturedSpecies = capturedMon ? getSpecies(capturedMon.speciesId) : undefined
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

      {/* Placar do dia: sucessos (verde) e falhas (vermelho) de missões e batalhas. */}
      <div className={styles.score}>
        <ScoreRow
          icon="🎯"
          label="Missões"
          won={completed}
          lost={failedMissions}
          total={total}
        />
        <ScoreRow
          icon="⚔️"
          label="Batalhas"
          won={t.defensesWon}
          lost={t.defensesLost}
          total={battlesTotal}
        />
      </div>

      <ul className={`${styles.stats} ${styles.statsThree}`}>
        <li className={styles.stat}>
          <span className={styles.statIcon}>💰</span>
          <span className={styles.statVal}>$ {t.goldEarned}</span>
          <span className={styles.statLabel}>Ouro do dia</span>
        </li>
        <li className={`${styles.stat} ${styles.captured}`}>
          {capturedSpecies ? (
            <img
              className={styles.capturedSprite}
              src={capturedSpecies.spritePath}
              alt={capturedSpecies.displayName}
            />
          ) : (
            <span className={styles.capturedNone}>Nenhum</span>
          )}
          <span className={styles.statLabel}>Capturado</span>
        </li>
        <li className={styles.stat}>
          <span className={styles.statIcon}>⭐</span>
          <span className={styles.statVal}>{t.xpEarned}</span>
          <span className={styles.statLabel}>XP do dia</span>
        </li>
      </ul>

      <DayMvp
        mvp={mvp}
        missions={mvpMissions}
        defeats={mvpDefeats}
        killSpecies={mvpKillSpecies}
      />

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

/** Linha do placar: ícone + rótulo, contagem de vitórias (verde) e falhas (vermelho), total previsto. */
function ScoreRow({
  icon,
  label,
  won,
  lost,
  total,
}: {
  icon: string
  label: string
  won: number
  lost: number
  total: number
}) {
  return (
    <div className={styles.scoreRow}>
      <span className={styles.scoreLabel}>
        <span className={styles.scoreIcon} aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      <span className={styles.scoreChips}>
        <span className={`${styles.chip} ${styles.chipWin}`} title={`${won} com sucesso`}>
          ✓ {won}
        </span>
        <span className={`${styles.chip} ${styles.chipLoss}`} title={`${lost} falhadas`}>
          ✗ {lost}
        </span>
        <span className={styles.scoreTotal}>/ {total}</span>
      </span>
    </div>
  )
}

/** Destaque do dia ao vivo: o mesmo MVP que aparece no resumo final (compacto). */
function DayMvp({
  mvp,
  missions,
  defeats,
  killSpecies,
}: {
  mvp: Pokemon | undefined
  missions: number
  defeats: number
  killSpecies: ReturnType<typeof getSpecies>[]
}) {
  if (!mvp) {
    return (
      <div className={`${styles.mvp} ${styles.mvpEmpty}`}>
        <span className={styles.mvpBadge}>★ DESTAQUE DO DIA</span>
        <span className={styles.mvpEmptyText}>Nenhum feito registrado ainda.</span>
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
          <ol className={styles.mvpDeeds}>
            <li className={styles.mvpDeed}>
              🎯 <b>{missions}</b> {missions === 1 ? 'missão' : 'missões'}
            </li>
            <li className={styles.mvpDeed}>
              ⚔️ <b>{defeats}</b> {defeats === 1 ? 'derrotado' : 'derrotados'}
              {killSpecies.length > 0 && (
                <span className={styles.mvpKills}>
                  {killSpecies.map((sp, i) => (
                    <img
                      key={i}
                      className={styles.mvpKill}
                      src={sp.spritePath}
                      alt={sp.displayName}
                      title={sp.displayName}
                    />
                  ))}
                </span>
              )}
            </li>
          </ol>
        </span>
      </div>
    </div>
  )
}
