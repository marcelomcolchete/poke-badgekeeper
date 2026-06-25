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

/** XP §4.1: XP para subir do nível L → L+1 (índice = L − 1). Nível 10 é o topo (Infinity). */
export const XP_TO_NEXT = [100, 300, 500, 700, 900, 1100, 1300, 1500, 2000] as const

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
 * (10 → −10%, 70 → −70%). A soma do time é capada em 100 (TEAM_ATTR_MAX), mas o piso
 * MISSION_TIME_FLOOR limita a redução máxima a 70% (atingida com 70 pontos).
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

/**
 * Captura §4.5 (rank por Percepção): a Percepção do explorador define DIRETAMENTE a distribuição
 * do rank-alvo (F–S) do encontro. `c = percepcao / PERCEPTION_PER_RANK` é o "alcance" contínuo
 * (cada 10 de Percepção = +1 rank de alcance), e `RANK_GAP_KNOTS` é a curva de peso por `gap =
 * c − k` (k = índice do rank): pico no rank no alcance, cauda curta abaixo e pequena ultrapassagem
 * acima (é ela que destrava o rank logo acima do alcance). Calibrado para perc 60 → 50% S / 40% A /
 * 10% B e S só possível acima de 50. O array de knots é o knob: alterá-lo reshapeia toda a curva.
 */
export const PERCEPTION_PER_RANK = 10
export const RANK_GAP_KNOTS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, 1],
  [1, 0.8],
  [2, 0.2],
  [3, 0],
]
/**
 * Captura §4.5: trocas +1/−1 entre pares de eixos ao preencher os IVs do rank-alvo. A soma dos
 * ranks dos eixos é preservada (= 6 × alvo), então a média — e logo o rank do Pokémon — fica
 * cravada no alvo; as trocas só dão variedade entre os eixos. Mais rodadas = mais espalhamento.
 */
export const TARGET_RANK_SWAP_ROUNDS = 12

/** Economia §4.6: ouro base por defesa de ginásio (ganho mesmo perdendo a batalha). */
export const GOLD_BASE_PER_DEFENSE = 100

/** Economia §4.6: bônus sobre o ouro de defesas se TODAS forem vencidas no dia (+30%). */
export const ALL_DEFENSES_WON_BONUS = 0.3

/** Aprovação §4.7: fração das missões do dia que define a meta (metade, arredondando p/ cima). */
export const MISSION_GOAL_FRACTION = 0.5

/**
 * Geração da EXIGÊNCIA das missões (rebalanceamento). Cada eixo é sorteado numa faixa-base
 * e somado ao termo do dia: base + DAY_SCALE · dia / DAY_DIVISOR, com teto TEAM_ATTR_MAX (100).
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
/**
 * Termo do dia do RESTO (evolução muito suave): SLOPE × (dia − PIVOT). Ancorado no PIVOT,
 * o resto começa ABAIXO da faixa-base 5–20 nos primeiros dias, cai exatamente na faixa-base
 * no dia 6 e sobe devagar depois (~0,8/dia vs. ~3,3/dia do principal).
 */
export const MISSION_REST_DAY_SLOPE = 0.8
export const MISSION_REST_DAY_PIVOT = 6
/** Quantos eixos principais/secundários cada modo especial gera. */
export const SPECIAL2_PRINCIPALS = 2
export const SPECIAL2_SECONDARIES = 1
export const SPECIAL5_PRINCIPALS = 4
export const SPECIAL5_SECONDARIES = 2

/**
 * Quantidade FIXA de missões por dia (índice = dia − 1), igual para todas as cidades —
 * sem multiplicador de dificuldade. 10 entradas (dias 1..10). As DEFESAS por dia não usam
 * tabela: vêm da fórmula `defensesForDay` (ceil(dia/2), sem teto — ver timeline.ts).
 */
export const MISSIONS_PER_DAY = [3, 4, 4, 5, 6, 6, 7, 7, 8, 8] as const

/** Janela do dia (fração) em que eventos surgem — deixa tempo para resolvê-los (§4.8). */
export const SPAWN_WINDOW_FRACTION = 0.85

/** Timers dos popups §3.1: defesa dura mais que missão (dá mais tempo de reação). */
export const MISSION_LIFETIME_MS = 20_000
export const DEFENSE_LIFETIME_MS = 40_000

/** Defesa §4.4: Batalha-base dos inimigos e ganho por dia da cidade. */
export const ENEMY_BASE_BATTLE = 25
export const ENEMY_BATTLE_PER_DAY = 4

/**
 * Defesa §4.4: tamanho do esquadrão invasor por treinador é uma FAIXA [min,max] sorteada,
 * que cresce com o dia e converge no teto 6. `min` sobe devagar (reta, atinge 6 ~dia 15);
 * `max` abre rápido (côncavo via raiz, atinge 6 ~dia 9). Pensado para o modo infinito.
 */
export const DEFENSE_SQUAD_MAX = 6
export const DEFENSE_SQUAD_MIN_SLOPE = 5 / 14
export const DEFENSE_SQUAD_MAX_SQRT_BASE = 9

/**
 * Leveling §4.1: POOL de XP de uma missão bem-sucedida, DIVIDIDO igualmente entre os
 * participantes (não mais valor fixo por cabeça). Como o despacho vai no máx. 3
 * (MAX_DISPATCH), divide exato: 1 → 240, 2 → 120 cada, 3 → 80 cada. Levar menos
 * Pokémon faz cada um subir mais rápido; levar mais, mais seguro porém mais lento.
 */
export const MISSION_XP_POOL = 240

/** XP fixo concedido ao explorador ao concluir uma exploração (capturando OU recusando). */
export const EXPLORATION_XP = 100

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
 * Missão Especial da Cidade (⭐): cada local tem uma CHANCE corrente (%) que começa em
 * SPECIAL_CHANCE_START e é rolada no início de cada dia. Acertou → agenda a missão e a chance
 * volta a START; errou → cresce um inteiro aleatório em [GROWTH_MIN, GROWTH_MAX] pontos
 * percentuais, com teto SPECIAL_CHANCE_MAX. A conclusão paga SPECIAL_XP_MULTIPLIER× o pool de XP.
 */
export const SPECIAL_CHANCE_START = 1
export const SPECIAL_CHANCE_GROWTH_MIN = 5
export const SPECIAL_CHANCE_GROWTH_MAX = 15
export const SPECIAL_CHANCE_MAX = 100
export const SPECIAL_XP_MULTIPLIER = 5

/**
 * Defesa/Rocket §medalhas: cada invasor pode sair com uma medalha que soma Batalha (acima do
 * teto normal). Bronze < Prata < Ouro — quanto mais raro o tier, maior o bônus.
 */
export const DEFENSE_MEDAL_BATTLE = { bronze: 10, silver: 20, gold: 50 } as const

/**
 * Probabilidade da medalha por dia ("piso de 10% na abertura + rampa até 100%"). Cada tier
 * abre num dia (MEDAL_OPEN_DAY) já com MEDAL_OPEN_CHANCE e a chance ACUMULADA ("pelo menos
 * esse tier") sobe linearmente até 100% no seu dia de saturação (MEDAL_FULL_DAY). Pensado p/
 * dias infinitos: do dia 30 em diante todo invasor sai com Ouro. Bronze ≥ Prata ≥ Ouro sempre.
 */
export const MEDAL_OPEN_CHANCE = 0.1
export const MEDAL_OPEN_DAY = { bronze: 2, silver: 3, gold: 4 } as const
export const MEDAL_FULL_DAY = { bronze: 10, silver: 20, gold: 30 } as const

/**
 * Rivais §4.4: o líder do rival EVOLUI conforme o dia. Cada valor é o dia (inclusive) em que
 * o líder sobe UM estágio na linha evolutiva — ex.: Charmander (dia 1–2) → Charmeleon (dia 3–5)
 * → Charizard (dia 6+). Linhas mais curtas (Pikachu → Raichu) só sobem até onde a cadeia vai.
 */
export const RIVAL_EVOLUTION_DAYS = [3, 6] as const

// ---- Habilidades Secretas (efeitos fixos por TIPO de habilidade) ----
//
// Cada habilidade tem efeito fixo (sem níveis). Várias linhas compartilham a mesma habilidade,
// e um Pokémon pode ter até três ativas ao mesmo tempo (ver data/secretAbilities.ts).

/** Rivalidade: bônus de atributo na missão POR aliado do mesmo gênero (por nível). */
export const RIVALRY_ATTR_PER_ALLY_L1 = 0.1
export const RIVALRY_ATTR_PER_ALLY_L2 = 0.2
/** Rivalidade: bônus de batalha contra um oponente do mesmo gênero, por nível. */
export const RIVALRY_BATTLE_BONUS_L1 = 0.1
export const RIVALRY_BATTLE_BONUS_L2 = 0.2
/** Rock Head: multiplicador de atributos em escolta (ganho) e em ensino (perda), por nível. */
export const ROCK_HEAD_ESCORT_MULT_L1 = 1.4
export const ROCK_HEAD_ESCORT_MULT_L2 = 1.8
export const ROCK_HEAD_STUDY_MULT_L1 = 0.6
export const ROCK_HEAD_STUDY_MULT_L2 = 0.2
/** Battle Armor: multiplicador de atributos na próxima missão após batalhar, por nível. */
export const BATTLE_ARMOR_MISSION_MULT_L1 = 1.25
export const BATTLE_ARMOR_MISSION_MULT_L2 = 1.5
/** Rollout: bônus ADITIVO de Batalha pelo acúmulo de vitórias (start × 2^(frontWins-1), capado). */
export const ROLLOUT_START_L1 = 2
export const ROLLOUT_CAP_L1 = 32
export const ROLLOUT_START_L2 = 4
export const ROLLOUT_CAP_L2 = 64
/** Hustle: bônus de Batalha em batalhas; penalidade de atributos em missões, por nível. */
export const HUSTLE_BATTLE_BONUS_L1 = 0.1
export const HUSTLE_BATTLE_BONUS_L2 = 0.3
export const HUSTLE_MISSION_MULT_L1 = 0.9
export const HUSTLE_MISSION_MULT_L2 = 0.7
/** Weak Armor: bônus de velocidade do time POR ponto de HP faltante, por nível. */
export const WEAK_ARMOR_SPEED_PER_MISSING_HP_L1 = 0.15
export const WEAK_ARMOR_SPEED_PER_MISSING_HP_L2 = 0.25
/** Shell Armor: divisor do dano recebido por nível (ceil(raw/divisor)). */
export const SHELL_ARMOR_DIVISOR_L1 = 2
export const SHELL_ARMOR_DIVISOR_L2 = 3
/** Explosion: ao ser derrotado, perde esta fração da vida máxima e leva o inimigo junto. */
export const EXPLOSION_SELF_DAMAGE_FRACTION = 0.5
/** Fly: bônus de velocidade do time ao voar (além do atalho em linha reta). */
export const FLY_SPEED_BONUS = 0.5
/** Swift Swim: bônus ADITIVO de velocidade do time enquanto chove (×3 = base +2). */
export const SWIFT_SWIM_RAIN_BONUS = 2
/** Swift Swim L2: bônus MULTIPLICATIVO nos atributos de missão enquanto chove (+30%). */
export const SWIFT_SWIM_MISSION_BONUS_L2 = 0.30
/**
 * Cloud Nine: pontos percentuais adicionados à chance de CHUVA e subtraídos da chance de
 * OUTROS climas (tempestade) por portador no roster. Acumula por portador.
 */
export const CLOUD_NINE_RAIN_PP_L1 = 10
export const CLOUD_NINE_RAIN_PP_L2 = 20
export const CLOUD_NINE_OTHER_PP_L1 = 10
export const CLOUD_NINE_OTHER_PP_L2 = 20
/**
 * Overcoat: pontos percentuais subtraídos de QUALQUER clima (chuva E tempestade) por portador.
 * Acumula por portador.
 */
export const OVERCOAT_PP_L1 = 10
export const OVERCOAT_PP_L2 = 20
/**
 * Own Tempo: teto de eventos climáticos (chuva + tempestade) no dia. Não acumula: vale o
 * nível mais alto presente (L2 → 1 evento; L1 → 2 eventos).
 */
export const OWN_TEMPO_CAP_L1 = 2
export const OWN_TEMPO_CAP_L2 = 1
/** Dig: quantos buracos (pontos) cada túnel liga — sempre 2 (dois pontos). */
export const DIG_HOLES_PER_TUNNEL = 2
/** Dig: custo do túnel entre os pontos (distância-do-grafo, bem baixa = atalho). */
export const DIG_TUNNEL_COST = 0.4
/**
 * Surf: nas arestas incidentes a um nó de água o custo (tempo) cai pela metade — +100% de
 * velocidade na água. Aplica-se só quando o time consegue surfar (ver engine/secretEffects).
 */
export const SURF_WATER_TIME_MULT = 0.5
/** Torrent: multiplicador de atributos na missão quando há outro aliado do tipo Água, por nível. */
export const TORRENT_MISSION_MULT_L1 = 1.25
export const TORRENT_MISSION_MULT_L2 = 1.5
/** Overgrow: multiplicador de atributos na missão com outro aliado do tipo Grama, por nível. */
export const OVERGROW_MISSION_MULT_L1 = 1.25
export const OVERGROW_MISSION_MULT_L2 = 1.5
/** Swarm: multiplicador de atributos na missão com outro aliado do tipo Inseto, por nível. */
export const SWARM_MISSION_MULT_L1 = 1.25
export const SWARM_MISSION_MULT_L2 = 1.5
/**
 * Moxie L1: +1 PERMANENTE em `permaBonus.batalha` por Pokémon derrotado em batalha.
 * Moxie L2: idem +5 temporário por vitória na sequência (teto +25). Os antigos temporários
 * foram substituídos; apenas L2 tem o stacking temporário.
 */
export const MOXIE_PERMA_PER_WIN = 1
export const MOXIE_TEMP_PER_WIN_L2 = 5
export const MOXIE_TEMP_CAP_L2 = 25
/**
 * Pressure: multiplicador da Batalha de TODOS os inimigos aplicado no INÍCIO do combate,
 * a partir do MAIOR nível presente no esquadrão (não acumula entre portadores).
 * L1 (−15%): ×0.85; L2 (−30%): ×0.70.
 */
export const PRESSURE_ENEMY_MULT_L1 = 0.85
export const PRESSURE_ENEMY_MULT_L2 = 0.70
/** Tinted Lens: multiplicador da Batalha no duelo quando o portador está em desvantagem de tipo. */
export const TINTED_LENS_BATTLE_MULT_L1 = 1.5
export const TINTED_LENS_BATTLE_MULT_L2 = 2.0
/** Leaf Guard L2: divisor do dano que o absorvedor toma no lugar de cada aliado na defesa (ceil). */
export const LEAF_GUARD_GYM_DAMAGE_DIVISOR = 2
/** Spore: fração do valor-BASE somada como buff do dia em cada eixo sorteado (+10%). */
export const SPORE_ATTR_BONUS_FRACTION = 0.1
/** Spore L2: quantos eixos distintos recebem o buff (L1 = 1). */
export const SPORE_ATTRS_COUNT_L2 = 3
/**
 * Static (NOVO, Fase 4): XP concedido por segundo que o time fica PARADO por raio ou poça.
 * 1 XP/s: 5s de paralisia → +5 XP.
 */
export const STATIC_XP_PER_SEC = 1
/**
 * Static L2: bônus ADITIVO de velocidade de viagem por segundo parado (10%/s, cap 100%).
 * Acumula em mission.staticStoppedSecs; aplica como min(STATIC_MOVE_CAP_L2, STATIC_MOVE_PER_SEC_L2 × secs).
 */
export const STATIC_MOVE_PER_SEC_L2 = 0.10
export const STATIC_MOVE_CAP_L2 = 1.0
/** Quick Feet: bônus aditivo de velocidade de viagem quando despachado sozinho (+100% → ×2). */
export const QUICK_FEET_SPEED_BONUS = 1
/** Regenerator: vida recuperada por Pokémon derrotado em batalha. */
export const REGENERATOR_HEAL_PER_WIN = 1
/** Natural Cure: vida recuperada ao sair em missão. */
export const NATURAL_CURE_MISSION_HEAL = 2
/** Analytic: multiplicador de atributos em Ensino (ganho) e em Patrulha (perda), por nível. */
export const ANALYTIC_STUDY_MULT_L1 = 1.4
export const ANALYTIC_STUDY_MULT_L2 = 1.8
export const ANALYTIC_PATROL_MULT_L1 = 0.6
export const ANALYTIC_PATROL_MULT_L2 = 0.2
/** Water Absorb: XP ganho quando a rota da missão passa pela água (REMOVIDO — mantido para compatibilidade). */
export const WATER_ABSORB_XP = 10
/** Water Absorb: multiplicador de atributos na PRÓXIMA missão após cruzar água, por nível. */
export const WATER_ABSORB_MISSION_MULT_L1 = 1.3
export const WATER_ABSORB_MISSION_MULT_L2 = 1.5
/** Sniper L1: multiplicador da duração de execução (dobra o tempo de execução). */
export const SNIPER_TIME_MULT_L1 = 2

// ---- Tempestade (raios + Paralyze) — efeito climático de Vermilion -------------------
/** Duração de um evento de tempestade (ms de jogo). */
export const STORM_EVENT_MIN_MS = 15_000
export const STORM_EVENT_MAX_MS = 30_000
/** Folga mínima entre tempestades PRÓPRIAS (as acopladas à chuva podem sobrepor). */
export const STORM_GAP_MS = 4_000

// ---- Calor (slowdown) — efeito climático de Celadon ---------------------------------
/** Calor: duração de um evento (ms de jogo) e folga entre eventos. */
export const HEAT_EVENT_MIN_MS = 30_000
export const HEAT_EVENT_MAX_MS = 60_000
export const HEAT_GAP_MS = 4_000
/** Calor: fator multiplicativo da velocidade de viagem enquanto quente (0.2 = −80%). */
export const HEAT_SLOW_FACTOR = 0.2
/** Chlorophyll: bônus ADITIVO de velocidade do time no calor (espelha SWIFT_SWIM_RAIN_BONUS). */
export const CHLOROPHYLL_HEAT_BONUS_L1 = 2
export const CHLOROPHYLL_HEAT_BONUS_L2 = 3
/** Aviso vermelho antes do impacto do raio. */
export const STRIKE_WARNING_MS = 5_000
/** Raio do efeito (fração da largura do mapa): padrão, quando o centro já é água, e secundário. */
export const STRIKE_RADIUS = 0.09
export const STRIKE_RADIUS_ON_WATER = 0.15
export const STRIKE_SECONDARY_RADIUS = 0.045
/** Dano de um raio. */
export const STRIKE_DAMAGE = 1
/** Piso de raios por tempestade (o teto escala com o dia até ⌊pontos/4⌋). */
export const STRIKE_MIN_PER_STORM = 1
/** Paralyze: tempo de congelamento do sprite e multiplicador de Batalha em batalhas 1v1. */
export const PARALYZE_STUN_MS = 5_000

// ---- Nevasca (Snowstorm) — efeito climático de Saffron/Viridian ---------------------
/** Duração de um evento de nevasca (ms de jogo) e folga entre eventos. */
export const SNOW_EVENT_MIN_MS = 40_000
export const SNOW_EVENT_MAX_MS = 70_000
export const SNOW_GAP_MS = 4_000
/** A cada 2s viajando sob nevasca, +1 stack de gelo. */
export const SNOW_STACK_INTERVAL_MS = 2_000
/** Velocidade = SNOW_SLOW_PER_STACK^stacks (composto). */
export const SNOW_SLOW_PER_STACK = 0.8
/** No 5º stack o time congela (parada dura + dano; voador morre). */
export const SNOW_MAX_STACKS = 5
/** Dano por tique de congelamento (não-voador). */
export const SNOW_FREEZE_DAMAGE = 1
export const SNOW_FREEZE_DAMAGE_INTERVAL_MS = 2_000
/** Descongela este tempo após a janela de nevasca acabar. */
export const SNOW_THAW_MS = 2_000

// ---- Tempestade de areia (Sandstorm) — Fuchsia/Cinnabar/Viridian --------------------
/** Duração de um evento de areia (ms de jogo) e folga entre eventos. */
export const SAND_EVENT_MIN_MS = 30_000
export const SAND_EVENT_MAX_MS = 60_000
export const SAND_GAP_MS = 4_000
export const PARALYZE_BATTLE_MULT = 0.5
/** Volt Absorb: bônus de movimento E atributos ao ser atingido por um raio (por nível). */
export const VOLT_ABSORB_BONUS_L1 = 0.30
export const VOLT_ABSORB_BONUS_L2 = 0.90
/**
 * Dry Skin: fração do maxHp curada ao sair em missão ENQUANTO CHOVE (arredondada p/ cima).
 * L1 e L2 curam a mesma fração; L2 também dá bônus de atributos em missão.
 */
export const DRY_SKIN_RAIN_HEAL_FRAC = 0.25
/** Dry Skin L2: bônus MULTIPLICATIVO nos atributos de missão enquanto chove (+25%). */
export const DRY_SKIN_MISSION_BONUS_L2 = 0.25

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
/** Mystic Water: +50% em batalhas para Pokémon do tipo Water. */
export const MYSTIC_WATER_BATTLE_MULT = 1.5
/** Dragon Fang: +50% em batalhas para Pokémon do tipo Dragão. */
export const DRAGON_FANG_BATTLE_MULT = 1.5
/** Magnet: +50% em batalhas para Pokémon do tipo Elétrico. */
export const MAGNET_BATTLE_MULT = 1.5
/** Itens de cidade: +50% em batalhas para Pokémon do tipo correspondente. */
export const GRASSY_SEED_BATTLE_MULT = 1.5
export const BLACK_SLUDGE_BATTLE_MULT = 1.5
export const TWISTED_SPOON_BATTLE_MULT = 1.5
export const CHARCOAL_BATTLE_MULT = 1.5
/** Fossil Stone: +50% em batalhas para Pokémon fósseis (Omanyte/Omastar/Kabuto/Kabutops/Aerodactyl). */
export const FOSSIL_STONE_BATTLE_MULT = 1.5
/** Lentes de cidade: +50% de poder do time num tipo específico de missão. */
export const WISE_GLASSES_MISSION_MULT = 1.5
export const ZOOM_LENS_MISSION_MULT = 1.5
export const WIDE_LENS_MISSION_MULT = 1.5
/** Electirizer: +50% no sucesso da próxima missão por raio sofrido (acumula por carga). */
export const ELECTIRIZER_MISSION_BONUS = 0.5
/** Exp Share: fração da XP de um Pokémon repassada ao resto do time. */
export const EXP_SHARE_RATE = 0.05

// ---- Evento de Roubo Rocket 🚨 (Feature B) ------------------------------------------------
/** Chance-base (%) de o roubo ARMAR no dia; dobra a cada dia sem disparar (1→2→4→…→100). */
export const THEFT_CHANCE_START = 1
/** Teto da chance de roubo (%) — a duplicação satura aqui. */
export const THEFT_CHANCE_MAX = 100
/** Máximo de perseguidores idle que podem ir atrás da Rocket. */
export const THEFT_CHASERS_MAX = 3
/**
 * Agilidade EFETIVA da Rocket na fuga: o tempo de viagem dela usa a MESMA curva de um time
 * com 10 de agilidade (agilityTravelFactor → fator 0,90). Lenta o bastante para Pokémon
 * rápidos alcançarem, rápida o bastante para os lentos não.
 */
export const THEFT_FLEE_AGILITY = 10
/** Janela (ms de jogo) parada no nó mais distante antes de a Rocket escapar de vez. */
export const THEFT_GRACE_MS = 5_000
/** Recompensa: a batalha de resgate rende 3× o XP de uma batalha de ginásio (só na vitória). */
export const THEFT_XP_MULTIPLIER = 3
/**
 * Limiar de proximidade (em coordenadas normalizadas 0–1, métrica 16:9 de segmentLength) para um
 * perseguidor INTERCEPTAR a Rocket. 0,03 ≈ 3% da largura do mapa: maior que o passo típico de um
 * tick a x3 (`graphTravelMs` dá pernas de vários segundos → << 0,03 por frame), evitando que a
 * interceptação "pule por cima" da Rocket entre dois ticks, e pequeno o bastante para exigir
 * encostar de fato. Ajustável na Fase 5.
 */
export const THEFT_INTERCEPT_DISTANCE = 0.03
