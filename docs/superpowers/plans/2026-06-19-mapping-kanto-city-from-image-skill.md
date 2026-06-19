# mapping-kanto-city-from-image Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the defasada `adding-kanto-city` skill with `mapping-kanto-city-from-image`, which reads an annotated Kanto map image and fills only a city's structure (waypoint graph + site nodes) plus tests in poke-badgekeeper.

**Architecture:** A single skill (`SKILL.md` + `template.md`) under `.claude/skills/`. The skill reads worded popups + colored arrows/points from `public/maps/kanto/<N>.png`, prints a confirmation table in chat, waits for the user's OK, then writes the `<CITY>_*` consts onto the existing `SEEDS` entry in `src/data/cities.ts` and a mirrored `<city>.test.ts`. The game data model (`CityGraph`, `CitySiteNodes`, `buildAdjacency`) is unchanged; only the input-reading rules are new.

**Tech Stack:** Markdown skill files (frontmatter `name`/`description` + body). Target codebase is TypeScript/React (Vite + Vitest). No code is written by this plan — the plan authors documentation.

## Global Constraints

- Skill files live at `.claude/skills/mapping-kanto-city-from-image/{SKILL.md,template.md}`.
- The old skill `.claude/skills/adding-kanto-city/` (SKILL.md + template.md) is **deleted**.
- Scope is **structure only**: `_NODES/_EDGES/_DIRECTED_EDGES/_MARKERS/surfNodes` + `_SITE_NODES` + tests. Trainers/items/weather/unlock are out of scope (kept only as an end-of-file pointer).
- Legend: GYM→`gym`, CP→`center`, MART→`mart`, HOUSE→`houses[]`, RKT→`museum`, GRASS→`green[]` (dedicated capture-only node).
- Points: orange = land/normal access; blue = water → `surfNodes`. Arrows: gray/white = adjacency (bidirectional by default), purple = popup responsibility. One-way edges come from chat, never from the image.
- City index from filename: `<N>.png` → index `N-1`.
- Verify command in the game repo: `npm run build` (tsc -b — **not** `tsc --noEmit`, root tsconfig is solution-only) + `npx vitest run`. Prefer tests over browser preview.
- Source of truth wins: Step 0 reads the live Cerulean block; if the skill text disagrees with code, code wins.

---

### Task 1: Delete old skill and write the new `SKILL.md`

**Files:**
- Delete: `.claude/skills/adding-kanto-city/SKILL.md`
- Delete: `.claude/skills/adding-kanto-city/template.md`
- Create: `.claude/skills/mapping-kanto-city-from-image/SKILL.md`

**Interfaces:**
- Consumes: nothing (skill is self-contained docs).
- Produces: the `SKILL.md` references `template.md` (Task 2) by relative link `[template.md](template.md)`.

- [ ] **Step 1: Delete the old skill directory**

```bash
git rm .claude/skills/adding-kanto-city/SKILL.md .claude/skills/adding-kanto-city/template.md
```

Expected: both files staged for deletion; directory becomes empty/removed.

- [ ] **Step 2: Create the new SKILL.md with this exact content**

Create `.claude/skills/mapping-kanto-city-from-image/SKILL.md`:

````markdown
---
name: mapping-kanto-city-from-image
description: Use when given an annotated top-down Kanto city map image (public/maps/kanto/<N>.png — lettered orange/blue point circles, gray/white/purple arrows, worded popups HOUSE/CP/GRASS/RKT/MART/GYM) and asked to build or update that city's STRUCTURE in poke-badgekeeper — its waypoint graph (nodes, edges, Surf-gated water, one-way edges) and site mapping (gym/center/mart/museum/houses/green) plus tests. Structure only — NOT trainers/items/weather/unlock.
---

# Mapeando a estrutura de uma cidade de Kanto a partir da imagem

## Visão geral

O poke-badgekeeper tem **8 cidades fixas** (`SEEDS`, índice 0–7 em `src/data/cities.ts`).
"Adicionar" uma cidade é **preencher um seed existente** com o grafo de waypoints + o
mapeamento de sítios. Esta skill cobre **só a estrutura** vinda da imagem: pontos, pop-ups,
adjacências e os testes. Trainers/itens/clima/unlock estão **fora de escopo** (ver o ponteiro
no fim).

Entrada: um mapa anotado `public/maps/kanto/<N>.png` (1920×1080). O **índice** vem do nome do
arquivo: `<N>.png` → índice `N-1` (ex.: `3.png` → índice 2 → Vermilion).

> **Step 0 — sempre primeiro:** abrir o bloco vivo de **Cerulean** em `src/data/cities.ts` e
> `src/data/cerulean.test.ts`. O *shape* está aqui; os *valores e convenções atuais* (markers,
> museu de ponto único, etc.) estão no código. **Se divergir, o código vence.**

## Regras de leitura da imagem

**Pontos (letras dentro de círculos):**
- 🟠 **laranja** → ponto de terra, acesso normal.
- 🔵 **azul** → ponto de água, acesso **só por Surf** → entra em `surfNodes`.

**Setas:**
- **cinza** entre pontos → adjacência (`_EDGES`), **bidirecional por padrão**.
- **branca** → adjacência envolvendo água/surf → também bidirecional.
- **roxa** → responsabilidade de pop-up: liga o retângulo do pop-up ao(s) ponto(s) que o acessam.
- **Mão única (`_DIRECTED_EDGES`)**: **não** é lida da imagem. O usuário declara no chat quais
  pares não são bidirecionais. Sem instrução = tudo bidirecional.
- **Pop-up com 2 setas roxas** = acessível por 2 pontos:
  - `GRASS` (nó dedicado) → 2 arestas de acesso `[p1, g3x]` e `[p2, g3x]`; o pathfinding pega a
    menor (recalcula se um caminho estiver bloqueado).
  - Sítio de 1 nó (`center/mart/gym`) → escolher 1 ponto de parada e **destacar na tabela** pro
    usuário confirmar.

**Legenda de palavras → sítio:**

| Pop-up | Cor | Vira | Nó no grafo |
|---|---|---|---|
| GYM | amarelo | `gym` | letra única |
| CP | vermelho | `center` | letra única |
| MART | azul | `mart` | letra única |
| HOUSE | roxo | `houses[]` | adiciona a letra responsável |
| RKT | laranja | `museum` (Equipe Rocket) | convenção viva = ponto único |
| GRASS | verde | `green[]` | **nó dedicado** `g3x` sobre o retângulo, **capture-only** |

**Coordenadas:** centro normalizado `(0–1)` de cada letra/retângulo. São **estimativas**,
refináveis com o DEV picker (`CityMap` loga `{x,y}` no clique, em dev).

## Procedimento

1. **Step 0** (acima): ler o bloco vivo de Cerulean + `cerulean.test.ts`.
2. Identificar o índice da cidade pelo nome do arquivo.
3. Ler a imagem → pontos (letra + cor→surf), arestas (setas cinza/branca), pop-ups (palavra +
   ponto responsável via seta roxa), coordenadas.
4. Aplicar as exceções one-way ditas no chat.
5. **Imprimir a tabela de confirmação e PARAR** — esperar OK/correções (ver formato abaixo).
6. Com OK: escrever as consts `<CITY>_NODES/_EDGES/_DIRECTED_EDGES/_MARKERS` + grafo +
   `<CITY>_SITE_NODES`, e ligá-las no seed **existente** do `cities.ts`. Shapes em
   [template.md](template.md).
7. Escrever/atualizar `src/data/<city>.test.ts` espelhando `cerulean.test.ts`.
8. **Verificar:** `npm run build` (tsc -b — não `tsc --noEmit`) + `npx vitest run`. Preferir
   testes ao preview do navegador.

## Tabela de confirmação (imprimir no chat e PARAR)

```
Pontos:
| ponto | cor    | surf? | adjacências |
| A     | laranja| não   | F           |
| B     | azul   | sim   | C, Q        |

Pop-ups:
| pop-up | tipo (sítio) | ponto(s) resp. | posição (x,y) |
| GYM    | gym          | (parada) AJ    | 0.30, 0.78    |
| GRASS  | green→g31    | O, P           | 0.73, 0.34    |
```

Listar TODOS os pontos e pop-ups. Destacar: letras azuis (surf), pop-ups com 2 setas, e
qualquer one-way recebido no chat. Só seguir para o código após o OK explícito.

## Gotchas

- **Volta ≠ inverso do ida** com one-way edges (`shortestPath` é direcionado). Testar que cada
  sítio é alcançável do gym **e de volta**.
- **Sítio atrás de água é intencional mas bloqueado** sem Surf: `travelRoute` retorna caminho
  vazio e o dispatch é barrado. Refletir isso nos testes de alcançabilidade (rota por água = `[]`
  sem Surf).
- Um nó de parada igual ao gym dá 0 de viagem (ok para casa; evitar para center/mart).
- Preencher o seed **existente** — nunca `SEEDS.push`.
- `green` é **capture-only** — nunca hospeda missão normal nem mapeia `freeArea`.
- Não esquecer `_DIRECTED_EDGES` para as assimetrias declaradas no chat.

## Depois da estrutura (fora do escopo desta skill)

Esta skill para na estrutura. Os demais sistemas de uma cidade jogável ficam nestes
arquivos-fonte (ler o bloco vivo de Cerulean para o padrão atual):

- **Trainers temáticos** → `src/data/cities.ts` (campo `trainers`), `src/data/trainers.ts`,
  `src/types/index.ts` (união `TrainerId`).
- **Itens** → `src/data/items.ts` (`CITY_ITEM_IDS[index]`).
- **Clima** → `src/data/cityWeather.ts` (`CITY_WEATHER[index]`).
- **Unlock / cópia da tela** → `CitySelectScreen.tsx` (`PLAYABLE_CITIES`).
````

- [ ] **Step 3: Verify the file exists and frontmatter is valid**

Run: `grep -n "^name: mapping-kanto-city-from-image" .claude/skills/mapping-kanto-city-from-image/SKILL.md`
Expected: one match on line 2.

- [ ] **Step 4: Commit**

```bash
git add -A .claude/skills/
git commit -m "feat: skill mapping-kanto-city-from-image (substitui adding-kanto-city)"
```

---

### Task 2: Write `template.md` (the cities.ts shapes)

**Files:**
- Create: `.claude/skills/mapping-kanto-city-from-image/template.md`

**Interfaces:**
- Consumes: linked from `SKILL.md` step 6 as `[template.md](template.md)`.
- Produces: the `<CITY>_*` const skeleton + test checklist used during execution.

- [ ] **Step 1: Create template.md with this exact content**

Create `.claude/skills/mapping-kanto-city-from-image/template.md`:

````markdown
# Shapes do `cities.ts` (estrutura da cidade)

O grafo/sítios vivem em `src/data/cities.ts`. **Ler o bloco vivo de Cerulean e
`cerulean.test.ts` para os valores atuais** — este arquivo dá o *shape*, não valores fixos.

## Da imagem para as estruturas

Para cada ponto (letra) lido da imagem:

1. **Posição** — colocar a letra em `_NODES` na coordenada do rótulo. Azul ⇒ também em `surfNodes`.
2. **Arestas** — para cada seta cinza/branca entre dois pontos: aresta **não-direcionada** em
   `_EDGES` (uma vez). One-way (declarado no chat) ⇒ `_DIRECTED_EDGES` como `[de, para]`.
3. **Pop-ups** — pela legenda: GYM→`gym`, CP→`center`, MART→`mart` (letra única cada);
   HOUSE→adicionar letra a `houses`; RKT→`museum` (convenção viva — hoje ponto único);
   GRASS→um nó dedicado `g3X` posicionado sobre o retângulo, capture-only, mais aresta(s)
   `[letra, g3X]` (uma por seta roxa).
4. **Markers** — onde uma letra hospeda mais de um pop-up, chave composta `"<letra>:<kind>"` →
   posição do retângulo. Nós `g3X` dedicados não precisam de marker (caem na posição do nó).
   `kind` ∈ `gym | center | mart | museum | house | green`.

## Skeleton (grafo + sítios)

```ts
// ============================ <City> (<index+1>.png) ============================
const CITY_NODES: Record<string, MapPos> = {
  a: { x: 0.0, y: 0.0 },   // waypoints (incl. azuis / surf)
  g31: { x: 0.0, y: 0.0 }, // nó de exploração dedicado — GRASS (acesso '<letra>')
}
const CITY_EDGES: [string, string][] = [
  ['a', 'b'],              // pares não-direcionados (setas cinza/branca)
  ['<letra>', 'g31'],      // acesso à área de exploração (uma por seta roxa do GRASS)
]
const CITY_DIRECTED_EDGES: [string, string][] = [
  // ['k', 't'],           // mão única — SÓ os declarados no chat
]
const CITY_MARKERS: Record<string, MapPos> = {
  // 'u:gym': {x,y}, 'u:house': {x,y}, ...  (chave composta onde uma letra hospeda >1 pop-up)
}
const CITY_GRAPH: CityGraph = {
  nodes: CITY_NODES,
  adj: buildAdjacency(CITY_NODES, CITY_EDGES, CITY_DIRECTED_EDGES),
  markers: CITY_MARKERS,
  surfNodes: [/* letras azuis, ou omitir */],
}
const CITY_SITE_NODES: CitySiteNodes = {
  gym: '<GYM>', center: '<CP>', mart: '<MART>',
  museum: [/* ponto(s) RKT — convenção viva */],
  houses: [/* letras HOUSE */],
  green: [/* nós dedicados GRASS: 'g31', ... */],
}
```

Ligar no seed **existente** (não fazer append). `graph`, `siteNodes` são campos opcionais; os
defaults são o grafo/sítios de Pewter:

```ts
{
  name: '<City>', primaryType: '<type>', secondaryType: '<type>',
  starters: [ { speciesId: N, level: 3 }, { speciesId: M, level: 1 } ],
  graph: CITY_GRAPH,            // <-- adicionar
  siteNodes: CITY_SITE_NODES,   // <-- adicionar
}
```

Não tocar em `starters`/tipos a menos que o brief peça.

## Checklist de teste (espelhar `cerulean.test.ts`)

- [ ] nome/tipos não regridem; `gym` é a letra esperada
- [ ] todo alvo de adjacência existe como nó
- [ ] arestas simétricas, exceto as one-way declaradas (forward presente, reverse ausente)
- [ ] `surfNodes` = exatamente as letras azuis
- [ ] todos os sítios (gym/center/mart/museum/houses/green) existem no grafo
- [ ] todo sítio é alcançável **do gym e de volta** (ciente de direção)
- [ ] um desvio one-way: rota de volta ≠ inverso do ida, e é o caminho mínimo real
- [ ] Rocket: `nodesForCategory(siteNodes, 'rocket')` bate com o `museum` vivo
- [ ] se houver sítio atrás de água: `[]` para time sem Surf, alcançável com Surf/`surfboard`

## Passo final

- `npm run build` (tsc -b — não `tsc --noEmit`) + `npx vitest run` devem ficar verdes.
- Coordenadas são estimativas — refináveis com o DEV picker em `CityMap`.
````

- [ ] **Step 2: Verify both skill files are present**

Run: `ls .claude/skills/mapping-kanto-city-from-image/`
Expected: `SKILL.md  template.md`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/mapping-kanto-city-from-image/template.md
git commit -m "docs: template.md da skill mapping-kanto-city-from-image"
```

---

### Task 3: Verify the skill with a dry-run against Vermilion (`3.png`)

This task proves the skill is usable end-to-end up to the checkpoint, without writing game code.

**Files:**
- Read-only: `public/maps/kanto/3.png`, `.claude/skills/mapping-kanto-city-from-image/SKILL.md`, `src/data/cities.ts` (Cerulean block), `src/data/cerulean.test.ts`

**Interfaces:**
- Consumes: the two skill files from Tasks 1–2.
- Produces: a confirmation table (chat output) — no file changes.

- [ ] **Step 1: Dry-run the reading rules on the Vermilion map**

Read `public/maps/kanto/3.png` and apply the skill's reading rules. Produce the confirmation
table for Vermilion:
- Points A–AN with color (orange/blue) and surf flag.
- Adjacencies from the gray/white arrows.
- Popups (4× HOUSE, CP, GRASS×3, RKT, MART, GYM) with responsible point(s) and position.

Expected: every blue point (B, Q, V, AI, AL) is flagged `surf? sim`; GRASS near O/P shows two
responsible points (O, P); GYM, CP, MART each show a single stop letter.

- [ ] **Step 2: Self-check the table against the skill rules**

Confirm: no popup mapped to the wrong site (CP→center, MART→mart); `green` popups became
dedicated `g3x` nodes; no one-way edge invented (none declared in chat ⇒ all bidirectional).

Expected: table is internally consistent; any ambiguity (2-arrow single-node site) is flagged
for user confirmation rather than silently resolved.

- [ ] **Step 3: Confirm scope boundary**

Verify the dry-run produced **only** structure (points/popups/adjacency) and did not attempt
trainers/items/weather/unlock.

Expected: scope holds; the "Depois da estrutura" pointer is the only mention of those systems.

- [ ] **Step 4: No commit (verification only)**

This task changes no files. If the dry-run surfaced a wording gap in `SKILL.md`/`template.md`,
fix it inline and amend the relevant Task 1/2 commit; otherwise done.

---

## Self-Review

**Spec coverage:**
- Reading rules (colors/arrows/legend) → Task 1 SKILL.md "Regras de leitura". ✓
- CP→center / MART→mart → Global Constraints + legend table. ✓
- Confirmation checkpoint + table format → Task 1 "Tabela de confirmação"; exercised in Task 3. ✓
- Index from filename → Task 1 "Visão geral". ✓
- Code-gen mapping (`_NODES/_EDGES/_DIRECTED_EDGES/_MARKERS/surfNodes/_SITE_NODES`) → Task 2 template.md. ✓
- Tests mirroring `cerulean.test.ts` → Task 2 checklist. ✓
- Delete old skill → Task 1 Step 1. ✓
- End-of-file pointer for out-of-scope systems → Task 1 "Depois da estrutura". ✓
- Step 0 / code-wins → Task 1 "Step 0". ✓
- Gotchas (one-way return, surf-gated `[]`, capture-only green) → Task 1 "Gotchas". ✓

**Placeholder scan:** No TBD/TODO; both skill files are given in full; no "similar to Task N". ✓

**Type/name consistency:** `_NODES/_EDGES/_DIRECTED_EDGES/_MARKERS`, `CityGraph`, `CitySiteNodes`,
`buildAdjacency`, `nodesForCategory(siteNodes, 'rocket')`, `g3x` naming — consistent across
Task 1, Task 2, and the spec. ✓
