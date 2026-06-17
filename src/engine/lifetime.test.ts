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

  it('guarda o inimigo mais forte derrotado (maior poder de batalha)', () => {
    const life = foldDayIntoLifetime(emptyLifetime(), dayA())
    expect(life.strongestEnemy).toEqual({
      battle: 55,
      medal: 'gold',
      types: ['flying'],
      speciesId: 16,
    })
  })

  it('é puro: não muta a entrada', () => {
    const base = emptyLifetime()
    foldDayIntoLifetime(base, dayA())
    expect(base.missionsTotal).toBe(0)
    expect(base.usage).toEqual({})
    expect(base.strongestEnemy).toBeNull()
  })

  it('acumula vários dias e mantém o inimigo mais forte global', () => {
    const t2 = emptyTally()
    t2.missionResults = [{ templateId: 'm', success: true, teamIds: ['a'] }]
    t2.goldEarned = 100
    t2.defenseKills = [
      { defeaterId: 'a', speciesId: 1, enemyBattle: 30, enemyMedal: 'bronze', enemyTypes: ['rock'] },
    ]
    let life = foldDayIntoLifetime(emptyLifetime(), dayA())
    life = foldDayIntoLifetime(life, t2)
    expect(life.missionsCompleted).toBe(2)
    expect(life.goldEarned).toBe(400)
    expect(life.usage.a).toEqual({ missions: 2, defeats: 2 })
    expect(life.strongestEnemy?.battle).toBe(55) // o do dia A continua sendo o mais forte
  })
})

describe('combineLifetime', () => {
  it('é equivalente a um fold (soma o dia em curso)', () => {
    const life = emptyLifetime()
    expect(combineLifetime(life, dayA())).toEqual(foldDayIntoLifetime(life, dayA()))
  })
})
