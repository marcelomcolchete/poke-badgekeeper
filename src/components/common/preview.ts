// Pokémon "de preview" para mostrar cartas na UI.
//
// Sem `seed`: alocações/IVs zerados, sem natureza, HP cheio — determinístico e barato,
// usado quando o card é só ilustrativo. Com `seed`: monta o Pokémon REAL e determinístico
// (natureza, IVs/rank, gênero e pontos), de modo que o card mostrado seja EXATAMENTE o
// Pokémon que será obtido (inicial/recrutas e candidatos de captura).

import type { Pokemon } from '../../types/index.ts'
import { getSpecies } from '../../data/pokemon/index.ts'
import { maxHpOf, zeroAttrs } from '../../engine/attributes.ts'
import { createPokemon } from '../../engine/leveling.ts'
import { createRng } from '../../engine/rng.ts'

export interface PreviewOpts {
  nickname?: string
  /** Seed estável: quando presente, o preview = Pokémon real criado com esse seed. */
  seed?: number
  /** Percepção do explorador (captura): enviesa os IVs/rank do preview ao do candidato real. */
  searcherPerception?: number
  /** Força o preview a ser shiny (rank S + sprite/flag) — iniciais e candidatos. */
  shiny?: boolean
}

export function previewPokemon(speciesId: number, level: number, opts: PreviewOpts = {}): Pokemon {
  const nickname = opts.nickname?.trim() || null
  if (opts.seed !== undefined) {
    return createPokemon({
      id: `preview-${speciesId}`,
      speciesId,
      level,
      rng: createRng(opts.seed),
      nickname,
      searcherPerception: opts.searcherPerception,
      shiny: opts.shiny,
    })
  }
  const species = getSpecies(speciesId)
  const draft: Pokemon = {
    id: `preview-${speciesId}`,
    speciesId,
    level,
    xp: 0,
    types: [...species.types],
    baseAttrs: { ...species.baseAttrs },
    ivs: zeroAttrs(),
    allocations: zeroAttrs(),
    currentHp: 0,
    maxHp: 0,
    status: 'idle',
    passives: [],
    // Preview de candidato: o sexo só é sorteado de fato na captura.
    gender: 'genderless',
    nickname,
    // Preview neutro não sorteia natureza — só na captura/criação real.
    nature: null,
  }
  const maxHp = maxHpOf(draft)
  return { ...draft, maxHp, currentHp: maxHp }
}
