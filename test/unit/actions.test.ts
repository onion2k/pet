import { describe, expect, it } from 'vitest'
import {
  clean,
  evolve,
  feed,
  readiness,
  readyToEvolve,
  recordPlay,
  toggleSleep,
} from '../../src/game/actions'
import { newPet, resetIdSource, setIdSource } from '../../src/game/save'
import { STAGE_DURATION, HEALTH_FLOOR } from '../../src/game/tuning'
import { foodById, FOODS } from '../../src/data/foods'
import { DAY_MS, isNight } from '../../src/game/world'
import type { PetState, Stats } from '../../src/game/types'
import type { BranchContext } from '../../src/data/species'

/**
 * The actions are the game's whole verb list: everything a player can do to a
 * pet, they do through one of these. So this is where the refusals matter most
 * -- a refusal that is wrong either lets a stat be spammed to full or, worse,
 * leaves a button that never works and a player who cannot tell why.
 */

setIdSource(() => 'test-pet')

function pet(overrides: Partial<PetState> = {}, stats: Partial<Stats> = {}): PetState {
  const p = newPet('PIP', 0)
  p.stage = 'child'
  p.speciesId = 'pudge'
  Object.assign(p, overrides)
  Object.assign(p.stats, stats)
  return p
}

/** A moment the world's sun is up, and one it is down. */
function findMoments() {
  let day = -1
  let night = -1
  for (let t = 0; t < DAY_MS; t += 10_000) {
    if (day < 0 && !isNight(t)) day = t
    if (night < 0 && isNight(t)) night = t
    if (day >= 0 && night >= 0) break
  }
  return { day, night }
}
const MOMENT = findMoments()

describe('feed', () => {
  it('refuses while the pet is still an egg', () => {
    const result = feed(pet({ stage: 'egg', speciesId: 'egg' }), 'berry', 'spring')
    expect(result).toEqual({ ok: false, message: 'It has not hatched yet.' })
  })

  it('refuses while the pet is asleep, and says whose sleep it is', () => {
    const result = feed(pet({ asleep: true, name: 'MOSS' }), 'berry', 'spring')
    expect(result).toEqual({ ok: false, message: 'MOSS is asleep.' })
  })

  it('refuses food to a pet that is already full', () => {
    const result = feed(pet({}, { hunger: 95 }), 'berry', 'spring')
    expect(result).toEqual({ ok: false, message: 'Too full for that.' })
  })

  it('accepts food right up to the full threshold', () => {
    expect(feed(pet({}, { hunger: 91 }), 'berry', 'spring').ok).toBe(true)
  })

  it('applies the food"s effects', () => {
    const p = pet({}, { hunger: 50, happiness: 50 })
    const berry = foodById('berry')
    feed(p, 'berry', 'spring')
    expect(p.stats.hunger).toBe(50 + berry.effect.hunger!)
    expect(p.stats.happiness).toBe(50 + berry.effect.happiness!)
  })

  it('counts the meal and its axis', () => {
    const p = pet({}, { hunger: 10 })
    feed(p, 'salad', 'spring')
    expect(p.diet.meals).toBe(1)
    expect(p.diet.veg).toBe(1)
    expect(p.diet.sweet).toBe(0)
  })

  it('names the food in the message', () => {
    const result = feed(pet({ name: 'ZED' }, { hunger: 10 }), 'meat', 'spring')
    expect(result.message).toBe('ZED ate the drumstick.')
  })

  it('is worth more, and says so, when a hot dish meets winter', () => {
    const warm = pet({}, { hunger: 10 })
    const mild = pet({}, { hunger: 10 })
    const winter = feed(warm, 'meat', 'winter')
    feed(mild, 'meat', 'spring')
    expect(warm.stats.hunger).toBeGreaterThan(mild.stats.hunger)
    expect(winter.message).toContain('and relished it')
  })

  it('is worth more when a cold dish meets summer', () => {
    const cool = pet({}, { hunger: 10 })
    const mild = pet({}, { hunger: 10 })
    feed(cool, 'berry', 'summer')
    feed(mild, 'berry', 'spring')
    expect(cool.stats.hunger).toBeGreaterThan(mild.stats.hunger)
  })

  it('is worth no more when a hot dish meets summer', () => {
    const wrong = pet({}, { hunger: 10 })
    const mild = pet({}, { hunger: 10 })
    feed(wrong, 'meat', 'summer')
    feed(mild, 'meat', 'spring')
    expect(wrong.stats.hunger).toBe(mild.stats.hunger)
  })

  it('gives food with no season to it the same value all year', () => {
    const values = (['spring', 'summer', 'autumn', 'winter'] as const).map((season) => {
      const p = pet({}, { hunger: 10 })
      feed(p, 'cake', season)
      return p.stats.hunger
    })
    expect(new Set(values).size).toBe(1)
  })

  describe('medicine', () => {
    it('is refused by a pet that is not poorly', () => {
      expect(feed(pet(), 'medicine', 'spring')).toEqual({
        ok: false,
        message: 'It is not poorly.',
      })
    })

    it('works on a sick pet however full it is', () => {
      const p = pet({ sick: true }, { hunger: 100, health: 20, happiness: 50 })
      const result = feed(p, 'medicine', 'spring')
      expect(result.ok).toBe(true)
      expect(p.stats.health).toBe(20 + 34)
      expect(p.stats.happiness).toBe(50 - 12)
    })

    it('counts as a meal but toward no axis', () => {
      const p = pet({ sick: true }, { health: 20 })
      feed(p, 'medicine', 'spring')
      expect(p.diet.meals).toBe(1)
      expect(p.diet.sweet + p.diet.protein + p.diet.veg + p.diet.junk).toBe(0)
    })

    it('never counts as seasonal, being a meal it is not', () => {
      const p = pet({ sick: true }, { health: 20 })
      const result = feed(p, 'medicine', 'winter')
      expect(result.message).not.toContain('relished')
    })
  })

  it('clamps every stat inside its bounds', () => {
    const p = pet({}, { hunger: 10, happiness: 100, health: 100 })
    feed(p, 'cake', 'spring')
    expect(p.stats.happiness).toBe(100)
    const ill = pet({}, { hunger: 10, health: HEALTH_FLOOR })
    feed(ill, 'fries', 'spring')
    expect(ill.stats.health).toBe(HEALTH_FLOOR)
  })

  it('throws on a food that does not exist, rather than feeding nothing', () => {
    expect(() => feed(pet({}, { hunger: 10 }), 'gravel', 'spring')).toThrow('Unknown food: gravel')
  })

  it('accepts every food on the list without falling over', () => {
    for (const food of FOODS) {
      const p = pet({ sick: true }, { hunger: 10, health: 20 })
      expect(feed(p, food.id, 'spring').ok).toBe(true)
    }
  })
})

describe('clean', () => {
  it('refuses while the pet is still an egg', () => {
    expect(clean(pet({ stage: 'egg', speciesId: 'egg' }))).toEqual({
      ok: false,
      message: 'Nothing to clean yet.',
    })
  })

  it('refuses a pet that is already spotless', () => {
    expect(clean(pet({}, { hygiene: 96 }))).toEqual({ ok: false, message: 'Already spotless.' })
  })

  it('takes hygiene to full and cheers the pet up', () => {
    const p = pet({}, { hygiene: 20, happiness: 50 })
    expect(clean(p).ok).toBe(true)
    expect(p.stats.hygiene).toBe(100)
    expect(p.stats.happiness).toBe(54)
  })

  it('works on a sleeping pet, since a bath is not a meal', () => {
    expect(clean(pet({ asleep: true }, { hygiene: 20 })).ok).toBe(true)
  })
})

describe('toggleSleep', () => {
  it('refuses to put an egg to bed, it being already resting', () => {
    expect(toggleSleep(pet({ stage: 'egg', speciesId: 'egg' }), 0)).toEqual({
      ok: false,
      message: 'The egg is already resting.',
    })
  })

  it('refuses a pet that is not remotely sleepy', () => {
    expect(toggleSleep(pet({}, { energy: 95 }), 0)).toEqual({
      ok: false,
      message: 'Not remotely sleepy.',
    })
  })

  it('puts a tired pet to bed', () => {
    const p = pet({ name: 'NIM' }, { energy: 40 })
    const result = toggleSleep(p, MOMENT.night)
    expect(result).toEqual({ ok: true, message: 'NIM curls up.' })
    expect(p.asleep).toBe(true)
  })

  it('counts a bedtime after dark as on time', () => {
    const p = pet({}, { energy: 40 })
    toggleSleep(p, MOMENT.night)
    expect(p.sleep.onTimeSleeps).toBe(1)
    expect(p.sleep.lateSleeps).toBe(0)
  })

  it('counts a bedtime in broad daylight as late', () => {
    const p = pet({}, { energy: 40 })
    toggleSleep(p, MOMENT.day)
    expect(p.sleep.lateSleeps).toBe(1)
    expect(p.sleep.onTimeSleeps).toBe(0)
  })

  it('wakes a sleeping pet', () => {
    const p = pet({ asleep: true, name: 'BOB' }, { energy: 80 })
    expect(toggleSleep(p, 0)).toEqual({ ok: true, message: 'BOB wakes up.' })
    expect(p.asleep).toBe(false)
  })

  it('counts waking a pet that still needed rest against sleep discipline', () => {
    const p = pet({ asleep: true }, { energy: 30 })
    toggleSleep(p, 0)
    expect(p.sleep.lateSleeps).toBe(1)
  })

  it('does not count waking a pet that had slept enough', () => {
    const p = pet({ asleep: true }, { energy: 60 })
    toggleSleep(p, 0)
    expect(p.sleep.lateSleeps).toBe(0)
  })

  it('wakes a sleeping pet however awake it is, since the refusal is about bedtime', () => {
    const p = pet({ asleep: true }, { energy: 100 })
    expect(toggleSleep(p, 0).ok).toBe(true)
    expect(p.asleep).toBe(false)
  })
})

describe('readiness', () => {
  it('is 1 for a rested, fed pet', () => {
    expect(readiness(pet({}, { energy: 100, hunger: 100 }))).toBe(1)
  })

  it('is at its floor for a pet with nothing to give', () => {
    expect(readiness(pet({}, { energy: 0, hunger: 0 }))).toBeCloseTo(0.35, 6)
  })

  it('rises with rest and with food', () => {
    const low = readiness(pet({}, { energy: 10, hunger: 10 }))
    const rested = readiness(pet({}, { energy: 60, hunger: 10 }))
    const fed = readiness(pet({}, { energy: 10, hunger: 50 }))
    expect(rested).toBeGreaterThan(low)
    expect(fed).toBeGreaterThan(low)
  })

  it('stops counting rest past the point it stops mattering', () => {
    expect(readiness(pet({}, { energy: 60, hunger: 100 }))).toBe(
      readiness(pet({}, { energy: 100, hunger: 100 })),
    )
  })

  it('stays inside 0..1', () => {
    for (const v of [0, 25, 50, 75, 100]) {
      const r = readiness(pet({}, { energy: v, hunger: v }))
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
  })
})

describe('recordPlay', () => {
  it('counts the game whether it was won or lost', () => {
    const p = pet({}, { energy: 100, hunger: 100 })
    recordPlay(p, false, 0)
    recordPlay(p, true, 1)
    expect(p.play.gamesPlayed).toBe(2)
    expect(p.play.gamesWon).toBe(1)
  })

  it('keeps the best streak, never a worse one', () => {
    const p = pet({}, { energy: 100, hunger: 100 })
    recordPlay(p, true, 4)
    recordPlay(p, true, 2)
    expect(p.play.bestStreak).toBe(4)
  })

  it('is cheering to win and still worth something to lose', () => {
    const won = pet({}, { energy: 100, hunger: 100, happiness: 50 })
    const lost = pet({}, { energy: 100, hunger: 100, happiness: 50 })
    recordPlay(won, true, 1)
    recordPlay(lost, false, 0)
    expect(won.stats.happiness).toBeGreaterThan(lost.stats.happiness)
    expect(lost.stats.happiness).toBeGreaterThan(50)
  })

  it('costs energy and a little hunger', () => {
    const p = pet({}, { energy: 100, hunger: 100 })
    recordPlay(p, true, 1)
    expect(p.stats.energy).toBeLessThan(100)
    expect(p.stats.hunger).toBe(96)
  })

  it('gives a tired pet less, and tires it more', () => {
    const keen = pet({}, { energy: 100, hunger: 100, happiness: 0 })
    // Enough energy left that the cost is visible rather than clamped at zero.
    const weary = pet({}, { energy: 20, hunger: 5, happiness: 0 })
    const keenEnergy = keen.stats.energy
    const wearyEnergy = weary.stats.energy
    recordPlay(keen, true, 1)
    recordPlay(weary, true, 1)
    expect(keen.stats.happiness).toBeGreaterThan(weary.stats.happiness)
    expect(keenEnergy - keen.stats.energy).toBeLessThan(wearyEnergy - weary.stats.energy)
  })

  it('cheers a lively adult more than a plain one', () => {
    const lively = pet(
      { stage: 'adult', speciesId: 'blaze', temperament: 'lively' },
      { energy: 100, hunger: 100, happiness: 0 },
    )
    const plain = pet({ stage: 'adult', speciesId: 'blaze' }, { energy: 100, hunger: 100, happiness: 0 })
    recordPlay(lively, true, 1)
    recordPlay(plain, true, 1)
    expect(lively.stats.happiness).toBeGreaterThan(plain.stats.happiness)
  })
})

describe('readyToEvolve', () => {
  it('is false for a newborn egg', () => {
    expect(readyToEvolve(pet({ stage: 'egg', speciesId: 'egg', ageMs: 0 }))).toBe(false)
  })

  it('is true once the egg has waited out its stage', () => {
    expect(readyToEvolve(pet({ stage: 'egg', speciesId: 'egg', ageMs: STAGE_DURATION.egg }))).toBe(true)
  })

  it('measures each stage from where the last one ended', () => {
    const justHatched = STAGE_DURATION.egg
    expect(readyToEvolve(pet({ stage: 'baby', ageMs: justHatched }))).toBe(false)
    expect(
      readyToEvolve(pet({ stage: 'baby', ageMs: justHatched + STAGE_DURATION.baby })),
    ).toBe(true)
  })

  it('holds a child for its own, longer stage', () => {
    const childFrom = STAGE_DURATION.egg + STAGE_DURATION.baby
    expect(readyToEvolve(pet({ stage: 'child', ageMs: childFrom + STAGE_DURATION.child - 1 }))).toBe(
      false,
    )
    expect(readyToEvolve(pet({ stage: 'child', ageMs: childFrom + STAGE_DURATION.child }))).toBe(true)
  })

  it('holds an adult for a full grown life before it can become an elder', () => {
    const adultFrom = STAGE_DURATION.egg + STAGE_DURATION.baby + STAGE_DURATION.child
    expect(readyToEvolve(pet({ stage: 'adult', ageMs: adultFrom }))).toBe(false)
    expect(readyToEvolve(pet({ stage: 'adult', ageMs: adultFrom + STAGE_DURATION.adult }))).toBe(true)
  })

  it('is false for a stage the tuning has no duration for', () => {
    expect(readyToEvolve(pet({ stage: 'elder' as never, ageMs: 1e12 }))).toBe(false)
  })
})

describe('evolve', () => {
  const ctx: BranchContext = { season: 'spring', lineage: null }

  it('hatches an egg into a blobbit', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' })
    const result = evolve(p, ctx)
    expect(result).toMatchObject({ fromName: 'Egg', toId: 'blob', toName: 'Blobbit' })
    expect(p.speciesId).toBe('blob')
    expect(p.stage).toBe('baby')
  })

  it('records the new form as discovered', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' })
    evolve(p, ctx)
    expect(p.discovered).toContain('blob')
  })

  it('does not record the same form twice', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg', discovered: ['egg', 'blob'] })
    evolve(p, ctx)
    expect(p.discovered.filter((id) => id === 'blob')).toHaveLength(1)
  })

  it('arrives alert and in a good mood', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' }, { happiness: 40, energy: 40 })
    evolve(p, ctx)
    expect(p.stats.happiness).toBe(65)
    expect(p.stats.energy).toBe(65)
  })

  it('is null for a form with nowhere left to go', () => {
    const elder = pet({ stage: 'adult', speciesId: 'somnix' })
    expect(evolve(elder, ctx)).toBeNull()
  })

  it('is null for an adult whose temperament opens no elder branch', () => {
    const p = pet({ stage: 'adult', speciesId: 'mochi', temperament: 'easygoing' })
    expect(evolve(p, ctx)).toBeNull()
  })

  it('settles a temperament on the pet that has just grown up', () => {
    const p = pet({ stage: 'child', speciesId: 'pudge' })
    p.care.thrivingSeconds = 10_000
    const result = evolve(p, ctx)
    expect(result?.toId).toBeDefined()
    expect(p.stage).toBe('adult')
    expect(p.temperament).toBeDefined()
  })

  it('does not settle a temperament on a pet that is still growing', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' })
    evolve(p, ctx)
    expect(p.temperament).toBeUndefined()
  })

  it('opens the elder a devoted adult has earned', () => {
    const p = pet({ stage: 'adult', speciesId: 'mochi', temperament: 'devoted' })
    expect(evolve(p, ctx)?.toId).toBe('warden')
  })

  it('opens a different elder for each temperament', () => {
    const forEach = (['devoted', 'lively', 'restful'] as const).map((temperament) => {
      const p = pet({ stage: 'adult', speciesId: 'mochi', temperament })
      return evolve(p, ctx)?.toId
    })
    expect(forEach).toEqual(['warden', 'zephyrix', 'somnix'])
  })

  it('gives a reason the evolution screen can show', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' })
    expect(evolve(p, ctx)?.because).toBe('it hatched')
  })

  it('lets a season gate a branch: aurora only comes in winter', () => {
    const summer = pet({ stage: 'child', speciesId: 'pudge' })
    const winter = pet({ stage: 'child', speciesId: 'pudge' })
    summer.care.thrivingSeconds = 10_000
    winter.care.thrivingSeconds = 10_000
    expect(evolve(summer, { season: 'summer', lineage: null })?.toId).not.toBe('aurora')
    expect(evolve(winter, { season: 'winter', lineage: null })?.toId).toBe('aurora')
  })
})

resetIdSource()

describe('a game played out in the yard', () => {
  const played = (yard?: Parameters<typeof recordPlay>[3]) => {
    const pet = newPet('PIP', 0)
    pet.stage = 'child'
    pet.stats.happiness = 40
    pet.stats.energy = 80
    recordPlay(pet, true, 1, yard)
    return pet
  }

  it('counts toward the axis it is, and nothing else', () => {
    const pet = played({ axis: 'romp', energy: 5, prospect: 'fair' })
    expect(pet.play.byAxis).toEqual({ chase: 0, romp: 1, quiet: 0 })
  })

  it('leaves the axes alone when the game was one of the standing three', () => {
    expect(played().play.byAxis).toEqual({ chase: 0, romp: 0, quiet: 0 })
  })

  it('costs the running about on top of the ordinary tiring', () => {
    const inside = played()
    const outside = played({ axis: 'chase', energy: 8, prospect: 'fair' })
    expect(inside.stats.energy - outside.stats.energy).toBeCloseTo(8, 5)
  })

  it('is worth more on a good day than on a bad one', () => {
    // The read on the menu has to change something, or it is decoration.
    const good = played({ axis: 'chase', energy: 5, prospect: 'good' })
    const poor = played({ axis: 'chase', energy: 5, prospect: 'poor' })
    expect(good.stats.happiness).toBeGreaterThan(poor.stats.happiness)
  })

  it('beats the standing menu on a good day and loses to it on a bad one', () => {
    const inside = played()
    const good = played({ axis: 'chase', energy: 5, prospect: 'good' })
    const poor = played({ axis: 'chase', energy: 5, prospect: 'poor' })
    expect(good.stats.happiness).toBeGreaterThan(inside.stats.happiness)
    expect(poor.stats.happiness).toBeLessThan(inside.stats.happiness)
  })
})
