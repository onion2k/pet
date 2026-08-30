import { FOODS } from '../data/foods'
import type { GroundId } from '../data/grounds'

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
  /** Which grounds turn it up. Absent means all of them. */
  grounds?: GroundId[]
  /** How deep into a trip it starts appearing. */
  depth?: number
  weight: number
}

export const SUPPLIES: Supply[] = [
  { id: KINDLING, what: 'an armful of kindling', weight: 5 },
  { id: 'berries', what: 'a cap full of brambles', grounds: ['wall', 'hollow'], weight: 4 },
  { id: 'roots', what: 'a knot of wild roots', grounds: ['hollow', 'creek'], weight: 4 },
  { id: 'honeycomb', what: 'a piece of honeycomb', grounds: ['hill', 'hollow'], depth: 2, weight: 2 },
]

export type Larder = Record<string, number>

/** How much of one thing the larder will hold, so it cannot be hoarded forever. */
export const LARDER_CAP = 9

/** What a trip to this ground, walked this far, might have picked up. */
export function findSupply(ground: GroundId, depth: number, roll: number): Supply | null {
  const pool = SUPPLIES.filter(
    (s) => (!s.grounds || s.grounds.includes(ground)) && (s.depth ?? 1) <= depth,
  )
  const total = pool.reduce((sum, s) => sum + s.weight, 0)
  if (total <= 0) return null
  let remaining = roll * total
  for (const supply of pool) {
    remaining -= supply.weight
    if (remaining <= 0) return supply
  }
  return pool[pool.length - 1] ?? null
}

/** The foraged foods the pet actually has some of, for the feed menu. */
export const gatheredFoods = (larder: Larder) =>
  FOODS.filter((f) => f.gathered && (larder[f.id] ?? 0) > 0)
