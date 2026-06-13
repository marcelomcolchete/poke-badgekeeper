// As 8 cidades de Kanto (PLAN §3.1 / §4.8).
// Cada cidade aponta para sua arte top-down (/maps/kanto/N.png, 1920×1080) e define
// os SÍTIOS do mapa (posições normalizadas 0–1): onde cada evento/missão pode surgir.
// Só Pewter está calibrada; as demais herdam um placeholder até a arte ser anotada.

import type { MapPos, MissionCategory, SiteKind } from '../types/index.ts'
import { CATEGORY_SITE } from '../types/index.ts'
import type { CityData, CitySites } from './types.ts'

// Placeholder (compartilhado) para cidades ainda não calibradas — reusa o layout de Pewter.
const PLACEHOLDER_SITES: CitySites = {
  gym: { x: 0.38, y: 0.34 },
  center: { x: 0.41, y: 0.56 },
  mart: { x: 0.56, y: 0.42 },
  museum: { x: 0.41, y: 0.08 },
  houses: [
    { x: 0.52, y: 0.08 },
    { x: 0.65, y: 0.23 },
  ],
  green: [
    { x: 0.25, y: 0.08 },
    { x: 0.65, y: 0.08 },
    { x: 0.65, y: 0.44 },
    { x: 0.81, y: 0.54 },
    { x: 0.3, y: 0.72 },
    { x: 0.56, y: 0.7 },
    { x: 0.47, y: 0.96 },
  ],
}

// Pewter (1.png): calibrado sobre a arte anotada (ginásio, centro, mart, museu, casas, verdes).
const PEWTER_SITES: CitySites = {
  gym: { x: 0.38, y: 0.34 },
  center: { x: 0.41, y: 0.56 },
  mart: { x: 0.56, y: 0.42 },
  museum: { x: 0.41, y: 0.08 },
  houses: [
    { x: 0.52, y: 0.08 },
    { x: 0.65, y: 0.23 },
  ],
  green: [
    { x: 0.25, y: 0.08 },
    { x: 0.65, y: 0.08 },
    { x: 0.65, y: 0.44 },
    { x: 0.81, y: 0.54 },
    { x: 0.3, y: 0.72 },
    { x: 0.56, y: 0.7 },
    { x: 0.47, y: 0.96 },
  ],
}

interface CitySeed {
  name: string
  primaryType: CityData['primaryType']
  starterSpeciesId: number
  difficultyFactor: number
  sites?: CitySites
  museumMissionId?: string
}

// Inicial = um Pokémon não-evoluído do tipo primário (nível 3), à la Onix em Pewter.
const SEEDS: CitySeed[] = [
  {
    name: 'Pewter',
    primaryType: 'rock',
    starterSpeciesId: 95,
    difficultyFactor: 1.0,
    sites: PEWTER_SITES,
    museumMissionId: 'museum-fossil',
  },
  { name: 'Cerulean', primaryType: 'water', starterSpeciesId: 120, difficultyFactor: 1.1 },
  { name: 'Vermilion', primaryType: 'electric', starterSpeciesId: 100, difficultyFactor: 1.25 },
  { name: 'Celadon', primaryType: 'grass', starterSpeciesId: 43, difficultyFactor: 1.4 },
  { name: 'Fuchsia', primaryType: 'poison', starterSpeciesId: 23, difficultyFactor: 1.5 },
  { name: 'Saffron', primaryType: 'psychic', starterSpeciesId: 63, difficultyFactor: 1.65 },
  { name: 'Cinnabar', primaryType: 'fire', starterSpeciesId: 58, difficultyFactor: 1.8 },
  { name: 'Viridian', primaryType: 'ground', starterSpeciesId: 27, difficultyFactor: 2.0 },
]

// Todos os mapas têm o mesmo tamanho (16:9).
const MAP_W = 1920
const MAP_H = 1080

export const CITIES: CityData[] = SEEDS.map((s, index) => ({
  index,
  name: s.name,
  primaryType: s.primaryType,
  starterSpeciesId: s.starterSpeciesId,
  mapImage: `/maps/kanto/${index + 1}.png`,
  mapW: MAP_W,
  mapH: MAP_H,
  difficultyFactor: s.difficultyFactor,
  sites: s.sites ?? PLACEHOLDER_SITES,
  museumMissionId: s.museumMissionId,
}))

export function getCity(index: number): CityData {
  const city = CITIES[index]
  if (!city) throw new Error(`Cidade ${index} não encontrada`)
  return city
}

/** Lista de sítios onde uma categoria de missão pode surgir, nesta cidade. */
export function sitesForCategory(sites: CitySites, category: MissionCategory): MapPos[] {
  return sitesByKind(sites, CATEGORY_SITE[category])
}

/** Sítios de um dado tipo (únicos viram lista de 1 elemento). */
export function sitesByKind(sites: CitySites, kind: SiteKind): MapPos[] {
  switch (kind) {
    case 'gym':
      return [sites.gym]
    case 'center':
      return [sites.center]
    case 'mart':
      return [sites.mart]
    case 'museum':
      return [sites.museum]
    case 'house':
      return sites.houses
    case 'green':
      return sites.green
  }
}
