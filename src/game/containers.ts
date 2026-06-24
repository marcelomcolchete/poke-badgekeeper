// Helpers compartilhados sobre os "containers" que transportam Pokémon em viagem (missão em
// ida/volta, busca de captura, retorno de captura). Usados pela aplicação dos efeitos climáticos
// de runtime que dependem de posição/voo: a Tempestade (game/stormFlow.ts) e a Nevasca
// (game/snowFlow.ts). Mantém a morte-voadora consistente entre o raio e o gelo.

import type { GameState } from '../engine/state.ts'
import { findMon, replaceMon, settleFaintTracked } from './runtime.ts'

/**
 * Retorna os ids do time que carrega `id` (pode ser apenas `id` sozinho em buscas/retornos de
 * captura). Usado para checar habilidades de time (Lightning Rod, Clear Body) e aplicar morte voadora.
 */
export function containerTeamIds(s: GameState, id: string): string[] {
  const mission = s.missions.find(
    (m) => m.teamIds.includes(id) && (m.status === 'traveling' || m.status === 'returning'),
  )
  if (mission) return [...mission.teamIds]
  const search = s.captureSearches.find((c) => c.searcherId === id && c.phase === 'traveling')
  if (search) return [search.searcherId]
  const ret = s.captureReturns.find((r) => r.searcherId === id)
  if (ret) return [ret.searcherId]
  return [id]
}

/** Retorna true se o container que carrega `id` está voando (flying === true). */
export function isInFlyingContainer(s: GameState, id: string): boolean {
  const mission = s.missions.find(
    (m) => m.teamIds.includes(id) && (m.status === 'traveling' || m.status === 'returning'),
  )
  if (mission) return mission.flying === true
  const search = s.captureSearches.find((c) => c.searcherId === id && c.phase === 'traveling')
  if (search) return search.flying === true
  const ret = s.captureReturns.find((r) => r.searcherId === id)
  if (ret) return ret.flying === true
  return false
}

/**
 * Mata todo o time voador: faz os membros desmaiarem (HP=0, status=fainted, today.faints++) e
 * falha/encerra o container (missão → resolved/failure, busca/retorno → removido).
 */
export function killFlyingContainer(s: GameState, id: string): void {
  // Missão voadora
  const mission = s.missions.find(
    (m) => m.teamIds.includes(id) && (m.status === 'traveling' || m.status === 'returning'),
  )
  if (mission) {
    for (const memberId of mission.teamIds) {
      const mon = findMon(s, memberId)
      if (mon) {
        replaceMon(s, settleFaintTracked(s, { ...mon, currentHp: 0 }))
      }
    }
    mission.status = 'resolved'
    mission.result = 'failure'
    s.today.missionResults.push({ templateId: mission.templateId, success: false, teamIds: mission.teamIds })
    return
  }
  // Busca de captura voadora
  const search = s.captureSearches.find((c) => c.searcherId === id && c.phase === 'traveling')
  if (search) {
    const mon = findMon(s, search.searcherId)
    if (mon) replaceMon(s, settleFaintTracked(s, { ...mon, currentHp: 0 }))
    s.captureSearches = s.captureSearches.filter((c) => c !== search)
    return
  }
  // Retorno de captura voador
  const ret = s.captureReturns.find((r) => r.searcherId === id)
  if (ret) {
    const mon = findMon(s, ret.searcherId)
    if (mon) replaceMon(s, settleFaintTracked(s, { ...mon, currentHp: 0 }))
    s.captureReturns = s.captureReturns.filter((r) => r !== ret)
  }
}
