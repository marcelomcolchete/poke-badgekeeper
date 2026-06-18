// Acumulador vitalício da run: dobra o tally de um dia em LifetimeStats (PLAN — fim de jogo).
// Puro e determinístico. O GameState guarda só os dias FECHADOS; a tela de fim de jogo soma o
// dia em curso na exibição (combineLifetime) para não duplicar nem perder o último dia parcial.

import type { DayTally, EnemyRef, LifetimeStats } from './state.ts'

/** Quantos inimigos mais fortes o relatório guarda ("Pokémons enfrentados"). */
const TOP_ENEMIES = 3

/**
 * Dobra um dia (DayTally) no acumulador vitalício, devolvendo um NOVO objeto (não muta as entradas).
 * Usado tanto para gravar os dias fechados (startNextDay) quanto para combinar o dia em curso na
 * exibição (combineLifetime) — a operação é a mesma soma.
 */
export function foldDayIntoLifetime(life: LifetimeStats, today: DayTally): LifetimeStats {
  const missionsCompleted = today.missionResults.filter((r) => r.success).length
  const defeats = today.defenseKills.length

  // Feitos por Pokémon: missões bem-sucedidas (cada participante) + derrotas em batalha.
  const usage: LifetimeStats['usage'] = { ...life.usage }
  const bump = (id: string, key: 'missions' | 'defeats'): void => {
    const prev = usage[id] ?? { missions: 0, defeats: 0 }
    usage[id] = { ...prev, [key]: prev[key] + 1 }
  }
  for (const r of today.missionResults) {
    if (!r.success) continue
    for (const id of r.teamIds) bump(id, 'missions')
  }
  for (const k of today.defenseKills) bump(k.defeaterId, 'defeats')

  // Itens comprados (contagem por id).
  const purchasedItems: Record<string, number> = { ...life.purchasedItems }
  for (const id of today.purchasedItems) purchasedItems[id] = (purchasedItems[id] ?? 0) + 1

  // Top inimigos derrotados (maior poder de Batalha) — só kills com poder registrado; mantém os 3 maiores.
  const enemyCandidates: EnemyRef[] = [...life.strongestEnemies]
  for (const k of today.defenseKills) {
    if (k.enemyBattle == null) continue
    enemyCandidates.push({
      battle: k.enemyBattle,
      medal: k.enemyMedal,
      types: k.enemyTypes ?? [],
      speciesId: k.speciesId,
    })
  }
  const strongestEnemies = enemyCandidates.sort((a, b) => b.battle - a.battle).slice(0, TOP_ENEMIES)

  // Carrasco: espécies inimigas que venceram seus duelos, somadas por espécie na ordem de 1ª aparição.
  const defeatedBy = life.defeatedBy.map((e) => ({ ...e }))
  for (const l of today.defenseLosses) {
    if (l.speciesId == null) continue
    const existing = defeatedBy.find((e) => e.speciesId === l.speciesId)
    if (existing) existing.count += 1
    else defeatedBy.push({ speciesId: l.speciesId, types: l.enemyTypes ?? [], count: 1 })
  }

  return {
    missionsCompleted: life.missionsCompleted + missionsCompleted,
    missionsTotal: life.missionsTotal + today.missionResults.length,
    defensesWon: life.defensesWon + today.defensesWon,
    defensesTotal: life.defensesTotal + today.defensesTotal,
    goldEarned: life.goldEarned + today.goldEarned,
    faints: life.faints + today.faints,
    defeats: life.defeats + defeats,
    purchasedItems,
    usage,
    strongestEnemies,
    defeatedBy,
  }
}

/**
 * Combina o acumulador (dias fechados) com o dia em curso para exibição na tela de fim de jogo.
 * É a mesma soma de foldDayIntoLifetime: o dia corrente nunca foi dobrado no estado, então somá-lo
 * aqui dá o total da run (cobre tanto a vitória do dia 10 quanto a derrota no meio de um dia).
 */
export function combineLifetime(life: LifetimeStats, today: DayTally): LifetimeStats {
  return foldDayIntoLifetime(life, today)
}
