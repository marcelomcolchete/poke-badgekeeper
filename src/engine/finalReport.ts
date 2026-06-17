// Relatório de FIM DE JOGO (vitória no dia 10 ou derrota): agrega o acumulador vitalício + o dia
// em curso num único resumo da run inteira (PLAN — tela de fim de jogo). Puro: só lê o GameState.

import type { Pokemon } from '../types/index.ts'
import type { GameState, LifetimeStats, RunInfo } from './state.ts'
import type { ItemData } from '../data/types.ts'
import { combineLifetime } from './lifetime.ts'
import { averageStars, isHired } from './approval.ts'
import { pokemonRank, type Rank } from './ranking.ts'
import { heartsOf } from './hearts.ts'
import { CITIES, getCity } from '../data/cities.ts'
import { ITEMS } from '../data/items.ts'
import { secretCountOf } from '../data/secretAbilities.ts'

const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]))

export type EndOutcome = 'win' | 'loss'

/** Um Pokémon do relatório com o seu rank já calculado (miniaturas/listas). */
export interface FinalReportMon {
  pokemon: Pokemon
  rank: Rank
}

/** Destaque do JOGO: o Pokémon com mais feitos acumulados (missões + derrotas). */
export interface FinalReportMvp {
  pokemon: Pokemon
  rank: Rank
  missions: number
  defeats: number
  /** Nível da medalha da Habilidade Secreta (0 = nenhuma, 1 Bronze, 2 Prata, 3 Ouro). */
  medalIndex: number
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
  /** Itens comprados na run (id resolvido para o catálogo + quantidade), do mais comprado ao menos. */
  purchasedItems: { item: ItemData; count: number }[]
  /** Inimigo mais forte derrotado (maior poder de Batalha) com medalha/tipos; null se nenhum. */
  strongestEnemy: LifetimeStats['strongestEnemy']
  /** Destaque do jogo; null se ninguém somou feitos (ou o Pokémon não está mais em mãos). */
  mvp: FinalReportMvp | null
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

  const purchasedItems = Object.entries(life.purchasedItems)
    .map(([id, count]) => ({ item: ITEM_BY_ID.get(id), count }))
    .filter((e): e is { item: ItemData; count: number } => e.item !== undefined)
    .sort((a, b) => b.count - a.count)

  // Destaque do jogo: mais feitos (missões + derrotas); desempata por missões. Só conta quem ainda
  // está em mãos (um Pokémon liberado some da seleção e cede o posto ao próximo).
  let mvp: FinalReportMvp | null = null
  let bestDeeds = 0
  let bestMissions = -1
  for (const [id, use] of Object.entries(life.usage)) {
    const deeds = use.missions + use.defeats
    if (deeds <= 0) continue
    if (deeds < bestDeeds || (deeds === bestDeeds && use.missions <= bestMissions)) continue
    const mon = byId.get(id)
    if (!mon) continue
    bestDeeds = deeds
    bestMissions = use.missions
    mvp = {
      pokemon: mon,
      rank: pokemonRank(mon),
      missions: use.missions,
      defeats: use.defeats,
      medalIndex: secretCountOf(mon),
    }
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
    strongestEnemy: life.strongestEnemy,
    mvp,
    finalTeam: roster.map(toReportMon),
  }
}
