// Invariantes do jogo (sem magic numbers — PLAN §2 / §4).
// Constantes de BALANCEAMENTO (dano, curvas, ouro, tempos) ficam para a Fase 5
// num `balance.ts` dedicado; aqui ficam só as regras estruturais fixas.

/** Período de testes: 10 dias por cidade (PLAN §3). */
export const TOTAL_DAYS = 10

/** Duração de um dia em tempo de jogo (PLAN §4.3). */
export const DAY_LENGTH_MS = 180_000

/**
 * O dia é dividido em 3 momentos IGUAIS (os 3 "minutos"): missões e defesas se
 * distribuem igualmente entre eles para não amontoarem no início/fim do dia.
 */
export const DAY_SEGMENTS = 3

/** Proporção da arte do mapa (16:9) — corrige distâncias do grafo de deslocamento (§3.1). */
export const MAP_ASPECT_W = 16
export const MAP_ASPECT_H = 9

/** Roster: 1–6 Pokémon; despacho de 1–6; defesa exige ≥1 (PLAN §3 / §4.4 / §4.5). */
export const MAX_ROSTER_SIZE = 6
export const MIN_DISPATCH = 1
/** Despacho de missão: no máximo 3 Pokémon por missão (rebalanceamento). */
export const MAX_DISPATCH = 3
export const MIN_DEFENSE_SQUAD = 1

/** Atributos: mínimo 10, máximo natural por espécie 50, teto efetivo 60 (PLAN §4.1). */
export const ATTR_MIN = 10
export const ATTR_MAX = 60
export const SPECIES_BASE_MIN = 10
export const SPECIES_BASE_MAX = 50
export const ATTR_PER_POINT = 10

/**
 * Teto da SOMA do time por eixo e da EXIGÊNCIA das missões: 70. Como cada Pokémon vai
 * no máx. 60 (ATTR_MAX), só com 2+ Pokémon dá pra cobrir um eixo em 70 — por isso as
 * missões mega/de fim de dia (exigência até 70) ficam mais difíceis. O radar das missões
 * usa esta escala; a carta de UM Pokémon continua na escala 60.
 */
export const TEAM_ATTR_MAX = 70

/** Piso do atributo EFETIVO: 0, pois a variação de encontro (IV) pode zerar um eixo. */
export const ATTR_EFFECTIVE_MIN = 0

/** Variação por eixo sorteada no encontro/criação (IV): −10 a +10 (PLAN §4.1, naturezas). */
export const IV_MIN = -10
export const IV_MAX = 10

/**
 * Sub-seeds estáveis do novo jogo (um por SLOT de inicial): tornam o card do preview =
 * Pokémon obtido. O roll escolhido entra como 3º componente: deriveSeed(seed, salt, roll).
 */
export const STARTER_SLOT_SALTS = [0x57a27, 0x5ec17] as const

/** Sub-seed do túnel do Dig (Habilidade Secreta): sorteia os dois pontos ligados por dia. */
export const DIG_SEED_SALT = 0xd16

/** Sub-seed do sorteio de treinadores do dia (defesa): ordena quais classes invadem hoje. */
export const TRAINER_SEED_SALT = 0x713a

/** Sub-seed que sorteia os 2 dias da missão Equipe Rocket na run (extra, fora da agenda). */
export const ROCKET_SEED_SALT = 0x526f636b // 'Rock'

/** Sub-seed do mercado da manhã: sorteia os 3 itens do dia (por seed+dia+cidade). */
export const SHOP_SEED_SALT = 0x53686f70 // 'Shop'

/**
 * Quantidade de Pokémon do treinador invasor por dia (PLAN §4.4). Indexado pelo dia (1–10);
 * a posição 0 é só preenchimento. Cresce de 1 (dia 1) a 6 (dias 9–10).
 */
export const DEFENSE_SQUAD_BY_DAY = [0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6] as const

/** Natureza: modificadores do valor por ponto alocado (+15 favorecido, +5 penalizado). */
export const NATURE_BOOSTED_PER_POINT = 15
export const NATURE_REDUCED_PER_POINT = 5

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

/** Conversão Resistência→HP: cada 10 pontos de Resistência = 1 de vida (0–10 → 1). */
export const RESISTANCE_PER_HP = 10

/** Aprovação: estrelas de 0 a 5, começa em 1, passo de 0,5; efetivado se > 3. Zerar = game over. */
export const STARS_MIN = 0
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

/** Captura: 2 candidatos por encontro; nível do selvagem = dia ± 1 (PLAN §4.5). */
export const CAPTURE_CHOICES = 2
export const WILD_LEVEL_VARIANCE = 1

/** Novo jogo: sorteia 3 tipos / 3 recrutas por rodada de escolha (PLAN §3). */
export const DRAFT_CHOICES = 3

/** Versão do schema de save e chave do localStorage (PLAN §5).
 * v5: grafo de deslocamento + viagem ida/volta. v6: ouro inicial 500, fase GAMEOVER e
 * âncoras de exibição das missões (separadas dos pontos de parada). v7: captura 1×/dia
 * com horário de surgimento (captureSpotSpawnsAtMs). v8: defesa com log de duelos +
 * inimigos com espécie, ouro de defesa por batalha (+bônus 30%) e fim do dia por retorno.
 * v9: sexo (gender) e apelido (nickname) por Pokémon. v10: XP de missão aplicado só na
 * volta (xpSeed) e retorno de captura com spotIndex/captured para o marcador do mapa.
 * v11: teto de atributos 60, XP do dia no relatório (today.xpEarned) e estrelas até 0 com
 * game over por reputação zerada (run.gameOverReason).
 * v12: sistema de naturezas (nature: Nature | null) em cada Pokémon do roster.
 * v13: variação de encontro por eixo (ivs: Attrs, −10..+10) e ranking F–S derivado;
 * candidateSeeds nos encontros para preview = captura.
 * v14: defesas perdidas no dia (today.defensesLost) para o placar de falhas do relatório;
 * XP por duelo vencido no ginásio e HP = 1 a cada 10 de Resistência (floor, piso 1).
 * v15: inimigos derrotados em defesas no dia (today.defenseKills) p/ MVP por derrotas.
 * v16: Habilidade Secreta — desbloqueio do Destaque do Dia gravado em today.secretUnlock.
 * v17: rebalanceamento das missões — exigência gerada por dia gravada na instância
 * (requirement + secondaryAttr), 6 tipos + 3 especiais, despacho máx. 3. A migração limpa
 * missões antigas (templateIds incompatíveis) e libera Pokémon presos nelas.
 * v18: efeitos das Habilidades Secretas — estado diário (today.secretRuntime) e túnel do
 * Dig (today.digTunnel).
 * v19: XP de missão vira POOL dividido entre os participantes (mission.xpAwards, opcional)
 * e XP de ginásio escala com o poder do desafiante (0,5/poder, teto 30).
 * v20: remove museu/Fossil; adiciona a missão Equipe Rocket (extra, 2×/run) com batalha,
 * desafiante em destaque (+15 e medalha) e nota E–S na batalha. A migração descarta missões
 * de museu antigas (templateId 'museu'), remove 'fossil' de runItems e libera Pokémon presos.
 * v21: níveis (Bronze/Prata/Ouro) das Habilidades Secretas — pokemon.secretLevel. A migração
 * dá nível 1 (Bronze) a quem já tinha a passiva 'secret-*' desbloqueada.
 * v22: sistema de itens — buffs diários por atributo (pokemon.dayBuffs, opcional) e itens
 * passivos run-wide reaproveitando s.runItems (exp-share/fast-ball/eviolite/lagging-tail/
 * thick-club). dayBuffs é opcional e some na virada do dia; migração é passthrough.
 * v23: mercado da manhã fixo no dia — today.shopOffer (3 itens ofertados) e
 * today.purchasedItems (vendidos hoje). A migração inicia ambos vazios (a UI deriva a oferta
 * quando vazia). */
export const SAVE_VERSION = 23
export const SAVE_KEY = 'poke-badgekeeper:save'
