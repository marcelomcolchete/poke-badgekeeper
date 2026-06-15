// Habilidade Secreta (PLAN §3, ajuste): cada LINHA evolutiva tem uma passiva própria.
// Quando um Pokémon é o Destaque do Dia, ele desbloqueia a habilidade da sua linha — a
// passiva fica gravada no INDIVÍDUO (em pokemon.passives) e sobrevive à evolução. Outros
// Pokémon da mesma linha NÃO ganham automaticamente; cada um precisa virar destaque.
//
// O CONTEÚDO (nome + efeito) é definido por linha. Linhas de Pedra/Ground (Pewter).
// Os textos abaixo são os exibidos ao jogador; a LÓGICA de cada efeito vive na engine
// (ver engine/secretEffects.ts) e é amarrada por id da passiva.

import type { Pokemon } from '../types/index.ts'
import { EVOLUTIONS } from './pokemon/evolutions.generated.ts'

/** Níveis da Habilidade Secreta: 1 = Bronze, 2 = Prata, 3 = Ouro (máximo). */
export const SECRET_MAX_LEVEL = 3

export interface SecretAbility {
  /** Id estável da passiva (gravado em pokemon.passives ao desbloquear). NÃO mudar. */
  id: string
  name: string
  /** Descrição por nível: índice 0 = Bronze (1), 1 = Prata (2), 2 = Ouro (3). */
  levels: [string, string, string]
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
 * Habilidade Secreta por LINHA, chaveada pelo id da forma-base (raiz).
 * Linhas de Pedra/Ground (Pewter). PLACEHOLDERS — preencher name/description.
 */
export const SECRET_ABILITIES: Record<number, SecretAbility> = {
  // Onix — Weak Armor
  95: {
    id: 'secret-onix',
    name: 'Weak Armor',
    levels: [
      'Ao receber dano perde o dobro de vida, mas dá +50% de velocidade ao time pelo resto do dia em missões.',
      'Ao receber dano perde o dobro de vida, mas dá +100% de velocidade ao time pelo resto do dia em missões.',
      'Ao receber dano perde o dobro de vida, mas dá +200% de velocidade ao time pelo resto do dia em missões.',
    ],
  },
  // Geodude → Graveler → Golem — Sturdy
  74: {
    id: 'secret-geodude',
    name: 'Sturdy',
    levels: [
      'Quando morreria em missão ou batalha, não desmaia: fica com 1 de vida. (1× por jogo)',
      'Quando morreria em missão ou batalha, não desmaia: fica com 1 de vida. (1× por dia)',
      'Quando morreria em missão ou batalha, não desmaia: recupera toda a vida. (1× por dia)',
    ],
  },
  // Sandshrew → Sandslash — Rollout
  27: {
    id: 'secret-sandshrew',
    name: 'Rollout',
    levels: [
      'Ao derrotar um Pokémon ganha +10% de bônus de batalha no duelo com o próximo (acumula na sequência).',
      'Ao derrotar um Pokémon ganha +15% de bônus de batalha no duelo com o próximo (acumula na sequência).',
      'Ao derrotar um Pokémon ganha +25% de bônus de batalha no duelo com o próximo (acumula na sequência).',
    ],
  },
  // Diglett → Dugtrio — Dig
  50: {
    id: 'secret-diglett',
    name: 'Dig',
    levels: [
      'Abre dois buracos no mapa ligando os dois pontos; o time atravessa por baixo da terra.',
      'Abre três buracos no mapa ligando os três pontos; o time atravessa por baixo da terra.',
      'Abre três buracos no mapa ligando os três pontos, um sempre no ginásio; o time atravessa por baixo da terra.',
    ],
  },
  // Cubone → Marowak — Battle Armor
  104: {
    id: 'secret-cubone',
    name: 'Battle Armor',
    levels: [
      'Ao participar de uma batalha (ginásio ou Rocket) ganha +30% em todos os atributos na próxima missão.',
      'Ao participar de uma batalha (ginásio ou Rocket) ganha +50% em todos os atributos na próxima missão.',
      'Ao participar de uma batalha (ginásio ou Rocket) ganha +100% em todos os atributos na próxima missão.',
    ],
  },
  // Rhyhorn → Rhydon — Rock Head
  111: {
    id: 'secret-rhyhorn',
    name: 'Rock Head',
    levels: [
      '+50% em todos os atributos em missões de escolta e −50% em missões de ensino.',
      '+75% em todos os atributos em missões de escolta e −60% em missões de ensino.',
      '+100% em todos os atributos em missões de escolta e −70% em missões de ensino.',
    ],
  },
  // Nidoran♀ → Nidorina → Nidoqueen — Rivalidade
  29: {
    id: 'secret-nidoran-f',
    name: 'Rivalidade',
    levels: [
      '+10% em todos os atributos na missão para cada Pokémon do mesmo gênero no time.',
      '+10% por aliado do mesmo gênero e +15% de bônus em batalha contra Pokémon do mesmo gênero.',
      '+20% por aliado do mesmo gênero e +30% de bônus em batalha contra Pokémon do mesmo gênero.',
    ],
  },
  // Nidoran♂ → Nidorino → Nidoking — Rivalidade
  32: {
    id: 'secret-nidoran-m',
    name: 'Rivalidade',
    levels: [
      '+10% em todos os atributos na missão para cada Pokémon do mesmo gênero no time.',
      '+10% por aliado do mesmo gênero e +15% de bônus em batalha contra Pokémon do mesmo gênero.',
      '+20% por aliado do mesmo gênero e +30% de bônus em batalha contra Pokémon do mesmo gênero.',
    ],
  },
  // Omanyte → Omastar — Shell Armor
  138: {
    id: 'secret-omanyte',
    name: 'Shell Armor',
    levels: [
      'Quando receberia dano de vida, o dano vira 0 e recebe −50% de velocidade na próxima missão.',
      'Quando receberia dano de vida, o dano vira 0 e recebe −25% de velocidade na próxima missão.',
      'Quando receberia dano de vida, o dano vira 0.',
    ],
  },
  // Kabuto → Kabutops — Weak Armor
  140: {
    id: 'secret-kabuto',
    name: 'Weak Armor',
    levels: [
      'Ao receber dano perde o dobro de vida, mas dá +50% de velocidade ao time pelo resto do dia em missões.',
      'Ao receber dano perde o dobro de vida, mas dá +100% de velocidade ao time pelo resto do dia em missões.',
      'Ao receber dano perde o dobro de vida, mas dá +200% de velocidade ao time pelo resto do dia em missões.',
    ],
  },
  // Aerodactyl — Fly
  142: {
    id: 'secret-aerodactyl',
    name: 'Fly',
    levels: [
      'Voa em linha reta do ginásio até a tarefa — bem mais rápido. Só quando despachado sozinho.',
      'Voa em linha reta do ginásio até a tarefa, +50% de velocidade. Só quando despachado sozinho.',
      'Voa em linha reta do ginásio até a tarefa, +50% de velocidade. Funciona também em time.',
    ],
  },
}

/** Habilidade Secreta da linha de uma espécie (null se a linha não tem uma definida). */
export function secretAbilityFor(speciesId: number): SecretAbility | null {
  return SECRET_ABILITIES[lineRootId(speciesId)] ?? null
}

/** Um Pokémon já desbloqueou a Habilidade Secreta da sua linha? (passiva no indivíduo). */
export function hasSecretAbility(passives: readonly string[], speciesId: number): boolean {
  const ability = secretAbilityFor(speciesId)
  return ability ? passives.includes(ability.id) : false
}

/**
 * Nível da Habilidade Secreta desbloqueada deste Pokémon (0 = não desbloqueada). Saves
 * antigos têm a passiva sem secretLevel → tratados como nível 1 (Bronze já conquistado).
 */
export function secretLevelOf(p: Pokemon): number {
  const ability = secretAbilityFor(p.speciesId)
  if (!ability || !p.passives.includes(ability.id)) return 0
  return Math.min(SECRET_MAX_LEVEL, Math.max(1, p.secretLevel ?? 1))
}

/** Descrição da Habilidade Secreta no nível dado (1..3), com clamp defensivo. */
export function secretDescriptionAt(ability: SecretAbility, level: number): string {
  const i = Math.min(SECRET_MAX_LEVEL, Math.max(1, level)) - 1
  return ability.levels[i] ?? ability.levels[0]
}

/** Rótulo do nível: Bronze / Prata / Ouro. */
export const SECRET_TIER_LABEL: Record<number, string> = { 1: 'Bronze', 2: 'Prata', 3: 'Ouro' }
