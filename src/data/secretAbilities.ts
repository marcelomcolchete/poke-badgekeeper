// Habilidade Secreta (PLAN §3, ajuste): cada LINHA evolutiva tem uma passiva própria.
// Quando um Pokémon é o Destaque do Dia, ele desbloqueia a habilidade da sua linha — a
// passiva fica gravada no INDIVÍDUO (em pokemon.passives) e sobrevive à evolução. Outros
// Pokémon da mesma linha NÃO ganham automaticamente; cada um precisa virar destaque.
//
// O CONTEÚDO (nome + efeito) é definido por linha. Por ora só as linhas de Pedra/Ground
// existem (cidade de Pewter) — os textos abaixo são PLACEHOLDERS a preencher; os efeitos
// na engine entram depois que o nome/efeito de cada uma for definido.

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
  95: { id: 'secret-onix', name: 'A definir', description: 'A definir.' }, // Onix
  74: { id: 'secret-geodude', name: 'A definir', description: 'A definir.' }, // Geodude → Graveler → Golem
  27: { id: 'secret-sandshrew', name: 'A definir', description: 'A definir.' }, // Sandshrew → Sandslash
  50: { id: 'secret-diglett', name: 'A definir', description: 'A definir.' }, // Diglett → Dugtrio
  104: { id: 'secret-cubone', name: 'A definir', description: 'A definir.' }, // Cubone → Marowak
  111: { id: 'secret-rhyhorn', name: 'A definir', description: 'A definir.' }, // Rhyhorn → Rhydon
  29: { id: 'secret-nidoran-f', name: 'A definir', description: 'A definir.' }, // Nidoran♀ → Nidorina → Nidoqueen
  32: { id: 'secret-nidoran-m', name: 'A definir', description: 'A definir.' }, // Nidoran♂ → Nidorino → Nidoking
  138: { id: 'secret-omanyte', name: 'A definir', description: 'A definir.' }, // Omanyte → Omastar
  140: { id: 'secret-kabuto', name: 'A definir', description: 'A definir.' }, // Kabuto → Kabutops
  142: { id: 'secret-aerodactyl', name: 'A definir', description: 'A definir.' }, // Aerodactyl
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
