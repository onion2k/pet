import { describe, expect, it } from 'vitest'
import {
  mood,
  reconcile,
  sleepThrough,
  STAT_KEYS,
  tick,
  urgentNeeds,
  type Daylight,
} from '../../src/game/sim'
import { newPet, resetIdSource, setIdSource } from '../../src/game/save'
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
  WARM_NIGHT,
} from '../../src/game/tuning'
import type { PetState, Stats } from '../../src/game/types'

/**
 * The simulation is what the pet *is*: everything else in the game either feeds
 * it or reads it. It is also the part a player can be hurt by without ever
 * pressing a button -- an absence that ruins a pet, a night that costs more
 * than it gives -- so the tests here are as much about the promises the tuning
 * comments make as about the arithmetic.
 */

const HOUR = 3_600_000

setIdSource(() => 'test-pet')

/** A pet at a stated stage with stated stats, and nothing else going on. */
function pet(overrides: Partial<PetState> = {}, stats: Partial<Stats> = {}): PetState {
  const p = newPet('PIP', 0)
  p.stage = 'child'
  p.speciesId = 'pudge'
  Object.assign(p, overrides)
  Object.assign(p.stats, stats)
  return p
}

const ALWAYS_DAY: Daylight = () => true
const ALWAYS_NIGHT: Daylight = () => false

describe('STAT_KEYS', () => {
  it('names every stat the pet has', () => {
    expect(STAT_KEYS).toEqual(['hunger', 'happiness', 'energy', 'hygiene', 'health'])
  })
})

describe('tick', () => {
  it('drains the awake rates over an hour', () => {
    const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 })
    tick(p, HOUR, ALWAYS_DAY)
    // The gap is larger than a catch-up chunk, so this went through reconcile;
    // an hour is inside the full-rate window either way.
    expect(p.stats.hunger).toBeCloseTo(100 + DECAY_AWAKE.hunger, 4)
    expect(p.stats.happiness).toBeCloseTo(100 + DECAY_AWAKE.happiness, 4)
    expect(p.stats.energy).toBeCloseTo(100 + DECAY_AWAKE.energy, 4)
    expect(p.stats.hygiene).toBeCloseTo(100 + DECAY_AWAKE.hygiene, 4)
  })

  it('runs live for a gap small enough to be a frame', () => {
    const p = pet({}, { hunger: 100 })
    tick(p, 1000, ALWAYS_DAY)
    expect(p.stats.hunger).toBeCloseTo(100 + DECAY_AWAKE.hunger / 3600, 6)
    expect(p.lastTick).toBe(1000)
  })

  it('returns nothing for a live frame and a catch-up for a long gap', () => {
    expect(tick(pet(), 1000, ALWAYS_DAY)).toBeNull()
    const caught = tick(pet(), CATCHUP_CHUNK_MS + 1, ALWAYS_DAY)
    expect(caught).not.toBeNull()
    expect(caught?.awayMs).toBe(CATCHUP_CHUNK_MS + 1)
  })

  it('treats a clock that went backwards as no time at all', () => {
    const p = pet({ lastTick: 10_000 }, { hunger: 50 })
    expect(tick(p, 5_000, ALWAYS_DAY)).toBeNull()
    expect(p.stats.hunger).toBe(50)
    expect(p.lastTick).toBe(5_000)
  })

  it('ages the pet by the time that passed', () => {
    const p = pet()
    tick(p, 1000, ALWAYS_DAY)
    expect(p.ageMs).toBe(1000)
  })

  it('advances lastTick to the moment simulated', () => {
    const p = pet()
    tick(p, 4321, ALWAYS_DAY)
    expect(p.lastTick).toBe(4321)
  })
})

describe('the egg', () => {
  it('has no metabolism, so its stats do not move', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' }, { hunger: 70, happiness: 70, energy: 90 })
    tick(p, HOUR, ALWAYS_DAY)
    expect(p.stats).toEqual({ hunger: 70, happiness: 70, energy: 90, hygiene: 90, health: 100 })
  })

  it('cannot get sick, however long it waits', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' }, { hunger: 0, happiness: 0, energy: 0 })
    tick(p, 10 * HOUR, ALWAYS_DAY)
    expect(p.sick).toBe(false)
    expect(p.stats.health).toBe(100)
  })

  it('still ages, so it can hatch', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' })
    tick(p, 60_000, ALWAYS_DAY)
    expect(p.ageMs).toBe(60_000)
  })
})

describe('sleep', () => {
  it('barely burns anything and refills energy', () => {
    const p = pet({ asleep: true }, { hunger: 100, happiness: 50, energy: 0, hygiene: 100 })
    tick(p, HOUR, ALWAYS_NIGHT)
    expect(p.stats.hunger).toBeCloseTo(100 + DECAY_ASLEEP.hunger, 4)
    expect(p.stats.happiness).toBeCloseTo(50 + DECAY_ASLEEP.happiness, 4)
    expect(p.stats.energy).toBeCloseTo(DECAY_ASLEEP.energy, 4)
    expect(p.stats.hygiene).toBeCloseTo(100 + DECAY_ASLEEP.hygiene, 4)
  })

  it('is rest rather than a cost: a night in bed leaves the pet better off', () => {
    const before = { hunger: 80, happiness: 50, energy: 10, hygiene: 80, health: 100 }
    const asleep = pet({ asleep: true }, before)
    const awake = pet({}, before)
    tick(asleep, 8 * HOUR, ALWAYS_NIGHT)
    tick(awake, 8 * HOUR, ALWAYS_NIGHT)
    expect(asleep.stats.energy).toBeGreaterThan(awake.stats.energy)
    expect(asleep.stats.happiness).toBeGreaterThan(awake.stats.happiness)
    expect(asleep.stats.hunger).toBeGreaterThan(awake.stats.hunger)
  })

  it('wakes the pet once it is rested and the sun is up', () => {
    const p = pet({ asleep: true, warm: true }, { energy: 100 })
    tick(p, 1000, ALWAYS_DAY)
    expect(p.asleep).toBe(false)
    expect(p.warm).toBe(false)
  })

  it('does not wake it in the small hours, however rested', () => {
    const p = pet({ asleep: true }, { energy: 100 })
    tick(p, 1000, ALWAYS_NIGHT)
    expect(p.asleep).toBe(true)
  })

  it('does not wake it at dawn while it is still tired', () => {
    const p = pet({ asleep: true }, { energy: 40 })
    tick(p, 1000, ALWAYS_DAY)
    expect(p.asleep).toBe(true)
  })
})

describe('a banked fire', () => {
  it('slows what the night takes without changing what it gives', () => {
    const stats = { hunger: 100, happiness: 50, energy: 0, hygiene: 100, health: 100 }
    const warm = pet({ asleep: true, warm: true }, stats)
    const cold = pet({ asleep: true }, stats)
    tick(warm, HOUR, ALWAYS_NIGHT)
    tick(cold, HOUR, ALWAYS_NIGHT)

    // Costs are softened...
    expect(warm.stats.hunger).toBeCloseTo(100 + DECAY_ASLEEP.hunger * WARM_NIGHT, 4)
    expect(warm.stats.hunger).toBeGreaterThan(cold.stats.hunger)
    expect(warm.stats.hygiene).toBeGreaterThan(cold.stats.hygiene)
    // ...and the rest is unchanged, because it was never a cost.
    expect(warm.stats.energy).toBeCloseTo(cold.stats.energy, 6)
    expect(warm.stats.happiness).toBeCloseTo(cold.stats.happiness, 6)
  })

  it('does nothing at all while the pet is awake', () => {
    const warm = pet({ warm: true }, { hunger: 100 })
    const cold = pet({}, { hunger: 100 })
    tick(warm, HOUR, ALWAYS_DAY)
    tick(cold, HOUR, ALWAYS_DAY)
    expect(warm.stats.hunger).toBeCloseTo(cold.stats.hunger, 6)
  })
})

describe('temperament bias', () => {
  const drainOver = (temperament: PetState['temperament'], hours: number) => {
    const p = pet(
      { stage: 'adult', speciesId: 'mochi', temperament },
      { hunger: 100, happiness: 100, energy: 100, hygiene: 100 },
    )
    tick(p, hours * HOUR, ALWAYS_DAY)
    return p.stats
  }

  it('leaves a pet with no temperament on the flat rates', () => {
    const flat = drainOver(undefined, 1)
    expect(flat.happiness).toBeCloseTo(100 + DECAY_AWAKE.happiness, 4)
  })

  it('burns a lively pet through its spirits and energy faster', () => {
    const lively = drainOver('lively', 1)
    const flat = drainOver(undefined, 1)
    expect(lively.happiness).toBeLessThan(flat.happiness)
    expect(lively.energy).toBeLessThan(flat.energy)
    expect(lively.hunger).toBeLessThan(flat.hunger)
  })

  it('holds a restful pet"s energy and spirits', () => {
    const restful = drainOver('restful', 1)
    const flat = drainOver(undefined, 1)
    expect(restful.energy).toBeGreaterThan(flat.energy)
    expect(restful.happiness).toBeGreaterThan(flat.happiness)
  })

  it('makes a devoted pet fret, but keeps it tidier', () => {
    const devoted = drainOver('devoted', 1)
    const flat = drainOver(undefined, 1)
    expect(devoted.happiness).toBeLessThan(flat.happiness)
    expect(devoted.hygiene).toBeGreaterThan(flat.hygiene)
  })

  it('leaves an easygoing pet flat, since it settled on nothing', () => {
    expect(drainOver('easygoing', 1)).toEqual(drainOver(undefined, 1))
  })

  it('ignores a temperament on a pet that has not grown up', () => {
    const child = pet({ stage: 'child', temperament: 'lively' }, { happiness: 100 })
    const plain = pet({ stage: 'child' }, { happiness: 100 })
    tick(child, HOUR, ALWAYS_DAY)
    tick(plain, HOUR, ALWAYS_DAY)
    expect(child.stats.happiness).toBeCloseTo(plain.stats.happiness, 6)
  })

  it('only changes the slope, never the shape: nothing gains what it should lose', () => {
    for (const t of ['lively', 'restful', 'devoted'] as const) {
      const stats = drainOver(t, 1)
      expect(stats.hunger).toBeLessThan(100)
      expect(stats.happiness).toBeLessThan(100)
      expect(stats.energy).toBeLessThan(100)
      expect(stats.hygiene).toBeLessThan(100)
    }
  })
})

describe('health', () => {
  it('recovers while everything else is comfortable', () => {
    const p = pet({}, { hunger: 90, happiness: 90, energy: 90, hygiene: 90, health: 50 })
    tick(p, HOUR, ALWAYS_DAY)
    expect(p.stats.health).toBeCloseTo(50 + HEALTH_RECOVER_PER_HOUR, 4)
  })

  it('erodes while any one stat is at rock bottom', () => {
    for (const key of ['hunger', 'happiness', 'energy', 'hygiene'] as const) {
      const p = pet({}, { hunger: 90, happiness: 90, energy: 90, hygiene: 90, health: 60 })
      p.stats[key] = CRITICAL
      tick(p, HOUR, ALWAYS_DAY)
      expect(p.stats.health).toBeLessThan(60)
    }
  })

  it('erodes at the stated rate', () => {
    const p = pet({}, { hunger: 0, happiness: 90, energy: 90, hygiene: 90, health: 90 })
    tick(p, HOUR, ALWAYS_DAY)
    expect(p.stats.health).toBeCloseTo(90 - HEALTH_DAMAGE_PER_HOUR, 4)
  })

  it('never falls below the floor, because the pet cannot die', () => {
    // Lived through rather than caught up on: the offline path has a floor of
    // its own, so this has to be the live one to be about HEALTH_FLOOR at all.
    const p = pet({}, { hunger: 0, happiness: 0, energy: 0, hygiene: 0, health: 100 })
    const STEP = 4 * 60_000 // under a catch-up chunk, so it stays on the live path
    for (let i = 1; i <= 400; i++) tick(p, i * STEP, ALWAYS_DAY)
    expect(p.stats.health).toBe(HEALTH_FLOOR)
  })

  it('never rises above 100', () => {
    const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 99 })
    tick(p, 60_000, ALWAYS_DAY)
    expect(p.stats.health).toBeLessThanOrEqual(100)
  })
})

describe('sickness', () => {
  it('falls ill once health drops to the threshold, and counts it', () => {
    const p = pet({}, { hunger: 0, health: SICK_THRESHOLD + 1 })
    tick(p, HOUR, ALWAYS_DAY)
    expect(p.sick).toBe(true)
    expect(p.care.sicknessCount).toBe(1)
  })

  it('does not count the same illness twice while it lasts', () => {
    const p = pet({}, { hunger: 0, health: SICK_THRESHOLD + 1 })
    tick(p, HOUR, ALWAYS_DAY)
    tick(p, 2 * HOUR, ALWAYS_DAY)
    expect(p.care.sicknessCount).toBe(1)
  })

  it('has hysteresis, so it does not flicker around the threshold', () => {
    const p = pet({ sick: true }, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 })
    // Above sick, below recovered: still ill.
    p.stats.health = (SICK_THRESHOLD + RECOVERED_THRESHOLD) / 2
    tick(p, 1000, ALWAYS_DAY)
    expect(p.sick).toBe(true)
  })

  it('shakes it off once health climbs back past recovery', () => {
    const p = pet(
      { sick: true },
      { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: RECOVERED_THRESHOLD },
    )
    tick(p, 1000, ALWAYS_DAY)
    expect(p.sick).toBe(false)
  })

  it('counts a second illness after a recovery', () => {
    const p = pet({}, { hunger: 0, health: SICK_THRESHOLD + 1 })
    tick(p, HOUR, ALWAYS_DAY)
    p.stats.hunger = 100
    p.stats.happiness = 100
    p.stats.energy = 100
    p.stats.hygiene = 100
    tick(p, 10 * HOUR, ALWAYS_DAY)
    expect(p.sick).toBe(false)
    p.stats.hunger = 0
    tick(p, 20 * HOUR, ALWAYS_DAY)
    expect(p.care.sicknessCount).toBe(2)
  })
})

describe('the care record', () => {
  it('counts neglect seconds while any stat is at rock bottom', () => {
    const p = pet({}, { hunger: 0 })
    tick(p, 1000, ALWAYS_DAY)
    expect(p.care.neglectSeconds).toBeCloseTo(1, 4)
    expect(p.care.thrivingSeconds).toBe(0)
  })

  it('counts thriving seconds while everything is comfortable', () => {
    const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 })
    tick(p, 1000, ALWAYS_DAY)
    expect(p.care.thrivingSeconds).toBeCloseTo(1, 4)
    expect(p.care.neglectSeconds).toBe(0)
  })

  it('counts neither in the comfortable middle', () => {
    const middle = (CRITICAL + COMFORTABLE) / 2
    const p = pet({}, { hunger: middle, happiness: 100, energy: 100, hygiene: 100 })
    tick(p, 1000, ALWAYS_DAY)
    expect(p.care.neglectSeconds).toBe(0)
    expect(p.care.thrivingSeconds).toBe(0)
  })

  it('counts overtired seconds only while the pet is awake', () => {
    const awake = pet({}, { energy: 0 })
    const asleep = pet({ asleep: true }, { energy: 0 })
    tick(awake, 1000, ALWAYS_DAY)
    tick(asleep, 1000, ALWAYS_NIGHT)
    expect(awake.sleep.overtiredSeconds).toBeCloseTo(1, 4)
    expect(asleep.sleep.overtiredSeconds).toBe(0)
  })

  it('counts an egg as thriving, since nothing about it is going wrong', () => {
    const p = pet({ stage: 'egg', speciesId: 'egg' }, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 })
    tick(p, 1000, ALWAYS_DAY)
    expect(p.care.thrivingSeconds).toBeCloseTo(1, 4)
  })
})

describe('reconcile', () => {
  it('reports how long the player was away', () => {
    const p = pet()
    const result = reconcile(p, 3 * HOUR, ALWAYS_DAY)
    expect(result.awayMs).toBe(3 * HOUR)
    expect(result.simulatedMs).toBe(3 * HOUR)
    expect(result.truncated).toBe(false)
  })

  it('leaves the pet at the moment asked for', () => {
    const p = pet()
    reconcile(p, 9999, ALWAYS_DAY)
    expect(p.lastTick).toBe(9999)
  })

  it('does nothing for no time at all', () => {
    const p = pet({}, { hunger: 50 })
    const result = reconcile(p, 0, ALWAYS_DAY)
    expect(result).toEqual({ awayMs: 0, simulatedMs: 0, truncated: false })
    expect(p.stats.hunger).toBe(50)
  })

  it('treats a clock that jumped backwards as no time at all', () => {
    const p = pet({ lastTick: 5 * HOUR }, { hunger: 50 })
    const result = reconcile(p, HOUR, ALWAYS_DAY)
    expect(result.awayMs).toBe(0)
    expect(p.stats.hunger).toBe(50)
    expect(p.lastTick).toBe(HOUR)
  })

  it('follows the same curve a live session would, over the full-rate window', () => {
    const away = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 })
    const live = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 })
    reconcile(away, 2 * HOUR, ALWAYS_DAY)
    // The same two hours, a chunk at a time, without the offline path.
    for (let t = CATCHUP_CHUNK_MS; t <= 2 * HOUR; t += CATCHUP_CHUNK_MS) {
      tick(live, t, ALWAYS_DAY)
    }
    expect(away.stats.hunger).toBeCloseTo(live.stats.hunger, 4)
  })

  it('paces itself past the full-rate window, so a weekend is a setback not a ruin', () => {
    const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 100 })
    reconcile(p, AWAY_FULL_RATE_MS, ALWAYS_DAY)
    const afterFullRate = p.stats.hunger

    const q = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 100 })
    reconcile(q, AWAY_FULL_RATE_MS + HOUR, ALWAYS_DAY)
    const extra = afterFullRate - q.stats.hunger
    // That extra hour cost only its slowed share.
    expect(extra).toBeGreaterThan(0)
    expect(extra).toBeLessThan(-DECAY_AWAKE.hunger)
  })

  it('never lets an absence carry a stat below the away floor', () => {
    const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 100 })
    reconcile(p, 30 * 24 * HOUR, ALWAYS_DAY)
    for (const key of ['hunger', 'happiness', 'hygiene'] as const) {
      expect(p.stats[key]).toBeGreaterThanOrEqual(AWAY_FLOOR)
    }
    expect(p.stats.health).toBeGreaterThanOrEqual(AWAY_HEALTH_FLOOR)
  })

  it('leaves a long absence reading as needing you, below critical', () => {
    const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 })
    reconcile(p, 24 * HOUR, ALWAYS_DAY)
    expect(p.stats.hunger).toBeLessThan(CRITICAL)
  })

  it('never hands back a stat the pet had already spent', () => {
    // Coming home to a pet in better shape than you left it would be a bug you
    // could farm: shut the lid on an empty pet and open it on a fed one.
    const p = pet({}, { hunger: 4, happiness: 3, energy: 2, hygiene: 1, health: 10 })
    reconcile(p, 48 * HOUR, ALWAYS_DAY)
    expect(p.stats.hunger).toBeLessThanOrEqual(4)
    expect(p.stats.happiness).toBeLessThanOrEqual(3)
    expect(p.stats.energy).toBeLessThanOrEqual(2)
    expect(p.stats.hygiene).toBeLessThanOrEqual(1)
    expect(p.stats.health).toBeLessThanOrEqual(10)
  })

  it('does not hold a weekend against the pet"s upbringing', () => {
    const p = pet({}, { hunger: 0, happiness: 0, energy: 0, hygiene: 0 })
    reconcile(p, 72 * HOUR, ALWAYS_DAY)
    // Only the full-rate stretch counts toward the record.
    expect(p.care.neglectSeconds).toBeLessThanOrEqual(AWAY_FULL_RATE_MS / 1000 + 1)
  })

  it('caps the work it will do, and says so', () => {
    const p = pet()
    const enormous = (MAX_CATCHUP_CHUNKS + 500) * CATCHUP_CHUNK_MS
    const result = reconcile(p, enormous, ALWAYS_DAY)
    expect(result.truncated).toBe(true)
    expect(result.simulatedMs).toBe(MAX_CATCHUP_CHUNKS * CATCHUP_CHUNK_MS)
    expect(result.awayMs).toBe(enormous)
    // The clock still lands on now, so the pet is never stuck in the past.
    expect(p.lastTick).toBe(enormous)
  })

  it('does not report truncation when the absence fits', () => {
    expect(reconcile(pet(), MAX_CATCHUP_CHUNKS * CATCHUP_CHUNK_MS, ALWAYS_DAY).truncated).toBe(false)
  })

  it('finishes a decade away in reasonable time, rather than hanging the boot', () => {
    const started = Date.now()
    reconcile(pet(), 10 * 365 * 24 * HOUR, ALWAYS_DAY)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('wakes a pet left asleep at the dawn it would have woken at', () => {
    // Day for the first chunk, night after: the pet must take its chance.
    let calls = 0
    const dawnThenNight: Daylight = () => ++calls <= 1
    const p = pet({ asleep: true }, { energy: 100 })
    reconcile(p, 3 * CATCHUP_CHUNK_MS, dawnThenNight)
    expect(p.asleep).toBe(false)
  })

  it('ages the pet across an absence, so it can grow up while you are gone', () => {
    const p = pet()
    reconcile(p, 4 * HOUR, ALWAYS_DAY)
    expect(p.ageMs).toBeCloseTo(4 * HOUR, 0)
  })

  it('handles a gap smaller than one chunk', () => {
    const p = pet({}, { hunger: 100 })
    const result = reconcile(p, 1000, ALWAYS_DAY)
    expect(result.simulatedMs).toBe(1000)
    expect(p.stats.hunger).toBeLessThan(100)
  })

  it('slows by the stated pace once the window is behind it', () => {
    const spent = (awayMs: number) => {
      const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 100 })
      reconcile(p, awayMs, ALWAYS_DAY)
      return 100 - p.stats.hunger
    }
    const window = spent(AWAY_FULL_RATE_MS)
    const oneMore = spent(AWAY_FULL_RATE_MS + CATCHUP_CHUNK_MS)
    const fullRateChunk = spent(CATCHUP_CHUNK_MS)
    expect(oneMore - window).toBeCloseTo(fullRateChunk * AWAY_SLOW_PACE, 4)
  })

  it('measures the pace window from the start of each absence, not the clock', () => {
    // Two short absences are two short absences, however late in the day they
    // happen -- coming back briefly should not put the pet into slow time.
    const early = pet({ lastTick: 0 }, { hunger: 100 })
    reconcile(early, CATCHUP_CHUNK_MS, ALWAYS_DAY)
    const late = pet({ lastTick: 100 * HOUR }, { hunger: 100 })
    reconcile(late, 100 * HOUR + CATCHUP_CHUNK_MS, ALWAYS_DAY)
    expect(late.stats.hunger).toBeCloseTo(early.stats.hunger, 6)
  })
})

describe('sleepThrough', () => {
  it('rests the pet without ageing it, so a nap cannot skip a whole stage', () => {
    const p = pet({ asleep: true }, { energy: 0 })
    sleepThrough(p, 4)
    expect(p.stats.energy).toBeGreaterThan(0)
    expect(p.ageMs).toBe(0)
  })

  it('never wakes the pet mid-skip, however rested', () => {
    const p = pet({ asleep: true }, { energy: 99 })
    sleepThrough(p, 8)
    expect(p.asleep).toBe(true)
  })

  it('applies the same rates a slept hour would', () => {
    const skipped = pet({ asleep: true }, { hunger: 100, energy: 0 })
    const lived = pet({ asleep: true }, { hunger: 100, energy: 0 })
    sleepThrough(skipped, 1)
    tick(lived, HOUR, ALWAYS_NIGHT)
    expect(skipped.stats.hunger).toBeCloseTo(lived.stats.hunger, 4)
    expect(skipped.stats.energy).toBeCloseTo(lived.stats.energy, 4)
  })

  it('does nothing for no hours', () => {
    const p = pet({ asleep: true }, { energy: 50 })
    sleepThrough(p, 0)
    expect(p.stats.energy).toBe(50)
  })
})

describe('mood', () => {
  it('is 1 for a pet with everything full', () => {
    expect(mood(pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 100 }))).toBe(1)
  })

  it('is at its lowest for a pet with nothing', () => {
    const p = pet({}, { hunger: 0, happiness: 0, energy: 0, hygiene: 0, health: HEALTH_FLOOR })
    expect(mood(p)).toBeCloseTo((HEALTH_FLOOR / 100) * 0.3, 6)
  })

  it('stays inside 0..1 for anything a pet can be', () => {
    for (const v of [0, 1, 25, 50, 99, 100]) {
      const m = mood(pet({}, { hunger: v, happiness: v, energy: v, hygiene: v, health: v }))
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThanOrEqual(1)
    }
  })

  it('weighs health at three tenths', () => {
    const full = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 100 })
    const ill = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 0 })
    expect(mood(full) - mood(ill)).toBeCloseTo(0.3, 6)
  })
})

describe('urgentNeeds', () => {
  it('is empty for a comfortable pet', () => {
    expect(urgentNeeds(pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100 }))).toEqual([])
  })

  it('names every stat at or below critical', () => {
    const p = pet({}, { hunger: CRITICAL, happiness: 100, energy: 5, hygiene: 100, health: 100 })
    expect(urgentNeeds(p).sort()).toEqual(['energy', 'hunger'])
  })

  it('puts the worst first, so the pet asks for what it most needs', () => {
    const p = pet({}, { hunger: 10, happiness: 2, energy: 6, hygiene: 100, health: 100 })
    expect(urgentNeeds(p)).toEqual(['happiness', 'energy', 'hunger'])
  })

  it('includes health when it is critical too', () => {
    const p = pet({}, { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 10 })
    expect(urgentNeeds(p)).toEqual(['health'])
  })
})

resetIdSource()
