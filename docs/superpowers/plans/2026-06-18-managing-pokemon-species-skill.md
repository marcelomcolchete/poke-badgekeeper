# Skill `managing-pokemon-species` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a skill `managing-pokemon-species` (cadastrar/alterar Pokémon: raridade, nível de evolução, habilidades secretas) e evoluir o importador de CSV para aceitar espécies novas (id ≥ 152).

**Architecture:** O CSV `scripts/data/pokemon-balance.csv` é a fonte única de verdade; `scripts/importPokemonCsv.ts` regenera os 4 arquivos `.generated.ts`. Hoje o importador lança erro em id desconhecido. Extraímos um helper puro `resolveDisplayAndSprite` (testável via vitest) que deriva `displayName`/`spritePath` para ids novos e preserva os existentes; o script passa a usá-lo. A skill é um documento de procedimento no estilo de `.claude/skills/adding-kanto-city`.

**Tech Stack:** TypeScript, Node `--experimental-strip-types`, Vitest, esbuild (vitest runtime).

## Global Constraints

- CSV é a fonte única de verdade; nunca editar os `.generated.ts` à mão.
- Espécies são Gen 1 por padrão; novas usam id ≥ 152 e sprite em `public/sprites/pokemons/gen1/<id>.png`.
- Raridades válidas (verbatim de `src/types/index.ts`): `common`, `uncommon`, `rare`, `epic`, `legend`.
- Comando de import: `node --experimental-strip-types scripts/importPokemonCsv.ts`.
- Verificação final de qualquer execução: `npm run typecheck && npm test`.
- Preferência do projeto: evitar preview/screenshots; preferir testes.
- Espécies existentes (id ≤ 151) devem continuar preservando `displayName`/`spritePath` atuais.

---

### Task 1: Helper puro `resolveDisplayAndSprite`

**Files:**
- Create: `scripts/pokemonRow.ts`
- Test: `scripts/pokemonRow.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `resolveDisplayAndSprite(id: number, name: string, prev?: { displayName: string; spritePath: string }): { displayName: string; spritePath: string }` — quando `prev` existe, devolve os campos de `prev` (preserva); quando ausente (id novo), deriva `displayName` capitalizando a primeira letra de `name` e `spritePath = /sprites/pokemons/gen1/<id>.png`.

- [ ] **Step 1: Write the failing test**

Create `scripts/pokemonRow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveDisplayAndSprite } from './pokemonRow.ts'

describe('resolveDisplayAndSprite', () => {
  it('preserva displayName/spritePath quando a espécie já existe', () => {
    const prev = { displayName: 'Bulbasaur', spritePath: '/sprites/pokemons/gen1/1.png' }
    expect(resolveDisplayAndSprite(1, 'bulbasaur', prev)).toEqual({
      displayName: 'Bulbasaur',
      spritePath: '/sprites/pokemons/gen1/1.png',
    })
  })

  it('deriva defaults para id novo: nome capitalizado + sprite por id', () => {
    expect(resolveDisplayAndSprite(152, 'chikorita', undefined)).toEqual({
      displayName: 'Chikorita',
      spritePath: '/sprites/pokemons/gen1/152.png',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/pokemonRow.test.ts`
Expected: FAIL — não resolve `./pokemonRow.ts` / `resolveDisplayAndSprite is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/pokemonRow.ts`:

```ts
// Resolve displayName/spritePath de uma linha do CSV de balanceamento.
// Espécie existente: preserva os campos atuais (não vêm no CSV).
// Espécie nova (id sem `prev`): deriva defaults — nome capitalizado e sprite por id.

export function resolveDisplayAndSprite(
  id: number,
  name: string,
  prev?: { displayName: string; spritePath: string },
): { displayName: string; spritePath: string } {
  if (prev) return { displayName: prev.displayName, spritePath: prev.spritePath }
  return {
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    spritePath: `/sprites/pokemons/gen1/${id}.png`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/pokemonRow.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add scripts/pokemonRow.ts scripts/pokemonRow.test.ts
git commit -m "feat: helper resolveDisplayAndSprite para espécies novas no import"
```

---

### Task 2: Importador aceita ids novos

**Files:**
- Modify: `scripts/importPokemonCsv.ts` (laço `for (const r of rows.slice(1))`, ~linhas 104-129; bloco de imports do topo)

**Interfaces:**
- Consumes: `resolveDisplayAndSprite` da Task 1.
- Produces: comportamento — rodar o import com uma linha de id inédito gera entrada em `species.generated.ts` sem lançar erro; ids existentes inalterados.

- [ ] **Step 1: Adicionar o import do helper**

No topo de `scripts/importPokemonCsv.ts`, junto aos outros imports, adicionar:

```ts
import { resolveDisplayAndSprite } from './pokemonRow.ts'
```

- [ ] **Step 2: Substituir o trecho que lança erro e monta a espécie**

Trocar este bloco (dentro do `for (const r of rows.slice(1))`):

```ts
  const id = num(r[C.id])
  const prev = existingById.get(id)
  if (!prev) throw new Error(`id ${id} não existe nas espécies atuais — não reimportável`)
  if (r[C.name].trim() !== prev.name) {
    console.warn(`Aviso: name divergente p/ id ${id}: CSV="${r[C.name]}" vs "${prev.name}"`)
  }

  const types = [r[C.type1].trim(), r[C.type2].trim()].filter(Boolean) as PokemonType[]
  const baseAttrs: Attrs = {
    batalha: num(r[C.batalha]),
    inteligencia: num(r[C.inteligencia]),
    carisma: num(r[C.carisma]),
    agilidade: num(r[C.agilidade]),
    resistencia: num(r[C.resistencia]),
    percepcao: num(r[C.percepcao]),
  }
  species.push({
    id,
    name: prev.name,
    displayName: prev.displayName,
    types,
    baseAttrs,
    rarity: r[C.rarity].trim() as Rarity,
    spritePath: prev.spritePath,
  })
```

por:

```ts
  const id = num(r[C.id])
  const prev = existingById.get(id)
  if (prev && r[C.name].trim() !== prev.name) {
    console.warn(`Aviso: name divergente p/ id ${id}: CSV="${r[C.name]}" vs "${prev.name}"`)
  }
  const name = prev ? prev.name : r[C.name].trim()
  const { displayName, spritePath } = resolveDisplayAndSprite(id, name, prev)

  const types = [r[C.type1].trim(), r[C.type2].trim()].filter(Boolean) as PokemonType[]
  const baseAttrs: Attrs = {
    batalha: num(r[C.batalha]),
    inteligencia: num(r[C.inteligencia]),
    carisma: num(r[C.carisma]),
    agilidade: num(r[C.agilidade]),
    resistencia: num(r[C.resistencia]),
    percepcao: num(r[C.percepcao]),
  }
  species.push({ id, name, displayName, types, baseAttrs, rarity: r[C.rarity].trim() as Rarity, spritePath })
```

- [ ] **Step 3: Smoke-test do import com o CSV real (sem alterar dados)**

Run: `node --experimental-strip-types scripts/importPokemonCsv.ts`
Expected: imprime `OK: 151 espécies, ...`. Em seguida, confirmar que nada mudou: `git diff --stat src/data/pokemon/` deve sair **vazio** (regeração idempotente dos 4 arquivos).

- [ ] **Step 4: Verificar tipos e suíte completa**

Run: `npm run typecheck && npm test`
Expected: PASS (inclui `scripts/pokemonRow.test.ts` e a suíte existente).

- [ ] **Step 5: Commit**

```bash
git add scripts/importPokemonCsv.ts
git commit -m "feat: importPokemonCsv aceita ids novos com defaults de displayName/sprite"
```

---

### Task 3: Documento da skill `SKILL.md`

**Files:**
- Create: `.claude/skills/managing-pokemon-species/SKILL.md`

**Interfaces:**
- Consumes: o importador da Task 2 (procedimento depende dele aceitar ids novos).
- Produces: skill acionável por gatilhos de "cadastrar/alterar pokémon".

- [ ] **Step 1: Escrever o SKILL.md**

Create `.claude/skills/managing-pokemon-species/SKILL.md` com este conteúdo:

````markdown
---
name: managing-pokemon-species
description: Use when asked to cadastrar (criar) ou alterar um Pokémon (espécie) no poke-badgekeeper — definir/ajustar raridade, nível de evolução, e as habilidades secretas da linha (3 por linha), incluindo implementar uma habilidade secreta nova. Dataset é Gen 1; o CSV de balanceamento é a fonte de verdade.
---

# Cadastrar / alterar uma espécie de Pokémon

## Visão geral

O dataset é Gen 1. `scripts/data/pokemon-balance.csv` é a **fonte de verdade** do
balanceamento; `scripts/importPokemonCsv.ts` regenera 4 arquivos a partir dele:
`species.generated.ts`, `evolutions.generated.ts`, `genders.generated.ts`,
`minWildLevels.generated.ts`. **Nunca edite os `.generated.ts` à mão.** As
habilidades secretas ficam em `src/data/secretAbilities.ts` (dados/texto) e
`src/engine/secretEffects.ts` (lógica).

> **Step 0 — sempre primeiro:** leia o estado vivo, pois o repo muda rápido e o
> código vence esta skill se divergir:
> - `scripts/data/pokemon-balance.csv` (header/colunas atuais)
> - `src/data/secretAbilities.ts` (`SecretId`, `SECRET_KINDS`, `SECRET_LINES`, `SECRET_LINE_BY_SPECIES`, `lineRootId`)
> - `src/engine/secretEffects.ts` (predicados `hasX` e costuras existentes)
> - `src/types/index.ts` (`RARITIES`) e `src/engine/balance.ts` (`RARITY_DRAW_WEIGHT`)

## Pergunte ao usuário

1. **Criar** uma espécie nova ou **alterar** uma existente? Qual (id/nome)?
2. **Sempre** (criar e alterar):
   - **Raridade**: `common | uncommon | rare | epic | legend`.
   - **Nível de evolução**: para qual id evolui (`evolvesTo_id`, pode ser vazio) e
     em que nível (`evolve_atLevel`, escala 1–10). Vazio se não evolui.
   - **Habilidades secretas**: as **3** da linha, em ordem de desbloqueio (1ª/2ª/3ª
     vez Destaque do Dia).
3. **Só ao criar**, também: `id` (≥ 152), `name` (minúsculo, estilo PokéAPI),
   `displayName`, `type1`/`type2`, os 6 `baseAttrs` (batalha, inteligencia,
   carisma, agilidade, resistencia, percepcao), `gender_rate`
   (oitavos-fêmea: 0=100% macho, 8=100% fêmea, -1=sem gênero), `minWildLevel`, e a
   **sprite** em `public/sprites/pokemons/gen1/<id>.png` (avise que o arquivo
   precisa existir).

## Campo → onde vai

| Campo | Coluna do CSV | Arquivo gerado |
|---|---|---|
| raridade | `rarity` | `species.generated.ts` |
| tipos | `type1`, `type2` | `species.generated.ts` |
| atributos base | `batalha`…`percepcao` | `species.generated.ts` |
| evolui para / nível | `evolvesTo_id`, `evolve_atLevel` | `evolutions.generated.ts` |
| gênero | `gender_rate` | `genders.generated.ts` |
| nível selvagem mín. | `minWildLevel` | `minWildLevels.generated.ts` |
| displayName/sprite (id novo) | — (derivados no import) | `species.generated.ts` |
| habilidades secretas | — | `src/data/secretAbilities.ts` (+ `secretEffects.ts` se nova) |

> O CSV tem colunas derivadas (`total`, `chance_female_%`, `chance_male_%`) só de
> conferência — preencha de forma coerente; o import ignora as que não usa.

## Procedimento

1. **Step 0** acima.
2. **Editar o CSV**: adicione (criar) ou ajuste (alterar) a linha em
   `scripts/data/pokemon-balance.csv`, preenchendo todas as colunas do header.
3. **Reimportar**: `node --experimental-strip-types scripts/importPokemonCsv.ts`.
   Confirme `OK: N espécies …` e que os `.generated.ts` foram regravados.
4. **Habilidades secretas** em `src/data/secretAbilities.ts`:
   - ache a raiz da linha com `lineRootId(speciesId)`;
   - grave a tripla `[id1, id2, id3]` em `SECRET_LINES[root]`. **Se** a linha for
     divergente (raiz compartilhada por evoluções diferentes — padrão Eevee), use
     `SECRET_LINE_BY_SPECIES[speciesId]` para não vazar a linha para os irmãos.
5. **Habilidade NOVA** (id de habilidade ainda não existe): ver seção abaixo.
6. **Verificar**: `npm run typecheck && npm test`. Não use preview (preferência do
   projeto: testes).

## Implementar uma habilidade secreta nova

Decida primeiro a **viabilidade** com os sistemas atuais:

- **Viável** (o efeito usa batalha/atributos/viagem/clima já existentes):
  1. adicione o id ao union `SecretId` e ao catálogo `SECRET_KINDS` (name + effect);
  2. adicione um predicado `hasX(p)` em `src/engine/secretEffects.ts`;
  3. implemente a lógica na(s) costura(s) certa(s) da engine e constantes em
     `src/engine/balance.ts` (espelhe o padrão de `swift-swim`/`cloud-nine` em
     `docs/superpowers/specs/2026-06-18-swift-swim-cloud-nine-design.md`);
  4. escreva testes do efeito.
- **Inviável** (depende de sistema que não existe — status de confusão/congelamento,
  tempestade de areia, calor/frio): apenas catalogue em `SECRET_KINDS` com o texto
  terminando em `(sem efeito até existir …)`, como os ids já marcados assim, e
  registre como follow-up. Não invente o sistema faltante aqui.

## Gotchas

- **Linha divergente (Eevee):** `lineRootId` colapsa todos os eeveelutions na raiz
  133; use `SECRET_LINE_BY_SPECIES` para dar uma linha própria a um ramo.
- **Não edite `.generated.ts`** — eles são regerados; edite o CSV e reimporte.
- **Sprite obrigatória** para espécie nova: `public/sprites/pokemons/gen1/<id>.png`.
- O import preserva displayName/sprite de espécies existentes; para id novo ele
  deriva (`displayName` capitalizado, sprite por id). Ajuste o CSV/`displayName`
  depois se o nome de exibição for especial (ex.: `Nidoran♀`).
- Sempre finalize com `npm run typecheck && npm test`.
````

- [ ] **Step 2: Validar o frontmatter e a presença da skill**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('.claude/skills/managing-pokemon-species/SKILL.md','utf8');const m=t.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('frontmatter ausente');if(!/name:\s*managing-pokemon-species/.test(m[1]))throw new Error('name errado');if(!/description:/.test(m[1]))throw new Error('description ausente');console.log('frontmatter OK')"`
Expected: imprime `frontmatter OK`.

- [ ] **Step 3: Revisão de conteúdo (checklist manual)**

Releia o SKILL.md e confirme: Step 0 lista os 4 pontos; tabela campo→arquivo
presente; procedimento cobre CSV→import→secret→verify; seção de habilidade nova com
o ramo viável/inviável; gotcha de linha divergente. Corrija o que faltar.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/managing-pokemon-species/SKILL.md
git commit -m "docs: skill managing-pokemon-species (cadastrar/alterar pokémon)"
```

---

## Self-Review

**Spec coverage:**
- Importador evoluído 1× → Tasks 1–2. ✓
- CSV como fonte única / pipeline criar+alterar → SKILL.md procedimento (Task 3). ✓
- Pergunta raridade/nível-evolução/habilidades (sempre) + campos completos ao criar → SKILL.md "Pergunte ao usuário". ✓
- Habilidade nova: viável→implementa, inviável→cataloga → SKILL.md "Implementar habilidade nova". ✓
- Step 0 / código vence skill / gotchas (Eevee, sprite, não editar gerados) → SKILL.md. ✓
- Verificação `typecheck + test`; sem preview → Global Constraints + SKILL.md. ✓

**Placeholder scan:** sem TBD/TODO; todo passo tem comando/código concreto. ✓

**Type consistency:** `resolveDisplayAndSprite(id, name, prev?)` com o mesmo shape
de retorno `{ displayName, spritePath }` na Task 1 (definição), Task 2 (uso) e
SKILL.md (descrição do comportamento de import). ✓
