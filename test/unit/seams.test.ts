import { afterEach, describe, expect, it } from 'vitest'
import {
  manualClock,
  now,
  resetClock,
  setClock,
} from '../../src/engine/clock'
import {
  pickFrom,
  random,
  resetRandom,
  scripted,
  seeded,
  setRandom,
} from '../../src/engine/random'

/**
 * The seams themselves. They are three lines each, but every other test in the
 * suite is only trustworthy if these are: a generator that drifts between runs
 * would make the whole suite flaky in a way that looks like a game bug.
 */

afterEach(() => {
  resetRandom()
  resetClock()
})

describe('random', () => {
  it('is Math.random until something swaps it', () => {
    const value = random()
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('uses whatever is set, and goes back on reset', () => {
    setRandom(() => 0.42)
    expect(random()).toBe(0.42)
    resetRandom()
    expect(random()).not.toBe(0.42)
  })

  it('gives the same sequence for the same seed', () => {
    const a = seeded(7)
    const b = seeded(7)
    const first = [a(), a(), a(), a(), a()]
    const second = [b(), b(), b(), b(), b()]
    expect(first).toEqual(second)
  })

  it('gives different sequences for different seeds', () => {
    expect(seeded(1)()).not.toBe(seeded(2)())
  })

  it('stays inside 0..1 across a long run', () => {
    const roll = seeded(99)
    for (let i = 0; i < 5000; i++) {
      const v = roll()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('handles a seed of zero', () => {
    const roll = seeded(0)
    expect(roll()).toBeGreaterThanOrEqual(0)
    expect(roll()).toBeLessThan(1)
  })

  describe('scripted', () => {
    it('plays back the rolls in order', () => {
      const roll = scripted([0.1, 0.2, 0.3])
      expect([roll(), roll(), roll()]).toEqual([0.1, 0.2, 0.3])
    })

    it('repeats the last roll rather than running out', () => {
      const roll = scripted([0.5])
      expect([roll(), roll(), roll()]).toEqual([0.5, 0.5, 0.5])
    })

    it('gives zero when handed nothing', () => {
      expect(scripted([])()).toBe(0)
    })
  })

  describe('pickFrom', () => {
    it('picks by the current generator', () => {
      setRandom(() => 0)
      expect(pickFrom(['a', 'b', 'c'])).toBe('a')
      setRandom(() => 0.99)
      expect(pickFrom(['a', 'b', 'c'])).toBe('c')
    })

    it('is undefined for an empty pool', () => {
      expect(pickFrom([])).toBeUndefined()
    })

    it('stays in range even if a generator returns exactly 1', () => {
      setRandom(() => 1)
      expect(pickFrom(['a', 'b'])).toBe('a')
    })
  })
})

describe('clock', () => {
  it('is the wall clock until something swaps it', () => {
    expect(Math.abs(now() - Date.now())).toBeLessThan(1000)
  })

  it('uses whatever is set, and goes back on reset', () => {
    setClock(() => 1234)
    expect(now()).toBe(1234)
    resetClock()
    expect(now()).not.toBe(1234)
  })

  describe('manualClock', () => {
    it('starts where it is told and does not move on its own', () => {
      const clock = manualClock(500)
      expect(clock.now()).toBe(500)
      expect(clock.now()).toBe(500)
    })

    it('starts at zero by default', () => {
      expect(manualClock().now()).toBe(0)
    })

    it('advances and sets', () => {
      const clock = manualClock(0)
      clock.advance(100)
      expect(clock.now()).toBe(100)
      clock.advance(50)
      expect(clock.now()).toBe(150)
      clock.set(9)
      expect(clock.now()).toBe(9)
    })
  })
})
