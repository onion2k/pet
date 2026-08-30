import { blend, pick } from './voice'
import type { GroundRole } from './grounds'
import type { SeasonId, WeatherId } from './seasons'

/**
 * What the pet did while it was out of sight. A forage used to be ten seconds
 * of black screen; it is told instead, in three beats -- setting out, the
 * middle of it, and the way home -- so the trip reads as having happened
 * somewhere rather than having been rolled.
 *
 * Narration, not speech: these are third person and lower case, like the
 * visitors' arrival lines, and the screen shouts them. The pet's own voice
 * lives in `voice.ts` and stays first person.
 */

/** Which part of the trip a beat belongs to. */
export type Leg = 'out' | 'middle' | 'home'

export interface JourneyContext {
  /** Which of the four jobs the ground does. Its lines are written per role. */
  role: GroundRole
  /** The ground itself, lower case, to slot into the role's lines. */
  place: string
  season: SeasonId
  weather: WeatherId
  night: boolean
  speciesId: string
}

const OUT = [
  'sets off up the lane',
  'takes the path past the wall',
  'heads for the far hedgerow',
  'goes off with its nose down',
  'picks a direction and commits',
]

const MIDDLE = [
  'stops to look at something',
  'follows a stream for a while',
  'digs at a promising root',
  'startles a beetle, and itself',
  'sits down to think it over',
  'gets thoroughly distracted',
  'turns over a likely stone',
]

const HOME = [
  'takes the long way home',
  'comes back over the hill',
  'trots home before the light goes',
  'is on its way back',
]

const BY_LEG: Record<Leg, string[]> = { out: OUT, middle: MIDDLE, home: HOME }

/**
 * Where it actually went. The role's own lines replace the generic pool rather
 * than joining it, so a trip to a wet ground always reads as a wet trip --
 * having chosen where to send it, the player should be told it went.
 *
 * These are written per role rather than per ground so that a new biome costs
 * four names rather than a fresh set of journey lines. `{place}` is filled with
 * the ground's own, which is what keeps the creek and the streambed distinct
 * where it matters: at the moment the pet sets off for one of them.
 */
const BY_ROLE: Record<GroundRole, Partial<Record<Leg, string[]>>> = {
  near: {
    out: ['goes no further than {place}', 'ambles down to {place}'],
    middle: ['works along the foot of it', 'pokes about in the loose stones'],
    home: ['is back before you can miss it', 'wanders home the short way'],
  },
  wet: {
    out: ['heads down to {place}', 'follows the water downhill'],
    middle: ['wades in up to its knees', 'turns over the wet stones'],
    home: ['comes up dripping from the water', 'squelches back up the bank'],
  },
  sheltered: {
    out: ['drops down into {place}', 'picks its way into {place}'],
    middle: ['rummages under the leaf mould', 'goes where the light does not'],
    home: ['climbs back out into the open', 'comes up out of the dark'],
  },
  far: {
    out: ['starts the long climb to {place}', 'sets off for {place}'],
    middle: ['stops at the top to look at it all', 'follows the ridge a good way'],
    home: ['comes down at a trot', 'freewheels most of the way home'],
  },
}

/**
 * The world it walked through, which is the whole point of telling the trip.
 * Weather and season lines are added to the pool rather than replacing it, so a
 * rainy trip can still be an ordinary one.
 */
const BY_WEATHER: Record<Leg, Partial<Record<WeatherId, string[]>>> = {
  out: {
    rain: ['sets off into the drizzle'],
    snow: ['crunches away through the snow'],
    mist: ['disappears into the mist'],
  },
  middle: {
    rain: ['shakes itself off, twice'],
    snow: ['sinks in up to its middle'],
    mist: ['loses the path for a minute'],
  },
  home: {
    rain: ['squelches home'],
    snow: ['leaves a line of prints home'],
    mist: ['looms out of the mist again'],
  },
}

const BY_SEASON: Partial<Record<SeasonId, string[]>> = {
  spring: ['wades through the new nettles'],
  summer: ['shelters from the sun a while'],
  autumn: ['kicks through the leaf litter'],
  winter: ['follows prints that are not its own'],
}

const AT_NIGHT: Record<Leg, string[]> = {
  out: ['sets off into the dark'],
  middle: ['follows a light it cannot name'],
  home: ['finds its way back by the lamps'],
}

/**
 * How each grown form goes about it. Species packs only colour the middle beat
 * -- the interesting one -- so character shows without every trip sounding the
 * same for a given pet.
 */
const PACKS: Record<string, string[]> = {
  blob: ['falls over. gets up. carries on'],
  pudge: ['eats something it should not have'],
  spike: ['picks a fight with a thistle'],
  sprout: ['stops to greet every plant'],
  mochi: ['finds a sunny spot and stays there'],
  gloop: ['leaves a faint trail behind it'],
  blaze: ['takes the steepest way, of course'],
  grump: ['sighs at the state of the path'],
  verdant: ['sits among the ferns a long while'],
  lumen: ['is easy to follow in the dark'],
  aurora: ['walks where the frost has not gone'],
  warden: ['checks the boundary as it goes'],
  zephyrix: ['is over the ridge and back again'],
  somnix: ['dozes off against a warm rock'],
}

/** One beat of a trip, drawn from the leg, the ground, and the day it happened on. */
export function beat(leg: Leg, ctx: JourneyContext): string {
  // A role with no lines for this leg -- and any role a save names that this
  // build does not know -- falls back to the shared pool rather than throwing.
  // The trip is still told; it just does not name the place.
  const role = BY_ROLE[ctx.role]?.[leg]
  const pool = [...(role ?? BY_LEG[leg])]
  pool.push(...(BY_WEATHER[leg][ctx.weather] ?? []))
  if (ctx.night) pool.push(...AT_NIGHT[leg])
  if (leg === 'middle') pool.push(...(BY_SEASON[ctx.season] ?? []))
  const line = leg === 'middle' ? blend(pool, PACKS[ctx.speciesId]) : pick(pool)
  return line.replace('{place}', ctx.place)
}
