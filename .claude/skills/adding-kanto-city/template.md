# City data template + worked example

Everything below lives in `src/data/cities.ts`. Replace `Cerulean` with the new city and adapt the values. The engine (`timeline.ts`, `pathfinding.ts`, `missionFlow.ts`, `captureFlow.ts`) and the global types already support all of this — you only write data.

## How the CSV maps to the structures

For each CSV row `ponto, adjacentes, missões`:

1. **Node position** — put `ponto` in `_NODES` at its image coordinate. If `(surf)`, also add it to `surfNodes`.
2. **Edges** — for each neighbor in `adjacentes`, check the neighbor's own row:
   - neighbor lists `ponto` back ⇒ add to `_EDGES` once (undirected).
   - neighbor does NOT list `ponto` ⇒ add to `_DIRECTED_EDGES` as `[ponto, neighbor]` (one-way).
3. **Missions** — for each number in `missões`, attach it to the right `siteNodes` field via the legend. A single-site number (1/2/4) fixes that field to this letter (pick one letter if several rows list it). A 6.x adds this letter to `houses`. A 5.x sets `museum[0]` (5.2) or `museum[1]` (5.1). A 3.x becomes a dedicated `green` node `g3X` whose position is the number's coordinate, plus an edge `[letter, g3X]`.
4. **Markers** — for every number whose stop letter hosts more than one number, add `"<letter>:<kind>"` → the number's image position. Dedicated green nodes need no marker (they fall back to the node position).

`kind` is the `SiteKind`: `gym | center | mart | museum | house | green`.

## Skeleton

```ts
// ============================ <City> (<index+1>.png) ============================
const CITY_NODES: Record<string, MapPos> = {
  // every lettered waypoint a–… at its normalized image position
  a: { x: 0.00, y: 0.00 }, // add `(surf)` ones here too
  // dedicated exploration nodes — one per 3.x area, positioned over the number
  g31: { x: 0.0, y: 0.0 }, // 3.1 (access '<letter>')
}

const CITY_EDGES: [string, string][] = [
  // undirected pairs from `adjacentes` (mutual), once each
  ['a', 'b'],
  // exploration-access edges
  ['<letter>', 'g31'],
]

const CITY_DIRECTED_EDGES: [string, string][] = [
  // one-way: A lists B but B does NOT list A
  // ['k', 't'],
]

const CITY_MARKERS: Record<string, MapPos> = {
  // composite keys where a stop letter hosts >1 number; single-kind house/rocket use plain key
  // 'u:gym':  { x, y }, 'u:house': { x, y }, 'x': { x, y } (5.2), 'm': { x, y } (5.1)
}

const CITY_GRAPH: CityGraph = {
  nodes: CITY_NODES,
  adj: buildAdjacency(CITY_NODES, CITY_EDGES, CITY_DIRECTED_EDGES),
  markers: CITY_MARKERS,
  surfNodes: [/* '(surf)' letters, or omit */],
}

const CITY_SITE_NODES: CitySiteNodes = {
  gym: '<letter for 1>',
  center: '<letter for 2>',
  mart: '<letter for 4>',
  museum: ['<letter for 5.2>', '<letter for 5.1>'], // ordered: first, then second
  houses: [/* letters for 6.x */],
  green: [/* dedicated nodes for 3.x: 'g31', 'g32', ... */],
}
```

Then wire into the **existing** seed (do not append):

```ts
{
  name: '<City>',
  primaryType: '<type>',
  secondaryType: '<type>',
  starters: [ { speciesId: N, level: 3 }, { speciesId: M, level: 1 } ],
  graph: CITY_GRAPH,          // <-- add
  siteNodes: CITY_SITE_NODES, // <-- add
},
```

## Worked example — Cerulean (already in the repo)

CSV had two one-way edges (`k→t`, `q→v`), two Surf nodes (`a`,`n`), two Rocket points (5.2 at `x`, 5.1 at `m`), and 3.3 & 3.5 both accessed from `r` (hence dedicated nodes). The result:

```ts
adj: buildAdjacency(CERULEAN_NODES, CERULEAN_EDGES, CERULEAN_DIRECTED_EDGES),
surfNodes: ['a', 'n'],

const CERULEAN_DIRECTED_EDGES: [string, string][] = [
  ['k', 't'],
  ['q', 'v'],
]

const CERULEAN_SITE_NODES: CitySiteNodes = {
  gym: 'u',                                        // 1
  center: 'p',                                     // 2 (reachable from p & t; stop at p)
  mart: 't',                                       // 4 (reachable from t & u; stop at t)
  museum: ['x', 'm'],                              // 5.2 then 5.1
  houses: ['h', 'i', 'c', 'g', 'p', 't', 'u'],     // 6.1..6.7
  green: ['g31', 'g32', 'g33', 'g34', 'g35'],      // 3.1..3.5
}
```

Markers used composite keys where a letter hosted several numbers, e.g. `'u:gym'` (1) + `'u:house'` (6.7), `'t:mart'` (4) + `'t:house'` (6.6), `'p:center'` (2) + `'p:house'` (6.5); single-kind ones used plain keys (`'x'` = 5.2, `'m'` = 5.1, `'c'`/`'g'`/`'h'`/`'i'` = houses).

Read the live `src/data/cities.ts` Cerulean block and `src/data/cerulean.test.ts` for the exact, current values.

## Engine facts you rely on (don't change these)

- `buildAdjacency(nodes, edges, directed = [])` — undirected `edges` link both ways; `directed` links one way only.
- Green/exploration nodes host **only captures** — `DAILY_CATEGORY_POOL` emits `house/center/mart` (+ the special `rocket`), never `freeArea`. The 6 normal mission types spawn at `houses`.
- `timeline.buildDaySchedule` gives the Rocket mission `siteIndex = min(order, museum.length-1)` where `order` is the day's index within the 2 sorted `rocketDays` — so `museum[0]`=first=5.2, `museum[1]`=second=5.1.
- `acceptMission` / `captureFlow.startReturn` compute outbound (`gym→node`) and return (`node→gym`) **separately** — directed edges make the return differ from the reversed outbound.
- `markerPos(graph, id, kind)` resolves `"id:kind"` first, then `markers[id]`, then the node position.

## Test checklist (mirror `cerulean.test.ts`)

- [ ] city name, types, and starter species/levels
- [ ] gym is the expected letter
- [ ] every adjacency target exists as a node
- [ ] each one-way edge: forward present, reverse absent
- [ ] all other edges symmetric (skip the declared one-way pairs)
- [ ] `surfNodes` equals the `(surf)` letters
- [ ] all site nodes (gym/center/mart/museum/houses/green) exist in the graph
- [ ] every site reachable from gym **and** has a path back to gym
- [ ] a one-way detour: return route ≠ reversed outbound, and is the real shortest path
- [ ] `nodesForCategory(siteNodes, 'rocket')` equals `[5.2, 5.1]`; across seeds the 1st rocket day → index 0, 2nd → index 1; no rocket on off days

## Final steps

- Unlock: add the index to `PLAYABLE_CITIES` in `CitySelectScreen.tsx`; update the `Textbox` copy.
- `npx tsc --noEmit && npx vitest run` must be green.
- Coordinates are estimates — note that they can be refined with the in-app DEV picker.
