import type { PetState, Stats, StatKey } from './types'
import {
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
} from './tuning'

const HOUR = 3_600_000

export const STAT_KEYS: StatKey[] = ['hunger', 'happiness', 'energy', 'hygiene', 'health']
/** Health is tracked separately because it reacts to the others rather than draining on its own. */
const DRAINING_KEYS = ['hunger', 'happiness', 'energy', 'hygiene'] as const

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Stats other than health, which has its own floor. */
function clampStats(stats: Stats): void {
  for (const key of DRAINING_KEYS) stats[key] = clamp(stats[key], 0, 100)
  stats.health = clamp(stats.health, HEALTH_FLOOR, 100)
}

/**
 * Advance one pet by `elapsedMs` of wall-clock time. Called both for live frames
 * and, in chunks, for catching up on time spent with the app closed.
 */
function step(pet: PetState, elapsedMs: number): void {
  const hours = (elapsedMs * TIME_SCALE) / HOUR
  const seconds = (elapsedMs * TIME_SCALE) / 1000
  const rates = pet.asleep ? DECAY_ASLEEP : DECAY_AWAKE
  const { stats } = pet

  // The egg has no metabolism — it just waits to hatch.
  if (pet.stage !== 'egg') {
    for (const key of DRAINING_KEYS) stats[key] += rates[key] * hours
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

  if (suffering) pet.care.neglectSeconds += seconds
  else if (DRAINING_KEYS.every((k) => stats[k] >= COMFORTABLE)) {
    pet.care.thrivingSeconds += seconds
  }
  if (exhausted && !pet.asleep) pet.sleep.overtiredSeconds += seconds

  pet.ageMs += elapsedMs * TIME_SCALE
  // A sleeping pet wakes itself once it's fully rested.
  if (pet.asleep && stats.energy >= 100) pet.asleep = false
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
export function reconcile(pet: PetState, now: number): CatchUp {
  const awayMs = Math.max(0, now - pet.lastTick)
  const wanted = Math.ceil(awayMs / CATCHUP_CHUNK_MS)
  const chunks = Math.min(wanted, MAX_CATCHUP_CHUNKS)

  let simulated = 0
  for (let i = 0; i < chunks; i++) {
    const slice = Math.min(CATCHUP_CHUNK_MS, awayMs - simulated)
    step(pet, slice)
    simulated += slice
  }
  pet.lastTick = now
  return { awayMs, simulatedMs: simulated, truncated: wanted > chunks }
}

/** Advance the live simulation. Call once per animation frame. */
export function tick(pet: PetState, now: number): void {
  const elapsed = Math.max(0, now - pet.lastTick)
  // A tab that was backgrounded for a while goes through the chunked path instead.
  if (elapsed > CATCHUP_CHUNK_MS) {
    reconcile(pet, now)
    return
  }
  step(pet, elapsed)
  pet.lastTick = now
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
