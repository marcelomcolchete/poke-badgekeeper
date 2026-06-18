import { describe, expect, it } from 'vitest'
import { SECRET_KINDS, SECRET_LINES, secretLineFor, type SecretId } from './secretAbilities.ts'

// Linhas de Cerulean (do CSV), chaveadas pela raiz evolutiva. Omanyte/Kabuto (fóssil) já
// existiam e batem com o CSV; aqui validamos que continuam corretos.
const CERULEAN_LINES: Record<number, readonly [SecretId, SecretId, SecretId]> = {
  7: ['sa-surf', 'sa-torrent', 'sa-surf-plus'], // Squirtle
  54: ['sa-surf', 'sa-swift-swim', 'sa-cloud-nine'], // Psyduck
  60: ['sa-water-absorb', 'sa-surf', 'sa-swift-swim'], // Poliwag
  72: ['sa-clear-body', 'sa-surf', 'sa-surf-plus'], // Tentacool
  79: ['sa-regenerator', 'sa-own-tempo', 'sa-surf'], // Slowpoke
  86: ['sa-surf', 'sa-ice-body', 'sa-thick-fat'], // Seel
  90: ['sa-shell-armor', 'sa-overcoat', 'sa-surf'], // Shellder
  98: ['sa-dig', 'sa-shell-armor', 'sa-dig-plus'], // Krabby
  116: ['sa-swift-swim', 'sa-surf', 'sa-sniper'], // Horsea
  118: ['sa-surf', 'sa-swift-swim', 'sa-surf-plus'], // Goldeen
  120: ['sa-analytic', 'sa-surf', 'sa-natural-cure'], // Staryu
  124: ['sa-dry-skin', 'sa-forewarn', 'sa-analytic'], // Jynx
  129: ['sa-surf', 'sa-moxie', 'sa-surf-plus'], // Magikarp
  131: ['sa-surf', 'sa-surf-plus', 'sa-shell-armor'], // Lapras
  138: ['sa-swift-swim', 'sa-shell-armor', 'sa-weak-armor'], // Omanyte (fóssil, já existia)
  140: ['sa-battle-armor', 'sa-weak-armor', 'sa-swift-swim'], // Kabuto (fóssil, já existia)
  144: ['sa-fly', 'sa-fly-plus', 'sa-pressure'], // Articuno
}

describe('Habilidades Secretas de Cerulean', () => {
  it('cada linha evolutiva mapeia para as habilidades do CSV', () => {
    for (const [root, line] of Object.entries(CERULEAN_LINES)) {
      expect(secretLineFor(Number(root)), `linha ${root}`).toEqual(line)
    }
  })

  it('a habilidade fica gravada na linha (formas evoluídas herdam a raiz)', () => {
    expect(secretLineFor(9)).toEqual(secretLineFor(7)) // Blastoise = Squirtle
    expect(secretLineFor(130)).toEqual(secretLineFor(129)) // Gyarados = Magikarp
    expect(secretLineFor(121)).toEqual(secretLineFor(120)) // Starmie = Staryu
  })

  it('eeveelutions têm linhas próprias por espécie (override) sem vazar entre si', () => {
    expect(secretLineFor(134)).toEqual(['sa-surf', 'sa-surf-plus', 'sa-water-absorb']) // Vaporeon
    expect(secretLineFor(135)).toEqual(['sa-quick-feet', 'sa-volt-absorb', 'sa-static']) // Jolteon
    // Eevee (133) e os eeveelutions sem override próprio não herdam nada.
    expect(secretLineFor(133)).toBeNull()
    expect(secretLineFor(136)).toBeNull() // Flareon
  })

  it('todo id usado nas linhas existe no catálogo SECRET_KINDS', () => {
    const ids = new Set(Object.values(SECRET_LINES).flat() as SecretId[])
    ids.add('sa-surf')
    ids.add('sa-surf-plus')
    ids.add('sa-water-absorb')
    for (const id of ids) {
      expect(SECRET_KINDS[id], `catálogo de ${id}`).toBeDefined()
      expect(SECRET_KINDS[id].id).toBe(id)
    }
  })
})
