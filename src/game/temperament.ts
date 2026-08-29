import { metrics, type Metrics } from './metrics'
import { STAGE_DURATION } from './tuning'
import type { AlbumEntry, PetState } from './types'

/**
 * What a pet turns out like, settled when it grows up.
 *
 * The four raising metrics -- care, diet, play and sleep -- fed exactly one
 * decision, which branch the pet took, and that decision is spent the moment it
 * becomes an adult. They carried on being computed for the rest of its life
 * while nothing read them. A temperament is that same reading, kept: it is what
 * makes two adults of the same species raised differently into different pets.
 */
export type TemperamentId = 'devoted' | 'lively' | 'restful' | 'easygoing'

export interface Temperament {
  id: TemperamentId
  name: string
  /**
   * Shown on the status screen, in the same voice as the branch reasons and in
   * the same column, so it has to fall in two lines of sixteen characters.
   */
  blurb: string
}

export const TEMPERAMENTS: Record<TemperamentId, Temperament> = {
  devoted: { id: 'devoted', name: 'Devoted', blurb: 'happiest when you are near' },
  lively: { id: 'lively', name: 'Lively', blurb: 'restless, always up for a game' },
  restful: { id: 'restful', name: 'Restful', blurb: 'keeps its own good hours' },
  easygoing: { id: 'easygoing', name: 'Easygoing', blurb: 'takes the days as they come' },
}

/** When a pet counts as grown, and how long a full grown life is. */
const ADULT_FROM = STAGE_DURATION.egg + STAGE_DURATION.baby + STAGE_DURATION.child
const FULL_LIFE = STAGE_DURATION.adult
/** The margin a reading needs over the others before it counts as a character. */
const DISTINCT = 0.1

/**
 * What each reading looks like for an unremarkable pet. They are not on the
 * same scale -- care sits high for anyone half attentive, while play wants
 * twenty games and sleep wants punctual bedtimes -- so comparing them raw made
 * three pets in four come out devoted. Standing out means standing out against
 * what is normal for that axis.
 */
const TYPICAL = { care: 0.78, play: 0.52, sleep: 0.55 } as const

/**
 * Reads a temperament off how the pet was raised. Nothing stands out unless it
 * genuinely stands out -- a pet raised evenly is easygoing rather than being
 * forced into whichever axis happened to be a hair ahead.
 */
export function temperamentFrom(m: Metrics): TemperamentId {
  const scores: [TemperamentId, number][] = [
    ['devoted', m.care - TYPICAL.care],
    ['lively', m.play - TYPICAL.play],
    ['restful', m.sleep - TYPICAL.sleep],
  ]
  scores.sort((a, b) => b[1] - a[1])
  const [top, second] = scores
  if (!top || !second) return 'easygoing'
  if (top[1] - second[1] < DISTINCT) return 'easygoing'
  return top[0]
}

/** The temperament a pet has settled into, or null while it is still growing. */
export function temperamentOf(pet: PetState): Temperament | null {
  if (pet.stage !== 'adult' || !pet.temperament) return null
  return TEMPERAMENTS[pet.temperament] ?? null
}

/**
 * What a life is worth to the one after it, 0..1. Two things count: how well
 * the pet was kept, and how long it was allowed to be grown up. A pet retired
 * the moment it came of age passes on almost nothing however doted on, which is
 * what stops retiring being free.
 */
export function legacyOf(pet: PetState): number {
  const grownFor = Math.max(0, pet.ageMs - ADULT_FROM)
  const lived = Math.min(1, grownFor / FULL_LIFE)
  const kept = metrics(pet).care
  // No bonus for being an elder: reaching one already requires a full grown
  // life, so such a pet scores the maximum on the time alone.
  return Math.min(1, lived * 0.6 + kept * lived * 0.4)
}

/**
 * Which way a family leans, weighted by how much each life was worth. A line of
 * restful pets makes it a little easier for the next one to turn out restful
 * too -- not enough to decide anything on its own, but enough that raising a
 * family with an eye to what came before is a strategy rather than a story you
 * tell afterwards.
 */
export function lineageOf(album: AlbumEntry[]): TemperamentId | null {
  const weights = new Map<TemperamentId, number>()
  for (const entry of album) {
    if (!entry.temperament) continue
    weights.set(entry.temperament, (weights.get(entry.temperament) ?? 0) + (entry.legacy ?? 0.4))
  }
  let best: TemperamentId | null = null
  let bestWeight = 0
  for (const [id, weight] of weights) {
    if (weight > bestWeight) {
      best = id
      bestWeight = weight
    }
  }
  // A single half-lived ancestor is a coincidence, not a family trait.
  return bestWeight >= 1 ? best : null
}

/** How much a forebear's leaning is worth to the metric it favours. */
export const LINEAGE_NUDGE = 0.12

/**
 * The raising as the branch rules should see it, with the family's leaning
 * folded in. Applied where branches are chosen rather than in `metrics` itself,
 * so what the status screen reports about this pet stays about this pet.
 */
export function withLineage(m: Metrics, lineage: TemperamentId | null): Metrics {
  if (!lineage) return m
  const bump = (v: number) => Math.min(1, v + LINEAGE_NUDGE)
  switch (lineage) {
    case 'devoted':
      return { ...m, care: bump(m.care) }
    case 'lively':
      return { ...m, play: bump(m.play) }
    case 'restful':
      return { ...m, sleep: bump(m.sleep) }
    default:
      return m
  }
}
