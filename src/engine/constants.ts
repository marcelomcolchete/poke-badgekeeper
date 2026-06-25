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
 * Teto da SOMA do time por eixo e da EXIGÊNCIA das missões: 100. Como cada Pokémon vai
 * no máx. 60 (ATTR_MAX), só com 2+ Pokémon dá pra cobrir um eixo em 100 — por isso as
 * missões mega/de fim de dia (exigência até 100) ficam mais difíceis. O radar das missões
 * usa esta escala; a carta de UM Pokémon continua na escala 60.
 */
export const TEAM_ATTR_MAX = 100

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

/** Sub-seed do buff diário do Spore (Habilidade Secreta): sorteia os eixos do dia por portador. */
export const SPORE_SEED_SALT = 0x53706f72 // 'Spor'

/** Sub-seed do mercado da manhã: sorteia os 3 itens do dia (por seed+dia+cidade). */
export const SHOP_SEED_SALT = 0x53686f70 // 'Shop'

/** Chance-base de um Pokémon nascer shiny (iniciais, captura por candidato). */
export const SHINY_CHANCE = 0.01

/** Shiny Charm (item): bônus aditivo na chance de shiny enquanto possuído (0.01 → 0.20). */
export const SHINY_CHARM_BONUS = 0.19

/** Sub-seed dedicado da rolagem de shiny — isola-a das demais sequências de RNG. */
export const SHINY_SEED_SALT = 0x5417

/** Sub-seed dos efeitos climáticos (chuva): agenda do dia + distribuição da chance na run. */
export const WEATHER_SEED_SALT = 0x57656174 // 'Weat'

/** Sub-seed da Tempestade: agenda própria do dia + distribuição da chance na run (independe da chuva). */
export const STORM_SEED_SALT = 0x53746f72 // 'Stor'

/** Salt do SORTEIO da chance de chuva — distinto do agendamento para não correlacionar streams. */
export const WEATHER_CHANCE_SALT = 0x52436863 // 'RChc'

/** Salt do SORTEIO da chance de tempestade — distinto do agendamento e da chuva. */
export const STORM_CHANCE_SALT = 0x53436863 // 'SChc'

/** Sub-seed do Calor: agenda própria do dia (independe de chuva/tempestade). */
export const HEAT_SEED_SALT = 0x48656174 // 'Heat'
/** Salt do SORTEIO da chance de Calor — distinto do agendamento e dos demais efeitos. */
export const HEAT_CHANCE_SALT = 0x48436863 // 'HChc'

/** Sub-seed da Nevasca: agenda própria do dia (independe dos demais efeitos). */
export const SNOW_SEED_SALT = 0x536e6f77 // 'Snow'
/** Salt do SORTEIO da chance de Nevasca. */
export const SNOW_CHANCE_SALT = 0x4e436863 // 'NChc'
/** Sub-seed da Tempestade de areia: agenda própria + sorteio do nó "perdido". */
export const SAND_SEED_SALT = 0x53616e64 // 'Sand'
/** Salt do SORTEIO da chance de Tempestade de areia. */
export const SAND_CHANCE_SALT = 0x44436863 // 'DChc'

/** Sub-seed do Evento de Roubo Rocket: rolagem da chance/alvo/nós/esquadrão por dia. */
export const THEFT_SEED_SALT = 0x54686566 // 'Thef'

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

/** HP inteiro de 1–12, derivado da Resistência (PLAN §4.1). */
export const HP_MIN = 1
export const HP_MAX = 12

/** Conversão Resistência→HP: cada 10 pontos de Resistência = 2 de vida (0–9 → piso 1). */
export const RESISTANCE_PER_HP = 10
export const HP_PER_RESISTANCE_STEP = 2

/**
 * Aprovação: DUAS trilhas de estrelas (missões e batalhas), cada uma de 0 a 5, começa em 1,
 * passo de 0,5. Zerar uma trilha (e ainda falhar) = game over. Efetivação no fim do período:
 * MÉDIA das duas trilhas ≥ 3 (STARS_HIRE_THRESHOLD).
 */
export const STARS_MIN = 0
export const STARS_MAX = 5
export const STARS_START = 1
export const STARS_STEP = 0.5
export const STARS_HIRE_THRESHOLD = 3

/**
 * Corações por Pokémon: 0 a 5, passo de 0,5. Novos Pokémon (capturados/escolhidos) começam com 2.
 * O multiplicador de XP segue a curva 2^(coração − 3) (ver engine/hearts.ts).
 */
export const HEARTS_MIN = 0
export const HEARTS_MAX = 5
export const HEARTS_START = 2
export const HEARTS_STEP = 0.5

/** Defesa: vantagem de tipo ×1,5, desvantagem ×0,5; perdedor de cada duelo perde HP (PLAN §4.4). */
export const TYPE_ADVANTAGE_MULT = 1.5
export const TYPE_DISADVANTAGE_MULT = 0.5
export const HP_LOSS_PER_DEFENSE_LOSS = 1

/** Falha de missão: dano inteiro com mínimo de 1 (PLAN §4.2). */
export const MIN_FAILURE_DAMAGE = 1

/**
 * Dano de 1 golpe no dia dado (batalha/falha de missão): +1 a cada 2 dias, sem teto
 * (modo infinito). Dia 1-2 → 1, 3-4 → 2, …, 9-10 → 5. Piso no dia 1.
 */
export function damageForDay(day: number): number {
  const d = Math.max(1, Math.round(day))
  return Math.ceil(d / 2)
}

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
 * quando vazia).
 * v24: Computador (PC) — s.box (Pokémon fora do time, trocados só de manhã) e Pokédex da área
 * (s.caughtSpecies, espécies já capturadas). Com o time cheio, a captura agora vai pro PC em vez
 * de exigir descarte. A migração inicia box vazio e caughtSpecies com as espécies do roster atual.
 * v25: bola evolutiva — run.ballLevel (0=nenhuma..4=Masterball) define a raridade-teto dos
 * encontros (Pokébola grátis libera Incomuns) e CaptureEncounter.rankWindow (Percepção→rank).
 * A migração inicia ballLevel 0; encontros antigos sem rankWindow ficam sem limite.
 * v26: Habilidades Secretas viram TRÊS por linha (todas ativas ao mesmo tempo). pokemon.secretLevel
 * (1 ability/3 níveis) vira pokemon.secretCount (quantas das três desbloqueou); passivas 'secret-*'
 * e 'sturdy-spent' são removidas; today.digTunnel (1 túnel) vira today.digTunnels (vários). A
 * migração converte o nível em contagem (mesma quantidade desbloqueada) e limpa o reveal do dia.
 * v27: efeitos climáticos por cidade (Chuva em Cerulean). Adiciona s.weather (agenda pré-computada
 * no início do dia: eventos de chuva + poças + previsão) e campos opcionais na missão para o
 * replaneja/espera por poça (weatherDelayMs/reroutePath/weatherHold). A migração inicializa
 * s.weather vazio; missões em andamento mantêm seus tempos (sem poças retroativas).
 * v28: Percepção vira CENTRO de rank contínuo (cada ponto conta) no lugar da janela em degraus.
 * CaptureEncounter.rankWindow → rankCenter (número). A migração converte [lo,hi] no centro
 * (lo+hi)/2; encontros sem janela ficam sem viés.
 * v29: medalhas dos invasores (Bronze +10 / Prata +20 / Ouro +50) por dia, com chance e raridade
 * crescentes (100% Ouro no dia 30), no lugar do destaque único. EnemyUnit.buffed → EnemyUnit.medal.
 * A migração troca buffed:true por medal:'silver' (a Batalha já tinha o +15 embutido).
 * v30: pontuação em DUAS trilhas (approval.missionStars/battleStars no lugar de stars) e corações
 * por Pokémon (pokemon.hearts, 0–5). Adiciona today.activeIds (participação do dia) e
 * today.missionStarsBefore/battleStarsBefore. A migração duplica a estrela antiga nas duas trilhas,
 * dá 2 corações a todo Pokémon (roster + PC) e inicia activeIds vazio.
 * v33: efeito Tempestade. WeatherSchedule ganha `storms` e a previsão ganha
 * stormChancePercent/potentialStormCount; today ganha paralyzedBattleIds; missões/buscas
 * ganham paralyzeHold opcional. A migração inicia storms vazio, previsão de tempestade
 * zerada e paralyzedBattleIds vazio (recalculados no próximo setupDay).
 * v34: sistema de shiny. pokemon.shiny? e CaptureEncounter.candidateShiny? são opcionais
 * (ausente = não-shiny); nada a preencher — passthrough.
 * v35: Missões Especiais da Cidade. run.specialChances (chance por local) inicia vazio
 * (setupDay redimensiona); remove a missão Rocket (templateId 'rocket', status 'battle',
 * mission.rocket) e a batalha pós-missão — a especial paga 5× XP direto. A migração descarta
 * missões Rocket antigas e libera Pokémon presos.
 * v36: Evento de Roubo Rocket. run.theftChance (1%, dobra por dia sem disparar) e
 * GameState.theft (TheftEvent opcional: fase/alvo/nós/timers/esquadrão). PokemonStatus ganha
 * 'stolen'. A migração inicia theftChance=1 e NÃO cria theft (eventos em voo não persistem;
 * recalculados no próximo dia-aberto).
 * v37: Habilidades Secretas viram 2 por linha com nível (secretPicks). pokemon.secretCount →
 * pokemon.secretPicks (best-effort: 0→[]; 1→slot0 nível1; ≥2→slots 0 e 1 nível1). Remove
 * secretCount. Limpa today.secretUnlock (formato incompatível) → null.
 * v38: efeito Calor. WeatherSchedule ganha `heat` e a previsão ganha heatChancePercent/
 * potentialHeatCount. A migração inicia heat vazio e a previsão de calor zerada (recalculados no
 * próximo setupDay).
 * v40: clock.daySpeed (última velocidade de jogo escolhida pelo jogador, 1/2/3) — o abrir de cada
 * dia reabre o relógio nela em vez de voltar ao 1×. Opcional (ausente = 1×); migração passthrough. */
export const SAVE_VERSION = 40
export const SAVE_KEY = 'poke-badgekeeper:save'

/** Poke Egg: dias de incubação até chocar (0/3 → 1/3 → 2/3 → choca). */
export const EGG_INCUBATION_DAYS = 3
/** Air Balloon: faixa de usos (missões) antes de estourar. */
export const AIR_BALLOON_USES_MIN = 20
export const AIR_BALLOON_USES_MAX = 30
