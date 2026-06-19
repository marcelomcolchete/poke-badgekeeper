import { describe, expect, it } from 'vitest'
import type { TrainerId } from '../types/index.ts'
import { RIVAL_TRAINER_IDS, ROCKET_TRAINER_IDS } from '../types/index.ts'
import { getCity } from './cities.ts'
import { getTrainer } from './trainers.ts'

// Os 36 ids novos (6 líderes + 30 classes) — fonte da verdade para os testes.
const NEW_TRAINER_IDS: TrainerId[] = [
  'SURGE', 'VERMILION_ENGINEER', 'VERMILION_ROCKER', 'VERMILION_SAILOR',
  'VERMILION_GENTLEMAN', 'VERMILION_POKEMANIAC',
  'ERIKA', 'CELADON_BEAUTY', 'CELADON_LASS', 'CELADON_PICNICKER',
  'CELADON_BUGCATCHER', 'CELADON_GAMER',
  'KOGA', 'FUCHSIA_JUGGLER', 'FUCHSIA_TAMER', 'FUCHSIA_DRAGONTAMER',
  'FUCHSIA_BIRDKEEPER', 'FUCHSIA_SWIMMER',
  'SABRINA', 'SAFFRON_ACETRAINER', 'SAFFRON_SCIENTIST', 'SAFFRON_CHANNELER',
  'SAFFRON_HEXMANIAC', 'SAFFRON_BLACKBELT',
  'BLAINE', 'CINNABAR_BURGLAR', 'CINNABAR_SUPERNERD', 'CINNABAR_BLACKBELT',
  'CINNABAR_KINDLER', 'CINNABAR_SWIMMER',
  'GIOVANNI', 'VIRIDIAN_TAMER', 'VIRIDIAN_ACETRAINER', 'VIRIDIAN_YOUNGSTER',
  'VIRIDIAN_CAMPER', 'VIRIDIAN_BIKER',
]

describe('treinadores das cidades 3–8', () => {
  it('todo id novo resolve em getTrainer com nome e sprite', () => {
    for (const id of NEW_TRAINER_IDS) {
      const t = getTrainer(id)
      expect(t.displayName, id).toBeTruthy()
      expect(t.spritePath, id).toMatch(/^\/sprites\/trainers\/gen3\/.+-gen3(rs)?\.png$/)
    }
  })

  it('todo elenco resolvido é roster não-vazio', () => {
    for (const id of NEW_TRAINER_IDS) {
      const { pool } = getTrainer(id)
      expect(pool.kind, id).toBe('roster')
      if (pool.kind === 'roster') expect(pool.speciesIds.length, id).toBeGreaterThan(0)
    }
  })

  it('altSprites, quando presentes, também são gen3rs válidos', () => {
    for (const id of NEW_TRAINER_IDS) {
      for (const alt of getTrainer(id).altSprites ?? []) {
        expect(alt, id).toMatch(/^\/sprites\/trainers\/gen3\/.+-gen3rs\.png$/)
      }
    }
  })
})

describe('listas de treinadores por cidade (3–8)', () => {
  const EXPECTED: { index: number; name: string; leader: TrainerId }[] = [
    { index: 2, name: 'Vermilion', leader: 'SURGE' },
    { index: 3, name: 'Celadon', leader: 'ERIKA' },
    { index: 4, name: 'Fuchsia', leader: 'KOGA' },
    { index: 5, name: 'Saffron', leader: 'SABRINA' },
    { index: 6, name: 'Cinnabar', leader: 'BLAINE' },
    { index: 7, name: 'Viridian', leader: 'GIOVANNI' },
  ]
  const banned = new Set<TrainerId>([...RIVAL_TRAINER_IDS, ...ROCKET_TRAINER_IDS])

  for (const { index, name, leader } of EXPECTED) {
    it(`${name} tem líder + 5 treinadores, líder primeiro, sem rivais/Rocket`, () => {
      const city = getCity(index)
      expect(city.name).toBe(name)
      expect(city.trainers).toHaveLength(6)
      expect(city.trainers[0]).toBe(leader)
      for (const id of city.trainers) {
        expect(banned.has(id), `${id} não deveria estar na lista local`).toBe(false)
        expect(() => getTrainer(id)).not.toThrow()
      }
    })
  }
})
