import {
  MATERIALS,
  SEASONS,
  type Material,
  type Season,
  type WeatherId,
} from '../data/seasons'
import { hexToLinear } from '../render/voxel-mesh'

/**
 * The world keeps its own clock, running far faster than real time, and derives
 * everything from the epoch — so it advances while the app is closed, is the
 * same for everyone, and needs nothing saved.
 *
 * Following the player's real clock was the obvious first move and the wrong
 * one: someone who only ever plays after work would only ever see night. A day
 * takes twenty-four minutes instead, one minute to the hour, so a few minutes
 * with the pet covers a visible stretch of sky and a single sitting can span
 * dawn to dusk.
 */
const DAY_MS = 24 * 60_000

/**
 * Deliberately not a whole number of days. On a round period the two lock in
 * phase: seasons would always turn over at the same hour, and with a year
 * shorter than a day a given hour could only ever fall in one season. Seventy
 * minutes is a little under three days, so the year drifts against the day.
 */
const SEASON_MS = 70 * 60_000
const YEAR_MS = SEASON_MS * SEASONS.length
/** In-world hours per day. */
const HOURS = 24
/** How long a spell of weather lasts. */
const WEATHER_MS = 18 * 60_000
/** Fraction of a season spent turning into the next one. */
const SEASON_FADE = 0.25

export type Rgb = [number, number, number]

export interface WorldState {
  /** 0..1 through the day, 0 at midnight. */
  dayPhase: number
  /** Local hour, for display. */
  hour: number
  /** -1 at the dead of night, 1 at noon. */
  sunHeight: number
  /** 0 at night, 1 in full daylight. */
  daylight: number
  season: Season
  nextSeason: Season
  seasonBlend: number
  weather: WeatherId
  /** Every material's colour for right now, already blended across seasons. */
  palette: Rgb[]
  sky: { top: Rgb; bottom: Rgb }
  haze: Rgb
  light: { direction: Rgb; colour: Rgb; intensity: number }
  ambient: { colour: Rgb; intensity: number }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
]

/** Deterministic 0..1 from an integer, for picking a spell of weather. */
function hash(n: number): number {
  let h = Math.imul(n | 0, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function pickWeather(season: Season, roll: number): WeatherId {
  const entries = Object.entries(season.weather) as [WeatherId, number][]
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let remaining = roll * total
  for (const [id, weight] of entries) {
    remaining -= weight
    if (remaining <= 0) return id
  }
  return 'clear'
}

/** How much the sky and light are dulled by the current weather. */
function overcast(weather: WeatherId): number {
  if (weather === 'rain') return 0.75
  if (weather === 'snow') return 0.6
  if (weather === 'mist') return 0.5
  return 0
}

const paletteCache = new Map<string, Rgb[]>()
function seasonPalette(season: Season): Rgb[] {
  let cached = paletteCache.get(season.id)
  if (!cached) {
    cached = MATERIALS.map((name: Material) => hexToLinear(season.palette[name]))
    paletteCache.set(season.id, cached)
  }
  return cached
}

interface SeasonPoint {
  season: Season
  nextSeason: Season
  blend: number
  daylightHours: number
}

function seasonAt(now: number): SeasonPoint {
  const yearPosition = ((now % YEAR_MS) + YEAR_MS) % YEAR_MS
  const index = Math.floor(yearPosition / SEASON_MS)
  const through = (yearPosition % SEASON_MS) / SEASON_MS
  const season = SEASONS[index % SEASONS.length]!
  const nextSeason = SEASONS[(index + 1) % SEASONS.length]!
  // Hold the season, then turn over at the end, so each one reads clearly
  // instead of everything sitting permanently half way between two.
  const blend = smoothstep(1 - SEASON_FADE, 1, through)
  return {
    season,
    nextSeason,
    blend,
    daylightHours: mix(season.daylightHours, nextSeason.daylightHours, blend),
  }
}

/** The hour on the world's own clock, 0 to 24. */
export function worldHour(now: number): number {
  const position = ((now % DAY_MS) + DAY_MS) % DAY_MS
  return (position / DAY_MS) * HOURS
}

function sunArc(hour: number, daylightHours: number): { arc: number; height: number } {
  const sunrise = 12 - daylightHours
  const sunset = 12 + daylightHours
  const arc = (Math.PI * (hour - sunrise)) / (sunset - sunrise)
  return { arc, height: Math.sin(arc) }
}

/**
 * Night is simply the sun being down, so what the game judges a bedtime against
 * is the same thing the player can see in the sky. It moves with the season,
 * too: winter nights are longer.
 */
export function isNight(now: number): boolean {
  const point = seasonAt(now)
  return sunArc(worldHour(now), point.daylightHours).height <= 0
}

export function worldAt(now: number): WorldState {
  // --- season -------------------------------------------------------------
  const { season, nextSeason, blend: seasonBlend, daylightHours } = seasonAt(now)

  // --- time of day --------------------------------------------------------
  const hour = worldHour(now)
  const { arc, height: sunHeight } = sunArc(hour, daylightHours)
  const daylight = smoothstep(-0.1, 0.3, sunHeight)

  // --- weather ------------------------------------------------------------
  const weather = pickWeather(season, hash(Math.floor(now / WEATHER_MS)))
  const dull = overcast(weather)

  // --- palette ------------------------------------------------------------
  const from = seasonPalette(season)
  const to = seasonPalette(nextSeason)
  const palette = from.map((colour, i) => mixRgb(colour, to[i]!, seasonBlend))

  // --- sky ----------------------------------------------------------------
  const dayTop = mixRgb(hexToLinear(season.daySky.top), hexToLinear(nextSeason.daySky.top), seasonBlend)
  const dayBottom = mixRgb(hexToLinear(season.daySky.bottom), hexToLinear(nextSeason.daySky.bottom), seasonBlend)
  const nightTop = mixRgb(hexToLinear(season.nightSky.top), hexToLinear(nextSeason.nightSky.top), seasonBlend)
  const nightBottom = mixRgb(hexToLinear(season.nightSky.bottom), hexToLinear(nextSeason.nightSky.bottom), seasonBlend)
  const duskTop = mixRgb(hexToLinear(season.duskSky.top), hexToLinear(nextSeason.duskSky.top), seasonBlend)
  const duskBottom = mixRgb(hexToLinear(season.duskSky.bottom), hexToLinear(nextSeason.duskSky.bottom), seasonBlend)

  // Dusk peaks as the sun crosses the horizon and fades away from it.
  const dusk = Math.max(0, 1 - Math.abs(sunHeight) * 3.2) * clamp01(1 - dull)
  let top = mixRgb(nightTop, dayTop, daylight)
  let bottom = mixRgb(nightBottom, dayBottom, daylight)
  top = mixRgb(top, duskTop, dusk * 0.8)
  bottom = mixRgb(bottom, duskBottom, dusk * 0.9)

  // Overcast pulls the sky toward flat grey and loses the gradient.
  if (dull > 0) {
    const grey: Rgb = [0.09 + 0.16 * daylight, 0.1 + 0.17 * daylight, 0.12 + 0.19 * daylight]
    top = mixRgb(top, grey, dull * 0.75)
    bottom = mixRgb(bottom, grey, dull * 0.85)
  }

  // --- light --------------------------------------------------------------
  // Always from above: a light coming from under the ground looks broken, so
  // the sun's arc drives its lateral swing and its height stays positive.
  const swing = Math.cos(arc)
  // Floored well above zero: a sun on the horizon lights vertical faces only,
  // and the ground goes almost black at dawn and dusk.
  const elevation = Math.max(0.45, Math.abs(sunHeight))
  const length = Math.hypot(swing * 0.85, elevation, 0.5)
  const direction: Rgb = [(-swing * 0.85) / length, elevation / length, 0.5 / length]

  const moonColour: Rgb = [0.42, 0.52, 0.85]
  const sunColour = mixRgb(hexToLinear(season.sunLight), hexToLinear(nextSeason.sunLight), seasonBlend)
  const warm: Rgb = [1.25, 0.72, 0.42]
  let colour = mixRgb(moonColour, sunColour, daylight)
  colour = mixRgb(colour, warm, dusk * 0.55)
  // Night keeps a usable floor: this is a pet you have to be able to see, so
  // the mood comes from the colour shifting cold rather than from darkness.
  const intensity = mix(0.5, 1.2, daylight) * mix(1, 0.45, dull)

  const ambientColour: Rgb = mixRgb([0.28, 0.36, 0.62], [0.55, 0.62, 0.78], daylight)
  const ambient = {
    colour: ambientColour,
    // Overcast skies light the shadows: less key, more fill.
    intensity: mix(0.4, 0.5, daylight) * mix(1, 1.35, dull),
  }

  return {
    dayPhase: hour / HOURS,
    hour,
    sunHeight,
    daylight,
    season,
    nextSeason,
    seasonBlend,
    weather,
    palette,
    sky: { top, bottom },
    haze: mixRgb(bottom, top, 0.35),
    light: { direction, colour, intensity },
    ambient,
  }
}
