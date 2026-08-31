import { describe, expect, it } from 'vitest'
import { CURIOS } from '../../src/data/curios'
import { GROUNDS, type GroundRole } from '../../src/data/grounds'
import {
  KIT,
  KIT_COUNT,
  kitById,
  kitPool,
  kitPowers,
  isKitId,
  NO_KIT,
  pickKit,
  type Day,
  type KitDay,
  type KitId,
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

/** Every day the world can put in front of a trip, and every trip it can be. */
function everyDay(): KitDay[] {
  const days: KitDay[] = []
  for (const season of SEASON_IDS) {
    for (const weather of WEATHERS) {
      for (const night of [false, true]) {
        for (const role of ROLES) {
          for (const depth of [1, 2, 3]) days.push({ season, weather, night, role, depth })
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

  it('only asks for a ground role that somewhere actually has', () => {
    const roles = new Set(GROUNDS.map((g) => g.role))
    for (const item of KIT) {
      if (item.role) expect(roles.has(item.role), item.id).toBe(true)
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

describe('what a day turns up', () => {
  const days = everyDay()

  it('can turn up every piece of kit on some day the world produces', () => {
    for (const item of KIT) {
      const reachable = days.some((day) => kitPool([], day).includes(item))
      expect(reachable, item.id).toBe(true)
    }
  })

  it('cannot turn up any piece of kit on every day, or the day would not matter', () => {
    for (const item of KIT) {
      const always = days.every((day) => kitPool([], day).includes(item))
      expect(always, item.id).toBe(false)
    }
  })

  it('never offers something the family already owns', () => {
    const owned = KIT.map((k) => k.id)
    for (const day of days) expect(kitPool(owned, day)).toEqual([])
  })

  it('holds the wet-weather kit back for wet weather', () => {
    const dry: KitDay = { season: 'spring', weather: 'clear', night: false, role: 'near', depth: 1 }
    const wet: KitDay = { ...dry, weather: 'rain' }
    expect(kitPool([], dry).map((k) => k.id)).not.toContain('umbrella')
    expect(kitPool([], wet).map((k) => k.id)).toContain('umbrella')
  })

  it('keeps the torch for a trip that set out after dark', () => {
    const day: KitDay = { season: 'spring', weather: 'clear', night: false, role: 'near', depth: 1 }
    expect(kitPool([], day).map((k) => k.id)).not.toContain('torch')
    expect(kitPool([], { ...day, night: true }).map((k) => k.id)).toContain('torch')
  })

  it('keeps the far things out past the first leg', () => {
    const near: KitDay = { season: 'spring', weather: 'clear', night: false, role: 'far', depth: 1 }
    expect(kitPool([], near).map((k) => k.id)).not.toContain('boots')
    expect(kitPool([], { ...near, depth: 2 }).map((k) => k.id)).toContain('boots')
  })

  it('keeps the waders to the water', () => {
    const day: KitDay = { season: 'summer', weather: 'clear', night: false, role: 'far', depth: 1 }
    expect(kitPool([], day).map((k) => k.id)).not.toContain('waders')
    expect(kitPool([], { ...day, role: 'wet' }).map((k) => k.id)).toContain('waders')
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

  it('adds up, so a family with the lot gets all of it at once', () => {
    const owned: KitId[] = ['umbrella', 'hat', 'waders', 'boots', 'snowboard', 'torch']
    expect(kitPowers(owned, { season: 'winter', weather: 'snow', night: true })).toEqual({
      forgivesWeather: false,
      forgivesSeason: true,
      wades: true,
      spares: ['mud', 'footsore'],
      warm: true,
      mishapScale: 0.55,
      pushScale: 0.5,
      depthBonus: 1,
      lightsTheDark: true,
    })
  })

  it('says nothing about the two that have not been taught to speak yet', () => {
    // The basket and the pine cone are found and owned but do not read yet.
    // This is the line that will have to change when they do.
    const quiet: KitId[] = ['basket', 'pinecone']
    for (const season of SEASON_IDS) {
      for (const weather of WEATHERS) {
        for (const night of [false, true]) {
          expect(kitPowers(quiet, { season, weather, night })).toEqual(NO_KIT)
        }
      }
    }
  })
})

describe('the pick', () => {
  const dark: KitDay = { season: 'winter', weather: 'snow', night: true, role: 'far', depth: 3 }

  it('only ever picks something the day suits, whatever the roll', () => {
    for (const day of everyDay()) {
      const pool = kitPool([], day)
      if (pool.length === 0) continue
      for (let roll = 0; roll < 1; roll += 0.05) {
        expect(pool, `${day.weather} ${roll}`).toContain(pickKit(pool, roll))
      }
    }
  })

  it('reaches every item in the pool as the roll walks across it', () => {
    const pool = kitPool([], dark)
    expect(pool.length).toBeGreaterThan(1)
    const reached = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.001) reached.add(pickKit(pool, roll).id)
    expect(reached.size).toBe(pool.length)
  })

  it('stays inside the pool at the very edge of the roll', () => {
    // A roll of exactly 1, or one nudged past it by floating point, must not
    // walk off the end of the pool and come back undefined.
    const pool = kitPool([], dark)
    expect(pickKit(pool, 1)).toBe(pool.at(-1))
    expect(pickKit(pool, 1.0000001)).toBe(pool.at(-1))
  })

  it('never offers the same thing twice, as the family collects it', () => {
    const owned: string[] = []
    for (let i = 0; i < 40; i++) {
      const pool = kitPool(owned as never, dark)
      if (pool.length === 0) break
      const item = pickKit(pool, (i % 7) / 7)
      expect(owned).not.toContain(item.id)
      owned.push(item.id)
    }
    expect(new Set(owned).size).toBe(owned.length)
    expect(owned.length).toBeGreaterThan(1)
  })
})
