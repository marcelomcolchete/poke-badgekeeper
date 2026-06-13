// As 8 cidades de Kanto (PLAN §3.1 / §4.8).
// As âncoras de mapa são provisórias (compartilhadas) até a arte real entrar na Fase 4.

import type { MapPos } from '../types/index.ts'
import type { CityData } from './types.ts'

const GYM_POS: MapPos = { x: 0.5, y: 0.2 }

const CAPTURE_SPOTS: MapPos[] = [
  { x: 0.74, y: 0.83 },
  { x: 0.58, y: 0.5 },
]

const MISSION_ANCHORS: MapPos[] = [
  { x: 0.29, y: 0.71 },
  { x: 0.76, y: 0.55 },
  { x: 0.41, y: 0.67 },
  { x: 0.2, y: 0.4 },
  { x: 0.62, y: 0.3 },
  { x: 0.5, y: 0.85 },
]

interface CitySeed {
  name: string
  primaryType: CityData['primaryType']
  starterSpeciesId: number
  difficultyFactor: number
}

// Inicial = um Pokémon não-evoluído do tipo primário (nível 3), à la Onix em Pewter.
const SEEDS: CitySeed[] = [
  { name: 'Pewter', primaryType: 'rock', starterSpeciesId: 95, difficultyFactor: 1.0 },
  { name: 'Cerulean', primaryType: 'water', starterSpeciesId: 120, difficultyFactor: 1.1 },
  { name: 'Vermilion', primaryType: 'electric', starterSpeciesId: 100, difficultyFactor: 1.25 },
  { name: 'Celadon', primaryType: 'grass', starterSpeciesId: 43, difficultyFactor: 1.4 },
  { name: 'Fuchsia', primaryType: 'poison', starterSpeciesId: 23, difficultyFactor: 1.5 },
  { name: 'Saffron', primaryType: 'psychic', starterSpeciesId: 63, difficultyFactor: 1.65 },
  { name: 'Cinnabar', primaryType: 'fire', starterSpeciesId: 58, difficultyFactor: 1.8 },
  { name: 'Viridian', primaryType: 'ground', starterSpeciesId: 27, difficultyFactor: 2.0 },
]

export const CITIES: CityData[] = SEEDS.map((s, index) => ({
  index,
  name: s.name,
  primaryType: s.primaryType,
  starterSpeciesId: s.starterSpeciesId,
  mapImage: `/maps/${s.name.toLowerCase()}.png`,
  difficultyFactor: s.difficultyFactor,
  missionAnchors: MISSION_ANCHORS,
  captureSpots: CAPTURE_SPOTS,
  gymPos: GYM_POS,
}))

export function getCity(index: number): CityData {
  const city = CITIES[index]
  if (!city) throw new Error(`Cidade ${index} não encontrada`)
  return city
}
