import { foodById, type Food } from '../data/foods'
import { chooseBranch, speciesOf } from '../data/species'
import { metrics } from './metrics'
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

export function feed(pet: PetState, foodId: string): ActionResult {
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

  apply(pet.stats, food.effect)
  pet.diet.meals += 1
  if (food.axis) pet.diet[food.axis] += 1

  return { ok: true, message: `${pet.name} ate the ${food.name.toLowerCase()}.` }
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

/** Called once a minigame finishes, whatever the game was. */
export function recordPlay(pet: PetState, won: boolean, streak: number): void {
  pet.play.gamesPlayed += 1
  if (won) pet.play.gamesWon += 1
  pet.play.bestStreak = Math.max(pet.play.bestStreak, streak)
  apply(pet.stats, won ? { happiness: 20, energy: -8, hunger: -4 } : { happiness: 6, energy: -8, hunger: -4 })
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
export function evolve(pet: PetState): Evolution | null {
  const branch = chooseBranch(pet, metrics(pet))
  if (!branch) return null

  const from = speciesOf(pet.speciesId)
  const to = speciesOf(branch.to)
  pet.speciesId = to.id
  pet.stage = to.stage
  if (!pet.discovered.includes(to.id)) pet.discovered.push(to.id)

  // A fresh form arrives alert and in a good mood.
  apply(pet.stats, { happiness: 25, energy: 25 })
  return { fromName: from.name, toId: to.id, toName: to.name, because: branch.because }
}
