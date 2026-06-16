// Habilidades Secretas (ajuste): cada LINHA evolutiva tem TRÊS habilidades secretas distintas,
// que podem ficar ativas ao mesmo tempo. Ser o Destaque do Dia desbloqueia a próxima da lista —
// a 1ª vez a habilidade 1, a 2ª a habilidade 2, a 3ª a habilidade 3. O progresso fica gravado no
// INDIVÍDUO (pokemon.secretCount = quantas já desbloqueou) e sobrevive à evolução. Outros Pokémon
// da mesma linha NÃO ganham nada; cada um precisa virar Destaque.
//
// O CONTEÚDO (nome + efeito) é por TIPO de habilidade (uma mesma habilidade aparece em várias
// linhas). A LÓGICA de cada efeito vive na engine (ver engine/secretEffects.ts), amarrada pelo id.

import type { Pokemon } from '../types/index.ts'
import { EVOLUTIONS } from './pokemon/evolutions.generated.ts'

/** Quantas habilidades secretas uma linha tem (máximo desbloqueável por Pokémon). */
export const SECRET_MAX = 3

/** Ids estáveis de cada TIPO de habilidade secreta (gravados na linha; NÃO mudar). */
export type SecretId =
  | 'sa-rollout'
  | 'sa-dig'
  | 'sa-sand-rush'
  | 'sa-rivalry'
  | 'sa-hustle'
  | 'sa-dig-plus'
  | 'sa-sturdy'
  | 'sa-explosion'
  | 'sa-weak-armor'
  | 'sa-rock-head'
  | 'sa-battle-armor'
  | 'sa-lightning-rod'
  | 'sa-reckless'
  | 'sa-swift-swim'
  | 'sa-shell-armor'
  | 'sa-fly'
  | 'sa-fly-plus'
  // Cerulean (Água/Gelo) — habilidades novas.
  | 'sa-surf'
  | 'sa-surf-plus'
  | 'sa-torrent'
  | 'sa-thick-fat'
  | 'sa-moxie'
  | 'sa-pressure'
  | 'sa-regenerator'
  | 'sa-natural-cure'
  | 'sa-analytic'
  | 'sa-clear-body'
  | 'sa-sniper'
  | 'sa-water-absorb'
  | 'sa-forewarn'
  // Cerulean — só descrição por ora (dependem de clima/status ainda não implementados).
  | 'sa-cloud-nine'
  | 'sa-ice-body'
  | 'sa-dry-skin'
  | 'sa-overcoat'
  | 'sa-own-tempo'

export interface SecretKind {
  id: SecretId
  name: string
  /** Texto do efeito exibido ao jogador (a regra mora na engine). */
  effect: string
}

/** Catálogo de TODAS as habilidades secretas (nome + efeito), por id. */
export const SECRET_KINDS: Record<SecretId, SecretKind> = {
  'sa-rollout': {
    id: 'sa-rollout',
    name: 'Rollout',
    effect: 'Ao derrotar um Pokémon, +10% de bônus de batalha no próximo duelo (acumula na sequência).',
  },
  'sa-dig': {
    id: 'sa-dig',
    name: 'Dig',
    effect: 'Abre 2 buracos ligando dois pontos; o time atravessa por baixo da terra.',
  },
  'sa-sand-rush': {
    id: 'sa-sand-rush',
    name: 'Sand Rush',
    effect: '+200% de velocidade do time durante tempestade de areia. (sem efeito até existir clima)',
  },
  'sa-rivalry': {
    id: 'sa-rivalry',
    name: 'Rivalidade',
    effect: '+10% nos atributos por aliado do mesmo gênero na missão e +10% de batalha contra oponente do mesmo gênero.',
  },
  'sa-hustle': {
    id: 'sa-hustle',
    name: 'Hustle',
    effect: '+10% de Batalha em batalhas, mas −10% nos atributos em missões.',
  },
  'sa-dig-plus': {
    id: 'sa-dig-plus',
    name: 'Dig+',
    effect: 'Upgrade do Dig: um dos buracos aparece sempre no ponto do ginásio.',
  },
  'sa-sturdy': {
    id: 'sa-sturdy',
    name: 'Sturdy',
    effect: 'Quando desmaiaria em batalha, fica com 1 de vida. (1× por dia)',
  },
  'sa-explosion': {
    id: 'sa-explosion',
    name: 'Explosion',
    effect: 'Ao ser derrotado em batalha, explode: perde metade da vida máxima (pode morrer) e derrota o Pokémon que o derrotou.',
  },
  'sa-weak-armor': {
    id: 'sa-weak-armor',
    name: 'Weak Armor',
    effect: 'Ao receber dano perde o dobro de vida, mas dá +20% de velocidade ao time por ponto de vida faltante.',
  },
  'sa-rock-head': {
    id: 'sa-rock-head',
    name: 'Rock Head',
    effect: '+50% nos atributos em missões de escolta e −50% em ensino.',
  },
  'sa-battle-armor': {
    id: 'sa-battle-armor',
    name: 'Battle Armor',
    effect: 'Após uma batalha (ginásio/Rocket), +30% em todos os atributos na próxima missão.',
  },
  'sa-lightning-rod': {
    id: 'sa-lightning-rod',
    name: 'Lightning Rod',
    effect: 'Quando o oponente é do tipo Elétrico, assume o duelo no lugar de quem está na frente.',
  },
  'sa-reckless': {
    id: 'sa-reckless',
    name: 'Reckless',
    effect: 'Ao perder um combate, perde vida e tenta de novo sem passar a vez para o próximo Pokémon.',
  },
  'sa-swift-swim': {
    id: 'sa-swift-swim',
    name: 'Swift Swim',
    effect: '+200% de velocidade do time durante chuva. (sem efeito até existir clima)',
  },
  'sa-shell-armor': {
    id: 'sa-shell-armor',
    name: 'Shell Armor',
    effect: 'Todo dano recebido na vida vira 1.',
  },
  'sa-fly': {
    id: 'sa-fly',
    name: 'Fly',
    effect: 'Voa em linha reta do ginásio até a tarefa — bem mais rápido. Só quando despachado sozinho.',
  },
  'sa-fly-plus': {
    id: 'sa-fly-plus',
    name: 'Fly+',
    effect: 'Upgrade do Fly: pode levar o time inteiro voando.',
  },
  'sa-surf': {
    id: 'sa-surf',
    name: 'Surf',
    effect: 'Atravessa os pontos de água e ganha +100% de velocidade na água. Só quando despachado sozinho.',
  },
  'sa-surf-plus': {
    id: 'sa-surf-plus',
    name: 'Surf+',
    effect: 'Upgrade do Surf: pode levar o time inteiro pela água.',
  },
  'sa-torrent': {
    id: 'sa-torrent',
    name: 'Torrent',
    effect: '+50% nos atributos quando vai a uma missão com outro Pokémon do tipo Água.',
  },
  'sa-thick-fat': {
    id: 'sa-thick-fat',
    name: 'Thick Fat',
    effect: 'Recebe vantagem (×1,5 de Batalha) em batalhas contra Pokémon do tipo Gelo.',
  },
  'sa-moxie': {
    id: 'sa-moxie',
    name: 'Moxie',
    effect: 'Ao derrotar um Pokémon na batalha, ganha +1 de Batalha (acumula na sequência).',
  },
  'sa-pressure': {
    id: 'sa-pressure',
    name: 'Pressure',
    effect: 'Reduz a Batalha dos Pokémon enfrentados em 25%.',
  },
  'sa-regenerator': {
    id: 'sa-regenerator',
    name: 'Regenerator',
    effect: 'Recupera 1 de vida a cada Pokémon derrotado em batalha.',
  },
  'sa-natural-cure': {
    id: 'sa-natural-cure',
    name: 'Natural Cure',
    effect: 'Sempre que sai em missão, recupera 2 de vida.',
  },
  'sa-analytic': {
    id: 'sa-analytic',
    name: 'Analytic',
    effect: '+50% nos atributos em missões de Ensino e −50% em Patrulha.',
  },
  'sa-clear-body': {
    id: 'sa-clear-body',
    name: 'Clear Body',
    effect: 'Seu time não recebe debuff de atributo em missões.',
  },
  'sa-sniper': {
    id: 'sa-sniper',
    name: 'Sniper',
    effect: 'Faz missões sem sair do ginásio (atua à distância). Só quando despachado sozinho.',
  },
  'sa-water-absorb': {
    id: 'sa-water-absorb',
    name: 'Water Absorb',
    effect: 'Ganha 10 de XP sempre que a rota passa pela água.',
  },
  'sa-forewarn': {
    id: 'sa-forewarn',
    name: 'Forewarn',
    effect: 'Antecipa uma das missões do dia para o início do dia (cada portador antecipa mais uma).',
  },
  'sa-cloud-nine': {
    id: 'sa-cloud-nine',
    name: 'Cloud Nine',
    effect: 'Aumenta em 25% a chance de chover ao longo do dia. (sem efeito até existir clima)',
  },
  'sa-ice-body': {
    id: 'sa-ice-body',
    name: 'Ice Body',
    effect: 'Nunca fica congelado. (sem efeito até existir o status de congelamento)',
  },
  'sa-dry-skin': {
    id: 'sa-dry-skin',
    name: 'Dry Skin',
    effect: 'Perde 1 de vida no calor e recupera 2 quando chove ou está frio. (sem efeito até existir clima)',
  },
  'sa-overcoat': {
    id: 'sa-overcoat',
    name: 'Overcoat',
    effect: 'Não recebe dano de nenhum efeito climático. (sem efeito até existir clima)',
  },
  'sa-own-tempo': {
    id: 'sa-own-tempo',
    name: 'Own Tempo',
    effect: 'Previne o Pokémon de ficar confuso. (sem efeito até existir o status de confusão)',
  },
}

// Mapa filho → pai (a partir dos passos de evolução), para achar a raiz de uma linha.
const PARENT: Map<number, number> = (() => {
  const m = new Map<number, number>()
  for (const step of EVOLUTIONS) m.set(step.to, step.from)
  return m
})()

/** Id da forma-base (raiz) da linha evolutiva de uma espécie. */
export function lineRootId(speciesId: number): number {
  let id = speciesId
  const seen = new Set<number>()
  while (PARENT.has(id) && !seen.has(id)) {
    seen.add(id)
    id = PARENT.get(id) as number
  }
  return id
}

/**
 * As TRÊS habilidades secretas de cada linha, na ORDEM de desbloqueio (1ª, 2ª, 3ª vez Destaque),
 * chaveadas pelo id da forma-base (raiz). Linhas de Pedra/Ground/Fóssil (Pewter).
 */
export const SECRET_LINES: Record<number, readonly [SecretId, SecretId, SecretId]> = {
  // Sandshrew → Sandslash
  27: ['sa-rollout', 'sa-dig', 'sa-sand-rush'],
  // Nidoran♀ → Nidorina → Nidoqueen
  29: ['sa-rivalry', 'sa-hustle', 'sa-dig'],
  // Nidoran♂ → Nidorino → Nidoking
  32: ['sa-rivalry', 'sa-hustle', 'sa-dig'],
  // Diglett → Dugtrio
  50: ['sa-dig', 'sa-sand-rush', 'sa-dig-plus'],
  // Geodude → Graveler → Golem
  74: ['sa-sturdy', 'sa-explosion', 'sa-rollout'],
  // Onix
  95: ['sa-weak-armor', 'sa-sturdy', 'sa-rock-head'],
  // Cubone → Marowak
  104: ['sa-rock-head', 'sa-battle-armor', 'sa-lightning-rod'],
  // Rhyhorn → Rhydon
  111: ['sa-lightning-rod', 'sa-rock-head', 'sa-reckless'],
  // Omanyte → Omastar
  138: ['sa-swift-swim', 'sa-shell-armor', 'sa-weak-armor'],
  // Kabuto → Kabutops
  140: ['sa-battle-armor', 'sa-weak-armor', 'sa-swift-swim'],
  // Aerodactyl
  142: ['sa-fly', 'sa-rock-head', 'sa-fly-plus'],

  // ---- Cerulean (Água/Gelo) ----
  // Squirtle → Wartortle → Blastoise
  7: ['sa-surf', 'sa-torrent', 'sa-surf-plus'],
  // Psyduck → Golduck
  54: ['sa-surf', 'sa-swift-swim', 'sa-cloud-nine'],
  // Poliwag → Poliwhirl → Poliwrath
  60: ['sa-water-absorb', 'sa-surf', 'sa-swift-swim'],
  // Tentacool → Tentacruel
  72: ['sa-clear-body', 'sa-surf', 'sa-surf-plus'],
  // Slowpoke → Slowbro
  79: ['sa-regenerator', 'sa-own-tempo', 'sa-surf'],
  // Seel → Dewgong
  86: ['sa-surf', 'sa-ice-body', 'sa-thick-fat'],
  // Shellder → Cloyster
  90: ['sa-shell-armor', 'sa-overcoat', 'sa-surf'],
  // Krabby → Kingler
  98: ['sa-dig', 'sa-shell-armor', 'sa-dig-plus'],
  // Horsea → Seadra
  116: ['sa-swift-swim', 'sa-surf', 'sa-sniper'],
  // Goldeen → Seaking
  118: ['sa-surf', 'sa-swift-swim', 'sa-surf-plus'],
  // Staryu → Starmie
  120: ['sa-analytic', 'sa-surf', 'sa-natural-cure'],
  // Jynx
  124: ['sa-dry-skin', 'sa-forewarn', 'sa-analytic'],
  // Magikarp → Gyarados
  129: ['sa-surf', 'sa-moxie', 'sa-surf-plus'],
  // Lapras
  131: ['sa-surf', 'sa-surf-plus', 'sa-shell-armor'],
  // Articuno
  144: ['sa-fly', 'sa-fly-plus', 'sa-pressure'],
  // Omanyte (138) e Kabuto (140) já estão definidos acima (linhas de fóssil) e batem com Cerulean.
}

/**
 * Override por ESPÉCIE (precede a busca por raiz): para linhas divergentes onde a raiz é
 * compartilhada por evoluções de cidades diferentes. Eevee (133) vira Vaporeon/Jolteon/Flareon,
 * então `lineRootId(134)` colapsaria em 133 e vazaria a linha de água para os outros — aqui
 * Vaporeon recebe a sua própria linha sem afetar os demais eeveelutions.
 */
const SECRET_LINE_BY_SPECIES: Partial<Record<number, readonly [SecretId, SecretId, SecretId]>> = {
  // Vaporeon
  134: ['sa-surf', 'sa-surf-plus', 'sa-water-absorb'],
}

/** As três habilidades (ids, em ordem) da linha de uma espécie — null se a linha não tem. */
export function secretLineFor(speciesId: number): readonly [SecretId, SecretId, SecretId] | null {
  return SECRET_LINE_BY_SPECIES[speciesId] ?? SECRET_LINES[lineRootId(speciesId)] ?? null
}

/** Quantas habilidades secretas este Pokémon já desbloqueou (0..3), com clamp defensivo. */
export function secretCountOf(p: Pokemon): number {
  if (!secretLineFor(p.speciesId)) return 0
  return Math.min(SECRET_MAX, Math.max(0, p.secretCount ?? 0))
}

/** Ids das habilidades secretas ATIVAS (já desbloqueadas) deste Pokémon, na ordem da linha. */
export function unlockedSecretIds(p: Pokemon): SecretId[] {
  const line = secretLineFor(p.speciesId)
  if (!line) return []
  return line.slice(0, secretCountOf(p)) as SecretId[]
}

/** Este Pokémon tem a habilidade secreta `id` desbloqueada? */
export function hasSecret(p: Pokemon, id: SecretId): boolean {
  return unlockedSecretIds(p).includes(id)
}
