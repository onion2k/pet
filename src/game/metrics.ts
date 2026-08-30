import type { DietAxis, PetState } from './types'
import type { PlayAxis } from '../data/yardgames'

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
  /**
   * Share of yard games played, per axis, damped by how many there were. One
   * afternoon spent chasing a butterfly is not a disposition, and a share on
   * its own cannot tell that from a habit -- so a pet that has hardly played
   * outside scores near zero on every axis rather than all of one.
   *
   * Zero across the board for a pet that has only ever played the standing
   * three, which is what keeps this from disturbing how anything already
   * branched.
   */
  playAxes: Record<PlayAxis, number>
  /** The axis with the largest share, or null if nothing distinctive. */
  playLean: PlayAxis | null
  /** 1 = always put to bed in its night window and never left overtired. */
  sleep: number
}

const ratio = (part: number, whole: number) => (whole <= 0 ? 0 : part / whole)
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Meals below this and diet is treated as undifferentiated. */
const DIET_SAMPLE_MIN = 6
/** An axis must exceed this share to count as a lean. */
const DIET_LEAN_MIN = 0.4

/**
 * Yard games below this and playing outside is not yet a habit. Lower than the
 * diet's: a meal is always available and a yard game needs something to have
 * turned up, so four of them is already a pet that has been played with
 * deliberately.
 */
const PLAY_SAMPLE_MIN = 4
/**
 * The share an axis needs to count as a lean. Three axes rather than the
 * diet's four, so an even spread is a third and standing out means a clear
 * majority rather than merely being ahead.
 */
const PLAY_LEAN_MIN = 0.5

const PLAY_AXES: PlayAxis[] = ['chase', 'romp', 'quiet']

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

  const outside = PLAY_AXES.reduce((sum, a) => sum + pet.play.byAxis[a], 0)
  const habit = clamp01(outside / PLAY_SAMPLE_MIN)
  const playAxes = Object.fromEntries(
    PLAY_AXES.map((a) => [a, ratio(pet.play.byAxis[a], outside) * habit]),
  ) as Record<PlayAxis, number>

  let playLean: PlayAxis | null = null
  if (outside >= PLAY_SAMPLE_MIN) {
    const best = PLAY_AXES.reduce((a, b) => (playAxes[a] >= playAxes[b] ? a : b))
    if (ratio(pet.play.byAxis[best], outside) >= PLAY_LEAN_MIN) playLean = best
  }

  const winRate = ratio(pet.play.gamesWon, pet.play.gamesPlayed)
  // Volume matters as well as skill: a single lucky win shouldn't decide a branch.
  const volume = clamp01(pet.play.gamesPlayed / 20)
  const play = clamp01(winRate * 0.65 + volume * 0.35)

  const sleeps = pet.sleep.onTimeSleeps + pet.sleep.lateSleeps
  const punctuality = sleeps > 0 ? ratio(pet.sleep.onTimeSleeps, sleeps) : 0.5
  const overtiredPenalty = clamp01(pet.sleep.overtiredSeconds / (4 * 3600))
  const sleep = clamp01(punctuality - overtiredPenalty * 0.6)

  return { care, diet, dietLean, play, playAxes, playLean, sleep }
}
