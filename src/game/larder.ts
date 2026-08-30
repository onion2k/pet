import { FOODS } from '../data/foods'
import type { GroundRole } from '../data/grounds'

/**
 * What the pet carries home that is of use rather than of interest.
 *
 * Curios are a collection; supplies are a supply line. This is the part that
 * makes an adult worth having: a grown pet feeds itself, warms its own bed, and
 * -- because gathered food counts toward the diet like any other -- can be
 * raised toward a particular form on what it finds rather than on what it is
 * handed.
 */

/** Fuel is the one supply that is not a meal. */
export const KINDLING = 'kindling'

export interface Supply {
  id: string
  /** What the trip says it brought back. */
  what: string
  /**
   * Which kinds of ground turn it up. Absent means all of them.
   *
   * Kinds rather than named grounds: a wet ground is a wet ground whichever
   * biome it is in, so moving house changes which curios come home without
   * needing the supply line rewritten for every new place.
   */
  roles?: GroundRole[]
  /** How deep into a trip it starts appearing. */
  depth?: number
  weight: number
}

export const SUPPLIES: Supply[] = [
  { id: KINDLING, what: 'an armful of kindling', weight: 5 },
  { id: 'berries', what: 'a cap full of brambles', roles: ['near', 'sheltered'], weight: 4 },
  { id: 'roots', what: 'a knot of wild roots', roles: ['sheltered', 'wet'], weight: 4 },
  { id: 'honeycomb', what: 'a piece of honeycomb', roles: ['far', 'sheltered'], depth: 2, weight: 2 },
]

export type Larder = Record<string, number>

/** How much of one thing the larder will hold, so it cannot be hoarded forever. */
export const LARDER_CAP = 9

/** What a trip to this kind of ground, walked this far, might have picked up. */
export function findSupply(role: GroundRole, depth: number, roll: number): Supply | null {
  const pool = SUPPLIES.filter(
    (s) => (!s.roles || s.roles.includes(role)) && (s.depth ?? 1) <= depth,
  )
  const total = pool.reduce((sum, s) => sum + s.weight, 0)
  if (total <= 0) return null
  let remaining = roll * total
  for (const supply of pool) {
    remaining -= supply.weight
    if (remaining <= 0) return supply
  }
  // As in `findCurio`: a positive total guarantees a non-empty pool, so a roll
  // that walks off the end lands on the last of it.
  return pool[pool.length - 1]!
}

/** The foraged foods the pet actually has some of, for the feed menu. */
export const gatheredFoods = (larder: Larder) =>
  FOODS.filter((f) => f.gathered && (larder[f.id] ?? 0) > 0)
