// Resumo do dia (PLAN §3/§4.7): aprovação, ouro, missões, defesas, capturas e baixas.
// Layout em duas colunas — estatísticas à esquerda, Pokémon destaque num quadrado à
// direita; estrelas com brilho na parte ganha (ou vermelho na perdida) e um selo de
// veredito (PERFEITO / Bom trabalho / Melhore). No dia 10 mostra o resultado da cidade.

import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { TOTAL_DAYS, STARS_MAX } from '../../engine/constants.ts'
import { buildDaySummary } from '../../engine/daySummary.ts'
import type { DailyProgress } from '../../engine/approval.ts'
import { averageStars, dailyGoalMet, dailyPerfect, isHired } from '../../engine/approval.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { Hearts } from '../common/Hearts.tsx'
import { SECRET_KINDS, type SecretId } from '../../data/secretAbilities.ts'
import type { Pokemon } from '../../types/index.ts'
import { Textbox } from '../Textbox/Textbox.tsx'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { SECRET_MEDAL } from '../common/visual.ts'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import styles from './SummaryScreen.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onRestart: () => void
}

type VerdictKind = 'perfect' | 'good' | 'bad'

/** Selo do dia: 100% nas duas frentes → PERFEITO; ambas as metas → Bom trabalho; abaixo → Melhore. */
function dayVerdict(progress: DailyProgress): { label: string; kind: VerdictKind } {
  const hasWork = progress.missionsTotal > 0 || progress.battlesTotal > 0
  if (hasWork && dailyPerfect(progress)) return { label: 'PERFEITO!', kind: 'perfect' }
  if (hasWork && dailyGoalMet(progress)) return { label: 'Bom trabalho', kind: 'good' }
  return { label: 'Melhore', kind: 'bad' }
}

export function SummaryScreen({ state, dispatch, onRestart }: Props) {
  const summary = buildDaySummary({
    day: state.run.day,
    missionStarsBefore: state.today.missionStarsBefore,
    missionStarsAfter: state.approval.missionStars,
    battleStarsBefore: state.today.battleStarsBefore,
    battleStarsAfter: state.approval.battleStars,
    missionResults: state.today.missionResults,
    defensesWon: state.today.defensesWon,
    defensesTotal: state.today.defensesTotal,
    defenseKills: state.today.defenseKills,
    goldEarned: state.today.goldEarned,
    capturedIds: state.today.capturedIds,
    roster: state.roster,
  })
  const mvp = summary.mvpId ? state.roster.find((p) => p.id === summary.mvpId) : undefined
  // Espécies que o destaque derrotou em defesas — miniaturas/insígnia no quadro do MVP.
  const mvpKillSpecies = summary.mvpId
    ? state.today.defenseKills
        .filter((k) => k.defeaterId === summary.mvpId && k.speciesId !== undefined)
        .map((k) => getSpecies(k.speciesId as number))
    : []
  const lastDay = state.run.day >= TOTAL_DAYS
  const verdict = dayVerdict({
    missionsCompleted: summary.missionsCompleted,
    missionsTotal: summary.missionsTotal,
    battlesWon: summary.defensesWon,
    battlesTotal: summary.defensesTotal,
  })
  // Reveal da Habilidade Secreta desbloqueada hoje pelo Destaque (PLAN §3, ajuste).
  const unlock = state.today.secretUnlock
  const unlockMon = unlock ? state.roster.find((p) => p.id === unlock.pokemonId) : undefined
  const unlockedAbility = unlock ? SECRET_KINDS[unlock.secretId as SecretId] ?? null : null

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <span className={styles.title}>RESUMO — DIA {summary.day}/{TOTAL_DAYS}</span>
        <span className={`${styles.verdict} ${styles[verdict.kind]}`}>{verdict.label}</span>
        <div className={styles.starTracks}>
          <div className={styles.starTrack}>
            <span className={styles.starTrackLabel}>🎯 Missões</span>
            <DeltaStars before={summary.missionStarsBefore} after={summary.missionStarsAfter} />
          </div>
          <div className={styles.starTrack}>
            <span className={styles.starTrackLabel}>⚔️ Batalhas</span>
            <DeltaStars before={summary.battleStarsBefore} after={summary.battleStarsAfter} />
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.statsCol}>
          <Tile label="Missões" value={`${summary.missionsCompleted}/${summary.missionsTotal}`} icon="🎯" />
          <Tile label="Defesas" value={`${summary.defensesWon}/${summary.defensesTotal}`} icon="🛡️" />
          <Tile label="Ouro" value={`$${summary.goldEarned}`} icon="💰" accent />
          <Tile label="Capturados" value={`${summary.captured}`} icon="⚪" />
          <Tile label="Desmaiados" value={`${summary.fainted}`} icon="💤" danger={summary.fainted > 0} />
          <Tile label="Disponíveis" value={`${summary.available}`} icon="✨" />
        </div>

        <MvpSquare
          mvp={mvp}
          missions={summary.mvpMissions}
          defeats={summary.mvpDefeats}
          killSpecies={mvpKillSpecies}
        />
      </div>

      {unlockedAbility && unlockMon && unlock && (
        <div className={styles.secretReveal}>
          <img
            className={styles.secretRevealSprite}
            src={getSpecies(unlockMon.speciesId).spritePath}
            alt={getSpecies(unlockMon.speciesId).displayName}
          />
          <div className={styles.secretRevealText}>
            <span className={styles.secretRevealBadge}>
              {SECRET_MEDAL[unlock.index]} HABILIDADE SECRETA {unlock.index}/3 — DESBLOQUEADA
            </span>
            <span className={styles.secretRevealName}>{unlockedAbility.name}</span>
            <span className={styles.secretRevealDesc}>{unlockedAbility.effect}</span>
          </div>
        </div>
      )}

      {lastDay ? (
        <FinalResult
          missionStars={summary.missionStarsAfter}
          battleStars={summary.battleStarsAfter}
          roster={state.roster}
          onRestart={onRestart}
        />
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

/**
 * Estrelas da aprovação com destaque na variação do dia: a fatia ganha (antes→depois)
 * brilha em dourado; se perdeu estrela, a fatia perdida (depois→antes) fica vermelha.
 */
function DeltaStars({ before, after }: { before: number; after: number }) {
  const pct = (v: number): string => `${(v / STARS_MAX) * 100}%`
  const delta = after - before
  const gained = delta > 0
  const lost = delta < 0
  const solid = Math.min(before, after)
  return (
    <div className={styles.approval}>
      <span className={styles.stars}>
        <span className={styles.starsOff}>{'★'.repeat(STARS_MAX)}</span>
        {/* Fatia perdida (vermelha) sob a base sólida. */}
        {lost && (
          <span className={`${styles.starsLayer} ${styles.starsLost}`} style={{ width: pct(before) }}>
            {'★'.repeat(STARS_MAX)}
          </span>
        )}
        {/* Fatia ganha (brilhando) sob a base sólida. */}
        {gained && (
          <span className={`${styles.starsLayer} ${styles.starsGain}`} style={{ width: pct(after) }}>
            {'★'.repeat(STARS_MAX)}
          </span>
        )}
        {/* Estrelas estáveis (não mudaram hoje). */}
        <span className={`${styles.starsLayer} ${styles.starsSolid}`} style={{ width: pct(solid) }}>
          {'★'.repeat(STARS_MAX)}
        </span>
      </span>
      <span className={styles.delta} data-sign={delta >= 0 ? 'up' : 'down'}>
        {delta >= 0 ? '▲ +' : '▼ '}
        {delta.toFixed(1)}
      </span>
    </div>
  )
}

/**
 * Relatório final do período: a média das duas trilhas (missões + batalhas) decide a efetivação
 * (≥ 3), com o detalhamento das trilhas e o time completo com seus corações.
 */
function FinalResult({
  missionStars,
  battleStars,
  roster,
  onRestart,
}: {
  missionStars: number
  battleStars: number
  roster: Pokemon[]
  onRestart: () => void
}) {
  const avg = averageStars(missionStars, battleStars)
  const hired = isHired(missionStars, battleStars)
  return (
    <>
      <div className={styles.finalReport}>
        <div className={styles.finalScores}>
          <span className={styles.finalScore}>🎯 Missões <b>{missionStars.toFixed(1)}</b>/5</span>
          <span className={styles.finalScore}>⚔️ Batalhas <b>{battleStars.toFixed(1)}</b>/5</span>
          <span className={`${styles.finalAvg} ${hired ? styles.finalAvgGood : styles.finalAvgBad}`}>
            Média <b>{avg.toFixed(2)}</b>/5
          </span>
        </div>
        <ul className={styles.finalTeam} aria-label="Time ao fim do período">
          {roster.map((mon) => {
            const species = getSpecies(mon.speciesId)
            return (
              <li key={mon.id} className={styles.finalMember}>
                <img className={styles.finalSprite} src={species.spritePath} alt={species.displayName} />
                <span className={styles.finalName}>{displayNameOf(mon)}</span>
                <Hearts value={mon.hearts} />
              </li>
            )
          })}
        </ul>
      </div>
      <Textbox>
        {hired
          ? `Período encerrado com média ${avg.toFixed(2)} — você foi EFETIVADO! Rumo à próxima cidade.`
          : `Período encerrado com média ${avg.toFixed(2)}. Não foi dessa vez (precisa de média ≥ 3).`}
      </Textbox>
      <button type="button" className={styles.primary} onClick={onRestart}>
        Novo jogo ▶
      </button>
    </>
  )
}

function MvpSquare({
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
        <span className={styles.mvpBadge}>★ DESTAQUE</span>
        <span className={styles.mvpEmptyText}>Nenhum feito registrado hoje.</span>
      </div>
    )
  }
  const species = getSpecies(mvp.speciesId)
  const symbol = genderSymbol(mvp.gender)
  return (
    <div className={styles.mvp}>
      <span className={styles.mvpBadge}>★ DESTAQUE DO DIA</span>
      <img className={styles.mvpSprite} src={species.spritePath} alt={species.displayName} />
      <span className={styles.mvpName}>
        {displayNameOf(mvp)}
        {symbol && (
          <span className={styles.mvpGender} style={{ color: genderColor(mvp.gender) }}>
            {symbol}
          </span>
        )}
      </span>
      <span className={styles.mvpMeta}>
        <span className={styles.mvpLevel}>Nv {mvp.level}</span>
        <span className={styles.mvpTypes}>
          {mvp.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
      </span>
      <ol className={styles.mvpDeeds}>
        <li className={styles.mvpDeed}>
          <span className={styles.mvpDeedIcon}>🎯</span>
          <b>{missions}</b> {missions === 1 ? 'missão concluída' : 'missões concluídas'}
        </li>
        <li className={styles.mvpDeed}>
          <span className={styles.mvpDeedIcon}>⚔️</span>
          <b>{defeats}</b> {defeats === 1 ? 'derrotado na defesa' : 'derrotados na defesa'}
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
