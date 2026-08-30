import type { SeasonId, WeatherId } from './seasons'

/**
 * Small treasures the pet finds while the app is closed. Most are seasonal, a
 * few need particular weather, so the collection can only be completed by
 * coming back at different times — scarcity the world's clock provides for
 * free.
 */
/**
 * The three sets the board is grouped into. Completing one is a standing reward
 * rather than a one-off, and every one of them makes the pet better at the job
 * that fills the board -- so a collection is something the player uses, not a
 * shelf they look at.
 */
export type CurioSet = 'stones' | 'blooms' | 'weather'

export const CURIO_SETS: { id: CurioSet; name: string; boon: string }[] = [
  { id: 'stones', name: 'Stones', boon: 'surer footed' },
  { id: 'blooms', name: 'Blooms', boon: 'sharper eyed' },
  { id: 'weather', name: 'Weather', boon: 'reads the sky' },
]

export interface Curio {
  id: string
  name: string
  /** Which set it belongs to. */
  set: CurioSet
  /** Seasons it can be found in; absent means any. */
  seasons?: SeasonId[]
  /** Weather it needs; absent means any. */
  weather?: WeatherId[]
  weight: number
  /**
   * How deep into a trip it can turn up: the number of legs the pet must have
   * walked. Absent means anywhere. The rarest things are out past the point
   * where a sensible player would have called the pet home.
   */
  depth?: number
  /** 8x8 artwork for the collection board, in the same format as the menu icons. */
  glyph: string
  /** What it looks like once found. Unfound ones are drawn as a flat silhouette. */
  colour: string
}

export const CURIOS: Curio[] = [
  { id: 'pebble', name: 'Smooth pebble', set: 'stones', weight: 5, glyph: '......../......../..####../.######./########/.######./......../........', colour: '#9aa3bb' },
  { id: 'feather', name: 'Stray feather', set: 'weather', weight: 4, glyph: '.......#/......##/.....##./..#.##../.#####../.####.../.##...../#.......', colour: '#d9d2b6' },
  { id: 'blossom', name: 'Blossom', set: 'blooms', seasons: ['spring'], weight: 4, glyph: '..#..#../.##..##./.######./.######./..####../...##.../...##.../...##...', colour: '#f2a0c4' },
  { id: 'sunpetal', name: 'Sunpetal', set: 'blooms', seasons: ['summer'], weight: 4, glyph: '...##.../.#.##.#./..####../##.##.##/..####../.#.##.#./...##.../........', colour: '#f6c453' },
  { id: 'toadstool', name: 'Toadstool', set: 'blooms', seasons: ['autumn'], weight: 4, glyph: '..####../.######./########/########/...##.../...##.../...##.../........', colour: '#e2604f' },
  { id: 'snowdrop', name: 'Snowdrop', set: 'blooms', seasons: ['winter'], weight: 4, glyph: '...#..../.#.#.#../..###.../#######./..###.../.#.#.#../...#..../........', colour: '#bfe6ff' },
  { id: 'dewdrop', name: 'Perfect dewdrop', set: 'weather', weather: ['rain', 'mist'], weight: 3, glyph: '...##.../...##.../..####../.######./########/########/.######./..####..', colour: '#7fd8e8' },
  { id: 'geode', name: 'Tiny geode', set: 'stones', weight: 3, depth: 3, glyph: '......../.######./#.#..#.#/##....##/.#....#./..#..#../...##.../........', colour: '#b48ce8' },
]

export const CURIO_COUNT = CURIOS.length

export function curioById(id: string): Curio | undefined {
  return CURIOS.find((c) => c.id === id)
}

/** Curios that turn up anywhere, for the odd thing found while the app is shut. */
export const COMMON_CURIOS = CURIOS.filter((c) => !c.seasons && !c.weather && !c.depth)

/** How much likelier a ground's own curios are than the rest of its pool. */
const FAVOUR_BIAS = 3

/**
 * Picks what the pet found, given the world it found it in, and optionally the
 * ground it was looking on -- which weights its own curios up rather than
 * narrowing the pool, so a creek can still turn up a stray feather.
 */
export function findCurio(
  season: SeasonId,
  weather: WeatherId,
  roll: number,
  favours: string[] = [],
  depth = 1,
): Curio | null {
  const pool = CURIOS.filter(
    (c) =>
      (!c.seasons || c.seasons.includes(season)) &&
      (!c.weather || c.weather.includes(weather)) &&
      (c.depth ?? 1) <= depth,
  )
  const weigh = (c: Curio) => c.weight * (favours.includes(c.id) ? FAVOUR_BIAS : 1)
  const total = pool.reduce((sum, c) => sum + weigh(c), 0)
  if (total <= 0) return null
  let remaining = roll * total
  for (const curio of pool) {
    remaining -= weigh(curio)
    if (remaining <= 0) return curio
  }
  // A roll of exactly 1, or one nudged past it by floating point, walks off the
  // end of the running total. The pool cannot be empty here -- a positive total
  // requires at least one entry -- so the last of it is the answer.
  return pool[pool.length - 1]!
}

/** Which sets are complete, given what the lineage has found. */
export function completedSets(counts: Record<string, number>): CurioSet[] {
  return CURIO_SETS.filter((set) =>
    CURIOS.every((c) => c.set !== set.id || (counts[c.id] ?? 0) > 0),
  ).map((set) => set.id)
}

/** How many duplicates a trade costs. Three of a thing for one of another. */
export const TRADE_COST = 3

/**
 * What three spares are worth: the rarest thing still missing from the board.
 * Trading is how a season you keep missing stops being a wall -- the year comes
 * round slowly, and a shelf of spare pebbles should be able to buy a snowdrop.
 */
export function tradeTarget(counts: Record<string, number>): Curio | null {
  const missing = CURIOS.filter((c) => !counts[c.id])
  if (missing.length === 0) return null
  return missing.reduce((rarest, c) => (c.weight < rarest.weight ? c : rarest))
}
