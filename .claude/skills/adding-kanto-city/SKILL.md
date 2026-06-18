---
name: adding-kanto-city
description: Use when given a top-down city map image plus a CSV (columns ponto/adjacentes/missões) and asked to add, enable, or calibrate a playable city in the poke-badgekeeper game — mapping ginásio/gym, Poké Center, Poké Mart, casas/houses, áreas de exploração, and Equipe Rocket points, the lettered waypoint graph with one-way edges, and Surf-gated nodes.
---

# Adding a Kanto city from a map image + CSV

## Overview

poke-badgekeeper has **8 fixed cities** (`SEEDS` index 0–7). A "new" city is really **filling in an existing placeholder** entry with a calibrated graph + site mapping, then unlocking it. The inputs are always the same: an annotated top-down art (`public/maps/kanto/<index+1>.png`, 1920×1080) and a CSV. This skill maps those inputs to the data model.

Reference implementations: **Pewter** (index 0) and **Cerulean** (index 1) in `src/data/cities.ts`. Read the Cerulean block — it is the canonical worked example.

## Inputs

**Image** — letters = waypoints (where Pokémon walk); numbers = clickable mission popups. Read each label's center as a normalized `(0–1)` position. Coordinates are **estimates**; refine later with the DEV picker (clicking the map in dev logs `{x,y}` — see `CityMap.tsx`).

**CSV** (`ponto, adjacentes, missões`):
- `ponto` — waypoint letter. Suffix `(surf)` ⇒ Surf-gated node.
- `adjacentes` — neighbor letters. **Directed:** if A lists B but B does NOT list A, that edge is one-way `A→B`.
- `missões` — numbered popups reachable from this waypoint (`—` = none).

## Numbered legend (authoritative)

| Number | Meaning | `siteNodes` field | Notes |
|---|---|---|---|
| 1 | Ginásio (gym) | `gym` | single node; travel origin + gym defenses. **NOT necessarily `j`.** |
| 2 | Poké Center | `center` | heal-on-success special mission |
| 3.x | Área de exploração | `green` | **CAPTURE ONLY** — never hosts normal missions |
| 4 | Poké Mart | `mart` | gold special mission |
| 5.x | Equipe Rocket | `museum` (ordered list) | **5.2 = 1st** occurrence, **5.1 = 2nd** |
| 6.x | Casas (houses) | `houses` | host the 6 normal mission types |

## Settled conventions (don't re-litigate these as "ambiguities")

- **Fill, don't append.** Image "cidade N" = `SEEDS` index **N−1**. Set `graph` + `siteNodes` on that existing entry; add the index to `PLAYABLE_CITIES`. Never add a 9th seed.
- **Map assets already exist** (`<index+1>.png` and `<index+1>_capa.png` for all 8 cities).
- **Reuse Pewter** for trainers and items. The `CITIES` map hardcodes `trainers: PEWTER_TRAINERS` for *every* city — there is nothing to add to the seed, no per-city trainer field, and no `GENERIC_TRAINERS` fallback. Items are global. Do NOT invent rosters unless the brief explicitly says so.
- **Exploration areas (3.x) = dedicated `green` nodes** (`g31`, `g32`, …) positioned over the number, each with ONE edge to its access letter. This is required when two areas share an access letter (e.g. Cerulean 3.3 & 3.5 both off `r`) — sharing a stop node would collide their markers.
- **`museum` is an ordered list `[5.2node, 5.1node]`.** The engine schedules the earlier Rocket day to index 0 (5.2) and the later day to index 1 (5.1); the two days are always distinct (never the same day).
- **Surf = metadata only.** Set `graph.surfNodes` from `(surf)` labels. Do NOT block dispatch yet — enforcement is deferred to the Surf-ability plan.
- **One stop per single-site.** If gym/center/mart/a house is reachable from several letters, pick ONE stop letter (prefer a non-gym letter for center/mart, so travel isn't 0). When a stop hosts more than one number, give each a composite marker key `node:kind` (e.g. `u:gym`, `u:house`, `p:center`, `p:house`).

## Procedure

1. **`src/data/cities.ts`** — add `<CITY>_NODES / _EDGES / _DIRECTED_EDGES / _MARKERS`, build `<CITY>_GRAPH` via `buildAdjacency(nodes, edges, directed)` + `surfNodes`, build `<CITY>_SITE_NODES`, then set `graph`/`siteNodes` on the city's **existing** `SEEDS` entry. Adjust `starters`/types only if the brief differs from what's already there. Full skeleton + a filled Cerulean example: see [template.md](template.md).
2. **`src/components/screens/CitySelectScreen.tsx`** — add the index to `PLAYABLE_CITIES`; update the `Textbox` copy.
3. **`src/data/<city>.test.ts`** — mirror `cerulean.test.ts`: types/starters; one-way edges present one-way / all others symmetric; `surfNodes`; all site nodes exist in the graph; every site reachable from gym AND has a path back; Rocket order = `[5.2, 5.1]`; a return-≠-reverse case for a one-way detour.
4. **Verify**: `npx tsc --noEmit && npx vitest run`.

## Gotchas

- **Return ≠ reverse of outbound** when one-way edges exist (`shortestPath` is directed; the engine computes outbound and return separately). Always test that each site is reachable from the gym *and* has a path back — a site you can reach but not leave strands the team.
- A stop node equal to the gym node gives 0 travel time (fine for a house; avoid for center/mart).
- Verify species IDs in `src/data/pokemon/species.generated.ts`.

## Common mistakes

- Appending a new `SEEDS` entry instead of filling the existing index.
- Treating 3.x areas as mission spots, or mapping `freeArea` to them — they are capture-only.
- Mapping Rocket 5.1 first; 5.2 is first, 5.1 second.
- Inventing trainer/item lists instead of reusing Pewter.
- Assuming the gym is `j` (it's whatever "1" maps to).
- Forgetting the `_DIRECTED_EDGES` for one-way asymmetries in the CSV.
