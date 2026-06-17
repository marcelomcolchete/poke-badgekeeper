// Manhã / Mercado (PLAN — Sistema de Itens): 3 itens sorteados do dia em cards (foto, nome,
// efeito, preço), fixos no dia — comprar marca o slot como VENDIDO. O aviso e o botão de
// começar o dia ficam acima do time; o Rare Candy abre um seletor enxuto (atributos por escrito).

import { useState } from 'react'
import type { Dispatch } from 'react'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import type { ItemData } from '../../data/types.ts'
import { MAX_ROSTER_SIZE, LEVEL_MAX, TOTAL_DAYS } from '../../engine/constants.ts'
import { getDailyShop, getItem } from '../../data/items.ts'
import { currentBall, nextBall, RARITY_LABEL_PT, type BallDef } from '../../data/balls.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { effectiveAttr } from '../../engine/attributes.ts'
import { PokemonCard } from '../PokemonCard/PokemonCard.tsx'
import { TeamPanel } from '../TeamPanel/TeamPanel.tsx'
import { BoxPanel } from '../BoxPanel/BoxPanel.tsx'
import { Textbox } from '../Textbox/Textbox.tsx'
import { Overlay } from '../common/Overlay.tsx'
import { Stars } from '../common/Stars.tsx'
import { Hearts } from '../common/Hearts.tsx'
import { ItemsBar } from '../common/ItemsBar.tsx'
import { WeatherForecastPanel } from './WeatherForecastPanel.tsx'
import { ATTR_SHORT_PT } from '../common/visual.ts'
import { displayNameOf } from '../common/naming.ts'
import styles from './MorningScreen.module.css'

interface Props {
  state: GameState
  dispatch: Dispatch<GameAction>
}

interface ShopState {
  label: string
  disabled: boolean
  sold: boolean
  needsTarget: boolean
}

/** Como o item se apresenta hoje: rótulo do botão, se está desabilitado/vendido. */
function shopState(item: ItemData, state: GameState): ShopState {
  if (state.today.purchasedItems.includes(item.id)) {
    return { label: 'VENDIDO', disabled: true, sold: true, needsTarget: false }
  }
  const afford = state.gold >= item.price
  if (item.effect.kind === 'rareCandy') {
    const anyLevelable = state.roster.some((p) => p.level < LEVEL_MAX)
    return { label: `$ ${item.price}`, disabled: !afford || !anyLevelable, sold: false, needsTarget: true }
  }
  return { label: `$ ${item.price}`, disabled: !afford, sold: false, needsTarget: false }
}

/** Card fixo da Pokébola evolutiva: foto, raridade liberada e preço (GRÁTIS no 1º nível). */
function BallCard({
  ball,
  sold,
  gold,
  onBuy,
}: {
  ball: BallDef
  sold: boolean
  gold: number
  onBuy: () => void
}) {
  const free = ball.price === 0
  const label = sold ? 'VENDIDO' : free ? 'GRÁTIS' : `$ ${ball.price}`
  const disabled = sold || (!free && gold < ball.price)
  return (
    <div className={`${styles.card} ${sold ? styles.cardSold : ''}`}>
      {free && !sold && <span className={styles.cardBadge}>GRÁTIS</span>}
      <span className={styles.cardKind}>BOLA</span>
      <img className={styles.cardImg} src={ball.sprite} alt={ball.name} />
      <span className={styles.cardName}>{ball.name}</span>
      <span className={styles.cardEffect}>
        Libera Pokémon {RARITY_LABEL_PT[ball.ceiling]} na exploração.
      </span>
      <button
        type="button"
        className={styles.buyBtn}
        disabled={disabled}
        onClick={onBuy}
        data-sound="select"
      >
        {label}
      </button>
      {sold && <span className={styles.soldStamp}>VENDIDO</span>}
    </div>
  )
}

export function MorningScreen({ state, dispatch }: Props) {
  const [teamOpen, setTeamOpen] = useState(false)
  const [boxOpen, setBoxOpen] = useState(false)
  // Seletor de alvo do Rare Candy (null = fechado).
  const [candyOpen, setCandyOpen] = useState(false)

  // Oferta fixa do dia (vinda do estado); saves antigos sem oferta caem no sorteio derivado.
  const offerIds =
    state.today.shopOffer.length > 0
      ? state.today.shopOffer
      : getDailyShop(state.run.seed, state.run.day, state.run.cityIndex, state.runItems)

  // Pokébola evolutiva: slot fixo à esquerda. Após comprá-la hoje, mostra-a VENDIDA (só evolui
  // no dia seguinte); senão, mostra a próxima bola comprável. Sem bola a mostrar = 5 itens normais.
  const owned = currentBall(state.run.ballLevel)
  const ballBoughtToday = owned ? state.today.purchasedItems.includes(owned.id) : false
  const ballToShow: BallDef | null = ballBoughtToday ? owned : nextBall(state.run.ballLevel)
  const shop = offerIds.slice(0, ballToShow ? 4 : 5).map(getItem)

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
          <span className={styles.starTrack} title="Estrelas de missões">
            🎯 <Stars value={state.approval.missionStars} />
          </span>
          <span className={styles.starTrack} title="Estrelas de batalhas">
            ⚔️ <Stars value={state.approval.battleStars} />
          </span>
        </span>
      </header>

      <WeatherForecastPanel state={state} />

      <section className={styles.market}>
        <span className={styles.sectionTitle}>MERCADO — 5 ITENS DO DIA</span>
        <div className={styles.shop}>
          {ballToShow && (
            <BallCard
              ball={ballToShow}
              sold={ballBoughtToday}
              gold={state.gold}
              onBuy={() => dispatch({ type: 'BUY_BALL' })}
            />
          )}
          {shop.map((item) => {
            const s = shopState(item, state)
            return (
              <div key={item.id} className={`${styles.card} ${s.sold ? styles.cardSold : ''}`}>
                <span className={styles.cardKind}>
                  {item.type === 'passive' ? 'PASSIVO' : 'CONSUMÍVEL'}
                </span>
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
                {s.sold && <span className={styles.soldStamp}>VENDIDO</span>}
              </div>
            )
          })}
        </div>
      </section>

      <ItemsBar state={state} />

      {/* Aviso + começar o dia ACIMA do time (sem precisar rolar a tela). */}
      <div className={styles.startBlock}>
        <Textbox>Prepare-se: compre itens e monte seu time. Pronto para começar o dia?</Textbox>
        <button
          type="button"
          className={styles.primary}
          onClick={() => dispatch({ type: 'ADVANCE_PHASE' })}
        >
          Começar o dia ▶
        </button>
      </div>

      <section className={styles.team}>
        <div className={styles.teamHead}>
          <span className={styles.sectionTitle}>
            SEU TIME ({state.roster.length}/{MAX_ROSTER_SIZE})
          </span>
          <span className={styles.teamActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => setBoxOpen(true)}>
              Computador ({state.box.length}) ▸
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => setTeamOpen(true)}>
              Gerenciar ▸
            </button>
          </span>
        </div>
        <div className={styles.roster}>
          {state.roster.map((mon) => (
            <div key={mon.id} className={styles.rosterCard}>
              <PokemonCard pokemon={mon} />
              <span className={styles.rosterHearts}>
                <Hearts value={mon.hearts} />
              </span>
            </div>
          ))}
        </div>
      </section>

      {teamOpen && <TeamPanel state={state} dispatch={dispatch} onClose={() => setTeamOpen(false)} />}

      {boxOpen && <BoxPanel state={state} dispatch={dispatch} onClose={() => setBoxOpen(false)} />}

      {candyOpen && (
        <Overlay title="RARE CANDY — ESCOLHA UM POKÉMON" onClose={() => setCandyOpen(false)}>
          <p className={styles.candyHint}>O Pokémon escolhido sobe +1 nível na hora.</p>
          <div className={styles.candyList}>
            {state.roster.map((mon) => {
              const species = getSpecies(mon.speciesId)
              const atMax = mon.level >= LEVEL_MAX
              return (
                <button
                  key={mon.id}
                  type="button"
                  className={styles.candyRow}
                  disabled={atMax}
                  onClick={() => pickCandyTarget(mon.id)}
                  data-sound="select"
                >
                  <img className={styles.candyImg} src={species.spritePath} alt="" />
                  <span className={styles.candyMain}>
                    <span className={styles.candyName}>
                      {displayNameOf(mon)}
                      <span className={styles.candyLvl}>Nv {mon.level}{atMax ? ' (máx)' : ''}</span>
                    </span>
                    <span className={styles.candyAttrs}>
                      {ATTR_KEYS.map((k) => (
                        <span key={k} className={styles.candyAttr}>
                          {ATTR_SHORT_PT[k]} <b>{effectiveAttr(mon, k)}</b>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={styles.candyPlus}>{atMax ? '—' : '+1 Nv'}</span>
                </button>
              )
            })}
          </div>
        </Overlay>
      )}
    </div>
  )
}
