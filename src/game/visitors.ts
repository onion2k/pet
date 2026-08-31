import { UNIVERSAL_VISITORS, VISITORS, type VisitorId } from '../data/visitors'
import type { Biome } from '../data/biome'
import type { SeasonId } from '../data/seasons'

/**
 * Who is in the yard today.
 *
 * This used to be settled inside the renderer, which meant the game could not
 * know what was out there -- and a yard the game cannot see is a yard it cannot
 * offer you anything to do with. The roll is game state that the renderer
 * happens to draw, so it lives here and the renderer asks.
 *
 * It stays a pure function of the world day rather than something stored: a
 * visitor is settled for the day rather than flickering, and nothing has to be
 * migrated into old saves for the yard to have a history.
 */

/** Deterministic 0..1 from a pair of integers. Same shape as the terrain's. */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

/** A visitor's own seed, so each rolls independently on the same day. */
export function idSeed(id: VisitorId): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/**
 * Whether a visitor is in the yard on this world day. A befriended stray is no
 * longer a matter of luck: it comes whenever its season does. That is what
 * befriending it bought.
 *
 * Note this is presence for the *day*, not for the moment -- a visitor that
 * keeps to an hour window is still one of today's, and is announced before its
 * window opens. Anything that needs the pet to be able to reach it now has to
 * ask `withinHours` as well.
 */
export function isPresent(
  id: VisitorId,
  day: number,
  season: SeasonId,
  regulars: VisitorId[],
): boolean {
  const visitor = VISITORS.find((v) => v.id === id)
  if (!visitor) return false
  if (!visitor.seasons.includes(season)) return false
  const chance = regulars.includes(id) ? 1 : visitor.chance
  return hash2(day, idSeed(id)) < chance
}

/**
 * Who could turn up where the pet lives: the ones that turn up anywhere, plus
 * whoever fills this biome's roles, plus every stray it has ever befriended.
 *
 * The strays are in there whatever the biome, and that is the point. Moving
 * house leaves the garden behind but not the friends -- a rabbit out on a wood
 * clearing is slightly wrong and entirely charming, and it is the only visible
 * proof that the pet used to live somewhere else.
 */
export function roster(biome: Biome, regulars: VisitorId[]): VisitorId[] {
  const here = new Set<VisitorId>([
    ...UNIVERSAL_VISITORS,
    ...Object.values(biome.visitors),
    ...(biome.extras ?? []),
    ...regulars,
  ])
  // Declaration order, not set order: the renderer places visitors in the order
  // it is handed them, so this has to be stable from one day to the next.
  return VISITORS.filter((v) => here.has(v.id)).map((v) => v.id)
}

/** Everyone in the yard today, in the order they are declared. */
export function visitorsPresent(
  roster: VisitorId[],
  day: number,
  season: SeasonId,
  regulars: VisitorId[],
): VisitorId[] {
  return roster.filter((id) => isPresent(id, day, season, regulars))
}

/**
 * Whether a visitor that keeps to an hour window can be seen right now. A
 * window may wrap midnight -- the fireflies are out from eight until four --
 * so the two cases are written out rather than compared as one range.
 */
export function withinHours(id: VisitorId, hour: number): boolean {
  const visitor = VISITORS.find((v) => v.id === id)
  if (!visitor?.hours) return true
  const [from, to] = visitor.hours
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to
}
