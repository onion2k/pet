import { isWet, NO_KIT, type KitPowers } from './kit'
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
 *
 * Every biome supplies the same four roles. That is not tidiness for its own
 * sake: it is what stops moving house from stranding a player. A child always
 * has exactly one ground wherever it lives, and nowhere lacks somewhere to go
 * on a fair day. What actually differs between two biomes' grounds is what they
 * turn up -- which is the right lever, because curios are the collection.
 */

/**
 * The four jobs a ground does. Narration is written per role rather than per
 * ground, so a new biome costs four names and a curio table rather than a
 * fresh set of journey lines.
 */
export type GroundRole = 'near' | 'wet' | 'sheltered' | 'far'

export type GroundId =
  | 'wall'
  | 'creek'
  | 'hollow'
  | 'hill'
  | 'coppice'
  | 'streambed'
  | 'deadfall'
  | 'ridge'
  | 'tideline'
  | 'rockpools'
  | 'dunes'
  | 'headland'
  | 'sheepfold'
  | 'spring'
  | 'cleft'
  | 'summit'
  | 'lane'
  | 'duckpond'
  | 'churchyard'
  | 'watermeadow'

export interface Ground {
  id: GroundId
  role: GroundRole
  name: string
  /**
   * The ground in a sentence, lower case, for the journey lines to slot in:
   * "ambles down to the old wall". Role narration is shared, so this is the
   * only part of a trip that names where the pet actually went.
   */
  place: string
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

export const MEADOW_GROUNDS: Ground[] = [
  {
    id: 'wall',
    role: 'near',
    name: 'The Old Wall',
    place: 'the old wall',
    note: 'Close by. Modest pickings.',
    from: 'child',
    energy: 6,
    luck: 0.55,
    favours: ['pebble'],
  },
  {
    id: 'creek',
    role: 'wet',
    name: 'The Creek',
    place: 'the creek',
    note: 'Wants rain, or a mist.',
    from: 'adult',
    energy: 10,
    luck: 0.7,
    weather: ['rain', 'mist'],
    favours: ['dewdrop', 'pebble'],
  },
  {
    id: 'hollow',
    role: 'sheltered',
    name: 'The Hollow',
    place: 'the hollow',
    note: 'Sheltered. Best in autumn.',
    from: 'adult',
    energy: 9,
    luck: 0.7,
    seasons: ['autumn'],
    favours: ['toadstool', 'blossom'],
  },
  {
    id: 'hill',
    role: 'far',
    name: 'The Long Hill',
    place: 'the long hill',
    note: 'A climb, and a wide view.',
    from: 'adult',
    energy: 14,
    luck: 0.75,
    weather: ['clear'],
    favours: ['feather', 'geode'],
  },
]

/**
 * The wood's four. Same roles, same costs, different pickings: a wood is worth
 * moving to because it turns up blooms where the meadow turns up stones, not
 * because it is easier.
 */
export const WOODLAND_GROUNDS: Ground[] = [
  {
    id: 'coppice',
    role: 'near',
    name: 'The Coppice',
    place: 'the coppice',
    note: 'Just through the trees.',
    from: 'child',
    energy: 6,
    luck: 0.55,
    favours: ['blossom'],
  },
  {
    id: 'streambed',
    role: 'wet',
    name: 'The Streambed',
    place: 'the streambed',
    note: 'Wants rain, or a mist.',
    from: 'adult',
    energy: 10,
    luck: 0.7,
    weather: ['rain', 'mist'],
    favours: ['dewdrop', 'geode'],
  },
  {
    id: 'deadfall',
    role: 'sheltered',
    name: 'The Deadfall',
    place: 'the deadfall',
    note: 'Sheltered. Best in autumn.',
    from: 'adult',
    energy: 9,
    luck: 0.7,
    seasons: ['autumn'],
    favours: ['toadstool', 'pebble'],
  },
  {
    id: 'ridge',
    role: 'far',
    name: 'The Ridge',
    place: 'the ridge',
    note: 'A climb, and a wide view.',
    from: 'adult',
    energy: 14,
    luck: 0.75,
    weather: ['clear'],
    favours: ['feather', 'snowdrop'],
  },
]

/**
 * The beach's four. Stones and weather rather than blooms -- and the one place
 * that turns up sunpetals, which nothing inland favours.
 */
export const BEACH_GROUNDS: Ground[] = [
  {
    id: 'tideline',
    role: 'near',
    name: 'The Tideline',
    place: 'the tideline',
    note: 'Whatever the sea left.',
    from: 'child',
    energy: 6,
    luck: 0.55,
    favours: ['sunpetal', 'pebble'],
  },
  {
    id: 'rockpools',
    role: 'wet',
    name: 'The Rockpools',
    place: 'the rockpools',
    note: 'Wants rain, or a mist.',
    from: 'adult',
    energy: 10,
    luck: 0.7,
    weather: ['rain', 'mist'],
    favours: ['dewdrop', 'geode'],
  },
  {
    id: 'dunes',
    role: 'sheltered',
    name: 'The Dunes',
    place: 'the dunes',
    note: 'Out of the wind. Best in autumn.',
    from: 'adult',
    energy: 9,
    luck: 0.7,
    seasons: ['autumn'],
    favours: ['feather', 'pebble'],
  },
  {
    id: 'headland',
    role: 'far',
    name: 'The Headland',
    place: 'the headland',
    note: 'A climb, and a wide view.',
    from: 'adult',
    energy: 14,
    luck: 0.75,
    weather: ['clear'],
    favours: ['feather', 'geode'],
  },
]

/** The hill's four. Stone and cold weather: geodes and snowdrops. */
export const HILL_GROUNDS: Ground[] = [
  {
    id: 'sheepfold',
    role: 'near',
    name: 'The Sheepfold',
    place: 'the sheepfold',
    note: 'Just down the slope.',
    from: 'child',
    energy: 6,
    luck: 0.55,
    favours: ['pebble'],
  },
  {
    id: 'spring',
    role: 'wet',
    name: 'The Spring',
    place: 'the spring',
    note: 'Wants rain, or a mist.',
    from: 'adult',
    energy: 10,
    luck: 0.7,
    weather: ['rain', 'mist'],
    favours: ['dewdrop', 'geode'],
  },
  {
    id: 'cleft',
    role: 'sheltered',
    name: 'The Cleft',
    place: 'the cleft',
    note: 'Out of the wind. Best in autumn.',
    from: 'adult',
    energy: 9,
    luck: 0.7,
    seasons: ['autumn'],
    favours: ['toadstool', 'geode'],
  },
  {
    id: 'summit',
    role: 'far',
    name: 'The Summit',
    place: 'the summit',
    note: 'A climb, and a wide view.',
    from: 'adult',
    energy: 14,
    luck: 0.75,
    weather: ['clear'],
    favours: ['snowdrop', 'feather'],
  },
]

/** The village's four. Gardens and old corners: blooms, and what people drop. */
export const VILLAGE_GROUNDS: Ground[] = [
  {
    id: 'lane',
    role: 'near',
    name: 'The Lane',
    place: 'the lane',
    note: 'Past the neighbours.',
    from: 'child',
    energy: 6,
    luck: 0.55,
    favours: ['blossom'],
  },
  {
    id: 'duckpond',
    role: 'wet',
    name: 'The Duckpond',
    place: 'the duckpond',
    note: 'Wants rain, or a mist.',
    from: 'adult',
    energy: 10,
    luck: 0.7,
    weather: ['rain', 'mist'],
    favours: ['dewdrop', 'feather'],
  },
  {
    id: 'churchyard',
    role: 'sheltered',
    name: 'The Churchyard',
    place: 'the churchyard',
    note: 'Quiet. Best in autumn.',
    from: 'adult',
    energy: 9,
    luck: 0.7,
    seasons: ['autumn'],
    favours: ['toadstool', 'snowdrop'],
  },
  {
    id: 'watermeadow',
    role: 'far',
    name: 'The Water Meadow',
    place: 'the water meadow',
    note: 'A long walk, and a wide view.',
    from: 'adult',
    energy: 14,
    luck: 0.75,
    weather: ['clear'],
    favours: ['sunpetal', 'blossom'],
  },
]

/** Every ground in the world, so an id can be looked up without its biome. */
export const GROUNDS: Ground[] = [
  ...MEADOW_GROUNDS,
  ...WOODLAND_GROUNDS,
  ...BEACH_GROUNDS,
  ...HILL_GROUNDS,
  ...VILLAGE_GROUNDS,
]

export const groundById = (id: GroundId): Ground => {
  const found = GROUNDS.find((g) => g.id === id)
  if (!found) throw new Error(`Unknown ground: ${id}`)
  return found
}

/**
 * Which of this biome's grounds the pet is old enough for. A child has one; an
 * adult has all four.
 */
export function groundsFor(grounds: Ground[], stage: Stage): Ground[] {
  if (stage === 'adult') return grounds
  if (stage === 'child') return grounds.filter((g) => g.from === 'child')
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
 * What a thing wants of the day. Grounds are not the only things that read the
 * weather -- so does a game out in the yard -- and both want the same three
 * words for it, so the preference is a shape rather than a ground.
 */
export interface DayPreference {
  seasons?: SeasonId[]
  weather?: WeatherId[]
}

/**
 * Reads a preference against the day. Something with no preference is always
 * fair -- dependable rather than dull, which is what makes the near ground the
 * sensible fallback when nothing else looks good.
 *
 * Kit forgives a miss rather than manufacturing a hit: an umbrella takes the
 * rain out of the reckoning, it does not make the rain a reason to go. So the
 * best a forgiven mismatch can be is *fair*, which is the difference between
 * kit widening the days worth playing and kit making every day the same day.
 */
export function prospectOf(
  want: DayPreference,
  season: SeasonId,
  weather: WeatherId,
  kit: KitPowers = NO_KIT,
): Prospect {
  let score = 0
  if (want.seasons) {
    const met = want.seasons.includes(season)
    score += met ? 1 : kit.forgivesSeason ? 0 : -1
  }
  if (want.weather) {
    const met = want.weather.includes(weather)
    score += met ? 1 : forgiven(want.weather, kit) ? 0 : -1
  }
  if (score > 0) return 'good'
  if (score < 0) return 'poor'
  return 'fair'
}

/**
 * Whether the kit has something to say about missing the weather. Two items
 * do, from opposite directions: the umbrella when the day itself is wet, and
 * the waders when the place wanted a wet day and did not get one.
 */
function forgiven(wanted: WeatherId[], kit: KitPowers): boolean {
  if (kit.forgivesWeather) return true
  return kit.wades && wanted.every(isWet)
}

/** The chance this ground comes home with something, on this particular day. */
export function luckOf(
  ground: Ground,
  season: SeasonId,
  weather: WeatherId,
  kit: KitPowers = NO_KIT,
): number {
  return Math.min(0.95, ground.luck * PROSPECT_LUCK[prospectOf(ground, season, weather, kit)])
}
