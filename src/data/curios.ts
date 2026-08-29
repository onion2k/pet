import type { SeasonId, WeatherId } from './seasons'

/**
 * Small treasures the pet finds while the app is closed. Most are seasonal, a
 * few need particular weather, so the collection can only be completed by
 * coming back at different times — scarcity the world's clock provides for
 * free.
 */
export interface Curio {
  id: string
  name: string
  /** Seasons it can be found in; absent means any. */
  seasons?: SeasonId[]
  /** Weather it needs; absent means any. */
  weather?: WeatherId[]
  weight: number
  /** 8x8 artwork for the collection board, in the same format as the menu icons. */
  glyph: string
  /** What it looks like once found. Unfound ones are drawn as a flat silhouette. */
  colour: string
}

export const CURIOS: Curio[] = [
  { id: 'pebble', name: 'Smooth pebble', weight: 5, glyph: '......../......../..####../.######./########/.######./......../........', colour: '#9aa3bb' },
  { id: 'feather', name: 'Stray feather', weight: 4, glyph: '.......#/......##/.....##./..#.##../.#####../.####.../.##...../#.......', colour: '#d9d2b6' },
  { id: 'blossom', name: 'Blossom', seasons: ['spring'], weight: 4, glyph: '..#..#../.##..##./.######./.######./..####../...##.../...##.../...##...', colour: '#f2a0c4' },
  { id: 'sunpetal', name: 'Sunpetal', seasons: ['summer'], weight: 4, glyph: '...##.../.#.##.#./..####../##.##.##/..####../.#.##.#./...##.../........', colour: '#f6c453' },
  { id: 'toadstool', name: 'Toadstool', seasons: ['autumn'], weight: 4, glyph: '..####../.######./########/########/...##.../...##.../...##.../........', colour: '#e2604f' },
  { id: 'snowdrop', name: 'Snowdrop', seasons: ['winter'], weight: 4, glyph: '...#..../.#.#.#../..###.../#######./..###.../.#.#.#../...#..../........', colour: '#bfe6ff' },
  { id: 'dewdrop', name: 'Perfect dewdrop', weather: ['rain', 'mist'], weight: 3, glyph: '...##.../...##.../..####../.######./########/########/.######./..####..', colour: '#7fd8e8' },
  { id: 'geode', name: 'Tiny geode', weight: 1, glyph: '......../.######./#.#..#.#/##....##/.#....#./..#..#../...##.../........', colour: '#b48ce8' },
]

export const CURIO_COUNT = CURIOS.length

export function curioById(id: string): Curio | undefined {
  return CURIOS.find((c) => c.id === id)
}

/** Picks what the pet found, given the world it found it in. Null on no luck. */
export function findCurio(season: SeasonId, weather: WeatherId, roll: number): Curio | null {
  const pool = CURIOS.filter(
    (c) => (!c.seasons || c.seasons.includes(season)) && (!c.weather || c.weather.includes(weather)),
  )
  const total = pool.reduce((sum, c) => sum + c.weight, 0)
  if (total <= 0) return null
  let remaining = roll * total
  for (const curio of pool) {
    remaining -= curio.weight
    if (remaining <= 0) return curio
  }
  return pool[pool.length - 1] ?? null
}
