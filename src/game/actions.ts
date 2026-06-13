// Ações do jogo aplicadas pelo reducer via engine (PLAN §5).
// O game clock dispara TICK; as demais vêm da interação do jogador (Fase 4).

import type { AttrKey, GameSpeed } from '../types/index.ts'

export type GameAction =
  /** Define a velocidade do relógio (0 pausa, 1/2/3) — efeito real no game clock. */
  | { type: 'SET_SPEED'; speed: GameSpeed }
  /** Avança o relógio do dia em `deltaMs` (ms de jogo, já escalados pela velocidade). */
  | { type: 'TICK'; deltaMs: number }
  /** Avança a fase do dia: MORNING→DAY→SUMMARY→(próximo dia) — PLAN §3. */
  | { type: 'ADVANCE_PHASE' }
  /** Aceita uma missão disponível, despachando o time (1–6) — PLAN §3.1/§4.2. */
  | { type: 'ACCEPT_MISSION'; missionId: string; teamIds: string[] }
  /** Atribui o esquadrão (≥3) a uma defesa ativa; resolve na hora — PLAN §4.4. */
  | { type: 'ASSIGN_DEFENSE'; defenseId: string; squadIds: string[] }
  /** Manda um Pokémon procurar numa área de captura — PLAN §4.5. */
  | { type: 'START_SEARCH'; searcherId: string; spotIndex: number }
  /** No encontro: captura o candidato escolhido — PLAN §4.5. */
  | { type: 'CAPTURE_PICK'; searcherId: string; speciesId: number }
  /** No encontro: não pega nenhum e traz o Pokémon de volta (fica idle). */
  | { type: 'CAPTURE_DISMISS'; searcherId: string }
  /** No encontro: não pega nenhum e segue procurando (novo encontro depois). */
  | { type: 'CAPTURE_KEEP'; searcherId: string }
  /** Compra no mercado (manhã) — PLAN §4.6. */
  | { type: 'BUY_ITEM'; itemId: string; quantity?: number }
  /** Usa um item (Potion/Revive…) num Pokémon do roster — PLAN §4.6. */
  | { type: 'USE_ITEM'; itemId: string; targetId: string }
  /** Aloca o ponto de um level-up no atributo escolhido (modal) — PLAN §4.1. */
  | { type: 'ALLOCATE_POINT'; pokemonId: string; attr: AttrKey }
