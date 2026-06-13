// Defesa de ginásio (PLAN §4.4): escolha do esquadrão (≥1) e, em seguida, um modal de
// batalha que ANIMA a cadeia de duelos 1v1 mostrando os Pokémon enfrentados. A
// resolução acontece na hora (reducer); o log de duelos guardado no estado alimenta a
// animação. Ouro é pago vencendo ou perdendo; dia perfeito rende +30% (§4.6).

import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import type { EnemyUnit, PokemonType } from '../../types/index.ts'
import type { GameState, DefenseEvent } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { MIN_DEFENSE_SQUAD } from '../../engine/constants.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { Overlay } from '../common/Overlay.tsx'
import styles from './Panels.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  defenseId: string
  onClose: () => void
}

export function DefensePanel({ state, dispatch, defenseId, onClose }: Props) {
  const defense = state.defenses.find((d) => d.id === defenseId)
  const [selected, setSelected] = useState<string[]>([])
  const [fighting, setFighting] = useState(false)
  if (!defense) return null

  // Já resolvida (venceu/perdeu) → tela de batalha; caso contrário, seleção do esquadrão.
  if (fighting || defense.status === 'won' || defense.status === 'lost') {
    return <BattleView state={state} defense={defense} onClose={onClose} />
  }

  const enemyTypes = [...new Set(defense.enemies.flatMap((e) => e.types))] as PokemonType[]
  const maxBattle = defense.enemies.reduce((m, e) => Math.max(m, e.battle), 0)
  const valid = selected.length >= MIN_DEFENSE_SQUAD

  const toggle = (id: string): void =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const defend = (): void => {
    dispatch({ type: 'ASSIGN_DEFENSE', defenseId, squadIds: selected })
    setFighting(true)
  }

  return (
    <Overlay title="DEFESA DO GINÁSIO" onClose={onClose} wide>
      <div className={styles.defenseInfo}>
        <span>
          Desafiantes: <b>{defense.enemies.length}</b>
        </span>
        <span className={styles.enemyTypes}>
          {enemyTypes.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
        <span>
          Batalha inimiga: <b>{maxBattle}</b>
        </span>
      </div>
      <p className={styles.hint}>
        Escolha ao menos {MIN_DEFENSE_SQUAD} Pokémon disponíveis para a cadeia de duelos 1v1.
      </p>
      <div className={styles.picker}>
        {state.roster.map((mon) => (
          <PokemonCard
            key={mon.id}
            pokemon={mon}
            selected={selected.includes(mon.id)}
            disabled={mon.status !== 'idle'}
            onClick={mon.status === 'idle' ? () => toggle(mon.id) : undefined}
          />
        ))}
      </div>
      <button type="button" className={styles.confirm} disabled={!valid} onClick={defend}>
        Batalhar ▶ ({selected.length})
      </button>
    </Overlay>
  )
}

interface Round {
  enemyIndex: number
  enemy: EnemyUnit
  yourId: string
  youWon: boolean
  pWin: number
}

/** Reconstrói a ordem de confrontos a partir do log de duelos (mesma lógica da engine). */
function buildRounds(defense: DefenseEvent): Round[] {
  const rounds: Round[] = []
  let theirs = 0
  for (const duel of defense.duels) {
    const enemy = defense.enemies[theirs]
    if (!enemy) break
    rounds.push({ enemyIndex: theirs, enemy, yourId: duel.yourId, youWon: duel.youWon, pWin: duel.pWin })
    if (duel.youWon) theirs += 1
  }
  return rounds
}

const OSC_MS = 1100
const HOLD_MS = 750

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function BattleView({
  state,
  defense,
  onClose,
}: {
  state: GameState
  defense: DefenseEvent
  onClose: () => void
}) {
  const rounds = buildRounds(defense)
  const [step, setStep] = useState(0)
  const done = step >= rounds.length
  const current = done ? null : (rounds[step] as Round)

  const nameOf = (id: string): string => {
    const mon = state.roster.find((p) => p.id === id)
    return mon ? getSpecies(mon.speciesId).displayName : id
  }
  const enemyNameOf = (enemy: EnemyUnit): string =>
    enemy.speciesId !== undefined ? getSpecies(enemy.speciesId).displayName : 'o desafiante'

  const enemiesDefeated = rounds.slice(0, step).filter((r) => r.youWon).length
  // Seus Pokémon que já perderam um duelo ficam cinza, como os desafiantes derrotados.
  const lostIds = new Set(
    rounds.slice(0, step).filter((r) => !r.youWon).map((r) => r.yourId),
  )
  const won = defense.status === 'won'

  return (
    <Overlay title="DEFESA — BATALHA" onClose={done ? onClose : undefined} wide>
      <div className={styles.battle}>
        <div className={styles.battleSide}>
          <span className={styles.battleLabel}>Seu esquadrão</span>
          <div className={styles.battleRow}>
            {defense.squadIds.map((id) => {
              const mon = state.roster.find((p) => p.id === id)
              return mon ? (
                <img
                  key={id}
                  className={`${styles.fighter} ${lostIds.has(id) ? styles.defeated : ''}`}
                  src={getSpecies(mon.speciesId).spritePath}
                  alt={getSpecies(mon.speciesId).displayName}
                  draggable={false}
                />
              ) : null
            })}
          </div>
        </div>

        <div className={styles.battleSide}>
          <span className={styles.battleLabel}>
            Desafiantes ({enemiesDefeated}/{defense.enemies.length} derrotados)
          </span>
          <div className={styles.battleRow}>
            {defense.enemies.map((enemy, i) => (
              <img
                key={i}
                className={`${styles.fighter} ${i < enemiesDefeated ? styles.defeated : ''}`}
                src={enemy.speciesId !== undefined ? getSpecies(enemy.speciesId).spritePath : ''}
                alt=""
                draggable={false}
              />
            ))}
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
              <b>{nameOf(r.yourId)}</b> {r.youWon ? 'venceu' : 'perdeu para'}{' '}
              {enemyNameOf(r.enemy)}
            </li>
          ))}
        </ol>

        {done && (
          <p className={`${styles.result} ${won ? styles.resultWin : styles.resultLose}`}>
            {won ? 'GINÁSIO DEFENDIDO! ✓' : 'O ginásio caiu desta vez…'}
          </p>
        )}

        <button type="button" className={styles.confirm} onClick={onClose} disabled={!done}>
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
        <span
          className={`${styles.meterMarker} ${markerClass}`}
          style={{ left: `${pos * 100}%` }}
        />
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
