// Modal de level-up (PLAN §4.1): abre assim que um Pokémon do jogador sobe de nível e
// passa a ter pontos pendentes. Cada clique aloca 1 ponto (+10 no atributo); quando
// zera, o App passa ao próximo Pokémon com pontos ou fecha o modal. Não tem botão de
// fechar — a distribuição é imediata e obrigatória.

import type { Dispatch } from 'react'
import { ATTR_KEYS, type Pokemon } from '../../types/index.ts'
import type { GameAction } from '../../game/actions.ts'
import { pendingPoints } from '../../engine/leveling.ts'
import { effectiveAttr, perPointGain } from '../../engine/attributes.ts'
import { ATTR_MAX, ATTR_PER_POINT } from '../../engine/constants.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { ATTR_LABEL_PT } from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
import styles from './LevelUpModal.module.css'

interface Props {
  pokemon: Pokemon
  dispatch: Dispatch<GameAction>
}

export function LevelUpModal({ pokemon, dispatch }: Props) {
  const pending = pendingPoints(pokemon)
  const name = displayNameOf(pokemon)
  // Atributo no teto (60) fica travado — salvo o caso (raríssimo) de TODOS estarem no teto,
  // o que travaria o modal obrigatório; aí libera para não prender o jogador.
  const maxed = ATTR_KEYS.map((attr) => effectiveAttr(pokemon, attr) >= ATTR_MAX)
  const allMaxed = maxed.every(Boolean)

  return (
    <div className={styles.backdrop} role="dialog" aria-label="Subiu de nível">
      <div className={styles.panel}>
        <span className={styles.title}>SUBIU DE NÍVEL!</span>
        <p className={styles.lead}>
          <b>{name}</b> chegou ao nível {pokemon.level}. Distribua <b>+{pending}</b> ponto(s):
        </p>
        <div className={styles.card}>
          <PokemonCard pokemon={pokemon} />
        </div>
        <div className={styles.allocBtns}>
          {ATTR_KEYS.map((attr, i) => {
            const locked = !allMaxed && maxed[i]
            // Incremento real do ponto: +15 (favorecido pela natureza), +5 (penalizado), +10 (neutro).
            const gain = perPointGain(pokemon, attr)
            const gainClass =
              gain > ATTR_PER_POINT ? styles.gainUp : gain < ATTR_PER_POINT ? styles.gainDown : ''
            return (
              <button
                key={attr}
                type="button"
                className={`${styles.allocBtn} ${locked ? styles.allocBtnMax : ''}`}
                disabled={locked}
                onClick={() => dispatch({ type: 'ALLOCATE_POINT', pokemonId: pokemon.id, attr })}
              >
                {ATTR_LABEL_PT[attr]}{' '}
                {locked ? 'MÁX' : <span className={gainClass}>+{gain}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
