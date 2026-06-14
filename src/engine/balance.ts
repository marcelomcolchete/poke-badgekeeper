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

/**
 * Geração da EXIGÊNCIA das missões (rebalanceamento). Cada eixo é sorteado numa faixa-base
 * e somado ao termo do dia: base + DAY_SCALE · dia / DAY_DIVISOR, com teto ATTR_MAX (60).
 * Principal = mais exigido; secundário = 2º mais; resto = os demais eixos.
 */
export const MISSION_PRINCIPAL_MIN = 20
export const MISSION_PRINCIPAL_MAX = 30
export const MISSION_SECONDARY_MIN = 10
export const MISSION_SECONDARY_MAX = 20
export const MISSION_REST_MIN = 5
export const MISSION_REST_MAX = 20
/** Termo do dia: DAY_SCALE × dia ÷ DAY_DIVISOR somado à faixa-base (principal e secundário). */
export const MISSION_DAY_SCALE = 10
export const MISSION_DAY_DIVISOR = 3
/** Quantos eixos principais/secundários cada modo especial gera. */
export const SPECIAL2_PRINCIPALS = 2
export const SPECIAL2_SECONDARIES = 1
export const SPECIAL5_PRINCIPALS = 5

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

/** Leveling §4.4: XP concedido por duelo VENCIDO numa defesa de ginásio (um pouco por batalha). */
export const GYM_WIN_XP = 20

/**
 * Pool ponderado das categorias sorteadas a cada dia (museu é especial, fora daqui).
 * Áreas verdes e casas geram os 6 tipos normais; centro/mart geram as especiais.
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

// ---- Habilidades Secretas (efeitos por linha de Pedra/Ground) ----

/** Rivalidade (Nidoran): +10% em todos os atributos na missão com aliado do mesmo gênero. */
export const RIVALRY_ATTR_MULT = 1.1
/** Rock Head (Rhyhorn): +20% nos atributos em missões de escolta. */
export const ROCK_HEAD_ESCORT_MULT = 1.2
/** Shell Armor (Omanyte): +50% nos atributos em escolta, −50% em patrulha. */
export const SHELL_ARMOR_ESCORT_MULT = 1.5
export const SHELL_ARMOR_PATROL_MULT = 0.5
/** Battle Armor (Cubone): +50% nos atributos na próxima missão após defender o ginásio. */
export const BATTLE_ARMOR_MISSION_MULT = 1.5
/** Sand Rush (Sandshrew): +25% de velocidade do time por tarefa concluída (acumula no dia). */
export const SAND_RUSH_SPEED_PER_STACK = 0.25
/** Weak Armor (Onix/Kabuto): dano recebido dobrado; +50% de velocidade em missões após tomar dano. */
export const WEAK_ARMOR_DAMAGE_MULT = 2
export const WEAK_ARMOR_SPEED_BONUS = 0.5
/** Dig (Diglett): custo do túnel entre os dois pontos (distância-do-grafo, bem baixa = atalho). */
export const DIG_TUNNEL_COST = 0.4

/** Itens §4.6: cura/revive (HP é 1–10, então poucos pontos já contam). */
export const POTION_HEAL = 3
export const SUPER_POTION_HEAL = 7
export const REVIVE_HP_FRACTION = 0.5
