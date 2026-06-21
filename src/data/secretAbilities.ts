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
  // Cerulean (Água/Gelo) — habilidades novas.
  | 'sa-surf'
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
  // Vermilion (Elétrico) — habilidades novas.
  | 'sa-static'
  | 'sa-vital-spirit'
  | 'sa-quick-feet'
  // Vermilion — só descrição por ora (depende da tempestade, ainda não implementada).
  | 'sa-volt-absorb'

export interface SecretKind {
  id: SecretId
  name: string
  /** Texto do efeito no nível 1 (regra mora na engine). */
  effectL1: string
  /** Texto do efeito no nível 2 ("+", upgrade que inclui o nível 1). */
  effectL2: string
}

/** Catálogo de TODAS as habilidades secretas (nome + effectL1/effectL2), por id. */
export const SECRET_KINDS: Record<SecretId, SecretKind> = {
  // ---- Travessia / viagem ----
  'sa-surf': {
    id: 'sa-surf',
    name: 'Surf',
    effectL1: 'Atravessa os pontos de água e, enquanto está na água, ganha +100% de velocidade (só despachado sozinho).',
    effectL2: 'Leva o time inteiro pela água.',
  },
  'sa-fly': {
    id: 'sa-fly',
    name: 'Fly',
    effectL1: 'Voa em linha reta do ginásio à tarefa (caminho curto), sem bônus de velocidade. Risco: um raio mata o time e perde a missão. Só sozinho.',
    effectL2: 'Leva o time inteiro voando (mantém o risco do raio).',
  },
  'sa-dig': {
    id: 'sa-dig',
    name: 'Dig',
    effectL1: 'Abre 2 buracos ligando dois pontos; o time atravessa por baixo da terra.',
    effectL2: 'Um dos buracos aparece sempre no ponto do ginásio.',
  },
  'sa-quick-feet': {
    id: 'sa-quick-feet',
    name: 'Quick Feet',
    effectL1: '+100% de movimento despachado sozinho.',
    effectL2: '+100% de movimento para o time inteiro.',
  },
  // ---- Velocidade por condição ----
  'sa-weak-armor': {
    id: 'sa-weak-armor',
    name: 'Weak Armor',
    effectL1: '+15% de velocidade do time por ponto de vida faltante (sem o dobro de dano).',
    effectL2: '+25% de velocidade do time por ponto de vida faltante.',
  },
  'sa-swift-swim': {
    id: 'sa-swift-swim',
    name: 'Swift Swim',
    effectL1: '+200% de velocidade do time enquanto chove.',
    effectL2: '+200% de velocidade e +30% de atributos em missões enquanto chove.',
  },
  // ---- Combate ----
  'sa-rollout': {
    id: 'sa-rollout',
    name: 'Rollout',
    effectL1: 'A cada Pokémon derrotado no duelo, o bônus de Batalha para o próximo dobra: +2, +4, +8, +16, +32 (teto). Reinicia a cada batalha.',
    effectL2: 'Começa em +4 e dobra: +4, +8, +16, +32, +64 (teto).',
  },
  'sa-rivalry': {
    id: 'sa-rivalry',
    name: 'Rivalidade',
    effectL1: '+10% nos atributos por aliado do mesmo gênero na missão; +10% de Batalha contra oponente do mesmo gênero.',
    effectL2: '+20% / +20%.',
  },
  'sa-hustle': {
    id: 'sa-hustle',
    name: 'Hustle',
    effectL1: '+10% de Batalha / −10% de atributos em missões.',
    effectL2: '+30% / −30%.',
  },
  'sa-sturdy': {
    id: 'sa-sturdy',
    name: 'Sturdy',
    effectL1: 'Ao desmaiar em batalha, fica com 1 de vida (1×/dia).',
    effectL2: 'Nunca desmaia em batalha — sempre fica com 1 de vida (sem limite diário).',
  },
  'sa-explosion': {
    id: 'sa-explosion',
    name: 'Explosion',
    effectL1: 'Ao ser derrotado, explode: perde metade da vida máxima (pode morrer) e derrota quem o derrotou.',
    effectL2: 'Explode perdendo toda a vida (morre) e derrota todos os Pokémon inimigos.',
  },
  'sa-reckless': {
    id: 'sa-reckless',
    name: 'Reckless',
    effectL1: 'Ao perder um combate, perde vida e tenta de novo sem passar a vez.',
    effectL2: 'Na retentativa toma metade do dano que tomaria.',
  },
  'sa-pressure': {
    id: 'sa-pressure',
    name: 'Pressure',
    effectL1: 'No início do combate, reduz a Batalha dos inimigos em 15%. Não acumula: vale só o de maior nível.',
    effectL2: '30%. Não acumula: vale só o de maior nível.',
  },
  'sa-moxie': {
    id: 'sa-moxie',
    name: 'Moxie',
    effectL1: 'Ao derrotar um Pokémon, +1 no atributo Batalha permanente (resto do jogo), até o teto 60.',
    effectL2: 'Mantém o +1 permanente e ganha +5 temporário acumulável para a próxima batalha: +5, +10, +15, +20, +25 (teto).',
  },
  'sa-regenerator': {
    id: 'sa-regenerator',
    name: 'Regenerator',
    effectL1: '+1 de vida por Pokémon derrotado em batalha.',
    effectL2: 'Cura toda a vida a cada Pokémon derrotado.',
  },
  'sa-thick-fat': {
    id: 'sa-thick-fat',
    name: 'Thick Fat',
    effectL1: 'Seu time não pode ser congelado em tempestade de gelo (sem efeito até existir tempestade de gelo).',
    effectL2: 'Sempre vence batalhas contra Pokémon do tipo Gelo.',
  },
  'sa-ice-body': {
    id: 'sa-ice-body',
    name: 'Ice Body',
    effectL1: 'Seu time não recebe efeito negativo do calor (sem efeito até existir clima de calor).',
    effectL2: 'Sempre vence batalhas contra Pokémon do tipo Fogo.',
  },
  'sa-battle-armor': {
    id: 'sa-battle-armor',
    name: 'Battle Armor',
    effectL1: 'Após uma batalha (ginásio/Rocket), +25% em todos os atributos na próxima missão.',
    effectL2: '+50%.',
  },
  'sa-vital-spirit': {
    id: 'sa-vital-spirit',
    name: 'Vital Spirit',
    effectL1: 'Ao falhar uma missão, o time tenta de novo 1× (mesma chance).',
    effectL2: 'Mantém o L1 e ao perder um combate, tenta de novo sem perder vida.',
  },
  // ---- Defesa / dano recebido ----
  'sa-shell-armor': {
    id: 'sa-shell-armor',
    name: 'Shell Armor',
    effectL1: 'Recebe metade do dano em combate e missão (arredonda p/ cima: 3→2).',
    effectL2: 'Recebe 1/3 do dano (3→1).',
  },
  'sa-natural-cure': {
    id: 'sa-natural-cure',
    name: 'Natural Cure',
    effectL1: 'Ao sair em missão, +2 de vida.',
    effectL2: 'Ao sair em missão, cura toda a vida.',
  },
  // ---- Missões (multiplicadores) ----
  'sa-rock-head': {
    id: 'sa-rock-head',
    name: 'Rock Head',
    effectL1: '+40% em escolta / −40% em ensino.',
    effectL2: '+80% / −80%.',
  },
  'sa-analytic': {
    id: 'sa-analytic',
    name: 'Analytic',
    effectL1: '+40% em ensino / −40% em patrulha.',
    effectL2: '+80% / −80%.',
  },
  'sa-torrent': {
    id: 'sa-torrent',
    name: 'Torrent',
    effectL1: '+25% nos atributos com outro aliado do tipo Água na missão.',
    effectL2: '+50%.',
  },
  'sa-water-absorb': {
    id: 'sa-water-absorb',
    name: 'Water Absorb',
    effectL1: 'Sempre que a rota passa pela água, +30% de atributos na próxima missão.',
    effectL2: '+50%.',
  },
  'sa-sniper': {
    id: 'sa-sniper',
    name: 'Sniper',
    effectL1: 'Faz missões sem sair do ginásio (à distância, só sozinho), mas a missão demora o dobro do tempo.',
    effectL2: 'A missão demora o tempo normal.',
  },
  'sa-forewarn': {
    id: 'sa-forewarn',
    name: 'Forewarn',
    effectL1: 'Antecipa 1 missão do dia (cada portador antecipa mais uma).',
    effectL2: 'Antecipa 2 missões (por portador).',
  },
  // ---- Clima / tempestade ----
  'sa-lightning-rod': {
    id: 'sa-lightning-rod',
    name: 'Lightning Rod',
    effectL1: 'O time inteiro que sai na missão fica imune ao efeito/dano de raio (basta o portador estar despachado).',
    effectL2: 'Mantém a imunidade e quando o oponente é do tipo Elétrico, assume o duelo no lugar de quem está na frente.',
  },
  'sa-volt-absorb': {
    id: 'sa-volt-absorb',
    name: 'Volt Absorb',
    effectL1: 'Ao ser atingido por um raio, absorve (não toma o dano) e fica eletrizado pelo resto do dia: +30% de movimento e +30% nos atributos.',
    effectL2: '+90% / +90%.',
  },
  'sa-static': {
    id: 'sa-static',
    name: 'Static',
    effectL1: 'Os raios sempre caem no ponto mais próximo dele (marca vermelha, cai após 5s); e, parado em missão, o time ganha +1 de XP por segundo parado.',
    effectL2: 'Mantém o L1 e o time ganha +10% de movimento por segundo parado (máx 100%).',
  },
  'sa-cloud-nine': {
    id: 'sa-cloud-nine',
    name: 'Cloud Nine',
    effectL1: '+10pp na chance de chuva hoje e −10pp na chance de outros efeitos climáticos (acumula por portador).',
    effectL2: '+20pp / −20pp.',
  },
  'sa-overcoat': {
    id: 'sa-overcoat',
    name: 'Overcoat',
    effectL1: '−10pp na chance de qualquer efeito climático acontecer no dia (acumula por portador).',
    effectL2: '−20pp.',
  },
  'sa-own-tempo': {
    id: 'sa-own-tempo',
    name: 'Own Tempo',
    effectL1: 'No máximo 2 efeitos climáticos podem acontecer no dia. Não acumula: vale só o de maior nível.',
    effectL2: 'No máximo 1. Não acumula: vale só o de maior nível.',
  },
  'sa-dry-skin': {
    id: 'sa-dry-skin',
    name: 'Dry Skin',
    effectL1: 'Ao sair em missão, −25% de vida no calor (sem efeito até existir clima de calor) / +25% de vida na chuva ou frio (chuva já funciona; frio sem efeito até existir).',
    effectL2: 'Mantém o L1 e −25% de bônus de missão no calor (sem efeito até existir) / +25% de bônus na chuva ou frio.',
  },
  'sa-clear-body': {
    id: 'sa-clear-body',
    name: 'Clear Body',
    effectL1: 'O time não recebe efeitos negativos de clima (ex.: paralisia por raio).',
    effectL2: 'Mantém o L1 e o time não recebe debuffs de habilidades secretas (ex.: −40% do Analytic em Patrulha).',
  },
  // ---- Inertes ----
  'sa-sand-rush': {
    id: 'sa-sand-rush',
    name: 'Sand Rush',
    effectL1: '+200% de velocidade do time durante tempestade de areia (sem efeito até existir tempestade de areia).',
    effectL2: '+300% de velocidade do time durante tempestade de areia (sem efeito até existir tempestade de areia).',
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
  // ---- Vermilion (Elétrico) ----
  // Pikachu → Raichu
  25: ['sa-static', 'sa-dig', 'sa-lightning-rod'],
  // Magnemite → Magneton
  81: ['sa-sturdy', 'sa-analytic', 'sa-fly'],
  // Voltorb → Electrode
  100: ['sa-explosion', 'sa-rollout', 'sa-static'],
  // Electabuzz (Volt Absorb fica sem efeito até existir a tempestade)
  125: ['sa-vital-spirit', 'sa-volt-absorb', 'sa-static'],
  // Zapdos (ave-trovão lendária)
  145: ['sa-fly', 'sa-pressure', 'sa-fly'],

  // Sandshrew → Sandslash
  27: ['sa-rollout', 'sa-dig', 'sa-sand-rush'],
  // Nidoran♀ → Nidorina → Nidoqueen
  29: ['sa-rivalry', 'sa-hustle', 'sa-dig'],
  // Nidoran♂ → Nidorino → Nidoking
  32: ['sa-rivalry', 'sa-hustle', 'sa-dig'],
  // Diglett → Dugtrio
  50: ['sa-dig', 'sa-sand-rush', 'sa-dig'],
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
  142: ['sa-fly', 'sa-rock-head', 'sa-fly'],

  // ---- Dragões ----
  // Dratini → Dragonair → Dragonite
  147: ['sa-surf', 'sa-fly', 'sa-fly'],

  // ---- Cerulean (Água/Gelo) ----
  // Squirtle → Wartortle → Blastoise
  7: ['sa-surf', 'sa-torrent', 'sa-surf'],
  // Psyduck → Golduck
  54: ['sa-surf', 'sa-swift-swim', 'sa-cloud-nine'],
  // Poliwag → Poliwhirl → Poliwrath
  60: ['sa-water-absorb', 'sa-surf', 'sa-swift-swim'],
  // Tentacool → Tentacruel
  72: ['sa-clear-body', 'sa-surf', 'sa-surf'],
  // Slowpoke → Slowbro
  79: ['sa-regenerator', 'sa-own-tempo', 'sa-surf'],
  // Seel → Dewgong
  86: ['sa-surf', 'sa-ice-body', 'sa-thick-fat'],
  // Shellder → Cloyster
  90: ['sa-shell-armor', 'sa-overcoat', 'sa-surf'],
  // Krabby → Kingler
  98: ['sa-dig', 'sa-shell-armor', 'sa-dig'],
  // Horsea → Seadra
  116: ['sa-swift-swim', 'sa-surf', 'sa-sniper'],
  // Goldeen → Seaking
  118: ['sa-surf', 'sa-swift-swim', 'sa-surf'],
  // Staryu → Starmie
  120: ['sa-analytic', 'sa-surf', 'sa-natural-cure'],
  // Jynx
  124: ['sa-dry-skin', 'sa-forewarn', 'sa-analytic'],
  // Magikarp → Gyarados
  129: ['sa-surf', 'sa-moxie', 'sa-surf'],
  // Lapras
  131: ['sa-surf', 'sa-shell-armor', 'sa-shell-armor'],
  // Articuno
  144: ['sa-fly', 'sa-pressure', 'sa-fly'],
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
  134: ['sa-surf', 'sa-water-absorb', 'sa-surf'],
  // Jolteon (Volt Absorb fica sem efeito até existir a tempestade)
  135: ['sa-quick-feet', 'sa-volt-absorb', 'sa-static'],
}

/** As três habilidades (ids, em ordem) da linha de uma espécie — null se a linha não tem. */
export function secretLineFor(speciesId: number): readonly [SecretId, SecretId, SecretId] | null {
  return SECRET_LINE_BY_SPECIES[speciesId] ?? SECRET_LINES[lineRootId(speciesId)] ?? null
}

/** Quantas habilidades secretas este Pokémon já desbloqueou (0..3), com clamp defensivo. */
export function secretCountOf(p: Pokemon): number {
  if (!secretLineFor(p.speciesId)) return 0
  return Math.min(SECRET_MAX, Math.max(0, p.secretPicks?.length ?? 0))
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
