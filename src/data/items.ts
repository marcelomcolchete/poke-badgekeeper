// Itens do mercado (PLAN §4.6). Efeitos concretos são aplicados pela engine (Fase 2);
// preços e balanceamento são ajustáveis na Fase 5.

import type { ItemData } from './types.ts'

export const ITEMS: ItemData[] = [
  {
    id: 'potion',
    name: 'Potion',
    kind: 'usable',
    price: 200,
    description: 'Recupera alguns pontos de HP de um Pokémon.',
  },
  {
    id: 'super-potion',
    name: 'Super Potion',
    kind: 'usable',
    price: 500,
    description: 'Recupera bastante HP de um Pokémon.',
  },
  {
    id: 'revive',
    name: 'Revive',
    kind: 'usable',
    price: 1500,
    description: 'Revive um Pokémon desmaiado com metade do HP.',
  },
  {
    id: 'quick-claw',
    name: 'Quick Claw',
    kind: 'passive',
    price: 1000,
    description: 'Aumenta a chance de agir primeiro nas batalhas de defesa.',
  },
  {
    id: 'amulet-coin',
    name: 'Amulet Coin',
    kind: 'passive',
    price: 1200,
    description: 'Aumenta o ouro recebido no fim do dia.',
  },
]

export function getItem(id: string): ItemData {
  const item = ITEMS.find((i) => i.id === id)
  if (!item) throw new Error(`Item ${id} não encontrado`)
  return item
}
