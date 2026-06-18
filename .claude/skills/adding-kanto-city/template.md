# City data template + per-system shapes

The graph/sites live in `src/data/cities.ts`. **Read the live Cerulean block and `cerulean.test.ts` for current values** — this file gives the *shape*, not frozen values (those have changed before and will again).

## How the CSV maps to the structures

For each CSV row `ponto, adjacentes, missões`:

1. **Node position** — put `ponto` in `_NODES` at its image coordinate. `(surf)` ⇒ also add it to `surfNodes`.
2. **Edges** — for each neighbor, check the neighbor's own row:
   - neighbor lists `ponto` back ⇒ `_EDGES` (undirected, once).
   - neighbor does NOT ⇒ `_DIRECTED_EDGES` as `[ponto, neighbor]` (one-way).
3. **Missions** — per number, via the legend: 1→`gym`, 2→`center`, 4→`mart` (single letter each; pick one stop if several rows list it). 6.x→add letter to `houses`. 5.x→`museum` (read the live convention — currently a single point). 3.x→a **dedicated `green` node** `g3X` positioned over the number, plus edge `[letter, g3X]`.
4. **Markers** — where a stop letter hosts >1 number, add `"<letter>:<kind>"` → that number's position. Dedicated green nodes need none (fall back to node position). `kind` ∈ `gym | center | mart | museum | house | green`.

## Skeleton (graph + sites)

```ts
// ============================ <City> (<index+1>.png) ============================
const CITY_NODES: Record<string, MapPos> = {
  a: { x: 0.0, y: 0.0 },   // waypoints (incl. `(surf)` ones)
  g31: { x: 0.0, y: 0.0 }, // dedicated exploration node — 3.1 (access '<letter>')
}
const CITY_EDGES: [string, string][] = [
  ['a', 'b'],              // undirected pairs (mutual in the CSV)
  ['<letter>', 'g31'],     // exploration-access edges
]
const CITY_DIRECTED_EDGES: [string, string][] = [
  // ['k', 't'],           // one-way: A lists B but B does NOT list A
]
const CITY_MARKERS: Record<string, MapPos> = {
  // 'u:gym': {x,y}, 'u:house': {x,y}, ...  (composite keys where a stop hosts >1 number)
}
const CITY_GRAPH: CityGraph = {
  nodes: CITY_NODES,
  adj: buildAdjacency(CITY_NODES, CITY_EDGES, CITY_DIRECTED_EDGES),
  markers: CITY_MARKERS,
  surfNodes: [/* '(surf)' letters, or omit */],
}
const CITY_SITE_NODES: CitySiteNodes = {
  gym: '<1>', center: '<2>', mart: '<4>',
  museum: [/* Rocket point(s) — read the live convention */],
  houses: [/* 6.x letters */],
  green: [/* dedicated 3.x nodes: 'g31', ... */],
}
```

Wire into the **existing** seed (do not append). `graph`, `siteNodes`, `trainers` are optional fields; defaults are Pewter graph/sites and `GENERIC_TRAINERS`:

```ts
{
  name: '<City>', primaryType: '<type>', secondaryType: '<type>',
  starters: [ { speciesId: N, level: 3 }, { speciesId: M, level: 1 } ],
  graph: CITY_GRAPH,            // <-- add
  siteNodes: CITY_SITE_NODES,   // <-- add
  trainers: CITY_TRAINERS,      // <-- add if themed (else omit → GENERIC_TRAINERS)
}
```

## Trainers (`cities.ts` + `data/trainers.ts` + `types/index.ts`)

```ts
// Themed gym invaders (the leader + flavor classes). Rivals are appended automatically
// in setup.ts via RIVAL_TRAINER_IDS — do NOT list them here.
const CITY_TRAINERS: TrainerId[] = ['<LEADER>', /* themed classes */]
```
Every id must be a key in `TRAINER_LIST` (`data/trainers.ts`). If the brief names a new class/leader, it must be added to the `TrainerId` union (`types/index.ts`) and `TRAINER_LIST` first.

## Items (`src/data/items.ts`)

```ts
export const CITY_ITEM_IDS: Record<number, string[]> = {
  // <index>: ['<themed-item-id>', ...],   // globals are auto-included
}
```
New item ids need a full `ItemData` definition in `items.ts`. Themed to the gym type / secret abilities (e.g. Cerulean: water-boost + a Surf mobility item).

## Surf (read; usually no city work beyond `surfNodes`)

`graph.surfNodes` lists water letters. A team crosses water only if `teamSurfs(team, runItems)` — item `surfboard`, or `sa-surf` (solo) / `sa-surf-plus` (whole team). Otherwise `travelRoute` returns an empty path and `acceptMission`/dispatch is blocked. Source: `secretEffects.ts` (`teamSurfs`/`hasSurf`), `pathfinding.ts` (`graphWithoutSurf`/`surfTravelDistance`), `missions.ts` (`travelRoute`).

## Weather (optional, `src/data/cityWeather.ts`)

```ts
const CITY_WEATHER: Record<number, CityWeather> = {
  // <index>: { effects: [{ kind: 'rain' }] },
}
```

## Test checklist (mirror `cerulean.test.ts`)

- [ ] name, types, starter species/levels; gym is the expected letter
- [ ] every adjacency target exists as a node
- [ ] each one-way edge: forward present, reverse absent; all other edges symmetric
- [ ] `surfNodes` equals the `(surf)` letters
- [ ] all site nodes (gym/center/mart/museum/houses/green) exist in the graph
- [ ] every site reachable from gym **and** has a path back (directed-aware)
- [ ] a one-way detour: return route ≠ reversed outbound, and is the real shortest path
- [ ] Rocket: `nodesForCategory(siteNodes, 'rocket')` matches the live `museum`; rocket-day scheduling behaves
- [ ] if water-gated: a site past `surfNodes` is unreachable (`[]`) for a non-surf team and reachable with Surf/`surfboard` (mirror `surf.test.ts`)

## Final steps

- Unlock: add the index to `PLAYABLE_CITIES` in `CitySelectScreen.tsx`; update the `Textbox` copy.
- `npx tsc --noEmit && npx vitest run` must be green. Prefer tests over the browser preview.
- Coordinates are estimates — note they can be refined with the in-app DEV picker.
