// Ações do jogo aplicadas pelo reducer via engine (PLAN §5).
// O game clock dispara TICK; as demais vêm da interação do jogador (Fase 4).

import type { AttrKey, GameSpeed } from '../types/index.ts'
import type { StarterPick } from './setup.ts'

export type GameAction =
  /** Escolhe a cidade de Kanto (grava o índice na run antes do novo jogo) — PLAN §3. */
  | { type: 'SELECT_CITY'; cityIndex: number }
  /**
   * Recomeça do zero numa nova cidade (botão "Próximo Ginásio" no fim de jogo): estado inicial
   * limpo com a `cityIndex` dada e uma `seed` nova. O jogador refaz a escolha de iniciais no ginásio.
   */
  | { type: 'RESET_TO_CITY'; cityIndex: number; seed: number }
  /**
   * Inicia a run: os tipos do ginásio são fixos da cidade; o roster vem das versões
   * escolhidas dos iniciais fixos (espécie + nível + seed do roll) — PLAN §3.
   */
  | { type: 'START_RUN'; picks: StarterPick[] }
  /** Define a velocidade do relógio (0 pausa, 1/2/3) — efeito real no game clock. */
  | { type: 'SET_SPEED'; speed: GameSpeed }
  /** Avança o relógio do dia em `deltaMs` (ms de jogo, já escalados pela velocidade). */
  | { type: 'TICK'; deltaMs: number }
  /** Avança a fase do dia: MORNING→DAY→SUMMARY→(próximo dia) — PLAN §3. */
  | { type: 'ADVANCE_PHASE' }
  /** Aceita uma missão disponível, despachando o time (1–6) — PLAN §3.1/§4.2. */
  | { type: 'ACCEPT_MISSION'; missionId: string; teamIds: string[] }
  /** Atribui o esquadrão (≥1) a uma defesa ativa; resolve na hora — PLAN §4.4. */
  | { type: 'ASSIGN_DEFENSE'; defenseId: string; squadIds: string[] }
  /** Conclui a batalha de defesa (após a animação): aplica o XP/level-up das vitórias — §4.4. */
  | { type: 'COMPLETE_DEFENSE'; defenseId: string }
  /** Manda um Pokémon explorar uma área de captura — PLAN §4.5. */
  | { type: 'START_SEARCH'; searcherId: string; spotIndex: number }
  /** No encontro: captura o candidato (por índice); com o time cheio, ele vai pro Computador (PC) — §4.5. */
  | { type: 'CAPTURE_PICK'; searcherId: string; candidateIndex: number }
  /** No encontro: não pega nenhum e encerra a exploração — a área some do dia. */
  | { type: 'CAPTURE_DISMISS'; searcherId: string }
  /** Manhã: deposita um Pokémon do time no Computador (PC) — exige manter ≥1 no time. */
  | { type: 'DEPOSIT_POKEMON'; pokemonId: string }
  /** Manhã: retira um Pokémon do Computador (PC) para o time — exige vaga (time < 6). */
  | { type: 'WITHDRAW_POKEMON'; pokemonId: string }
  /** Define/limpa o apelido de um Pokémon (renomear na captura) — PLAN §4.5. */
  | { type: 'RENAME_POKEMON'; pokemonId: string; nickname: string }
  /** Compra no mercado (manhã) — PLAN §4.6. */
  | { type: 'BUY_ITEM'; itemId: string; quantity?: number }
  /** Compra a próxima bola (Pokébola→…→Masterball): sobe run.ballLevel e libera mais raridades. */
  | { type: 'BUY_BALL' }
  /** Usa um item (Potion/Revive…) num Pokémon do roster — PLAN §4.6. */
  | { type: 'USE_ITEM'; itemId: string; targetId: string }
  /** Compra um Rare Candy e o aplica no Pokémon escolhido (+1 nível) — PLAN — Itens. */
  | { type: 'USE_RARE_CANDY'; pokemonId: string }
  /** Compra uma Moon Stone e evolui (1 estágio, ignorando o nível) o Pokémon escolhido — PLAN — Itens. */
  | { type: 'USE_MOON_STONE'; pokemonId: string }
  /** Aloca o ponto de um level-up no atributo escolhido (modal) — PLAN §4.1. */
  | { type: 'ALLOCATE_POINT'; pokemonId: string; attr: AttrKey }
  /** Despacha até 3 Pokémon idle atrás da Rocket no Evento de Roubo (Feature B). */
  | { type: 'DISPATCH_THEFT_CHASERS'; chaserIds: string[] }
  /** Resolve a batalha de resgate (cadeia de duelos) — Feature B. */
  | { type: 'RESOLVE_THEFT_BATTLE' }
  /** Conclui a batalha de resgate (após a animação): aplica 3× XP na vitória — Feature B. */
  | { type: 'COMPLETE_THEFT_BATTLE' }
  /** Resolve a escolha de Habilidade Secreta do Destaque na tela de resumo (Fase 2). */
  | { type: 'CHOOSE_SECRET'; slot: 0 | 1; level: 1 | 2 }
  /** Fecha o modal de eclosão do ovo (remove a eclosão da frente da fila). */
  | { type: 'DISMISS_HATCH' }
