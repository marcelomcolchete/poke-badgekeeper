// Fertilizer: toda manhã concede 1 berry aleatória ao inventário (determinístico por dia).
import type { GameState } from '../engine/state.ts'
import { takeRng } from './runtime.ts'

const FERTILIZER_BERRIES = [
  'petaya-berry',
  'leppa-berry',
  'golden-nanab-berry',
  'aguav-berry',
  'sitrus-berry',
  'rawst-berry',
] as const

/** Se o jogador tem Fertilizer, adiciona 1 berry sorteada ao inventário. */
export function grantDailyBerry(s: GameState): void {
  if (!s.runItems.includes('fertilizer')) return
  const berryId = takeRng(s).pick([...FERTILIZER_BERRIES])
  const stack = s.inventory.find((i) => i.itemId === berryId)
  if (stack) stack.quantity += 1
  else s.inventory = [...s.inventory, { itemId: berryId, quantity: 1 }]
}
