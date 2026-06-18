// Relatório de FIM DE JOGO (vitória no dia 10 ou derrota): agrega o acumulador vitalício + o dia
// em curso num único resumo da run inteira (PLAN — tela de fim de jogo). Puro: só lê o GameState.

import type { Pokemon, PokemonType } from '../types/index.ts'
import type { EnemyRef, GameState, RunInfo } from './state.ts'
import { combineLifetime } from './lifetime.ts'
import { averageStars, isHired } from './approval.ts'
import { pokemonRank, type Rank } from './ranking.ts'
import { heartsOf } from './hearts.ts'
import { CITIES, getCity } from '../data/cities.ts'
import { findItem } from '../data/items.ts'
import { BALLS } from '../data/balls.ts'
import { secretCountOf } from '../data/secretAbilities.ts'

const BALL_BY_ID = new Map(BALLS.map((b) => [b.id, b]))

export type EndOutcome = 'win' | 'loss'

/** Categoria de uma compra na tela de fim de jogo — agrupa a aba "Itens". */
export type PurchaseCategory = 'ball' | 'healing' | 'other'

/** Uma compra da run já resolvida (nome/sprite) e categorizada, com a contagem acumulada. */
export interface PurchasedEntry {
  id: string
  name: string
  sprite: string
  count: number
  category: PurchaseCategory
}

/** Ordem de exibição dos grupos na aba "Itens". */
const CATEGORY_ORDER: Record<PurchaseCategory, number> = { ball: 0, healing: 1, other: 2 }

/**
 * Resolve um id comprado (nome/sprite/categoria). As bolas evolutivas vivem em `balls.ts` (fora
 * do catálogo ITEMS) — por isso tentamos os dois; ids desconhecidos (saves antigos) viram null.
 */
function resolvePurchase(id: string, count: number): PurchasedEntry | null {
  const ball = BALL_BY_ID.get(id)
  if (ball) return { id, name: ball.name, sprite: ball.sprite, count, category: 'ball' }
  const item = findItem(id)
  if (!item) return null
  const kind = item.effect.kind
  const category: PurchaseCategory =
    kind === 'premierBall' ? 'ball' : kind === 'heal' || kind === 'revive' ? 'healing' : 'other'
  return { id, name: item.name, sprite: item.sprite, count, category }
}

/** Um Pokémon do relatório com o seu rank já calculado (miniaturas/listas). */
export interface FinalReportMon {
  pokemon: Pokemon
  rank: Rank
}

/** Destaque do JOGO: um Pokémon do time com seus feitos acumulados (missões + derrotas). */
export interface FinalReportMvp {
  pokemon: Pokemon
  rank: Rank
  missions: number
  defeats: number
  /** Nível da medalha da Habilidade Secreta (0 = nenhuma, 1 Bronze, 2 Prata, 3 Ouro). */
  medalIndex: number
}

/** Carrasco: a espécie inimiga que mais venceu duelos contra o seu time. */
export interface FinalReportTormentor {
  speciesId: number
  types: PokemonType[]
  count: number
}

export interface FinalReport {
  outcome: EndOutcome
  /** Motivo da derrota (quando outcome === 'loss' via GAMEOVER); ausente na vitória. */
  reason?: RunInfo['gameOverReason']
  cityName: string
  /** Próxima cidade (se houver) — habilita o botão "Próximo Ginásio" na vitória. */
  nextCityName: string | null
  nextCityIndex: number | null
  missionStars: number
  battleStars: number
  avgStars: number
  hired: boolean
  missionsCompleted: number
  missionsTotal: number
  defensesWon: number
  defensesTotal: number
  /** Média de corações do time final (roster). */
  avgHearts: number
  /** Ouro BRUTO ganho na run. */
  goldEarned: number
  /** Pokémon do jogador que desmaiaram na run. */
  faints: number
  /** Inimigos derrotados na run. */
  defeats: number
  /** Quantos Pokémon o jogador tem em mãos (time + PC) — total capturado vivo. */
  capturedCount: number
  /** Todos os Pokémon em mãos (time + PC) com rank, p/ a grade de miniaturas. */
  captured: FinalReportMon[]
  /**
   * Itens comprados na run (id resolvido para o catálogo/bolas + quantidade), já categorizados e
   * ordenados por grupo (bolas → cura/revive → outros) e, dentro do grupo, do mais comprado ao menos.
   */
  purchasedItems: PurchasedEntry[]
  /** Os 3 inimigos mais fortes enfrentados (maior poder de Batalha), do mais forte ao menos. */
  strongestEnemies: EnemyRef[]
  /** Top 3 do time por feitos (missões + derrotas); vazio se ninguém somou feitos. */
  topTeam: FinalReportMvp[]
  /** Carrasco: espécie inimiga que mais venceu seu time; null se nenhuma derrota registrada. */
  tormentor: FinalReportTormentor | null
  /** Time final (roster) com rank — exibe corações na UI. */
  finalTeam: FinalReportMon[]
}

/** Agrega o relatório de fim de jogo a partir do estado atual e do desfecho. */
export function buildFinalReport(state: GameState, outcome: EndOutcome): FinalReport {
  // Soma os dias fechados (lifetime) com o dia em curso (today) — o dia corrente nunca foi dobrado.
  const life = combineLifetime(state.lifetime, state.today)
  const roster = state.roster
  const held = [...roster, ...state.box]
  const byId = new Map(held.map((p) => [p.id, p]))

  const missionStars = state.approval.missionStars
  const battleStars = state.approval.battleStars

  const avgHearts = roster.length
    ? roster.reduce((sum, p) => sum + heartsOf(p.hearts), 0) / roster.length
    : 0

  // Resolve cada compra (ITEMS + bolas), categoriza e ordena por grupo e depois por quantidade.
  const purchasedItems = Object.entries(life.purchasedItems)
    .map(([id, count]) => resolvePurchase(id, count))
    .filter((e): e is PurchasedEntry => e !== null)
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    )

  // Top 3 do time: mais feitos (missões + derrotas); desempata por missões e depois pela ordem de
  // registro. Só conta quem ainda está em mãos (um Pokémon liberado some da seleção).
  const topTeam: FinalReportMvp[] = Object.entries(life.usage)
    .map(([id, use]) => ({ id, use, deeds: use.missions + use.defeats }))
    .filter((e) => e.deeds > 0 && byId.has(e.id))
    .sort((a, b) => b.deeds - a.deeds || b.use.missions - a.use.missions)
    .slice(0, 3)
    .map(({ id, use }) => {
      const mon = byId.get(id) as Pokemon
      return {
        pokemon: mon,
        rank: pokemonRank(mon),
        missions: use.missions,
        defeats: use.defeats,
        medalIndex: secretCountOf(mon),
      }
    })

  // Carrasco: a espécie que mais venceu seu time; empate → a que apareceu primeiro (ordem de defeatedBy).
  let tormentor: FinalReportTormentor | null = null
  for (const e of life.defeatedBy) {
    if (!tormentor || e.count > tormentor.count) tormentor = e
  }

  const toReportMon = (p: Pokemon): FinalReportMon => ({ pokemon: p, rank: pokemonRank(p) })

  const nextIndex = state.run.cityIndex + 1
  const next = CITIES[nextIndex] ?? null

  return {
    outcome,
    reason: state.run.gameOverReason,
    cityName: getCity(state.run.cityIndex).name,
    nextCityName: next?.name ?? null,
    nextCityIndex: next ? nextIndex : null,
    missionStars,
    battleStars,
    avgStars: averageStars(missionStars, battleStars),
    hired: isHired(missionStars, battleStars),
    missionsCompleted: life.missionsCompleted,
    missionsTotal: life.missionsTotal,
    defensesWon: life.defensesWon,
    defensesTotal: life.defensesTotal,
    avgHearts,
    goldEarned: life.goldEarned,
    faints: life.faints,
    defeats: life.defeats,
    capturedCount: held.length,
    captured: held.map(toReportMon),
    purchasedItems,
    strongestEnemies: life.strongestEnemies,
    topTeam,
    tormentor,
    finalTeam: roster.map(toReportMon),
  }
}
