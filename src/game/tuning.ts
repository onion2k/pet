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
} as const

/** Stat change per real hour, awake. Negative drains. */
export const DECAY_AWAKE = {
  hunger: -12,
  happiness: -8,
  energy: -10,
  hygiene: -6,
} as const

/** Stat change per real hour, asleep. Sleeping is how energy comes back. */
export const DECAY_ASLEEP = {
  hunger: -4,
  happiness: -2,
  energy: 25,
  hygiene: -3,
} as const

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

/** Local hours in which sleeping counts as on time. */
export const NIGHT_START_HOUR = 21
export const NIGHT_END_HOUR = 7
