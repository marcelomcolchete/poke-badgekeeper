// Computador (PC) — PLAN §4.5 (redesign). Só de manhã: duas colunas (Time × Computador) com
// cartas compactas. Clicar num do time o DEPOSITA no PC (mantendo ≥1 no time); clicar num do PC
// o RETIRA para o time (se houver vaga). Para trocar com o time cheio: deposite um e retire outro.

import type { Dispatch } from 'react'
import { ATTR_KEYS } from '../../types/index.ts'
import type { Pokemon } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { MAX_ROSTER_SIZE } from '../../engine/constants.ts'
import { getSpecies, pokemonSpritePath } from '../../data/pokemon/index.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { pokemonRank } from '../../engine/ranking.ts'
import { Overlay } from '../common/Overlay.tsx'
import { ATTR_SHORT_PT, RANK_COLOR } from '../common/visual.ts'
import { displayNameOf, genderColor, genderSymbol } from '../common/naming.ts'
import styles from './BoxPanel.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
  onClose: () => void
}

interface MonCardProps {
  pokemon: Pokemon
  /** Texto da ação (ex.: "Depositar →" / "← Retirar"). */
  action: string
  disabled: boolean
  onClick: () => void
}

function MonCard({ pokemon, action, disabled, onClick }: MonCardProps) {
  const species = getSpecies(pokemon.speciesId)
  const rank = pokemonRank(pokemon)
  const symbol = genderSymbol(pokemon.gender)
  return (
    <button
      type="button"
      className={`${styles.mon} ${disabled ? styles.monOff : ''}`}
      disabled={disabled}
      onClick={onClick}
      data-sound={disabled ? undefined : 'select'}
    >
      <span
        className={styles.rank}
        style={{ color: RANK_COLOR[rank], borderColor: RANK_COLOR[rank] }}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
      <div className={styles.top}>
        <img className={styles.sprite} src={pokemonSpritePath(pokemon)} alt={species.displayName} />
        <span className={styles.id}>
          <span className={styles.name}>
            {displayNameOf(pokemon)}
            {symbol && <span style={{ color: genderColor(pokemon.gender) }}> {symbol}</span>}
          </span>
          <span className={styles.lvl}>Nv {pokemon.level}</span>
        </span>
      </div>
      <span className={styles.stats}>
        {ATTR_KEYS.map((k) => (
          <span key={k} className={styles.stat}>
            <span className={styles.statLbl}>{ATTR_SHORT_PT[k]}</span>
            <b>{effectiveAttr(pokemon, k)}</b>
          </span>
        ))}
      </span>
      {!disabled && <span className={styles.action}>{action}</span>}
    </button>
  )
}

export function BoxPanel({ state, dispatch, onClose }: Props) {
  const teamLocked = state.roster.length <= 1 // não pode esvaziar o time
  const teamFull = state.roster.length >= MAX_ROSTER_SIZE

  return (
    <Overlay title="COMPUTADOR 🖥️" onClose={onClose} wide>
      <p className={styles.hint}>
        Troque Pokémon entre o <b>Time</b> e o <b>Computador</b> (só de manhã). Para trocar com o
        time cheio: deposite um do time e depois retire um do PC.
      </p>
      <div className={styles.columns}>
        <section className={styles.col}>
          <span className={styles.colHead}>
            TIME ({state.roster.length}/{MAX_ROSTER_SIZE})
          </span>
          <div className={styles.list}>
            {state.roster.map((mon) => (
              <MonCard
                key={mon.id}
                pokemon={mon}
                action="Depositar →"
                disabled={teamLocked}
                onClick={() => dispatch({ type: 'DEPOSIT_POKEMON', pokemonId: mon.id })}
              />
            ))}
          </div>
          {teamLocked && <span className={styles.note}>Mantenha ao menos 1 Pokémon no time.</span>}
        </section>

        <section className={styles.col}>
          <span className={styles.colHead}>COMPUTADOR ({state.box.length})</span>
          <div className={styles.list}>
            {state.box.length === 0 ? (
              <span className={styles.empty}>
                Vazio. Pokémon capturados com o time cheio chegam aqui.
              </span>
            ) : (
              state.box.map((mon) => (
                <MonCard
                  key={mon.id}
                  pokemon={mon}
                  action="← Retirar"
                  disabled={teamFull}
                  onClick={() => dispatch({ type: 'WITHDRAW_POKEMON', pokemonId: mon.id })}
                />
              ))
            )}
          </div>
          {teamFull && state.box.length > 0 && (
            <span className={styles.note}>Time cheio — deposite alguém para abrir vaga.</span>
          )}
        </section>
      </div>
    </Overlay>
  )
}
