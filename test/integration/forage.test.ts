import { describe, expect, it } from 'vitest'
import { DEFAULT_START, harness, type Harness } from '../harness'
import { emptySave, flushSave } from '../../src/game/save'
import { MEADOW_GROUNDS, type Ground } from '../../src/data/grounds'
import { LARDER_CAP } from '../../src/game/larder'
import { YARD_CAPACITY } from '../../src/game/yard'
import { VERGE_SLOTS } from '../../src/data/biome'
import { CURIOS, TRADE_COST } from '../../src/data/curios'
import { KIT, type KitId } from '../../src/data/kit'
import { draw } from '../screens'
import { drawScreen } from '../../src/ui/draw'
import { isNight, worldAt } from '../../src/game/world'
import type { WeatherId } from '../../src/data/seasons'
import { fakeHud } from '../fake-hud'

/**
 * The adult's job, through the app rather than through the Forage class: the
 * menu of places, the trip itself, and what the trip changes about the save.
 * The failure that matters most here is a pet that is sent out and never comes
 * back -- the yard would be empty and every button would refuse.
 */

/** Runs frames until the trip is over, or fails loudly. */
function runTrip(h: Harness, answer?: 'b' | 'c'): Harness {
  for (let i = 0; i < 60 * 120; i++) {
    if (answer && h.app.forageChoosing) h.tap(answer)
    h.advance(1 / 60, 1 / 60)
    if (h.app.mode === 'main' && h.app.forageBeats.length === 0 && !h.app.visual.foraging) {
      return h
    }
  }
  throw new Error('the pet never came home')
}

/** A fixed world, so a drawn screen does not depend on the sky. */
const world = worldAt(0)

/** A grown pet with the energy for any ground. */
function grownUp(options: Parameters<typeof harness>[0] = {}): Harness {
  const h = harness(options).start().growTo('adult')
  h.pet.stats.energy = 100
  return h
}

/**
 * A save with the whole kit already found, for tests about something else.
 * A trip that could turn up kit turns up kit instead of a curio, and the world
 * these tests start in is a dark one -- which is a torch waiting to happen.
 */
const fullKit = () => ({ ...emptySave(), kit: KIT.map((item) => item.id) })

/** Sends the pet to a named ground, whatever the cursor was on. */
function sendTo(h: Harness, ground: string): Harness {
  h.select('forage')
  // Bounded rather than looped until it matches: a ground the pet cannot
  // actually be sent to -- one belonging to somewhere it does not live -- used
  // to spin here until the heap gave out instead of failing the test.
  for (let step = 0; step < h.app.grounds.length; step++) {
    if (h.app.grounds[h.app.groundIndex]!.id === ground) {
      h.tap('b')
      return h
    }
    h.tap('c')
  }
  throw new Error(`no ${ground} on this menu`)
}

describe('the grounds menu', () => {
  it('refuses a pet too young to be sent anywhere', () => {
    const h = harness().start().growTo('baby')
    h.clearCalls().select('forage')
    expect(h.app.mode).toBe('main')
    expect(h.app.message).toBe('NOT OLD ENOUGH')
  })

  it('offers a child exactly one ground', () => {
    const h = harness().start().growTo('child')
    expect(h.app.grounds.map((g) => g.id)).toEqual(['wall'])
    h.select('forage')
    expect(h.app.mode).toBe('grounds')
  })

  it('offers an adult every ground', () => {
    expect(grownUp().app.grounds).toEqual(MEADOW_GROUNDS)
  })

  it('has no grounds to offer when there is no pet', () => {
    const h = harness().boot()
    expect(h.app.grounds).toEqual([])
  })

  it('refuses a sleeping pet', () => {
    const h = grownUp()
    h.pet.asleep = true
    h.clearCalls().select('forage')
    expect(h.app.message).toContain('ASLEEP')
  })

  it('refuses a poorly pet', () => {
    const h = grownUp()
    h.pet.sick = true
    h.clearCalls().select('forage')
    expect(h.app.message).toBe('TOO POORLY')
  })

  it('refuses a pet that is already out', () => {
    const h = grownUp()
    h.select('forage')
    h.tap('b')
    h.advance(0.5)
    h.clearCalls().select('forage')
    expect(h.app.message).toBe('ALREADY OUT')
  })

  it('moves through the menu both ways and wraps', () => {
    const h = grownUp()
    h.select('forage')
    h.tap('c')
    expect(h.app.groundIndex).toBe(1)
    h.tap('a').tap('a')
    expect(h.app.groundIndex).toBe(MEADOW_GROUNDS.length - 1)
  })

  it('clamps the cursor when a shorter menu is opened', () => {
    const h = grownUp()
    h.select('forage')
    while (h.app.groundIndex !== h.app.grounds.length - 1) h.tap('c')
    h.holdBack()
    // A younger pet has one ground; the cursor must not point past it.
    h.pet.stage = 'child'
    h.select('forage')
    expect(h.app.groundIndex).toBeLessThan(h.app.grounds.length)
    expect(() => h.tap('b')).not.toThrow()
  })

  it('reads each ground against the day, which is the whole choice', () => {
    const h = grownUp()
    for (const ground of h.app.grounds) {
      expect(['good', 'fair', 'poor']).toContain(h.app.prospect(ground))
    }
  })

  it('refuses to send a pet that has not the energy for the walk', () => {
    const h = grownUp()
    h.pet.stats.energy = 5
    h.select('forage')
    h.clearCalls().tap('b')
    expect(h.app.message).toBe('TOO TIRED FOR THAT')
    expect(h.app.mode).toBe('grounds')
  })
})

describe('a trip', () => {
  it('sends the pet off, at a cost, and says so', () => {
    const h = grownUp()
    const before = h.pet.stats.energy
    h.select('forage')
    h.clearCalls().tap('b')
    expect(h.app.mode).toBe('main')
    expect(h.pet.stats.energy).toBeLessThan(before)
    expect(h.app.tickerText).toContain('HAS GONE LOOKING')
  })

  it('puts the trip screen up while the pet is out of sight', () => {
    const h = grownUp()
    h.select('forage')
    h.tap('b')
    h.until('the trip screen', () => h.app.mode === 'forage')
    expect(h.app.forageBeats.length).toBeGreaterThan(0)
    expect(h.app.visual.foraging).toBe(true)
  })

  it('comes home, from every ground, on any dice', () => {
    for (const ground of MEADOW_GROUNDS) {
      for (let seed = 0; seed < 4; seed++) {
        const h = grownUp({ random: seed })
        sendTo(h, ground.id)
        runTrip(h)
        expect(h.app.mode, `${ground.id} seed ${seed}`).toBe('main')
        expect(h.app.visual.foraging).toBe(false)
        expect(h.app.forageDim).toBe(0)
      }
    }
  })

  it('winds the world clock on by the time the trip took', () => {
    const h = grownUp()
    const before = h.app.worldOffset
    h.select('forage')
    h.tap('b')
    runTrip(h)
    expect(h.app.worldOffset).toBeGreaterThan(before)
  })

  it('lets the player send it on further, at a price', () => {
    const h = grownUp()
    sendTo(h, 'hill')
    h.until('the prompt', () => h.app.forageChoosing, 60)
    const cost = h.app.foragePushCost
    const energy = h.pet.stats.energy
    expect(cost).toBeGreaterThan(0)
    expect(h.app.forageChooseProgress).toBeGreaterThan(0)
    h.clearCalls().tap('b')
    expect(h.pet.stats.energy).toBe(energy - cost)
    expect(h.soundsPlayed()).toContain('confirm')
  })

  it('lets the player call it home', () => {
    const h = grownUp()
    sendTo(h, 'hill')
    h.until('the prompt', () => h.app.forageChoosing, 60)
    h.clearCalls().tap('c')
    expect(h.soundsPlayed()).toContain('cancel')
    runTrip(h)
    expect(h.app.mode).toBe('main')
  })

  it('refuses to push a pet with nothing left to spend, without stranding it', () => {
    const h = grownUp()
    sendTo(h, 'hill')
    h.until('the prompt', () => h.app.forageChoosing, 60)
    h.pet.stats.energy = 0
    h.clearCalls().tap('b')
    expect(h.app.message).toBe('TOO TIRED TO GO ON')
    runTrip(h)
    expect(h.app.mode).toBe('main')
  })

  it('ignores a button that means nothing while the pet is out', () => {
    const h = grownUp()
    h.select('forage')
    h.tap('b')
    h.until('the trip screen', () => h.app.mode === 'forage')
    const beats = h.app.forageBeats.length
    h.tap('a')
    expect(h.app.forageBeats.length).toBe(beats)
    expect(h.app.mode).toBe('forage')
  })

  it('finishes its walk home even when an evolution interrupts it', () => {
    const h = grownUp()
    h.pet.temperament = 'devoted'
    h.select('forage')
    h.tap('b')
    h.until('the trip screen', () => h.app.mode === 'forage')
    // The pet comes of age mid-trip.
    h.pet.ageMs = 1e12
    for (let i = 0; i < 60 * 120 && h.app.visual.foraging; i++) {
      if (h.app.mode === 'evolve') h.tap('b')
      h.advance(1 / 60, 1 / 60)
    }
    expect(h.app.visual.foraging).toBe(false)
  })

  it('can bring back a curio, which lands on the collection board', () => {
    // Every roll at zero: no mishap, a find, and the luck check passes. The
    // kit is owned outright so that the trip cannot come home with a torch
    // instead -- the world starts these tests after dark, and a dark trip is
    // exactly the kind that turns one up.
    const h = grownUp({ random: () => 0, save: fullKit() })
    h.select('forage')
    h.tap('b')
    runTrip(h, 'c')
    expect(Object.keys(h.app.curioCounts).length).toBe(1)
    expect(h.app.curioTally.total).toBe(1)
    expect(h.app.forageFound).not.toBeUndefined()
  })

  it('can bring back a piece of kit, which the family keeps', () => {
    // The world starts these tests after dark, and the dark is what a torch is
    // for -- so this is the trip that turns one up, on dice that always find.
    const h = grownUp({ random: () => 0 })
    h.select('forage')
    h.tap('b')
    runTrip(h, 'c')
    expect(h.app.kitOwned).toEqual(['torch'])
    expect(h.app.kitTally).toEqual({ owned: 1, of: KIT.length })
    expect(h.app.forageKit?.id).toBe('torch')
    // Kit is the whole story of the trip it comes home on, so the board does
    // not also gain a curio for it.
    expect(h.app.curioTally.total).toBe(0)
  })

  it('says what it found, and never finds the same thing twice', () => {
    const h = grownUp({ random: () => 0 })
    h.select('forage')
    h.tap('b')
    runTrip(h, 'c')
    h.until('the news of it', () => h.app.tickerText.includes('FOUND A TORCH'))

    h.pet.stats.energy = 100
    h.select('forage')
    h.tap('b')
    runTrip(h, 'c')
    expect(h.app.kitOwned).toEqual(['torch'])
  })

  it('saves the kit, so it outlives the tab', () => {
    const h = grownUp({ random: () => 0 })
    h.select('forage')
    h.tap('b')
    runTrip(h, 'c')
    flushSave()
    expect(h.stored()!.kit).toEqual(['torch'])
  })

  it('saves what it brought home', () => {
    const h = grownUp({ random: () => 0, save: fullKit() })
    h.select('forage')
    h.tap('b')
    runTrip(h, 'c')
    flushSave()
    expect(Object.keys(h.stored()!.curios).length).toBe(1)
  })
})

describe('what the trip changes', () => {
  /** Sends the pet out over and over, answering the prompt the same way. */
  function forageRepeatedly(h: Harness, trips: number, answer: 'b' | 'c', until = () => false) {
    for (let trip = 0; trip < trips && !until(); trip++) {
      h.pet.stats.energy = 100
      h.pet.sick = false
      h.select('forage')
      h.tap('b')
      runTrip(h, answer)
    }
    return h
  }

  it('fills the larder, and never past its cap', () => {
    const h = forageRepeatedly(grownUp({ random: () => 0.3 }), 24, 'c')
    const larder = h.app.larder
    expect(Object.keys(larder).length).toBeGreaterThan(0)
    for (const [id, count] of Object.entries(larder)) {
      expect(count, id).toBeGreaterThan(0)
      expect(count, id).toBeLessThanOrEqual(LARDER_CAP)
    }
  })

  it('plants a seed on a pushed trip, and the yard starts it small', () => {
    // Under the yard chance of 0.35, so a pushed trip brings a seed back.
    const h = grownUp({ random: () => 0.3 })
    forageRepeatedly(h, 16, 'b', () => h.app.planted.length > 0)
    expect(h.app.planted.length).toBeGreaterThan(0)
    const planting = h.app.planted[0]!
    expect(planting.growth).toBe(0)
    expect(VERGE_SLOTS).toContain(planting.x)
  })

  it('never plants more than the yard holds, or two things on one spot', () => {
    const h = forageRepeatedly(grownUp({ random: () => 0.3 }), 40, 'b')
    expect(h.app.planted.length).toBeLessThanOrEqual(YARD_CAPACITY)
    expect(h.app.planted.length).toBeLessThanOrEqual(VERGE_SLOTS.length)
    const spots = h.app.planted.map((p) => p.x)
    expect(new Set(spots).size).toBe(spots.length)
  })

  it('keeps the yard when the pet is retired, since a garden outlives a life', () => {
    const h = grownUp({ random: () => 0.3 })
    forageRepeatedly(h, 16, 'b', () => h.app.planted.length > 0)
    const planted = h.app.planted.length
    expect(planted).toBeGreaterThan(0)
    h.select('status').holdRetire()
    h.tap('b')
    expect(h.app.planted).toHaveLength(planted)
  })

  it('never befriends the same visitor twice', () => {
    const h = forageRepeatedly(grownUp({ random: () => 0.3 }), 40, 'b')
    expect(new Set(h.app.regulars).size).toBe(h.app.regulars.length)
  })

  it('leaves the pet no worse off than tired, however many trips it makes', () => {
    const h = forageRepeatedly(grownUp({ random: () => 0.3 }), 30, 'b')
    // Every stat still inside its bounds: a trip must never corrupt a stat.
    for (const value of Object.values(h.pet.stats)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})

describe('a pet that goes away mid-trip', () => {
  /**
   * A trip outlives the screen it was started from -- that is the point of it,
   * so an evolution part way through does not strand the pet over the hill. It
   * turned out to outlive the pet as well. Every beat of the journey reads the
   * pet to work out how the walk is going, so once the ceremony was dismissed
   * the next frame threw, which is the frame that draws the naming screen for
   * the egg that was meant to follow.
   *
   * Both tests below wait for the journey proper before taking the pet away. A
   * trip still walking out is safe by accident: it is waiting to be told the
   * pet is over the hill, nobody is left to tell it, and it stalls where it
   * stands. The one that breaks is the one already underway.
   */
  const underway = (h: Harness): boolean => h.app.forageBeats.length > 0

  it('survives being retired while it is still out', () => {
    // The status screen is reachable from the yard, and the trip carries on
    // behind it: the pet is over the hill while the player reads its record.
    const h = grownUp()
    sendTo(h, MEADOW_GROUNDS[0]!.id)
    h.select('status')
    h.until('the trip to be underway', () => underway(h), 30)
    h.holdRetire()
    h.tap('b')
    expect(h.app.pet).toBeNull()
    expect(() => h.advance(10)).not.toThrow()
  })

  it('survives the whole lineage being started over while it is still out', () => {
    // NEW PET is a button on the page rather than one on the shell, so unlike
    // everything else it can be pressed while the trip screen is up.
    const h = grownUp()
    sendTo(h, MEADOW_GROUNDS[0]!.id)
    h.until('the trip to be underway', () => underway(h), 30)
    expect(h.app.mode).toBe('forage')
    h.app.restart()
    expect(h.app.pet).toBeNull()
    expect(() => h.advance(10)).not.toThrow()
  })

  it('leaves nothing of the trip behind for the next pet', () => {
    // What it was carrying goes with it. A beat left on the screen, or a curio
    // left in hand, would be the last pet's trip handed to the next one.
    const h = grownUp()
    sendTo(h, MEADOW_GROUNDS[0]!.id)
    h.until('the trip to be underway', () => underway(h), 30)
    h.app.restart()
    h.advance(1)
    expect(h.app.forageBeats).toEqual([])
    expect(h.app.forageFound).toBeNull()
    expect(h.app.visual.foraging).toBe(false)
    expect(h.app.forageDim).toBe(0)
  })
})

/**
 * A world offset that lands the day on a particular sky, so a test about the
 * kit can have the weather the kit is for. Stepped by the weather spell rather
 * than by the day, since the sky turns more than once a day.
 */
function offsetWith(want: { season?: string; weather?: WeatherId; night?: boolean }): number {
  for (let step = 0; step < 4000; step++) {
    const offset = step * 60_000
    const at = DEFAULT_START + offset
    const world = worldAt(at)
    if (want.season && world.season.id !== want.season) continue
    if (want.weather && world.weather !== want.weather) continue
    if (want.night !== undefined && isNight(at) !== want.night) continue
    return offset
  }
  throw new Error(`no day with ${JSON.stringify(want)}`)
}

describe('what the kit is worth', () => {
  /** An adult living on a day of the given sky, with the given kit. */
  const kitted = (kit: KitId[], want: { season?: string; weather?: WeatherId; night?: boolean }) =>
    harness({ save: { ...emptySave(), kit, worldOffset: offsetWith(want) } })
      .start()
      .growTo('adult')

  it('reads a wet day differently with an umbrella, and says which', () => {
    const hill = MEADOW_GROUNDS.find((g) => g.id === 'hill')!
    const bare = kitted([], { weather: 'rain' })
    expect(bare.app.prospect(hill)).toBe('poor')
    expect(bare.app.prospectKit(hill)).toBeNull()

    const withOne = kitted(['umbrella'], { weather: 'rain' })
    expect(withOne.app.prospect(hill)).toBe('fair')
    expect(withOne.app.prospectKit(hill)?.id).toBe('umbrella')
  })

  it('says nothing on a ground the kit had nothing to do with', () => {
    const wall = MEADOW_GROUNDS.find((g) => g.id === 'wall')!
    const h = kitted(['umbrella'], { weather: 'rain' })
    // The old wall minds neither the season nor the sky, so it was already
    // fair and the umbrella cannot take the credit for it.
    expect(h.app.prospect(wall)).toBe('fair')
    expect(h.app.prospectKit(wall)).toBeNull()
  })

  it('lets waders stand in a creek on a dry day', () => {
    const creek = MEADOW_GROUNDS.find((g) => g.id === 'creek')!
    expect(kitted([], { weather: 'clear' }).app.prospect(creek)).toBe('poor')
    const h = kitted(['waders'], { weather: 'clear' })
    expect(h.app.prospect(creek)).toBe('fair')
    expect(h.app.prospectKit(creek)?.id).toBe('waders')
  })

  it('puts the reading on the menu where the player is choosing', () => {
    const h = kitted(['umbrella'], { weather: 'rain' })
    h.pet.stats.energy = 100
    h.select('forage')
    expect(h.app.mode).toBe('grounds')
    expect(draw(h).said()).toContain('(UMBRELLA)')
  })

  it('credits nobody when it took two things together to lift the read', () => {
    // No ground today wants both a season and a sky. One that did would be
    // poor twice over on the wrong day, and neither the hat nor the umbrella
    // could lift it alone -- so the menu says nothing rather than picking one
    // of them and taking its name in vain.
    const fussy: Ground = {
      ...MEADOW_GROUNDS[0]!,
      seasons: ['autumn'],
      weather: ['clear'],
    }
    const h = kitted(['hat', 'umbrella'], { season: 'winter', weather: 'snow' })
    // Snow is not wet, so bring the umbrella's weather along by hand: what is
    // being tested is the pair, not which day the pair happens on.
    const wet = kitted(['hat', 'umbrella'], { season: 'winter', weather: 'mist' })
    expect(h.app.prospect(fussy)).toBe('poor')
    expect(wet.app.prospect(fussy)).toBe('fair')
    expect(wet.app.prospectKit(fussy)).toBeNull()
  })

  it('warns about the dark, and says when there is a light for it', () => {
    // The one place the kit makes things worse rather than better, so it is
    // said out loud on the screen where the trip is chosen.
    const dark = offsetWith({ night: true })
    const bare = harness({ save: { ...emptySave(), worldOffset: dark } }).start().growTo('adult')
    bare.pet.stats.energy = 100
    bare.select('forage')
    expect(draw(bare).said()).toContain('DARK OUT: PUSHING ON IS RISKIER')

    const lit = harness({ save: { ...emptySave(), kit: ['torch'], worldOffset: dark } })
      .start()
      .growTo('adult')
    lit.pet.stats.energy = 100
    lit.select('forage')
    const said = draw(lit).said()
    expect(said).toContain('THE TORCH IS LIT')
    expect(said).not.toContain('DARK OUT: PUSHING ON IS RISKIER')
  })

  it('says nothing about the dark in broad daylight', () => {
    const h = harness({ save: { ...emptySave(), worldOffset: offsetWith({ night: false }) } })
      .start()
      .growTo('adult')
    h.pet.stats.energy = 100
    h.select('forage')
    const said = draw(h).said()
    expect(said).not.toContain('DARK OUT: PUSHING ON IS RISKIER')
    expect(said).not.toContain('THE TORCH IS LIT')
  })

  it('names the board that made one more leg cheap', () => {
    const snowy = { season: 'winter', weather: 'snow' as WeatherId }
    const bare = kitted([], snowy)
    expect(bare.app.foragePushKit).toBeNull()

    const h = kitted(['snowboard'], snowy)
    expect(h.app.foragePushKit?.id).toBe('snowboard')

    // And on a day the board is no use, it takes no credit.
    expect(kitted(['snowboard'], { weather: 'rain' }).app.foragePushKit).toBeNull()
  })

  it('puts the discount on the prompt that offers the leg', () => {
    // A cheap push is invisible as a number: the player has no baseline to
    // compare it against, so the prompt has to name what made it cheap.
    const h = kitted(['snowboard'], { season: 'winter', weather: 'snow' })
    h.pet.stats.energy = 100
    h.select('forage')
    h.tap('b')
    for (let i = 0; i < 60 * 120 && !h.app.forageChoosing; i++) h.advance(1 / 60, 1 / 60)
    expect(h.app.forageChoosing).toBe(true)
    expect(draw(h).said()).toContain(`B GO ON (-${h.app.foragePushCost} SNOWBOARD)   C HOME`)
  })

  it('keeps the pet warm in a bobble hat, without burning the kindling for it', () => {
    const h = kitted(['hat'], { season: 'winter' })
    h.app.larder.kindling = 2
    h.pet.stats.energy = 20
    h.select('sleep')
    expect(h.pet.asleep).toBe(true)
    expect(h.pet.warm).toBe(true)
    // The fire it did not have to bank is still in the larder for a night
    // that needs one.
    expect(h.app.larder.kindling).toBe(2)
    h.until('the news of it', () => h.app.tickerText.includes('PULLS ITS HAT DOWN'))
  })

  it('still burns the kindling out of season, since a hat is for the cold', () => {
    const h = kitted(['hat'], { season: 'summer' })
    h.app.larder.kindling = 2
    h.pet.stats.energy = 20
    h.select('sleep')
    expect(h.pet.warm).toBe(true)
    expect(h.app.larder.kindling).toBe(1)
  })
})

describe('the collection board', () => {
  const withCurios = (curios: Record<string, number>) =>
    harness({ save: { ...emptySave(), curios } }).start()

  const cursorTo = (h: Harness, id: string) => {
    h.select('status')
    h.tap('a')
    // Bounded by the board rather than by the curios: the cursor runs on into
    // the kit, and walking off the end of the curios used to throw here.
    for (let step = 0; step < CURIOS.length && CURIOS[h.app.curioIndex]?.id !== id; step++) {
      h.tap('c')
    }
    return h
  }

  it('moves through the board both ways and wraps', () => {
    const h = harness().start()
    h.select('status')
    h.tap('a')
    expect(h.app.mode).toBe('curios')
    h.tap('c')
    expect(h.app.curioIndex).toBe(1)
    // One cursor for the whole board, so walking back off the first curio
    // arrives at the last piece of kit rather than the last curio.
    h.tap('a').tap('a')
    expect(h.app.curioIndex).toBe(CURIOS.length + KIT.length - 1)
    expect(h.app.boardSlot.kind).toBe('kit')
  })

  it('knows which half of the board the cursor is on', () => {
    const h = harness().start()
    h.select('status')
    h.tap('a')
    expect(h.app.boardSlot).toEqual({ kind: 'curio', curio: CURIOS[0], held: 0 })
    for (let i = 0; i < CURIOS.length; i++) h.tap('c')
    expect(h.app.boardSlot).toEqual({ kind: 'kit', item: KIT[0], owned: false })
  })

  it('has nothing to trade on a piece of kit, and says so rather than refusing quietly', () => {
    const h = withCurios({ pebble: 9 })
    h.select('status')
    h.tap('a')
    for (let i = 0; i < CURIOS.length; i++) h.tap('c')
    expect(h.app.canTrade).toBe(false)
    h.tap('b')
    expect(h.app.message).toBe('NOTHING TO TRADE HERE')
    expect(h.app.curioCounts.pebble).toBe(9)
  })

  it('reports the tally', () => {
    expect(withCurios({ pebble: 3, feather: 1 }).app.curioTally).toEqual({ kinds: 2, total: 4 })
    expect(withCurios({}).app.curioTally).toEqual({ kinds: 0, total: 0 })
  })

  it('reports which sets the lineage has completed', () => {
    const stones = Object.fromEntries(
      CURIOS.filter((c) => c.set === 'stones').map((c) => [c.id, 1]),
    )
    expect(withCurios(stones).app.boons).toEqual(['stones'])
    expect(withCurios({}).app.boons).toEqual([])
  })

  it('offers the rarest missing thing as what spares would buy', () => {
    const h = withCurios({ pebble: 5 })
    expect(h.app.tradeFor).not.toBeNull()
    expect(h.app.tradeFor!.id).not.toBe('pebble')
  })

  it('trades three spares for one of what the board is missing', () => {
    const h = cursorTo(withCurios({ pebble: 5 }), 'pebble')
    expect(h.app.canTrade).toBe(true)
    const want = h.app.tradeFor!
    h.clearCalls().tap('b')
    expect(h.app.curioCounts.pebble).toBe(5 - TRADE_COST)
    expect(h.app.curioCounts[want.id]).toBe(1)
    expect(h.burstsFired()).toContain('sparkle')
  })

  it('refuses a trade the player cannot afford, and says what it would cost', () => {
    const h = cursorTo(withCurios({ pebble: 2 }), 'pebble')
    expect(h.app.canTrade).toBe(false)
    h.clearCalls().tap('b')
    expect(h.app.message).toContain(`NEEDS ${TRADE_COST + 1}`)
    expect(h.app.curioCounts.pebble).toBe(2)
  })

  it('refuses a trade that would spend the last of a kind', () => {
    // Spending all three would take the pebble back off the board, un-finding
    // something already found -- and could break a completed set with it.
    const h = cursorTo(withCurios({ pebble: TRADE_COST }), 'pebble')
    h.tap('b')
    expect(h.app.curioCounts.pebble).toBe(TRADE_COST)
  })

  it('only offers a trade it will actually make', () => {
    // The screen draws its prompt from `canTrade` and the button runs `trade`.
    // They were tested apart and drifted a step out of step, so at exactly
    // three of a kind the footer said "B TRADE 3 FOR ..." and pressing B
    // refused. Testing each half against its own idea of correct is what let
    // that through, so this asserts the two agree rather than asserting either.
    for (let held = 0; held <= TRADE_COST + 3; held++) {
      const h = cursorTo(withCurios({ pebble: held }), 'pebble')
      const advertised = h.app.canTrade
      h.tap('b')
      const traded = (h.app.curioCounts.pebble ?? 0) !== held
      expect(traded, `held ${held}: offered ${advertised} but traded ${traded}`).toBe(advertised)
    }
  })

  it('makes the same promise for every curio on the board', () => {
    const stocked = Object.fromEntries(CURIOS.map((c) => [c.id, TRADE_COST]))
    // One short of the whole board, so there is always something to want.
    delete stocked.geode
    for (const curio of CURIOS) {
      if (curio.id === 'geode') continue
      for (const held of [TRADE_COST, TRADE_COST + 1]) {
        const h = cursorTo(withCurios({ ...stocked, [curio.id]: held }), curio.id)
        const advertised = h.app.canTrade
        h.tap('b')
        const traded = (h.app.curioCounts[curio.id] ?? 0) !== held
        expect(traded, `${curio.id} at ${held}`).toBe(advertised)
      }
    }
  })

  it('needs one more than the trade costs, so the board never goes backwards', () => {
    const h = cursorTo(withCurios({ pebble: TRADE_COST }), 'pebble')
    expect(h.app.canTrade).toBe(false)
    const enough = cursorTo(withCurios({ pebble: TRADE_COST + 1 }), 'pebble')
    expect(enough.app.canTrade).toBe(true)
    enough.tap('b')
    // The one left behind keeps the pebble on the board.
    expect(enough.app.curioCounts.pebble).toBe(1)
    expect(enough.app.curioTally.kinds).toBe(2)
  })

  it('never lets a trade break a set the lineage had completed', () => {
    const stones = CURIOS.filter((c) => c.set === 'stones')
    const counts = Object.fromEntries(stones.map((c) => [c.id, TRADE_COST + 1]))
    const h = withCurios(counts)
    expect(h.app.boons).toContain('stones')
    for (const stone of stones) {
      const attempt = cursorTo(withCurios(counts), stone.id)
      attempt.tap('b')
      expect(attempt.app.boons, `trading ${stone.id} lost the set`).toContain('stones')
    }
  })

  it('refuses a trade on a curio the board has none of', () => {
    const h = cursorTo(withCurios({ pebble: 5 }), 'geode')
    expect(h.app.canTrade).toBe(false)
    h.tap('b')
    expect(h.app.curioCounts.geode).toBeUndefined()
  })

  it('has nothing left to want once the board is complete', () => {
    const full = Object.fromEntries(CURIOS.map((c) => [c.id, 5]))
    const h = withCurios(full)
    expect(h.app.tradeFor).toBeNull()
    expect(h.app.canTrade).toBe(false)
    h.select('status')
    h.tap('a')
    h.clearCalls().tap('b')
    expect(h.app.message).toBe('NOTHING LEFT TO WANT')
  })

  it('tells the player what it actually takes, not what it costs', () => {
    // The dim hint used to read "3 SPARES TRADE UP" directly under "HAVE 3",
    // which is a promise the button then refused. It has to name the number
    // that would make `canTrade` true.
    const h = cursorTo(withCurios({ pebble: TRADE_COST }), 'pebble')
    expect(h.app.canTrade).toBe(false)
    const { fake, hud } = fakeHud()
    drawScreen(hud, h.app, world)
    const said = fake.said()
    expect(said).toContain(`${TRADE_COST + 1} OF A KIND`)
    expect(said).not.toContain('B TRADE')
  })

  it('offers the trade on screen exactly when it will make it', () => {
    for (let held = 0; held <= TRADE_COST + 2; held++) {
      const h = cursorTo(withCurios({ pebble: held }), 'pebble')
      const { fake, hud } = fakeHud()
      drawScreen(hud, h.app, world)
      const offered = fake.said().includes('B TRADE')
      expect(offered, `held ${held}`).toBe(h.app.canTrade)
    }
  })

  it('saves a trade, so it survives the tab closing', () => {
    const h = cursorTo(withCurios({ pebble: 5 }), 'pebble')
    h.tap('b')
    flushSave()
    expect(h.stored()!.curios.pebble).toBe(5 - TRADE_COST)
  })
})
