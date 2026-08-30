import { describe, expect, it } from 'vitest'
import { VISITORS } from '../../src/data/visitors'
import { hash2, idSeed, isPresent, visitorsPresent, withinHours } from '../../src/game/visitors'
import type { SeasonId } from '../../src/data/seasons'

const SEASONS: SeasonId[] = ['spring', 'summer', 'autumn', 'winter']
/** Long enough that a visitor's arrival rate settles near its declared chance.
 *  A few hundred days leaves ordinary sampling noise wide enough to fail. */
const DAYS = 4000

describe('who is in the yard', () => {
  it('never turns up out of season', () => {
    for (const season of SEASONS) {
      for (let day = 0; day < DAYS; day++) {
        for (const id of visitorsPresent(day, season, [])) {
          const visitor = VISITORS.find((v) => v.id === id)!
          expect(visitor.seasons).toContain(season)
        }
      }
    }
  })

  it('is settled for the day rather than flickering', () => {
    for (let day = 0; day < DAYS; day++) {
      const first = visitorsPresent(day, 'summer', [])
      expect(visitorsPresent(day, 'summer', [])).toEqual(first)
    }
  })

  it('turns up about as often as its chance says', () => {
    for (const visitor of VISITORS) {
      // Counted only over the seasons it could come in, since the rest are not
      // luck at all.
      let seasons = 0
      let here = 0
      for (const season of visitor.seasons) {
        for (let day = 0; day < DAYS; day++) {
          seasons++
          if (isPresent(visitor.id, day, season, [])) here++
        }
      }
      expect(here / seasons).toBeCloseTo(visitor.chance, 1)
    }
  })

  it('brings a befriended stray whenever its season comes round', () => {
    const stray = VISITORS.find((v) => v.friend)!
    for (const season of stray.seasons) {
      for (let day = 0; day < DAYS; day++) {
        expect(isPresent(stray.id, day, season, [stray.id])).toBe(true)
      }
    }
  })

  it('does not let befriending one bring the others', () => {
    const stray = VISITORS.find((v) => v.friend)!
    for (let day = 0; day < DAYS; day++) {
      for (const visitor of VISITORS) {
        if (visitor.id === stray.id) continue
        expect(isPresent(visitor.id, day, 'summer', [stray.id])).toBe(
          isPresent(visitor.id, day, 'summer', []),
        )
      }
    }
  })

  it('rolls each visitor independently', () => {
    // Two visitors sharing a seed would arrive and leave together, which is the
    // sort of thing that reads as a bug in the yard rather than as luck.
    const seeds = new Set(VISITORS.map((v) => idSeed(v.id)))
    expect(seeds.size).toBe(VISITORS.length)
  })

  it('hashes into 0..1', () => {
    for (let i = 0; i < 500; i++) {
      const value = hash2(i, i * 7919)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('hour windows', () => {
  it('lets anything without a window be seen at any hour', () => {
    const anytime = VISITORS.find((v) => !v.hours)!
    for (let hour = 0; hour < 24; hour++) expect(withinHours(anytime.id, hour)).toBe(true)
  })

  it('wraps a window that runs through midnight', () => {
    // The fireflies are out from eight in the evening until four in the
    // morning, which is two stretches of the clock rather than one.
    expect(withinHours('fireflies', 21)).toBe(true)
    expect(withinHours('fireflies', 2)).toBe(true)
    expect(withinHours('fireflies', 12)).toBe(false)
    expect(withinHours('fireflies', 19)).toBe(false)
    expect(withinHours('fireflies', 4)).toBe(false)
  })
})
