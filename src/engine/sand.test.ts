import { describe, it, expect } from 'vitest'
import { getCity } from '../data/cities.ts'
import { graphWithTunnels } from './pathfinding.ts'
import { buildSand, isSanding, pickLostNode, sandChanceForDay, maxSandTimes } from './sand.ts'
import { createRng } from './rng.ts'

describe('sand schedule', () => {
  it('chance bate com Viridian {25,1,60}', () => {
    const c = sandChanceForDay(1, 5, 7)
    expect(c).toBeGreaterThanOrEqual(30) // piso dia 5 = 30
    expect(c).toBeLessThanOrEqual(60)
  })

  it('cidade sem areia / dia < 3 → chance 0 e schedule vazio', () => {
    expect(sandChanceForDay(1, 5, 1)).toBe(0)
    expect(buildSand(1, 9, getCity(1))).toEqual([])
  })

  it('determinístico, janelas não-sobrepostas 30–60s', () => {
    const city = getCity(7)
    const a = buildSand(3, 9, city)
    expect(a).toEqual(buildSand(3, 9, city))
    for (let i = 0; i < a.length; i++) {
      const dur = a[i]!.endMs - a[i]!.startMs
      expect(dur).toBeGreaterThanOrEqual(30_000)
      expect(dur).toBeLessThanOrEqual(60_000)
      if (i > 0) expect(a[i]!.startMs).toBeGreaterThanOrEqual(a[i - 1]!.endMs)
    }
  })

  it('maxSandTimes = curva da chuva', () => {
    expect(maxSandTimes(6)).toBe(2)
  })

  it('isSanding', () => {
    expect(isSanding([{ startMs: 0, endMs: 1000 }], 500)).toBe(true)
    expect(isSanding([{ startMs: 0, endMs: 1000 }], 1000)).toBe(false)
  })

  it('pickLostNode devolve um nó alcançável, ≠ origem e ≠ destino, e é determinístico', () => {
    const city = getCity(7)
    const graph = graphWithTunnels(city.graph, [])
    const gym = city.siteNodes.gym
    const dest = Object.keys(graph.nodes).find((n) => n !== gym)!
    const node = pickLostNode(createRng(42), graph, gym, dest, [], [])
    expect(node).not.toBeNull()
    expect(node).not.toBe(gym)
    expect(node).not.toBe(dest)
    expect(pickLostNode(createRng(42), graph, gym, dest, [], [])).toBe(node)
  })
})
