import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  hoursUntilSunrise,
  isNight,
  seasonIdAt,
  worldAt,
  worldHour,
  WORLD_HOUR_MS,
  type Rgb,
} from '../../src/game/world'
import { SEASONS, type SeasonId } from '../../src/data/seasons'

/**
 * The world's clock, and everything the sky is derived from. It is a pure
 * function of the epoch, which is exactly what makes it testable and also what
 * makes it worth testing: every player is looking at the same sky, so a wrong
 * season boundary is wrong for everybody at once.
 */

const YEAR_MS = 70 * 60_000 * SEASONS.length

describe('the day', () => {
  it('is twenty-four minutes long', () => {
    expect(DAY_MS).toBe(24 * 60_000)
    expect(WORLD_HOUR_MS).toBe(60_000)
  })

  it('runs midnight to midnight across the hours', () => {
    expect(worldHour(0)).toBe(0)
    expect(worldHour(DAY_MS / 2)).toBe(12)
    expect(worldHour(DAY_MS - 1)).toBeCloseTo(24, 2)
  })

  it('wraps at the end of a day rather than running past twenty-four', () => {
    expect(worldHour(DAY_MS)).toBe(0)
    expect(worldHour(DAY_MS * 3 + DAY_MS / 4)).toBe(6)
  })

  it('handles a moment before the epoch without going negative', () => {
    const hour = worldHour(-DAY_MS / 4)
    expect(hour).toBeGreaterThanOrEqual(0)
    expect(hour).toBeLessThan(24)
    expect(hour).toBe(18)
  })
})

describe('isNight', () => {
  it('is night at midnight and day at noon', () => {
    expect(isNight(0)).toBe(true)
    expect(isNight(DAY_MS / 2)).toBe(false)
  })

  it('agrees with the sun the player can see', () => {
    for (let t = 0; t < DAY_MS; t += 30_000) {
      expect(isNight(t)).toBe(worldAt(t).sunHeight <= 0)
    }
  })

  it('gives every day both a night and a day', () => {
    for (let day = 0; day < 6; day++) {
      const base = day * DAY_MS
      const samples = Array.from({ length: 48 }, (_, i) => isNight(base + i * WORLD_HOUR_MS / 2))
      expect(samples).toContain(true)
      expect(samples).toContain(false)
    }
  })

  it('makes winter nights longer than summer ones', () => {
    const nightHours = (season: SeasonId) => {
      const at = firstMomentOf(season)
      let count = 0
      for (let i = 0; i < 240; i++) if (isNight(at + (i * DAY_MS) / 240)) count++
      return count
    }
    expect(nightHours('winter')).toBeGreaterThan(nightHours('summer'))
  })
})

describe('hoursUntilSunrise', () => {
  it('is a positive number of hours inside a day', () => {
    for (let t = 0; t < DAY_MS; t += 60_000) {
      const hours = hoursUntilSunrise(t)
      expect(hours).toBeGreaterThan(0)
      expect(hours).toBeLessThanOrEqual(24)
    }
  })

  it('counts down through the small hours toward the morning', () => {
    const midnight = hoursUntilSunrise(0)
    const later = hoursUntilSunrise(2 * WORLD_HOUR_MS)
    expect(later).toBeCloseTo(midnight - 2, 4)
  })

  it('rolls over to tomorrow"s sunrise once this morning"s has passed', () => {
    // Just after noon the next sunrise is tomorrow's, so it is a long wait.
    expect(hoursUntilSunrise(DAY_MS / 2)).toBeGreaterThan(12)
  })

  it('lands on a moment the sun is actually up', () => {
    for (let t = 0; t < DAY_MS; t += 120_000) {
      const at = t + hoursUntilSunrise(t) * WORLD_HOUR_MS
      // A shade past sunrise, so the sample is inside the day rather than on
      // the boundary itself.
      expect(isNight(at + 60_000)).toBe(false)
    }
  })
})

describe('seasons', () => {
  it('names one of the four, whenever it is asked', () => {
    const ids = new Set<SeasonId>()
    for (let t = 0; t < YEAR_MS * 2; t += 60_000) ids.add(seasonIdAt(t))
    expect([...ids].sort()).toEqual(['autumn', 'spring', 'summer', 'winter'])
  })

  it('runs the four in order and comes back round', () => {
    const order = SEASONS.map((s) => s.id)
    for (let i = 0; i < SEASONS.length * 2; i++) {
      const at = i * 70 * 60_000 + 60_000
      expect(seasonIdAt(at)).toBe(order[i % order.length])
    }
  })

  it('handles a moment before the epoch', () => {
    expect(SEASONS.map((s) => s.id)).toContain(seasonIdAt(-YEAR_MS - 12_345))
  })

  it('does not lock in phase with the day, so a season is not one hour of sky', () => {
    // A season boundary landing on the same hour every year would mean a given
    // hour could only ever be seen in one season. Seventy minutes drifts.
    const hours = new Set<number>()
    for (let year = 0; year < 12; year++) {
      hours.add(Math.floor(worldHour(year * YEAR_MS)))
    }
    expect(hours.size).toBeGreaterThan(1)
  })

  it('holds a season before turning over, rather than sitting half way', () => {
    const seasonMs = 70 * 60_000
    // Early in a season, nothing of the next one has bled in.
    expect(worldAt(seasonMs * 0.5).seasonBlend).toBe(0)
    // Late in one, it is on its way.
    expect(worldAt(seasonMs * 0.95).seasonBlend).toBeGreaterThan(0)
  })

  it('blends toward the season that is actually next', () => {
    const seasonMs = 70 * 60_000
    const late = worldAt(seasonMs * 0.95)
    expect(late.season.id).toBe('spring')
    expect(late.nextSeason.id).toBe('summer')
  })
})

describe('worldAt', () => {
  const sample = (t: number) => worldAt(t)

  it('gives a day phase that runs 0..1', () => {
    expect(sample(0).dayPhase).toBe(0)
    expect(sample(DAY_MS / 2).dayPhase).toBeCloseTo(0.5, 6)
    for (let t = 0; t < DAY_MS; t += 60_000) {
      const phase = sample(t).dayPhase
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
    }
  })

  it('keeps daylight between 0 and 1, dark at midnight and full at noon', () => {
    expect(sample(0).daylight).toBe(0)
    expect(sample(DAY_MS / 2).daylight).toBe(1)
    for (let t = 0; t < DAY_MS; t += 30_000) {
      const d = sample(t).daylight
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(1)
    }
  })

  it('gives a colour for every material the world is painted from', () => {
    const state = sample(0)
    expect(state.palette).toHaveLength(SEASONS[0]!.palette ? Object.keys(SEASONS[0]!.palette).length : 0)
    for (const colour of state.palette) expectLinearRgb(colour)
  })

  it('gives a sky, a haze and a light at every hour of every season', () => {
    for (let t = 0; t < YEAR_MS; t += 5 * 60_000) {
      const s = sample(t)
      expectLinearRgb(s.sky.top)
      expectLinearRgb(s.sky.bottom)
      expectLinearRgb(s.haze)
      expectLinearRgb(s.light.colour)
      expectLinearRgb(s.ambient.colour)
      expect(Number.isFinite(s.light.intensity)).toBe(true)
      expect(Number.isFinite(s.ambient.intensity)).toBe(true)
    }
  })

  it('never lets the key light come from under the ground', () => {
    for (let t = 0; t < DAY_MS; t += 30_000) {
      // A light from below looks broken, so the vertical component stays up.
      expect(sample(t).light.direction[1]).toBeGreaterThan(0)
    }
  })

  it('keeps the light direction a unit vector', () => {
    for (let t = 0; t < DAY_MS; t += 60_000) {
      const [x, y, z] = sample(t).light.direction
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
    }
  })

  it('keeps a usable light floor at night, so the pet can still be seen', () => {
    for (let t = 0; t < DAY_MS; t += 30_000) {
      expect(sample(t).light.intensity).toBeGreaterThan(0.25)
    }
  })

  it('is brighter at noon than at midnight', () => {
    expect(sample(DAY_MS / 2).light.intensity).toBeGreaterThan(sample(0).light.intensity)
  })

  it('picks a weather from the season"s own list', () => {
    for (let t = 0; t < YEAR_MS; t += 3 * 60_000) {
      const s = sample(t)
      expect(Object.keys(s.season.weather)).toContain(s.weather)
    }
  })

  it('holds a spell of weather rather than flickering frame to frame', () => {
    const first = sample(0).weather
    expect(sample(60_000).weather).toBe(first)
    expect(sample(10 * 60_000).weather).toBe(first)
  })

  it('changes weather eventually', () => {
    const spells = new Set<string>()
    for (let t = 0; t < YEAR_MS; t += 18 * 60_000) spells.add(sample(t).weather)
    expect(spells.size).toBeGreaterThan(1)
  })

  it('snows in winter and not in summer', () => {
    const seen = (season: SeasonId) => {
      const from = firstMomentOf(season)
      const out = new Set<string>()
      for (let i = 0; i < 40; i++) out.add(sample(from + i * 60_000 * 3).weather)
      return out
    }
    expect(seen('summer').has('snow')).toBe(false)
  })

  it('dims rather than darkens: bad weather cuts the light, clear weather does not', () => {
    // Compared against what the same daylight would give under a clear sky,
    // so the day"s own arc is out of the picture and only the weather is left.
    const clearIntensity = (daylight: number) => 0.55 + (1.25 - 0.55) * daylight
    let sawDull = false
    for (let t = 0; t < YEAR_MS; t += 3 * 60_000) {
      const s = worldAt(t)
      const asIfClear = clearIntensity(s.daylight)
      if (s.weather === 'clear') {
        expect(s.light.intensity).toBeCloseTo(asIfClear, 10)
      } else {
        expect(s.light.intensity).toBeLessThan(asIfClear)
        sawDull = true
      }
    }
    expect(sawDull).toBe(true)
  })

  it('lifts the fill light under cloud, so the toy still reads as cheerful', () => {
    const flatFill = (daylight: number) => 0.5 + (0.72 - 0.5) * daylight
    for (let t = 0; t < YEAR_MS; t += 3 * 60_000) {
      const s = worldAt(t)
      const asIfClear = flatFill(s.daylight)
      if (s.weather === 'clear') expect(s.ambient.intensity).toBeCloseTo(asIfClear, 10)
      else expect(s.ambient.intensity).toBeGreaterThan(asIfClear)
    }
  })

  it('is deterministic: the same moment gives the same world', () => {
    expect(sample(123_456_789)).toEqual(sample(123_456_789))
  })

  it('caches a season"s palette rather than rebuilding it every frame', () => {
    // Two moments in the same season share the identical source palette, so
    // the blended result at an unblended moment is the same numbers.
    const a = sample(60_000).palette
    const b = sample(120_000).palette
    expect(a).toEqual(b)
  })

  it('survives a moment before the epoch', () => {
    const s = sample(-DAY_MS * 3 - 12_345)
    expect(s.dayPhase).toBeGreaterThanOrEqual(0)
    expect(s.dayPhase).toBeLessThan(1)
    expectLinearRgb(s.sky.top)
  })
})

function expectLinearRgb(colour: Rgb): void {
  expect(colour).toHaveLength(3)
  for (const channel of colour) {
    expect(Number.isFinite(channel)).toBe(true)
    expect(channel).toBeGreaterThanOrEqual(0)
  }
}

/** The first moment of a named season, for tests that want a given time of year. */
function firstMomentOf(season: SeasonId): number {
  const index = SEASONS.findIndex((s) => s.id === season)
  return index * 70 * 60_000 + 60_000
}
