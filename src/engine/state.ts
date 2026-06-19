// Tipos do GameState + estado inicial (PLAN §5).
// A engine é pura: recebe GameState + ação e retorna um NOVO GameState.
// A Fase 3 acrescenta o runtime do dia (eventos com timing, buscas, encontros, tally).

import type {
  AttrKey,
  Attrs,
  EnemyUnit,
  GamePhase,
  GameSpeed,
  MapPos,
  MedalTier,
  MissionCategory,
  Pokemon,
  PokemonType,
  TrainerId,
} from '../types/index.ts'
import type { DuelLog } from './gymDefense.ts'
import type { WeatherSchedule } from './weather.ts'
import { emptyWeatherSchedule } from './weather.ts'
import { DAY_LENGTH_MS, STARS_START, STARTING_GOLD } from './constants.ts'

export interface RunInfo {
  /** Índice da cidade atual de Kanto (0..7). */
  cityIndex: number
  /** Dia atual (1..10). */
  day: number
  /** Seed-mestra da run (reprodutibilidade). */
  seed: number
  phase: GamePhase
  /**
   * Nível da bola possuída (0 = nenhuma; 1 = Pokébola … 4 = Masterball). Cada nível libera
   * uma raridade a mais nos encontros da exploração. Sobe ao comprar a próxima bola no mercado.
   */
  ballLevel: number
  /** Motivo da derrota quando phase === 'GAMEOVER' (mensagem da tela de fim de jogo). */
  gameOverReason?: 'gym' | 'stars' | 'rocket' | 'fainted'
}

export interface ClockState {
  dayElapsedMs: number
  dayLengthMs: number
  speed: GameSpeed
}

export interface GymInfo {
  /** [primário, tipo2, tipo3] — definem o pool capturável (PLAN §4.5). */
  types: PokemonType[]
}

export type MissionStatus =
  | 'scheduled' // ainda não surgiu no mapa
  | 'available' // popup no mapa, aceitável até expirar
  | 'traveling' // time a caminho da missão (ida) — PLAN §4.3
  | 'inProgress' // executando no local
  | 'battle' // Rocket Team: parte de atributos concluída, aguardando a batalha do jogador
  | 'returning' // desfecho aplicado; time voltando ao ginásio
  | 'resolved' // concluída e time já em casa (ver result)

export type MissionResult = 'success' | 'failure' | 'expired'

export interface MissionInstance {
  id: string
  templateId: string
  /**
   * Categoria sorteada (sítio onde nasce). Define o MARCADOR quando um mesmo ponto hospeda
   * mais de um número — ex.: 'g' é casa (6.2) e área verde (3.3); só a categoria desempata.
   * Ausente em missões antigas (cai no marcador do ponto).
   */
  category?: MissionCategory
  /**
   * Exigência por eixo (0–60), GERADA e gravada no spawn escalando com o dia (ver
   * engine/missions.ts → generateRequirement). Desenha o hexágono e define a P_sucesso.
   */
  requirement: Attrs
  /**
   * Atributo secundário sorteado (subtipo) das missões normais; igual ao principal = "mega".
   * Ausente nas especiais (Pokecenter/Pokemart/Museu).
   */
  secondaryAttr?: AttrKey | null
  /** Ponto do grafo onde a missão surge — define o trajeto desde o ginásio (PLAN §3.1). */
  node: string
  /** Caminho ginásio→ponto (ids da ida), calculado ao aceitar. Voo = reta. */
  path: string[]
  /**
   * Caminho ponto→ginásio (ids da VOLTA), calculado ao aceitar. NÃO é só o reverso da ida:
   * respeita arestas de mão única (ex.: voltar de 'k' por k→t→u, mais curto). Ausente em
   * saves antigos → cai no reverso de `path`. Voo = reta.
   */
  returnPath?: string[]
  /** Time voando (Fly + sozinho): rota em linha reta e símbolo de voo no mapa — PLAN §4.3. */
  flying?: boolean
  /** Time surfando (Surf): a rota cruza a água, com símbolo de surf no mapa — PLAN §3.1. */
  surfing?: boolean
  /** Momento (ms de jogo) em que aparece no mapa. */
  spawnAtMs: number
  /** Momento em que some se não for aceita — PLAN §3.1. */
  expiresAtMs: number
  status: MissionStatus
  teamIds: string[]
  /** Marcos de tempo definidos ao aceitar (ms de jogo) — PLAN §4.3. */
  acceptedAtMs: number | null
  /** Fim da viagem de ida (chegada ao local). */
  arriveAtMs: number | null
  /** Fim da execução = desfecho aplicado; início da volta. */
  resolveAtMs: number | null
  /** Chegada de volta ao ginásio = time liberado. */
  returnEndsAtMs: number | null
  result: MissionResult | null
  pSuccess: number | null
  /**
   * Clima (poças): atraso total (ms) já embutido nos marcos por ter esperado uma poça secar —
   * mantido para reprodutibilidade no save-reload e para não reaplicar o mesmo atraso. Ausente = 0.
   */
  weatherDelayMs?: number
  /**
   * Rota REALMENTE percorrida na perna atual quando uma poça forçou um desvio (substitui
   * `path`/`returnPath` na interpolação). Ausente = sem desvio. Limpa ao iniciar a volta.
   */
  reroutePath?: string[]
  /**
   * Time parado num ponto esperando uma poça secar (sem rota alternativa). `node` é o ponto
   * antes da poça; `untilMs` é quando a poça some. Ausente = não está esperando.
   */
  weatherHold?: { node: string; untilMs: number }
  /**
   * Paralyze (Tempestade): congela o sprite numa posição arbitrária por 5s. `pos` é onde o raio
   * acertou; `untilMs` é quando descongela. Ausente = sem paralisia em curso.
   */
  paralyzeHold?: { pos: MapPos; untilMs: number }
  /**
   * Sub-seed do RNG de evolução, sorteado ao resolver. O XP só é APLICADO na volta ao
   * ginásio (PLAN §4.1, ajuste) — guardar o seed mantém a evolução determinística.
   */
  xpSeed?: number
  /**
   * XP-base atribuído a cada participante (id → share), gravado ao resolver no sucesso:
   * o POOL da missão dividido igualmente. Consumido na volta (freeOnReturn) e exibido na
   * tela de finalização. Ausente em falha/missões antigas (cai no fallback 0).
   */
  xpAwards?: Record<string, number>
  /**
   * Batalha da Equipe Rocket: presente só nas missões Rocket que CUMPRIRAM a parte de
   * atributos. O time enfrenta o treinador na ordem em que foi despachado; as recompensas
   * (ouro-bônus + 3× XP) só são aplicadas ao VENCER (PLAN — Rocket Team).
   */
  rocket?: RocketBattle
}

/** Batalha da missão Equipe Rocket (anexada à instância após cumprir a parte de atributos). */
export interface RocketBattle {
  /** Treinador Rocket sorteado (define o elenco e a arte). */
  trainerId: TrainerId
  /** Esquadrão inimigo (mesma quantidade por dia que a defesa de ginásio), com medalhas do dia. */
  enemies: EnemyUnit[]
  /** Log da cadeia de duelos, preenchido ao resolver a batalha. */
  duels?: DuelLog[]
  /** Venceu a batalha? (definido ao resolver). */
  won?: boolean
  /** Batalha já resolvida (HP/ouro aplicados)? Evita resolver duas vezes ao reabrir. */
  resolved?: boolean
  /** XP/recompensas já aplicados ao concluir a animação? (idempotência). */
  rewardApplied?: boolean
  /** Sub-seed de evolução do XP por vitória, sorteado ao resolver. */
  xpSeed?: number
}

export type DefenseStatus =
  | 'scheduled' // agendada, ainda não surgiu
  | 'active' // símbolo no ginásio, aguardando esquadrão (timer mais longo)
  | 'won'
  | 'lost'

export interface DefenseEvent {
  id: string
  pos: MapPos
  spawnAtMs: number
  /** Surge sobre o ginásio com timer mais longo que missões — PLAN §3.1 / §4.4. */
  expiresAtMs: number
  status: DefenseStatus
  /** Classe do treinador invasor (define o elenco e a arte mostrada) — PLAN §4.4. */
  trainerId: TrainerId
  /** Arte sorteada para ESTE evento (quando o treinador tem variantes, ex.: gen3/gen3rs). */
  trainerSprite?: string
  squadIds: string[]
  /** Inimigos sorteados quando a defesa surge (matchup fixo/semeado). */
  enemies: EnemyUnit[]
  /** Log da cadeia de duelos, preenchido ao resolver — alimenta o modal de batalha (§4.4). */
  duels: DuelLog[]
  /** Sub-seed de evolução do XP por vitória, sorteado ao resolver; o XP só é aplicado ao
   * FECHAR a batalha (o level-up "aparece" depois da animação) — guardar mantém a evolução determinística. */
  xpSeed?: number
  /** XP por vitórias já aplicado (ao concluir a batalha)? Evita aplicar duas vezes ao reabrir. */
  xpApplied?: boolean
}

/** Busca de captura em andamento: um Pokémon viaja até o spot e procura até gerar encontro (PLAN §4.5). */
export interface CaptureSearch {
  searcherId: string
  spotIndex: number
  /** Ponto da grama (do grafo) — define o trajeto desde o ginásio. */
  node: string
  /** Caminho ginásio→ponto (ida). A volta é uma rota própria (CaptureReturn). Voo = linha reta. */
  path: string[]
  /** Procurador voando (Fly): rota em linha reta e símbolo de voo no mapa — PLAN §4.3. */
  flying?: boolean
  /** Procurador surfando (Surf): a rota cruza a água, com símbolo de surf no mapa — PLAN §3.1. */
  surfing?: boolean
  /** Fase: 'traveling' (a caminho) ou 'searching' (procurando no local). */
  phase: 'traveling' | 'searching'
  /** Saída do ginásio (início da ida) — base da animação. */
  departAtMs: number
  /** Chegada ao local (início da busca). */
  arriveAtMs: number
  /** Fim da busca = encontro gerado. */
  readyAtMs: number
  /** Clima (poças): rota de desvio percorrida quando uma poça bloqueou a ida (substitui `path`). */
  reroutePath?: string[]
  /** Clima (poças): parado no ponto antes de uma poça até ela secar (sem rota seca alternativa). */
  weatherHold?: { node: string; untilMs: number }
  /**
   * Paralyze (Tempestade): congela o sprite numa posição arbitrária por 5s. `pos` é onde o raio
   * acertou; `untilMs` é quando descongela. Ausente = sem paralisia em curso.
   */
  paralyzeHold?: { pos: MapPos; untilMs: number }
}

/** Procurador voltando ao ginásio após capturar/dispensar — só fica idle ao chegar (PLAN §4.5). */
export interface CaptureReturn {
  searcherId: string
  /** Índice da área de captura (em captureSpots) de onde está voltando — marcador no mapa (#6). */
  spotIndex: number
  /** Capturou alguém nesta exploração? Define o ícone ✓/✗ do marcador na volta (#6). */
  captured: boolean
  node: string
  /** Caminho ponto→ginásio (volta REAL; respeita arestas de mão única, ex.: k→t→u). Voo = reta. */
  path: string[]
  /** Procurador voando (Fly): rota em linha reta e símbolo de voo no mapa — PLAN §4.3. */
  flying?: boolean
  /** Procurador surfando (Surf): a rota cruza a água, com símbolo de surf no mapa — PLAN §3.1. */
  surfing?: boolean
  departAtMs: number
  arriveAtMs: number
  /** Clima (poças): rota de desvio percorrida quando uma poça bloqueou a volta (substitui `path`). */
  reroutePath?: string[]
  /** Clima (poças): parado no ponto antes de uma poça até ela secar (sem rota seca alternativa). */
  weatherHold?: { node: string; untilMs: number }
  /**
   * Paralyze (Tempestade): congela o sprite numa posição arbitrária por 5s. `pos` é onde o raio
   * acertou; `untilMs` é quando descongela. Ausente = sem paralisia em curso.
   */
  paralyzeHold?: { pos: MapPos; untilMs: number }
}

/** Encontro pronto: 3 candidatos para o jogador decidir (capturar / voltar / seguir) — PLAN §4.5. */
export interface CaptureEncounter {
  searcherId: string
  spotIndex: number
  /** Nível "base" do dia (fallback de UI/saves antigos); o nível real é por candidato. */
  level: number
  candidateSpeciesIds: number[]
  /** Nível POR candidato (paralelo a `candidateSpeciesIds`). Ausente em saves antigos → usa `level`. */
  candidateLevels?: number[]
  /** Seed estável por candidato: preview = Pokémon capturado (natureza, IVs/rank) — §4.5. */
  candidateSeeds: number[]
  /** Shiny por candidato (paralelo a candidateSpeciesIds). Ausente = todos não-shiny. */
  candidateShiny?: boolean[]
  /**
   * Centro de rank (0=F … 6=S, contínuo) mirado pela Percepção do explorador: enviesa os
   * IVs/rank dos candidatos. Ausente em saves antigos → captura/preview sem viés (§4.5).
   */
  rankCenter?: number
}

export interface ItemStack {
  itemId: string
  quantity: number
}

export interface Approval {
  /** Estrelas de missões (0–5, passo 0,5). */
  missionStars: number
  /** Estrelas de batalhas/defesas (0–5, passo 0,5). */
  battleStars: number
  dailyGoalMet: boolean
}

/** Registro de uma missão resolvida no dia (contagem + MVP no resumo). */
export interface MissionResultLog {
  templateId: string
  success: boolean
  teamIds: string[]
}

/** Estado por-Pokémon das Habilidades Secretas no dia (zera a cada manhã). */
export interface SecretRuntime {
  /** Battle Armor: participou de uma batalha → bônus nos atributos da próxima missão (consome ao resolver). */
  battleArmorPending?: boolean
  /** Sturdy: já usou o "não desmaia" hoje (1×/dia). */
  sturdyUsed?: boolean
}

/** Um inimigo derrotado numa defesa do dia: quem derrotou + espécie (sprite no relatório). */
export interface DefenseKill {
  defeaterId: string
  /** Espécie do desafiante derrotado — usada só para a miniatura no relatório. */
  speciesId?: number
  /** Poder de Batalha do inimigo derrotado — base do "mais forte enfrentado" no fim de jogo. */
  enemyBattle?: number
  /** Medalha (Bronze/Prata/Ouro) que o inimigo derrotado carregava. */
  enemyMedal?: MedalTier
  /** Tipos do inimigo derrotado (selos na tela de fim de jogo). */
  enemyTypes?: PokemonType[]
}

/**
 * Um duelo PERDIDO numa batalha do dia: o inimigo que venceu o seu Pokémon (vítima) + a espécie
 * dele. Simétrico ao DefenseKill — base do "Carrasco" (espécie que mais venceu seu time) no fim.
 */
export interface DefenseLoss {
  /** Seu Pokémon que perdeu o duelo. */
  victimId: string
  /** Espécie do inimigo que venceu — miniatura/agrupamento do Carrasco. */
  speciesId?: number
  enemyBattle?: number
  enemyMedal?: MedalTier
  enemyTypes?: PokemonType[]
}

/** Inimigo (efêmero) referenciado no relatório de fim de jogo: poder + espécie/tipos/medalha. */
export interface EnemyRef {
  battle: number
  medal?: MedalTier
  types: PokemonType[]
  speciesId?: number
}

/** Acumulador do dia em curso (zerado a cada manhã) — base do resumo/aprovação. */
export interface DayTally {
  missionResults: MissionResultLog[]
  defensesTotal: number
  defensesWon: number
  /** Defesas LUTADAS e perdidas no dia (relatório de falhas). */
  defensesLost: number
  capturedIds: string[]
  goldEarned: number
  /** XP total concedido em missões bem-sucedidas no dia (relatório) — somado na volta. */
  xpEarned: number
  /** Ouro vindo só de defesas (base do bônus de +30% por dia perfeito) — PLAN §4.6. */
  defenseGold: number
  /** Estrelas de missões no início do dia (preenchido no fechamento) — para o resumo. */
  missionStarsBefore: number
  /** Estrelas de batalhas no início do dia (preenchido no fechamento) — para o resumo. */
  battleStarsBefore: number
  /**
   * Ids de Pokémon que PARTICIPARAM de algo hoje (missão, exploração ou batalha direta) —
   * base da regra de corações do fim do dia (quem não fez nada perde ½ coração).
   */
  activeIds: string[]
  /** Áreas de captura já exploradas hoje (índices em captureSpots) — somem do mapa. */
  exploredSpots: number[]
  /** Inimigos derrotados em defesas hoje (MVP por derrotas + miniaturas no relatório). */
  defenseKills: DefenseKill[]
  /** Duelos perdidos hoje (o inimigo que venceu seu Pokémon) — base do "Carrasco" no fim de jogo. */
  defenseLosses: DefenseLoss[]
  /** Quantos Pokémon do jogador desmaiaram hoje (eventos de desmaio) — base das "mortes" no fim. */
  faints: number
  /**
   * Habilidade Secreta desbloqueada HOJE pelo Destaque do Dia (reveal no resumo); null se
   * nenhuma. `secretId` é o id do tipo de habilidade e `index` é a posição na linha (1, 2 ou 3).
   */
  secretUnlock: { pokemonId: string; secretId: string; index: number } | null
  /** Corações que o Destaque do Dia ganhou no fechamento (delta já capado em [0,5]) — resumo. */
  mvpHeartsGained: number
  /** Estado por-Pokémon das Habilidades Secretas hoje (stacks/flags), por id de Pokémon. */
  secretRuntime: Record<string, SecretRuntime>
  /**
   * Túneis do Dig hoje: cada Pokémon do roster com Dig/Dig+ abre UM túnel de 2 pontos do grafo
   * ligados por baixo da terra (podem se sobrepor). Vazio se ninguém tem a habilidade.
   */
  digTunnels: string[][]
  /** Itens (ids) ofertados no mercado HOJE — fixos ao entrar na manhã (não re-sorteia ao comprar). */
  shopOffer: string[]
  /** Itens (ids) já comprados HOJE — viram "VENDIDO" no mercado (1 compra por slot/dia). */
  purchasedItems: string[]
  /** Pokémon (ids) com -50% de Batalha pelo resto do dia (Paralyze da Tempestade). */
  paralyzedBattleIds: string[]
}

export interface DayLog {
  day: number
  missionStarsAfter: number
  battleStarsAfter: number
  goldEarned: number
  captured: number
}

/**
 * Acumulador VITALÍCIO da run (toda a cidade/10 dias) — base da tela de fim de jogo. Guarda só os
 * dias JÁ FECHADOS (dobrado em startNextDay antes de zerar `today`); o dia em curso é somado na
 * exibição via combineLifetime. Assim a soma nunca duplica, seja na vitória do dia 10 ou na derrota.
 */
export interface LifetimeStats {
  /** Missões bem-sucedidas acumuladas. */
  missionsCompleted: number
  /** Missões que surgiram (aceitas + ignoradas/expiradas) acumuladas — o "de quantas possíveis". */
  missionsTotal: number
  defensesWon: number
  defensesTotal: number
  /** Ouro BRUTO ganho na run (não é o saldo). */
  goldEarned: number
  /** Eventos de desmaio do time (mortes). */
  faints: number
  /** Inimigos derrotados em batalhas (defesas + Rocket). */
  defeats: number
  /** itemId → quantidade comprada na run. */
  purchasedItems: Record<string, number>
  /** pokemonId → feitos acumulados (missões bem-sucedidas + derrotas) — base do Destaque do Jogo. */
  usage: Record<string, { missions: number; defeats: number }>
  /** Top inimigos DERROTADOS na run (maior poder de Batalha), até 3 — "Pokémons enfrentados". */
  strongestEnemies: EnemyRef[]
  /**
   * Espécies inimigas que venceram duelos contra o seu time, em ORDEM de 1ª aparição (o desempate
   * do Carrasco é "o primeiro a aparecer"). count = nº de duelos vencidos contra você.
   */
  defeatedBy: { speciesId: number; types: PokemonType[]; count: number }[]
}

export interface GameState {
  run: RunInfo
  clock: ClockState
  gym: GymInfo
  /** 1..9 Pokémon (despacha 1–6 por missão). */
  roster: Pokemon[]
  /** Pokémon guardados no Computador (PC) — fora do time; trocados só de manhã (capacidade ilimitada). */
  box: Pokemon[]
  /** Espécies (ids) já capturadas na run — base da Pokédex da área (persiste após evolução). */
  caughtSpecies: number[]
  missions: MissionInstance[]
  defenses: DefenseEvent[]
  captureSearches: CaptureSearch[]
  /** Procuradores voltando ao ginásio após o encontro (PLAN §4.5). */
  captureReturns: CaptureReturn[]
  encounters: CaptureEncounter[]
  /** Pontos de grama (ids do grafo) com captura ativa hoje (1×/dia) — spots no mapa. */
  captureSpots: string[]
  /** Horário (ms de jogo) em que cada spot de captura surge no mapa — alinhado a captureSpots. */
  captureSpotSpawnsAtMs: number[]
  approval: Approval
  gold: number
  inventory: ItemStack[]
  /** Itens/passivas permanentes da run. */
  runItems: string[]
  today: DayTally
  /** Acumulador vitalício da run (dias fechados) — alimenta a tela de fim de jogo. */
  lifetime: LifetimeStats
  /** Agenda climática do dia (eventos de chuva + poças + previsão), pré-computada em setupDay. */
  weather: WeatherSchedule
  history: DayLog[]
  /** Contador determinístico de ids de entidades (eventos/Pokémon). */
  nextId: number
  /** Cursor determinístico para derivar sub-seeds de RNG durante o dia. */
  rngCursor: number
}

/** Marca um Pokémon como participante do dia (idempotente) — base dos corações do fim do dia. */
export function markActive(today: DayTally, pokemonId: string): void {
  if (!today.activeIds.includes(pokemonId)) today.activeIds.push(pokemonId)
}

export function emptyTally(): DayTally {
  return {
    missionResults: [],
    defensesTotal: 0,
    defensesWon: 0,
    defensesLost: 0,
    capturedIds: [],
    goldEarned: 0,
    xpEarned: 0,
    defenseGold: 0,
    missionStarsBefore: 0,
    battleStarsBefore: 0,
    activeIds: [],
    exploredSpots: [],
    defenseKills: [],
    defenseLosses: [],
    faints: 0,
    secretUnlock: null,
    mvpHeartsGained: 0,
    secretRuntime: {},
    digTunnels: [],
    shopOffer: [],
    purchasedItems: [],
    paralyzedBattleIds: [],
  }
}

/** Acumulador vitalício zerado (início da run). */
export function emptyLifetime(): LifetimeStats {
  return {
    missionsCompleted: 0,
    missionsTotal: 0,
    defensesWon: 0,
    defensesTotal: 0,
    goldEarned: 0,
    faints: 0,
    defeats: 0,
    purchasedItems: {},
    usage: {},
    strongestEnemies: [],
    defeatedBy: [],
  }
}

/** Estado inicial de uma nova run (antes da escolha do inicial e dos tipos do ginásio). */
export function createInitialState(seed: number): GameState {
  return {
    run: { cityIndex: 0, day: 1, seed, phase: 'MORNING', ballLevel: 0 },
    clock: { dayElapsedMs: 0, dayLengthMs: DAY_LENGTH_MS, speed: 0 },
    gym: { types: [] },
    roster: [],
    box: [],
    caughtSpecies: [],
    missions: [],
    defenses: [],
    captureSearches: [],
    captureReturns: [],
    encounters: [],
    captureSpots: [],
    captureSpotSpawnsAtMs: [],
    approval: { missionStars: STARS_START, battleStars: STARS_START, dailyGoalMet: false },
    gold: STARTING_GOLD,
    inventory: [],
    runItems: [],
    today: emptyTally(),
    lifetime: emptyLifetime(),
    weather: emptyWeatherSchedule(),
    history: [],
    nextId: 1,
    rngCursor: 0,
  }
}
