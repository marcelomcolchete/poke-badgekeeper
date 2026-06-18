import { describe, expect, it } from 'vitest'
import { emptyLifetime, emptyTally } from './state.ts'
import { combineLifetime, foldDayIntoLifetime } from './lifetime.ts'

/** Um dia preenchido (missões aceitas + uma ignorada, defesas, ouro, mortes, kills, compras). */
function dayA() {
  const t = emptyTally()
  t.missionResults = [
    { templateId: 'm', success: true, teamIds: ['a', 'b'] },
    { templateId: 'm', success: false, teamIds: [] }, // ignorada/expirada → conta no total
  ]
  t.defensesWon = 1
  t.defensesTotal = 2
  t.goldEarned = 300
  t.faints = 1
  t.purchasedItems = ['potion', 'potion', 'revive']
  t.defenseKills = [
    { defeaterId: 'a', speciesId: 19, enemyBattle: 40, enemyMedal: 'bronze', enemyTypes: ['normal'] },
    { defeaterId: 'b', speciesId: 16, enemyBattle: 55, enemyMedal: 'gold', enemyTypes: ['flying'] },
  ]
  t.defenseLosses = [
    { victimId: 'a', speciesId: 23, enemyBattle: 35, enemyTypes: ['poison'] }, // Ekans venceu 2×
    { victimId: 'b', speciesId: 23, enemyBattle: 35, enemyTypes: ['poison'] },
    { victimId: 'c', speciesId: 41, enemyBattle: 30, enemyTypes: ['poison', 'flying'] }, // Zubat 1×
  ]
  return t
}

describe('foldDayIntoLifetime', () => {
  it('soma missões (inclui ignoradas no total), defesas, ouro, mortes e derrotas', () => {
    const life = foldDayIntoLifetime(emptyLifetime(), dayA())
    expect(life.missionsCompleted).toBe(1)
    expect(life.missionsTotal).toBe(2)
    expect(life.defensesWon).toBe(1)
    expect(life.defensesTotal).toBe(2)
    expect(life.goldEarned).toBe(300)
    expect(life.faints).toBe(1)
    expect(life.defeats).toBe(2)
  })

  it('conta itens comprados por id', () => {
    const life = foldDayIntoLifetime(emptyLifetime(), dayA())
    expect(life.purchasedItems).toEqual({ potion: 2, revive: 1 })
  })

  it('acumula feitos por Pokémon (missões + derrotas)', () => {
    const life = foldDayIntoLifetime(emptyLifetime(), dayA())
    expect(life.usage.a).toEqual({ missions: 1, defeats: 1 })
    expect(life.usage.b).toEqual({ missions: 1, defeats: 1 })
  })

  it('guarda os 3 inimigos mais fortes derrotados (ordem decrescente de batalha)', () => {
    const life = foldDayIntoLifetime(emptyLifetime(), dayA())
    expect(life.strongestEnemies.map((e) => e.battle)).toEqual([55, 40])
    expect(life.strongestEnemies[0]).toEqual({
      battle: 55,
      medal: 'gold',
      types: ['flying'],
      speciesId: 16,
    })
  })

  it('Carrasco: soma duelos perdidos por espécie inimiga (ordem de 1ª aparição)', () => {
    const life = foldDayIntoLifetime(emptyLifetime(), dayA())
    expect(life.defeatedBy).toEqual([
      { speciesId: 23, types: ['poison'], count: 2 },
      { speciesId: 41, types: ['poison', 'flying'], count: 1 },
    ])
  })

  it('é puro: não muta a entrada', () => {
    const base = emptyLifetime()
    foldDayIntoLifetime(base, dayA())
    expect(base.missionsTotal).toBe(0)
    expect(base.usage).toEqual({})
    expect(base.strongestEnemies).toEqual([])
    expect(base.defeatedBy).toEqual([])
  })

  it('acumula vários dias: mantém só os 3 mais fortes e soma o Carrasco', () => {
    const t2 = emptyTally()
    t2.missionResults = [{ templateId: 'm', success: true, teamIds: ['a'] }]
    t2.goldEarned = 100
    t2.defenseKills = [
      { defeaterId: 'a', speciesId: 1, enemyBattle: 30, enemyMedal: 'bronze', enemyTypes: ['rock'] },
      { defeaterId: 'a', speciesId: 2, enemyBattle: 60, enemyMedal: 'gold', enemyTypes: ['grass'] },
    ]
    t2.defenseLosses = [{ victimId: 'a', speciesId: 23, enemyBattle: 35, enemyTypes: ['poison'] }]
    let life = foldDayIntoLifetime(emptyLifetime(), dayA())
    life = foldDayIntoLifetime(life, t2)
    expect(life.missionsCompleted).toBe(2)
    expect(life.goldEarned).toBe(400)
    expect(life.usage.a).toEqual({ missions: 2, defeats: 3 })
    // 4 kills no total (40,55,30,60) → guarda os 3 maiores.
    expect(life.strongestEnemies.map((e) => e.battle)).toEqual([60, 55, 40])
    // Ekans (23) passa a 3 duelos vencidos contra você.
    expect(life.defeatedBy[0]).toEqual({ speciesId: 23, types: ['poison'], count: 3 })
  })
})

describe('combineLifetime', () => {
  it('é equivalente a um fold (soma o dia em curso)', () => {
    const life = emptyLifetime()
    expect(combineLifetime(life, dayA())).toEqual(foldDayIntoLifetime(life, dayA()))
  })
})
