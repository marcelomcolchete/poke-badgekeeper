// Catálogo de itens do mercado (PLAN — Sistema de Itens). Cada item declara família
// (consumível × passivo), preço, sprite e um `effect` que dirige a compra (marketFlow) e os
// efeitos na engine. O mercado da manhã oferece 3 itens sorteados por dia (getDailyShop).

import type { AttrKey } from '../types/index.ts'
import { createRng, deriveSeed } from '../engine/rng.ts'
import { SHOP_SEED_SALT } from '../engine/constants.ts'
import { BIG_NUGGET_GOLD, STAT_BUFF_AMOUNT } from '../engine/balance.ts'
import { BALL_MAX_LEVEL } from './balls.ts'
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
    description: 'Use para curar todo o HP de um Pokémon à escolha (uso único).',
    sprite: sprite('potion'),
    effect: { kind: 'heal', scope: 'single', uses: 1 },
  },
  {
    id: 'super-potion',
    name: 'Super Potion',
    type: 'consumable',
    price: 400,
    description: 'Use para curar todo o HP do time inteiro de uma vez (uso único).',
    sprite: sprite('super-potion'),
    effect: { kind: 'heal', scope: 'team', uses: 1 },
  },
  {
    id: 'revive',
    name: 'Revive',
    type: 'consumable',
    price: 400,
    description: 'Use para reviver um Pokémon desmaiado com todo o HP (uso único).',
    sprite: sprite('revive'),
    effect: { kind: 'revive', scope: 'single', uses: 1 },
  },
  {
    id: 'max-revive',
    name: 'Max Revive',
    type: 'consumable',
    price: 600,
    description: 'Use para reviver o time inteiro com todo o HP de uma vez (uso único).',
    sprite: sprite('max-revive'),
    effect: { kind: 'revive', scope: 'team', uses: 1 },
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
    price: 600,
    description: 'A exploração de captura é resolvida na hora em que o Pokémon chega na área.',
    sprite: sprite('fast-ball'),
    effect: { kind: 'passive' },
  },
  {
    id: 'eviolite',
    name: 'Eviolite',
    type: 'passive',
    price: 500,
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
    price: 600,
    description: 'Pokémon ficam 50% mais lentos nas missões, mas ganham +50% em missões e batalhas.',
    sprite: sprite('lagging-tail'),
    effect: { kind: 'passive' },
  },
  {
    id: 'thick-club',
    name: 'Thick Club',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Ground ganham +50% em batalhas.',
    sprite: sprite('thick-club'),
    effect: { kind: 'passive' },
  },
  {
    id: 'love-ball',
    name: 'Love Ball',
    type: 'passive',
    price: 600,
    description: 'Pokémon capturados já vêm com o máximo de corações.',
    sprite: sprite('love-ball'),
    effect: { kind: 'passive' },
  },
  {
    id: 'premier-ball',
    name: 'Premier Ball',
    type: 'consumable',
    price: 100,
    description: 'Sobe de graça o nível da sua bola (Pokébola → Great → Ultra → Master).',
    sprite: sprite('premier-ball'),
    effect: { kind: 'premierBall' },
  },
  {
    id: 'fossil-stone',
    name: 'Fossil Stone',
    type: 'passive',
    price: 1000,
    description: 'Pokémon fósseis ganham +50% em batalhas.',
    sprite: sprite('fossil-stone'),
    effect: { kind: 'passive' },
  },
  {
    id: 'mystic-water',
    name: 'Mystic Water',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Água ganham +50% em batalhas.',
    sprite: sprite('mystic-water'),
    effect: { kind: 'passive' },
  },
  {
    id: 'electirizer',
    name: 'Electirizer',
    type: 'passive',
    price: 650,
    description:
      'Quando um Pokémon seu é atingido por um raio, ele ganha +50% na próxima missão (acumula a cada raio).',
    sprite: sprite('electirizer'),
    effect: { kind: 'passive' },
  },
  {
    id: 'dragon-fang',
    name: 'Dragon Fang',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Dragão ganham +50% em batalhas.',
    sprite: sprite('dragon-fang'),
    effect: { kind: 'passive' },
  },
  {
    id: 'magnet',
    name: 'Magnet',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Elétrico ganham +50% em batalhas.',
    sprite: sprite('magnet'),
    effect: { kind: 'passive' },
  },
  {
    id: 'surfboard',
    name: 'Surfboard',
    type: 'passive',
    price: 1200,
    description: 'Todo o time consegue atravessar a água e as poças (como a habilidade Surf).',
    sprite: sprite('surfboard'),
    effect: { kind: 'passive' },
  },
  {
    id: 'fresh-water',
    name: 'Fresh Water',
    type: 'consumable',
    price: 300,
    description: 'Use para curar todo o HP de um Pokémon à escolha (2 usos).',
    sprite: sprite('fresh-water'),
    effect: { kind: 'heal', scope: 'single', uses: 2 },
  },
  {
    id: 'shiny-charm',
    name: 'Shiny Charm',
    type: 'passive',
    price: 1000,
    description: 'Aumenta em +4% a chance de encontrar Pokémon shiny.',
    sprite: sprite('shiny-charm'),
    effect: { kind: 'passive' },
  },
  {
    id: 'moon-stone',
    name: 'Moon Stone',
    type: 'consumable',
    price: 700,
    description: 'Escolha um Pokémon para evoluir na hora, mesmo sem o nível.',
    sprite: sprite('moon-stone'),
    effect: { kind: 'moonStone' },
  },
  {
    id: 'grassy-seed',
    name: 'Grassy Seed',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Grama ganham +50% em batalhas.',
    sprite: sprite('grassy-seed'),
    effect: { kind: 'passive' },
  },
  {
    id: 'black-sludge',
    name: 'Black Sludge',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Venenoso ganham +50% em batalhas.',
    sprite: sprite('black-sludge'),
    effect: { kind: 'passive' },
  },
  {
    id: 'twisted-spoon',
    name: 'Twisted Spoon',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Psíquico ganham +50% em batalhas.',
    sprite: sprite('twisted-spoon'),
    effect: { kind: 'passive' },
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    type: 'passive',
    price: 1000,
    description: 'Pokémon do tipo Fogo ganham +50% em batalhas.',
    sprite: sprite('charcoal'),
    effect: { kind: 'passive' },
  },
  {
    id: 'wise-glasses',
    name: 'Wise Glasses',
    type: 'passive',
    price: 1000,
    description: '+50% de poder do time em missões de Ensino (estudo).',
    sprite: sprite('wise-glasses'),
    effect: { kind: 'passive' },
  },
  {
    id: 'zoom-lens',
    name: 'Zoom Lens',
    type: 'passive',
    price: 1000,
    description: '+50% de poder do time em missões de Escolta.',
    sprite: sprite('zoom-lens'),
    effect: { kind: 'passive' },
  },
  {
    id: 'wide-lens',
    name: 'Wide Lens',
    type: 'passive',
    price: 1000,
    description: '+50% de poder do time em missões de Investigação.',
    sprite: sprite('wide-lens'),
    effect: { kind: 'passive' },
  },
  {
    id: 'amulet-coin',
    name: 'Amulet Coin',
    type: 'passive',
    price: 800,
    description: 'Receba +50% de ouro de todas as fontes.',
    sprite: sprite('amulet-coin'),
    effect: { kind: 'passive' },
  },
  {
    id: 'big-nugget',
    name: 'Big Nugget',
    type: 'consumable',
    price: 0,
    description: 'Ao comprar, receba 200 de ouro na hora.',
    sprite: sprite('big-nugget'),
    effect: { kind: 'instantGold', amount: BIG_NUGGET_GOLD },
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
  'love-ball',
  'premier-ball',
  'shiny-charm',
  'moon-stone',
]

/** Itens EXTRAS por cidade (índice de CITIES). */
export const CITY_ITEM_IDS: Record<number, string[]> = {
  0: ['lagging-tail', 'thick-club', 'fossil-stone'],
  1: ['mystic-water', 'surfboard', 'fresh-water'],
  2: ['electirizer', 'dragon-fang', 'magnet'],
  3: ['grassy-seed'],
  4: ['black-sludge', 'big-nugget'],
  5: ['twisted-spoon', 'wise-glasses'],
  6: ['charcoal', 'zoom-lens'],
  7: ['wide-lens', 'amulet-coin'],
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

/** Quantos itens o mercado oferece por dia (a Pokébola evolutiva é um slot fixo à parte). */
export const SHOP_SIZE = 5

/**
 * Mercado do dia: 5 itens DISTINTOS sorteados de forma determinística (seed+dia+cidade).
 * Garante ao menos 1 item obrigatório (potion/revive/x_*) e nunca repete o mesmo id. A
 * Pokébola evolutiva NÃO entra aqui — ela é um slot fixo à parte renderizado pelo mercado. Os ids
 * em `owned` (itens passivos já comprados na run) saem da pool — passivos são 1×/run.
 */
export function getDailyShop(
  seed: number,
  day: number,
  cityIndex: number,
  owned: readonly string[] = [],
  ballLevel = 0,
): string[] {
  // Premier Ball some quando já se tem a Masterball (não há mais nível para subir).
  const atMaxBall = ballLevel >= BALL_MAX_LEVEL
  const pool = itemsForCity(cityIndex).filter(
    (id) => !owned.includes(id) && !(atMaxBall && id === 'premier-ball'),
  )
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
