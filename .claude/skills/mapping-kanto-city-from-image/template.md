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
