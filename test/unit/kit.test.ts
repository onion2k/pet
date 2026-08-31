import { describe, expect, it } from 'vitest'
import { CURIOS } from '../../src/data/curios'
import { GROUNDS, type GroundRole } from '../../src/data/grounds'
import {
  creditTrip,
  KIT,
  KIT_COUNT,
  kitById,
  kitPowers,
  isKitId,
  NO_KIT,
  progressOf,
  type Day,
  type KitId,
  type Trip,
} from '../../src/data/kit'
import { SEASONS, type WeatherId } from '../../src/data/seasons'
import { SLOTS_PER_ROW } from '../../src/ui/draw'

/**
 * The kit. Half of it is a data file and the rules that read it are elsewhere,
 * so what is worth pinning down here is the part that decides whether a player
 * ever sees any of it: every piece has to be reachable on some day the world
 * actually produces, and none of it may be reachable on all of them.
 */

const SEASON_IDS = SEASONS.map((s) => s.id)
const WEATHERS: WeatherId[] = ['clear', 'rain', 'snow', 'mist']
const ROLES: GroundRole[] = ['near', 'wet', 'sheltered', 'far']

/** Every trip the world can produce, which is what the kit is earned by. */
function everyDay(): Trip[] {
  const days: Trip[] = []
  for (const season of SEASON_IDS) {
    for (const weather of WEATHERS) {
      for (const night of [false, true]) {
        for (const role of ROLES) {
          for (const legs of [1, 2, 3]) {
            for (const supplies of [false, true]) {
              days.push({ season, weather, night, role, legs, supplies })
            }
          }
        }
      }
    }
  }
  return days
}

describe('the kit list', () => {
  it('counts itself', () => {
    expect(KIT_COUNT).toBe(KIT.length)
  })

  it('gives every item a unique id', () => {
    expect(new Set(KIT.map((k) => k.id)).size).toBe(KIT.length)
  })

  it('does not reuse a curio id, which shares the board with it', () => {
    const curios = new Set(CURIOS.map((c) => c.id))
    for (const item of KIT) expect(curios.has(item.id), item.id).toBe(false)
  })

  it('gives every item a name, a colour and a line the trip can say', () => {
    for (const item of KIT) {
      expect(item.name.length, item.id).toBeGreaterThan(0)
      expect(item.note.length, item.id).toBeGreaterThan(0)
      // Article and all: "comes home with a snowboard" is assembled around it.
      expect(item.what, item.id).toMatch(/^(a|an) /)
      expect(item.colour, item.id).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('gives every item an 8x8 glyph', () => {
    for (const item of KIT) {
      const rows = item.glyph.split('/')
      expect(rows, item.id).toHaveLength(8)
      for (const row of rows) {
        expect(row, item.id).toHaveLength(8)
        expect(row, item.id).toMatch(/^[#.]{8}$/)
      }
    }
  })

  it('draws something in every glyph, so no slot is a blank square', () => {
    for (const item of KIT) expect(item.glyph.includes('#'), item.id).toBe(true)
  })

  it('fits the board, which is two rows of eight', () => {
    expect(KIT.length).toBeLessThanOrEqual(SLOTS_PER_ROW)
    expect(CURIOS.length).toBeLessThanOrEqual(SLOTS_PER_ROW)
  })

  it('can be earned somewhere the family could actually go', () => {
    // A rule that wanted a kind of ground no biome has would be a slot on the
    // board that nothing could ever fill.
    const roles = new Set(GROUNDS.map((g) => g.role))
    for (const role of ROLES) {
      if (!roles.has(role)) continue
      expect(everyDay().some((trip) => trip.role === role)).toBe(true)
    }
  })

  it('knows its own ids and refuses everything else', () => {
    for (const item of KIT) expect(isKitId(item.id)).toBe(true)
    expect(isKitId('pebble')).toBe(false)
    expect(isKitId(undefined)).toBe(false)
    expect(kitById('torch')?.name).toBe('Torch')
    expect(kitById('jetpack')).toBeUndefined()
  })
})

describe('what earns it', () => {
  const trips = everyDay()

  it('gives every piece something to be earned by, and something to say about it', () => {
    for (const item of KIT) {
      expect(item.needs, item.id).toBeGreaterThan(0)
      expect(item.hint.length, item.id).toBeGreaterThan(0)
      // A noun phrase, because the board prints the tally after it.
      expect(item.hint, item.id).toBe(item.hint.toUpperCase())
    }
  })

  it('can be earned by some trip the world actually produces', () => {
    for (const item of KIT) {
      expect(trips.some((trip) => item.counts(trip)), item.id).toBe(true)
    }
  })

  it('asks for the job the thing then helps with', () => {
    const wet: Trip = {
      season: 'spring',
      weather: 'rain',
      night: false,
      role: 'near',
      legs: 1,
      supplies: false,
    }
    const dry: Trip = { ...wet, weather: 'clear' }
    expect(kitById('umbrella')!.counts(wet)).toBe(true)
    expect(kitById('umbrella')!.counts(dry)).toBe(false)
    expect(kitById('torch')!.counts({ ...dry, night: true })).toBe(true)
    expect(kitById('torch')!.counts(dry)).toBe(false)
    expect(kitById('hat')!.counts({ ...dry, season: 'winter' })).toBe(true)
    expect(kitById('hat')!.counts(dry)).toBe(false)
    expect(kitById('snowboard')!.counts({ ...dry, season: 'winter', weather: 'snow' })).toBe(true)
    expect(kitById('waders')!.counts({ ...dry, role: 'wet' })).toBe(true)
    expect(kitById('waders')!.counts(dry)).toBe(false)
    expect(kitById('boots')!.counts({ ...dry, legs: 2 })).toBe(true)
    expect(kitById('boots')!.counts(dry)).toBe(false)
    expect(kitById('basket')!.counts({ ...dry, supplies: true })).toBe(true)
    expect(kitById('basket')!.counts(dry)).toBe(false)
  })

  it('counts every trip toward the one thing any trip is', () => {
    // The cone is the long haul: it is not earned by a kind of trip but by
    // having been out in the weather enough to know it.
    const cone = kitById('pinecone')!
    for (const trip of trips) expect(cone.counts(trip)).toBe(true)
    expect(cone.needs).toBeGreaterThan(10)
  })
})

describe('crediting a trip', () => {
  const wet: Trip = {
    season: 'spring',
    weather: 'rain',
    night: false,
    role: 'near',
    legs: 1,
    supplies: false,
  }
  const dry: Trip = { ...wet, weather: 'clear' }

  it('counts toward everything the trip was, and nothing it was not', () => {
    const { progress } = creditTrip([], {}, wet)
    expect(progress.umbrella).toBe(1)
    expect(progress.pinecone).toBe(1)
    expect(progress.torch).toBeUndefined()
    expect(progress.snowboard).toBeUndefined()
  })

  it('leaves the tally it was given alone', () => {
    // The save hands its own object in, and a rule that edited it in place
    // would have changed the family before anything decided to keep it.
    const before = { umbrella: 1 }
    creditTrip([], before, wet)
    expect(before).toEqual({ umbrella: 1 })
  })

  it('earns nothing until the last trip of the right kind', () => {
    const umbrella = kitById('umbrella')!
    let progress = {}
    for (let trip = 1; trip < umbrella.needs; trip++) {
      const step = creditTrip([], progress, wet)
      expect(step.earned, `after ${trip}`).toEqual([])
      progress = step.progress
    }
    expect(creditTrip([], progress, wet).earned).toContain(umbrella)
  })

  it('can finish more than one thing at once', () => {
    // A pushed trip through snow after dark is several kinds of trip.
    const everything: Trip = {
      season: 'winter',
      weather: 'snow',
      night: true,
      role: 'wet',
      legs: 3,
      supplies: true,
    }
    let progress = {}
    for (let trip = 0; trip < 4; trip++) progress = creditTrip([], progress, everything).progress
    const earned = creditTrip([], progress, everything).earned.map((k) => k.id)
    expect(earned.length).toBeGreaterThan(1)
  })

  it('stops counting a thing the family already has', () => {
    const owned: KitId[] = ['umbrella']
    const { earned, progress } = creditTrip(owned, { umbrella: 99 }, wet)
    expect(earned).toEqual([])
    expect(progress.umbrella).toBe(99)
  })

  it('earns everything in the end, given enough of the right trips', () => {
    let owned: KitId[] = []
    let progress = {}
    const day = (i: number): Trip => ({
      season: i % 2 ? 'winter' : 'spring',
      weather: i % 2 ? 'snow' : 'rain',
      night: i % 3 === 0,
      role: i % 4 === 0 ? 'wet' : 'near',
      legs: (i % 3) + 1,
      supplies: i % 2 === 0,
    })
    for (let i = 0; i < 200 && owned.length < KIT.length; i++) {
      const step = creditTrip(owned, progress, day(i))
      progress = step.progress
      owned = [...owned, ...step.earned.map((k) => k.id)]
    }
    expect(owned.sort()).toEqual(KIT.map((k) => k.id).sort())
  })

  it('reports how near a thing is, and never past the post', () => {
    const umbrella = kitById('umbrella')!
    expect(progressOf({}, umbrella)).toBe(0)
    expect(progressOf({ umbrella: 1 }, umbrella)).toBe(1)
    expect(progressOf({ umbrella: 99 }, umbrella)).toBe(umbrella.needs)
  })

  it('says nothing counted on a trip that was none of the kinds', () => {
    const cone = kitById('pinecone')!
    const { progress } = creditTrip(['pinecone'], {}, dry)
    // Only the cone counts every trip, and it is owned, so nothing moved but
    // the things this trip genuinely was.
    expect(progress.pinecone).toBeUndefined()
    expect(cone.counts(dry)).toBe(true)
  })
})

describe('what the kit is worth today', () => {
  const day = (season: (typeof SEASON_IDS)[number], weather: WeatherId): Day => ({
    season,
    weather,
    night: false,
  })

  it('is worth nothing at all to a family with none', () => {
    for (const season of SEASON_IDS) {
      for (const weather of WEATHERS) {
        expect(kitPowers([], day(season, weather))).toEqual(NO_KIT)
      }
    }
  })

  it('opens the umbrella only when it is actually wet', () => {
    expect(kitPowers(['umbrella'], day('spring', 'rain')).forgivesWeather).toBe(true)
    expect(kitPowers(['umbrella'], day('spring', 'mist')).forgivesWeather).toBe(true)
    expect(kitPowers(['umbrella'], day('spring', 'clear')).forgivesWeather).toBe(false)
    expect(kitPowers(['umbrella'], day('winter', 'snow')).forgivesWeather).toBe(false)
  })

  it('keeps the mud off, wet or dry: an umbrella is carried either way', () => {
    for (const weather of WEATHERS) {
      expect(kitPowers(['umbrella'], day('spring', weather)).spares).toEqual(['mud'])
    }
    expect(kitPowers(['hat', 'waders'], day('spring', 'rain')).spares).toEqual([])
  })

  it('puts the hat on for winter and nothing else', () => {
    for (const season of SEASON_IDS) {
      const powers = kitPowers(['hat'], day(season, 'clear'))
      expect(powers.forgivesSeason, season).toBe(season === 'winter')
      expect(powers.warm, season).toBe(season === 'winter')
    }
  })

  it('leaves the waders on all year, because a wet place is always wet', () => {
    for (const season of SEASON_IDS) {
      for (const weather of WEATHERS) {
        expect(kitPowers(['waders'], day(season, weather)).wades).toBe(true)
      }
    }
  })

  it('cuts the odds of a trip going wrong, for a pet in boots', () => {
    // The one thing here that asks nothing of the day, and so the one thing
    // that has to be small: it only pays out on a trip that was pushed.
    for (const season of SEASON_IDS) {
      for (const weather of WEATHERS) {
        const powers = kitPowers(['boots'], day(season, weather))
        expect(powers.mishapScale).toBeLessThan(1)
        expect(powers.mishapScale).toBeGreaterThan(0)
        expect(powers.spares).toEqual(['footsore'])
      }
    }
    expect(kitPowers([], day('spring', 'clear')).mishapScale).toBe(1)
  })

  it('only rides the board on snow', () => {
    for (const weather of WEATHERS) {
      const powers = kitPowers(['snowboard'], day('winter', weather))
      expect(powers.pushScale, weather).toBe(weather === 'snow' ? 0.5 : 1)
    }
  })

  it('only lights the torch after dark', () => {
    const lit = kitPowers(['torch'], { season: 'spring', weather: 'clear', night: true })
    expect(lit.lightsTheDark).toBe(true)
    expect(lit.depthBonus).toBe(1)
    const day = kitPowers(['torch'], { season: 'spring', weather: 'clear', night: false })
    expect(day.lightsTheDark).toBe(false)
    expect(day.depthBonus).toBe(0)
  })

  it('carries more home in a basket, whatever the day', () => {
    for (const season of SEASON_IDS) {
      for (const weather of WEATHERS) {
        const powers = kitPowers(['basket'], day(season, weather))
        expect(powers.supplyBonus).toBeGreaterThan(0)
        expect(powers.larderBonus).toBeGreaterThan(0)
      }
    }
  })

  it('reads the sky with a cone, and changes not one other thing', () => {
    const powers = kitPowers(['pinecone'], day('spring', 'clear'))
    expect(powers).toEqual({ ...NO_KIT, forecasts: true })
  })

  it('adds up, so a family with the lot gets all of it at once', () => {
    expect(kitPowers(KIT.map((k) => k.id), { season: 'winter', weather: 'snow', night: true })).toEqual({
      forgivesWeather: false,
      forgivesSeason: true,
      wades: true,
      spares: ['mud', 'footsore'],
      warm: true,
      mishapScale: 0.55,
      pushScale: 0.5,
      depthBonus: 1,
      lightsTheDark: true,
      supplyBonus: 0.2,
      larderBonus: 3,
      forecasts: true,
    })
  })

  it('has taught all eight of them to speak', () => {
    // Every item has to do something on some day, or it is a slot on the board
    // that rewards the player with nothing at all.
    for (const item of KIT) {
      const speaks = everyDay().some(
        (day) => JSON.stringify(kitPowers([item.id], day)) !== JSON.stringify(NO_KIT),
      )
      expect(speaks, item.id).toBe(true)
    }
  })
})
