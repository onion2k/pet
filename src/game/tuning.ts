/** Every balance number lives here so the game can be retuned without hunting. */

/** Multiplies all elapsed time. Raise it to fast-forward a playtest. */
export const TIME_SCALE = 1

const MIN = 60_000
const HOUR = 60 * MIN

/** How long each stage lasts before the pet is eligible to evolve. */
export const STAGE_DURATION = {
  egg: 45_000,
  baby: 20 * MIN,
  child: 2 * HOUR,
  /**
   * How long a grown pet must be kept before it can become an elder. Long on
   * purpose: it is the one thing in the game that retiring and starting again
   * cannot get you, so it has to cost the time it is worth.
   */
  adult: 3 * HOUR,
} as const

/** Stat change per real hour, awake. Negative drains. */
export const DECAY_AWAKE = {
  hunger: -12,
  happiness: -8,
  energy: -10,
  hygiene: -6,
} as const

/**
 * Stat change per real hour, asleep. A sleeping pet's metabolism slows right
 * down rather than easing off a little: it barely burns anything, so a night in
 * bed is rest rather than something to be recovered from in the morning.
 * Happiness climbs, because sleeping well is one of the things that contents a
 * pet -- and because the pet is not lonely while it is dreaming.
 */
export const DECAY_ASLEEP = {
  hunger: -2.5,
  happiness: 2,
  energy: 25,
  hygiene: -1,
} as const

/**
 * What a night by a banked fire costs, against an ordinary one. Kindling is the
 * adult's own doing -- it walks out and fetches it -- so a well-provisioned pet
 * wakes up in better shape than one that was simply put to bed.
 */
export const WARM_NIGHT = 0.4

/** Health recovers when everything else is comfortable, and erodes when it isn't. */
export const HEALTH_RECOVER_PER_HOUR = 6
export const HEALTH_DAMAGE_PER_HOUR = 9
/** The pet can never die, so health stops here. */
export const HEALTH_FLOOR = 8

/** A stat at or below this counts as neglected. */
export const CRITICAL = 15
/** Every stat above this counts as thriving. */
export const COMFORTABLE = 60
/** Health below this makes the pet visibly sick. */
export const SICK_THRESHOLD = 35
/** Health must climb back above this to shake off sickness. */
export const RECOVERED_THRESHOLD = 55

/** Offline catch-up is simulated in chunks so decay curves stay honest. */
export const CATCHUP_CHUNK_MS = 5 * MIN
/** Safety valve: never simulate more than this many chunks in one reconcile. */
export const MAX_CATCHUP_CHUNKS = 4032

/**
 * How long an absence runs at the live rate before the pet starts pacing
 * itself. The first stretch away should feel exactly like the stretch before
 * it -- the pet is simply carrying on without you.
 */
export const AWAY_FULL_RATE_MS = 3 * HOUR
/**
 * What every hour after that costs, as a fraction of the live rate. A pet left
 * overnight or over a weekend should be sorry about it, not ruined by it: the
 * game is meant to survive a night's sleep and a couple of days off.
 */
export const AWAY_SLOW_PACE = 0.3
/**
 * Offline decay can carry a stat down to here and no further. Below CRITICAL,
 * so a neglected pet still reads as needing you the moment you open the lid --
 * it just isn't at rock bottom.
 */
export const AWAY_FLOOR = 10
/** The same mercy for health, kept above SICK_THRESHOLD's recovery range. */
export const AWAY_HEALTH_FLOOR = 25

/** Night is the sun being down; see `world.isNight`. */
