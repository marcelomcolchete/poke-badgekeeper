// Missão Equipe Rocket (PLAN — Rocket Team): cumprir a parte de atributos NÃO dá recompensa
// — o time entra em batalha; ouro-bônus + 3× XP só vêm ao VENCER; não despachar = derrota.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createMissionInstance } from '../engine/missions.ts'
import { goldForDefense } from '../engine/economy.ts'
import { zeroAttrs } from '../engine/attributes.ts'
import { createRng } from '../engine/rng.ts'
import { MISSION_XP_POOL, ROCKET_GOLD_BONUS, ROCKET_XP_MULTIPLIER } from '../engine/balance.ts'
import { STARTING_GOLD } from '../engine/constants.ts'
import { makeMon } from '../engine/testkit.ts'
import {
  completeRocketBattle,
  loseRunByRocket,
  resolveMissionNow,
  resolveRocketBattle,
} from './missionFlow.ts'
import type { GameState } from '../engine/state.ts'

/** Estado com 1 missão Rocket 'inProgress', time despachado e exigência trivial (sucesso certo). */
function rocketState(): GameState {
  const s = createInitialState(1)
  s.run.day = 5
  s.roster = [makeMon({ id: 'p1', status: 'onMission', baseAttrs: { ...zeroAttrs(), batalha: 50 } })]
  const mission = createMissionInstance({
    id: 'm1',
    rng: createRng(1),
    day: 5,
    category: 'rocket',
    node: 'd',
    spawnAtMs: 0,
    lifetimeMs: 40_000,
    templateId: 'rocket',
  })
  mission.teamIds = ['p1']
  mission.status = 'inProgress'
  mission.requirement = zeroAttrs() // exigência nula → P_sucesso = 1 (parte de atributos cumprida)
  s.missions = [mission]
  return s
}

describe('missão Equipe Rocket', () => {
  it('ao cumprir a parte de atributos entra em batalha (status "battle") sem recompensa ainda', () => {
    const s = rocketState()
    resolveMissionNow(s, s.missions[0]!)
    const m = s.missions[0]!
    expect(m.status).toBe('battle')
    expect(m.result).toBe('success')
    expect(m.rocket).toBeDefined()
    expect(m.rocket?.resolved).toBe(false)
    expect(['ROCKET_TEAM_MALE', 'ROCKET_TEAM_FEMALE']).toContain(m.rocket?.trainerId)
    expect(m.rocket?.enemies.length).toBeGreaterThan(0)
    // Nenhuma recompensa antes da batalha.
    expect(s.gold).toBe(STARTING_GOLD)
    expect(m.xpAwards).toBeUndefined()
  })

  it('resolver a batalha grava o log e a vitória; é idempotente', () => {
    const s = rocketState()
    resolveMissionNow(s, s.missions[0]!)
    resolveRocketBattle(s, 'm1')
    const m = s.missions[0]!
    expect(m.rocket?.resolved).toBe(true)
    expect(m.rocket?.duels).toBeDefined()
    expect(typeof m.rocket?.won).toBe('boolean')
    const seed = m.rocket?.xpSeed
    resolveRocketBattle(s, 'm1') // 2ª chamada não muta (idempotente)
    expect(m.rocket?.xpSeed).toBe(seed)
  })

  it('VITÓRIA: ouro-bônus + 3× o pool de XP; missão vira sucesso no relatório', () => {
    const s = rocketState()
    resolveMissionNow(s, s.missions[0]!)
    const m = s.missions[0]!
    // Força a vitória para checar as recompensas de forma determinística.
    m.rocket!.resolved = true
    m.rocket!.duels = []
    m.rocket!.won = true
    const goldBefore = s.gold
    const defenseGold = goldForDefense(s.roster) // ouro de batalha calculado antes do XP da vitória
    completeRocketBattle(s, 'm1')
    expect(m.status).toBe('resolved')
    expect(m.result).toBe('success')
    expect(m.xpAwards?.['p1']).toBe(MISSION_XP_POOL * ROCKET_XP_MULTIPLIER) // time de 1 leva o pool todo
    expect(s.gold).toBe(goldBefore + defenseGold + ROCKET_GOLD_BONUS)
    expect(s.today.missionResults.some((r) => r.success)).toBe(true)
  })

  it('DERROTA: sem ouro nem XP; missão vira falha no relatório', () => {
    const s = rocketState()
    resolveMissionNow(s, s.missions[0]!)
    const m = s.missions[0]!
    m.rocket!.resolved = true
    m.rocket!.duels = []
    m.rocket!.won = false
    const goldBefore = s.gold
    completeRocketBattle(s, 'm1')
    expect(m.status).toBe('resolved')
    expect(m.result).toBe('failure')
    expect(s.gold).toBe(goldBefore)
    expect(m.xpAwards).toBeUndefined()
  })

  it('não despachar ninguém para a missão Rocket encerra a run na hora', () => {
    const s = rocketState()
    loseRunByRocket(s)
    expect(s.run.phase).toBe('GAMEOVER')
    expect(s.run.gameOverReason).toBe('rocket')
    expect(s.clock.speed).toBe(0)
  })
})
