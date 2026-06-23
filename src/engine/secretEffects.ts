// Efeitos das Habilidades Secretas — ponto único da engine. Cada efeito é amarrado pelo id da
// habilidade e só vale se ela estiver DESBLOQUEADA no indivíduo (data/secretAbilities.ts →
// hasSecret/secretLevelOf, derivado de pokemon.secretPicks + a linha). Um Pokémon pode ter até duas
// ativas ao mesmo tempo (cada uma nível 1 ou 2), e os efeitos se acumulam. Funções puras; o estado
// diário (flags) vem do
// `SecretRuntime` por Pokémon (s.today.secretRuntime), atualizado pelos fluxos.

import { ATTR_KEYS } from '../types/index.ts'
import type { Attrs, AttrKey, Pokemon } from '../types/index.ts'
import type { MissionTemplate } from '../data/types.ts'
import type { Rng } from './rng.ts'
import type { SecretRuntime } from './state.ts'
import { hasSecret, secretLevelOf } from '../data/secretAbilities.ts'
import { TEAM_ATTR_MAX } from './constants.ts'
import {
  ANALYTIC_PATROL_MULT_L1,
  ANALYTIC_PATROL_MULT_L2,
  ANALYTIC_STUDY_MULT_L1,
  ANALYTIC_STUDY_MULT_L2,
  BATTLE_ARMOR_MISSION_MULT_L1,
  BATTLE_ARMOR_MISSION_MULT_L2,
  CHLOROPHYLL_HEAT_BONUS_L1,
  CHLOROPHYLL_HEAT_BONUS_L2,
  DRY_SKIN_MISSION_BONUS_L2,
  ELECTIRIZER_MISSION_BONUS,
  EVIOLITE_MISSION_MULT,
  EXPLOSION_SELF_DAMAGE_FRACTION,
  FLY_SPEED_BONUS,
  HUSTLE_BATTLE_BONUS_L1,
  HUSTLE_BATTLE_BONUS_L2,
  HUSTLE_MISSION_MULT_L1,
  HUSTLE_MISSION_MULT_L2,
  LAGGING_TAIL_MISSION_MULT,
  LAGGING_TAIL_TRAVEL_MULT,
  RIVALRY_ATTR_PER_ALLY_L1,
  RIVALRY_ATTR_PER_ALLY_L2,
  RIVALRY_BATTLE_BONUS_L1,
  RIVALRY_BATTLE_BONUS_L2,
  ROCK_HEAD_ESCORT_MULT_L1,
  ROCK_HEAD_ESCORT_MULT_L2,
  ROCK_HEAD_STUDY_MULT_L1,
  ROCK_HEAD_STUDY_MULT_L2,
  QUICK_FEET_SPEED_BONUS,
  ROLLOUT_CAP_L1,
  ROLLOUT_CAP_L2,
  ROLLOUT_START_L1,
  ROLLOUT_START_L2,
  SHELL_ARMOR_DIVISOR_L1,
  SHELL_ARMOR_DIVISOR_L2,
  SWIFT_SWIM_MISSION_BONUS_L2,
  TORRENT_MISSION_MULT_L1,
  TORRENT_MISSION_MULT_L2,
  OVERGROW_MISSION_MULT_L1,
  OVERGROW_MISSION_MULT_L2,
  SWARM_MISSION_MULT_L1,
  SWARM_MISSION_MULT_L2,
  LEAF_GUARD_GYM_DAMAGE_DIVISOR,
  SPORE_ATTR_BONUS_FRACTION,
  SPORE_ATTRS_COUNT_L2,
  VOLT_ABSORB_BONUS_L1,
  VOLT_ABSORB_BONUS_L2,
  WATER_ABSORB_MISSION_MULT_L1,
  WATER_ABSORB_MISSION_MULT_L2,
  WEAK_ARMOR_SPEED_PER_MISSING_HP_L1,
  WEAK_ARMOR_SPEED_PER_MISSING_HP_L2,
} from './balance.ts'
import { applyDamage, effectiveAttr, mapAttrs } from './attributes.ts'
import { itemMissionMultiplier, itemTravelSpeedMultiplier, notFinalEvolution } from './itemEffects.ts'
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
  return secretLevelOf(p, 'sa-dig') === 2
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
export function hasVoltAbsorb(p: Pokemon): boolean {
  return hasSecret(p, 'sa-volt-absorb')
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
export function hasOvergrow(p: Pokemon): boolean {
  return hasSecret(p, 'sa-overgrow')
}
export function hasSwarm(p: Pokemon): boolean {
  return hasSecret(p, 'sa-swarm')
}

/**
 * Spore: incrementos de `dayBuffs` a aplicar no INÍCIO do dia. Sorteia 1 eixo (L1) ou 3 eixos
 * distintos (L2) e dá +round(SPORE_ATTR_BONUS_FRACTION × base) em cada. Mapa vazio sem a habilidade.
 * Puro; o `rng` deve ser determinístico (seed do dia) e o call site mescla em `p.dayBuffs`.
 */
export function sporeDayBuffs(p: Pokemon, rng: Rng): Partial<Record<AttrKey, number>> {
  const level = secretLevelOf(p, 'sa-spore')
  if (level < 1) return {}
  const count = level === 2 ? SPORE_ATTRS_COUNT_L2 : 1
  const axes = rng.shuffle(ATTR_KEYS).slice(0, count)
  const out: Partial<Record<AttrKey, number>> = {}
  for (const key of axes) out[key] = Math.round(SPORE_ATTR_BONUS_FRACTION * p.baseAttrs[key])
  return out
}
export function hasTintedLens(p: Pokemon): boolean {
  return hasSecret(p, 'sa-tinted-lens')
}
export function hasLeafGuard(p: Pokemon): boolean {
  return hasSecret(p, 'sa-leaf-guard')
}

/**
 * Id do portador de Leaf Guard que ABSORVE o dano do time: o de maior `currentHp` com nível
 * ≥ `minLevel`. Desempate estável: o primeiro na ordem do time. `null` se nenhum portador.
 * `minLevel` = 1 (missão, qualquer nível) ou 2 (defesa de ginásio, só L2).
 */
export function leafGuardAbsorberId(team: readonly Pokemon[], minLevel: 1 | 2 = 1): string | null {
  let best: Pokemon | null = null
  for (const p of team) {
    if (secretLevelOf(p, 'sa-leaf-guard') < minLevel) continue
    if (!best || p.currentHp > best.currentHp) best = p
  }
  return best?.id ?? null
}

/**
 * Leaf Guard L2 (defesa de ginásio): pós-processa o resultado da cadeia. Com um portador L2 no
 * esquadrão, cada aliado que perdeu vida é RESTAURADO ao HP pré-batalha e o absorvedor (portador
 * L2 de maior vida pré-batalha) toma `ceil(perda/2)` no lugar de cada um. Sem portador L2, devolve
 * `post` inalterado. A cadeia roda normalmente ANTES (Sturdy/Reckless/Explosion já resolvidos);
 * isto só redistribui a vida final. Puro.
 */
export function redistributeLeafGuardGymDamage(
  pre: readonly Pokemon[],
  post: readonly Pokemon[],
): Pokemon[] {
  const absorberId = leafGuardAbsorberId(pre, 2)
  if (absorberId === null) return [...post]
  const preHpById = new Map(pre.map((p) => [p.id, p.currentHp]))
  let absorbed = 0
  const restored = post.map((p) => {
    if (p.id === absorberId) return p
    const before = preHpById.get(p.id) ?? p.currentHp
    const lost = before - p.currentHp
    if (lost <= 0) return p
    absorbed += Math.ceil(lost / LEAF_GUARD_GYM_DAMAGE_DIVISOR)
    return { ...p, currentHp: before, status: 'idle' as const }
  })
  return restored.map((p) => (p.id === absorberId ? applyDamage(p, absorbed) : p))
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
export function hasIceBody(p: Pokemon): boolean {
  return hasSecret(p, 'sa-ice-body')
}
export function hasChlorophyll(p: Pokemon): boolean {
  return hasSecret(p, 'sa-chlorophyll')
}

/** Imune ao slowdown de calor (nível de time): Ice Body, Clear Body (≥1) ou Chlorophyll. */
export function teamImmuneToHeat(team: readonly Pokemon[]): boolean {
  return team.some((p) => hasIceBody(p) || hasClearBody(p) || hasChlorophyll(p))
}

/** Bônus ADITIVO de velocidade do time no calor (Chlorophyll): 0, +2 (L1) ou +3 (L2). */
export function teamHeatSpeedBonus(team: readonly Pokemon[]): number {
  let bonus = 0
  for (const p of team) {
    const lv = secretLevelOf(p, 'sa-chlorophyll')
    if (lv === 2) bonus = Math.max(bonus, CHLOROPHYLL_HEAT_BONUS_L2)
    else if (lv === 1) bonus = Math.max(bonus, CHLOROPHYLL_HEAT_BONUS_L1)
  }
  return bonus
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
export function hasDrySkin(p: Pokemon): boolean {
  return hasSecret(p, 'sa-dry-skin')
}
export function hasOvercoat(p: Pokemon): boolean {
  return hasSecret(p, 'sa-overcoat')
}
export function hasOwnTempo(p: Pokemon): boolean {
  return hasSecret(p, 'sa-own-tempo')
}
export function hasSniper(p: Pokemon): boolean {
  return hasSecret(p, 'sa-sniper')
}
/** Surf (nível ≥ 1): consegue se mover pela água. Surf+ (nível 2) leva o time. */
export function hasSurf(p: Pokemon): boolean {
  return secretLevelOf(p, 'sa-surf') >= 1
}

/** O Sturdy deste Pokémon ainda pode ser usado hoje? (1×/dia). */
export function sturdyAvailable(p: Pokemon, runtime: SecretRuntimeMap): boolean {
  return hasSturdy(p) && !runtime[p.id]?.sturdyUsed
}

// ---- Combate: bônus de Batalha por habilidade ----

/**
 * Rollout: bônus ADITIVO de Batalha para o próximo oponente, após `frontWins` vitórias seguidas.
 * Fórmula: min(cap, start × 2^(frontWins-1)) para frontWins ≥ 1; 0 caso contrário ou sem Rollout.
 * L1: start=2, cap=32 → sequência 2, 4, 8, 16, 32, 32, …
 * L2: start=4, cap=64 → sequência 4, 8, 16, 32, 64, 64, …
 */
export function rolloutBattleBonus(p: Pokemon, frontWins: number): number {
  if (!hasRollout(p) || frontWins < 1) return 0
  const lv = secretLevelOf(p, 'sa-rollout')
  const start = lv === 2 ? ROLLOUT_START_L2 : ROLLOUT_START_L1
  const cap = lv === 2 ? ROLLOUT_CAP_L2 : ROLLOUT_CAP_L1
  return Math.min(cap, start * Math.pow(2, frontWins - 1))
}

/** Rivalidade: bônus de Batalha contra um oponente do mesmo gênero (0 caso contrário). */
export function rivalryBattleBonus(p: Pokemon): number {
  const lv = secretLevelOf(p, 'sa-rivalry')
  if (lv === 2) return RIVALRY_BATTLE_BONUS_L2
  if (lv === 1) return RIVALRY_BATTLE_BONUS_L1
  return 0
}

/** Hustle: bônus de Batalha em batalhas Pokémon (0 sem a habilidade). */
export function hustleBattleBonus(p: Pokemon): number {
  const lv = secretLevelOf(p, 'sa-hustle')
  if (lv === 2) return HUSTLE_BATTLE_BONUS_L2
  if (lv === 1) return HUSTLE_BATTLE_BONUS_L1
  return 0
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
  /**
   * Agenda de clima do dia (opcional). Necessário para o bônus de missão do Swift Swim L2.
   * Se ausente, o bônus de chuva de missão é omitido (call sites sem clima mantêm comportamento anterior).
   */
  weather?: WeatherSchedule
  /**
   * Instante do dia em ms (dayElapsedMs) no momento do despacho/resolução.
   * Necessário junto com `weather` para avaliar se está chovendo agora para o Swift Swim L2.
   */
  nowMs?: number
  /**
   * Volt Absorb: Pokémon eletrizado pelo resto do dia (id → nível). Se presente, o portador
   * recebe +30%/+90% (L1/L2) de atributos nesta missão.
   */
  electrified?: Record<string, 1 | 2>
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
    const rivalryPerAlly =
      secretLevelOf(p, 'sa-rivalry') === 2 ? RIVALRY_ATTR_PER_ALLY_L2 : RIVALRY_ATTR_PER_ALLY_L1
    mult *= 1 + rivalryPerAlly * allies
  }
  if (hasSecret(p, 'sa-rock-head')) {
    const lvl = secretLevelOf(p, 'sa-rock-head')
    if (ctx.template.id === 'escolta')
      mult *= lvl === 2 ? ROCK_HEAD_ESCORT_MULT_L2 : ROCK_HEAD_ESCORT_MULT_L1
    else if (ctx.template.id === 'ensino')
      mult *= lvl === 2 ? ROCK_HEAD_STUDY_MULT_L2 : ROCK_HEAD_STUDY_MULT_L1
  }
  // Analytic: ganha em Ensino e perde em Patrulha (espelha o Rock Head em outros tipos).
  if (hasAnalytic(p)) {
    const lvl = secretLevelOf(p, 'sa-analytic')
    if (ctx.template.id === 'ensino')
      mult *= lvl === 2 ? ANALYTIC_STUDY_MULT_L2 : ANALYTIC_STUDY_MULT_L1
    else if (ctx.template.id === 'patrulha')
      mult *= lvl === 2 ? ANALYTIC_PATROL_MULT_L2 : ANALYTIC_PATROL_MULT_L1
  }
  // Torrent: +25%/+50% se há OUTRO aliado do tipo Água na missão.
  if (hasTorrent(p) && ctx.team.some((o) => o.id !== p.id && o.types.includes('water'))) {
    const lvl = secretLevelOf(p, 'sa-torrent')
    mult *= lvl === 2 ? TORRENT_MISSION_MULT_L2 : TORRENT_MISSION_MULT_L1
  }
  // Overgrow: +25%/+50% se há OUTRO aliado do tipo Grama na missão.
  if (hasOvergrow(p) && ctx.team.some((o) => o.id !== p.id && o.types.includes('grass'))) {
    const lvl = secretLevelOf(p, 'sa-overgrow')
    mult *= lvl === 2 ? OVERGROW_MISSION_MULT_L2 : OVERGROW_MISSION_MULT_L1
  }
  // Swarm: +25%/+50% se há OUTRO aliado do tipo Inseto na missão.
  if (hasSwarm(p) && ctx.team.some((o) => o.id !== p.id && o.types.includes('bug'))) {
    const lvl = secretLevelOf(p, 'sa-swarm')
    mult *= lvl === 2 ? SWARM_MISSION_MULT_L2 : SWARM_MISSION_MULT_L1
  }
  if (hasBattleArmor(p) && ctx.runtime[p.id]?.battleArmorPending) {
    const lvl = secretLevelOf(p, 'sa-battle-armor')
    mult *= lvl === 2 ? BATTLE_ARMOR_MISSION_MULT_L2 : BATTLE_ARMOR_MISSION_MULT_L1
  }
  // Water Absorb: rota anterior cruzou água → bônus nos atributos desta missão (consome ao resolver).
  if (hasWaterAbsorb(p) && ctx.runtime[p.id]?.waterAbsorbPending) {
    const pending = ctx.runtime[p.id]!.waterAbsorbPending
    mult *= pending === 2 ? WATER_ABSORB_MISSION_MULT_L2 : WATER_ABSORB_MISSION_MULT_L1
  }
  // Swift Swim L2: +30% de atributos em missão enquanto chove (requer ctx.weather + ctx.nowMs).
  if (
    secretLevelOf(p, 'sa-swift-swim') === 2 &&
    ctx.weather !== undefined &&
    ctx.nowMs !== undefined &&
    isRaining(ctx.weather, ctx.nowMs)
  ) {
    mult *= 1 + SWIFT_SWIM_MISSION_BONUS_L2
  }
  // Dry Skin L2: +25% de atributos em missão enquanto chove (requer ctx.weather + ctx.nowMs).
  if (
    secretLevelOf(p, 'sa-dry-skin') === 2 &&
    ctx.weather !== undefined &&
    ctx.nowMs !== undefined &&
    isRaining(ctx.weather, ctx.nowMs)
  ) {
    mult *= 1 + DRY_SKIN_MISSION_BONUS_L2
  }
  if (hasHustle(p)) {
    const lvl = secretLevelOf(p, 'sa-hustle')
    mult *= lvl === 2 ? HUSTLE_MISSION_MULT_L2 : HUSTLE_MISSION_MULT_L1
  }
  // Clear Body L2 (nível de time): nenhum membro recebe debuff de atributo (multiplicador < 1).
  // L1 NÃO cancela debuffs — apenas L2. L1 = imunidade a efeitos negativos de clima (ver stormFlow).
  if (mult < 1 && ctx.team.some((m) => secretLevelOf(m, 'sa-clear-body') === 2)) mult = 1
  // Electirizer: bônus positivo da "próxima missão" por raio sofrido (não anulado pelo Clear Body).
  const charges = ctx.electirizerBonus?.[p.id] ?? 0
  if (charges > 0) mult *= 1 + ELECTIRIZER_MISSION_BONUS * charges
  // Volt Absorb: eletrizado pelo raio → +30% (L1) ou +90% (L2) de atributos.
  const elecLevel = ctx.electrified?.[p.id]
  if (elecLevel !== undefined) {
    mult *= 1 + (elecLevel === 2 ? VOLT_ABSORB_BONUS_L2 : VOLT_ABSORB_BONUS_L1)
  }
  return mult
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

/** Este Pokémon é um voador? (passiva Fly do museu OU habilidade sa-fly nível ≥ 1). */
function isFlyer(p: Pokemon): boolean {
  return p.passives.includes('fly') || hasSecret(p, 'sa-fly')
}

/** O time tem um voador? */
export function teamHasFly(team: readonly Pokemon[]): boolean {
  return team.some(isFlyer)
}

/**
 * O time VOA nesta tarefa? Voa em linha reta do ginásio até o ponto (caminho bem menor). Por
 * padrão o voador precisa estar SOZINHO; com Fly+ (sa-fly nível 2) o voo funciona com o time inteiro.
 */
export function teamFlies(team: readonly Pokemon[]): boolean {
  if (!teamHasFly(team)) return false
  return team.length === 1 || team.some((p) => secretLevelOf(p, 'sa-fly') === 2)
}

/** O time tem um surfista? (o item Surfboard dá surf a todo o time). */
export function teamHasSurf(team: readonly Pokemon[], runItems: readonly string[] = []): boolean {
  return runItems.includes('surfboard') || team.some(hasSurf)
}

/**
 * O time consegue SURFAR nesta tarefa (atravessar a água)? Por padrão o surfista precisa estar
 * SOZINHO; com Surf+ (sa-surf nível 2) leva o time inteiro. Espelha a lógica de `teamFlies`/Fly+.
 * O item Surfboard (runItems) faz o time inteiro surfar, como o Surf+.
 */
export function teamSurfs(team: readonly Pokemon[], runItems: readonly string[] = []): boolean {
  if (runItems.includes('surfboard')) return true
  if (!teamHasSurf(team)) return false
  return team.length === 1 || team.some((p) => secretLevelOf(p, 'sa-surf') === 2)
}

/** O time atua do ginásio (Sniper, só sozinho)? Faz a missão sem viajar. */
export function teamSnipes(team: readonly Pokemon[]): boolean {
  return team.length === 1 && hasSniper(team[0] as Pokemon)
}

/** Quick Feet: +100% de velocidade de viagem quando despachado SOZINHO (L1) OU se algum membro tem L2 (time inteiro). */
export function teamHasQuickFeet(team: readonly Pokemon[]): boolean {
  return (team.length === 1 && hasQuickFeet(team[0] as Pokemon)) || team.some((p) => secretLevelOf(p, 'sa-quick-feet') === 2)
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
 * Weak Armor (+20% por ponto de HP faltante de quem tem a habilidade), Fly (+ bônus ao voar),
 * Volt Absorb eletrizado (+30%/+90% por membro eletrizado) e o item Lagging Tail (mais lento).
 * O tempo de viagem é dividido por este valor.
 * @param electrified Mapa opcional de Pokémon eletrizados (Volt Absorb) — id → nível.
 */
export function teamTravelSpeedMultiplier(
  team: readonly Pokemon[],
  runItems: readonly string[] = [],
  electrified?: Record<string, 1 | 2>,
): number {
  let speed = 1
  for (const p of team) {
    if (hasWeakArmor(p)) {
      const missing = Math.max(0, p.maxHp - p.currentHp)
      const perPoint =
        secretLevelOf(p, 'sa-weak-armor') === 2
          ? WEAK_ARMOR_SPEED_PER_MISSING_HP_L2
          : WEAK_ARMOR_SPEED_PER_MISSING_HP_L1
      speed += perPoint * missing
    }
    // Volt Absorb eletrizado: +30% (L1) ou +90% (L2) de velocidade.
    const elecLevel = electrified?.[p.id]
    if (elecLevel !== undefined) {
      speed += elecLevel === 2 ? VOLT_ABSORB_BONUS_L2 : VOLT_ABSORB_BONUS_L1
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
 * Dano que este Pokémon REALMENTE recebe a partir de um dano bruto: Shell Armor reduz para
 * ceil(raw/2) (L1) ou ceil(raw/3) (L2). Weak Armor NÃO afeta mais o dano recebido.
 * Shell Armor tem precedência se o Pokémon tiver ambos.
 * Vale tanto em batalhas quanto no dano de missões fracassadas.
 */
export function damageTaken(p: Pokemon, raw: number): number {
  if (raw <= 0) return 0
  if (hasShellArmor(p)) {
    const divisor =
      secretLevelOf(p, 'sa-shell-armor') === 2 ? SHELL_ARMOR_DIVISOR_L2 : SHELL_ARMOR_DIVISOR_L1
    return Math.ceil(raw / divisor)
  }
  return raw
}

// ---- Breakdown legível dos efeitos da missão (UI) ----

/** Uma contribuição de habilidade/item exibida no despacho (já formatada). */
export interface MissionEffectEntry {
  id: string
  source: 'ability' | 'item'
  label: string
  kind: 'attr' | 'speed'
  direction: 'gain' | 'loss' | 'info'
  value: string
  reason: string
}

/** Formata um multiplicador (1.1 → '+10%', 0.9 → '−10%'). */
function fmtMult(mult: number): string {
  const p = Math.round((mult - 1) * 100)
  return `${p >= 0 ? '+' : '−'}${Math.abs(p)}%`
}

/** Formata um acréscimo fracionário (0.4 → '+40%'). */
function fmtAdd(frac: number): string {
  return `+${Math.round(frac * 100)}%`
}

/**
 * Lista os efeitos ATIVOS de habilidades/itens sobre ATRIBUTOS e VELOCIDADE (não-roteamento)
 * do time selecionado, já formatados para exibição. Fly/Surf/Sniper têm linhas próprias na UI
 * e não entram aqui. Apenas leitura — não muda nada.
 */
export function missionEffectBreakdown(ctx: MissionSecretCtx): MissionEffectEntry[] {
  const { team, template, runtime, runItems } = ctx
  const out: MissionEffectEntry[] = []
  let hasAttrLoss = false
  const push = (e: MissionEffectEntry): void => {
    if (e.kind === 'attr' && e.direction === 'loss') hasAttrLoss = true
    out.push(e)
  }

  // --- Atributos: itens passivos ---
  if (runItems.includes('eviolite') && team.some(notFinalEvolution)) {
    push({ id: 'eviolite', source: 'item', label: 'Eviolite', kind: 'attr', direction: 'gain',
      value: fmtMult(EVIOLITE_MISSION_MULT), reason: 'Pokémon que ainda evolui' })
  }
  if (runItems.includes('lagging-tail')) {
    push({ id: 'lagging-tail', source: 'item', label: 'Lagging Tail', kind: 'attr', direction: 'gain',
      value: fmtMult(LAGGING_TAIL_MISSION_MULT), reason: 'todos os atributos' })
  }

  // --- Atributos: habilidades ---
  const rivalryBonus = Math.max(
    0,
    ...team.map((p) => {
      if (!hasRivalry(p)) return 0
      const perAlly =
        secretLevelOf(p, 'sa-rivalry') === 2 ? RIVALRY_ATTR_PER_ALLY_L2 : RIVALRY_ATTR_PER_ALLY_L1
      return perAlly * team.filter((o) => o.id !== p.id && o.gender === p.gender).length
    }),
  )
  if (rivalryBonus > 0) {
    push({ id: 'rivalry', source: 'ability', label: 'Rivalry', kind: 'attr', direction: 'gain',
      value: fmtAdd(rivalryBonus), reason: 'por aliados do mesmo gênero' })
  }
  if (team.some((p) => hasSecret(p, 'sa-rock-head'))) {
    // Use the highest level among team members with rock-head for display.
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-rock-head'))) as 0 | 1 | 2
    if (template.id === 'escolta') {
      push({ id: 'rock-head', source: 'ability', label: 'Rock Head', kind: 'attr', direction: 'gain',
        value: fmtMult(lvl === 2 ? ROCK_HEAD_ESCORT_MULT_L2 : ROCK_HEAD_ESCORT_MULT_L1), reason: 'em Escolta' })
    } else if (template.id === 'ensino') {
      push({ id: 'rock-head', source: 'ability', label: 'Rock Head', kind: 'attr', direction: 'loss',
        value: fmtMult(lvl === 2 ? ROCK_HEAD_STUDY_MULT_L2 : ROCK_HEAD_STUDY_MULT_L1), reason: 'em Ensino' })
    }
  }
  if (team.some(hasAnalytic)) {
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-analytic'))) as 0 | 1 | 2
    if (template.id === 'ensino') {
      push({ id: 'analytic', source: 'ability', label: 'Analytic', kind: 'attr', direction: 'gain',
        value: fmtMult(lvl === 2 ? ANALYTIC_STUDY_MULT_L2 : ANALYTIC_STUDY_MULT_L1), reason: 'em Ensino' })
    } else if (template.id === 'patrulha') {
      push({ id: 'analytic', source: 'ability', label: 'Analytic', kind: 'attr', direction: 'loss',
        value: fmtMult(lvl === 2 ? ANALYTIC_PATROL_MULT_L2 : ANALYTIC_PATROL_MULT_L1), reason: 'em Patrulha' })
    }
  }
  if (team.some((p) => hasTorrent(p) && team.some((o) => o.id !== p.id && o.types.includes('water')))) {
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-torrent'))) as 0 | 1 | 2
    push({ id: 'torrent', source: 'ability', label: 'Torrent', kind: 'attr', direction: 'gain',
      value: fmtMult(lvl === 2 ? TORRENT_MISSION_MULT_L2 : TORRENT_MISSION_MULT_L1), reason: 'com aliado do tipo Água' })
  }
  if (team.some((p) => hasOvergrow(p) && team.some((o) => o.id !== p.id && o.types.includes('grass')))) {
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-overgrow'))) as 0 | 1 | 2
    push({ id: 'overgrow', source: 'ability', label: 'Overgrow', kind: 'attr', direction: 'gain',
      value: fmtMult(lvl === 2 ? OVERGROW_MISSION_MULT_L2 : OVERGROW_MISSION_MULT_L1), reason: 'com aliado do tipo Grama' })
  }
  if (team.some((p) => hasSwarm(p) && team.some((o) => o.id !== p.id && o.types.includes('bug')))) {
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-swarm'))) as 0 | 1 | 2
    push({ id: 'swarm', source: 'ability', label: 'Swarm', kind: 'attr', direction: 'gain',
      value: fmtMult(lvl === 2 ? SWARM_MISSION_MULT_L2 : SWARM_MISSION_MULT_L1), reason: 'com aliado do tipo Inseto' })
  }
  if (team.some((p) => hasBattleArmor(p) && runtime[p.id]?.battleArmorPending)) {
    const lvl = Math.max(...team.filter((p) => hasBattleArmor(p) && runtime[p.id]?.battleArmorPending).map((p) => secretLevelOf(p, 'sa-battle-armor'))) as 0 | 1 | 2
    push({ id: 'battle-armor', source: 'ability', label: 'Battle Armor', kind: 'attr', direction: 'gain',
      value: fmtMult(lvl === 2 ? BATTLE_ARMOR_MISSION_MULT_L2 : BATTLE_ARMOR_MISSION_MULT_L1), reason: 'após batalhar na defesa' })
  }
  if (team.some(hasHustle)) {
    const lvl = Math.max(...team.map((p) => secretLevelOf(p, 'sa-hustle'))) as 0 | 1 | 2
    push({ id: 'hustle', source: 'ability', label: 'Hustle', kind: 'attr', direction: 'loss',
      value: fmtMult(lvl === 2 ? HUSTLE_MISSION_MULT_L2 : HUSTLE_MISSION_MULT_L1), reason: 'troca atributo por poder de batalha' })
  }
  if (hasAttrLoss && team.some((m) => secretLevelOf(m, 'sa-clear-body') === 2)) {
    push({ id: 'clear-body', source: 'ability', label: 'Clear Body', kind: 'attr', direction: 'info',
      value: '', reason: 'anula reduções de atributo do time' })
  }

  // --- Velocidade (não-roteamento) ---
  const weakArmorBonus = team.reduce((sum, p) => {
    if (!hasWeakArmor(p)) return sum
    const missing = Math.max(0, p.maxHp - p.currentHp)
    const perPoint =
      secretLevelOf(p, 'sa-weak-armor') === 2
        ? WEAK_ARMOR_SPEED_PER_MISSING_HP_L2
        : WEAK_ARMOR_SPEED_PER_MISSING_HP_L1
    return sum + perPoint * missing
  }, 0)
  if (weakArmorBonus > 0) {
    push({ id: 'weak-armor', source: 'ability', label: 'Weak Armor', kind: 'speed', direction: 'gain',
      value: fmtAdd(weakArmorBonus), reason: 'por HP faltante' })
  }
  if (teamHasQuickFeet(team)) {
    push({ id: 'quick-feet', source: 'ability', label: 'Quick Feet', kind: 'speed', direction: 'gain',
      value: fmtAdd(QUICK_FEET_SPEED_BONUS), reason: 'despachado sozinho' })
  }
  if (runItems.includes('lagging-tail')) {
    push({ id: 'lagging-tail', source: 'item', label: 'Lagging Tail', kind: 'speed', direction: 'loss',
      value: fmtMult(LAGGING_TAIL_TRAVEL_MULT), reason: 'viagem mais lenta' })
  }

  return out
}
