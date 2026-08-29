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
  'lampPost',
  'lampGlow',
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
  l: 'lampPost',
  g: 'lampGlow',
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
      surfaceA: '#8ade60',
      surfaceB: '#72c44b',
      soil: '#8a6242',
      rock: '#6b655c',
      rockLight: '#8c8478',
      foliageDark: '#3aa25c',
      foliageLight: '#a8f27f',
      wood: '#6b5334',
      flower: '#ffd9ec',
      roof: '#a8523a',
      interior: '#3f3227',
      lampPost: '#4a3b2c',
      lampGlow: '#ffc44f',
    },
    daySky: { top: '#4f95e2', bottom: '#c2e7f8' },
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
      surfaceA: '#7ed44d',
      surfaceB: '#66bd3e',
      soil: '#8f6845',
      rock: '#736c62',
      rockLight: '#968d80',
      foliageDark: '#329150',
      foliageLight: '#96e468',
      wood: '#6b5334',
      flower: '#ffe27a',
      roof: '#b2573d',
      interior: '#40332a',
      lampPost: '#4a3b2c',
      lampGlow: '#ffcf5e',
    },
    daySky: { top: '#3f8ee8', bottom: '#d2f0ff' },
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
      surfaceA: '#c2a94b',
      surfaceB: '#a3893c',
      soil: '#7a5638',
      rock: '#6e675d',
      rockLight: '#8a8175',
      foliageDark: '#a45c2c',
      foliageLight: '#eda94b',
      wood: '#5e4a2f',
      flower: '#e8a23c',
      roof: '#94472f',
      interior: '#372b22',
      lampPost: '#43362a',
      lampGlow: '#ffb63c',
    },
    daySky: { top: '#5c8bc4', bottom: '#dcd4b9' },
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
      surfaceA: '#c8d5dd',
      surfaceB: '#aebdc7',
      soil: '#6b5a4c',
      rock: '#7a7d76',
      rockLight: '#9aa0a4',
      foliageDark: '#3d5a48',
      foliageLight: '#7d9c80',
      wood: '#544335',
      flower: '#dfe8ef',
      roof: '#8a4535',
      interior: '#33291f',
      lampPost: '#3d3227',
      lampGlow: '#ffd070',
    },
    daySky: { top: '#6d90b6', bottom: '#e0ebf2' },
    nightSky: { top: '#080d1f', bottom: '#141c33' },
    duskSky: { top: '#3d3f66', bottom: '#d19a86' },
    sunLight: '#e8eeff',
    daylightHours: 4.4,
    weather: { clear: 3, snow: 5, mist: 2 },
    snowCover: 1,
  },
]

export const SEASON_BY_ID = new Map(SEASONS.map((s) => [s.id, s]))
