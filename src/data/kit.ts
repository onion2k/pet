import type { DayPreference, GroundRole } from './grounds'
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
 * Nothing in this file does anything yet. The items are found, they are owned,
 * and the board shows them; what each one is *for* arrives with the code that
 * reads it. The notes below are written as purpose rather than as effect for
 * exactly that reason -- an umbrella is for a wet day whether or not the odds
 * have been taught about it.
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
   * The day it is for, which is also the day it turns up on. Absent means it
   * does not mind, and something that does not mind needs another gate or it
   * is simply the first thing anybody finds.
   */
  wants?: DayPreference
  /** True for kit that only turns up on a trip that set out after dark. */
  night?: boolean
  /** The kind of ground that turns it up. Absent means any of them. */
  role?: GroundRole
  /** How many legs the pet must have walked. As the geode: the far things. */
  depth?: number
  /** 8x8 artwork, in the same format as the curios and the menu icons. */
  glyph: string
  colour: string
}

const art = (...rows: string[]): string => rows.join('/')

export const KIT: KitItem[] = [
  {
    id: 'umbrella',
    name: 'Umbrella',
    what: 'an umbrella',
    note: 'For a day of rain.',
    wants: { weather: ['rain', 'mist'] },
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
    wants: { weather: ['snow'] },
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
    wants: { weather: ['snow'] },
    depth: 2,
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
    night: true,
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
    depth: 2,
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
    role: 'wet',
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
    wants: { seasons: ['autumn'] },
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
    role: 'sheltered',
    depth: 3,
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
  }
}

/** What a pair of boots does to the odds of a trip going wrong. */
const BOOTS_MISHAP = 0.55
/** What a board does to the price of one more leg, on snow. */
const BOARD_PUSH = 0.5
/** How much further into the dark a lit torch can see, in legs. */
const TORCH_REACH = 1

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
}

/** The trip a piece of kit might turn up on: a day, and how the trip went. */
export interface KitDay extends Day {
  role: GroundRole
  /** How deep into the trip the pet got. */
  depth: number
}

/**
 * How often a trip that could turn up kit does. Rarer than a curio: there are
 * eight of these in the whole family's life, and each one is a small permanent
 * change to what the weather means.
 */
export const KIT_CHANCE = 0.14

/** Whether this trip is the kind of trip that turns this item up. */
function suits(item: KitItem, day: KitDay): boolean {
  if (item.night && !day.night) return false
  if (item.role && item.role !== day.role) return false
  if ((item.depth ?? 1) > day.depth) return false
  const wants = item.wants
  if (wants?.seasons && !wants.seasons.includes(day.season)) return false
  if (wants?.weather && !wants.weather.includes(day.weather)) return false
  return true
}

/**
 * Everything this trip could have turned up: what the day suits, less what the
 * family already has.
 *
 * The world hands you the tool at the moment you first wanted it -- the
 * umbrella turns up in the rain, the snowboard in snow, the torch on a trip
 * that set out after dark. Better than a lottery, and it is how the rest of the
 * game already reads the calendar.
 *
 * This is deliberately the only thing that decides what kit is reachable, and
 * deliberately one function: earning it rather than finding it means replacing
 * what is in here, and nothing else. Separate from the pick because an empty
 * pool must not cost a roll -- a day with no kit on it would otherwise shift
 * every other die the trip throws, and the trip throws them for the weather.
 */
export function kitPool(owned: KitId[], day: KitDay): KitItem[] {
  return KIT.filter((item) => !owned.includes(item.id) && suits(item, day))
}

/**
 * Which of them this trip actually turned up.
 *
 * Split from the pool rather than folded into it because an empty pool must
 * not cost a roll, and only the caller knows whether it has one to spend. The
 * pool has to be non-empty: there is nothing sensible to hand back otherwise,
 * and a null here would be a branch no trip can ever take.
 */
export function pickKit(pool: KitItem[], roll: number): KitItem {
  // A roll of exactly 1, or one nudged past it by floating point, would index
  // off the end -- as in `findCurio`, the last of the pool is the answer.
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))]!
}
