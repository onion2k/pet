import type { SeasonId, WeatherId } from './seasons'
import type { Stage } from '../game/types'

/**
 * Where the pet can be sent. The README always claimed the whole decision was
 * *when* to send it; until there was somewhere to send it to, that decision had
 * nowhere to land. Each ground wants a different kind of day, so knowing the
 * year is something the player spends rather than something they wait out.
 *
 * The near ground is open to a child. The rest are an adult's, so the job grows
 * with the pet instead of arriving all at once at the last stage.
 */

export type GroundId = 'wall' | 'creek' | 'hollow' | 'hill'

export interface Ground {
  id: GroundId
  name: string
  /** Shown under the name on the menu, in the feed menu's voice. */
  note: string
  /** The stage the pet has to have reached to be sent here. */
  from: Stage
  /** What the trip costs in energy. */
  energy: number
  /** Chance of coming home with something, before the day is taken into account. */
  luck: number
  /** Curios this ground turns up more often than the others. */
  favours: string[]
  /** The seasons it is at its best in. Absent means it does not mind. */
  seasons?: SeasonId[]
  /** The weather it wants. Absent means it does not mind. */
  weather?: WeatherId[]
}

export const GROUNDS: Ground[] = [
  {
    id: 'wall',
    name: 'The Old Wall',
    note: 'Close by. Modest pickings.',
    from: 'child',
    energy: 6,
    luck: 0.55,
    favours: ['pebble'],
  },
  {
    id: 'creek',
    name: 'The Creek',
    note: 'Wants rain, or a mist.',
    from: 'adult',
    energy: 10,
    luck: 0.7,
    weather: ['rain', 'mist'],
    favours: ['dewdrop', 'pebble'],
  },
  {
    id: 'hollow',
    name: 'The Hollow',
    note: 'Sheltered. Best in autumn.',
    from: 'adult',
    energy: 9,
    luck: 0.7,
    seasons: ['autumn'],
    favours: ['toadstool', 'blossom'],
  },
  {
    id: 'hill',
    name: 'The Long Hill',
    note: 'A climb, and a wide view.',
    from: 'adult',
    energy: 14,
    luck: 0.75,
    weather: ['clear'],
    favours: ['feather', 'geode'],
  },
]

export const groundById = (id: GroundId): Ground => {
  const found = GROUNDS.find((g) => g.id === id)
  if (!found) throw new Error(`Unknown ground: ${id}`)
  return found
}

/** Which grounds this pet is old enough for. A child has one; an adult has all. */
export function groundsFor(stage: Stage): Ground[] {
  if (stage === 'adult') return GROUNDS
  if (stage === 'child') return GROUNDS.filter((g) => g.from === 'child')
  return []
}

/** How a ground looks today. The whole reason for watching the sky. */
export type Prospect = 'poor' | 'fair' | 'good'

export const PROSPECT_LABEL: Record<Prospect, string> = {
  good: 'looks promising',
  fair: 'worth a try',
  poor: 'not today',
}

/** What the prospect does to the odds of coming home with anything. */
const PROSPECT_LUCK: Record<Prospect, number> = { good: 1.3, fair: 1, poor: 0.5 }

/**
 * Reads a ground against the day. A ground with no preference is always fair --
 * dependable rather than dull, which is what makes the near ground the sensible
 * fallback when nothing else looks good.
 */
export function prospectOf(ground: Ground, season: SeasonId, weather: WeatherId): Prospect {
  let score = 0
  if (ground.seasons) score += ground.seasons.includes(season) ? 1 : -1
  if (ground.weather) score += ground.weather.includes(weather) ? 1 : -1
  if (score > 0) return 'good'
  if (score < 0) return 'poor'
  return 'fair'
}

/** The chance this ground comes home with something, on this particular day. */
export function luckOf(ground: Ground, season: SeasonId, weather: WeatherId): number {
  return Math.min(0.95, ground.luck * PROSPECT_LUCK[prospectOf(ground, season, weather)])
}
