import { describe, expect, it } from 'vitest'
import {
  findSupply,
  gatheredFoods,
  KINDLING,
  LARDER_CAP,
  SUPPLIES,
} from '../../src/game/larder'
import {
  countOf,
  emptyYard,
  growthOf,
  plantableKind,
  YARD_CAPACITY,
  type Planting,
} from '../../src/game/yard'
import { DAY_MS } from '../../src/game/world'
import { FOODS } from '../../src/data/foods'
import { GROUNDS, type GroundId } from '../../src/data/grounds'
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

  it('only names grounds that exist', () => {
    const ids = new Set(GROUNDS.map((g) => g.id))
    for (const supply of SUPPLIES) {
      for (const ground of supply.grounds ?? []) expect(ids.has(ground)).toBe(true)
    }
  })
})

describe('findSupply', () => {
  const grounds = GROUNDS.map((g) => g.id)

  it('finds something on every ground at every depth', () => {
    for (const ground of grounds) {
      for (let depth = 1; depth <= 3; depth++) {
        for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
          expect(findSupply(ground, depth, roll)).not.toBeNull()
        }
      }
    }
  })

  it('only returns supplies that ground actually turns up', () => {
    for (const ground of grounds) {
      for (const roll of [0, 0.3, 0.6, 0.9, 0.999]) {
        const supply = findSupply(ground, 3, roll)!
        if (supply.grounds) expect(supply.grounds).toContain(ground)
      }
    }
  })

  it('keeps the deepest supplies out of reach of a short trip', () => {
    const shallow = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.01) {
      shallow.add(findSupply('hill', 1, roll)!.id)
    }
    expect(shallow.has('honeycomb')).toBe(false)

    const deep = new Set<string>()
    for (let roll = 0; roll < 1; roll += 0.01) deep.add(findSupply('hill', 2, roll)!.id)
    expect(deep.has('honeycomb')).toBe(true)
  })

  it('picks by weight, so the first supply owns the lowest rolls', () => {
    // On the wall the pool is kindling (5) then berries (4); total 9.
    expect(findSupply('wall', 1, 0)!.id).toBe(KINDLING)
    expect(findSupply('wall', 1, 4 / 9)!.id).toBe(KINDLING)
    expect(findSupply('wall', 1, 0.9)!.id).toBe('berries')
  })

  it('falls back to the last of the pool if a roll lands past the end', () => {
    // Floating-point drift on the running total must not return null.
    expect(findSupply('wall', 1, 1)).not.toBeNull()
    expect(findSupply('wall', 1, 1.5)).not.toBeNull()
  })

  it('is null when nothing in the pool is available', () => {
    expect(findSupply('creek', 0, 0.5)).toBeNull()
  })

  it('is null for a ground nothing is keyed to', () => {
    expect(findSupply('nowhere' as GroundId, 0, 0.5)).toBeNull()
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
    expect(a).toEqual({ plantings: [], strays: [] })
    a.plantings.push({ kind: 'sapling', x: 0, z: 0, plantedAt: 0 })
    expect(b.plantings).toEqual([])
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
    const yard = emptyYard()
    yard.plantings.push(
      { kind: 'sapling', x: 0, z: 0, plantedAt: 0 },
      { kind: 'sapling', x: 1, z: 0, plantedAt: 0 },
      { kind: 'bramble', x: 2, z: 0, plantedAt: 0 },
    )
    expect(countOf(yard, 'sapling')).toBe(2)
    expect(countOf(yard, 'bramble')).toBe(1)
    expect(countOf(yard, 'moonflower')).toBe(0)
  })
})

describe('plantableKind', () => {
  it('is null once the yard is full', () => {
    const yard = emptyYard()
    for (let i = 0; i < YARD_CAPACITY; i++) {
      yard.plantings.push({ kind: 'sapling', x: i, z: 0, plantedAt: 0 })
    }
    expect(plantableKind(yard, 0.5)).toBeNull()
  })

  it('prefers something the yard has none of, so a garden ends up varied', () => {
    const yard = emptyYard()
    yard.plantings.push({ kind: 'sapling', x: 0, z: 0, plantedAt: 0 })
    for (let roll = 0; roll < 1; roll += 0.05) {
      expect(plantableKind(yard, roll)).not.toBe('sapling')
    }
  })

  it('falls back to the whole list once every kind is represented', () => {
    const yard = emptyYard()
    PLANTS.forEach((p, i) => yard.plantings.push({ kind: p.id, x: i, z: 0, plantedAt: 0 }))
    // One slot left, and nothing fresh: any kind will do.
    expect(yard.plantings.length).toBeLessThan(YARD_CAPACITY)
    const kinds = new Set<PlantId | null>()
    for (let roll = 0; roll < 1; roll += 0.05) kinds.add(plantableKind(yard, roll))
    expect(kinds.size).toBeGreaterThan(1)
    expect(kinds.has(null)).toBe(false)
  })

  it('always names a plant that exists', () => {
    const ids = new Set(PLANTS.map((p) => p.id))
    for (let roll = 0; roll < 1; roll += 0.01) {
      const kind = plantableKind(emptyYard(), roll)
      expect(ids.has(kind!)).toBe(true)
    }
  })

  it('stays in range for a roll of exactly one', () => {
    expect(plantableKind(emptyYard(), 1)).not.toBeNull()
  })
})
