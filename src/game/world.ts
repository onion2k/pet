import {
  MATERIALS,
  SEASONS,
  type Material,
  type Season,
  type WeatherId,
} from '../data/seasons'
import { hexToLinear } from '../render/voxel-mesh'

/**
 * Time of day and season both come from the wall clock, so they advance while
 * the app is closed and need nothing saved. The day follows the player's own
 * local clock — the pet's world is dark when theirs is — while the year runs on
 * a much shorter loop so a season change is something you actually see.
 */
/**
 * Deliberately not a divisor of the 24-hour day. A round period — an hour a
 * season, four hours a year — locks in phase with the clock, so a given time of
 * day would always fall in the same season and you could never see a summer
 * noon if summer landed on your nights. 47 minutes drifts the year against the
 * day by about two thirds of a year daily.
 */
const SEASON_MS = 47 * 60_000
const YEAR_MS = SEASON_MS * SEASONS.length
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

export function worldAt(now: number): WorldState {
  // --- season -------------------------------------------------------------
  const yearPosition = ((now % YEAR_MS) + YEAR_MS) % YEAR_MS
  const index = Math.floor(yearPosition / SEASON_MS)
  const through = (yearPosition % SEASON_MS) / SEASON_MS
  const season = SEASONS[index % SEASONS.length]!
  const nextSeason = SEASONS[(index + 1) % SEASONS.length]!
  // Hold the season, then turn over at the end, so each one reads clearly
  // instead of everything sitting permanently half way between two.
  const seasonBlend = smoothstep(1 - SEASON_FADE, 1, through)

  const daylightHours = mix(season.daylightHours, nextSeason.daylightHours, seasonBlend)

  // --- time of day --------------------------------------------------------
  const date = new Date(now)
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const sunrise = 12 - daylightHours
  const sunset = 12 + daylightHours
  const arc = (Math.PI * (hour - sunrise)) / (sunset - sunrise)
  const sunHeight = Math.sin(arc)
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
    dayPhase: hour / 24,
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
