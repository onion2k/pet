import { describe, expect, it } from 'vitest'
import {
  completedSets,
  COMMON_CURIOS,
  curioById,
  CURIOS,
  CURIO_COUNT,
  CURIO_SETS,
  findCurio,
  TRADE_COST,
  tradeTarget,
  type CurioSet,
} from '../../src/data/curios'
import { SEASONS, type WeatherId } from '../../src/data/seasons'

/**
 * The collection board. It is the game's long game, so the rules that decide
 * what can be found when are what stop it being either trivial or impossible --
 * and the trade is the escape hatch that stops a season you keep missing from
 * becoming a wall.
 */

const SEASON_IDS = SEASONS.map((s) => s.id)
const WEATHERS: WeatherId[] = ['clear', 'rain', 'snow', 'mist']

describe('the board', () => {
  it('counts every curio', () => {
    expect(CURIO_COUNT).toBe(CURIOS.length)
  })

  it('gives every curio a unique id', () => {
    expect(new Set(CURIOS.map((c) => c.id)).size).toBe(CURIOS.length)
  })

  it('puts every curio in one of the three sets', () => {
    const sets = new Set(CURIO_SETS.map((s) => s.id))
    for (const curio of CURIOS) expect(sets.has(curio.set)).toBe(true)
  })

  it('leaves no set empty, so every set can be completed', () => {
    for (const set of CURIO_SETS) {
      expect(CURIOS.some((c) => c.set === set.id), set.id).toBe(true)
    }
  })

  it('gives every curio a positive weight, a name and a colour', () => {
    for (const curio of CURIOS) {
      expect(curio.weight).toBeGreaterThan(0)
      expect(curio.name.length).toBeGreaterThan(0)
      expect(curio.colour).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('gives every curio an 8x8 glyph', () => {
    for (const curio of CURIOS) {
      const rows = curio.glyph.split('/')
      expect(rows, curio.id).toHaveLength(8)
      for (const row of rows) expect(row, curio.id).toHaveLength(8)
    }
  })

  it('only names seasons and weather that exist', () => {
    for (const curio of CURIOS) {
      for (const season of curio.seasons ?? []) expect(SEASON_IDS).toContain(season)
      for (const weather of curio.weather ?? []) expect(WEATHERS).toContain(weather)
    }
  })

  it('leaves every curio findable somewhere in the year', () => {
    for (const curio of CURIOS) {
      const found = SEASON_IDS.some((season) =>
        WEATHERS.some((weather) => {
          for (let roll = 0; roll < 1; roll += 0.005) {
            if (findCurio(season, weather, roll, [], 3)?.id === curio.id) return true
          }
          return false
        }),
      )
      expect(found, `${curio.id} can never be found`).toBe(true)
    }
  })
})

describe('COMMON_CURIOS', () => {
  it('holds only the ones with no season, weather or depth to them', () => {
    for (const curio of COMMON_CURIOS) {
      expect(curio.seasons).toBeUndefined()
      expect(curio.weather).toBeUndefined()
      expect(curio.depth).toBeUndefined()
    }
  })

  it('is not empty, or an absence could never turn anything up', () => {
    expect(COMMON_CURIOS.length).toBeGreaterThan(0)
  })
})

describe('curioById', () => {
  it('finds a curio', () => {
    expect(curioById('pebble')?.name).toBe('Smooth pebble')
  })

  it('is undefined for one that does not exist, since a stale save may name one', () => {
    expect(curioById('moon rock')).toBeUndefined()
  })
})

describe('findCurio', () => {
  it('finds something on any ordinary day', () => {
    for (const season of SEASON_IDS) {
      for (const weather of WEATHERS) {
        expect(findCurio(season, weather, 0.5)).not.toBeNull()
      }
    }
  })

  it('only offers what the season allows', () => {
    for (let roll = 0; roll < 1; roll += 0.01) {
      const curio = findCurio('summer', 'clear', roll, [], 3)!
      if (curio.seasons) expect(curio.seasons).toContain('summer')
    }
  })

  it('only offers what the weather allows', () => {
    for (let roll = 0; roll < 1; roll += 0.01) {
      const curio = findCurio('spring', 'clear', roll, [], 3)!
      if (curio.weather) expect(curio.weather).toContain('clear')
    }
  })

  it('keeps the deepest finds out past a short trip', () => {
    const shallow = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.01) shallow.add(findCurio('spring', 'clear', roll)!.id)
    expect(shallow.has('geode')).toBe(false)

    const deep = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.01) {
      deep.add(findCurio('spring', 'clear', roll, [], 3)!.id)
    }
    expect(deep.has('geode')).toBe(true)
  })

  it('weights a ground"s own curios up without narrowing the pool', () => {
    const share = (favours: string[]) => {
      let hits = 0
      let total = 0
      for (let roll = 0; roll < 1; roll += 0.002) {
        total++
        if (findCurio('spring', 'rain', roll, favours, 3)!.id === 'pebble') hits++
      }
      return hits / total
    }
    expect(share(['pebble'])).toBeGreaterThan(share([]))
    // A creek can still turn up a stray feather.
    const ids = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.01) {
      ids.add(findCurio('spring', 'rain', roll, ['dewdrop'], 3)!.id)
    }
    expect(ids.size).toBeGreaterThan(1)
  })

  it('falls back to the last of the pool rather than returning null at the end', () => {
    expect(findCurio('spring', 'clear', 1)).not.toBeNull()
    expect(findCurio('spring', 'clear', 1.5)).not.toBeNull()
  })

  it('is null when nothing at all is available', () => {
    // Depth zero puts every curio out of reach.
    expect(findCurio('spring', 'clear', 0.5, [], 0)).toBeNull()
  })

  it('never offers a curio of the wrong season, however deep the trip', () => {
    for (const season of SEASON_IDS) {
      for (let roll = 0; roll < 1; roll += 0.01) {
        const curio = findCurio(season, 'clear', roll, [], 9)!
        if (curio.seasons) expect(curio.seasons, `${season}/${curio.id}`).toContain(season)
      }
    }
  })
})

describe('completedSets', () => {
  const oneOfEach = (predicate: (set: CurioSet) => boolean): Record<string, number> =>
    Object.fromEntries(CURIOS.filter((c) => predicate(c.set)).map((c) => [c.id, 1]))

  it('is empty for an empty board', () => {
    expect(completedSets({})).toEqual([])
  })

  it('names a set once every one of its curios is found', () => {
    expect(completedSets(oneOfEach((s) => s === 'stones'))).toEqual(['stones'])
  })

  it('does not name a set that is one short', () => {
    const counts = oneOfEach((s) => s === 'blooms')
    delete counts[CURIOS.find((c) => c.set === 'blooms')!.id]
    expect(completedSets(counts)).toEqual([])
  })

  it('does not count a curio held at zero', () => {
    const counts = oneOfEach((s) => s === 'stones')
    counts[CURIOS.find((c) => c.set === 'stones')!.id] = 0
    expect(completedSets(counts)).toEqual([])
  })

  it('names every set for a complete board', () => {
    const all = Object.fromEntries(CURIOS.map((c) => [c.id, 1]))
    expect(completedSets(all).sort()).toEqual(['blooms', 'stones', 'weather'])
  })
})

describe('tradeTarget', () => {
  it('is the rarest thing still missing', () => {
    // Everything but the geode, which is the rarest of them all.
    const counts = Object.fromEntries(CURIOS.filter((c) => c.id !== 'geode').map((c) => [c.id, 1]))
    expect(tradeTarget(counts)?.id).toBe('geode')
  })

  it('prefers the rarer of two missing things', () => {
    const counts = Object.fromEntries(
      CURIOS.filter((c) => c.id !== 'geode' && c.id !== 'pebble').map((c) => [c.id, 1]),
    )
    // pebble weighs 5, geode weighs 3: the geode is rarer.
    expect(tradeTarget(counts)?.id).toBe('geode')
  })

  it('is something on an empty board', () => {
    expect(tradeTarget({})).not.toBeNull()
  })

  it('is null once the board is complete', () => {
    expect(tradeTarget(Object.fromEntries(CURIOS.map((c) => [c.id, 1])))).toBeNull()
  })

  it('treats a curio held at zero as still missing', () => {
    const counts = Object.fromEntries(CURIOS.map((c) => [c.id, 1]))
    counts.snowdrop = 0
    expect(tradeTarget(counts)?.id).toBe('snowdrop')
  })
})

describe('TRADE_COST', () => {
  it('is three spares for one, which is a real cost and still reachable', () => {
    expect(TRADE_COST).toBe(3)
  })
})
