// Aplicação dos raios da Tempestade no runtime (PLAN §clima): a geometria/horário são puros
// (engine/storm), mas QUEM é atingido depende da posição dos Pokémon — então a detecção de
// acerto e a aplicação de dano/Paralyze acontecem no tick do dia, como o dano de missão.

import type { MapPos } from '../types/index.ts'
import type { GameState } from '../engine/state.ts'
import { pointInCircle, strikesResolvingBetween } from '../engine/storm.ts'
import { travelerPositionsAt } from '../engine/travelerPositions.ts'
import { STRIKE_DAMAGE, PARALYZE_STUN_MS } from '../engine/balance.ts'
import { hasLightningRod, hasVoltAbsorb } from '../engine/secretEffects.ts'
import { secretLevelOf } from '../data/secretAbilities.ts'
import { findMon, replaceMon, settleFaintTracked } from './runtime.ts'
import { shiftMissionTimestamps } from './missionFlow.ts'

/**
 * Marca o Pokémon como paralisado em batalha (idempotente) e desconta 1 de HP.
 * Separado do freeze do container para que múltiplos membros do mesmo time
 * recebam o efeito individual sem duplicar o congelamento da missão.
 */
function markBattleParalyzed(s: GameState, id: string): void {
  if (!s.today.paralyzedBattleIds.includes(id)) s.today.paralyzedBattleIds.push(id)
}

/**
 * Congela o CONTAINER (missão / captureSearch / captureReturn) que transporta `id` por
 * PARALYZE_STUN_MS, deslocando a janela da perna em curso. Chamado UM ÚNICO VEZ por strike
 * por container — o controle de deduplicação fica em `processStorms` (Set frozenContainers).
 * Reaplicar em strikes POSTERIORES estende o congelamento (comportamento cross-strike preservado).
 * `pos` é a posição do Pokémon no instante do impacto; `strikeAtMs` é o timestamp do raio.
 */
function freezeContainer(s: GameState, id: string, pos: MapPos, strikeAtMs: number): void {
  // Missão em trânsito (ida/volta) com este Pokémon no time.
  const mission = s.missions.find(
    (m) => m.teamIds.includes(id) && (m.status === 'traveling' || m.status === 'returning'),
  )
  if (mission) {
    const active = mission.paralyzeHold && strikeAtMs < mission.paralyzeHold.untilMs
    const untilMs = (active ? mission.paralyzeHold!.untilMs : strikeAtMs) + PARALYZE_STUN_MS
    mission.paralyzeHold = { pos: { ...pos }, untilMs }
    shiftMissionTimestamps(mission, mission.status === 'traveling' ? 'out' : 'back', PARALYZE_STUN_MS, true)
    return
  }
  // Procurador de captura a caminho.
  const search = s.captureSearches.find((c) => c.searcherId === id && c.phase === 'traveling')
  if (search) {
    const active = search.paralyzeHold && strikeAtMs < search.paralyzeHold.untilMs
    const untilMs = (active ? search.paralyzeHold!.untilMs : strikeAtMs) + PARALYZE_STUN_MS
    search.paralyzeHold = { pos: { ...pos }, untilMs }
    search.arriveAtMs += PARALYZE_STUN_MS
    search.readyAtMs += PARALYZE_STUN_MS
    search.departAtMs += PARALYZE_STUN_MS
    return
  }
  // Procurador voltando ao ginásio.
  const ret = s.captureReturns.find((r) => r.searcherId === id)
  if (ret) {
    const active = ret.paralyzeHold && strikeAtMs < ret.paralyzeHold.untilMs
    const untilMs = (active ? ret.paralyzeHold!.untilMs : strikeAtMs) + PARALYZE_STUN_MS
    ret.paralyzeHold = { pos: { ...pos }, untilMs }
    ret.arriveAtMs += PARALYZE_STUN_MS
    ret.departAtMs += PARALYZE_STUN_MS
  }
}

/**
 * Aplica o Paralyze a um Pokémon atingido: -50% de Batalha pelo resto do dia (idempotente) e
 * congela o sprite na posição do impacto por 5s, deslocando a janela da perna em curso (a missão
 * demora 5s a mais). Reaplicar estende o congelamento por mais 5s. `pos` é a posição já computada
 * na detecção de acerto. `frozenContainers` é o Set de IDs de containers já congelados NESTE
 * strike — garante no máximo +PARALYZE_STUN_MS por container por raio.
 */
export function applyParalyze(
  s: GameState,
  id: string,
  pos: MapPos,
  now: number,
  frozenContainers?: Set<string>,
): void {
  markBattleParalyzed(s, id)

  // Determina o ID do container que carrega este Pokémon para deduplificar o freeze.
  const mission = s.missions.find(
    (m) => m.teamIds.includes(id) && (m.status === 'traveling' || m.status === 'returning'),
  )
  if (mission) {
    if (!frozenContainers || !frozenContainers.has(mission.id)) {
      frozenContainers?.add(mission.id)
      freezeContainer(s, id, pos, now)
    }
    return
  }
  const search = s.captureSearches.find((c) => c.searcherId === id && c.phase === 'traveling')
  if (search) {
    const key = `cs:${search.searcherId}`
    if (!frozenContainers || !frozenContainers.has(key)) {
      frozenContainers?.add(key)
      freezeContainer(s, id, pos, now)
    }
    return
  }
  const ret = s.captureReturns.find((r) => r.searcherId === id)
  if (ret) {
    const key = `cr:${ret.searcherId}`
    if (!frozenContainers || !frozenContainers.has(key)) {
      frozenContainers?.add(key)
      freezeContainer(s, id, pos, now)
    }
  }
}

/**
 * Retorna os Pokémon no time que carrega `id` (pode ser apenas `id` sozinho em buscas de captura).
 * Usado para verificar Lightning Rod e para aplicar morte por Fly-raio.
 */
function containerTeamIds(s: GameState, id: string): string[] {
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

/**
 * Retorna true se o container que carrega `id` está voando (flying === true).
 */
function isInFlyingContainer(s: GameState, id: string): boolean {
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
function killFlyingContainer(s: GameState, id: string): void {
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

/**
 * Processa os raios cujo impacto cai em (prevMs, nowMs]: para cada Pokémon VISÍVEL no mapa dentro
 * de algum círculo, aplica os efeitos pela ordem de prioridade:
 * (1) Lightning Rod no time → imunidade total (pula dano/Paralyze/Electirizer).
 * (2) Volt Absorb no Pokémon atingido → absorção: eletriza o portador (buff de mov.+attr); sem dano.
 * (3) Voando (container.flying) → time fainted + missão/busca perdida.
 * (4) Normal: -1 HP + Paralyze + Electirizer.
 * Cada container é congelado no máximo uma vez por strike (frozenContainers).
 */
export function processStorms(s: GameState, prevMs: number, nowMs: number): void {
  if (s.weather.storms.length === 0) return
  for (const strike of strikesResolvingBetween(s.weather.storms, prevMs, nowMs)) {
    const positions = travelerPositionsAt(s, strike.strikeAtMs)
    const hit = new Set<string>()
    for (const { id, pos } of positions) {
      if (hit.has(id)) continue
      if (strike.circles.some((c) => pointInCircle(c, pos))) hit.add(id)
    }
    // frozenContainers: rastreia quais containers já foram congelados NESTE strike.
    const frozenContainers = new Set<string>()
    // killedContainers: rastreia quais containers já foram mortos NESTE strike (evita dupla-morte
    // se dois membros do mesmo time flying forem atingidos no mesmo raio).
    const killedContainers = new Set<string>()
    for (const id of hit) {
      const mon = findMon(s, id)
      if (!mon) continue
      const pos = positions.find((t) => t.id === id)!.pos

      // (1) Lightning Rod: se QUALQUER membro do time do container tem Lightning Rod → imunidade total.
      const teamIds = containerTeamIds(s, id)
      const teamMons = teamIds.map((tid) => findMon(s, tid)).filter((p) => p !== undefined)
      if (teamMons.some(hasLightningRod)) continue

      // (2) Volt Absorb: o Pokémon atingido absorve o raio → eletrizado, sem dano/Paralyze.
      if (hasVoltAbsorb(mon)) {
        const lvl = secretLevelOf(mon, 'sa-volt-absorb') as 1 | 2
        ;(s.today.electrified ??= {})[id] = lvl
        continue
      }

      // (3) Fly-raio: container está voando → time fainted + missão/busca perdida.
      if (isInFlyingContainer(s, id)) {
        // Chave do container para deduplicação (usa o id do membro principal/único).
        const containerKey = teamIds[0] ?? id
        if (!killedContainers.has(containerKey)) {
          killedContainers.add(containerKey)
          killFlyingContainer(s, id)
        }
        continue
      }

      // (4) Normal: -1 HP (sem virar fainted aqui — settle normal cuida), Paralyze, Electirizer.
      replaceMon(s, { ...mon, currentHp: Math.max(0, mon.currentHp - STRIKE_DAMAGE) })
      applyParalyze(s, id, pos, strike.strikeAtMs, frozenContainers)
      // Electirizer: cada raio sofrido vira +1 carga de bônus para a PRÓXIMA missão deste Pokémon.
      if (s.runItems.includes('electirizer')) {
        const charges = (s.electirizerCharges ??= {})
        charges[id] = (charges[id] ?? 0) + 1
      }
    }
  }
}
