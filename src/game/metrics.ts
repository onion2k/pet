import type { DietAxis, PetState } from './types'

/**
 * Normalised 0..1 readings of how the pet has been raised. Species branch rules
 * score themselves against these rather than poking at raw counters.
 */
export interface Metrics {
  /** 1 = never neglected, 0 = chronically neglected. */
  care: number
  /** Share of axis-bearing meals, per axis. Sums to 1 (or all zero if unfed). */
  diet: Record<DietAxis, number>
  /** The axis with the largest share, or null if nothing distinctive. */
  dietLean: DietAxis | null
  /** 1 = wins nearly everything and plays often. */
  play: number
  /** 1 = always put to bed in its night window and never left overtired. */
  sleep: number
}

const ratio = (part: number, whole: number) => (whole <= 0 ? 0 : part / whole)
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Meals below this and diet is treated as undifferentiated. */
const DIET_SAMPLE_MIN = 6
/** An axis must exceed this share to count as a lean. */
const DIET_LEAN_MIN = 0.4

export function metrics(pet: PetState): Metrics {
  const lived = Math.max(1, pet.care.neglectSeconds + pet.care.thrivingSeconds)
  const neglect = ratio(pet.care.neglectSeconds, lived)
  const sicknessPenalty = Math.min(0.4, pet.care.sicknessCount * 0.08)
  const care = clamp01(1 - neglect - sicknessPenalty)

  const axes: DietAxis[] = ['sweet', 'protein', 'veg', 'junk']
  const axisTotal = axes.reduce((sum, a) => sum + pet.diet[a], 0)
  const diet = Object.fromEntries(
    axes.map((a) => [a, ratio(pet.diet[a], axisTotal)]),
  ) as Record<DietAxis, number>

  let dietLean: DietAxis | null = null
  if (pet.diet.meals >= DIET_SAMPLE_MIN) {
    const best = axes.reduce((a, b) => (diet[a] >= diet[b] ? a : b))
    if (diet[best] >= DIET_LEAN_MIN) dietLean = best
  }

  const winRate = ratio(pet.play.gamesWon, pet.play.gamesPlayed)
  // Volume matters as well as skill: a single lucky win shouldn't decide a branch.
  const volume = clamp01(pet.play.gamesPlayed / 20)
  const play = clamp01(winRate * 0.65 + volume * 0.35)

  const sleeps = pet.sleep.onTimeSleeps + pet.sleep.lateSleeps
  const punctuality = sleeps > 0 ? ratio(pet.sleep.onTimeSleeps, sleeps) : 0.5
  const overtiredPenalty = clamp01(pet.sleep.overtiredSeconds / (4 * 3600))
  const sleep = clamp01(punctuality - overtiredPenalty * 0.6)

  return { care, diet, dietLean, play, sleep }
}
