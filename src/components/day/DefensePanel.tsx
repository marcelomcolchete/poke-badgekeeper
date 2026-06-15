// Defesa de ginásio (PLAN §4.4): escolha do esquadrão (≥1) e, em seguida, um modal de
// batalha que ANIMA a cadeia de duelos 1v1 mostrando os Pokémon enfrentados. A
// resolução acontece na hora (reducer); o log de duelos guardado no estado alimenta a
// animação. Ouro é pago vencendo ou perdendo; dia perfeito rende +30% (§4.6).

import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import type { EnemyUnit, Pokemon, PokemonType } from '../../types/index.ts'
import type { GameState, DefenseEvent } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { MIN_DEFENSE_SQUAD } from '../../engine/constants.ts'
import { GYM_WIN_XP } from '../../engine/balance.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { effectiveBattle, typeAdvantageMultiplier } from '../../engine/gymDefense.ts'
import { sortRoster } from '../../engine/roster.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { displayNameOf } from '../common/naming.ts'
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
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  if (!defense) return null

  // Já resolvida (venceu/perdeu) → tela de batalha; caso contrário, seleção do esquadrão.
  if (fighting || defense.status === 'won' || defense.status === 'lost') {
    return <BattleView state={state} dispatch={dispatch} defense={defense} onClose={onClose} />
  }

  const enemyTypes = [...new Set(defense.enemies.flatMap((e) => e.types))] as PokemonType[]
  const maxBattle = defense.enemies.reduce((m, e) => Math.max(m, e.battle), 0)
  const valid = selected.length >= MIN_DEFENSE_SQUAD
  // Esquadrão escolhido, na ORDEM dos duelos (a ordem importa: a frente luta primeiro).
  const squad = selected
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const teamBattle = squad.reduce((sum, m) => sum + Math.round(effectiveAttr(m, 'batalha')), 0)
  // 1 desafiante derrotado = GYM_WIN_XP; o teto é vencer todos os duelos.
  const maxXp = defense.enemies.length * GYM_WIN_XP

  const toggle = (id: string): void =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const remove = (id: string): void => setSelected((prev) => prev.filter((x) => x !== id))
  const reorder = (from: number, to: number): void =>
    setSelected((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved as string)
      return next
    })

  const defend = (): void => {
    dispatch({ type: 'ASSIGN_DEFENSE', defenseId, squadIds: selected })
    setFighting(true)
  }

  return (
    <Overlay title="DEFESA DO GINÁSIO" onClose={onClose} wide>
      <div className={styles.dispatch}>
        <div className={styles.radarSide}>
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

          <div className={styles.stats}>
            <span>
              Batalha do time: <b>{teamBattle}</b>
            </span>
            <span>
              EXP na batalha: <b>até {maxXp}</b> (×{GYM_WIN_XP}/vitória)
            </span>
            <span>
              Esquadrão: <b>{selected.length}</b>
            </span>
          </div>

          <div className={styles.selectedTeam}>
            <span className={styles.selectedTitle}>Ordem dos duelos ({selected.length})</span>
            {squad.length === 0 ? (
              <span className={styles.selectedEmpty}>
                Escolha ao menos {MIN_DEFENSE_SQUAD} ao lado. Arraste para reordenar.
              </span>
            ) : (
              <ol className={styles.orderList}>
                {squad.map((mon, i) => (
                  <li
                    key={mon.id}
                    className={`${styles.orderChip} ${dragIndex === i ? styles.dragging : ''}`}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) reorder(dragIndex, i)
                      setDragIndex(null)
                    }}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <span className={styles.orderNum} aria-hidden="true">
                      ⠿ {i + 1}
                    </span>
                    <img
                      className={styles.chipSprite}
                      src={getSpecies(mon.speciesId).spritePath}
                      alt=""
                      draggable={false}
                    />
                    <span className={styles.orderName}>{displayNameOf(mon)}</span>
                    <span className={styles.orderBattle}>⚔ {Math.round(effectiveAttr(mon, 'batalha'))}</span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => remove(mon.id)}
                      aria-label={`Remover ${displayNameOf(mon)} do esquadrão`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className={styles.picker}>
          {sortRoster(state.roster).map((mon) => (
            <BattlePick
              key={mon.id}
              mon={mon}
              selected={selected.includes(mon.id)}
              disabled={mon.status !== 'idle'}
              onClick={mon.status === 'idle' ? () => toggle(mon.id) : undefined}
            />
          ))}
        </div>
      </div>
      <button type="button" className={styles.confirm} disabled={!valid} onClick={defend}>
        Batalhar ▶ ({selected.length})
      </button>
    </Overlay>
  )
}

/**
 * Carta compacta de seleção para a defesa: sprite, nome e tipos + SÓ o atributo Batalha
 * (sem o radar hexagonal). A defesa é decidida pela Batalha, então é o único número útil.
 */
function BattlePick({
  mon,
  selected,
  disabled,
  onClick,
}: {
  mon: Pokemon
  selected: boolean
  disabled: boolean
  onClick?: () => void
}) {
  const species = getSpecies(mon.speciesId)
  const battle = Math.round(effectiveAttr(mon, 'batalha'))
  const fainted = mon.currentHp <= 0
  const classes = [
    styles.battlePick,
    selected ? styles.battlePickOn : '',
    disabled ? styles.battlePickOff : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-pressed={selected}
    >
      <img
        className={styles.battlePickSprite}
        src={species.spritePath}
        alt={species.displayName}
        draggable={false}
      />
      <span className={styles.battlePickInfo}>
        <span className={styles.battlePickName}>
          {fainted && <span aria-hidden="true">💀 </span>}
          {displayNameOf(mon)}
        </span>
        <span className={styles.battlePickTypes}>
          {mon.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
      </span>
      <span className={styles.battlePickStat}>
        <span className={styles.battlePickStatVal}>{battle}</span>
        <span className={styles.battlePickStatLbl}>⚔ Batalha</span>
      </span>
    </button>
  )
}

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
function buildRounds(defense: DefenseEvent, roster: readonly Pokemon[]): Round[] {
  const rounds: Round[] = []
  let theirs = 0
  for (const duel of defense.duels) {
    const enemy = defense.enemies[theirs]
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

function BattleView({
  state,
  dispatch,
  defense,
  onClose,
}: {
  state: GameState
  dispatch: Dispatch<GameAction>
  defense: DefenseEvent
  onClose: () => void
}) {
  const rounds = buildRounds(defense, state.roster)
  const [step, setStep] = useState(0)
  const done = step >= rounds.length
  const current = done ? null : (rounds[step] as Round)

  // Ao fechar (só liberado quando a animação termina), aplica o XP/level-up das vitórias —
  // o level-up "aparece" agora, depois da batalha. Idempotente no reducer (xpApplied).
  const finish = (): void => {
    dispatch({ type: 'COMPLETE_DEFENSE', defenseId: defense.id })
    onClose()
  }

  const nameOf = (id: string): string => {
    const mon = state.roster.find((p) => p.id === id)
    return mon ? displayNameOf(mon) : id
  }
  const enemyNameOf = (enemy: EnemyUnit): string =>
    enemy.speciesId !== undefined ? getSpecies(enemy.speciesId).displayName : 'o desafiante'

  const enemiesDefeated = rounds.slice(0, step).filter((r) => r.youWon).length
  // Seus Pokémon que já perderam um duelo ficam cinza, como os desafiantes derrotados.
  const lostIds = new Set(
    rounds.slice(0, step).filter((r) => !r.youWon).map((r) => r.yourId),
  )
  // Quem perde no DECORRER TODO da defesa (para reconstruir o HP de antes da batalha).
  const lostOverall = new Set(defense.duels.filter((d) => !d.youWon).map((d) => d.yourId))
  const won = defense.status === 'won'

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
    <Overlay title="DEFESA — BATALHA" onClose={done ? finish : undefined} wide>
      <div className={styles.battle}>
        <div className={styles.battleSide}>
          <span className={styles.battleLabel}>Seu esquadrão</span>
          <div className={styles.battleRow}>
            {defense.squadIds.map((id) => {
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
                  trend={isCurrent ? trendOf(battle, base) : 'flat'}
                />
              )
            })}
          </div>
        </div>

        <div className={styles.battleSide}>
          <span className={styles.battleLabel}>
            Desafiantes ({enemiesDefeated}/{defense.enemies.length} derrotados)
          </span>
          <div className={styles.battleRow}>
            {defense.enemies.map((enemy, i) => {
              const isCurrent = current?.enemyIndex === i
              const battle = isCurrent ? current.enemyBattle : enemy.battle
              return (
                <Fighter
                  key={i}
                  spritePath={
                    enemy.speciesId !== undefined ? getSpecies(enemy.speciesId).spritePath : ''
                  }
                  alt=""
                  defeated={i < enemiesDefeated}
                  battle={battle}
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
              <b>{nameOf(r.yourId)}</b> {r.youWon ? 'venceu' : 'perdeu para'}{' '}
              {enemyNameOf(r.enemy)}
              {!r.youWon && ' (−1 HP)'}
            </li>
          ))}
        </ol>

        {done && (
          <p className={`${styles.result} ${won ? styles.resultWin : styles.resultLose}`}>
            {won ? 'GINÁSIO DEFENDIDO! ✓' : 'O ginásio caiu desta vez…'}
          </p>
        )}

        <button type="button" className={styles.confirm} onClick={finish} disabled={!done}>
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

/**
 * Lutador na cadeia de duelos: sprite com o HP do seu Pokémon e o selo "−1" sobrepostos,
 * e o atributo Batalha abaixo (com ▲/▼ quando o tipo dá vantagem/desvantagem no confronto).
 */
function Fighter({
  spritePath,
  alt,
  defeated,
  hp,
  showMinus,
  battle,
  trend,
}: {
  spritePath: string
  alt: string
  defeated: boolean
  hp?: { cur: number; max: number }
  showMinus?: boolean
  battle: number
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
