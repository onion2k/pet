import type { GroundRole } from './grounds'
import type { SeasonId, WeatherId } from './seasons'

/**
 * The kit: the half of the collection the pet *uses*.
 *
 * A curio is a thing on a shelf. Every one of these is tied to a condition the
 * world already produces -- rain, snow, a dark hour, a wet place on a dry day
 * -- and changes what that condition means. The rule the whole list obeys:
 *
 *   Kit does not make a good day better. It makes a bad day playable.
 *
 * Which is why owning one is enough to have it. There is no pack screen and no
 * equip step, because nothing here stacks: it cannot rain and snow in the same
 * hour, and the far ground is not the wet ground. A full kit does not make
 * every day good, it makes every day legible -- which is the thing the game
 * keeps asking the player to pay attention to.
 *
 * None of it is found. Every piece is earned by doing the job it then helps
 * with: the pet goes out in the rain three times and takes to carrying an
 * umbrella; it walks past the first leg often enough and puts boots on. So a
 * player never gets a thing before they have met the problem it solves, and
 * never watches a lottery decide whether they get one at all -- the board is a
 * list of what to go and do, and the doing is the game.
 */
export type KitId =
  | 'umbrella'
  | 'hat'
  | 'snowboard'
  | 'torch'
  | 'boots'
  | 'waders'
  | 'basket'
  | 'pinecone'

/**
 * What can go wrong on a trip, named so that kit can spare one. The list
 * itself lives with the forage, which is what has them; the names live here,
 * because being spared is a thing kit does rather than a thing a trip does.
 */
export type MishapId = 'mud' | 'footsore' | 'late' | 'soaked'

export interface KitItem {
  id: KitId
  name: string
  /**
   * What the trip says it brought back, article and all -- as the supplies do.
   * Written out rather than assembled, because "a umbrella" and "a waders" are
   * what assembling it gives you.
   */
  what: string
  /** What it is for, in the feed and forage menus' voice. */
  note: string
  /**
   * What kind of trip counts toward earning it, and how many of them.
   *
   * Every one of these is the job the thing then helps with: the pet goes out
   * in the rain three times and takes to carrying an umbrella; it walks past
   * the first leg often enough and puts boots on. Nothing here is a lottery,
   * and nothing is handed over before the player has met the problem it
   * solves -- which is the difference between a reward and a drop.
   */
  counts(trip: Trip): boolean
  needs: number
  /**
   * The qualifying trips, named, for the board to print under a silhouette.
   * A noun phrase, because the screen puts the tally after it: "TRIPS IN THE
   * WET 1/3".
   */
  hint: string
  /**
   * When the pet has it visibly about it, for the yard to draw.
   *
   * Kit shows when it is *doing* something rather than whenever it is owned. A
   * pet wearing all eight at once is a hat stand, and would say nothing about
   * the day -- whereas one that puts its hat on when it snows turns the yard
   * into a readout of the weather, which is the one channel that has never
   * carried it.
   *
   * Absent for the pieces that have no picture yet.
   */
  shows?(day: Day): boolean
  /** 8x8 artwork, in the same format as the curios and the menu icons. */
  glyph: string
  colour: string
}

/** A trip that has just happened, for deciding what it was worth. */
export interface Trip extends Day {
  role: GroundRole
  /** How many legs the pet walked. One is a there-and-back. */
  legs: number
  /** Whether it picked anything up on the way. */
  supplies: boolean
}

const art = (...rows: string[]): string => rows.join('/')

export const KIT: KitItem[] = [
  {
    id: 'umbrella',
    name: 'Umbrella',
    what: 'an umbrella',
    note: 'For a day of rain.',
    counts: (trip) => isWet(trip.weather),
    needs: 3,
    hint: 'TRIPS IN THE WET',
    colour: '#6f9ee8',
    glyph: art(
      '...##...',
      '.######.',
      '########',
      '#.#..#.#',
      '...##...',
      '...##...',
      '...##.#.',
      '....##..',
    ),
  },
  {
    id: 'hat',
    name: 'Bobble hat',
    what: 'a bobble hat',
    note: 'For the cold.',
    counts: (trip) => trip.season === 'winter',
    needs: 3,
    hint: 'TRIPS IN WINTER',
    shows: (day) => day.season === 'winter',
    colour: '#e2604f',
    glyph: art(
      '...##...',
      '..####..',
      '..####..',
      '..####..',
      '..####..',
      '########',
      '########',
      '........',
    ),
  },
  {
    id: 'snowboard',
    name: 'Snowboard',
    what: 'a snowboard',
    note: 'For getting somewhere, fast.',
    counts: (trip) => trip.weather === 'snow',
    needs: 3,
    hint: 'TRIPS IN THE SNOW',
    colour: '#5fd0e8',
    glyph: art(
      '......##',
      '.....###',
      '....###.',
      '..#####.',
      '.#####..',
      '.###....',
      '###.....',
      '##......',
    ),
  },
  {
    id: 'torch',
    name: 'Torch',
    what: 'a torch',
    note: 'For the dark.',
    counts: (trip) => trip.night,
    needs: 3,
    hint: 'TRIPS AFTER DARK',
    colour: '#ffb03a',
    glyph: art(
      '...#....',
      '..###...',
      '.#####..',
      '..###...',
      '..####..',
      '...##...',
      '...##...',
      '...##...',
    ),
  },
  {
    id: 'boots',
    name: 'Stout boots',
    what: 'a pair of stout boots',
    note: 'For a long way out.',
    counts: (trip) => trip.legs > 1,
    needs: 5,
    hint: 'TRIPS PUSHED FURTHER',
    colour: '#8a6242',
    glyph: art(
      '........',
      '.#....#.',
      '.#....#.',
      '.#....#.',
      '.#....#.',
      '.##...##',
      '.###.###',
      '.###.###',
    ),
  },
  {
    id: 'waders',
    name: 'Waders',
    what: 'a pair of waders',
    note: 'For standing in water.',
    counts: (trip) => trip.role === 'wet',
    needs: 3,
    hint: 'TRIPS TO WET GROUND',
    colour: '#4f8f6a',
    glyph: art(
      '..####..',
      '..#..#..',
      '..#..#..',
      '..#..#..',
      '..#..#..',
      '..#..#..',
      '..#..###',
      '..#####.',
    ),
  },
  {
    id: 'basket',
    name: 'Basket',
    what: 'a basket',
    note: 'For carrying more home.',
    counts: (trip) => trip.supplies,
    needs: 5,
    hint: 'TRIPS THAT GATHERED',
    colour: '#c69a5a',
    glyph: art(
      '..####..',
      '.######.',
      '########',
      '#.#..#.#',
      '#.#..#.#',
      '#.#..#.#',
      '.######.',
      '..####..',
    ),
  },
  {
    id: 'pinecone',
    name: 'Pine cone',
    what: 'a pine cone',
    // The one note here that has to teach rather than label: a cone shutting
    // before the rain is folk knowledge, and a player who has not met it would
    // otherwise be holding a fir cone and wondering what it was for.
    note: 'It closes before rain.',
    counts: () => true,
    needs: 20,
    hint: 'TRIPS OF ANY KIND',
    colour: '#96562e',
    glyph: art(
      '..####..',
      '.######.',
      '##.##.##',
      '.######.',
      '.##..##.',
      '..####..',
      '..#..#..',
      '...##...',
    ),
  },
]

export const KIT_COUNT = KIT.length

export function kitById(id: string): KitItem | undefined {
  return KIT.find((k) => k.id === id)
}

/** Ids this build still knows about, for reading a save written by another. */
export const isKitId = (id: unknown): id is KitId =>
  typeof id === 'string' && KIT.some((k) => k.id === id)

/**
 * What the kit is doing today.
 *
 * Every field is already resolved against the day, which is where the whole
 * design lives: kit does not make a good day better, it makes a bad day
 * playable, and a bad day is the only kind most of these have anything to say
 * about. An umbrella on a clear afternoon is a thing in a cupboard.
 */
export interface KitPowers {
  /**
   * The day's weather no longer counts against a ground that wanted otherwise.
   * The umbrella, when it is actually raining.
   */
  forgivesWeather: boolean
  /** The season likewise. The bobble hat, in winter. */
  forgivesSeason: boolean
  /**
   * A ground that wants wet weather no longer needs it -- the mirror of the
   * umbrella. One makes a wet day workable; the other makes a wet place
   * workable on a dry one.
   */
  wades: boolean
  /** Mishaps that simply do not happen. */
  spares: MishapId[]
  /** The pet is warm through the night without a fire banked against it. */
  warm: boolean
  /** Multiplier on the odds of a trip going wrong. Boots, always. */
  mishapScale: number
  /** Multiplier on what going one leg further costs. The board, in snow. */
  pushScale: number
  /**
   * Legs' worth of reach, without the walking. A torch does not carry the pet
   * further out; it lets it find what was already out there.
   */
  depthBonus: number
  /** The dark has stopped being a risk, because the pet is carrying a light. */
  lightsTheDark: boolean
  /** Added to the odds a trip picks something up on the way. */
  supplyBonus: number
  /** Added to how much of any one thing the larder will hold. */
  larderBonus: number
  /** The pet can tell when the sky is going to turn, and what to. */
  forecasts: boolean
}

/**
 * The day a piece of kit is being asked about.
 *
 * Whether it is dark is part of the day rather than part of the trip, because
 * a torch is a torch whoever is asking -- the forage, the menu warning the
 * player about the dark, and anything later that wants to know.
 */
export interface Day {
  season: SeasonId
  weather: WeatherId
  night: boolean
}

/** Weather you would want an umbrella or a pair of waders for. */
const WET: WeatherId[] = ['rain', 'mist']

export const isWet = (weather: WeatherId): boolean => WET.includes(weather)

/**
 * What the family's kit is worth on this particular day.
 *
 * A pure function of what is owned and what the sky is doing, so nothing has
 * to remember to ask twice and no caller has to know which item does what:
 * the grounds menu, the trip and the bedtime all read the same object.
 */
export function kitPowers(owned: KitId[], day: Day): KitPowers {
  const has = (id: KitId) => owned.includes(id)
  // An umbrella is the reason the pet did not come home caked in mud, and a
  // pair of boots the reason it is not footsore. Kit spares a mishap rather
  // than swapping it for another one: nothing becomes likelier because the pet
  // went out better equipped.
  const spares: MishapId[] = []
  if (has('umbrella')) spares.push('mud')
  if (has('boots')) spares.push('footsore')
  return {
    forgivesWeather: has('umbrella') && isWet(day.weather),
    forgivesSeason: has('hat') && day.season === 'winter',
    wades: has('waders'),
    spares,
    // A hat is a fire the pet did not have to go and gather. Only in winter,
    // or it would quietly retire the kindling it took an adult to learn to
    // fetch -- and a hat is for the cold, which is what winter is.
    warm: has('hat') && day.season === 'winter',
    // Boots are the one thing here that asks nothing of the day. They are
    // also the smallest: they only matter to a player who pushes on, since
    // nothing goes wrong on a there-and-back.
    mishapScale: has('boots') ? BOOTS_MISHAP : 1,
    // Snow is what a board is for, and what it does with it is make the far
    // end of a trip cheap -- so a snowy day is the day to go deep.
    pushScale: has('snowboard') && day.weather === 'snow' ? BOARD_PUSH : 1,
    depthBonus: has('torch') && day.night ? TORCH_REACH : 0,
    lightsTheDark: has('torch') && day.night,
    // A basket asks nothing of the day either, and pays out only to a pet that
    // is actually out gathering -- which is to say, to an adult doing its job.
    supplyBonus: has('basket') ? BASKET_SUPPLY : 0,
    larderBonus: has('basket') ? BASKET_LARDER : 0,
    // The cone is information rather than power. It changes no odds at all; it
    // tells the player which day is coming, and leaves them to use it.
    forecasts: has('pinecone'),
  }
}

/** What a pair of boots does to the odds of a trip going wrong. */
const BOOTS_MISHAP = 0.55
/** What a board does to the price of one more leg, on snow. */
const BOARD_PUSH = 0.5
/** How much further into the dark a lit torch can see, in legs. */
const TORCH_REACH = 1
/** What a basket adds to the odds of coming home with supplies. */
const BASKET_SUPPLY = 0.2
/** And to how much of any one thing the larder will hold. */
const BASKET_LARDER = 3

/** No kit at all, for anything that has to read powers without a family. */
export const NO_KIT: KitPowers = {
  forgivesWeather: false,
  forgivesSeason: false,
  wades: false,
  spares: [],
  warm: false,
  mishapScale: 1,
  pushScale: 1,
  depthBonus: 0,
  lightsTheDark: false,
  supplyBonus: 0,
  larderBonus: 0,
  forecasts: false,
}

/**
 * How far along the family is toward each piece of kit it has yet to earn.
 *
 * Kept as a plain tally per item rather than as a pile of counters with names
 * -- "trips in the rain", "trips after dark" -- because what a trip is worth
 * is the item's business, and a tally the item owns cannot fall out of step
 * with the rule that fills it.
 */
export type KitProgress = Partial<Record<KitId, number>>

/** What a trip did for a family: what it earned them, and how much nearer. */
export interface KitEarned {
  /** Kit the trip finished off, in board order. */
  earned: KitItem[]
  /** The tally afterwards. */
  progress: KitProgress
}

/**
 * Counts a trip toward everything it was a trip for.
 *
 * Pure, and takes the tally rather than the save, so the rule that decides
 * what a family has earned can be read straight through without a game around
 * it. A trip can finish more than one thing at once -- a pushed trip through
 * snow after dark is three kinds of trip -- and all of them are handed back.
 */
export function creditTrip(owned: KitId[], progress: KitProgress, trip: Trip): KitEarned {
  const next: KitProgress = { ...progress }
  const earned: KitItem[] = []
  for (const item of KIT) {
    if (owned.includes(item.id) || !item.counts(trip)) continue
    const done = (next[item.id] ?? 0) + 1
    next[item.id] = done
    if (done >= item.needs) earned.push(item)
  }
  return { earned, progress: next }
}

/**
 * What the pet has visibly about it today: what the family owns, less what the
 * day has no use for, less what has no picture yet.
 */
export function wornToday(owned: KitId[], day: Day): KitId[] {
  return KIT.filter((item) => owned.includes(item.id) && item.shows?.(day)).map((item) => item.id)
}

/** How near the family is to earning one, for the board to show under it. */
export function progressOf(progress: KitProgress, item: KitItem): number {
  return Math.min(item.needs, progress[item.id] ?? 0)
}
