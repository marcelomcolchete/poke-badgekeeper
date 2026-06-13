import { describe, expect, it } from 'vitest'
import { createRng, deriveSeed, hashString } from './rng.ts'

describe('createRng', () => {
  it('é determinístico: mesma seed → mesma sequência', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('seeds diferentes → sequências diferentes', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('next() fica em [0, 1)', () => {
    const r = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int() respeita os limites inclusivos', () => {
    const r = createRng(99)
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 8)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(8)
    }
  })

  it('int() com intervalo invertido lança erro', () => {
    const r = createRng(1)
    expect(() => r.int(5, 2)).toThrow()
  })

  it('shuffle() é uma permutação e não muta a entrada', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const r = createRng(42)
    const out = r.shuffle(input)
    expect(out).toHaveLength(input.length)
    expect([...out].sort((x, y) => x - y)).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('shuffle() é reprodutível para a mesma seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(createRng(2024).shuffle(input)).toEqual(createRng(2024).shuffle(input))
  })

  it('pick() em lista vazia lança erro', () => {
    expect(() => createRng(1).pick([])).toThrow()
  })
})

describe('hashString / deriveSeed', () => {
  it('hashString é determinístico e estável', () => {
    expect(hashString('pewter')).toBe(hashString('pewter'))
    expect(hashString('pewter')).not.toBe(hashString('cerulean'))
  })

  it('deriveSeed combina partes de forma determinística', () => {
    expect(deriveSeed(100, 3)).toBe(deriveSeed(100, 3))
    expect(deriveSeed(100, 3)).not.toBe(deriveSeed(100, 4))
  })
})
