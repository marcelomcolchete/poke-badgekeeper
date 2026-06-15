// Habilidade Secreta (PLAN §3, ajuste): cada LINHA evolutiva tem uma passiva própria.
// Quando um Pokémon é o Destaque do Dia, ele desbloqueia a habilidade da sua linha — a
// passiva fica gravada no INDIVÍDUO (em pokemon.passives) e sobrevive à evolução. Outros
// Pokémon da mesma linha NÃO ganham automaticamente; cada um precisa virar destaque.
//
// O CONTEÚDO (nome + efeito) é definido por linha. Linhas de Pedra/Ground (Pewter).
// Os textos abaixo são os exibidos ao jogador; a LÓGICA de cada efeito vive na engine
// (ver engine/secretEffects.ts) e é amarrada por id da passiva.

import { EVOLUTIONS } from './pokemon/evolutions.generated.ts'

export interface SecretAbility {
  /** Id estável da passiva (gravado em pokemon.passives ao desbloquear). NÃO mudar. */
  id: string
  name: string
  description: string
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
    description: 'Sempre que recebe dano perde o dobro de vida, mas ganha +50% de velocidade pelo resto do dia em missões.',
  },
  // Geodude → Graveler → Golem — Sturdy
  74: {
    id: 'secret-geodude',
    name: 'Sturdy',
    description: 'Ao ser derrotado defendendo o ginásio, não desmaia: fica com 1 de vida.',
  },
  // Sandshrew → Sandslash — Sand Rush
  27: {
    id: 'secret-sandshrew',
    name: 'Sand Rush',
    description: '+25% de velocidade do time em missão a cada tarefa concluída com sucesso; zera ao falhar uma tarefa.',
  },
  // Diglett → Dugtrio — Dig
  50: {
    id: 'secret-diglett',
    name: 'Dig',
    description: 'Abre dois buracos no mapa ligando dois pontos: o time atravessa de um ao outro por baixo da terra.',
  },
  // Cubone → Marowak — Battle Armor
  104: {
    id: 'secret-cubone',
    name: 'Battle Armor',
    description: 'Sempre que defende o ginásio, ganha +50% de bônus na próxima missão.',
  },
  // Rhyhorn → Rhydon — Rock Head
  111: {
    id: 'secret-rhyhorn',
    name: 'Rock Head',
    description: 'Tem +20% de vantagem em missões de escolta.',
  },
  // Nidoran♀ → Nidorina → Nidoqueen — Rivalidade
  29: {
    id: 'secret-nidoran-f',
    name: 'Rivalidade',
    description: '+10% em todos os atributos na missão se houver um Pokémon do mesmo gênero no time.',
  },
  // Nidoran♂ → Nidorino → Nidoking — Rivalidade
  32: {
    id: 'secret-nidoran-m',
    name: 'Rivalidade',
    description: '+10% em todos os atributos na missão se houver um Pokémon do mesmo gênero no time.',
  },
  // Omanyte → Omastar — Shell Armor
  138: {
    id: 'secret-omanyte',
    name: 'Shell Armor',
    description: '+50% de vantagem em missões de escolta e −50% em missões de patrulha.',
  },
  // Kabuto → Kabutops — Weak Armor
  140: {
    id: 'secret-kabuto',
    name: 'Weak Armor',
    description: 'Sempre que recebe dano perde o dobro de vida, mas ganha +50% de velocidade pelo resto do dia em missões.',
  },
  // Aerodactyl — Fly
  142: {
    id: 'secret-aerodactyl',
    name: 'Fly',
    description: 'Voa em linha reta do ginásio até o local da tarefa — bem mais rápido. Só quando despachado sozinho.',
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
