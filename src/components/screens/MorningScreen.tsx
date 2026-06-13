// Manhã / Mercado (PLAN §3/§4.6): comprar itens, revisar o time e começar o dia.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import { TOTAL_DAYS } from '../../engine/constants.ts'
import { ITEMS } from '../../data/items.ts'
import { canAfford } from '../../engine/economy.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { TeamPanel } from '../TeamPanel/TeamPanel.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import { Stars } from '../common/Stars.tsx'
import styles from './MorningScreen.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
}

export function MorningScreen({ state, dispatch }: Props) {
  const [teamOpen, setTeamOpen] = useState(false)

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.title}>MANHÃ — DIA {state.run.day}/{TOTAL_DAYS}</span>
        <span className={styles.meta}>
          <span className={styles.gold}>$ {state.gold}</span>
          <Stars value={state.approval.stars} />
        </span>
      </header>

      <section className={styles.market}>
        <span className={styles.sectionTitle}>MERCADO</span>
        <ul className={styles.items}>
          {ITEMS.map((item) => {
            const owned = state.inventory.find((i) => i.itemId === item.id)?.quantity ?? 0
            return (
              <li key={item.id} className={styles.item}>
                <span className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemDesc}>{item.description}</span>
                </span>
                <span className={styles.itemBuy}>
                  {owned > 0 && <span className={styles.owned}>×{owned}</span>}
                  <button
                    type="button"
                    className={styles.buyBtn}
                    disabled={!canAfford(state.gold, item)}
                    onClick={() => dispatch({ type: 'BUY_ITEM', itemId: item.id })}
                  >
                    $ {item.price}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={styles.team}>
        <div className={styles.teamHead}>
          <span className={styles.sectionTitle}>SEU TIME ({state.roster.length}/9)</span>
          <button type="button" className={styles.ghostBtn} onClick={() => setTeamOpen(true)}>
            Gerenciar ▸
          </button>
        </div>
        <div className={styles.roster}>
          {state.roster.map((mon) => (
            <PokemonCard key={mon.id} pokemon={mon} />
          ))}
        </div>
      </section>

      <Textbox>Prepare-se: compre itens e monte seu time. Pronto para começar o dia?</Textbox>
      <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'ADVANCE_PHASE' })}>
        Começar o dia ▶
      </button>

      {teamOpen && <TeamPanel state={state} dispatch={dispatch} onClose={() => setTeamOpen(false)} />}
    </div>
  )
}
