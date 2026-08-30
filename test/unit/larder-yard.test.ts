import { describe, expect, it } from 'vitest'
import {
  findSupply,
  gatheredFoods,
  KINDLING,
  LARDER_CAP,
  SUPPLIES,
} from '../../src/game/larder'
import { MEADOW, WOODLAND } from '../../src/data/biome'
import {
  countOf,
  emptyYard,
  gardenAt,
  growthOf,
  plantableKind,
  YARD_CAPACITY,
  type Planting,
} from '../../src/game/yard'
import { DAY_MS } from '../../src/game/world'
import { FOODS } from '../../src/data/foods'
import { GROUNDS, type GroundRole } from '../../src/data/grounds'
import { GROWTH_STAGES, PLANTS, type PlantId } from '../../src/data/plants'

/**
 * The two things a forage can add to: the supply line, and the garden. Both
 * outlive the pet that filled them, so both have caps -- and a cap that is off
 * by one is the difference between a pet that keeps bringing things home and
 * one that silently stops.
 */

describe('SUPPLIES', () => {
  it('includes fuel, which is the one supply that is not a meal', () => {
    expect(SUPPLIES.some((s) => s.id === KINDLING)).toBe(true)
  })

  it('gives every supply a positive weight and something to say about it', () => {
    for (const supply of SUPPLIES) {
      expect(supply.weight).toBeGreaterThan(0)
      expect(supply.what.length).toBeGreaterThan(0)
    }
  })

  it('has a matching food for every supply that is not fuel', () => {
    for (const supply of SUPPLIES) {
      if (supply.id === KINDLING) continue
      const food = FOODS.find((f) => f.id === supply.id)
      expect(food, `no food for supply ${supply.id}`).toBeDefined()
      expect(food?.gathered).toBe(true)
    }
  })

  it('only names roles that exist', () => {
    const roles = new Set(GROUNDS.map((g) => g.role))
    for (const supply of SUPPLIES) {
      for (const role of supply.roles ?? []) expect(roles.has(role)).toBe(true)
    }
  })
})

describe('findSupply', () => {
  const roles = [...new Set(GROUNDS.map((g) => g.role))]

  it('finds something on every kind of ground at every depth', () => {
    for (const role of roles) {
      for (let depth = 1; depth <= 3; depth++) {
        for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
          expect(findSupply(role, depth, roll)).not.toBeNull()
        }
      }
    }
  })

  it('only returns supplies that kind of ground actually turns up', () => {
    for (const role of roles) {
      for (const roll of [0, 0.3, 0.6, 0.9, 0.999]) {
        const supply = findSupply(role, 3, roll)!
        if (supply.roles) expect(supply.roles).toContain(role)
      }
    }
  })

  it('keeps the supply line whole wherever the family lives', () => {
    // Roles rather than named grounds, so that moving house cannot strand a
    // pet somewhere its larder has nothing to put in it.
    for (const biome of [MEADOW, WOODLAND]) {
      for (const ground of biome.grounds) {
        expect(findSupply(ground.role, 1, 0.5), `${biome.id}/${ground.id}`).not.toBeNull()
      }
    }
  })

  it('keeps the deepest supplies out of reach of a short trip', () => {
    const shallow = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.01) {
      shallow.add(findSupply('far', 1, roll)!.id)
    }
    expect(shallow.has('honeycomb')).toBe(false)

    const deep = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.01) deep.add(findSupply('far', 2, roll)!.id)
    expect(deep.has('honeycomb')).toBe(true)
  })

  it('picks by weight, so the first supply owns the lowest rolls', () => {
    // On a near ground the pool is kindling (5) then berries (4); total 9.
    expect(findSupply('near', 1, 0)!.id).toBe(KINDLING)
    expect(findSupply('near', 1, 4 / 9)!.id).toBe(KINDLING)
    expect(findSupply('near', 1, 0.9)!.id).toBe('berries')
  })

  it('falls back to the last of the pool if a roll lands past the end', () => {
    // Floating-point drift on the running total must not return null.
    expect(findSupply('near', 1, 1)).not.toBeNull()
    expect(findSupply('near', 1, 1.5)).not.toBeNull()
  })

  it('is null when nothing in the pool is available', () => {
    expect(findSupply('wet', 0, 0.5)).toBeNull()
  })

  it('is null for a kind of ground nothing is keyed to', () => {
    expect(findSupply('nowhere' as GroundRole, 0, 0.5)).toBeNull()
  })
})

describe('gatheredFoods', () => {
  it('is empty for a bare larder', () => {
    expect(gatheredFoods({})).toEqual([])
  })

  it('lists only what the pet has actually carried home', () => {
    const menu = gatheredFoods({ berries: 2 })
    expect(menu.map((f) => f.id)).toEqual(['berries'])
  })

  it('drops a food once the last of it is eaten', () => {
    expect(gatheredFoods({ berries: 0 })).toEqual([])
  })

  it('never lists a food the device can simply conjure', () => {
    // A bought food with a count against it is a save that has gone odd; it
    // still must not turn the feed menu into two Berries.
    expect(gatheredFoods({ berry: 5 })).toEqual([])
  })

  it('lists several at once, in the order the foods are defined', () => {
    const ids = gatheredFoods({ honeycomb: 1, berries: 1, roots: 1 }).map((f) => f.id)
    expect(ids).toEqual(['berries', 'roots', 'honeycomb'])
  })
})

describe('LARDER_CAP', () => {
  it('is a single digit, so the count always fits the screen', () => {
    expect(LARDER_CAP).toBeGreaterThan(0)
    expect(LARDER_CAP).toBeLessThan(10)
  })
})

describe('emptyYard', () => {
  it('is empty, and a fresh one each time', () => {
    const a = emptyYard()
    const b = emptyYard()
    expect(a).toEqual({ gardens: {}, strays: [] })
    gardenAt(a, 'meadow').push({ kind: 'sapling', x: 0, z: 0, plantedAt: 0 })
    expect(gardenAt(b, 'meadow')).toEqual([])
  })
})

describe('gardenAt', () => {
  it('keeps each place"s plantings to itself, so moving leaves them behind', () => {
    const yard = emptyYard()
    gardenAt(yard, 'meadow').push({ kind: 'sapling', x: 0, z: 0, plantedAt: 0 })
    expect(gardenAt(yard, 'woodland')).toEqual([])
    expect(gardenAt(yard, 'meadow')).toHaveLength(1)
  })

  it('finds the same trees still standing on the way back', () => {
    const yard = emptyYard()
    const tree: Planting = { kind: 'sapling', x: 0, z: 0, plantedAt: 0 }
    gardenAt(yard, 'meadow').push(tree)
    // A round trip: away to the wood, and home again.
    gardenAt(yard, 'woodland')
    expect(gardenAt(yard, 'meadow')).toEqual([tree])
  })

  it('is bare rather than absent for a place never lived in', () => {
    expect(gardenAt(emptyYard(), 'woodland')).toEqual([])
  })
})

describe('growthOf', () => {
  const planting = (plantedAt: number): Planting => ({ kind: 'sapling', x: 0, z: 0, plantedAt })

  it('is a seed the day it goes in', () => {
    expect(growthOf(planting(0), 0)).toBe(0)
    expect(growthOf(planting(0), DAY_MS - 1)).toBe(0)
  })

  it('grows a stage per world day', () => {
    expect(growthOf(planting(0), DAY_MS)).toBe(1)
    expect(growthOf(planting(0), 2 * DAY_MS)).toBe(2)
  })

  it('stops at full grown rather than running off the end of the stages', () => {
    expect(growthOf(planting(0), 50 * DAY_MS)).toBe(GROWTH_STAGES - 1)
  })

  it('reads off when it was planted, not off the epoch', () => {
    const late = planting(100 * DAY_MS)
    expect(growthOf(late, 100 * DAY_MS + DAY_MS)).toBe(1)
  })

  it('treats a clock that has gone backwards as newly planted', () => {
    expect(growthOf(planting(10 * DAY_MS), 0)).toBe(0)
  })
})

describe('countOf', () => {
  it('counts only the kind asked for', () => {
    const garden: Planting[] = [
      { kind: 'sapling', x: 0, z: 0, plantedAt: 0 },
      { kind: 'sapling', x: 1, z: 0, plantedAt: 0 },
      { kind: 'bramble', x: 2, z: 0, plantedAt: 0 },
    ]
    expect(countOf(garden, 'sapling')).toBe(2)
    expect(countOf(garden, 'bramble')).toBe(1)
    expect(countOf(garden, 'moonflower')).toBe(0)
  })
})

describe('plantableKind', () => {
  it('is null once the yard is full', () => {
    const garden: Planting[] = []
    for (let i = 0; i < YARD_CAPACITY; i++) {
      garden.push({ kind: 'sapling', x: i, z: 0, plantedAt: 0 })
    }
    expect(plantableKind(garden, 0.5)).toBeNull()
  })

  it('prefers something the yard has none of, so a garden ends up varied', () => {
    const garden: Planting[] = [{ kind: 'sapling', x: 0, z: 0, plantedAt: 0 }]
    for (let roll = 0; roll < 1; roll += 0.05) {
      expect(plantableKind(garden, roll)).not.toBe('sapling')
    }
  })

  it('falls back to the whole list once every kind is represented', () => {
    const garden: Planting[] = PLANTS.map((p, i) => ({
      kind: p.id,
      x: i,
      z: 0,
      plantedAt: 0,
    }))
    // One slot left, and nothing fresh: any kind will do.
    expect(garden.length).toBeLessThan(YARD_CAPACITY)
    const kinds = new Set<PlantId | null>()
    for (let roll = 0; roll < 1; roll += 0.05) kinds.add(plantableKind(garden, roll))
    expect(kinds.size).toBeGreaterThan(1)
    expect(kinds.has(null)).toBe(false)
  })

  it('always names a plant that exists', () => {
    const ids = new Set(PLANTS.map((p) => p.id))
    for (let roll = 0; roll < 1; roll += 0.01) {
      const kind = plantableKind([], roll)
      expect(ids.has(kind!)).toBe(true)
    }
  })

  it('stays in range for a roll of exactly one', () => {
    expect(plantableKind([], 1)).not.toBeNull()
  })
})
