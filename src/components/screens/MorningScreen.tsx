// Manhã / Mercado (PLAN — Sistema de Itens): 3 itens sorteados do dia em cards (foto, nome,
// efeito, preço), revisar o time e começar o dia. Rare Candy abre um seletor de Pokémon.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import type { ItemData } from '../../data/types.ts'
import { MAX_ROSTER_SIZE, LEVEL_MAX, TOTAL_DAYS } from '../../engine/constants.ts'
import { getDailyShop, getItem } from '../../data/items.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { TeamPanel } from '../TeamPanel/TeamPanel.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { Stars } from '../common/Stars.tsx'
import { ItemsBar } from '../common/ItemsBar.tsx'
import styles from './MorningScreen.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
}

/** Como o item se apresenta hoje: rótulo do botão, se está desabilitado e badge de status. */
function shopState(
  item: ItemData,
  state: GameState,
): { label: string; disabled: boolean; badge: string | null; needsTarget: boolean } {
  const afford = state.gold >= item.price
  const effect = item.effect
  if (effect.kind === 'passive') {
    const owned = state.runItems.includes(item.id)
    return {
      label: owned ? 'EQUIPADO' : `$ ${item.price}`,
      disabled: owned || !afford,
      badge: owned ? '✓' : null,
      needsTarget: false,
    }
  }
  if (effect.kind === 'statBuff') {
    const active = state.roster.some((p) => (p.dayBuffs?.[effect.attr] ?? 0) > 0)
    return {
      label: active ? 'ATIVO HOJE' : `$ ${item.price}`,
      disabled: active || !afford,
      badge: active ? '✓' : null,
      needsTarget: false,
    }
  }
  if (effect.kind === 'rareCandy') {
    const anyLevelable = state.roster.some((p) => p.level < LEVEL_MAX)
    return { label: `$ ${item.price}`, disabled: !afford || !anyLevelable, badge: null, needsTarget: true }
  }
  // autoPotion / autoRevive: contam usos no inventário.
  const uses = state.inventory.find((i) => i.itemId === item.id)?.quantity ?? 0
  return { label: `$ ${item.price}`, disabled: !afford, badge: uses > 0 ? `×${uses}` : null, needsTarget: false }
}

export function MorningScreen({ state, dispatch }: Props) {
  const [teamOpen, setTeamOpen] = useState(false)
  // Item de Rare Candy aguardando a escolha do Pokémon (null = seletor fechado).
  const [candyOpen, setCandyOpen] = useState(false)

  const shop = getDailyShop(state.run.seed, state.run.day, state.run.cityIndex).map(getItem)

  const buy = (item: ItemData): void => {
    if (item.effect.kind === 'rareCandy') setCandyOpen(true)
    else dispatch({ type: 'BUY_ITEM', itemId: item.id })
  }

  const pickCandyTarget = (pokemonId: string): void => {
    dispatch({ type: 'USE_RARE_CANDY', pokemonId })
    setCandyOpen(false)
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.title}>
          MANHÃ — DIA {state.run.day}/{TOTAL_DAYS}
        </span>
        <span className={styles.meta}>
          <span className={styles.gold}>$ {state.gold}</span>
          <Stars value={state.approval.stars} />
        </span>
      </header>

      <section className={styles.market}>
        <span className={styles.sectionTitle}>MERCADO — 3 ITENS DO DIA</span>
        <div className={styles.shop}>
          {shop.map((item) => {
            const s = shopState(item, state)
            return (
              <div key={item.id} className={styles.card}>
                <span className={styles.cardKind}>
                  {item.type === 'passive' ? 'PASSIVO' : 'CONSUMÍVEL'}
                </span>
                {s.badge && <span className={styles.cardBadge}>{s.badge}</span>}
                <img className={styles.cardImg} src={item.sprite} alt={item.name} />
                <span className={styles.cardName}>{item.name}</span>
                <span className={styles.cardEffect}>{item.description}</span>
                <button
                  type="button"
                  className={styles.buyBtn}
                  disabled={s.disabled}
                  onClick={() => buy(item)}
                  data-sound="select"
                >
                  {s.label}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <ItemsBar state={state} />

      <section className={styles.team}>
        <div className={styles.teamHead}>
          <span className={styles.sectionTitle}>
            SEU TIME ({state.roster.length}/{MAX_ROSTER_SIZE})
          </span>
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
      <button
        type="button"
        className={styles.primary}
        onClick={() => dispatch({ type: 'ADVANCE_PHASE' })}
      >
        Começar o dia ▶
      </button>

      {teamOpen && <TeamPanel state={state} dispatch={dispatch} onClose={() => setTeamOpen(false)} />}

      {candyOpen && (
        <Overlay title="RARE CANDY — ESCOLHA UM POKÉMON" wide onClose={() => setCandyOpen(false)}>
          <p className={styles.candyHint}>O Pokémon escolhido sobe +1 nível na hora.</p>
          <div className={styles.roster}>
            {state.roster.map((mon) => (
              <PokemonCard
                key={mon.id}
                pokemon={mon}
                disabled={mon.level >= LEVEL_MAX}
                onClick={() => pickCandyTarget(mon.id)}
              />
            ))}
          </div>
        </Overlay>
      )}
    </div>
  )
}
