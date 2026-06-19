# Skill `mapping-kanto-city-from-image` — design

## Contexto e problema

O `poke-badgekeeper` tem **8 cidades fixas** (`SEEDS`, índice 0–7 em `src/data/cities.ts`).
"Adicionar" uma cidade é **preencher um seed existente** com a estrutura calibrada
(grafo de waypoints + mapeamento de sítios) e habilitá-la.

Já existe a skill `.claude/skills/adding-kanto-city/`, mas ela está **defasada**: assume um
formato de entrada antigo (pop-ups como **números** `1, 2, 3.x…` + um **CSV separado** com
adjacência **dirigida por padrão**). O formato de mapa atual é diferente:

| | Skill antiga | Formato atual |
|---|---|---|
| Pop-ups | números (1, 2, 3.x…) | **palavras** (HOUSE, CP, GRASS, RKT, MART, GYM) |
| Adjacência | CSV separado, **dirigida** por padrão | **setas na imagem**, **bidirecional** por padrão |
| Água/Surf | sufixo `(surf)` no CSV | **ponto azul** + setas brancas |
| Exceções one-way | assimetria do CSV | **ditas no chat** |

O **modelo de dados do jogo não mudou**: `CityGraph` (`nodes`, `adj`, `markers`, `surfNodes`)
e `CitySiteNodes` (`gym`, `center`, `mart`, `museum`, `houses`, `green`) seguem iguais, e
`buildAdjacency(nodes, edges, directed)` também. O que muda é **como a skill lê a entrada**.

## Objetivo e escopo

Criar a skill `mapping-kanto-city-from-image` que, dado um mapa anotado
(`public/maps/kanto/<N>.png`, 1920×1080), lê a imagem e preenche **apenas a estrutura** da
cidade no `src/data/cities.ts` — `_NODES / _EDGES / _DIRECTED_EDGES / _MARKERS / surfNodes` +
`_SITE_NODES` — mais os testes.

**Fora de escopo** (deliberadamente, vs. a skill antiga): trainers temáticos, itens, clima e
unlock na tela de seleção. Esses sistemas não estão na imagem. O `SKILL.md` mantém só um
**ponteiro curto** para eles (arquivos-fonte), para o conhecimento não se perder.

A skill **substitui** a `adding-kanto-city`, que será **deletada**.

## Decisões de design (confirmadas)

1. **CP→`center`, MART→`mart`** (lapso na legenda original que dizia "centro pokemon" nos dois).
2. **Escopo = só estrutura** (grafo + sítios + testes).
3. **Checkpoint obrigatório**: depois de ler a imagem, a skill imprime uma **tabela de
   confirmação no chat** e **para**; só escreve código após o OK do usuário. Protege contra
   erro de leitura visual (direção de seta / cor), que quebraria o pathfinding silenciosamente.
4. **Abordagem A**: skill única (`SKILL.md` + `template.md`); a tabela de confirmação vive no
   chat (markdown), sem arquivo intermediário em disco.

## Regras de leitura da imagem (núcleo da skill)

**Índice da cidade:** vem do nome do arquivo. `<N>.png` → índice `N-1`
(ex.: `3.png` → índice 2 → Vermilion). Preenche o seed **existente** (nunca append).

**Pontos (letras em círculos):**
- 🟠 laranja → ponto de terra, acesso normal.
- 🔵 azul → ponto de água, acesso **só por Surf** → entra em `surfNodes`.

**Setas:**
- **cinza** entre pontos → adjacência (`_EDGES`), **bidirecional por padrão**.
- **branca** → adjacência envolvendo água/surf → também bidirecional.
- **roxa** → responsabilidade de pop-up: liga o retângulo ao(s) ponto(s) que o acessam.
- **Mão única (`_DIRECTED_EDGES`)**: **não** lida da imagem — o usuário declara no chat quais
  pares não são bidirecionais. Sem instrução = tudo bidirecional.
- **Pop-up com 2 setas roxas** = acessível por 2 pontos:
  - `GRASS` (nó dedicado) → 2 arestas de acesso `[p1, g3x]` e `[p2, g3x]`; pathfinding pega a
    menor (recalcula se um caminho estiver bloqueado).
  - Sítios de 1 nó (`center/mart/gym`) → escolher 1 ponto de parada e **destacar na tabela**
    para o usuário confirmar.

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
refináveis com o DEV picker (`CityMap` loga `{x,y}` no clique em dev).

## Fluxo

0. **Step 0**: ler o bloco vivo de **Cerulean** em `cities.ts` + `cerulean.test.ts` para as
   convenções atuais (markers, museu de ponto único, etc.). **Se divergir, o código vence.**
1. Identificar o índice pelo nome do arquivo.
2. Ler a imagem → pontos (letra + cor→surf), arestas (setas cinza/branca), pop-ups (palavra +
   ponto responsável via seta roxa), coordenadas.
3. Aplicar as exceções one-way ditas no chat.
4. **Imprimir a tabela de confirmação e PARAR** — esperar OK/correções.
5. Com OK: escrever as consts `_NODES/_EDGES/_DIRECTED_EDGES/_MARKERS/surfNodes` +
   `_SITE_NODES` e ligá-las no seed **existente** do `cities.ts`.
6. Escrever/atualizar `src/data/<city>.test.ts` espelhando `cerulean.test.ts`.
7. Verificar: `npm run build` (tsc -b — não `tsc --noEmit`, o tsconfig raiz é solution-only) +
   `npx vitest run`. Preferir testes ao preview do navegador.

**Tabela de confirmação** (dois blocos markdown no chat):

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

## Geração de código

Mapeamento (espelha o `template.md` atual, mas dirigido por palavras/setas):

- `_NODES`: toda letra (incl. azuis) + um `g3x` por GRASS, na coordenada do rótulo/retângulo.
- `_EDGES`: pares mútuos (uma vez) + `[letra, g3x]` por GRASS.
- `_DIRECTED_EDGES`: só os one-way declarados no chat (`[de, para]`).
- `_MARKERS`: posição do retângulo do pop-up; chave composta `"<letra>:<kind>"` quando uma
  letra hospeda mais de um pop-up (senão cai na posição do nó). `kind ∈
  gym|center|mart|museum|house|green`. Nós `g3x` dedicados não precisam de marker.
- `surfNodes`: as letras azuis.
- `_SITE_NODES`: `gym/center/mart` (letra única), `museum` (lista — convenção viva, hoje ponto
  único), `houses` (letras), `green` (`g3x…`).

Ligar no seed **existente** via campos opcionais `graph` / `siteNodes` (defaults são o grafo/
sítios de Pewter). Não tocar em `starters`/tipos a menos que o brief peça.

## Testes (espelham `cerulean.test.ts`)

- nome/tipos não regridem; `gym` é a letra esperada.
- todo alvo de adjacência existe como nó.
- arestas simétricas, exceto as one-way declaradas (forward presente, reverse ausente).
- `surfNodes` = exatamente as letras azuis.
- todos os sítios (gym/center/mart/museum/houses/green) existem no grafo.
- todo sítio é alcançável **do gym e de volta** (ciente de direção; volta ≠ inverso do ida
  quando há one-way).
- `green` é capture-only; `nodesForCategory(siteNodes, 'rocket')` bate com `museum` vivo.
- se houver sítio atrás de água: `[]` para time sem Surf, alcançável com Surf/`surfboard`.

## Estrutura de arquivos da skill

- **Deletar** `.claude/skills/adding-kanto-city/` (`SKILL.md` + `template.md`).
- **Criar** `.claude/skills/mapping-kanto-city-from-image/`:
  - `SKILL.md` — overview, Step 0, regras de leitura, fluxo com checkpoint, geração de código,
    testes, gotchas, e o **ponteiro** final "depois da estrutura".
  - `template.md` — shapes do `cities.ts` (skeleton de `_NODES/_EDGES/_DIRECTED_EDGES/
    _MARKERS/_SITE_NODES`) + checklist de teste.
- **Ponteiro "depois da estrutura"** (no fim do `SKILL.md`): lista os sistemas fora de escopo
  com seus arquivos-fonte, sem a skill ser "dona" deles:
  - Trainers temáticos → `cities.ts` (`trainers`), `data/trainers.ts`, `types/index.ts`.
  - Itens → `src/data/items.ts` (`CITY_ITEM_IDS`).
  - Clima → `src/data/cityWeather.ts` (`CITY_WEATHER`).
  - Unlock/cópia → `CitySelectScreen.tsx` (`PLAYABLE_CITIES`).

## Gotchas (carregar para o SKILL.md)

- **Volta ≠ inverso do ida** com one-way edges (`shortestPath` é direcionado). Testar ida e volta.
- **Sítio atrás de água é intencional mas bloqueado** sem Surf (dispatch retorna caminho vazio).
- Um nó de parada igual ao gym dá 0 de viagem (ok para casa; evitar para center/mart).
- Verificar ids de espécie em `species.generated.ts` só se mexer em espécie (normalmente não).
- Preencher o seed **existente** — nunca `SEEDS.push`.
- `green` é **capture-only** — nunca hospeda missão normal nem mapeia `freeArea`.

## Riscos

- **Leitura visual imprecisa** (cor/direção de seta) — mitigado pelo checkpoint obrigatório.
- **Convenções vivas mudam** (ex.: museu de ponto único) — mitigado pelo Step 0 ("código vence").
- **Perda da doc dos sistemas fora de escopo** ao deletar a skill antiga — mitigado pelo ponteiro.
