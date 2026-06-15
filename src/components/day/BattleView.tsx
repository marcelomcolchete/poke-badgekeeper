// Animação compartilhada da cadeia de duelos 1v1 (defesa de ginásio E batalha da Equipe
// Rocket): mostra os dois lados, a nota E–S de cada Pokémon e a medalha do desafiante em
// destaque (+15). A resolução já vem do estado (log de duelos); aqui é só a visualização.

import { useEffect, useState } from 'react'
import type { EnemyUnit, Pokemon } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { DuelLog } from '../../engine/gymDefense.ts'
import type { TrainerDef } from '../../data/trainers.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { effectiveBattle, enemyRank, typeAdvantageMultiplier } from '../../engine/gymDefense.ts'
import { pokemonRank, type Rank } from '../../engine/ranking.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { RANK_COLOR } from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

type Trend = 'up' | 'down' | 'flat'

interface Round {
  enemyIndex: number
  enemy: EnemyUnit
  yourId: string
  youWon: boolean
  pWin: number
  /** Poder de batalha efetivo do seu Pokémon contra os tipos deste inimigo (com vantagem/desvantagem). */
  yourBattle: number
  /** Poder de batalha efetivo do inimigo contra os tipos do seu Pokémon. */
  enemyBattle: number
}

/**
 * Reconstrói a ordem de confrontos a partir do log de duelos (mesma lógica da engine),
 * anexando o poder de batalha efetivo (já com vantagem/desvantagem de tipo) dos dois lados.
 */
function buildRounds(enemies: readonly EnemyUnit[], duels: readonly DuelLog[], roster: readonly Pokemon[]): Round[] {
  const rounds: Round[] = []
  let theirs = 0
  for (const duel of duels) {
    const enemy = enemies[theirs]
    if (!enemy) break
    const mon = roster.find((p) => p.id === duel.yourId)
    const yourBattle = mon ? Math.round(effectiveBattle(mon, enemy.types)) : 0
    const enemyBattle = mon
      ? Math.round(enemy.battle * typeAdvantageMultiplier(enemy.types, mon.types))
      : enemy.battle
    rounds.push({
      enemyIndex: theirs,
      enemy,
      yourId: duel.yourId,
      youWon: duel.youWon,
      pWin: duel.pWin,
      yourBattle,
      enemyBattle,
    })
    if (duel.youWon) theirs += 1
  }
  return rounds
}

const OSC_MS = 1100
const HOLD_MS = 750

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export interface BattleViewProps {
  state: GameState
  trainer: TrainerDef
  /** Esquadrão do jogador, na ordem dos duelos. */
  squadIds: string[]
  enemies: EnemyUnit[]
  duels: DuelLog[]
  won: boolean
  title: string
  /** Mensagem ao vencer (ex.: "GINÁSIO DEFENDIDO! ✓"). */
  wonText: string
  /** Mensagem ao perder. */
  lostText: string
  /** Chamado ao concluir a animação (aplica XP/recompensas e fecha). */
  onFinish: () => void
}

export function BattleView({
  state,
  trainer,
  squadIds,
  enemies,
  duels,
  won,
  title,
  wonText,
  lostText,
  onFinish,
}: BattleViewProps) {
  const rounds = buildRounds(enemies, duels, state.roster)
  const [step, setStep] = useState(0)
  const done = step >= rounds.length
  const current = done ? null : (rounds[step] as Round)

  const nameOf = (id: string): string => {
    const mon = state.roster.find((p) => p.id === id)
    return mon ? displayNameOf(mon) : id
  }
  const enemyNameOf = (enemy: EnemyUnit): string =>
    enemy.speciesId !== undefined ? getSpecies(enemy.speciesId).displayName : 'o desafiante'

  const enemiesDefeated = rounds.slice(0, step).filter((r) => r.youWon).length
  // Seus Pokémon que já perderam um duelo ficam cinza, como os desafiantes derrotados.
  const lostIds = new Set(rounds.slice(0, step).filter((r) => !r.youWon).map((r) => r.yourId))
  // Quem perde no DECORRER TODO da batalha (para reconstruir o HP de antes dela).
  const lostOverall = new Set(duels.filter((d) => !d.youWon).map((d) => d.yourId))

  // HP do seu Pokémon a esta altura: HP atual no roster + 1 se ele perdeu em algum
  // momento, menos 1 quando essa derrota já foi mostrada (perde 1 ao ser batido).
  const hpOf = (id: string): { cur: number; max: number } => {
    const mon = state.roster.find((p) => p.id === id)
    if (!mon) return { cur: 0, max: 0 }
    const pre = mon.currentHp + (lostOverall.has(id) ? 1 : 0)
    return { cur: Math.max(0, pre - (lostIds.has(id) ? 1 : 0)), max: mon.maxHp }
  }
  const trendOf = (adjusted: number, base: number): Trend =>
    adjusted > base ? 'up' : adjusted < base ? 'down' : 'flat'

  return (
    <Overlay title={title} onClose={done ? onFinish : undefined} wide>
      <div className={styles.battle}>
        <div className={styles.battleSide}>
          <span className={styles.battleLabel}>Seu esquadrão</span>
          <div className={styles.battleRow}>
            {squadIds.map((id) => {
              const mon = state.roster.find((p) => p.id === id)
              if (!mon) return null
              const base = Math.round(effectiveAttr(mon, 'batalha'))
              const isCurrent = current?.yourId === id
              const battle = isCurrent ? current.yourBattle : base
              return (
                <Fighter
                  key={id}
                  spritePath={getSpecies(mon.speciesId).spritePath}
                  alt={getSpecies(mon.speciesId).displayName}
                  defeated={lostIds.has(id)}
                  hp={hpOf(id)}
                  showMinus={lostIds.has(id)}
                  battle={battle}
                  rank={pokemonRank(mon)}
                  trend={isCurrent ? trendOf(battle, base) : 'flat'}
                />
              )
            })}
          </div>
        </div>

        <div className={styles.battleSide}>
          <span className={styles.battleLabel}>
            Desafiantes ({enemiesDefeated}/{enemies.length} derrotados)
          </span>
          <div className={styles.battleTrainer}>
            <img className={styles.battleTrainerArt} src={trainer.spritePath} alt={trainer.displayName} />
            <span className={styles.battleTrainerName}>{trainer.displayName}</span>
          </div>
          <div className={styles.battleRow}>
            {enemies.map((enemy, i) => {
              const isCurrent = current?.enemyIndex === i
              const battle = isCurrent ? current.enemyBattle : enemy.battle
              return (
                <Fighter
                  key={i}
                  spritePath={enemy.speciesId !== undefined ? getSpecies(enemy.speciesId).spritePath : ''}
                  alt=""
                  defeated={i < enemiesDefeated}
                  battle={battle}
                  rank={enemyRank(enemy)}
                  medal={enemy.buffed}
                  trend={isCurrent ? trendOf(battle, enemy.battle) : 'flat'}
                />
              )
            })}
          </div>
        </div>

        {current && (
          <DuelMeter
            key={step}
            round={current}
            yourName={nameOf(current.yourId)}
            enemyName={enemyNameOf(current.enemy)}
            onDone={() => setStep((s) => s + 1)}
          />
        )}

        <ol className={styles.duelLog}>
          {rounds.slice(0, step).map((r, i) => (
            <li key={i} className={r.youWon ? styles.duelWin : styles.duelLose}>
              <b>{nameOf(r.yourId)}</b> {r.youWon ? 'venceu' : 'perdeu para'} {enemyNameOf(r.enemy)}
              {!r.youWon && ' (−1 HP)'}
            </li>
          ))}
        </ol>

        {done && (
          <p className={`${styles.result} ${won ? styles.resultWin : styles.resultLose}`}>
            {won ? wonText : lostText}
          </p>
        )}

        <button type="button" className={styles.confirm} onClick={onFinish} disabled={!done}>
          Continuar ▶
        </button>
      </div>
    </Overlay>
  )
}

/**
 * Medidor do duelo (PLAN §4.4): um marcador oscila pela barra e "pousa" dentro da zona
 * de vitória (interseção verde, largura = pWin) quando você vence, ou fora dela quando
 * perde. A oscilação é só visual — o resultado já vem resolvido do estado.
 */
function DuelMeter({
  round,
  yourName,
  enemyName,
  onDone,
}: {
  round: Round
  yourName: string
  enemyName: string
  onDone: () => void
}) {
  const winZone = clamp01(round.pWin)
  const [pos, setPos] = useState(0.5)
  const [settled, setSettled] = useState(false)

  // Oscila por OSC_MS (onda triangular) e então fixa dentro/fora da zona de vitória.
  useEffect(() => {
    setSettled(false)
    const final = round.youWon ? winZone * 0.5 : winZone + (1 - winZone) * 0.5
    let raf = 0
    let start = 0
    const tick = (ts: number): void => {
      if (!start) start = ts
      const elapsed = ts - start
      if (elapsed >= OSC_MS) {
        setPos(final)
        setSettled(true)
        return
      }
      const phase = (elapsed / OSC_MS) * 2.5 // ~2,5 vai-e-volta
      const frac = phase - Math.floor(phase)
      setPos(1 - Math.abs(frac * 2 - 1)) // 0 → 1 → 0
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [round, winZone])

  // Depois de fixar, segura um instante e avança para o próximo duelo.
  useEffect(() => {
    if (!settled) return
    const t = setTimeout(onDone, HOLD_MS)
    return () => clearTimeout(t)
  }, [settled, onDone])

  const markerClass = settled ? (round.youWon ? styles.markerWin : styles.markerLose) : ''
  const verdictClass = settled ? (round.youWon ? styles.duelWin : styles.duelLose) : ''

  return (
    <div className={styles.meterWrap}>
      <span className={styles.meterHead}>
        <b>{yourName}</b> vs {enemyName} — {Math.round(winZone * 100)}% de vitória
      </span>
      <div className={styles.meterTrack}>
        <span className={styles.meterZone} style={{ width: `${winZone * 100}%` }} />
        <span className={`${styles.meterMarker} ${markerClass}`} style={{ left: `${pos * 100}%` }} />
      </div>
      <span className={`${styles.meterVerdict} ${verdictClass}`}>
        {!settled
          ? 'Resolvendo…'
          : round.youWon
            ? 'Caiu na interseção — venceu! ✓'
            : 'Caiu fora da interseção — perdeu.'}
      </span>
    </div>
  )
}

/**
 * Lutador na cadeia de duelos: sprite com a nota E–S, o HP do seu Pokémon e o selo "−1"
 * sobrepostos, e o atributo Batalha abaixo (com ▲/▼ quando o tipo dá vantagem/desvantagem).
 * Desafiante em destaque (+15) exibe a medalha 🏅.
 */
function Fighter({
  spritePath,
  alt,
  defeated,
  hp,
  showMinus,
  battle,
  rank,
  medal,
  trend,
}: {
  spritePath: string
  alt: string
  defeated: boolean
  hp?: { cur: number; max: number }
  showMinus?: boolean
  battle: number
  rank?: Rank
  medal?: boolean
  trend: Trend
}) {
  const trendCls = trend === 'up' ? styles.battleUp : trend === 'down' ? styles.battleDown : ''
  return (
    <div className={styles.fighterCell}>
      <div className={styles.fighterArt}>
        <img
          className={`${styles.fighter} ${defeated ? styles.defeated : ''}`}
          src={spritePath}
          alt={alt}
          draggable={false}
        />
        {rank && (
          <span
            className={styles.fighterRank}
            style={{ color: RANK_COLOR[rank], borderColor: RANK_COLOR[rank] }}
            aria-label={`Nota ${rank}`}
          >
            {rank}
          </span>
        )}
        {medal && (
          <span className={styles.fighterMedal} title="Desafiante em destaque (+15)" aria-label="Desafiante em destaque">
            🏅
          </span>
        )}
        {showMinus && <span className={styles.hpMinus}>−1</span>}
      </div>
      {hp && (
        <span className={`${styles.statTag} ${styles.hpTag}`}>
          HP {hp.cur}/{hp.max}
        </span>
      )}
      <span className={`${styles.statTag} ${trendCls}`}>
        ⚔ {battle}
        {trend === 'up' ? ' ▲' : trend === 'down' ? ' ▼' : ''}
      </span>
    </div>
  )
}
