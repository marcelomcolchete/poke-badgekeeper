# Treinadores temáticos + líder das cidades 3–8 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar às cidades 3–8 (Vermilion, Celadon, Fuchsia, Saffron, Cinnabar, Viridian) um elenco próprio de invasores do ginásio — líder canônico + 5 treinadores temáticos — com rosters amplos por tipo derivados dos dados.

**Architecture:** Mudança 100% de dados. Três seletores novos em `pokemon/index.ts` montam pools de espécies por tipo / estágio evolutivo; `types/index.ts` ganha 36 ids; `trainers.ts` ganha 36 `TrainerDef`; `cities.ts` liga uma lista por cidade ao `SEEDS`. O engine (`game/setup.ts`) já consome `city.trainers` — não muda.

**Tech Stack:** TypeScript (ESM, extensões `.ts` nos imports), Vitest, React 19/Vite.

## Global Constraints

- Imports usam extensão explícita `.ts` (ESM). Ex.: `from './pokemon/index.ts'`.
- Comentários e `displayName` em português, no estilo do arquivo existente.
- Rodar testes de um arquivo: `npx vitest run <caminho>`. Suíte toda: `npm test`.
- Checagem de tipos/build: `npm run build` (é `tsc -b`); **não** usar `tsc --noEmit` (o tsconfig raiz é solution-only).
- Pools por tipo/estágio **excluem lendários** (as 5 espécies `rarity: "legend"`: 144 Articuno, 145 Zapdos, 146 Moltres, 150 Mewtwo, 151 Mew).
- Sprites em `/sprites/trainers/gen3/<classe>-gen3.png`; `altSprites` `-gen3rs` só quando o arquivo existe (lista exata na Task 3).
- Líderes entram como `TrainerDef` `roster` comuns (sem flag) e são o 1º item da lista da cidade.
- Não alterar Misty/Brock/Cerulean/rivais/Rocket.

---

### Task 1: Seletores de pool em `pokemon/index.ts`

**Files:**
- Modify: `src/data/pokemon/index.ts`
- Test: `src/data/poolSelectors.test.ts` (criar)

**Interfaces:**
- Consumes: `speciesByType`, `evolutionFamily`, `allSpecies` (já existentes neste módulo); `EVO_PARENT` (Map privado já existente no módulo); `PokemonType` de `../../types/index.ts`.
- Produces:
  - `familiesByType(...types: PokemonType[]): number[]`
  - `baseStageSpecies(): number[]`
  - `evolvedSpecies(): number[]`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/data/poolSelectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  allSpecies,
  baseStageSpecies,
  evolvedSpecies,
  familiesByType,
  getSpecies,
} from './pokemon/index.ts'

const LEGENDARIES = [144, 145, 146, 150, 151]

describe('familiesByType', () => {
  it('traz a família inteira de um tipo (Charmander 4 e Charizard 6 em fire)', () => {
    const fire = familiesByType('fire')
    expect(fire).toContain(4) // Charmander
    expect(fire).toContain(6) // Charizard (fire/flying — entra pela família)
  })

  it('exclui lendários (Moltres 146 não está em fire; Mewtwo 150/Mew 151 não em psychic)', () => {
    expect(familiesByType('fire')).not.toContain(146)
    const psychic = familiesByType('psychic')
    expect(psychic).not.toContain(150)
    expect(psychic).not.toContain(151)
  })

  it('multi-tipo é a união (water+flying contém Squirtle 7 e Pidgey 16)', () => {
    const pool = familiesByType('water', 'flying')
    expect(pool).toContain(7)
    expect(pool).toContain(16)
  })

  it('vem ordenado e sem repetição', () => {
    const pool = familiesByType('poison', 'dragon')
    const sorted = [...pool].sort((a, b) => a - b)
    expect(pool).toEqual(sorted)
    expect(new Set(pool).size).toBe(pool.length)
  })
})

describe('baseStageSpecies / evolvedSpecies', () => {
  it('baseStageSpecies tem formas-base (Bulbasaur 1) e não evoluídos (Ivysaur 2)', () => {
    expect(baseStageSpecies()).toContain(1)
    expect(baseStageSpecies()).not.toContain(2)
  })

  it('evolvedSpecies é o inverso (Ivysaur 2 sim, Bulbasaur 1 não)', () => {
    expect(evolvedSpecies()).toContain(2)
    expect(evolvedSpecies()).not.toContain(1)
  })

  it('ambos excluem lendários', () => {
    for (const id of LEGENDARIES) {
      expect(baseStageSpecies(), `base não deve ter ${id}`).not.toContain(id)
      expect(evolvedSpecies(), `evoluídos não deve ter ${id}`).not.toContain(id)
    }
  })

  it('são disjuntos e cobrem todas as 146 espécies não-lendárias', () => {
    const base = new Set(baseStageSpecies())
    const evolved = new Set(evolvedSpecies())
    for (const id of base) expect(evolved.has(id)).toBe(false)
    const nonLegend = allSpecies().filter((s) => getSpecies(s.id).rarity !== 'legend')
    expect(base.size + evolved.size).toBe(nonLegend.length)
    expect(nonLegend).toHaveLength(146)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/data/poolSelectors.test.ts`
Expected: FAIL — `baseStageSpecies`/`evolvedSpecies`/`familiesByType` não exportados (erro de import).

- [ ] **Step 3: Implementar os seletores**

Em `src/data/pokemon/index.ts`, depois de `evolutionFamily` (e antes de `getSpecies`), adicionar:

```ts
/**
 * Linhas evolutivas Gen1 que tocam algum dos `types` (primário ou secundário de qualquer
 * estágio): expande cada espécie do tipo pela família inteira, remove lendários e ordena.
 * Base dos rosters "amplos por tipo" dos treinadores (data/trainers — PLAN §4.4).
 */
export function familiesByType(...types: PokemonType[]): number[] {
  const ids = new Set<number>()
  for (const type of types) {
    for (const species of speciesByType(type)) {
      for (const id of evolutionFamily(species.id)) ids.add(id)
    }
  }
  return [...ids].filter((id) => getSpecies(id).rarity !== 'legend').sort((a, b) => a - b)
}

/** Formas-base (1ª evolução): espécies SEM pré-evolução, sem lendários, ordenadas. */
export function baseStageSpecies(): number[] {
  return allSpecies()
    .filter((s) => !EVO_PARENT.has(s.id) && s.rarity !== 'legend')
    .map((s) => s.id)
    .sort((a, b) => a - b)
}

/** Pokémon evoluídos (2ª forma ou mais): espécies COM pré-evolução, ordenadas. */
export function evolvedSpecies(): number[] {
  return allSpecies()
    .filter((s) => EVO_PARENT.has(s.id))
    .map((s) => s.id)
    .sort((a, b) => a - b)
}
```

(`EVO_PARENT`, `speciesByType`, `evolutionFamily`, `allSpecies`, `getSpecies` já existem no módulo; `PokemonType` já é importado no topo.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/data/poolSelectors.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add src/data/pokemon/index.ts src/data/poolSelectors.test.ts
git commit -m "feat(pokemon): seletores de pool por tipo/estágio (sem lendários)"
```

---

### Task 2: Ids e definições dos 36 treinadores

**Files:**
- Modify: `src/types/index.ts:54-72` (array `TRAINER_IDS`)
- Modify: `src/data/trainers.ts` (imports + `TRAINER_LIST`)
- Test: `src/data/trainersCities.test.ts` (criar)

**Interfaces:**
- Consumes: `familiesByType`, `baseStageSpecies`, `evolvedSpecies` (Task 1); `roster`, `TrainerDef`, `getTrainer` (já em `trainers.ts`); `TRAINER_IDS`, `TrainerId` (`types/index.ts`).
- Produces: 36 novos `TrainerId` e seus `TrainerDef` resolvíveis por `getTrainer`. Ids exatos listados abaixo (consumidos pela Task 3).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/data/trainersCities.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { TrainerId } from '../types/index.ts'
import { getTrainer } from './trainers.ts'

// Os 36 ids novos (6 líderes + 30 classes) — fonte da verdade para os testes.
const NEW_TRAINER_IDS: TrainerId[] = [
  'SURGE', 'VERMILION_ENGINEER', 'VERMILION_ROCKER', 'VERMILION_SAILOR',
  'VERMILION_GENTLEMAN', 'VERMILION_POKEMANIAC',
  'ERIKA', 'CELADON_BEAUTY', 'CELADON_LASS', 'CELADON_PICNICKER',
  'CELADON_BUGCATCHER', 'CELADON_GAMER',
  'KOGA', 'FUCHSIA_JUGGLER', 'FUCHSIA_TAMER', 'FUCHSIA_DRAGONTAMER',
  'FUCHSIA_BIRDKEEPER', 'FUCHSIA_SWIMMER',
  'SABRINA', 'SAFFRON_ACETRAINER', 'SAFFRON_SCIENTIST', 'SAFFRON_CHANNELER',
  'SAFFRON_HEXMANIAC', 'SAFFRON_BLACKBELT',
  'BLAINE', 'CINNABAR_BURGLAR', 'CINNABAR_SUPERNERD', 'CINNABAR_BLACKBELT',
  'CINNABAR_KINDLER', 'CINNABAR_SWIMMER',
  'GIOVANNI', 'VIRIDIAN_TAMER', 'VIRIDIAN_ACETRAINER', 'VIRIDIAN_YOUNGSTER',
  'VIRIDIAN_CAMPER', 'VIRIDIAN_BIKER',
]

describe('treinadores das cidades 3–8', () => {
  it('todo id novo resolve em getTrainer com nome e sprite', () => {
    for (const id of NEW_TRAINER_IDS) {
      const t = getTrainer(id)
      expect(t.displayName, id).toBeTruthy()
      expect(t.spritePath, id).toMatch(/^\/sprites\/trainers\/gen3\/.+-gen3(rs)?\.png$/)
    }
  })

  it('todo elenco resolvido é roster não-vazio', () => {
    for (const id of NEW_TRAINER_IDS) {
      const { pool } = getTrainer(id)
      expect(pool.kind, id).toBe('roster')
      if (pool.kind === 'roster') expect(pool.speciesIds.length, id).toBeGreaterThan(0)
    }
  })

  it('altSprites, quando presentes, também são gen3rs válidos', () => {
    for (const id of NEW_TRAINER_IDS) {
      for (const alt of getTrainer(id).altSprites ?? []) {
        expect(alt, id).toMatch(/^\/sprites\/trainers\/gen3\/.+-gen3rs\.png$/)
      }
    }
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/data/trainersCities.test.ts`
Expected: FAIL — erro de tipo/lança em `getTrainer('SURGE')` (id inexistente).

- [ ] **Step 3a: Adicionar os ids em `TRAINER_IDS`**

Em `src/types/index.ts`, dentro do array `TRAINER_IDS` (após a entrada `'POKEFAN',`, antes do `] as const`):

```ts
  // Vermilion (3) — electric/dragon.
  'SURGE',
  'VERMILION_ENGINEER',
  'VERMILION_ROCKER',
  'VERMILION_SAILOR',
  'VERMILION_GENTLEMAN',
  'VERMILION_POKEMANIAC',
  // Celadon (4) — grass/bug.
  'ERIKA',
  'CELADON_BEAUTY',
  'CELADON_LASS',
  'CELADON_PICNICKER',
  'CELADON_BUGCATCHER',
  'CELADON_GAMER',
  // Fuchsia (5) — poison/dragon.
  'KOGA',
  'FUCHSIA_JUGGLER',
  'FUCHSIA_TAMER',
  'FUCHSIA_DRAGONTAMER',
  'FUCHSIA_BIRDKEEPER',
  'FUCHSIA_SWIMMER',
  // Saffron (6) — psychic/ghost.
  'SABRINA',
  'SAFFRON_ACETRAINER',
  'SAFFRON_SCIENTIST',
  'SAFFRON_CHANNELER',
  'SAFFRON_HEXMANIAC',
  'SAFFRON_BLACKBELT',
  // Cinnabar (7) — fire/fighting.
  'BLAINE',
  'CINNABAR_BURGLAR',
  'CINNABAR_SUPERNERD',
  'CINNABAR_BLACKBELT',
  'CINNABAR_KINDLER',
  'CINNABAR_SWIMMER',
  // Viridian (8) — ground/normal.
  'GIOVANNI',
  'VIRIDIAN_TAMER',
  'VIRIDIAN_ACETRAINER',
  'VIRIDIAN_YOUNGSTER',
  'VIRIDIAN_CAMPER',
  'VIRIDIAN_BIKER',
```

- [ ] **Step 3b: Atualizar imports em `trainers.ts`**

Em `src/data/trainers.ts`, trocar a linha de import do módulo de espécies:

```ts
import { evolutionFamily } from './pokemon/index.ts'
```

por:

```ts
import {
  baseStageSpecies,
  evolutionFamily,
  evolvedSpecies,
  familiesByType,
} from './pokemon/index.ts'
```

- [ ] **Step 3c: Adicionar os 36 `TrainerDef` em `TRAINER_LIST`**

Em `src/data/trainers.ts`, dentro do array `TRAINER_LIST`, **antes** do bloco "Equipe Rocket" (a entrada `id: 'ROCKET_TEAM_FEMALE'`), inserir:

```ts
  // ===================== Vermilion (3) — electric/dragon =====================
  {
    id: 'SURGE',
    displayName: 'Surge',
    spritePath: '/sprites/trainers/gen3/ltsurge-gen3.png',
    pool: roster(familiesByType('electric')),
  },
  {
    id: 'VERMILION_ENGINEER',
    displayName: 'Engenheiro',
    spritePath: '/sprites/trainers/gen3/engineer-gen3.png',
    pool: roster(familiesByType('electric')),
  },
  {
    id: 'VERMILION_ROCKER',
    displayName: 'Roqueiro',
    spritePath: '/sprites/trainers/gen3/rocker-gen3.png',
    pool: roster(familiesByType('electric')),
  },
  {
    id: 'VERMILION_SAILOR',
    displayName: 'Marinheiro',
    spritePath: '/sprites/trainers/gen3/sailor-gen3.png',
    altSprites: ['/sprites/trainers/gen3/sailor-gen3rs.png'],
    pool: roster(familiesByType('flying', 'water')),
  },
  {
    id: 'VERMILION_GENTLEMAN',
    displayName: 'Cavalheiro',
    spritePath: '/sprites/trainers/gen3/gentleman-gen3.png',
    altSprites: ['/sprites/trainers/gen3/gentleman-gen3rs.png'],
    pool: roster(familiesByType('electric', 'dragon')),
  },
  {
    id: 'VERMILION_POKEMANIAC',
    displayName: 'Pokemaníaco',
    spritePath: '/sprites/trainers/gen3/pokemaniac-gen3.png',
    altSprites: ['/sprites/trainers/gen3/pokemaniac-gen3rs.png'],
    pool: roster(familiesByType('ground', 'rock', 'poison')),
  },
  // ===================== Celadon (4) — grass/bug =====================
  {
    id: 'ERIKA',
    displayName: 'Erika',
    spritePath: '/sprites/trainers/gen3/erika-gen3.png',
    pool: roster(familiesByType('grass')),
  },
  {
    id: 'CELADON_BEAUTY',
    displayName: 'Beldade',
    spritePath: '/sprites/trainers/gen3/beauty-gen3.png',
    altSprites: ['/sprites/trainers/gen3/beauty-gen3rs.png'],
    pool: roster(familiesByType('grass')),
  },
  {
    id: 'CELADON_LASS',
    displayName: 'Moça',
    spritePath: '/sprites/trainers/gen3/lass-gen3.png',
    altSprites: ['/sprites/trainers/gen3/lass-gen3rs.png'],
    pool: roster(familiesByType('grass')),
  },
  {
    id: 'CELADON_PICNICKER',
    displayName: 'Campista',
    spritePath: '/sprites/trainers/gen3/picnicker-gen3.png',
    altSprites: ['/sprites/trainers/gen3/picnicker-gen3rs.png'],
    pool: roster(familiesByType('normal')),
  },
  {
    id: 'CELADON_BUGCATCHER',
    displayName: 'Caçador de Insetos',
    spritePath: '/sprites/trainers/gen3/bugcatcher-gen3.png',
    altSprites: ['/sprites/trainers/gen3/bugcatcher-gen3rs.png'],
    pool: roster(familiesByType('bug')),
  },
  {
    id: 'CELADON_GAMER',
    displayName: 'Jogador',
    spritePath: '/sprites/trainers/gen3/gamer-gen3.png',
    pool: roster(familiesByType('fighting')),
  },
  // ===================== Fuchsia (5) — poison/dragon =====================
  {
    id: 'KOGA',
    displayName: 'Koga',
    spritePath: '/sprites/trainers/gen3/koga-gen3.png',
    pool: roster(familiesByType('poison')),
  },
  {
    id: 'FUCHSIA_JUGGLER',
    displayName: 'Malabarista',
    spritePath: '/sprites/trainers/gen3/juggler-gen3.png',
    pool: roster(familiesByType('fire', 'poison')),
  },
  {
    id: 'FUCHSIA_TAMER',
    displayName: 'Domador',
    spritePath: '/sprites/trainers/gen3/tamer-gen3.png',
    pool: roster(familiesByType('poison')),
  },
  {
    id: 'FUCHSIA_DRAGONTAMER',
    displayName: 'Domador de Dragões',
    spritePath: '/sprites/trainers/gen3/dragontamer-gen3.png',
    pool: roster(familiesByType('poison', 'dragon')),
  },
  {
    id: 'FUCHSIA_BIRDKEEPER',
    displayName: 'Criador de Aves',
    spritePath: '/sprites/trainers/gen3/birdkeeper-gen3.png',
    altSprites: ['/sprites/trainers/gen3/birdkeeper-gen3rs.png'],
    pool: roster(familiesByType('flying', 'dragon')),
  },
  {
    id: 'FUCHSIA_SWIMMER',
    displayName: 'Nadador',
    spritePath: '/sprites/trainers/gen3/swimmerm-gen3.png',
    altSprites: ['/sprites/trainers/gen3/swimmerm-gen3rs.png'],
    pool: roster(familiesByType('water')),
  },
  // ===================== Saffron (6) — psychic/ghost =====================
  {
    id: 'SABRINA',
    displayName: 'Sabrina',
    spritePath: '/sprites/trainers/gen3/sabrina-gen3.png',
    pool: roster(familiesByType('psychic')),
  },
  {
    id: 'SAFFRON_ACETRAINER',
    displayName: 'Treinador de Elite',
    spritePath: '/sprites/trainers/gen3/acetrainer-gen3.png',
    altSprites: ['/sprites/trainers/gen3/acetrainer-gen3rs.png'],
    pool: roster(familiesByType('fire', 'psychic')),
  },
  {
    id: 'SAFFRON_SCIENTIST',
    displayName: 'Cientista',
    spritePath: '/sprites/trainers/gen3/scientist-gen3.png',
    pool: roster(familiesByType('psychic')),
  },
  {
    id: 'SAFFRON_CHANNELER',
    displayName: 'Médium',
    spritePath: '/sprites/trainers/gen3/channeler-gen3.png',
    pool: roster(familiesByType('psychic', 'ghost')),
  },
  {
    id: 'SAFFRON_HEXMANIAC',
    displayName: 'Bruxa',
    spritePath: '/sprites/trainers/gen3/hexmaniac-gen3.png',
    pool: roster(familiesByType('poison', 'ghost')),
  },
  {
    id: 'SAFFRON_BLACKBELT',
    displayName: 'Faixa-Preta',
    spritePath: '/sprites/trainers/gen3/blackbelt-gen3.png',
    altSprites: ['/sprites/trainers/gen3/blackbelt-gen3rs.png'],
    pool: roster(familiesByType('fighting')),
  },
  // ===================== Cinnabar (7) — fire/fighting =====================
  {
    id: 'BLAINE',
    displayName: 'Blaine',
    spritePath: '/sprites/trainers/gen3/blaine-gen3.png',
    pool: roster(familiesByType('fire')),
  },
  {
    id: 'CINNABAR_BURGLAR',
    displayName: 'Ladrão',
    spritePath: '/sprites/trainers/gen3/burglar-gen3.png',
    pool: roster(familiesByType('water', 'rock')),
  },
  {
    id: 'CINNABAR_SUPERNERD',
    displayName: 'Super Nerd',
    spritePath: '/sprites/trainers/gen3/supernerd-gen3.png',
    pool: roster(familiesByType('psychic', 'normal')),
  },
  {
    id: 'CINNABAR_BLACKBELT',
    displayName: 'Faixa-Preta',
    spritePath: '/sprites/trainers/gen3/blackbelt-gen3.png',
    altSprites: ['/sprites/trainers/gen3/blackbelt-gen3rs.png'],
    pool: roster(familiesByType('fighting')),
  },
  {
    id: 'CINNABAR_KINDLER',
    displayName: 'Incendiário',
    spritePath: '/sprites/trainers/gen3/kindler-gen3.png',
    pool: roster(familiesByType('fire')),
  },
  {
    id: 'CINNABAR_SWIMMER',
    displayName: 'Nadador',
    spritePath: '/sprites/trainers/gen3/swimmerm-gen3.png',
    altSprites: ['/sprites/trainers/gen3/swimmerm-gen3rs.png'],
    pool: roster(familiesByType('water')),
  },
  // ===================== Viridian (8) — ground/normal =====================
  {
    id: 'GIOVANNI',
    displayName: 'Giovanni',
    spritePath: '/sprites/trainers/gen3/giovanni-gen3.png',
    pool: roster(familiesByType('ground')),
  },
  {
    id: 'VIRIDIAN_TAMER',
    displayName: 'Domador',
    spritePath: '/sprites/trainers/gen3/tamer-gen3.png',
    pool: roster(familiesByType('normal')),
  },
  {
    id: 'VIRIDIAN_ACETRAINER',
    displayName: 'Treinador de Elite',
    spritePath: '/sprites/trainers/gen3/acetrainer-gen3.png',
    altSprites: ['/sprites/trainers/gen3/acetrainer-gen3rs.png'],
    pool: roster(familiesByType('ground')),
  },
  {
    id: 'VIRIDIAN_YOUNGSTER',
    displayName: 'Jovem',
    spritePath: '/sprites/trainers/gen3/youngster-gen3.png',
    altSprites: ['/sprites/trainers/gen3/youngster-gen3rs.png'],
    pool: roster(baseStageSpecies()),
  },
  {
    id: 'VIRIDIAN_CAMPER',
    displayName: 'Acampador',
    spritePath: '/sprites/trainers/gen3/camper-gen3.png',
    altSprites: ['/sprites/trainers/gen3/camper-gen3rs.png'],
    pool: roster(familiesByType('grass', 'rock', 'normal')),
  },
  {
    id: 'VIRIDIAN_BIKER',
    displayName: 'Motoqueiro',
    spritePath: '/sprites/trainers/gen3/biker-gen3.png',
    pool: roster(evolvedSpecies()),
  },
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/data/trainersCities.test.ts`
Expected: PASS.

- [ ] **Step 5: Checar tipos**

Run: `npm run build`
Expected: sucesso, sem erros de tipo (os ids de `TRAINER_IDS` e os `id` dos `TrainerDef` batem).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/data/trainers.ts src/data/trainersCities.test.ts
git commit -m "feat(trainers): elenco temático + líder das cidades 3-8"
```

---

### Task 3: Ligar as listas de treinadores às cidades

**Files:**
- Modify: `src/data/cities.ts` (novas constantes `*_TRAINERS` + campo `trainers` no `SEEDS`)
- Test: `src/data/trainersCities.test.ts` (estender o arquivo da Task 2)

**Interfaces:**
- Consumes: `TrainerId` (`types/index.ts`); os 36 ids da Task 2; `CITIES`/`getCity` (já em `cities.ts`); `RIVAL_TRAINER_IDS`, `ROCKET_TRAINER_IDS` (`types/index.ts`).
- Produces: `getCity(2..7).trainers` com 6 ids cada, líder em `[0]`.

- [ ] **Step 1: Estender o teste (vai falhar)**

Adicionar ao final de `src/data/trainersCities.test.ts` (e ampliar os imports do topo):

```ts
// Ampliar a 1ª linha de import:
//   import { RIVAL_TRAINER_IDS, ROCKET_TRAINER_IDS } from '../types/index.ts'
//   import { getCity } from './cities.ts'

describe('listas de treinadores por cidade (3–8)', () => {
  const EXPECTED: { index: number; name: string; leader: TrainerId }[] = [
    { index: 2, name: 'Vermilion', leader: 'SURGE' },
    { index: 3, name: 'Celadon', leader: 'ERIKA' },
    { index: 4, name: 'Fuchsia', leader: 'KOGA' },
    { index: 5, name: 'Saffron', leader: 'SABRINA' },
    { index: 6, name: 'Cinnabar', leader: 'BLAINE' },
    { index: 7, name: 'Viridian', leader: 'GIOVANNI' },
  ]
  const banned = new Set<TrainerId>([...RIVAL_TRAINER_IDS, ...ROCKET_TRAINER_IDS])

  for (const { index, name, leader } of EXPECTED) {
    it(`${name} tem líder + 5 treinadores, líder primeiro, sem rivais/Rocket`, () => {
      const city = getCity(index)
      expect(city.name).toBe(name)
      expect(city.trainers).toHaveLength(6)
      expect(city.trainers[0]).toBe(leader)
      for (const id of city.trainers) {
        expect(banned.has(id), `${id} não deveria estar na lista local`).toBe(false)
        expect(() => getTrainer(id)).not.toThrow()
      }
    })
  }
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/data/trainersCities.test.ts`
Expected: FAIL — as cidades 3–8 ainda usam `GENERIC_TRAINERS` (5 ids, líder errado).

- [ ] **Step 3a: Adicionar as constantes de elenco**

Em `src/data/cities.ts`, logo após `CERULEAN_TRAINERS` (antes do bloco de comentário de Pewter), inserir:

```ts
// Elencos próprios das cidades 3–8 (líder primeiro; rivais somados no setup).
const VERMILION_TRAINERS: TrainerId[] = [
  'SURGE',
  'VERMILION_ENGINEER',
  'VERMILION_ROCKER',
  'VERMILION_SAILOR',
  'VERMILION_GENTLEMAN',
  'VERMILION_POKEMANIAC',
]
const CELADON_TRAINERS: TrainerId[] = [
  'ERIKA',
  'CELADON_BEAUTY',
  'CELADON_LASS',
  'CELADON_PICNICKER',
  'CELADON_BUGCATCHER',
  'CELADON_GAMER',
]
const FUCHSIA_TRAINERS: TrainerId[] = [
  'KOGA',
  'FUCHSIA_JUGGLER',
  'FUCHSIA_TAMER',
  'FUCHSIA_DRAGONTAMER',
  'FUCHSIA_BIRDKEEPER',
  'FUCHSIA_SWIMMER',
]
const SAFFRON_TRAINERS: TrainerId[] = [
  'SABRINA',
  'SAFFRON_ACETRAINER',
  'SAFFRON_SCIENTIST',
  'SAFFRON_CHANNELER',
  'SAFFRON_HEXMANIAC',
  'SAFFRON_BLACKBELT',
]
const CINNABAR_TRAINERS: TrainerId[] = [
  'BLAINE',
  'CINNABAR_BURGLAR',
  'CINNABAR_SUPERNERD',
  'CINNABAR_BLACKBELT',
  'CINNABAR_KINDLER',
  'CINNABAR_SWIMMER',
]
const VIRIDIAN_TRAINERS: TrainerId[] = [
  'GIOVANNI',
  'VIRIDIAN_TAMER',
  'VIRIDIAN_ACETRAINER',
  'VIRIDIAN_YOUNGSTER',
  'VIRIDIAN_CAMPER',
  'VIRIDIAN_BIKER',
]
```

- [ ] **Step 3b: Ligar cada lista ao seu `CitySeed`**

Em `src/data/cities.ts`, no array `SEEDS`, adicionar o campo `trainers` aos seeds das cidades 3–8 (logo após a propriedade `siteNodes`/`starters` de cada um):

- No seed `name: 'Vermilion'` (já tem `graph`/`siteNodes`): adicionar `trainers: VERMILION_TRAINERS,`
- No seed `name: 'Celadon'`: adicionar `trainers: CELADON_TRAINERS,`
- No seed `name: 'Fuchsia'`: adicionar `trainers: FUCHSIA_TRAINERS,`
- No seed `name: 'Saffron'`: adicionar `trainers: SAFFRON_TRAINERS,`
- No seed `name: 'Cinnabar'`: adicionar `trainers: CINNABAR_TRAINERS,`
- No seed `name: 'Viridian'`: adicionar `trainers: VIRIDIAN_TRAINERS,`

Exemplo para Celadon (que hoje não tem `trainers`):

```ts
  {
    name: 'Celadon',
    primaryType: 'grass',
    secondaryType: 'bug',
    starters: [
      { speciesId: 44, level: 3 }, // Gloom
      { speciesId: 1, level: 1 }, // Bulbasaur
    ],
    trainers: CELADON_TRAINERS,
  },
```

- [ ] **Step 4: Rodar o teste do arquivo e confirmar que passa**

Run: `npx vitest run src/data/trainersCities.test.ts`
Expected: PASS (tasks 2 e 3).

- [ ] **Step 5: Rodar a suíte inteira + build (nada quebrou)**

Run: `npm test`
Expected: PASS — em especial `cerulean.test.ts`/`vermilion.test.ts`/`data.test.ts` intactos.

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 6: Commit**

```bash
git add src/data/cities.ts src/data/trainersCities.test.ts
git commit -m "feat(cities): liga elencos temáticos às cidades 3-8"
```

---

## Self-Review

**Cobertura da spec:**
- Seletores `familiesByType`/`baseStageSpecies`/`evolvedSpecies` (sem lendários) → Task 1. ✓
- 36 ids em `TRAINER_IDS` → Task 2, Step 3a. ✓
- 36 `TrainerDef` com pools e sprites exatos da spec → Task 2, Step 3c. ✓
- Listas por cidade ligadas ao `SEEDS` → Task 3. ✓
- Engine intacto (sem mudança) → confirmado; nenhuma task toca `game/setup.ts`. ✓
- Misty/Brock/Cerulean/rivais/Rocket intactos → nenhuma task os altera; teste proíbe rival/Rocket nas listas locais. ✓
- Testes (resolução de id, elenco por cidade, pools não-vazios, seletores) → Tasks 1–3. ✓

**Placeholders:** nenhum — todo passo tem código/comando completo.

**Consistência de tipos:** os 36 ids são idênticos em `TRAINER_IDS` (Task 2 Step 3a), nos `TrainerDef` (Step 3c), nas constantes `*_TRAINERS` (Task 3 Step 3a) e no `NEW_TRAINER_IDS` do teste. Assinaturas dos seletores idênticas entre Task 1 (definição) e Task 2 (uso). Pools de cada treinador conferem com a tabela da spec.
