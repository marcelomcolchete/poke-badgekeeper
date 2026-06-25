// Habilidades Secretas: cada LINHA evolutiva tem DOIS slots (0 e 1), cada um podendo ser
// nível 0 (bloqueado), 1 (base) ou 2 ("+"). Ser Destaque do Dia 1× desbloqueia o slot 0
// no nível 1; uma 2ª vez o eleva ao nível 2 OU desbloqueia o slot 1 no nível 1. O progresso
// fica gravado no INDIVÍDUO (pokemon.secretPicks) e sobrevive à evolução. Outros Pokémon
// da mesma linha NÃO ganham nada; cada um precisa virar Destaque.
//
// O CONTEÚDO (nome + efeito) é por TIPO de habilidade (uma mesma habilidade aparece em várias
// linhas). A LÓGICA de cada efeito vive na engine (ver engine/secretEffects.ts), amarrada pelo id.

import type { Pokemon } from '../types/index.ts'
import { EVOLUTIONS } from './pokemon/evolutions.generated.ts'


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
  // Celadon (Grama/Inseto) — habilidades novas com efeito.
  | 'sa-overgrow'
  | 'sa-swarm'
  | 'sa-spore'
  | 'sa-leaf-guard'
  | 'sa-tinted-lens'
  // Celadon — só descrição por ora (dependem de clima de calor / berries ainda não implementados).
  | 'sa-chlorophyll'
  | 'sa-gluttony'
  | 'sa-harvest'

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
    effectL2: 'Atravessa os pontos de água e leva o time inteiro pela água; na água, ganha +100% de velocidade.',
  },
  'sa-fly': {
    id: 'sa-fly',
    name: 'Fly',
    effectL1: 'Voa em linha reta do ginásio à tarefa (caminho curto) com +50% de velocidade. Risco: um raio mata o time e perde a missão. Só sozinho.',
    effectL2: 'Voa em linha reta do ginásio à tarefa (caminho curto) com +50% de velocidade, levando o time inteiro. Risco: um raio mata o time e perde a missão.',
  },
  'sa-dig': {
    id: 'sa-dig',
    name: 'Dig',
    effectL1: 'Abre 2 buracos ligando dois pontos; o time atravessa por baixo da terra.',
    effectL2: 'Abre 2 buracos ligando dois pontos (o time atravessa por baixo da terra); um dos buracos aparece sempre no ponto do ginásio.',
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
    effectL2: '+20% nos atributos por aliado do mesmo gênero na missão; +20% de Batalha contra oponente do mesmo gênero.',
  },
  'sa-hustle': {
    id: 'sa-hustle',
    name: 'Hustle',
    effectL1: '+10% de Batalha / −10% de atributos em missões.',
    effectL2: '+30% de Batalha / −30% de atributos em missões.',
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
    effectL2: 'Ao perder um combate, perde vida e tenta de novo sem passar a vez, tomando metade do dano na retentativa.',
  },
  'sa-pressure': {
    id: 'sa-pressure',
    name: 'Pressure',
    effectL1: 'No início do combate, reduz a Batalha dos inimigos em 15%. Não acumula: vale só o de maior nível.',
    effectL2: 'No início do combate, reduz a Batalha dos inimigos em 30%. Não acumula: vale só o de maior nível.',
  },
  'sa-moxie': {
    id: 'sa-moxie',
    name: 'Moxie',
    effectL1: 'Ao derrotar um Pokémon, +1 no atributo Batalha permanente (resto do jogo), até o teto 60.',
    effectL2: 'Ao derrotar um Pokémon, +1 no atributo Batalha permanente (resto do jogo, até o teto 60) e +5 temporário acumulável para a próxima batalha: +5, +10, +15, +20, +25 (teto).',
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
    effectL2: 'Seu time não pode ser congelado em tempestade de gelo e você sempre vence batalhas contra Pokémon do tipo Gelo (a parte do congelamento fica inerte até existir tempestade de gelo).',
  },
  'sa-ice-body': {
    id: 'sa-ice-body',
    name: 'Ice Body',
    effectL1: 'Seu time não recebe efeito negativo do calor (sem efeito até existir clima de calor).',
    effectL2: 'Seu time não recebe efeito negativo do calor e você sempre vence batalhas contra Pokémon do tipo Fogo (a parte do calor fica inerte até existir clima de calor).',
  },
  'sa-battle-armor': {
    id: 'sa-battle-armor',
    name: 'Battle Armor',
    effectL1: 'Após uma batalha (ginásio/Rocket), +25% em todos os atributos na próxima missão.',
    effectL2: 'Após uma batalha (ginásio/Rocket), +50% em todos os atributos na próxima missão.',
  },
  'sa-vital-spirit': {
    id: 'sa-vital-spirit',
    name: 'Vital Spirit',
    effectL1: 'Ao falhar uma missão, o time tenta de novo 1× (mesma chance).',
    effectL2: 'Ao falhar uma missão, o time tenta de novo 1× (mesma chance); e ao perder um combate, tenta de novo sem perder vida.',
  },
  // ---- Defesa / dano recebido ----
  'sa-shell-armor': {
    id: 'sa-shell-armor',
    name: 'Shell Armor',
    effectL1: 'Recebe metade do dano em combate e missão (arredonda p/ cima: 3→2).',
    effectL2: 'Recebe 1/3 do dano em combate e missão (arredonda p/ cima: 3→1).',
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
    effectL2: '+80% em escolta / −80% em ensino.',
  },
  'sa-analytic': {
    id: 'sa-analytic',
    name: 'Analytic',
    effectL1: '+40% em ensino / −40% em patrulha.',
    effectL2: '+80% em ensino / −80% em patrulha.',
  },
  'sa-torrent': {
    id: 'sa-torrent',
    name: 'Torrent',
    effectL1: '+25% nos atributos com outro aliado do tipo Água na missão.',
    effectL2: '+50% nos atributos com outro aliado do tipo Água na missão.',
  },
  'sa-water-absorb': {
    id: 'sa-water-absorb',
    name: 'Water Absorb',
    effectL1: 'Sempre que a rota passa pela água, +30% de atributos na próxima missão.',
    effectL2: 'Sempre que a rota passa pela água, +50% de atributos na próxima missão.',
  },
  'sa-sniper': {
    id: 'sa-sniper',
    name: 'Sniper',
    effectL1: 'Faz missões sem sair do ginásio (à distância, só sozinho), mas a missão demora o dobro do tempo.',
    effectL2: 'Faz missões sem sair do ginásio (à distância, só sozinho), no tempo normal de missão.',
  },
  'sa-forewarn': {
    id: 'sa-forewarn',
    name: 'Forewarn',
    effectL1: 'Antecipa 1 missão do dia (cada portador antecipa mais uma).',
    effectL2: 'Antecipa 2 missões do dia (por portador).',
  },
  // ---- Clima / tempestade ----
  'sa-lightning-rod': {
    id: 'sa-lightning-rod',
    name: 'Lightning Rod',
    effectL1: 'O time inteiro que sai na missão fica imune ao efeito/dano de raio (basta o portador estar despachado).',
    effectL2: 'O time inteiro que sai na missão fica imune ao efeito/dano de raio; e quando o oponente é do tipo Elétrico, assume o duelo no lugar de quem está na frente.',
  },
  'sa-volt-absorb': {
    id: 'sa-volt-absorb',
    name: 'Volt Absorb',
    effectL1: 'Ao ser atingido por um raio, absorve (não toma o dano) e fica eletrizado pelo resto do dia: +30% de movimento e +30% nos atributos.',
    effectL2: 'Ao ser atingido por um raio, absorve (não toma o dano) e fica eletrizado pelo resto do dia: +90% de movimento e +90% nos atributos.',
  },
  'sa-static': {
    id: 'sa-static',
    name: 'Static',
    effectL1: 'Os raios sempre caem no ponto mais próximo dele (marca vermelha, cai após 5s); e, parado em missão, o time ganha +1 de XP por segundo parado.',
    effectL2: 'Os raios sempre caem no ponto mais próximo dele (marca vermelha, cai após 5s); e, parado em missão, o time ganha +1 de XP e +10% de movimento por segundo parado (movimento até +100%).',
  },
  'sa-cloud-nine': {
    id: 'sa-cloud-nine',
    name: 'Cloud Nine',
    effectL1: '+10pp na chance de chuva hoje e −10pp na chance de outros efeitos climáticos (acumula por portador).',
    effectL2: '+20pp na chance de chuva hoje e −20pp na chance de outros efeitos climáticos (acumula por portador).',
  },
  'sa-overcoat': {
    id: 'sa-overcoat',
    name: 'Overcoat',
    effectL1: '−10pp na chance de qualquer efeito climático acontecer no dia (acumula por portador).',
    effectL2: '−20pp na chance de qualquer efeito climático acontecer no dia (acumula por portador).',
  },
  'sa-own-tempo': {
    id: 'sa-own-tempo',
    name: 'Own Tempo',
    effectL1: 'No máximo 2 efeitos climáticos podem acontecer no dia. Não acumula: vale só o de maior nível.',
    effectL2: 'No máximo 1 efeito climático pode acontecer no dia. Não acumula: vale só o de maior nível.',
  },
  'sa-dry-skin': {
    id: 'sa-dry-skin',
    name: 'Dry Skin',
    effectL1: 'Ao sair em missão, −25% de vida no calor (sem efeito até existir clima de calor) / +25% de vida na chuva ou frio (chuva já funciona; frio sem efeito até existir).',
    effectL2: 'Ao sair em missão, −25% de vida no calor / +25% de vida na chuva ou frio; e −25% de bônus de missão no calor / +25% de bônus de missão na chuva ou frio (as partes de calor e frio ficam inertes até existirem esses climas; a chuva já funciona).',
  },
  'sa-clear-body': {
    id: 'sa-clear-body',
    name: 'Clear Body',
    effectL1: 'O time não recebe efeitos negativos de clima (ex.: paralisia por raio).',
    effectL2: 'O time não recebe efeitos negativos de clima (ex.: paralisia por raio) nem debuffs de habilidades secretas (ex.: −40% do Analytic em Patrulha).',
  },
  // ---- Inertes ----
  'sa-sand-rush': {
    id: 'sa-sand-rush',
    name: 'Sand Rush',
    effectL1: '+200% de velocidade do time durante tempestade de areia (sem efeito até existir tempestade de areia).',
    effectL2: '+300% de velocidade do time durante tempestade de areia (sem efeito até existir tempestade de areia).',
  },
  // ---- Celadon (Grama/Inseto) ----
  'sa-overgrow': {
    id: 'sa-overgrow',
    name: 'Overgrow',
    effectL1: '+25% nos atributos com outro aliado do tipo Grama na missão.',
    effectL2: '+50% nos atributos com outro aliado do tipo Grama na missão.',
  },
  'sa-swarm': {
    id: 'sa-swarm',
    name: 'Swarm',
    effectL1: '+25% nos atributos com outro aliado do tipo Inseto na missão.',
    effectL2: '+50% nos atributos com outro aliado do tipo Inseto na missão.',
  },
  'sa-spore': {
    id: 'sa-spore',
    name: 'Spore',
    effectL1: 'No início do dia, +10% em um atributo aleatório (vale o dia).',
    effectL2: 'No início do dia, +10% em três atributos aleatórios.',
  },
  'sa-leaf-guard': {
    id: 'sa-leaf-guard',
    name: 'Leaf Guard',
    effectL1:
      'Numa missão fracassada, só ele perde vida (dano normal); o resto do time é poupado. Com 2+ portadores, o de maior vida absorve.',
    effectL2:
      'Numa missão fracassada, só ele perde vida (dano normal) e o resto do time é poupado; e na defesa do ginásio, no lugar de cada aliado que perderia vida, ele toma metade do dano (4→2) e o resto não perde vida. Com 2+ portadores, o de maior vida absorve.',
  },
  'sa-tinted-lens': {
    id: 'sa-tinted-lens',
    name: 'Tinted Lens',
    effectL1: 'Em desvantagem de tipo no duelo, sua Batalha conta ×1.5 (compensa o golpe fraco).',
    effectL2: 'Em desvantagem de tipo, sua Batalha conta ×2.0.',
  },
  'sa-chlorophyll': {
    id: 'sa-chlorophyll',
    name: 'Chlorophyll',
    effectL1: '+200% de velocidade do time sob sol/calor (sem efeito até existir clima de calor).',
    effectL2: '+300% de velocidade do time sob sol/calor (sem efeito até existir clima de calor).',
  },
  'sa-gluttony': {
    id: 'sa-gluttony',
    name: 'Gluttony',
    effectL1: 'Cada berry usada nele concede +100 de XP (sem efeito até existirem berries).',
    effectL2: '+200 de XP por berry usada (sem efeito até existirem berries).',
  },
  'sa-harvest': {
    id: 'sa-harvest',
    name: 'Harvest',
    effectL1: 'Recebe 1 berry aleatória toda manhã (sem efeito até existirem berries).',
    effectL2: 'Recebe 2 berries aleatórias toda manhã (sem efeito até existirem berries).',
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
 * Os DOIS slots de habilidade secreta de cada linha (slots 0 e 1), chaveados pelo id da
 * forma-base (raiz).
 */
export const SECRET_LINES: Record<number, readonly [SecretId, SecretId]> = {
  // Vermilion
  25: ['sa-static', 'sa-dig'],
  81: ['sa-sturdy', 'sa-analytic'],
  100: ['sa-explosion', 'sa-rollout'],
  125: ['sa-vital-spirit', 'sa-volt-absorb'],
  145: ['sa-fly', 'sa-pressure'],
  // Pewter / Ground / Fóssil
  27: ['sa-rollout', 'sa-dig'],
  29: ['sa-rivalry', 'sa-hustle'],
  32: ['sa-rivalry', 'sa-hustle'],
  50: ['sa-dig', 'sa-sand-rush'],
  74: ['sa-sturdy', 'sa-explosion'],
  95: ['sa-sturdy', 'sa-weak-armor'],
  104: ['sa-battle-armor', 'sa-lightning-rod'],
  111: ['sa-rock-head', 'sa-reckless'],
  138: ['sa-swift-swim', 'sa-shell-armor'],
  140: ['sa-battle-armor', 'sa-swift-swim'],
  142: ['sa-fly', 'sa-rock-head'],
  // Dragão
  147: ['sa-surf', 'sa-fly'],
  // Cerulean
  7: ['sa-surf', 'sa-torrent'],
  54: ['sa-surf', 'sa-cloud-nine'],
  60: ['sa-surf', 'sa-water-absorb'],
  72: ['sa-clear-body', 'sa-surf'],
  79: ['sa-regenerator', 'sa-own-tempo'],
  86: ['sa-surf', 'sa-thick-fat'],
  90: ['sa-shell-armor', 'sa-overcoat'],
  98: ['sa-dig', 'sa-shell-armor'],
  116: ['sa-surf', 'sa-sniper'],
  118: ['sa-surf', 'sa-swift-swim'],
  120: ['sa-analytic', 'sa-natural-cure'],
  124: ['sa-dry-skin', 'sa-forewarn'],
  129: ['sa-surf', 'sa-moxie'],
  131: ['sa-surf', 'sa-shell-armor'],
  144: ['sa-fly', 'sa-pressure'],
  // Celadon (Grama/Inseto)
  1: ['sa-chlorophyll', 'sa-overgrow'],
  43: ['sa-chlorophyll', 'sa-spore'],
  69: ['sa-gluttony', 'sa-hustle'],
  102: ['sa-harvest', 'sa-analytic'],
  114: ['sa-regenerator', 'sa-leaf-guard'],
  10: ['sa-tinted-lens', 'sa-fly'],
  13: ['sa-sniper', 'sa-swarm'],
  46: ['sa-spore', 'sa-dig'],
  48: ['sa-fly', 'sa-forewarn'],
  123: ['sa-quick-feet', 'sa-fly'],
  127: ['sa-dig', 'sa-moxie'],
}

/**
 * Override por ESPÉCIE (precede a busca por raiz): para linhas divergentes onde a raiz é
 * compartilhada por evoluções de cidades diferentes. Eevee (133) vira Vaporeon/Jolteon/Flareon,
 * então `lineRootId(134)` colapsaria em 133 e vazaria a linha de água para os outros — aqui
 * Vaporeon e Jolteon recebem pares próprios sem afetar os demais eeveelutions.
 */
const SECRET_LINE_BY_SPECIES: Partial<Record<number, readonly [SecretId, SecretId]>> = {
  134: ['sa-surf', 'sa-water-absorb'], // Vaporeon
  135: ['sa-quick-feet', 'sa-volt-absorb'], // Jolteon
}

/** As DUAS habilidades (ids, slots 0 e 1) da linha de uma espécie — null se a linha não tem. */
export function secretLineFor(speciesId: number): readonly [SecretId, SecretId] | null {
  return SECRET_LINE_BY_SPECIES[speciesId] ?? SECRET_LINES[lineRootId(speciesId)] ?? null
}

/** Nível desta habilidade no indivíduo: 0 = não desbloqueada, 1 = base, 2 = "+". */
export function secretLevelOf(p: Pokemon, id: SecretId): 0 | 1 | 2 {
  const line = secretLineFor(p.speciesId)
  if (!line) return 0
  const slot = line[0] === id ? 0 : line[1] === id ? 1 : -1
  if (slot < 0) return 0
  const pick = (p.secretPicks ?? []).find((s) => s.slot === slot)
  return pick ? pick.level : 0
}

/** Tem a habilidade desbloqueada (nível ≥ 1)? */
export function hasSecret(p: Pokemon, id: SecretId): boolean {
  return secretLevelOf(p, id) >= 1
}

/** Habilidades ativas (id + nível) do indivíduo, na ordem dos slots. */
export function activeSecrets(p: Pokemon): Array<{ id: SecretId; level: 1 | 2 }> {
  const line = secretLineFor(p.speciesId)
  if (!line) return []
  return (p.secretPicks ?? [])
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({ id: line[s.slot], level: s.level }))
}
