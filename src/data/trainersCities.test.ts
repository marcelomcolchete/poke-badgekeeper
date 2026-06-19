import { describe, expect, it } from 'vitest'
import type { TrainerId } from '../types/index.ts'
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
