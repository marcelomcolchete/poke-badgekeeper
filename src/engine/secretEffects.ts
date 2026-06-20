// Efeitos das Habilidades Secretas — ponto único da engine. Cada efeito é amarrado pelo id da
// habilidade e só vale se ela estiver DESBLOQUEADA no indivíduo (data/secretAbilities.ts →
// hasSecret, derivado de pokemon.secretCount + a linha). Um Pokémon pode ter até três ativas ao
// mesmo tempo, e os efeitos se acumulam. Funções puras; o estado diário (flags) vem do
// `SecretRuntime` por Pokémon (s.today.secretRuntime), atualizado pelos fluxos.

import type { Attrs, AttrKey, Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { SecretRuntime } from './state.ts'
import { hasSecret } from '../data/secretAbilities.ts'
import { TEAM_ATTR_MAX } from './constants.ts'
import {
  ANALYTIC_PATROL_MULT,
  ANALYTIC_STUDY_MULT,
  BATTLE_ARMOR_MISSION_MULT,
  ELECTIRIZER_MISSION_BONUS,
  EXPLOSION_SELF_DAMAGE_FRACTION,
  FLY_SPEED_BONUS,
  HUSTLE_BATTLE_BONUS,
  HUSTLE_MISSION_MULT,
  RIVALRY_ATTR_PER_ALLY,
  RIVALRY_BATTLE_BONUS,
  ROCK_HEAD_ESCORT_MULT,
  ROCK_HEAD_STUDY_MULT,
  QUICK_FEET_SPEED_BONUS,
  ROLLOUT_BATTLE_BONUS,
  SHELL_ARMOR_DAMAGE,
  TORRENT_MISSION_MULT,
  WEAK_ARMOR_DAMAGE_MULT,
  WEAK_ARMOR_SPEED_PER_MISSING_HP,
} from './balance.ts'
import { effectiveAttr, mapAttrs } from './attributes.ts'
import { itemMissionMultiplier, itemTravelSpeedMultiplier } from './itemEffects.ts'
import { isRaining, type WeatherSchedule } from './weather.ts'

export type SecretRuntimeMap = Record<string, SecretRuntime>

// ---- Predicados por habilidade (cada um independente; o Pokémon pode ter várias) ----

export function hasWeakArmor(p: Pokemon): boolean {
  return hasSecret(p, 'sa-weak-armor')
}
export function hasSturdy(p: Pokemon): boolean {
  return hasSecret(p, 'sa-sturdy')
}
export function hasBattleArmor(p: Pokemon): boolean {
  return hasSecret(p, 'sa-battle-armor')
}
export function hasDig(p: Pokemon): boolean {
  return hasSecret(p, 'sa-dig')
}
export function hasDigPlus(p: Pokemon): boolean {
  return hasSecret(p, 'sa-dig-plus')
}
export function hasShellArmor(p: Pokemon): boolean {
  return hasSecret(p, 'sa-shell-armor')
}
export function hasRollout(p: Pokemon): boolean {
  return hasSecret(p, 'sa-rollout')
}
export function hasRivalry(p: Pokemon): boolean {
  return hasSecret(p, 'sa-rivalry')
}
export function hasHustle(p: Pokemon): boolean {
  return hasSecret(p, 'sa-hustle')
}
export function hasExplosion(p: Pokemon): boolean {
  return hasSecret(p, 'sa-explosion')
}
export function hasLightningRod(p: Pokemon): boolean {
  return hasSecret(p, 'sa-lightning-rod')
}
export function hasReckless(p: Pokemon): boolean {
  return hasSecret(p, 'sa-reckless')
}
export function hasSandRush(p: Pokemon): boolean {
  return hasSecret(p, 'sa-sand-rush')
}
export function hasSwiftSwim(p: Pokemon): boolean {
  return hasSecret(p, 'sa-swift-swim')
}
/** Algum Pokémon do time tem Swift Swim? (basta um para o time inteiro acelerar na chuva). */
export function teamHasSwiftSwim(team: readonly Pokemon[]): boolean {
  return team.some(hasSwiftSwim)
}
export function hasTorrent(p: Pokemon): boolean {
  return hasSecret(p, 'sa-torrent')
}
export function hasAnalytic(p: Pokemon): boolean {
  return hasSecret(p, 'sa-analytic')
}
export function hasClearBody(p: Pokemon): boolean {
  return hasSecret(p, 'sa-clear-body')
}
export function hasThickFat(p: Pokemon): boolean {
  return hasSecret(p, 'sa-thick-fat')
}
export function hasPressure(p: Pokemon): boolean {
  return hasSecret(p, 'sa-pressure')
}
export function hasStatic(p: Pokemon): boolean {
  return hasSecret(p, 'sa-static')
}
export function hasVitalSpirit(p: Pokemon): boolean {
  return hasSecret(p, 'sa-vital-spirit')
}
export function hasQuickFeet(p: Pokemon): boolean {
  return hasSecret(p, 'sa-quick-feet')
}
export function hasMoxie(p: Pokemon): boolean {
  return hasSecret(p, 'sa-moxie')
}
export function hasRegenerator(p: Pokemon): boolean {
  return hasSecret(p, 'sa-regenerator')
}
export function hasNaturalCure(p: Pokemon): boolean {
  return hasSecret(p, 'sa-natural-cure')
}
export function hasWaterAbsorb(p: Pokemon): boolean {
  return hasSecret(p, 'sa-water-absorb')
}
export function hasForewarn(p: Pokemon): boolean {
  return hasSecret(p, 'sa-forewarn')
}
export function hasCloudNine(p: Pokemon): boolean {
  return hasSecret(p, 'sa-cloud-nine')
}
export function hasSniper(p: Pokemon): boolean {
  return hasSecret(p, 'sa-sniper')
}
/** Surf (ou Surf+, que é upgrade): consegue se mover pela água. */
export function hasSurf(p: Pokemon): boolean {
  return hasSecret(p, 'sa-surf') || hasSecret(p, 'sa-surf-plus')
}

/** O Sturdy deste Pokémon ainda pode ser usado hoje? (1×/dia). */
export function sturdyAvailable(p: Pokemon, runtime: SecretRuntimeMap): boolean {
  return hasSturdy(p) && !runtime[p.id]?.sturdyUsed
}

// ---- Combate: bônus de Batalha por habilidade ----

/** Rollout: bônus de Batalha GANHO por cada Pokémon derrotado no duelo (0 sem a habilidade). */
export function rolloutBonusPerWin(p: Pokemon): number {
  return hasRollout(p) ? ROLLOUT_BATTLE_BONUS : 0
}

/** Rivalidade: bônus de Batalha contra um oponente do mesmo gênero (0 caso contrário). */
export function rivalryBattleBonus(p: Pokemon): number {
  return hasRivalry(p) ? RIVALRY_BATTLE_BONUS : 0
}

/** Hustle: bônus de Batalha em batalhas Pokémon (0 sem a habilidade). */
export function hustleBattleBonus(p: Pokemon): number {
  return hasHustle(p) ? HUSTLE_BATTLE_BONUS : 0
}

/** Explosion: dano que o portador inflige a SI ao explodir = metade da vida máxima (arred. p/ cima). */
export function explosionSelfDamage(p: Pokemon): number {
  return Math.ceil(p.maxHp * EXPLOSION_SELF_DAMAGE_FRACTION)
}

// ---- Missões: multiplicador de atributos por Pokémon (vantagem da passiva) ----

/** Contexto da missão usado pelos multiplicadores por Pokémon. */
export interface MissionSecretCtx {
  team: readonly Pokemon[]
  template: MissionTemplate
  runtime: SecretRuntimeMap
  /** Itens passivos da run (Eviolite/Lagging Tail…) — entram no multiplicador de atributos. */
  runItems: readonly string[]
  /** Electirizer: cargas de bônus por Pokémon (id → nº de raios) fixadas no despacho. */
  electirizerBonus?: Record<string, number>
}

/**
 * Multiplicador de TODOS os atributos deste Pokémon na missão (1 = sem efeito). Combina, de forma
 * MULTIPLICATIVA, todas as habilidades ativas do Pokémon: Rivalidade (+10% por aliado do mesmo
 * gênero), Rock Head (+ escolta / − ensino), Battle Armor (próxima missão após batalhar) e Hustle
 * (−10% em missões). Itens passivos (Eviolite/Lagging Tail) entram na base.
 */
export function missionAttrMultiplier(p: Pokemon, ctx: MissionSecretCtx): number {
  let mult = itemMissionMultiplier(p, ctx.runItems)
  if (hasRivalry(p)) {
    const allies = ctx.team.filter((o) => o.id !== p.id && o.gender === p.gender).length
    mult *= 1 + RIVALRY_ATTR_PER_ALLY * allies
  }
  if (hasSecret(p, 'sa-rock-head')) {
    if (ctx.template.id === 'escolta') mult *= ROCK_HEAD_ESCORT_MULT
    else if (ctx.template.id === 'ensino') mult *= ROCK_HEAD_STUDY_MULT
  }
  // Analytic: ganha em Ensino e perde em Patrulha (espelha o Rock Head em outros tipos).
  if (hasAnalytic(p)) {
    if (ctx.template.id === 'ensino') mult *= ANALYTIC_STUDY_MULT
    else if (ctx.template.id === 'patrulha') mult *= ANALYTIC_PATROL_MULT
  }
  // Torrent: +50% se há OUTRO aliado do tipo Água na missão.
  if (hasTorrent(p) && ctx.team.some((o) => o.id !== p.id && o.types.includes('water'))) {
    mult *= TORRENT_MISSION_MULT
  }
  if (hasBattleArmor(p) && ctx.runtime[p.id]?.battleArmorPending) mult *= BATTLE_ARMOR_MISSION_MULT
  if (hasHustle(p)) mult *= HUSTLE_MISSION_MULT
  // Clear Body (nível de time): nenhum membro recebe debuff de atributo (multiplicador < 1).
  if (mult < 1 && ctx.team.some(hasClearBody)) mult = 1
  // Electirizer: bônus positivo da "próxima missão" por raio sofrido (não anulado pelo Clear Body).
  const charges = ctx.electirizerBonus?.[p.id] ?? 0
  if (charges > 0) mult *= 1 + ELECTIRIZER_MISSION_BONUS * charges
  return mult
}

/** Algum Pokémon do time tem efeito de atributo ativo nesta missão? (radar indica a passiva). */
export function teamHasAttrBoost(ctx: MissionSecretCtx): boolean {
  return ctx.team.some((p) => missionAttrMultiplier(p, ctx) !== 1)
}

/** Soma do time num eixo COM os multiplicadores de habilidade, capada em TEAM_ATTR_MAX (100). */
export function teamSecretAxisSum(key: AttrKey, ctx: MissionSecretCtx): number {
  const total = ctx.team.reduce(
    (sum, p) => sum + effectiveAttr(p, key) * missionAttrMultiplier(p, ctx),
    0,
  )
  return Math.min(total, TEAM_ATTR_MAX)
}

/** Soma do time (todos os eixos) com os multiplicadores de habilidade — base do hexágono. */
export function teamSecretSum(ctx: MissionSecretCtx): Attrs {
  return mapAttrs((k) => teamSecretAxisSum(k, ctx))
}

// ---- Viagem: velocidade do time e voo ----

/** Este Pokémon é um voador? (passiva Fly do museu OU Aerodactyl com Fly/Fly+ desbloqueado). */
function isFlyer(p: Pokemon): boolean {
  return p.passives.includes('fly') || hasSecret(p, 'sa-fly') || hasSecret(p, 'sa-fly-plus')
}

/** O time tem um voador? */
export function teamHasFly(team: readonly Pokemon[]): boolean {
  return team.some(isFlyer)
}

/**
 * O time VOA nesta tarefa? Voa em linha reta do ginásio até o ponto (caminho bem menor). Por
 * padrão o voador precisa estar SOZINHO; com Fly+ (sa-fly-plus) o voo funciona com o time inteiro.
 */
export function teamFlies(team: readonly Pokemon[]): boolean {
  if (!teamHasFly(team)) return false
  return team.length === 1 || team.some((p) => hasSecret(p, 'sa-fly-plus'))
}

/** O time tem um surfista? (o item Surfboard dá surf a todo o time). */
export function teamHasSurf(team: readonly Pokemon[], runItems: readonly string[] = []): boolean {
  return runItems.includes('surfboard') || team.some(hasSurf)
}

/**
 * O time consegue SURFAR nesta tarefa (atravessar a água)? Por padrão o surfista precisa estar
 * SOZINHO; com Surf+ (sa-surf-plus) leva o time inteiro. Espelha a lógica de `teamFlies`/Fly+.
 * O item Surfboard (runItems) faz o time inteiro surfar, como o Surf+.
 */
export function teamSurfs(team: readonly Pokemon[], runItems: readonly string[] = []): boolean {
  if (runItems.includes('surfboard')) return true
  if (!teamHasSurf(team)) return false
  return team.length === 1 || team.some((p) => hasSecret(p, 'sa-surf-plus'))
}

/** O time atua do ginásio (Sniper, só sozinho)? Faz a missão sem viajar. */
export function teamSnipes(team: readonly Pokemon[]): boolean {
  return team.length === 1 && hasSniper(team[0] as Pokemon)
}

/** Quick Feet: +100% de velocidade de viagem, só quando despachado SOZINHO. */
export function teamHasQuickFeet(team: readonly Pokemon[]): boolean {
  return team.length === 1 && hasQuickFeet(team[0] as Pokemon)
}

/** O time tenta a missão de novo ao falhar (Vital Spirit em qualquer membro)? */
export function teamHasVitalSpirit(team: readonly Pokemon[]): boolean {
  return team.some(hasVitalSpirit)
}

/**
 * O time deve exibir a aura de "veloz" no mapa? Verdadeiro quando o multiplicador base já é >1
 * (Weak Armor/Fly/itens) OU quando há Swift Swim no time e está chovendo AGORA (efeito ao vivo).
 */
export function teamIsSpeedy(
  team: readonly Pokemon[],
  runItems: readonly string[],
  weather: WeatherSchedule,
  nowMs: number,
): boolean {
  return (
    teamTravelSpeedMultiplier(team, runItems) > 1 ||
    (teamHasSwiftSwim(team) && isRaining(weather, nowMs))
  )
}

/**
 * Multiplicador de VELOCIDADE do time na viagem (≥1 = mais rápido, <1 = mais lento):
 * Weak Armor (+20% por ponto de HP faltante de quem tem a habilidade), Fly (+ bônus ao voar) e o
 * item Lagging Tail (mais lento). O tempo de viagem é dividido por este valor.
 */
export function teamTravelSpeedMultiplier(
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
): number {
  let speed = 1
  for (const p of team) {
    if (hasWeakArmor(p)) {
      const missing = Math.max(0, p.maxHp - p.currentHp)
      speed += WEAK_ARMOR_SPEED_PER_MISSING_HP * missing
    }
  }
  if (teamFlies(team)) speed += FLY_SPEED_BONUS
  // Quick Feet: +100% de velocidade quando despachado sozinho.
  if (teamHasQuickFeet(team)) speed += QUICK_FEET_SPEED_BONUS
  // Lagging Tail: time mais lento nas viagens de missão (multiplicativo sobre a velocidade).
  speed *= itemTravelSpeedMultiplier(runItems)
  return Math.max(speed, 0.0001)
}

// ---- Combate: dano recebido ----

/**
 * Dano que este Pokémon REALMENTE recebe a partir de um dano bruto: Shell Armor reduz para 1
 * (qualquer dano vira 1), Weak Armor dobra. Shell Armor tem precedência se o Pokémon tiver ambos.
 * Vale tanto em batalhas quanto no dano de missões fracassadas.
 */
export function damageTaken(p: Pokemon, raw: number): number {
  if (raw <= 0) return 0
  if (hasShellArmor(p)) return SHELL_ARMOR_DAMAGE
  if (hasWeakArmor(p)) return raw * WEAK_ARMOR_DAMAGE_MULT
  return raw
}
