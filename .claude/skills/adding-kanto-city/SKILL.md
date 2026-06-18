---
name: adding-kanto-city
description: Use when given a top-down city map image plus a CSV (columns ponto/adjacentes/missões) and asked to add, enable, or fully set up a playable city in the poke-badgekeeper game — its waypoint graph (one-way edges, Surf-gated water), the ginásio/center/mart/houses/exploration/Equipe Rocket sites, plus the per-city trainers, items, and weather.
---

# Adding a Kanto city from a map image + CSV

## Overview

poke-badgekeeper has **8 fixed cities** (`SEEDS` index 0–7). A "new" city is **filling in an existing entry** with a calibrated graph + site mapping + themed trainers/items, then unlocking it. Inputs are always: an annotated top-down art (`public/maps/kanto/<index+1>.png`, 1920×1080) and a CSV.

**This repo moves fast — treat the code as the source of truth, not this skill's specifics.** Exact values (which sites a city has, how many Rocket points, item lists) change. So:

> **Step 0 — always do this first:** open the current **Cerulean** block in `src/data/cities.ts`, `src/data/cerulean.test.ts`, and the per-system files named below. The *shape* and the *stable design intent* are in this skill; the *current values and conventions* are in those files. If they disagree, the code wins.

## Inputs

- **Image** — letters = waypoints (Pokémon walk here); numbers = clickable mission popups. Read each label's center as a normalized `(0–1)` position. Coordinates are **estimates**, refinable with the DEV picker (`CityMap.tsx` logs `{x,y}` on click in dev).
- **CSV** (`ponto, adjacentes, missões`):
  - `ponto` — waypoint letter. Suffix `(surf)` ⇒ water node (goes in `graph.surfNodes`).
  - `adjacentes` — neighbor letters. **Directed:** A lists B but B does NOT list A ⇒ one-way `A→B`.
  - `missões` — numbered popups reachable from this waypoint (`—` = none).

## Numbered legend (stable design intent)

| Number | Meaning | Where it goes | Notes |
|---|---|---|---|
| 1 | Ginásio (gym) | `siteNodes.gym` | single node; travel origin + defenses. **NOT necessarily `j`/`u`.** |
| 2 | Poké Center | `siteNodes.center` | heal-on-success mission |
| 3.x | Área de exploração | `siteNodes.green` (dedicated node each) | **CAPTURE ONLY** — never hosts normal missions |
| 4 | Poké Mart | `siteNodes.mart` | gold mission |
| 5.x | Equipe Rocket | `siteNodes.museum` (list) | **how many points is a live convention — see Rocket note** |
| 6.x | Casas (houses) | `siteNodes.houses` | host the 6 normal mission types |

**Rocket note:** `museum` is a list, but the *current* design uses a **single** Rocket point — both of the run's Rocket missions collapse there (like Pewter). Cerulean's live `museum` is `['x']`, and its other 5.x label was repurposed into a `green` area. An earlier two-point ordered design (`[5.2, 5.1]`) was **reverted**. So: read the live `CERULEAN_SITE_NODES.museum`, and if the image has two 5.x labels, confirm the intended treatment rather than assuming.

## Systems a city touches (per-city vs. automatic)

| System | New city must… | Source of truth |
|---|---|---|
| **Graph + sites** | define `_NODES/_EDGES/_DIRECTED_EDGES/_MARKERS` → `buildAdjacency(nodes, edges, directed)`, `surfNodes`, and `_SITE_NODES`; wire onto the existing seed | `src/data/cities.ts` |
| **Trainers** | optionally set `trainers: TrainerId[]` (themed classes incl. the gym leader, e.g. `MISTY`). Rivals (`RIVAL_TRAINER_IDS`) are appended automatically in `setup.ts`; omit ⇒ `GENERIC_TRAINERS`. Every id must exist in `TRAINER_LIST` | `cities.ts`, `data/trainers.ts`, `types/index.ts` |
| **Items** | optionally add `CITY_ITEM_IDS[index]` (themed extras; globals auto-included) | `src/data/items.ts` |
| **Surf** | set `graph.surfNodes` to the water letters. **Enforced:** if a route crosses water and the team can't surf, dispatch is blocked (`travelRoute` → empty path → `acceptMission` returns). "Can surf" = `teamSurfs` (item `surfboard`, or `sa-surf` solo / `sa-surf-plus` for the team) | `secretEffects.ts`, `pathfinding.ts`, `missions.ts`, `game/missionFlow.ts` |
| **Secret abilities** | **nothing** — they're global per species line; starters/wild Pokémon inherit them. Only touch if adding/adjusting species | `src/data/secretAbilities.ts` |
| **Weather** | optionally add `CITY_WEATHER[index]` (e.g. `{ effects: [{ kind: 'rain' }] }`) | `src/data/cityWeather.ts` |
| **Unlock** | add the index to `PLAYABLE_CITIES`; update the `Textbox` copy. `cityIndex` is already wired (`SELECT_CITY`) | `CitySelectScreen.tsx` |
| **Map art** | already exists (`<index+1>.png`, `_capa.png`). Only add files if the art is genuinely new | `public/maps/kanto/` |

## Procedure

1. **Step 0** (above): read the live Cerulean block + `cerulean.test.ts` + the per-system files.
2. **`src/data/cities.ts`** — add the `<CITY>_*` consts, build the graph + site nodes, and set `graph`/`siteNodes` (and `trainers` if themed) on the **existing** seed. Adjust `starters`/types only if the brief differs from what's there. Skeleton + per-system shapes + test checklist: [template.md](template.md).
3. **`src/data/items.ts`** — add `CITY_ITEM_IDS[index]` if the brief gives themed items.
4. **`src/data/cityWeather.ts`** — add an entry if the city should have weather.
5. **`CitySelectScreen.tsx`** — unlock the index; update the copy.
6. **`src/data/<city>.test.ts`** — mirror `cerulean.test.ts`.
7. **Verify**: `npx tsc --noEmit && npx vitest run`. Prefer tests over the browser preview (project preference is to avoid preview unless asked).

## Gotchas

- **Return ≠ reverse of outbound** with one-way edges (`shortestPath` is directed; outbound and return are computed separately). Test each site is reachable from the gym *and* back.
- **Surf-gated sites are intended but enforced:** a site reachable only across `surfNodes` needs a surfing team, and a non-surf team's dispatch is blocked (empty path). Account for this in reachability tests (water routes return `[]` without Surf).
- A stop node equal to the gym gives 0 travel (fine for a house; avoid for center/mart).
- Verify species IDs in `src/data/pokemon/species.generated.ts`; verify trainer ids in `TRAINER_LIST`.

## Common mistakes

- Appending a new `SEEDS` entry instead of filling the existing index.
- Treating 3.x areas as mission spots, or mapping `freeArea` to them — they are capture-only.
- **Freezing a "5.2 first / 5.1 second" Rocket rule** — that was reverted; check the live `museum`.
- Assuming trainers/items are "reuse Pewter" — they're per-city now; read the current wiring.
- Assuming the gym is `j` (it's whatever "1" maps to).
- Forgetting `_DIRECTED_EDGES` for one-way CSV asymmetries.
