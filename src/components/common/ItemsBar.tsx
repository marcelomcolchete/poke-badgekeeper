// Barra de itens possuídos (PLAN — Sistema de Itens): mostra a foto de cada item ativo com
// um tooltip (nome + efeito). Cobre consumíveis (Potion/Revive com usos restantes), buffs
// diários x_* (com +valor) e passivos da run (Eviolite/Exp Share…). Só leitura.

import type { AttrKey } from '../../types/index.ts'
import { ATTR_KEYS } from '../../types/index.ts'
import type { GameState } from '../../engine/state.ts'
import { ITEMS, findItem } from '../../data/items.ts'
import styles from './ItemsBar.module.css'

interface Entry {
  key: string
  sprite: string
  title: string
  badge: string | null
}

/** Item x_* que dá buff num eixo (para mostrar o ícone do buff ativo do dia). */
function statItemFor(attr: AttrKey) {
  return ITEMS.find((i) => i.effect.kind === 'statBuff' && i.effect.attr === attr) ?? null
}

function collectEntries(state: GameState): Entry[] {
  const entries: Entry[] = []

  // Consumíveis no inventário (cura/revive) com usos restantes.
  for (const stack of state.inventory) {
    const item = findItem(stack.itemId)
    if (!item || stack.quantity <= 0) continue
    entries.push({
      key: `inv-${item.id}`,
      sprite: item.sprite,
      title: `${item.name} — ${item.description}`,
      badge: `×${stack.quantity}`,
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

  return entries
}

interface Props {
  state: GameState
  /** Rótulo opcional à esquerda (ex.: na manhã). */
  label?: string
}

export function ItemsBar({ state, label = 'ITENS' }: Props) {
  const entries = collectEntries(state)
  return (
    <div className={styles.bar}>
      <span className={styles.label}>{label}</span>
      {entries.length === 0 ? (
        <span className={styles.empty}>nenhum item ativo</span>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) => (
            <li key={e.key} className={styles.item} title={e.title}>
              <img className={styles.icon} src={e.sprite} alt="" />
              {e.badge && <span className={styles.badge}>{e.badge}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
