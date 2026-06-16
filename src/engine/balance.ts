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
 * Missões §4.3: a Agilidade total do time reduz o tempo de viagem em 1% por ponto
 * (10 → −10%, 70 → −70%). Como a soma do time é capada em 70 (TEAM_ATTR_MAX), a redução
 * máxima é 70% — daí o piso MISSION_TIME_FLOOR.
 */
export const AGILITY_TIME_REDUCTION_PER_POINT = 0.01

/**
 * Missões §4.3: a Inteligência total do time reduz o tempo de EXECUÇÃO no local em 1% por
 * ponto (70 → −70%). Mesma curva da Agilidade, com o mesmo piso de 0,3 (−70% no máximo).
 */
export const INT_TIME_REDUCTION_PER_POINT = 0.01

/** Piso do fator de tempo de viagem/execução: redução máxima de 70% (Agilidade/Inteligência 70). */
export const MISSION_TIME_FLOOR = 0.3

/** Captura §4.5: tempo-base de busca (reduzido pela Inteligência) e fator da passiva Keen Eye. */
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

/**
 * Quantidade FIXA de missões/defesas por dia (índice = dia − 1), igual para todas as
 * cidades — sem multiplicador de dificuldade. 10 entradas (dias 1..10).
 */
export const MISSIONS_PER_DAY = [3, 4, 4, 5, 6, 6, 7, 7, 8, 8] as const
export const DEFENSES_PER_DAY = [1, 1, 2, 2, 2, 3, 3, 4, 4, 5] as const

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

/**
 * Leveling §4.1: POOL de XP de uma missão bem-sucedida, DIVIDIDO igualmente entre os
 * participantes (não mais valor fixo por cabeça). Como o despacho vai no máx. 3
 * (MAX_DISPATCH), divide exato: 1 → 240, 2 → 120 cada, 3 → 80 cada. Levar menos
 * Pokémon faz cada um subir mais rápido; levar mais, mais seguro porém mais lento.
 */
export const MISSION_XP_POOL = 240

/**
 * Leveling §4.4: XP por duelo VENCIDO numa defesa de ginásio escala com o poder de
 * Batalha do desafiante derrotado — 0,5 por ponto, com teto de 30 por vitória. Como a
 * Batalha do inimigo é capada em ATTR_MAX (60), o teto casa: 0,5 × 60 = 30.
 */
export const GYM_XP_PER_BATTLE_POWER = 0.5
export const GYM_XP_CAP_PER_WIN = 30

/**
 * Pool ponderado das categorias sorteadas a cada dia (Rocket é especial, fora daqui).
 * As CASAS geram os 6 tipos normais; centro/mart geram as especiais. As áreas verdes NÃO
 * geram mais missão — são exclusivamente spots de captura (3.x). Centro (Pokecenter) e mart
 * (Pokemart) aparecem no MÁXIMO 1×/dia cada (ver timeline).
 */
export const DAILY_CATEGORY_POOL: MissionCategory[] = [
  'house',
  'house',
  'house',
  'house',
  'house',
  'house',
  'center',
  'mart',
]

/** Pool só com categorias normais (sem especiais) — usado p/ realocar center/mart excedentes. */
export const NORMAL_CATEGORY_POOL: MissionCategory[] = [
  'house',
  'house',
  'house',
  'house',
  'house',
  'house',
]

/** Captura §4.5: quantas áreas verdes recebem captura por dia (1×/dia, horário sorteado). */
export const CAPTURE_SPOTS_PER_DAY = 1

/** Atraso (ms de jogo) da 1ª missão no dia 1 — janela de respiro no início da run (§3.1). */
export const DAY1_FIRST_MISSION_DELAY_MS = 15_000

/**
 * Equipe Rocket: a missão EXTRA aparece 2× na run, em dias DISTINTOS sorteados nesta faixa
 * (evita os extremos do calendário). Não entra no agendamento normal — é um evento à parte.
 */
export const ROCKET_DAY_MIN = 3
export const ROCKET_DAY_MAX = 8
export const ROCKET_MISSIONS_TOTAL = 2

/** Rocket §recompensa: ouro-bônus por VENCER a batalha (além do ouro de batalha padrão). */
export const ROCKET_GOLD_BONUS = 300

/** Rocket §recompensa: a missão Rocket rende 3× o pool de XP normal (só na vitória). */
export const ROCKET_XP_MULTIPLIER = 3

/** Defesa/Rocket §destaque: um desafiante do esquadrão ganha +15 de Batalha e exibe medalha. */
export const DEFENSE_BUFF_BATTLE = 15

// ---- Habilidades Secretas (efeitos fixos por TIPO de habilidade) ----
//
// Cada habilidade tem efeito fixo (sem níveis). Várias linhas compartilham a mesma habilidade,
// e um Pokémon pode ter até três ativas ao mesmo tempo (ver data/secretAbilities.ts).

/** Rivalidade: bônus de atributo na missão POR aliado do mesmo gênero. */
export const RIVALRY_ATTR_PER_ALLY = 0.1
/** Rivalidade: bônus de batalha contra um oponente do mesmo gênero. */
export const RIVALRY_BATTLE_BONUS = 0.1
/** Rock Head: multiplicador de atributos em escolta (ganho) e em ensino (perda). */
export const ROCK_HEAD_ESCORT_MULT = 1.5
export const ROCK_HEAD_STUDY_MULT = 0.5
/** Battle Armor: multiplicador de atributos na próxima missão após batalhar. */
export const BATTLE_ARMOR_MISSION_MULT = 1.3
/** Rollout: bônus de batalha por Pokémon derrotado no duelo (acumula na sequência). */
export const ROLLOUT_BATTLE_BONUS = 0.1
/** Hustle: bônus de Batalha em batalhas; penalidade de atributos em missões. */
export const HUSTLE_BATTLE_BONUS = 0.1
export const HUSTLE_MISSION_MULT = 0.9
/** Weak Armor: dano recebido dobrado; bônus de velocidade do time POR ponto de HP faltante. */
export const WEAK_ARMOR_DAMAGE_MULT = 2
export const WEAK_ARMOR_SPEED_PER_MISSING_HP = 0.2
/** Shell Armor: todo dano recebido na vida vira este valor (1). */
export const SHELL_ARMOR_DAMAGE = 1
/** Explosion: ao ser derrotado, perde esta fração da vida máxima e leva o inimigo junto. */
export const EXPLOSION_SELF_DAMAGE_FRACTION = 0.5
/** Fly: bônus de velocidade do time ao voar (além do atalho em linha reta). */
export const FLY_SPEED_BONUS = 0.5
/** Dig: quantos buracos (pontos) cada túnel liga — sempre 2 (dois pontos). */
export const DIG_HOLES_PER_TUNNEL = 2
/** Dig: custo do túnel entre os pontos (distância-do-grafo, bem baixa = atalho). */
export const DIG_TUNNEL_COST = 0.4

// ---- Sistema de Itens (PLAN — Itens) ----

/** x_*: quanto cada item de atributo soma a todo o time no dia. */
export const STAT_BUFF_AMOUNT = 5
/** Eviolite: multiplicador de missão p/ Pokémon que ainda não chegaram à última evolução. */
export const EVIOLITE_MISSION_MULT = 1.1
/** Lagging Tail: +50% em missões e batalhas, porém 50% mais lento nas viagens de missão. */
export const LAGGING_TAIL_MISSION_MULT = 1.5
export const LAGGING_TAIL_BATTLE_MULT = 1.5
export const LAGGING_TAIL_TRAVEL_MULT = 0.5
/** Thick Club: +50% em batalhas para Pokémon do tipo Ground. */
export const THICK_CLUB_BATTLE_MULT = 1.5
/** Exp Share: fração da XP de um Pokémon repassada ao resto do time. */
export const EXP_SHARE_RATE = 0.05
