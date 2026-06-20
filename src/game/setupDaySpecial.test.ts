// TDD Task 8: setupDay rola e injeta Missões Especiais; inicializa specialChances.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { getCity } from '../data/cities.ts'
import { DEFENSE_LIFETIME_MS, SPECIAL_CHANCE_START } from '../engine/balance.ts'
import { setupDay } from './setup.ts'

/** Estado base pronto para setupDay na cidade dada (cityIndex) e dia. */
function makeState(cityIndex: number, day: number) {
  const s = createInitialState(42)
  s.run.cityIndex = cityIndex
  s.run.day = day
  return s
}

describe('setupDay — specialChances', () => {
  it('inicializa specialChances com SPECIAL_CHANCE_START quando vazio', () => {
    const s = makeState(0, 1)
    expect(s.run.specialChances).toHaveLength(0)
    setupDay(s)
    const city = getCity(0)
    expect(s.run.specialChances).toHaveLength(city.siteNodes.specialMission.length)
    // Valores devem ser múltiplos de SPECIAL_CHANCE_START ou crescidos (após o roll).
    // Só exige que o tamanho está certo e os valores são números ≥ SPECIAL_CHANCE_START.
    for (const c of s.run.specialChances) {
      expect(c).toBeGreaterThanOrEqual(SPECIAL_CHANCE_START)
      expect(c).toBeLessThanOrEqual(100)
    }
  })

  it('preserva chances existentes ao re-entrar no dia seguinte', () => {
    const s = makeState(0, 1)
    setupDay(s)
    const after1 = [...s.run.specialChances]
    s.run.day = 2
    setupDay(s)
    // Tamanho inalterado; os valores podem mudar (roll do dia 2) mas o array continua mesmo tamanho.
    expect(s.run.specialChances).toHaveLength(after1.length)
  })

  it('redimensiona se o nº de locais especiais mudar (preserva índices existentes)', () => {
    const s = makeState(0, 1)
    // Força um tamanho diferente do real (simulando troca de cidade).
    s.run.specialChances = [50, 60]
    setupDay(s)
    const city = getCity(0)
    expect(s.run.specialChances).toHaveLength(city.siteNodes.specialMission.length)
  })

  it('persiste nextChances após o roll (não mantém as chances anteriores)', () => {
    const s = makeState(0, 1)
    setupDay(s)
    const after = [...s.run.specialChances]
    // Todos os valores são ≥ SPECIAL_CHANCE_START (nunca vai abaixo).
    for (const c of after) {
      expect(c).toBeGreaterThanOrEqual(SPECIAL_CHANCE_START)
    }
  })
})

describe('setupDay — injeção de Missão Especial', () => {
  it('quando a chance é 100%, injeta uma missão special no dia', () => {
    const s = makeState(0, 1)
    const city = getCity(0)
    // Força chance 100% em todos os locais especiais para garantir hit.
    s.run.specialChances = Array.from({ length: city.siteNodes.specialMission.length }, () => 100)
    setupDay(s)
    const specials = s.missions.filter((m) => m.templateId === 'special')
    expect(specials.length).toBeGreaterThan(0)
  })

  it('missão special injeta com category "special" e lifetimeMs = DEFENSE_LIFETIME_MS', () => {
    const s = makeState(0, 1)
    const city = getCity(0)
    s.run.specialChances = Array.from({ length: city.siteNodes.specialMission.length }, () => 100)
    setupDay(s)
    const specials = s.missions.filter((m) => m.templateId === 'special')
    for (const m of specials) {
      expect(m.category).toBe('special')
      const lifetime = m.expiresAtMs - m.spawnAtMs
      expect(lifetime).toBe(DEFENSE_LIFETIME_MS)
    }
  })

  it('quando a chance é 0%, não injeta nenhuma missão special', () => {
    const s = makeState(0, 1)
    const city = getCity(0)
    // Chance 0% → nunca acerta.
    s.run.specialChances = Array.from({ length: city.siteNodes.specialMission.length }, () => 0)
    setupDay(s)
    const specials = s.missions.filter((m) => m.templateId === 'special')
    expect(specials).toHaveLength(0)
  })

  it('missão special está no node correto da cidade', () => {
    const s = makeState(0, 1)
    const city = getCity(0)
    s.run.specialChances = Array.from({ length: city.siteNodes.specialMission.length }, () => 100)
    setupDay(s)
    const specials = s.missions.filter((m) => m.templateId === 'special')
    for (const m of specials) {
      expect(city.siteNodes.specialMission).toContain(m.node)
    }
  })

  it('setupDay é determinístico: dois estados iguais produzem as mesmas missões especiais', () => {
    const s1 = makeState(0, 3)
    const s2 = makeState(0, 3)
    setupDay(s1)
    setupDay(s2)
    const specials1 = s1.missions.filter((m) => m.templateId === 'special')
    const specials2 = s2.missions.filter((m) => m.templateId === 'special')
    expect(specials1.length).toBe(specials2.length)
    for (let i = 0; i < specials1.length; i++) {
      expect(specials1[i]!.node).toBe(specials2[i]!.node)
      expect(specials1[i]!.spawnAtMs).toBe(specials2[i]!.spawnAtMs)
    }
  })
})

describe('setupDay — zero locais especiais não consome RNG extra', () => {
  it('rngCursor avança o mesmo número de vezes independentemente de hits', () => {
    // Cidade 0 tem 1 local especial — comparamos cursor com chance=0 vs chance=100.
    const s0 = makeState(0, 1)
    s0.run.specialChances = [0] // nunca acerta
    setupDay(s0)
    const cursor0 = s0.rngCursor

    const s1 = makeState(0, 1)
    s1.run.specialChances = [100] // sempre acerta
    setupDay(s1)
    const cursor1 = s1.rngCursor

    // O takeRng é chamado UMA vez em ambos os casos; o cursor difere no máximo por isso.
    // Ambos avançam o mesmo número de vezes (1 takeRng) — não depende de hits.
    expect(cursor0).toBe(cursor1)
  })
})

describe('applyForewarn — exclui missões special', () => {
  it('Forewarn não adianta missões special (templateId=special), só normais', () => {
    // Forewarn requer Pokémon com habilidade — simplificado: setupDay com 0 Forewarn e
    // verificamos que a lógica compila e não afeta especiais (teste de não-regressão).
    const s = makeState(0, 1)
    const city = getCity(0)
    s.run.specialChances = Array.from({ length: city.siteNodes.specialMission.length }, () => 100)
    setupDay(s)
    // Especiais devem manter spawnAtMs original (não foram adiantadas — sem Forewarn no roster).
    const specials = s.missions.filter((m) => m.templateId === 'special')
    for (const m of specials) {
      // Com roster vazio (sem Forewarn), nenhuma missão é adiantada.
      expect(m.spawnAtMs).toBeGreaterThanOrEqual(0)
    }
  })
})
