import { foodById, type Food } from '../data/foods'
import { chooseBranch, speciesOf, type BranchContext } from '../data/species'
import type { SeasonId } from '../data/seasons'
import type { PlayAxis } from '../data/yardgames'
import type { Prospect } from '../data/grounds'
import { metrics } from './metrics'
import { temperamentFrom, temperamentOf, withLineage } from './temperament'
import type { PetState, Stage, Stats, StatKey } from './types'
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

  // A hot dish is worth more in the cold and a cold one worth more in the heat,
  // so the same food is a different thing depending on the day it is served.
  // Anything with no season to it -- cake, medicine -- is simply itself.
  const suits =
    (season === 'winter' && food.served === 'hot') ||
    (season === 'summer' && food.served === 'cold')
  const seasonal = suits ? 1.3 : 1
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

/**
 * What a yard game is worth against the day it was played on. A game on a good
 * day beats anything on the standing menu; the same game on a bad one is worth
 * less than staying in, which is what makes the read on the menu something the
 * player spends rather than something they merely read. Chasing a butterfly
 * through the rain is still chasing a butterfly -- it is just not much of an
 * afternoon.
 */
const PROSPECT_WORTH: Record<Prospect, number> = { good: 1.35, fair: 1.2, poor: 0.7 }

/** What the running about costs and counts as, when it happened in the yard. */
export interface YardStake {
  axis: PlayAxis
  energy: number
  prospect: Prospect
}

/**
 * Called once a minigame finishes, whatever the game was.
 *
 * A yard game names the axis it counts toward and what the running about costs
 * on top of the ordinary tiring, and is worth what the day makes it worth.
 */
export function recordPlay(pet: PetState, won: boolean, streak: number, yard?: YardStake): void {
  pet.play.gamesPlayed += 1
  if (won) pet.play.gamesWon += 1
  pet.play.bestStreak = Math.max(pet.play.bestStreak, streak)
  if (yard) pet.play.byAxis[yard.axis] += 1
  const keen = readiness(pet)
  const lively = temperamentOf(pet)?.id === 'lively' ? 1.25 : 1
  const outside = yard ? PROSPECT_WORTH[yard.prospect] : 1
  apply(pet.stats, {
    happiness: (won ? 20 : 6) * keen * lively * outside,
    // Tiring either way, and more so when it had little to give.
    energy: -8 * (2 - keen) - (yard?.energy ?? 0),
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

/**
 * Cumulative age at which the pet entered its current stage. A table rather
 * than a switch: every stage has an answer, so there is no unreachable default
 * for a reader to wonder about.
 */
const STAGE_START: Record<Stage, number> = {
  egg: 0,
  baby: STAGE_DURATION.egg,
  child: STAGE_DURATION.egg + STAGE_DURATION.baby,
  adult: STAGE_DURATION.egg + STAGE_DURATION.baby + STAGE_DURATION.child,
}

const stageStartAge = (pet: PetState): number => STAGE_START[pet.stage]

/** Applies the earned branch, if any. Returns what happened so the UI can celebrate it. */
export function evolve(pet: PetState, ctx: BranchContext): Evolution | null {
  const branch = chooseBranch(pet, withLineage(metrics(pet), ctx.lineage), ctx)
  if (!branch) return null

  const from = speciesOf(pet.speciesId)
  const to = speciesOf(branch.to)
  pet.speciesId = to.id
  pet.stage = to.stage
  if (!pet.discovered.includes(to.id)) pet.discovered.push(to.id)

  // Growing up settles the character. Read once, from the raising that has just
  // finished, and kept for the rest of the pet's life.
  if (to.stage === 'adult') pet.temperament = temperamentFrom(withLineage(metrics(pet), ctx.lineage))

  // A fresh form arrives alert and in a good mood.
  apply(pet.stats, { happiness: 25, energy: 25 })
  return { fromName: from.name, toId: to.id, toName: to.name, because: branch.because }
}
