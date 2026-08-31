import { describe, expect, it } from 'vitest'
import { DEFAULT_START, harness } from '../harness'
import { emptySave, flushSave, SAVE_VERSION } from '../../src/game/save'
import { NAMES } from '../../src/game/app'
import { SHELLS } from '../../src/data/shells'
import { CURIO_COUNT } from '../../src/data/curios'

/**
 * A session from the outside: switching the thing on, naming a pet, closing
 * the lid, opening it again. Everything here is about the app being reachable
 * -- booting, saving, and never landing on a screen with no way off it.
 */

const DAY = 86_400_000

describe('booting', () => {
  it('shows the power-on splash first', () => {
    const h = harness()
    expect(h.app.mode).toBe('boot')
    expect(h.app.bootTimer).toBeGreaterThan(0)
  })

  it('lets any press skip the splash', () => {
    const h = harness()
    h.tap('b')
    h.frame()
    expect(h.app.mode).toBe('name')
  })

  it('goes to the naming screen with no pet', () => {
    expect(harness().boot().app.mode).toBe('name')
  })

  it('goes straight to the pet when one was saved and the gap was short', () => {
    const first = harness().start()
    flushSave()
    const second = harness({ raw: first.storage.data['petz9000.save'] }).boot()
    expect(second.app.mode).toBe('main')
    expect(second.app.pet?.name).toBe('PIP')
  })

  it('counts the session', () => {
    const h = harness().start()
    flushSave()
    expect(h.stored()?.counters.sessions).toBe(1)
    const second = harness({ raw: h.storage.data['petz9000.save'] })
    second.start()
    flushSave()
    expect(second.stored()?.counters.sessions).toBe(2)
  })

  it('boots from an empty save without a pet, rather than crashing', () => {
    const h = harness({ save: emptySave() })
    expect(() => h.boot()).not.toThrow()
    expect(h.app.mode).toBe('name')
  })

  it('boots from a corrupt save into a fresh game rather than into nothing', () => {
    const h = harness({ raw: '{{{ not json at all' })
    expect(() => h.boot()).not.toThrow()
    expect(h.app.mode).toBe('name')
    expect(h.app.pet).toBeNull()
  })

  it('boots from a save that lost half its fields', () => {
    const h = harness({ raw: JSON.stringify({ version: SAVE_VERSION }) })
    expect(() => h.start()).not.toThrow()
    expect(h.app.mode).toBe('main')
    // The feed menu reaches into the larder on the very first frame.
    expect(() => h.app.feedMenu).not.toThrow()
  })

  it('boots from a save written by the very first version of the game', () => {
    const h = harness({ raw: JSON.stringify({ pet: null, muted: true }) })
    h.boot()
    expect(h.app.muted).toBe(true)
    expect(h.app.mode).toBe('name')
  })

  it('never leaves the player on a screen with no pet and no way to make one', () => {
    const h = harness({ raw: 'garbage' }).boot()
    expect(h.app.mode).toBe('name')
    h.tap('b')
    expect(h.app.pet).not.toBeNull()
    expect(h.app.mode).toBe('main')
  })
})

describe('naming', () => {
  it('offers a ring of names that wraps both ways', () => {
    const h = harness().boot()
    expect(h.app.nameIndex).toBe(0)
    h.tap('c')
    expect(h.app.nameIndex).toBe(1)
    h.tap('a')
    expect(h.app.nameIndex).toBe(0)
    h.tap('a')
    expect(h.app.nameIndex).toBe(NAMES.length - 1)
  })

  it('names the pet whatever the cursor is on', () => {
    const h = harness().boot()
    h.tap('c').tap('c')
    h.tap('b')
    expect(h.pet.name).toBe(NAMES[2])
  })

  it('starts the pet as an egg and tells the renderer', () => {
    const h = harness().boot()
    h.clearCalls().tap('b')
    expect(h.pet.stage).toBe('egg')
    expect(h.calls).toContainEqual({ kind: 'form', speciesId: 'egg', animate: true })
  })

  it('stamps the pet with the moment it was made', () => {
    const h = harness().start()
    expect(h.pet.bornAt).toBeCloseTo(DEFAULT_START + 1500, 0)
    expect(h.pet.lastTick).toBe(h.pet.bornAt)
  })
})

describe('the heirloom', () => {
  const withAlbum = (legacies: number[]) =>
    harness({
      save: {
        ...emptySave(),
        album: legacies.map((legacy) => ({
          speciesId: 'mochi',
          name: 'OLD',
          retiredAt: 0,
          legacy,
        })),
      },
    })

  it('gives a first pet nothing extra', () => {
    const h = harness().start()
    expect(h.pet.stats.happiness).toBe(70)
    expect(h.pet.stats.hunger).toBe(70)
  })

  it('provisions the next egg by what its ancestors were worth', () => {
    const h = withAlbum([1]).start()
    expect(h.pet.stats.happiness).toBe(75)
    expect(h.pet.stats.hunger).toBe(75)
  })

  it('is worth almost nothing for an ancestor retired the moment it grew up', () => {
    const h = withAlbum([0]).start()
    expect(h.pet.stats.happiness).toBe(70)
  })

  it('caps, so a long line helps but never trivialises', () => {
    const h = withAlbum([1, 1, 1, 1, 1, 1, 1, 1]).start()
    expect(h.pet.stats.happiness).toBe(85)
    expect(h.pet.stats.hunger).toBe(85)
  })

  it('treats an ancestor with no legacy recorded as a middling life', () => {
    const h = harness({
      save: {
        ...emptySave(),
        album: [{ speciesId: 'mochi', name: 'OLD', retiredAt: 0 }],
      },
    }).start()
    expect(h.pet.stats.happiness).toBe(72)
  })

  it('never pushes a starting stat past full', () => {
    const h = withAlbum([1, 1, 1, 1]).start()
    expect(h.pet.stats.happiness).toBeLessThanOrEqual(100)
  })
})

describe('the streak', () => {
  const bootWith = (lastDay: string, days: number, at = DEFAULT_START) =>
    harness({ start: at, save: { ...emptySave(), streak: { lastDay, days } } }).boot()

  it('starts at one on a first visit', () => {
    expect(harness().boot().app.streakDays).toBe(1)
  })

  it('grows by one for a visit the next day', () => {
    const yesterday = stamp(DEFAULT_START - DAY)
    expect(bootWith(yesterday, 3).app.streakDays).toBe(4)
  })

  it('does not grow twice in the same day', () => {
    const today = stamp(DEFAULT_START)
    expect(bootWith(today, 3).app.streakDays).toBe(3)
  })

  it('erodes one per day missed rather than being wiped out', () => {
    const threeDaysAgo = stamp(DEFAULT_START - 3 * DAY)
    expect(bootWith(threeDaysAgo, 5).app.streakDays).toBe(3)
  })

  it('counts whole days, not elapsed hours, whatever time of day it is', () => {
    // The afternoon player: back every day, at 1pm. Every one of those visits
    // has to count, or the streak can never be built at all.
    const yesterday = stamp(DEFAULT_START - DAY)
    for (const hour of [0, 6, 12, 18, 23]) {
      const at = DEFAULT_START - 12 * 3_600_000 + hour * 3_600_000
      expect(bootWith(stamp(at - DAY), 3, at).app.streakDays, `${hour}:00`).toBe(4)
    }
    expect(bootWith(yesterday, 3).app.streakDays).toBe(4)
  })

  it('starts a fresh streak from a last day it cannot read', () => {
    expect(bootWith('not-a-date', 5).app.streakDays).toBe(1)
  })

  it('never erodes below one, so coming back is never a punishment', () => {
    const longAgo = stamp(DEFAULT_START - 60 * DAY)
    expect(bootWith(longAgo, 5).app.streakDays).toBe(1)
  })

  it('records the day it was last seen', () => {
    const h = harness().start()
    flushSave()
    expect(h.stored()?.streak.lastDay).toBe(stamp(DEFAULT_START))
  })
})

describe('saving', () => {
  it('writes the pet out, coalesced, so a closed tab loses nothing', () => {
    const h = harness().start()
    flushSave()
    const stored = h.stored()!
    expect(stored.pet?.name).toBe('PIP')
    expect(stored.version).toBe(SAVE_VERSION)
  })

  it('writes immediately when the page is hidden, since it may get no more frames', () => {
    const h = harness().start()
    h.storage.data['petz9000.save'] = ''
    h.app.setVisible(false)
    expect(h.stored()?.pet?.name).toBe('PIP')
  })

  it('survives a full round trip: save, close, reopen, and the pet is the same', () => {
    const first = harness().start()
    first.select('clean')
    first.advance(1)
    flushSave()
    const raw = first.storage.data['petz9000.save']!
    const before = first.pet

    const second = harness({ raw, start: DEFAULT_START + 60_000 }).boot()
    expect(second.pet.id).toBe(before.id)
    expect(second.pet.name).toBe(before.name)
    expect(second.pet.stats.hygiene).toBeGreaterThan(0)
  })

  /**
   * NEW PET is the one button that takes something away on purpose, and what it
   * takes is written on the dialog: "This erases your pet AND the whole
   * lineage: album, curios and streak. To pass the torch instead, retire an
   * adult from its status screen." Retiring is the door that keeps things;
   * this is the door that does not.
   *
   * It did not, for a while, and this file used to say so. `restart` removed
   * the file and left `this.save` standing, so the next thing to persist wrote
   * the lineage back -- and naming the new egg was enough. The dialog said one
   * thing on the twenty-ninth and the code went on doing another; the test
   * written the day after wrote down what the code did rather than what the
   * button had promised.
   */
  describe('starting over', () => {
    const lived = () =>
      harness({
        save: {
          ...emptySave(),
          album: [{ speciesId: 'blob', name: 'OLD', retiredAt: 0 }],
          curios: { pebble: 3 },
          streak: { days: 9, lastDay: '2024-05-01' },
          home: 'woodland',
          larder: { berries: 2 },
          kit: ['torch', 'umbrella'],
        },
      }).start()

    it('takes the pet, and says so', () => {
      const h = lived()
      h.growTo('baby')
      h.app.restart()
      expect(h.app.pet).toBeNull()
      expect(h.app.mode).toBe('name')
    })

    it('takes the lineage the button promised to take', () => {
      const h = lived()
      h.growTo('baby')
      expect(h.app.discoveredIds).toContain('blob')
      h.app.restart()
      expect(h.app.discoveredIds).toEqual([])
      expect(h.app.curioCounts).toEqual({})
      expect(h.app.larder).toEqual({})
      // The kit is the family's, like the curios, so it goes the same way.
      expect(h.app.kitOwned).toEqual([])
    })

    it('takes the house too, since the house belonged to the family', () => {
      // The other way round from retiring, where the family carries on and
      // keeps what it chose. There is no family left to keep it.
      const h = lived()
      expect(h.app.biome.id).toBe('woodland')
      h.app.restart()
      expect(h.app.biome.id).toBe('meadow')
    })

    it('counts today as a day, because you are here today', () => {
      // Not zero. A fresh boot counts the visit it is in the middle of, and so
      // does this: a streak of no days on a day you turned up is a lie.
      const h = lived()
      h.app.restart()
      expect(h.app.streakDays).toBe(1)
    })

    it('leaves nothing behind for the next thing that saves', () => {
      // The bug itself. Naming the new egg persists, and what it persisted was
      // the whole lineage the button had just said it erased.
      const h = lived()
      h.app.restart()
      h.tap('b')
      h.advance(1)
      flushSave()
      const back = h.stored()!
      expect(back.album).toEqual([])
      expect(back.curios).toEqual({})
      expect(back.streak.days).toBe(1)
      expect(back.home).toBe('meadow')
    })

    it('gives the same thing as pressing it and then reloading the page', () => {
      // The whole rule in one line. Wiping the file and rebuilding the state
      // are two halves of the same act, and if they disagree it is the half
      // nobody can see that is wrong.
      const h = lived()
      h.growTo('baby')
      h.app.restart()
      h.tap('b')
      h.advance(1)
      flushSave()
      const afterRestart = h.stored()!

      const reloaded = harness().start()
      reloaded.advance(1)
      flushSave()
      const afterReload = reloaded.stored()!

      // The pets are different pets -- different ids, different birthdays.
      // Everything the lineage owns has to match.
      expect({ ...afterRestart, pet: null }).toEqual({ ...afterReload, pet: null })
    })
  })

  it('carries on running when storage refuses every write', () => {
    const h = harness()
    h.storage.setItem = () => {
      throw new Error('quota')
    }
    expect(() => h.start().advance(2)).not.toThrow()
    expect(h.app.pet).not.toBeNull()
  })
})

describe('settings', () => {
  it('toggles the sound and remembers it', () => {
    const h = harness().start()
    expect(h.app.muted).toBe(false)
    h.app.toggleMute()
    expect(h.app.muted).toBe(true)
    flushSave()
    expect(h.stored()?.muted).toBe(true)
  })

  it('offers only the default shell to a new lineage', () => {
    const h = harness().start()
    expect(h.app.unlockedShells.map((s) => s.id)).toEqual(['plum'])
    expect(h.app.currentShell.id).toBe('plum')
  })

  it('cycles through the shells the lineage has earned', () => {
    const h = harness({
      save: { ...emptySave(), streak: { days: 5, lastDay: stamp(DEFAULT_START) }, curios: {} },
    }).start()
    expect(h.app.unlockedShells.map((s) => s.id)).toEqual(['plum', 'teal'])
    expect(h.app.cycleShell().id).toBe('teal')
    expect(h.app.cycleShell().id).toBe('plum')
  })

  it('stays on the one shell it has rather than dividing by an empty list', () => {
    const h = harness().start()
    expect(h.app.cycleShell().id).toBe('plum')
  })

  it('cycles back to the start from a shell no longer on the list', () => {
    // A save naming a shell the lineage has since lost access to.
    const h = harness({ save: { ...emptySave(), shell: 'gold' } }).start()
    expect(h.app.cycleShell().id).toBe('plum')
  })

  it('unlocks every shell for a lineage that has done everything', () => {
    const h = harness({
      save: {
        ...emptySave(),
        streak: { days: 10, lastDay: stamp(DEFAULT_START) },
        album: [{ speciesId: 'mochi', name: 'OLD', retiredAt: 0, legacy: 1 }],
        curios: { a: 1, b: 1, c: 1, d: 1, e: 1 },
        discovered: ['1', '2', '3', '4', '5', '6', '7', '8'],
      },
    }).start()
    expect(h.app.unlockedShells).toHaveLength(SHELLS.length)
  })
})

describe('the ticker', () => {
  it('always has something to say', () => {
    const h = harness().start()
    h.advance(3)
    expect(h.app.tickerText.length).toBeGreaterThan(0)
  })

  it('shouts, because the screen does', () => {
    const h = harness().start().advance(3)
    expect(h.app.tickerText).toBe(h.app.tickerText.toUpperCase())
  })

  it('crawls, and moves on to the next line when one has left the glass', () => {
    const h = harness().start().advance(3)
    const first = h.app.tickerText
    const lines = new Set([first])
    for (let i = 0; i < 60; i++) {
      h.advance(2)
      lines.add(h.app.tickerText)
    }
    expect(lines.size).toBeGreaterThan(1)
  })

  it('lets any system push a line, and shows it', () => {
    const h = harness().start()
    h.app.pushTicker('something happened')
    h.until('the pushed line', () => h.app.tickerText === 'SOMETHING HAPPENED')
  })

  it('says a line now when it has to, cutting whatever was crawling', () => {
    const h = harness().start().advance(3)
    const seconds = h.app.speakNow('right now')
    expect(h.app.tickerText).toBe('RIGHT NOW')
    expect(h.app.tickerOffset).toBe(0)
    // It reports how long the line takes to cross, for the thought bubble.
    expect(seconds).toBeGreaterThan(0)
  })

  it('reports the collection counters it is meant to nag about', () => {
    const h = harness().start()
    const lines = new Set<string>()
    for (let i = 0; i < 120; i++) {
      h.advance(2)
      lines.add(h.app.tickerText)
    }
    const all = [...lines].join(' | ')
    expect(all).toContain('FORMS FOUND')
    expect(all).toContain(`CURIOS: 0/${CURIO_COUNT}`)
  })

  it('stops nagging about the curios once the board is full', () => {
    const full = Object.fromEntries(
      Array.from({ length: CURIO_COUNT }, (_, i) => [`x${i}`, 1]),
    )
    const h = harness({ save: { ...emptySave(), curios: full } }).start()
    const lines = new Set<string>()
    for (let i = 0; i < 120; i++) {
      h.advance(2)
      lines.add(h.app.tickerText)
    }
    expect([...lines].join(' | ')).not.toContain('CURIOS:')
  })
})

/** The app"s own local date stamp, so streak tests can state a day. */
function stamp(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
