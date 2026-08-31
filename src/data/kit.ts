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
  | 'creel'
  | 'spyglass'

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
    id: 'creel',
    name: 'Creel',
    what: 'a creel',
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
    id: 'spyglass',
    name: 'Spyglass',
    what: 'a spyglass',
    note: 'For seeing what is coming.',
    role: 'far',
    depth: 3,
    colour: '#c9a227',
    glyph: art(
      '........',
      '.....###',
      '..#.####',
      '###.####',
      '###.####',
      '..#.####',
      '.....###',
      '........',
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

/** The trip a piece of kit might turn up on. */
export interface KitDay {
  season: SeasonId
  weather: WeatherId
  night: boolean
  role: GroundRole
  /** How many legs the pet walked. */
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
