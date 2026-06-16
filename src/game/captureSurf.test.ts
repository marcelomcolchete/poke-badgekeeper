// Exploração respeita Surf: um não-surfista não pode ser despachado para uma área cercada de
// água (ex.: 3.6 em 'm', que só liga por 'a'/'n'). Antes, startSearch criava uma busca de caminho
// vazio (o explorador "teleportava" do ginásio até lá). Ver game/captureFlow.ts.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { createPokemon } from '../engine/leveling.ts'
import { createRng } from '../engine/rng.ts'
import { startSearch } from './captureFlow.ts'

/** Estado em Cerulean com um Pokémon que não surfa e UM spot de captura no ponto dado. */
function ceruleanWithSpot(node: string) {
  const s = createInitialState(1)
  s.run.cityIndex = 1
  s.roster = [createPokemon({ id: 'p1', speciesId: 19 /* Rattata: sem Surf */, level: 5, rng: createRng(1) })]
  s.captureSpots = [node]
  s.captureSpotSpawnsAtMs = [0]
  s.clock.dayElapsedMs = 10_000 // a área já surgiu
  return s
}

describe('startSearch — validação de Surf na exploração', () => {
  it('NÃO despacha um não-surfista para área só acessível por água (3.6 em "m")', () => {
    const s = ceruleanWithSpot('m')
    startSearch(s, 'p1', 0)
    expect(s.captureSearches).toHaveLength(0) // sem viagem instantânea de caminho vazio
    expect(s.roster[0]!.status).toBe('idle') // o explorador continua disponível
  })

  it('despacha normalmente para área alcançável a pé (3.1 em "g31")', () => {
    const s = ceruleanWithSpot('g31')
    startSearch(s, 'p1', 0)
    expect(s.captureSearches).toHaveLength(1)
    expect(s.captureSearches[0]!.path.length).toBeGreaterThan(0)
  })
})
