import { GROWTH_STAGES, PLANTS, type PlantId } from '../data/plants'
import type { VisitorId } from '../data/visitors'
import { DAY_MS } from './world'

/**
 * What the yard remembers. Everything else out there is either derived from the
 * pet's id or rolled fresh each world day; this is the part that was put there
 * on purpose and stays put.
 *
 * It belongs to the save rather than to the pet, so a tree carried home as a
 * seed is still standing for the pet after next. Retiring clears a life, not a
 * garden.
 */

export interface Planting {
  kind: PlantId
  /** Where it stands, in world units. */
  x: number
  z: number
  /** World-clock ms it went in the ground. Its size is read off this. */
  plantedAt: number
}

export interface YardState {
  plantings: Planting[]
  /** Visitors the pet befriended, which now turn up whenever their season does. */
  strays: VisitorId[]
}

export const emptyYard = (): YardState => ({ plantings: [], strays: [] })

/** A world day per stage: a seed brought home today is a tree the day after next. */
const STAGE_MS = DAY_MS

/** How grown a planting is, 0 to the last stage. Read off the clock, not stored. */
export function growthOf(planting: Planting, worldNow: number): number {
  const grown = Math.floor(Math.max(0, worldNow - planting.plantedAt) / STAGE_MS)
  return Math.min(GROWTH_STAGES - 1, grown)
}

/** How many of a kind are already in the ground, so the yard does not fill up. */
export const countOf = (yard: YardState, kind: PlantId): number =>
  yard.plantings.filter((p) => p.kind === kind).length

/** How much the yard will hold before the pet starts coming home with curios instead. */
export const YARD_CAPACITY = 4

/** A kind the yard has room for, or null once it is full. */
export function plantableKind(yard: YardState, roll: number): PlantId | null {
  if (yard.plantings.length >= YARD_CAPACITY) return null
  // Prefer something the yard has none of, so a garden ends up varied.
  const fresh = PLANTS.filter((p) => countOf(yard, p.id) === 0)
  const pool = fresh.length > 0 ? fresh : PLANTS
  // Clamped rather than guarded: the plant list is never empty, so the only way
  // to miss is a roll outside 0..1, and the fix for that is to bring it back in.
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index]!.id
}
