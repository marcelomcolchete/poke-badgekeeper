// Invariantes do jogo (sem magic numbers — PLAN §2 / §4).
// Constantes de BALANCEAMENTO (dano, curvas, ouro, tempos) ficam para a Fase 5
// num `balance.ts` dedicado; aqui ficam só as regras estruturais fixas.

/** Período de testes: 10 dias por cidade (PLAN §3). */
export const TOTAL_DAYS = 10

/** Duração de um dia em tempo de jogo (PLAN §4.3). */
export const DAY_LENGTH_MS = 180_000

/** Proporção da arte do mapa (16:9) — corrige distâncias do grafo de deslocamento (§3.1). */
export const MAP_ASPECT_W = 16
export const MAP_ASPECT_H = 9

/** Roster: 1–6 Pokémon; despacho de 1–6; defesa exige ≥1 (PLAN §3 / §4.4 / §4.5). */
export const MAX_ROSTER_SIZE = 6
export const MIN_DISPATCH = 1
export const MAX_DISPATCH = 6
export const MIN_DEFENSE_SQUAD = 1

/** Atributos: mínimo 10, máximo natural por espécie 50, teto efetivo 100 (PLAN §4.1). */
export const ATTR_MIN = 10
export const ATTR_MAX = 100
export const SPECIES_BASE_MIN = 10
export const SPECIES_BASE_MAX = 50
export const ATTR_PER_POINT = 10

/** Níveis 1–10 (PLAN §4.1). */
export const LEVEL_MIN = 1
export const LEVEL_MAX = 10

/** Inicial da cidade: 1 Pokémon do tipo primário, nível 3 (PLAN §3). */
export const STARTER_LEVEL = 3

/** Ouro inicial de uma nova run (PLAN §4.6). */
export const STARTING_GOLD = 500

/** HP inteiro de 1–10, derivado da Resistência (PLAN §4.1). */
export const HP_MIN = 1
export const HP_MAX = 10

/** Aprovação: estrelas de 1 a 5, começa em 1, passo de 0,5; efetivado se > 3 (PLAN §4.7). */
export const STARS_MIN = 1
export const STARS_MAX = 5
export const STARS_START = 1
export const STARS_STEP = 0.5
export const STARS_HIRE_THRESHOLD = 3

/** Defesa: vantagem de tipo ×1,5, desvantagem ×0,5; perdedor de cada duelo perde 1 HP (PLAN §4.4). */
export const TYPE_ADVANTAGE_MULT = 1.5
export const TYPE_DISADVANTAGE_MULT = 0.5
export const HP_LOSS_PER_DEFENSE_LOSS = 1

/** Falha de missão: dano inteiro com mínimo de 1 (PLAN §4.2). */
export const MIN_FAILURE_DAMAGE = 1

/** Captura: 3 candidatos por encontro; nível do selvagem = dia ± 1 (PLAN §4.5). */
export const CAPTURE_CHOICES = 3
export const WILD_LEVEL_VARIANCE = 1

/** Novo jogo: sorteia 3 tipos / 3 recrutas por rodada de escolha (PLAN §3). */
export const DRAFT_CHOICES = 3

/** Versão do schema de save e chave do localStorage (PLAN §5).
 * v5: grafo de deslocamento + viagem ida/volta. v6: ouro inicial 500, fase GAMEOVER e
 * âncoras de exibição das missões (separadas dos pontos de parada). */
export const SAVE_VERSION = 6
export const SAVE_KEY = 'poke-badgekeeper:save'
