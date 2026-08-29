import { foodById, type Food } from '../data/foods'
import { chooseBranch, speciesOf, type BranchContext } from '../data/species'
import type { SeasonId } from '../data/seasons'
import { metrics } from './metrics'
import { temperamentFrom, temperamentOf } from './temperament'
import type { PetState, Stats, StatKey } from './types'
import { HEALTH_FLOOR, STAGE_DURATION } from './tuning'
import { isNight } from './world'

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

function apply(stats: Stats, delta: Partial<Stats>): void {
  for (const [key, amount] of Object.entries(delta) as [StatKey, number][]) {
    const floor = key === 'health' ? HEALTH_FLOOR : 0
    stats[key] = clamp(stats[key] + amount, floor, 100)
  }
}

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

/** The pet refuses food when it is already full, so hunger can't be spammed to 100. */
const FULL_THRESHOLD = 92

export function feed(pet: PetState, foodId: string, season: SeasonId): ActionResult {
  if (pet.stage === 'egg') return { ok: false, message: 'It has not hatched yet.' }
  if (pet.asleep) return { ok: false, message: `${pet.name} is asleep.` }

  const food: Food = foodById(foodId)
  const isMedicine = food.axis === null
  if (!isMedicine && pet.stats.hunger >= FULL_THRESHOLD) {
    return { ok: false, message: 'Too full for that.' }
  }
  if (isMedicine && !pet.sick) {
    return { ok: false, message: 'It is not poorly.' }
  }

  // A hot meal is worth more in the cold, and a light one worth more in the
  // heat. The same food is a different thing depending on the day it is served.
  const warmth = food.effect.energy ?? 0
  const seasonal =
    (season === 'winter' && warmth > 0) || (season === 'summer' && warmth <= 0) ? 1.3 : 1
  const effect: Partial<Stats> = {}
  for (const [key, amount] of Object.entries(food.effect) as [StatKey, number][]) {
    effect[key] = amount * seasonal
  }
  apply(pet.stats, effect)
  pet.diet.meals += 1
  if (food.axis) pet.diet[food.axis] += 1

  const relished = seasonal > 1 ? ' and relished it' : ''
  return { ok: true, message: `${pet.name} ate the ${food.name.toLowerCase()}${relished}.` }
}

export function clean(pet: PetState): ActionResult {
  if (pet.stage === 'egg') return { ok: false, message: 'Nothing to clean yet.' }
  if (pet.stats.hygiene >= 96) return { ok: false, message: 'Already spotless.' }
  apply(pet.stats, { hygiene: 100, happiness: 4 })
  return { ok: true, message: 'All tidied up.' }
}

export function toggleSleep(pet: PetState, now: number): ActionResult {
  if (pet.stage === 'egg') return { ok: false, message: 'The egg is already resting.' }

  if (pet.asleep) {
    // Waking a pet that still needs rest is what makes sleep discipline drop.
    if (pet.stats.energy < 60) pet.sleep.lateSleeps += 1
    pet.asleep = false
    return { ok: true, message: `${pet.name} wakes up.` }
  }

  if (pet.stats.energy >= 95) return { ok: false, message: 'Not remotely sleepy.' }
  pet.asleep = true
  // Judged against the world's own sky, so a bedtime the game calls late is one
  // the player can see is late.
  if (isNight(now)) pet.sleep.onTimeSleeps += 1
  else pet.sleep.lateSleeps += 1
  return { ok: true, message: `${pet.name} curls up.` }
}

/**
 * How much a pet has to give a game right now. A tired or hungry one is poor
 * company: it gets less out of playing and tires faster for it, so there is a
 * right time to play as well as a right amount.
 */
export function readiness(pet: PetState): number {
  const rested = clamp(pet.stats.energy / 60, 0, 1)
  const fed = clamp(pet.stats.hunger / 50, 0, 1)
  return clamp(0.35 + rested * 0.4 + fed * 0.25, 0, 1)
}

/** Called once a minigame finishes, whatever the game was. */
export function recordPlay(pet: PetState, won: boolean, streak: number): void {
  pet.play.gamesPlayed += 1
  if (won) pet.play.gamesWon += 1
  pet.play.bestStreak = Math.max(pet.play.bestStreak, streak)
  const keen = readiness(pet)
  const lively = temperamentOf(pet)?.id === 'lively' ? 1.25 : 1
  apply(pet.stats, {
    happiness: (won ? 20 : 6) * keen * lively,
    // Tiring either way, and more so when it had little to give.
    energy: -8 * (2 - keen),
    hunger: -4,
  })
}

export interface Evolution {
  fromName: string
  toId: string
  toName: string
  because: string
}

/** True once the pet has spent long enough in its current stage to move on. */
export function readyToEvolve(pet: PetState): boolean {
  const duration = STAGE_DURATION[pet.stage as keyof typeof STAGE_DURATION]
  if (duration === undefined) return false
  const stageStart = stageStartAge(pet)
  return pet.ageMs - stageStart >= duration
}

/** Cumulative age at which the pet entered its current stage. */
function stageStartAge(pet: PetState): number {
  switch (pet.stage) {
    case 'egg':
      return 0
    case 'baby':
      return STAGE_DURATION.egg
    case 'child':
      return STAGE_DURATION.egg + STAGE_DURATION.baby
    default:
      return Infinity
  }
}

/** Applies the earned branch, if any. Returns what happened so the UI can celebrate it. */
export function evolve(pet: PetState, ctx: BranchContext): Evolution | null {
  const branch = chooseBranch(pet, metrics(pet), ctx)
  if (!branch) return null

  const from = speciesOf(pet.speciesId)
  const to = speciesOf(branch.to)
  pet.speciesId = to.id
  pet.stage = to.stage
  if (!pet.discovered.includes(to.id)) pet.discovered.push(to.id)

  // Growing up settles the character. Read once, from the raising that has just
  // finished, and kept for the rest of the pet's life.
  if (to.stage === 'adult') pet.temperament = temperamentFrom(metrics(pet))

  // A fresh form arrives alert and in a good mood.
  apply(pet.stats, { happiness: 25, energy: 25 })
  return { fromName: from.name, toId: to.id, toName: to.name, because: branch.because }
}
