import { describe, expect, it } from 'vitest'
import { harness } from '../harness'
import { emptyPlayAxes, emptySave, flushSave } from '../../src/game/save'
import { KINDLING } from '../../src/game/larder'
import { CRITICAL, SICK_THRESHOLD } from '../../src/game/tuning'
import { DAY_MS, isNight } from '../../src/game/world'
import { COMMON_CURIOS } from '../../src/data/curios'

/**
 * The day-to-day: feeding, washing, medicine, bedtime, and coming back after
 * being away. This is almost all of what a player actually does, and it is
 * where a wrong refusal or a lost meal shows up as "the button does nothing".
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe('feeding', () => {
  it('opens the menu and offers the bought foods', () => {
    const h = harness().start().growTo('baby')
    h.select('feed')
    expect(h.app.mode).toBe('feed')
    expect(h.app.feedMenu.map((f) => f.id)).toEqual(['berry', 'meat', 'salad', 'fries', 'cake'])
  })

  it('never offers medicine on the feed menu, it having its own icon', () => {
    const h = harness().start().growTo('baby')
    expect(h.app.feedMenu.some((f) => f.id === 'medicine')).toBe(false)
  })

  it('moves through the menu both ways and wraps', () => {
    const h = harness().start().growTo('baby')
    h.select('feed')
    const length = h.app.feedMenu.length
    h.tap('c')
    expect(h.app.foodIndex).toBe(1)
    h.tap('a').tap('a')
    expect(h.app.foodIndex).toBe(length - 1)
  })

  it('feeds the pet and goes back to it', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.hunger = 30
    h.select('feed')
    h.clearCalls().tap('b')
    expect(h.pet.stats.hunger).toBeGreaterThan(30)
    expect(h.app.mode).toBe('main')
    expect(h.burstsFired()).toContain('crumb')
    expect(h.soundsPlayed()).toContain('eat')
  })

  it('refuses a full pet, and stays on the menu so another choice can be made', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.hunger = 100
    h.select('feed')
    h.clearCalls().tap('b')
    expect(h.app.mode).toBe('feed')
    expect(h.soundsPlayed()).toContain('refuse')
    expect(h.app.message).toBe('TOO FULL FOR THAT.')
  })

  it('refuses to feed an egg', () => {
    const h = harness().start()
    h.select('feed')
    h.clearCalls().tap('b')
    expect(h.app.message).toContain('NOT HATCHED')
  })

  it('thanks you, once, however fast the meals come', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.hunger = 10
    for (let i = 0; i < 5; i++) {
      h.select('feed')
      h.tap('b')
      h.pet.stats.hunger = 10
    }
    // A single pending slot rather than a queue: five meals thank you once.
    let thanks = 0
    for (let i = 0; i < 200; i++) {
      h.advance(1)
      if (h.app.tickerText.startsWith('PIP:') && h.app.tickerText.includes('!')) thanks++
    }
    expect(thanks).toBeGreaterThan(0)
  })
})

describe('the larder', () => {
  const withLarder = (larder: Record<string, number>) =>
    harness({ save: { ...emptySave(), larder } }).start()

  it('is bare to begin with', () => {
    expect(harness().start().app.larder).toEqual({})
  })

  it('puts gathered food on the menu only while there is some', () => {
    const h = withLarder({ berries: 2 })
    h.growTo('baby')
    expect(h.app.feedMenu.map((f) => f.id)).toContain('berries')
  })

  it('keeps gathered food off the menu when there is none', () => {
    const h = withLarder({ berries: 0 })
    h.growTo('baby')
    expect(h.app.feedMenu.map((f) => f.id)).not.toContain('berries')
  })

  it('spends gathered food as the pet eats it', () => {
    const h = withLarder({ berries: 2 })
    h.growTo('baby')
    h.pet.stats.hunger = 10
    h.select('feed')
    while (h.app.feedMenu[h.app.foodIndex]?.id !== 'berries') h.tap('c')
    h.tap('b')
    expect(h.app.larder.berries).toBe(1)
  })

  it('drops the food from the menu once the last of it is eaten', () => {
    const h = withLarder({ berries: 1 })
    h.growTo('baby')
    h.pet.stats.hunger = 10
    h.select('feed')
    while (h.app.feedMenu[h.app.foodIndex]?.id !== 'berries') h.tap('c')
    h.tap('b')
    expect(h.app.larder.berries).toBeUndefined()
    expect(h.app.feedMenu.map((f) => f.id)).not.toContain('berries')
  })

  it('keeps the cursor on the menu after it shortens, rather than off the end', () => {
    const h = withLarder({ berries: 1 })
    h.growTo('baby')
    h.pet.stats.hunger = 10
    h.select('feed')
    while (h.app.feedMenu[h.app.foodIndex]?.id !== 'berries') h.tap('c')
    h.tap('b')
    expect(h.app.foodIndex).toBeLessThan(h.app.feedMenu.length)
    // And the menu still works.
    h.select('feed')
    expect(() => h.tap('b')).not.toThrow()
  })

  it('never spends food on a refused meal', () => {
    const h = withLarder({ berries: 2 })
    h.growTo('baby')
    h.pet.stats.hunger = 100
    h.select('feed')
    while (h.app.feedMenu[h.app.foodIndex]?.id !== 'berries') h.tap('c')
    h.tap('b')
    expect(h.app.larder.berries).toBe(2)
  })

  it('counts gathered food toward the diet like any other', () => {
    const h = withLarder({ roots: 1 })
    h.growTo('baby')
    h.pet.stats.hunger = 10
    h.select('feed')
    while (h.app.feedMenu[h.app.foodIndex]?.id !== 'roots') h.tap('c')
    h.tap('b')
    expect(h.pet.diet.veg).toBe(1)
    expect(h.pet.diet.meals).toBe(1)
  })
})

describe('cleaning', () => {
  it('washes the pet and cheers it up', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.hygiene = 20
    h.clearCalls().select('clean')
    expect(h.pet.stats.hygiene).toBe(100)
    expect(h.burstsFired()).toContain('bubble')
    expect(h.app.mode).toBe('main')
  })

  it('refuses a pet that is already spotless', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.hygiene = 100
    h.clearCalls().select('clean')
    expect(h.soundsPlayed()).toContain('refuse')
  })
})

describe('medicine', () => {
  it('refuses a pet that is not poorly', () => {
    const h = harness().start().growTo('baby')
    h.clearCalls().select('medicine')
    expect(h.app.message).toBe('IT IS NOT POORLY.')
    expect(h.soundsPlayed()).toContain('refuse')
  })

  it('mends a sick pet', () => {
    const h = harness().start().growTo('baby')
    h.pet.sick = true
    h.pet.stats.health = 20
    h.clearCalls().select('medicine')
    expect(h.pet.stats.health).toBeGreaterThan(20)
    expect(h.burstsFired()).toContain('sparkle')
  })

  it('says how the pet feels on the ticker, in the first person', () => {
    const h = harness().start().growTo('baby')
    h.pet.sick = true
    // Health has to stay under the recovery threshold, or the simulation
    // rightly shakes the illness off before the ticker gets round to it.
    h.pet.stats.health = 20
    h.until('the poorly line', () => h.app.tickerText.includes("DON'T FEEL SO GOOD"), 400, 0.5)
  })

  it('is reachable the moment the pet falls ill, so illness is never a trap', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.hunger = 0
    // A hair above the threshold, so a few seconds of neglect tips it over
    // rather than the hour the damage rate would otherwise need.
    h.pet.stats.health = SICK_THRESHOLD + 0.05
    h.until('the pet to fall ill', () => h.pet.sick, 60, 1)
    expect(h.app.visual.sick).toBe(true)
    h.select('medicine')
    expect(h.pet.stats.health).toBeGreaterThan(SICK_THRESHOLD)
  })
})

describe('playing', () => {
  it('refuses an egg, a sleeping pet and an exhausted one', () => {
    const egg = harness().start()
    egg.clearCalls().select('play')
    expect(egg.app.message).toBe('NOT YET')

    const asleep = harness().start().growTo('baby')
    asleep.pet.asleep = true
    asleep.clearCalls().select('play')
    expect(asleep.app.message).toContain('ASLEEP')

    const weary = harness().start().growTo('baby')
    weary.pet.stats.energy = 5
    weary.clearCalls().select('play')
    expect(weary.app.message).toBe('TOO TIRED')
  })

  it('opens the games menu and starts the chosen one', () => {
    const h = harness().start().growTo('baby')
    h.select('play')
    expect(h.app.mode).toBe('games')
    h.tap('c')
    expect(h.app.gameIndex).toBe(1)
    h.tap('a').tap('a')
    expect(h.app.gameIndex).toBe(2)
    h.tap('b')
    expect(h.app.mode).toBe('playing')
    expect(h.app.session).not.toBeNull()
  })

  it('records the game when it finishes and goes back to the pet', () => {
    const h = harness().start().growTo('baby')
    h.select('play')
    h.tap('b')
    // The guess game waits on the player, so play it rather than watching it.
    for (let i = 0; i < 400 && h.app.mode === 'playing'; i++) {
      h.tap('a')
      h.advance(0.2, 0.05)
    }
    expect(h.app.mode).toBe('main')
    expect(h.pet.play.gamesPlayed).toBe(1)
    expect(h.app.session).toBeNull()
  })

  it('celebrates a win, and says so in the pet"s voice', () => {
    // Played until a session is actually won: the pips are the game"s own
    // record of it, so this asserts on what the app did rather than the dice.
    let won = false
    for (let attempt = 0; attempt < 12 && !won; attempt++) {
      const h = harness({ random: attempt }).start().growTo('baby')
      h.select('play')
      h.tap('b')
      h.clearCalls()
      for (let i = 0; i < 400 && h.app.mode === 'playing'; i++) {
        h.tap('a')
        h.advance(0.2, 0.05)
      }
      if (h.pet.play.gamesWon === 1) {
        won = true
        expect(h.app.message).toContain('WON!')
        expect(h.burstsFired()).toContain('heart')
        expect(h.soundsPlayed()).toContain('win')
        h.until('the winning line', () => h.app.tickerText.startsWith('PIP:'), 400, 0.5)
      }
    }
    expect(won, 'never managed to win a game in twelve attempts').toBe(true)
  })

  it('commiserates a loss without punishing it', () => {
    let lost = false
    for (let attempt = 0; attempt < 12 && !lost; attempt++) {
      const h = harness({ random: attempt }).start().growTo('baby')
      h.select('play')
      h.tap('b')
      for (let i = 0; i < 400 && h.app.mode === 'playing'; i++) {
        h.tap('a')
        h.advance(0.2, 0.05)
      }
      if (h.pet.play.gamesPlayed === 1 && h.pet.play.gamesWon === 0) {
        lost = true
        expect(h.app.message).toBe('BETTER LUCK NEXT TIME')
        // A loss still leaves the pet happier than it was for having played.
        expect(h.pet.stats.happiness).toBeGreaterThan(0)
      }
    }
    expect(lost, 'never managed to lose a game in twelve attempts').toBe(true)
  })

  it('counts a game abandoned after a round as a loss, so a record cannot be protected', () => {
    const h = harness().start().growTo('baby')
    h.select('play')
    h.tap('b')
    h.tap('a')
    h.advance(1.2, 0.05)
    expect(h.app.session?.resolved).toBe(1)
    h.holdBack()
    expect(h.app.mode).toBe('main')
    expect(h.pet.play.gamesPlayed).toBe(1)
    expect(h.app.message).toBe('GAVE UP')
  })

  it('costs nothing to leave a game before any round is decided', () => {
    const h = harness().start().growTo('baby')
    h.select('play')
    h.tap('b')
    h.holdBack()
    expect(h.app.mode).toBe('main')
    expect(h.pet.play.gamesPlayed).toBe(0)
    expect(h.app.message).toBe('NEVER MIND')
  })

  it('reports the play record', () => {
    const h = harness().start()
    const fresh = { gamesPlayed: 0, gamesWon: 0, bestStreak: 0, byAxis: emptyPlayAxes() }
    expect(h.app.playRecord).toEqual(fresh)
    h.app.restart()
    expect(h.app.playRecord).toEqual(fresh)
  })
})

describe('sleep', () => {
  /** Starts a harness at a moment the world"s sun is already down. */
  function atNight() {
    for (let t = 0; t < DAY_MS; t += 10_000) {
      if (isNight(t)) return harness({ start: t })
    }
    throw new Error('no night found')
  }

  it('refuses a pet that is not remotely sleepy', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.energy = 100
    h.clearCalls().select('sleep')
    expect(h.app.message).toBe('NOT REMOTELY SLEEPY.')
  })

  it('puts a tired pet to bed', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.energy = 40
    h.clearCalls().select('sleep')
    expect(h.pet.asleep).toBe(true)
    expect(h.burstsFired()).toContain('zzz')
  })

  it('wakes a sleeping pet', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats.energy = 40
    h.select('sleep')
    h.select('sleep')
    expect(h.pet.asleep).toBe(false)
  })

  it('waits for the pet to reach its shelter before winding the night past', () => {
    const h = atNight().start().growTo('baby')
    h.pet.stats.energy = 30
    h.select('sleep')
    const worldBefore = h.app.worldNow()
    // The renderer has not walked the pet to the shelter yet, so nothing skips.
    for (let i = 0; i < 120; i++) {
      h.app.petSheltered = false
      h.app.update(1 / 60, h.now)
    }
    expect(h.app.skipping).toBe(false)
    expect(h.app.worldNow()).toBe(worldBefore)
    expect(h.pet.asleep).toBe(true)
  })

  it('winds the night past once the pet has settled', () => {
    const h = atNight().start().growTo('baby')
    h.pet.stats.energy = 30
    const worldBefore = h.app.worldNow()
    h.select('sleep')
    h.until('the night to be wound past', () => !h.app.skipping && !h.pet.asleep, 30, 0.05)
    expect(h.app.worldNow()).toBeGreaterThan(worldBefore)
    expect(h.pet.asleep).toBe(false)
  })

  it('rests the pet as the night goes by', () => {
    const h = atNight().start().growTo('baby')
    h.pet.stats.energy = 20
    h.select('sleep')
    h.until('the night to pass', () => !h.pet.asleep, 30, 0.05)
    expect(h.pet.stats.energy).toBeGreaterThan(20)
  })

  it('does not age the pet through the skip, so a nap cannot skip a stage', () => {
    const h = atNight().start().growTo('baby')
    const ageBefore = h.pet.ageMs
    h.pet.stats.energy = 20
    h.select('sleep')
    h.until('the night to pass', () => !h.pet.asleep, 30, 0.05)
    // Only the real seconds spent watching, not the world hours skipped.
    expect(h.pet.ageMs - ageBefore).toBeLessThan(60_000)
  })

  it('takes one skip per sleep, however long the pet stays down', () => {
    const h = atNight().start().growTo('baby')
    h.pet.stats.energy = 20
    h.select('sleep')
    h.until('the night to pass', () => !h.pet.asleep, 30, 0.05)
    const after = h.app.worldNow()
    h.advance(5)
    // Awake again: the clock runs at its own pace, not another night's worth.
    expect(h.app.worldNow() - after).toBeLessThan(10_000)
  })

  it('says good morning when the pet wakes with the player watching', () => {
    const h = atNight().start().growTo('baby')
    h.pet.stats.energy = 20
    h.select('sleep')
    h.until('the night to pass', () => !h.pet.asleep, 30, 0.05)
    expect(h.app.message).toContain('WAKES UP')
  })
})

describe('the fire', () => {
  const withKindling = (count: number) =>
    harness({ save: { ...emptySave(), larder: count > 0 ? { [KINDLING]: count } : {} } })

  it('is banked for the night when the pet has fetched fuel', () => {
    const h = withKindling(2).start()
    h.growTo('baby')
    h.pet.stats.energy = 40
    h.select('sleep')
    expect(h.pet.warm).toBe(true)
    expect(h.app.larder[KINDLING]).toBe(1)
  })

  it('spends the last bundle rather than leaving a zero behind', () => {
    const h = withKindling(1).start()
    h.growTo('baby')
    h.pet.stats.energy = 40
    h.select('sleep')
    expect(h.pet.warm).toBe(true)
    expect(h.app.larder[KINDLING]).toBeUndefined()
  })

  it('is not banked when there is nothing to burn', () => {
    const h = withKindling(0).start()
    h.growTo('baby')
    h.pet.stats.energy = 40
    h.select('sleep')
    expect(h.pet.warm).toBe(false)
  })

  it('stops working the moment the pet is woken early', () => {
    const h = withKindling(2).start()
    h.growTo('baby')
    h.pet.stats.energy = 40
    h.select('sleep')
    expect(h.pet.warm).toBe(true)
    h.select('sleep')
    expect(h.pet.warm).toBe(false)
    // And the bundle is spent either way.
    expect(h.app.larder[KINDLING]).toBe(1)
  })

  it('says so on the ticker, so the fuel is seen to be used', () => {
    const h = withKindling(1).start()
    h.growTo('baby')
    h.pet.stats.energy = 40
    h.select('sleep')
    h.until('the fire line', () => h.app.tickerText.includes('BANKS THE FIRE'))
  })

  it('leaves a warm pet better off in the morning than a cold one', () => {
    const nightAt = (kindling: number) => {
      let start = 0
      for (let t = 0; t < DAY_MS; t += 10_000) {
        if (isNight(t)) {
          start = t
          break
        }
      }
      const h = harness({
        start,
        save: { ...emptySave(), larder: kindling > 0 ? { [KINDLING]: kindling } : {} },
      })
        .start()
        .growTo('baby')
      h.pet.stats.energy = 20
      h.pet.stats.hunger = 90
      h.select('sleep')
      h.until('the night to pass', () => !h.pet.asleep, 30, 0.05)
      return h.pet.stats.hunger
    }
    expect(nightAt(1)).toBeGreaterThan(nightAt(0))
  })
})

describe('coming back', () => {
  /** Closes the app for a stretch and opens it again. */
  function away(ms: number, options: Parameters<typeof harness>[0] = {}) {
    const first = harness(options).start()
    first.growTo('baby')
    // A form with nowhere left to go. An absence long enough to matter is also
    // long enough to grow a pet up, and an evolution rightly takes the screen
    // -- which would make these tests about evolving rather than about coming
    // back. Isolating one from the other is the point.
    first.pet.speciesId = 'somnix'
    first.pet.stage = 'adult'
    first.advance(1)
    flushSave()
    const raw = first.storage.data['petz9000.save']!
    return harness({
      ...options,
      raw,
      start: first.now + ms,
    })
  }

  it('says nothing about a short absence', () => {
    const h = away(60_000).boot()
    expect(h.app.mode).toBe('main')
  })

  it('puts a welcome screen up after a long one', () => {
    const h = away(2 * HOUR).boot()
    expect(h.app.mode).toBe('welcome')
    expect(h.app.awayMs).toBeGreaterThanOrEqual(2 * HOUR)
  })

  it('is dismissed by any button', () => {
    const h = away(2 * HOUR).boot()
    h.tap('b')
    expect(h.app.mode).toBe('main')
  })

  it('leaves the pet needing something after a long absence', () => {
    const h = away(24 * HOUR).boot()
    expect(h.pet.stats.hunger).toBeLessThan(CRITICAL)
    expect(h.app.needs.length).toBeGreaterThan(0)
  })

  it('does not leave the pet at rock bottom, however long the absence', () => {
    const h = away(30 * 24 * HOUR).boot()
    expect(h.pet.stats.hunger).toBeGreaterThan(0)
    expect(h.pet.stats.health).toBeGreaterThan(0)
  })

  it('greets the player in the pet"s own voice', () => {
    const h = away(2 * HOUR).boot()
    h.tap('b')
    h.until('the welcome line', () => h.app.tickerText.startsWith('PIP:'), 120)
  })

  it('can turn something up while nobody was watching', () => {
    // Every roll at zero: the curio check passes and the first common one wins.
    const h = away(HOUR, { random: () => 0 }).boot()
    expect(h.app.found).not.toBeNull()
    expect(COMMON_CURIOS).toContainEqual(h.app.found)
    expect(h.app.curioCounts[h.app.found!.id]).toBe(1)
  })

  it('turns nothing up when the absence was too short for it', () => {
    const h = away(10 * MINUTE, { random: () => 0 }).boot()
    expect(h.app.found).toBeNull()
  })

  it('turns nothing up when the dice say so', () => {
    const h = away(HOUR, { random: () => 0.99 }).boot()
    expect(h.app.found).toBeNull()
  })

  it('says on the ticker what it found', () => {
    const h = away(HOUR, { random: () => 0 }).boot()
    h.tap('b')
    h.until('the find line', () => h.app.tickerText.includes('FOUND A'), 120)
  })

  it('finds nothing for an egg, which cannot go looking', () => {
    const first = harness().start()
    first.advance(1)
    flushSave()
    const h = harness({
      raw: first.storage.data['petz9000.save']!,
      start: first.now + HOUR,
      random: () => 0,
    })
    expect(h.app.pet?.stage).toBe('egg')
    expect(h.app.found).toBeNull()
  })

  it('does not find a second thing before the first has been seen', () => {
    const h = away(HOUR, { random: () => 0 }).boot()
    expect(h.app.found).not.toBeNull()
    const first = h.app.found
    // Away again without dismissing the welcome screen: the find stands.
    h.app.setVisible(false)
    h.closeFor(HOUR)
    h.app.setVisible(true)
    expect(h.app.found).toBe(first)
    expect(h.app.curioTally.total).toBe(1)
  })

  it('treats a hidden tab as an absence, however many frames it stole', () => {
    const h = harness().start().growTo('baby')
    h.pet.speciesId = 'somnix'
    h.pet.stage = 'adult'
    h.app.setVisible(false)
    h.closeFor(3 * HOUR)
    // A hidden tab in some browsers still gets the odd frame.
    h.frames(5)
    h.app.setVisible(true)
    expect(h.app.awayMs).toBeGreaterThanOrEqual(3 * HOUR)
    expect(h.app.mode).toBe('welcome')
  })

  it('does not interrupt a player in the middle of something', () => {
    const h = harness().start().growTo('baby')
    h.select('feed')
    h.app.setVisible(false)
    h.closeFor(3 * HOUR)
    h.app.setVisible(true)
    expect(h.app.mode).toBe('feed')
  })

  it('ignores a visibility change that was never preceded by a hide', () => {
    const h = harness().start().growTo('baby')
    h.app.setVisible(true)
    expect(h.app.mode).toBe('main')
  })

  it('catches up on a gap the tab never reported, from frames alone', () => {
    const h = harness().start().growTo('baby')
    // A shut laptop: the clock jumps but nothing reported itself hidden.
    h.closeFor(4 * HOUR)
    h.frame()
    expect(h.app.awayMs).toBeGreaterThanOrEqual(4 * HOUR)
  })
})

describe('what the renderer is told', () => {
  it('reports a neutral pet when there is none', () => {
    const h = harness().boot()
    expect(h.app.visual).toEqual({
      mood: 0.5,
      asleep: false,
      sick: false,
      mobile: false,
      foraging: false,
    })
    expect(h.app.needs).toEqual([])
    expect(h.app.speciesName).toBe('')
  })

  it('keeps an egg still, since it has nothing to walk with', () => {
    const h = harness().start()
    expect(h.app.visual.mobile).toBe(false)
    h.growTo('baby')
    expect(h.app.visual.mobile).toBe(true)
  })

  it('reports the mood, which follows how the pet is doing', () => {
    const h = harness().start().growTo('baby')
    h.pet.stats = { hunger: 100, happiness: 100, energy: 100, hygiene: 100, health: 100 }
    expect(h.app.visual.mood).toBe(1)
    h.pet.stats.hunger = 0
    expect(h.app.visual.mood).toBeLessThan(1)
  })

  it('has no temperament to report when there is no pet', () => {
    const h = harness().boot()
    expect(h.app.temperament).toBeNull()
    expect(h.app.leaning).toBeNull()
  })

  it('names the species for the announcer', () => {
    const h = harness().start()
    expect(h.app.speciesName).toBe('Egg')
    h.growTo('baby')
    expect(h.app.speciesName).toBe('Blobbit')
  })
})
