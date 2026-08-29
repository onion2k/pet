/**
 * Materials the world is painted from. Terrain and props store an index rather
 * than a colour, so the whole scene can be repainted for the season without
 * rebuilding any geometry.
 */
export const MATERIALS = [
  'surfaceA',
  'surfaceB',
  'soil',
  'rock',
  'rockLight',
  'foliageDark',
  'foliageLight',
  'wood',
  'flower',
  'roof',
  'interior',
] as const
export type Material = (typeof MATERIALS)[number]

export const MATERIAL_INDEX = Object.fromEntries(
  MATERIALS.map((name, i) => [name, i]),
) as Record<Material, number>

/** Prop palette characters mapped onto materials. */
export const PROP_MATERIAL: Record<string, Material> = {
  s: 'rock',
  t: 'rockLight',
  f: 'foliageDark',
  e: 'foliageLight',
  w: 'wood',
  p: 'flower',
  r: 'roof',
  n: 'interior',
}

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'
export type WeatherId = 'clear' | 'rain' | 'snow' | 'mist'

export interface Season {
  id: SeasonId
  name: string
  palette: Record<Material, string>
  /** Sky at midday and at midnight. */
  daySky: { top: string; bottom: string }
  nightSky: { top: string; bottom: string }
  /** Warm cast across sunrise and sunset. */
  duskSky: { top: string; bottom: string }
  /** Colour of the sun's light at midday. */
  sunLight: string
  /** Hours of daylight either side of noon; winter days are short. */
  daylightHours: number
  /** Relative likelihood of each kind of weather. */
  weather: Partial<Record<WeatherId, number>>
  /** How much of the ground the weather leaves covered, for snow. */
  snowCover: number
}

export const SEASONS: Season[] = [
  {
    id: 'spring',
    name: 'Spring',
    palette: {
      surfaceA: '#74c94e',
      surfaceB: '#5fb03d',
      soil: '#8a6242',
      rock: '#6b655c',
      rockLight: '#8c8478',
      foliageDark: '#2f8d4e',
      foliageLight: '#96e86f',
      wood: '#6b5334',
      flower: '#ffd9ec',
      roof: '#a8523a',
      interior: '#3f3227',
    },
    daySky: { top: '#3f7fd0', bottom: '#a8d4ee' },
    nightSky: { top: '#0d1430', bottom: '#1b2547' },
    duskSky: { top: '#3a4a86', bottom: '#f0a875' },
    sunLight: '#fff3d8',
    daylightHours: 6.4,
    weather: { clear: 5, rain: 3, mist: 1 },
    snowCover: 0,
  },
  {
    id: 'summer',
    name: 'Summer',
    palette: {
      surfaceA: '#63b93f',
      surfaceB: '#4d9c31',
      soil: '#8f6845',
      rock: '#736c62',
      rockLight: '#968d80',
      foliageDark: '#25793d',
      foliageLight: '#7fd455',
      wood: '#6b5334',
      flower: '#ffe27a',
      roof: '#b2573d',
      interior: '#40332a',
    },
    daySky: { top: '#2f78d8', bottom: '#bfe2f5' },
    nightSky: { top: '#101a3a', bottom: '#20305c' },
    duskSky: { top: '#4a4a90', bottom: '#ffb877' },
    sunLight: '#fff6dd',
    daylightHours: 7.6,
    weather: { clear: 8, rain: 2, mist: 1 },
    snowCover: 0,
  },
  {
    id: 'autumn',
    name: 'Autumn',
    palette: {
      surfaceA: '#a08b3c',
      surfaceB: '#856f2f',
      soil: '#7a5638',
      rock: '#6e675d',
      rockLight: '#8a8175',
      foliageDark: '#8a4a22',
      foliageLight: '#d8933a',
      wood: '#5e4a2f',
      flower: '#e8a23c',
      roof: '#94472f',
      interior: '#372b22',
    },
    daySky: { top: '#4a76ad', bottom: '#c8bfa4' },
    nightSky: { top: '#0c1128', bottom: '#1a2038' },
    duskSky: { top: '#4a3f72', bottom: '#e8925c' },
    sunLight: '#ffe6b8',
    daylightHours: 5.6,
    weather: { clear: 4, rain: 4, mist: 3 },
    snowCover: 0,
  },
  {
    id: 'winter',
    name: 'Winter',
    palette: {
      surfaceA: '#b7c3cb',
      surfaceB: '#9dabb5',
      soil: '#6b5a4c',
      rock: '#7a7d76',
      rockLight: '#9aa0a4',
      foliageDark: '#3d5a48',
      foliageLight: '#6d8a70',
      wood: '#544335',
      flower: '#dfe8ef',
      roof: '#8a4535',
      interior: '#33291f',
    },
    daySky: { top: '#5a7ba0', bottom: '#d3dee6' },
    nightSky: { top: '#080d1f', bottom: '#141c33' },
    duskSky: { top: '#3d3f66', bottom: '#d19a86' },
    sunLight: '#e8eeff',
    daylightHours: 4.4,
    weather: { clear: 3, snow: 5, mist: 2 },
    snowCover: 1,
  },
]

export const SEASON_BY_ID = new Map(SEASONS.map((s) => [s.id, s]))
