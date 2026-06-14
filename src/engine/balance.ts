// Constantes de BALANCEAMENTO — valores PROVISÓRIOS, afinados na Fase 5 (PLAN §7).
//
// O PLAN reserva o tuning fino para a Fase 5, num `balance.ts` único. Reunimos aqui,
// já na Fase 2, os números que a engine precisa para FUNCIONAR e ser testável —
// mantendo a regra "sem magic numbers" (nada de literais soltos nos módulos).
// Apenas knobs de tuning moram aqui; regras ESTRUTURAIS ficam em constants.ts.
// Os testes da engine validam invariantes/intervalos, não estes valores específicos.

import type { MissionCategory, Rarity } from '../types/index.ts'

/** Peso de cada raridade no sorteio de captura/preparação (PLAN §4.5). */
export const RARITY_DRAW_WEIGHT: Record<Rarity, number> = {
  common: 40,
  uncommon: 30,
  rare: 15,
  epic: 10,
  legend: 5,
}

/** Fator de XP por raridade: mais raro sobe de nível mais devagar (PLAN §4.5). */
export const RARITY_XP_RATE: Record<Rarity, number> = {
  common: 1,
  uncommon: 0.9,
  rare: 0.8,
  epic: 0.7,
  legend: 0.5,
}

/** XP §4.1: XP para subir do nível L → L+1 = base × L. */
export const XP_TO_NEXT_BASE = 100

/** Missões §4.3: fator de tempo de viagem com a passiva Run Away. */
export const RUN_AWAY_TRAVEL_FACTOR = 0.5

/**
 * Missões §4.3: conversão distância-do-grafo → ms de viagem (um trecho de ida). O tempo
 * total da missão é 2× isto (ida e volta) + execução no local. Tunável (calibrado no preview).
 */
export const TRAVEL_MS_PER_DISTANCE = 2_200

/**
 * Missões §4.3 (ajuste): time que CUMPRE a missão volta animado — +50% de velocidade na
 * volta (o trecho de retorno dura tempo / 1,5). Em falha, a volta é normal.
 */
export const RETURN_SPEED_BONUS_ON_SUCCESS = 1.5

/**
 * Missões §4.3: a Agilidade total do time reduz o tempo de viagem em 0,5% por ponto
 * (10 → −5%, 100 → −50%). Como a soma do time é capada em 100, a redução máxima é 50%.
 */
export const AGILITY_TIME_REDUCTION_PER_POINT = 0.005

/** Captura §4.5: tempo-base de busca e fator da passiva Keen Eye. */
export const BASE_SEARCH_MS = 30_000
export const KEEN_EYE_SEARCH_FACTOR = 0.5

/** Economia §4.6: ouro base por defesa de ginásio (ganho mesmo perdendo a batalha). */
export const GOLD_BASE_PER_DEFENSE = 100

/** Economia §4.6: bônus sobre o ouro de defesas se TODAS forem vencidas no dia (+30%). */
export const ALL_DEFENSES_WON_BONUS = 0.3

/** Aprovação §4.7: fração das missões do dia que define a meta (metade, arredondando p/ cima). */
export const MISSION_GOAL_FRACTION = 0.5

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

/**
 * Defesa §4.4/§4.8: o esquadrão inimigo cresce com o dia. Âncoras da escala 1→10:
 * dia 1 = no máx. 1 Pokémon; dia 10 = no mín. 6. A partir do dia 5 há +1 de variação.
 */
export const ENEMY_SQUAD_DAY1 = 1
export const ENEMY_SQUAD_DAY10 = 6
export const ENEMY_SQUAD_JITTER_FROM_DAY = 5

/** Leveling §4.1: XP concedido a cada Pokémon do time numa missão bem-sucedida. */
export const MISSION_XP_REWARD = 120

/**
 * Regras por categoria de missão (PROVISÓRIAS) — onde nasce, dificuldade e recompensa.
 * reqMult escala a exigência (>1 = mais difícil; <1 = mais fácil); dangerMult escala
 * o dano em falha; healOnSuccess cura o time; goldOnSuccess rende ouro no sucesso.
 */
export interface CategoryRules {
  reqMult: number
  dangerMult: number
  healOnSuccess: boolean
  goldOnSuccess: number
}

export const CATEGORY_RULES: Record<MissionCategory, CategoryRules> = {
  center: { reqMult: 1.25, dangerMult: 1.2, healOnSuccess: true, goldOnSuccess: 0 },
  mart: { reqMult: 1.25, dangerMult: 1.2, healOnSuccess: false, goldOnSuccess: 150 },
  house: { reqMult: 0.85, dangerMult: 0.85, healOnSuccess: false, goldOnSuccess: 0 },
  freeArea: { reqMult: 0.85, dangerMult: 0.85, healOnSuccess: false, goldOnSuccess: 0 },
  // Museu: a mais difícil da run (+50% de exigência) — recompensa rara (Fossil).
  museum: { reqMult: 1.5, dangerMult: 1.2, healOnSuccess: false, goldOnSuccess: 0 },
}

/**
 * Pool ponderado das categorias sorteadas a cada dia (museu é especial, fora daqui).
 * Áreas verdes são as mais comuns; centro/mart, mais raros.
 */
export const DAILY_CATEGORY_POOL: MissionCategory[] = [
  'freeArea',
  'freeArea',
  'freeArea',
  'freeArea',
  'house',
  'house',
  'center',
  'mart',
]

/** Captura §4.5: quantas áreas verdes recebem captura por dia (1×/dia, horário sorteado). */
export const CAPTURE_SPOTS_PER_DAY = 1

/** Atraso (ms de jogo) da 1ª missão no dia 1 — janela de respiro no início da run (§3.1). */
export const DAY1_FIRST_MISSION_DELAY_MS = 15_000

/** Museu: a missão única da run cai num dia sorteado nesta faixa (evita os extremos). */
export const MUSEUM_DAY_MIN = 3
export const MUSEUM_DAY_MAX = 8

/** Itens §4.6: cura/revive (HP é 1–10, então poucos pontos já contam). */
export const POTION_HEAL = 3
export const SUPER_POTION_HEAL = 7
export const REVIVE_HP_FRACTION = 0.5
