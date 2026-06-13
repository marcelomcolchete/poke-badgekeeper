// Constantes de BALANCEAMENTO — valores PROVISÓRIOS, afinados na Fase 5 (PLAN §7).
//
// O PLAN reserva o tuning fino para a Fase 5, num `balance.ts` único. Reunimos aqui,
// já na Fase 2, os números que a engine precisa para FUNCIONAR e ser testável —
// mantendo a regra "sem magic numbers" (nada de literais soltos nos módulos).
// Apenas knobs de tuning moram aqui; regras ESTRUTURAIS ficam em constants.ts.
// Os testes da engine validam invariantes/intervalos, não estes valores específicos.

/** XP §4.1: XP para subir do nível L → L+1 = base × L. */
export const XP_TO_NEXT_BASE = 100

/** Missões §4.3: fator de tempo de viagem com a passiva Run Away. */
export const RUN_AWAY_TRAVEL_FACTOR = 0.5

/** Captura §4.5: tempo-base de busca e fator da passiva Keen Eye. */
export const BASE_SEARCH_MS = 30_000
export const KEEN_EYE_SEARCH_FACTOR = 0.5

/** Economia §4.6: ouro base por defesa de ginásio vencida. */
export const GOLD_BASE_PER_DEFENSE = 100

/** Aprovação §4.7: fração das missões do dia que define a meta. */
export const MISSION_GOAL_FRACTION = 0.6

/** Curva de dificuldade §4.8: faixa de missões/defesas por dia (×fatorCidade). */
export const MIN_MISSIONS = 3
export const MAX_MISSIONS = 8
export const MIN_DEFENSES = 1
export const MAX_DEFENSES = 4

/** Janela do dia (fração) em que eventos surgem — deixa tempo para resolvê-los (§4.8). */
export const SPAWN_WINDOW_FRACTION = 0.85

/** Timers dos popups §3.1: defesa dura mais que missão (dá mais tempo de reação). */
export const MISSION_LIFETIME_MS = 20_000
export const DEFENSE_LIFETIME_MS = 40_000

/** Defesa §4.4: Batalha-base dos inimigos e ganho por dia da cidade. */
export const ENEMY_BASE_BATTLE = 25
export const ENEMY_BATTLE_PER_DAY = 4
