// Catálogo de itens do mercado (PLAN — Sistema de Itens). Cada item declara família
// (consumível × passivo), preço, sprite e um `effect` que dirige a compra (marketFlow) e os
// efeitos na engine. O mercado da manhã oferece 3 itens sorteados por dia (getDailyShop).

import type { AttrKey } from '../types/index.ts'
import { createRng, deriveSeed } from '../engine/rng.ts'
import { SHOP_SEED_SALT } from '../engine/constants.ts'
import { STAT_BUFF_AMOUNT } from '../engine/balance.ts'
import type { ItemData } from './types.ts'

const sprite = (id: string): string => `/sprites/itens/${id}.png`

/** Buff diário por atributo (x_*): mesmo preço/efeito, muda só o eixo. */
function statItem(id: string, name: string, attr: AttrKey, label: string): ItemData {
  return {
    id,
    name,
    type: 'consumable',
    price: 400,
    description: `+${STAT_BUFF_AMOUNT} de ${label} para todo o time (só hoje).`,
    sprite: sprite(id),
    effect: { kind: 'statBuff', attr, amount: STAT_BUFF_AMOUNT },
  }
}

export const ITEMS: ItemData[] = [
  {
    id: 'potion',
    name: 'Potion',
    type: 'consumable',
    price: 200,
    description: 'Cura todo o HP de um Pokémon assim que ele perde vida (1 uso automático).',
    sprite: sprite('potion'),
    effect: { kind: 'autoPotion', uses: 1 },
  },
  {
    id: 'super-potion',
    name: 'Super Potion',
    type: 'consumable',
    price: 400,
    description: 'Cura todo o HP de um Pokémon assim que ele perde vida (3 usos automáticos).',
    sprite: sprite('super-potion'),
    effect: { kind: 'autoPotion', uses: 3 },
  },
  {
    id: 'revive',
    name: 'Revive',
    type: 'consumable',
    price: 500,
    description: 'Revive um Pokémon com todo o HP assim que ele desmaia (1 uso automático).',
    sprite: sprite('revive'),
    effect: { kind: 'autoRevive', uses: 1 },
  },
  {
    id: 'max-revive',
    name: 'Max Revive',
    type: 'consumable',
    price: 800,
    description: 'Revive um Pokémon com todo o HP assim que ele desmaia (3 usos automáticos).',
    sprite: sprite('max-revive'),
    effect: { kind: 'autoRevive', uses: 3 },
  },
  statItem('x-AGI', 'X Agilidade', 'agilidade', 'Agilidade'),
  statItem('x-BTL', 'X Batalha', 'batalha', 'Batalha'),
  statItem('x-CAR', 'X Carisma', 'carisma', 'Carisma'),
  statItem('x-INT', 'X Inteligência', 'inteligencia', 'Inteligência'),
  statItem('x-PER', 'X Percepção', 'percepcao', 'Percepção'),
  statItem('x-RES', 'X Resistência', 'resistencia', 'Resistência'),
  {
    id: 'exp-share',
    name: 'Exp Share',
    type: 'passive',
    price: 1200,
    description: 'Todo o time ganha 5% da experiência obtida por um Pokémon em missões e batalhas.',
    sprite: sprite('exp-share'),
    effect: { kind: 'passive' },
  },
  {
    id: 'fast-ball',
    name: 'Fast Ball',
    type: 'passive',
    price: 1000,
    description: 'A exploração de captura é resolvida na hora em que o Pokémon chega na área.',
    sprite: sprite('fast-ball'),
    effect: { kind: 'passive' },
  },
  {
    id: 'eviolite',
    name: 'Eviolite',
    type: 'passive',
    price: 1500,
    description: 'Pokémon que ainda não chegaram à última evolução ganham +10% em todas as missões.',
    sprite: sprite('eviolite'),
    effect: { kind: 'passive' },
  },
  {
    id: 'rare-candy',
    name: 'Rare Candy',
    type: 'consumable',
    price: 500,
    description: 'Escolha um Pokémon ao comprar: ele sobe +1 nível na hora.',
    sprite: sprite('rare-candy'),
    effect: { kind: 'rareCandy' },
  },
  {
    id: 'lagging-tail',
    name: 'Lagging Tail',
    type: 'passive',
    price: 2000,
    description: 'Pokémon ficam 50% mais lentos nas missões, mas ganham +50% em missões e batalhas.',
    sprite: sprite('lagging-tail'),
    effect: { kind: 'passive' },
  },
  {
    id: 'thick-club',
    name: 'Thick Club',
    type: 'passive',
    price: 2000,
    description: 'Pokémon do tipo Ground ganham +50% em batalhas.',
    sprite: sprite('thick-club'),
    effect: { kind: 'passive' },
  },
]

const ITEMS_BY_ID: Map<string, ItemData> = new Map(ITEMS.map((i) => [i.id, i]))

export function getItem(id: string): ItemData {
  const item = ITEMS_BY_ID.get(id)
  if (!item) throw new Error(`Item ${id} não encontrado`)
  return item
}

/** Tenta resolver um item (null se id desconhecido — saves antigos/itens removidos). */
export function findItem(id: string): ItemData | null {
  return ITEMS_BY_ID.get(id) ?? null
}

/** Itens disponíveis em TODAS as cidades. */
export const GLOBAL_ITEM_IDS: string[] = [
  'potion',
  'super-potion',
  'revive',
  'max-revive',
  'x-AGI',
  'x-BTL',
  'x-CAR',
  'x-INT',
  'x-PER',
  'x-RES',
  'exp-share',
  'fast-ball',
  'eviolite',
  'rare-candy',
]

/** Itens EXTRAS por cidade (índice de CITIES). Por ora só Pewter (0). */
export const CITY_ITEM_IDS: Record<number, string[]> = {
  0: ['lagging-tail', 'thick-club'],
}

/** Subconjunto do qual ao menos 1 item SEMPRE aparece no mercado (potion/revive/x_*). */
export const MANDATORY_ITEM_IDS: string[] = [
  'potion',
  'revive',
  'x-AGI',
  'x-BTL',
  'x-CAR',
  'x-INT',
  'x-PER',
  'x-RES',
]

/** Pool completo de itens à venda nesta cidade (globais + extras da cidade). */
export function itemsForCity(cityIndex: number): string[] {
  return [...GLOBAL_ITEM_IDS, ...(CITY_ITEM_IDS[cityIndex] ?? [])]
}

/** Quantos itens o mercado oferece por dia. */
export const SHOP_SIZE = 3

/**
 * Mercado do dia: 3 itens DISTINTOS sorteados de forma determinística (seed+dia+cidade).
 * Garante ao menos 1 item obrigatório (potion/revive/x_*) e nunca repete o mesmo id. Os ids
 * em `owned` (itens passivos já comprados na run) saem da pool — passivos são 1×/run.
 */
export function getDailyShop(
  seed: number,
  day: number,
  cityIndex: number,
  owned: readonly string[] = [],
): string[] {
  const pool = itemsForCity(cityIndex).filter((id) => !owned.includes(id))
  const rng = createRng(deriveSeed(seed, SHOP_SEED_SALT, day, cityIndex))
  const mandatory = pool.filter((id) => MANDATORY_ITEM_IDS.includes(id))
  const picked: string[] = []
  if (mandatory.length > 0) picked.push(rng.pick(mandatory))
  for (const id of rng.shuffle(pool)) {
    if (picked.length >= SHOP_SIZE) break
    if (!picked.includes(id)) picked.push(id)
  }
  return rng.shuffle(picked)
}
