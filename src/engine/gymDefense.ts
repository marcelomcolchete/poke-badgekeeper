// Defesa de ginásio: cadeia de duelos 1v1 só com Batalha, com buff/debuff de tipo
// (PLAN §4.4). A tabela de tipos (data/typeChart) serve apenas para classificar
// vantagem/desvantagem; o efeito é ×1,5 por vantagem e ×0,5 por desvantagem.

import type { EnemyUnit, Pokemon, PokemonType } from '../types/index.ts'
import type { Rng } from './rng.ts'

export type { EnemyUnit }
import { singleTypeMultiplier } from '../data/typeChart.ts'
import { allSpecies, getSpecies } from '../data/pokemon/index.ts'
import type { TrainerDef } from '../data/trainers.ts'
import {
  ATTR_EFFECTIVE_MIN,
  ATTR_MAX,
  DEFENSE_SQUAD_BY_DAY,
  HP_LOSS_PER_DEFENSE_LOSS,
  IV_MAX,
  IV_MIN,
  MIN_DEFENSE_SQUAD,
  TOTAL_DAYS,
  TYPE_ADVANTAGE_MULT,
  TYPE_DISADVANTAGE_MULT,
} from './constants.ts'
import { DEFENSE_BUFF_BATTLE, GYM_XP_CAP_PER_WIN, GYM_XP_PER_BATTLE_POWER } from './balance.ts'
import { applyDamage, effectiveAttr } from './attributes.ts'
import {
  combatDamageMultiplier,
  hasSturdy,
  rivalryBattleBonus,
  rolloutBonusPerWin,
  sturdyHealsFull,
} from './secretEffects.ts'
import { itemBattleMultiplier } from './itemEffects.ts'
import { attrRank, type Rank } from './ranking.ts'
import { rollGender } from './gender.ts'
import { clamp } from './math.ts'

/**
 * Nota (E–S) de um desafiante na batalha: quanto a Batalha foge da base da espécie (mesma
 * escala dos IVs do jogador). O destaque (+15) estoura a faixa e cai naturalmente em 'S'.
 */
export function enemyRank(enemy: EnemyUnit): Rank {
  if (enemy.speciesId === undefined) return attrRank(0)
  return attrRank(enemy.battle - getSpecies(enemy.speciesId).baseAttrs.batalha)
}

/** ≥1 Pokémon disponível para abrir uma defesa (PLAN §4.4). */
export function canDefend(squad: readonly Pokemon[]): boolean {
  return squad.length >= MIN_DEFENSE_SQUAD
}

/**
 * Multiplicador de tipo na defesa: ×1,5 por par com vantagem, ×0,5 por par com
 * desvantagem (inclui imunidades canônicas, tratadas como desvantagem) — PLAN §4.4.
 */
export function typeAdvantageMultiplier(
  attackerTypes: readonly PokemonType[],
  defenderTypes: readonly PokemonType[],
): number {
  let multiplier = 1
  for (const attacker of attackerTypes) {
    for (const defender of defenderTypes) {
      const canonical = singleTypeMultiplier(attacker, defender)
      if (canonical > 1) multiplier *= TYPE_ADVANTAGE_MULT
      else if (canonical < 1) multiplier *= TYPE_DISADVANTAGE_MULT
    }
  }
  return multiplier
}

/** Batalha efetiva = Batalha · multiplicador de tipo contra os tipos do oponente. */
export function effectiveBattle(attacker: Pokemon, defenderTypes: readonly PokemonType[]): number {
  return effectiveAttr(attacker, 'batalha') * typeAdvantageMultiplier(attacker.types, defenderTypes)
}

/** P(vitória) = clamp(suaBatalhaEf / batalhaEf_oponente, 0, 1) — PLAN §4.4. */
export function duelWinProbability(attackerBattleEff: number, defenderBattleEff: number): number {
  if (defenderBattleEff <= 0) return 1
  return clamp(attackerBattleEff / defenderBattleEff, 0, 1)
}

/**
 * XP por duelo vencido = 0,5 × poder de Batalha do desafiante derrotado, com teto de 30
 * (§4.4, ajuste). Recompensa derrubar inimigos mais fortes; desafiantes fracos rendem pouco.
 */
export function gymWinXp(enemyBattle: number): number {
  return Math.min(GYM_XP_CAP_PER_WIN, Math.round(GYM_XP_PER_BATTLE_POWER * enemyBattle))
}

/**
 * Tamanho do esquadrão invasor por dia (PLAN §4.4): tabela fixa DEFENSE_SQUAD_BY_DAY —
 * 1 (dia 1) crescendo até 6 (dias 9–10). A dificuldade do dia vem daqui (e da quantidade),
 * não da força por Pokémon. Determinístico: depende só do dia.
 */
export function enemySquadSizeForDay(day: number): number {
  const clampedDay = clamp(Math.round(day), 1, TOTAL_DAYS)
  return DEFENSE_SQUAD_BY_DAY[clampedDay] ?? 1
}

/** Espécie lendária? (raridade 'legend' — Articuno/Zapdos/Moltres/Mewtwo/Mew.) */
function isLegendary(speciesId: number): boolean {
  return getSpecies(speciesId).rarity === 'legend'
}

/**
 * Espécies (ids) que um treinador traz numa defesa de `size` Pokémon (PLAN §4.4):
 *  - `roster`: sorteia COM repetição da lista fixa da classe.
 *  - `rival`:  líder fixo na frente + o resto totalmente aleatório, com NO MÁX. 1 lendário.
 */
export function trainerSquadSpecies(rng: Rng, trainer: TrainerDef, size: number): number[] {
  if (trainer.pool.kind === 'roster') {
    const pool = trainer.pool.speciesIds
    return Array.from({ length: size }, () => rng.pick(pool))
  }
  const ids: number[] = [trainer.pool.lead]
  let legendaryUsed = isLegendary(trainer.pool.lead)
  const all = allSpecies()
  while (ids.length < size) {
    const pool = legendaryUsed ? all.filter((s) => s.rarity !== 'legend') : all
    const species = rng.pick(pool)
    ids.push(species.id)
    if (species.rarity === 'legend') legendaryUsed = true
  }
  return ids.slice(0, size)
}

/**
 * Inimigos efêmeros da defesa a partir do elenco de um treinador (PLAN §4.4). Cada invasor
 * tem o SEU poder de Batalha: a Batalha-base da espécie ±10 (E..S, como os IVs do jogador) —
 * então dois invasores da mesma espécie ainda diferem. Sem escala por dia: o dia controla
 * só QUANTOS Pokémon o treinador traz (enemySquadSizeForDay). Um desafiante (sorteado) sai
 * em DESTAQUE: ganha +15 de Batalha e exibe medalha na batalha (PLAN — destaque do desafiante).
 */
export function generateDefenseEnemies(rng: Rng, trainer: TrainerDef, size: number): EnemyUnit[] {
  const enemies = trainerSquadSpecies(rng, trainer, size).map((speciesId) => {
    const species = getSpecies(speciesId)
    const battle = clamp(
      species.baseAttrs.batalha + rng.int(IV_MIN, IV_MAX),
      ATTR_EFFECTIVE_MIN,
      ATTR_MAX,
    )
    const gender = rollGender(rng, speciesId)
    return { battle, types: [...species.types], speciesId, gender } as EnemyUnit
  })
  // Destaque: um desafiante recebe +15 de Batalha e a medalha (sobe acima do teto normal).
  if (enemies.length > 0) {
    const buffed = enemies[rng.int(0, enemies.length - 1)] as EnemyUnit
    buffed.battle += DEFENSE_BUFF_BATTLE
    buffed.buffed = true
  }
  return enemies
}

export interface DuelLog {
  yourId: string
  youWon: boolean
  pWin: number
}

export interface DefenseResolution {
  won: boolean
  /** Esquadrão com HP atualizado: quem PERDE um duelo perde o dano do dia e sai (PLAN §4.4). */
  squad: Pokemon[]
  duels: DuelLog[]
  /** Pokémon que usaram o Sturdy nesta batalha (não desmaiaram) — consome o 1×/dia. */
  sturdyUsedIds: string[]
}

export interface ResolveDefenseOpts {
  /** Pokémon (ids) que ainda têm o Sturdy disponível hoje (consome ao usar, 1×/dia). */
  sturdyAvailableIds?: ReadonlySet<string>
  /** Itens passivos da run (Thick Club/Lagging Tail) — entram na Batalha efetiva do seu lado. */
  runItems?: readonly string[]
  /** HP perdido por duelo perdido — o dano do dia (1..4). Omitir = 1 (HP_LOSS_PER_DEFENSE_LOSS). */
  damagePerLoss?: number
}

/**
 * Cadeia de duelos 1v1: a frente de cada lado se enfrenta; o perdedor perde 1 HP e
 * sai (entra o próximo). Acaba quando um lado fica sem Pokémon. Você vence se zerar
 * o adversário antes do seu (PLAN §4.4). Habilidades Secretas no combate:
 *  - Weak Armor dobra o dano recebido; Shell Armor anula (×0).
 *  - Sturdy impede o desmaio (1× no escopo do nível), deixando 1 de vida — ou TODA a vida no Ouro.
 *  - Rollout: cada vitória SEGUIDA do mesmo lutador soma bônus de Batalha no duelo seguinte.
 *  - Rivalidade (nv2+): bônus de Batalha contra oponente do mesmo gênero.
 */
export function resolveDefense(
  rng: Rng,
  squad: readonly Pokemon[],
  enemies: readonly EnemyUnit[],
  opts: ResolveDefenseOpts = {},
): DefenseResolution {
  const result = squad.map((p) => ({ ...p }))
  const runItems = opts.runItems ?? []
  const damagePerLoss = opts.damagePerLoss ?? HP_LOSS_PER_DEFENSE_LOSS
  const duels: DuelLog[] = []
  const sturdyUsed = new Set<string>()
  let yours = 0
  let theirs = 0
  let frontWins = 0 // vitórias seguidas do lutador da frente (Rollout)
  while (yours < result.length && theirs < enemies.length) {
    const you = result[yours] as Pokemon
    const enemy = enemies[theirs] as EnemyUnit
    let yourEff = effectiveBattle(you, enemy.types)
    // Itens passivos (Thick Club p/ Ground, Lagging Tail p/ todos) na Batalha do seu lado.
    yourEff *= itemBattleMultiplier(you, runItems)
    // Rollout: bônus acumulado pelas vitórias seguidas deste mesmo lutador.
    yourEff *= 1 + rolloutBonusPerWin(you) * frontWins
    // Rivalidade (nv2+): vantagem contra oponente do mesmo gênero.
    if (enemy.gender !== undefined && enemy.gender === you.gender) {
      yourEff *= 1 + rivalryBattleBonus(you)
    }
    const enemyEff = enemy.battle * typeAdvantageMultiplier(enemy.types, you.types)
    const pWin = duelWinProbability(yourEff, enemyEff)
    const youWon = rng.bool(pWin)
    duels.push({ yourId: you.id, youWon, pWin })
    if (youWon) {
      theirs += 1 // o inimigo perde e sai; você permanece na frente
      frontWins += 1
    } else {
      const loss = damagePerLoss * combatDamageMultiplier(you)
      const wouldFaint = you.currentHp - loss <= 0
      const canSturdy =
        wouldFaint &&
        hasSturdy(you) &&
        !sturdyUsed.has(you.id) &&
        (opts.sturdyAvailableIds?.has(you.id) ?? false)
      if (canSturdy) {
        // Não desmaia: fica com 1 de vida (ou TODA a vida no Ouro).
        result[yours] = { ...you, currentHp: sturdyHealsFull(you) ? you.maxHp : 1, status: 'idle' }
        sturdyUsed.add(you.id)
      } else {
        result[yours] = applyDamage(you, loss)
      }
      yours += 1
      frontWins = 0 // novo lutador na frente: zera a sequência do Rollout
    }
  }
  return { won: theirs >= enemies.length, squad: result, duels, sturdyUsedIds: [...sturdyUsed] }
}
