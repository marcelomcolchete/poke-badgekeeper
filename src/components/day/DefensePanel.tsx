// Defesa de ginásio (PLAN §4.4): escolha do esquadrão (≥1) e, em seguida, a animação da
// cadeia de duelos 1v1 (componente compartilhado BattleView). A resolução acontece na hora
// (reducer); o log de duelos guardado no estado alimenta a animação. Cada Pokémon — seu e
// desafiante — mostra a nota E–S; o desafiante em destaque (+15) exibe medalha.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { Pokemon, PokemonType } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { MIN_DEFENSE_SQUAD } from '../../engine/constants.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { gymWinXp } from '../../engine/gymDefense.ts'
import { pokemonRank } from '../../engine/ranking.ts'
import { sortRoster } from '../../engine/roster.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { getTrainer } from '../../data/trainers.ts'
import { RANK_COLOR } from '../common/visual.ts'
import { TypeBadge } from '../common/TypeBadge.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import { BattleView } from './BattleView.tsx'
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
    return (
      <BattleView
        state={state}
        trainer={getTrainer(defense.trainerId)}
        squadIds={defense.squadIds}
        enemies={defense.enemies}
        duels={defense.duels}
        won={defense.status === 'won'}
        title="DEFESA — BATALHA"
        wonText="GINÁSIO DEFENDIDO! ✓"
        lostText="O ginásio caiu desta vez…"
        onFinish={() => {
          dispatch({ type: 'COMPLETE_DEFENSE', defenseId })
          onClose()
        }}
      />
    )
  }

  const enemyTypes = [...new Set(defense.enemies.flatMap((e) => e.types))] as PokemonType[]
  const trainer = getTrainer(defense.trainerId)
  // Poder do desafiante = SOMA da Batalha de todo o esquadrão inimigo.
  const enemyPower = defense.enemies.reduce((sum, e) => sum + e.battle, 0)
  const valid = selected.length >= MIN_DEFENSE_SQUAD
  // Esquadrão escolhido, na ORDEM dos duelos (a ordem importa: a frente luta primeiro).
  const squad = selected
    .map((id) => state.roster.find((p) => p.id === id))
    .filter((p): p is Pokemon => p !== undefined)
  const teamBattle = squad.reduce((sum, m) => sum + Math.round(effectiveAttr(m, 'batalha')), 0)
  const myTypes = [...new Set(squad.flatMap((m) => m.types))] as PokemonType[]
  // Teto de XP da batalha: vencer todos os duelos, cada um rendendo gymWinXp do desafiante.
  const maxXp = defense.enemies.reduce((sum, e) => sum + gymWinXp(e.battle), 0)

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
      <div className={styles.defenseLayout}>
        {/* Barra do desafiante (ataque) — treinador, esquadrão, poder e tipos. Os Pokémon do
            adversário só são revelados na batalha (não no preview). */}
        <div className={`${styles.sideBar} ${styles.attackBar}`}>
          <span className={styles.trainerTag}>
            <img className={styles.trainerArt} src={trainer.spritePath} alt={trainer.displayName} />
            <span className={styles.trainerName}>{trainer.displayName}</span>
          </span>
          <span className={styles.barLabel}>Desafiante</span>
          <span className={styles.barStat}>
            Esquadrão <b>{defense.enemies.length}</b>
          </span>
          <span className={styles.barStat}>
            Poder <b>{enemyPower}</b>
          </span>
          <span className={styles.barTypes}>
            {enemyTypes.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
        </div>

        {/* Barra do seu time (defesa) — esquadrão, poder, tipos + miniaturas em ordem. */}
        <div className={`${styles.sideBar} ${styles.defendBar}`}>
          <div className={styles.barTop}>
            <span className={styles.barIcon} aria-hidden="true">
              🛡
            </span>
            <span className={styles.barLabel}>Seu time</span>
            <span className={styles.barStat}>
              Esquadrão <b>{selected.length}</b>
            </span>
            <span className={styles.barStat}>
              Poder <b>{teamBattle}</b>
            </span>
            <span className={styles.barStat}>
              EXP até <b>{maxXp}</b>
            </span>
          </div>
          <span className={styles.barTypes}>
            {myTypes.length > 0 ? (
              myTypes.map((t) => <TypeBadge key={t} type={t} />)
            ) : (
              <span className={styles.barTypesEmpty}>Tipos do seu time aparecem aqui</span>
            )}
          </span>
          {squad.length === 0 ? (
            <span className={styles.selectedEmpty}>
              Escolha ao menos {MIN_DEFENSE_SQUAD} abaixo. Arraste para reordenar os duelos.
            </span>
          ) : (
            <ol className={styles.miniTeam}>
              {squad.map((mon, i) => (
                <li
                  key={mon.id}
                  className={`${styles.miniChip} ${dragIndex === i ? styles.dragging : ''}`}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) reorder(dragIndex, i)
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  title={`${i + 1}º — ${displayNameOf(mon)} (arraste para reordenar)`}
                >
                  <span className={styles.miniPos} aria-hidden="true">
                    {i + 1}
                  </span>
                  {genderSymbol(mon.gender) && (
                    <span
                      className={styles.genderBadge}
                      style={{ color: genderColor(mon.gender) }}
                      aria-label={mon.gender === 'female' ? 'Fêmea' : 'Macho'}
                    >
                      {genderSymbol(mon.gender)}
                    </span>
                  )}
                  <img
                    className={styles.miniSprite}
                    src={getSpecies(mon.speciesId).spritePath}
                    alt={displayNameOf(mon)}
                    draggable={false}
                  />
                  <button
                    type="button"
                    className={styles.miniRemove}
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

        {/* Pokémon para escolher, em 3 colunas. */}
        <div className={styles.pickerThree}>
          {sortRoster(state.roster).map((mon) => (
            <BattlePick
              key={mon.id}
              mon={mon}
              position={selected.indexOf(mon.id) + 1}
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
 * Carta compacta de seleção para a defesa (3 colunas): sprite, nome e tipos + a nota E–S e o
 * atributo Batalha. Quando selecionado, mostra a POSIÇÃO na cadeia de duelos. `position` > 0
 * = selecionado.
 */
function BattlePick({
  mon,
  position,
  disabled,
  onClick,
}: {
  mon: Pokemon
  position: number
  disabled: boolean
  onClick?: () => void
}) {
  const species = getSpecies(mon.speciesId)
  const battle = Math.round(effectiveAttr(mon, 'batalha'))
  const rank = pokemonRank(mon)
  const fainted = mon.currentHp <= 0
  const selected = position > 0
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
      <span
        className={styles.pickRank}
        style={{ color: RANK_COLOR[rank], borderColor: RANK_COLOR[rank] }}
        aria-label={`Nota ${rank}`}
      >
        {rank}
      </span>
      {selected && (
        <span className={styles.pickPos} aria-label={`Posição ${position} na batalha`}>
          {position}º
        </span>
      )}
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
          {genderSymbol(mon.gender) && (
            <span style={{ color: genderColor(mon.gender) }}> {genderSymbol(mon.gender)}</span>
          )}
        </span>
        <span className={styles.battlePickTypes}>
          {mon.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
      </span>
      <span className={styles.battlePickStat}>
        <span className={styles.battlePickStatVal}>{battle}</span>
        <span className={styles.battlePickStatLbl}>⚔</span>
      </span>
    </button>
  )
}
