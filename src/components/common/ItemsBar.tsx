// Barra de itens possuídos (PLAN — Sistema de Itens): mostra a foto de cada item ativo com
// um tooltip (nome + efeito). Cobre consumíveis (cura/revive com usos restantes), buffs
// diários x_* (com +valor) e passivos da run (Eviolite/Exp Share…).
// Os itens de cura/revive são CLICÁVEIS: escopo `single` abre um seletor de Pokémon; escopo
// `team` aplica no time inteiro na hora. Os demais ícones são só leitura.

import { useState } from 'react'
import type { Dispatch } from 'react'
import type { AttrKey } from '../../types/index.ts'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import type { GameAction } from '../../game/actions.ts'
import type { ItemData } from '../../data/types.ts'
import { ITEMS, findItem } from '../../data/items.ts'
import { EGG_INCUBATION_DAYS } from '../../engine/constants.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { Overlay } from './Overlay.tsx'
import { displayNameOf } from './naming.ts'
import styles from './ItemsBar.module.css'

interface Entry {
  key: string
  sprite: string
  title: string
  badge: string | null
  /** Item de cura/revive utilizável (clique). Ausente = ícone só de leitura. */
  use?: ItemData
}

/** Item x_* que dá buff num eixo (para mostrar o ícone do buff ativo do dia). */
function statItemFor(attr: AttrKey) {
  return ITEMS.find((i) => i.effect.kind === 'statBuff' && i.effect.attr === attr) ?? null
}

function collectEntries(state: GameState): Entry[] {
  const entries: Entry[] = []

  // Consumíveis no inventário (cura/revive) com usos restantes — clicáveis para usar.
  for (const stack of state.inventory) {
    const item = findItem(stack.itemId)
    if (!item || stack.quantity <= 0) continue
    const usable = item.effect.kind === 'heal' || item.effect.kind === 'revive' || item.effect.kind === 'berry'
    entries.push({
      key: `inv-${item.id}`,
      sprite: item.sprite,
      title: `${item.name} — ${item.description}${usable ? ' (clique para usar)' : ''}`,
      badge: `×${stack.quantity}`,
      use: usable ? item : undefined,
    })
  }

  // Buffs diários x_* ativos (valor máximo no roster, já que se aplicam a todos).
  for (const attr of ATTR_KEYS) {
    const amount = state.roster.reduce((max, p) => Math.max(max, p.dayBuffs?.[attr] ?? 0), 0)
    if (amount <= 0) continue
    const item = statItemFor(attr)
    if (!item) continue
    entries.push({
      key: `buff-${attr}`,
      sprite: item.sprite,
      title: `${item.name} — ${item.description}`,
      badge: `+${amount}`,
    })
  }

  // Itens passivos da run.
  for (const id of state.runItems) {
    const item = findItem(id)
    if (!item) continue
    entries.push({ key: `run-${id}`, sprite: item.sprite, title: `${item.name} — ${item.description}`, badge: null })
  }

  // Ovos chocando (Poke Egg) — só leitura, mostra o progresso N/3.
  for (const egg of state.eggs ?? []) {
    entries.push({
      key: `egg-${egg.id}`,
      sprite: '/sprites/itens/poke-egg.png',
      title: `Poke Egg — chocando ${egg.daysElapsed}/${EGG_INCUBATION_DAYS}`,
      badge: `${egg.daysElapsed}/${EGG_INCUBATION_DAYS}`,
    })
  }

  return entries
}

/** Pokémon elegíveis para o item de escopo single (heal: feridos; revive: desmaiados; berry: vivos). */
function eligibleTargets(state: GameState, item: ItemData) {
  if (item.effect.kind === 'revive') return state.roster.filter((p) => p.currentHp <= 0)
  if (item.effect.kind === 'berry') return state.roster.filter((p) => p.currentHp > 0)
  return state.roster.filter((p) => p.currentHp > 0 && p.currentHp < p.maxHp)
}

interface Props {
  state: GameState
  /** Sem dispatch a barra fica só leitura (não dá para usar itens). */
  dispatch?: Dispatch<GameAction>
  /** Rótulo opcional à esquerda (ex.: na manhã). */
  label?: string
}

export function ItemsBar({ state, dispatch, label = 'ITENS' }: Props) {
  const entries = collectEntries(state)
  // Item de escopo single aguardando a escolha do alvo (null = nenhum seletor aberto).
  const [picking, setPicking] = useState<ItemData | null>(null)

  const onUse = (item: ItemData): void => {
    if (!dispatch) return
    if (item.effect.kind === 'berry') {
      setPicking(item)
      return
    }
    if (item.effect.kind !== 'heal' && item.effect.kind !== 'revive') return
    if (item.effect.scope === 'team') {
      dispatch({ type: 'USE_ITEM', itemId: item.id, targetId: '' })
      return
    }
    setPicking(item)
  }

  const pickTarget = (item: ItemData, targetId: string): void => {
    dispatch?.({ type: 'USE_ITEM', itemId: item.id, targetId })
    setPicking(null)
  }

  const targets = picking ? eligibleTargets(state, picking) : []

  return (
    <div className={styles.bar}>
      <span className={styles.label}>{label}</span>
      {entries.length === 0 ? (
        <span className={styles.empty}>nenhum item ativo</span>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) =>
            e.use && dispatch ? (
              <li key={e.key}>
                <button
                  type="button"
                  className={`${styles.item} ${styles.usable}`}
                  title={e.title}
                  onClick={() => onUse(e.use as ItemData)}
                  data-sound="select"
                >
                  <img className={styles.icon} src={e.sprite} alt="" />
                  {e.badge && <span className={styles.badge}>{e.badge}</span>}
                </button>
              </li>
            ) : (
              <li key={e.key} className={styles.item} title={e.title}>
                <img className={styles.icon} src={e.sprite} alt="" />
                {e.badge && <span className={styles.badge}>{e.badge}</span>}
              </li>
            ),
          )}
        </ul>
      )}

      {picking && (
        <Overlay title={`${picking.name.toUpperCase()} — ESCOLHA UM POKÉMON`} onClose={() => setPicking(null)}>
          {targets.length === 0 ? (
            <p className={styles.pickHint}>Nenhum Pokémon precisa deste item agora.</p>
          ) : (
            <div className={styles.pickList}>
              {targets.map((mon) => {
                const species = getSpecies(mon.speciesId)
                return (
                  <button
                    key={mon.id}
                    type="button"
                    className={styles.pickRow}
                    onClick={() => pickTarget(picking, mon.id)}
                    data-sound="select"
                  >
                    <img className={styles.pickImg} src={species.spritePath} alt="" />
                    <span className={styles.pickName}>{displayNameOf(mon)}</span>
                    <span className={styles.pickHp}>
                      {mon.currentHp}/{mon.maxHp} HP
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Overlay>
      )}
    </div>
  )
}
