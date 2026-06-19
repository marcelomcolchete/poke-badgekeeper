---
name: mapping-kanto-city-from-image
description: Use when the user provides (in chat) an annotated top-down Kanto city map — lettered orange/blue point circles, gray/white/purple arrows, worded popups HOUSE/CP/GRASS/RKT/MART/GYM — and asks to build or update that city's STRUCTURE in poke-badgekeeper: its waypoint graph (nodes, edges, Surf-gated water, one-way edges) and site mapping (gym/center/mart/museum/houses/green) plus tests. The repo's public/maps/kanto/<N>.png is the clean game art (gives the city index + coordinate reference), not the annotations. Structure only — NOT trainers/items/weather/unlock.
---

# Mapeando a estrutura de uma cidade de Kanto a partir da imagem

## Visão geral

O poke-badgekeeper tem **8 cidades fixas** (`SEEDS`, índice 0–7 em `src/data/cities.ts`).
"Adicionar" uma cidade é **preencher um seed existente** com o grafo de waypoints + o
mapeamento de sítios. Esta skill cobre **só a estrutura** vinda da imagem: pontos, pop-ups,
adjacências e os testes. Trainers/itens/clima/unlock estão **fora de escopo** (ver o ponteiro
no fim).

**Duas imagens, papéis diferentes:**
- O **mapa anotado** (letras nos círculos, setas, retângulos de pop-up) é um diagrama de
  trabalho que o **usuário fornece no chat** — ele **não** está no repositório. É a fonte da
  estrutura. Se o usuário não tiver colado o mapa anotado, peça-o antes de continuar.
- O arquivo `public/maps/kanto/<N>.png` (1920×1080) é a **arte limpa do jogo** (sem anotações).
  Serve para dois fins: o **índice** vem do nome do arquivo (`<N>.png` → índice `N-1`, ex.:
  `3.png` → índice 2 → Vermilion), e a geografia limpa é a referência para **estimar as
  coordenadas** dos nós/pop-ups.

> **Step 0 — sempre primeiro:** abrir o bloco vivo de **Cerulean** em `src/data/cities.ts` e
> `src/data/cerulean.test.ts`. O *shape* está aqui; os *valores e convenções atuais* (markers,
> museu de ponto único, etc.) estão no código. **Se divergir, o código vence.**

## Regras de leitura da imagem

**Pontos (letras dentro de círculos):**
- 🟠 **laranja** → ponto de terra, acesso normal.
- 🔵 **azul** → ponto de água, acesso **só por Surf** → entra em `surfNodes`.
- As letras na imagem são **maiúsculas (A–AN)**; as chaves dos nós no grafo são **minúsculas**
  (`'a'..'an'`). Rótulos de duas letras viram a chave minúscula correspondente (AI → `'ai'`,
  AL → `'al'`).

**Setas:**
- **cinza** entre pontos → adjacência (`_EDGES`), **bidirecional por padrão**.
- **branca** → adjacência envolvendo água/surf → também bidirecional.
- **roxa** → responsabilidade de pop-up: liga o retângulo do pop-up ao(s) ponto(s) que o acessam.
- **Mão única (`_DIRECTED_EDGES`)**: **não** é lida da imagem. O usuário declara no chat quais
  pares não são bidirecionais. Sem instrução = tudo bidirecional.
- **Pop-up com 2 setas roxas** = acessível por 2 pontos. O tratamento depende do tipo (são
  mutuamente exclusivos):
  - **GRASS** (nó dedicado): criar as 2 arestas de acesso `[p1, g3x]` e `[p2, g3x]`; o
    pathfinding pega a menor (recalcula se um caminho estiver bloqueado). Nada a confirmar.
  - **Sítio de 1 nó** (`center/mart/gym`): o grafo guarda só 1 letra — escolher 1 ponto de
    parada e **destacar na tabela** pro usuário confirmar qual.

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
4. Aplicar as exceções one-way ditas no chat. **Sem nenhuma declarada ⇒ `_DIRECTED_EDGES = []`**
   (todas as arestas bidirecionais).
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
