import { describe, expect, it } from 'vitest'
import { createInitialState, emptyLifetime } from './state.ts'
import { buildFinalReport } from './finalReport.ts'
import { makeMon } from './testkit.ts'

/** Estado no fim de jogo: dias fechados (lifetime) + o dia em curso (today, não dobrado). */
function gameState() {
  const s = createInitialState(1)
  s.run.cityIndex = 0
  s.roster = [
    makeMon({ id: 'a', speciesId: 134, hearts: 4, secretCount: 2 }), // 134 tem linha de Hab. Secreta
    makeMon({ id: 'b', speciesId: 4, hearts: 2 }),
  ]
  s.box = [makeMon({ id: 'c', speciesId: 7, hearts: 3 })]
  s.approval = { missionStars: 4, battleStars: 3, dailyGoalMet: true }
  s.lifetime = {
    ...emptyLifetime(),
    missionsCompleted: 40,
    missionsTotal: 90,
    defensesWon: 8,
    defensesTotal: 10,
    goldEarned: 5000,
    faints: 3,
    defeats: 20,
    purchasedItems: { potion: 3, 'great-ball': 1, 'exp-share': 1 },
    usage: { a: { missions: 30, defeats: 10 }, b: { missions: 5, defeats: 2 } },
    strongestEnemy: { battle: 60, medal: 'gold', types: ['dragon'], speciesId: 149 },
  }
  s.today.missionResults = [
    { templateId: 'm', success: true, teamIds: ['a'] },
    { templateId: 'm', success: false, teamIds: [] },
  ]
  s.today.defensesWon = 1
  s.today.defensesTotal = 1
  s.today.goldEarned = 200
  s.today.faints = 1
  s.today.purchasedItems = ['revive']
  s.today.defenseKills = [
    { defeaterId: 'a', speciesId: 16, enemyBattle: 70, enemyMedal: 'gold', enemyTypes: ['flying'] },
  ]
  return s
}

describe('buildFinalReport', () => {
  it('combina dias fechados (lifetime) com o dia em curso (today)', () => {
    const r = buildFinalReport(gameState(), 'win')
    expect(r.missionsCompleted).toBe(41)
    expect(r.missionsTotal).toBe(92)
    expect(r.defensesWon).toBe(9)
    expect(r.defensesTotal).toBe(11)
    expect(r.goldEarned).toBe(5200)
    expect(r.faints).toBe(4)
    expect(r.defeats).toBe(21)
  })

  it('média de coração considera só o time final (roster)', () => {
    const r = buildFinalReport(gameState(), 'win')
    expect(r.avgHearts).toBe(3) // (4 + 2) / 2
  })

  it('capturados = time ∪ PC, cada um com rank', () => {
    const r = buildFinalReport(gameState(), 'win')
    expect(r.capturedCount).toBe(3)
    expect(r.captured.map((c) => c.pokemon.id).sort()).toEqual(['a', 'b', 'c'])
    expect(r.captured.every((c) => typeof c.rank === 'string')).toBe(true)
  })

  it('mais forte enfrentado = maior poder entre lifetime e today', () => {
    const r = buildFinalReport(gameState(), 'win')
    expect(r.strongestEnemy?.battle).toBe(70) // today (70) supera lifetime (60)
  })

  it('destaque do jogo = mais feitos acumulados, com medalha da Habilidade Secreta', () => {
    const r = buildFinalReport(gameState(), 'win')
    expect(r.mvp?.pokemon.id).toBe('a')
    expect(r.mvp?.missions).toBe(31)
    expect(r.mvp?.defeats).toBe(11)
    expect(r.mvp?.medalIndex).toBe(2)
  })

  it('itens comprados acumulam lifetime + today', () => {
    const r = buildFinalReport(gameState(), 'win')
    const byId = Object.fromEntries(r.purchasedItems.map((p) => [p.id, p.count]))
    expect(byId).toEqual({ potion: 3, revive: 1, 'great-ball': 1, 'exp-share': 1 })
  })

  it('resolve bolas (catálogo BALLS) e categoriza as compras', () => {
    const r = buildFinalReport(gameState(), 'win')
    const cat = Object.fromEntries(r.purchasedItems.map((p) => [p.id, p.category]))
    expect(cat).toEqual({
      potion: 'healing',
      revive: 'healing',
      'great-ball': 'ball',
      'exp-share': 'other',
    })
    // A bola evolutiva (great-ball vive em balls.ts, fora de ITEMS) é resolvida com nome/sprite.
    const ball = r.purchasedItems.find((p) => p.id === 'great-ball')
    expect(ball?.name).toBe('Great Ball')
    expect(ball?.sprite).toContain('great-ball')
  })

  it('ignora ids de compra desconhecidos (saves antigos)', () => {
    const s = gameState()
    s.lifetime = { ...s.lifetime, purchasedItems: { potion: 1, 'item-removido': 2 } }
    s.today.purchasedItems = []
    const r = buildFinalReport(s, 'win')
    expect(r.purchasedItems.map((p) => p.id)).toEqual(['potion'])
  })

  it('vitória oferece a próxima cidade; última cidade não', () => {
    expect(buildFinalReport(gameState(), 'win').nextCityIndex).toBe(1)
    const last = gameState()
    last.run.cityIndex = 7
    expect(buildFinalReport(last, 'win').nextCityIndex).toBeNull()
  })

  it('expõe estrelas, média e efetivação', () => {
    const r = buildFinalReport(gameState(), 'win')
    expect(r.missionStars).toBe(4)
    expect(r.battleStars).toBe(3)
    expect(r.avgStars).toBe(3.5)
    expect(r.hired).toBe(true)
  })
})
