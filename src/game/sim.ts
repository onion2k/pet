import { temperamentOf } from './temperament'
import type { PetState, Stats, StatKey } from './types'
import {
  AWAY_FLOOR,
  AWAY_FULL_RATE_MS,
  AWAY_HEALTH_FLOOR,
  AWAY_SLOW_PACE,
  CATCHUP_CHUNK_MS,
  COMFORTABLE,
  CRITICAL,
  DECAY_ASLEEP,
  DECAY_AWAKE,
  HEALTH_DAMAGE_PER_HOUR,
  HEALTH_FLOOR,
  HEALTH_RECOVER_PER_HOUR,
  MAX_CATCHUP_CHUNKS,
  RECOVERED_THRESHOLD,
  SICK_THRESHOLD,
  TIME_SCALE,
  WARM_NIGHT,
} from './tuning'

const HOUR = 3_600_000

/**
 * Whether the world's sun is up at a given moment. Passed in rather than
 * imported so the simulation stays about the pet's biology and knows nothing
 * about skies, seasons or rendering.
 */
export type Daylight = (at: number) => boolean

/** A pet that is being carried through a night by the sleep skip never wakes. */
const NEVER = () => false

export const STAT_KEYS: StatKey[] = ['hunger', 'happiness', 'energy', 'hygiene', 'health']
/** Health is tracked separately because it reacts to the others rather than draining on its own. */
const DRAINING_KEYS = ['hunger', 'happiness', 'energy', 'hygiene'] as const

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/**
 * How fast each stat drains for this pet in particular. A grown pet's
 * temperament shifts what it costs to keep: a lively one burns through its
 * spirits and its energy, a restful one holds both, a devoted one frets when
 * left. Multipliers rather than offsets, so the shape of the day is unchanged
 * and only its slope differs.
 */
function decayBias(pet: PetState): Record<(typeof DRAINING_KEYS)[number], number> {
  const flat = { hunger: 1, happiness: 1, energy: 1, hygiene: 1 }
  switch (temperamentOf(pet)?.id) {
    case 'lively':
      return { ...flat, happiness: 1.35, energy: 1.3, hunger: 1.15 }
    case 'restful':
      return { ...flat, energy: 0.7, happiness: 0.85 }
    case 'devoted':
      return { ...flat, happiness: 1.2, hygiene: 0.85 }
    default:
      return flat
  }
}

/** Stats other than health, which has its own floor. */
function clampStats(stats: Stats): void {
  for (const key of DRAINING_KEYS) stats[key] = clamp(stats[key], 0, 100)
  stats.health = clamp(stats.health, HEALTH_FLOOR, 100)
}

/**
 * Advance one pet by `elapsedMs` of wall-clock time. Called both for live frames
 * and, in chunks, for catching up on time spent with the app closed.
 *
 * `pace` scales how much of that time the pet's body actually feels; the
 * offline catch-up winds it down over a long absence. Age is deliberately left
 * out of it -- the pet grows at wall-clock speed however slowly it is living.
 */
function step(
  pet: PetState,
  elapsedMs: number,
  at: number,
  isDay: Daylight,
  age = true,
  pace = 1,
): void {
  const hours = (elapsedMs * TIME_SCALE * pace) / HOUR
  const seconds = (elapsedMs * TIME_SCALE * pace) / 1000
  const rates = pet.asleep ? DECAY_ASLEEP : DECAY_AWAKE
  const { stats } = pet

  // The egg has no metabolism — it just waits to hatch.
  if (pet.stage !== 'egg') {
    const bias = decayBias(pet)
    // A fire banked for the night slows what the night takes. It does nothing
    // for the rest that sleep already gives, only for what it costs.
    const warmth = pet.asleep && pet.warm ? WARM_NIGHT : 1
    for (const key of DRAINING_KEYS) {
      const rate = rates[key]
      stats[key] += rate * hours * bias[key] * (rate < 0 ? warmth : 1)
    }
  }
  clampStats(stats)

  const starving = stats.hunger <= CRITICAL
  const filthy = stats.hygiene <= CRITICAL
  const miserable = stats.happiness <= CRITICAL
  const exhausted = stats.energy <= CRITICAL
  const suffering = starving || filthy || miserable || exhausted

  if (pet.stage !== 'egg') {
    stats.health += suffering
      ? -HEALTH_DAMAGE_PER_HOUR * hours
      : HEALTH_RECOVER_PER_HOUR * hours
    clampStats(stats)
  }

  // Sickness has hysteresis so the pet doesn't flicker in and out of it.
  if (!pet.sick && stats.health <= SICK_THRESHOLD) {
    pet.sick = true
    pet.care.sicknessCount += 1
  } else if (pet.sick && stats.health >= RECOVERED_THRESHOLD) {
    pet.sick = false
  }

  // How the pet was raised is a record of the time you were there for, plus the
  // first few hours of any absence. Past that the counters stop: a weekend away
  // still tells on the pet's condition, but it is not held against its
  // upbringing, and it cannot swamp a lifetime of care in one night.
  if (pace >= 1) {
    if (suffering) pet.care.neglectSeconds += seconds
    else if (DRAINING_KEYS.every((k) => stats[k] >= COMFORTABLE)) {
      pet.care.thrivingSeconds += seconds
    }
    if (exhausted && !pet.asleep) pet.sleep.overtiredSeconds += seconds
  }

  if (age) pet.ageMs += elapsedMs * TIME_SCALE
  // A sleeping pet wakes itself once it is rested and the sun is up — sleeping
  // off a full night should end at dawn, not in the small hours.
  if (pet.asleep && stats.energy >= 100 && isDay(at)) {
    pet.asleep = false
    pet.warm = false
  }
}

/**
 * Applies a stretch of sleep to the pet's condition without advancing its age.
 *
 * Used by the sleep time-skip: the night passes for the pet's body but not for
 * its development. Ageing it too would let a single sleep carry a hatchling
 * clean through to adult, since a whole stage is shorter than a night.
 */
export function sleepThrough(pet: PetState, hours: number): void {
  step(pet, (hours * HOUR) / TIME_SCALE, 0, NEVER, false)
}

/**
 * Softens an offline chunk. A stat may fall to the away floor and no further,
 * but is never lifted above where the chunk found it -- so this cushions an
 * absence without ever handing back stats the pet had already spent.
 */
function cushion(stats: Stats, before: Stats): void {
  for (const key of DRAINING_KEYS) {
    stats[key] = Math.max(stats[key], Math.min(before[key], AWAY_FLOOR))
  }
  stats.health = Math.max(stats.health, Math.min(before.health, AWAY_HEALTH_FLOOR))
}

/** How much of the away time actually got simulated, for the welcome-back message. */
export interface CatchUp {
  awayMs: number
  simulatedMs: number
  truncated: boolean
}

/**
 * Bring a loaded pet up to `now`, simulating the gap in fixed chunks so long
 * absences follow the same curves a live session would.
 */
export function reconcile(pet: PetState, now: number, isDay: Daylight): CatchUp {
  const awayMs = Math.max(0, now - pet.lastTick)
  const wanted = Math.ceil(awayMs / CATCHUP_CHUNK_MS)
  const chunks = Math.min(wanted, MAX_CATCHUP_CHUNKS)

  let simulated = 0
  for (let i = 0; i < chunks; i++) {
    const slice = Math.min(CATCHUP_CHUNK_MS, awayMs - simulated)
    // The first hours away are lived at full rate; after that the pet paces
    // itself, so being gone overnight is a setback rather than a disaster.
    const pace = simulated < AWAY_FULL_RATE_MS ? 1 : AWAY_SLOW_PACE
    const before = { ...pet.stats }
    simulated += slice
    // Each chunk is tested at its own moment, so a pet left asleep still wakes
    // at the dawn it would have woken at rather than sleeping through the lot.
    step(pet, slice, pet.lastTick + simulated, isDay, true, pace)
    cushion(pet.stats, before)
  }
  pet.lastTick = now
  return { awayMs, simulatedMs: simulated, truncated: wanted > chunks }
}

/**
 * Advance the live simulation. Call once per animation frame. Returns the
 * catch-up when the gap was big enough to have been an absence -- a suspended
 * tab, a shut laptop -- so the caller can welcome the player back instead of
 * silently swallowing the missing hours.
 */
export function tick(pet: PetState, now: number, isDay: Daylight): CatchUp | null {
  const elapsed = Math.max(0, now - pet.lastTick)
  // A tab that was backgrounded for a while goes through the chunked path instead.
  if (elapsed > CATCHUP_CHUNK_MS) return reconcile(pet, now, isDay)
  step(pet, elapsed, now, isDay)
  pet.lastTick = now
  return null
}

/** 0..1 wellbeing, used to pick idle animations and drive the mood lighting. */
export function mood(pet: PetState): number {
  const { stats } = pet
  const avg = (stats.hunger + stats.happiness + stats.energy + stats.hygiene) / 400
  return clamp(avg * 0.7 + (stats.health / 100) * 0.3, 0, 1)
}

/** Stats that need the player's attention right now, worst first. */
export function urgentNeeds(pet: PetState): StatKey[] {
  return STAT_KEYS.filter((k) => pet.stats[k] <= CRITICAL).sort(
    (a, b) => pet.stats[a] - pet.stats[b],
  )
}
