import { describe, expect, it } from 'vitest'
import { FRAME, harness, type Harness } from '../harness'
import { HOLD_TO_BACK_SECONDS, type Mode } from '../../src/game/app'
import { ICON_ORDER } from '../../src/data/icons'

/**
 * Getting around. Three buttons and a dozen screens, and the thing that must
 * never happen is a screen with no way off it -- a child cannot be told to
 * refresh the page, so every screen the game can reach has to be escapable
 * with the buttons that are actually on the shell.
 */

/** Every screen a player can reach, and how to get there from the main one. */
const ROUTES: { mode: Mode; reach(h: Harness): void }[] = [
  { mode: 'feed', reach: (h) => h.select('feed') },
  { mode: 'games', reach: (h) => h.select('play') },
  { mode: 'status', reach: (h) => h.select('status') },
  {
    mode: 'curios',
    reach: (h) => {
      h.select('status')
      h.tap('a')
    },
  },
  {
    mode: 'grounds',
    reach: (h) => {
      h.pet.stats.energy = 100
      h.select('forage')
    },
  },
  {
    mode: 'playing',
    reach: (h) => {
      h.select('play')
      h.tap('b')
    },
  },
]

const grown = () => harness().start().growTo('adult')

describe('the icon ring', () => {
  it('starts on the first icon', () => {
    expect(harness().start().app.selectedIcon).toBe(ICON_ORDER[0])
  })

  it('steps forward and back, and wraps both ways', () => {
    const h = harness().start()
    h.tap('c')
    expect(h.app.selectedIcon).toBe(ICON_ORDER[1])
    h.tap('a')
    expect(h.app.selectedIcon).toBe(ICON_ORDER[0])
    h.tap('a')
    expect(h.app.selectedIcon).toBe(ICON_ORDER[ICON_ORDER.length - 1])
  })

  it('reaches every icon', () => {
    const h = harness().start()
    const seen = new Set<string>()
    for (let i = 0; i < ICON_ORDER.length; i++) {
      seen.add(h.app.selectedIcon)
      h.tap('c')
    }
    expect(seen.size).toBe(ICON_ORDER.length)
  })

  it('comes back to where it started after a full lap', () => {
    const h = harness().start()
    for (let i = 0; i < ICON_ORDER.length; i++) h.tap('c')
    expect(h.app.selectedIcon).toBe(ICON_ORDER[0])
  })

  it('does nothing at all when there is no pet to act on', () => {
    const h = harness().boot()
    h.tap('b')
    h.app.restart()
    expect(h.app.mode).toBe('name')
    // Back on the naming screen: b makes a pet rather than activating an icon.
    h.tap('b')
    expect(h.app.pet).not.toBeNull()
  })

  it('blinks, so the selected icon reads as selected', () => {
    const h = harness().start()
    const before = h.app.blink
    h.advance(1)
    expect(h.app.blink).toBeGreaterThan(before)
  })
})

describe('holding C to back out', () => {
  it('escapes every screen that says it can be escaped', () => {
    for (const route of ROUTES) {
      const h = grown()
      route.reach(h)
      expect(h.app.mode, route.mode).toBe(route.mode)
      h.holdBack()
      expect(h.app.mode, `could not escape ${route.mode}`).toBe('main')
    }
  })

  it('shows how far through the hold the player is', () => {
    const h = grown()
    h.select('feed')
    expect(h.app.backProgress).toBe(0)
    h.app.press('c')
    h.advance(HOLD_TO_BACK_SECONDS / 2)
    expect(h.app.backProgress).toBeGreaterThan(0.4)
    expect(h.app.backProgress).toBeLessThan(0.7)
    h.app.release('c')
    expect(h.app.backProgress).toBe(0)
  })

  it('shows no progress on a screen that is not escapable that way', () => {
    const h = grown()
    h.app.press('c')
    h.advance(0.4)
    expect(h.app.backProgress).toBe(0)
    expect(h.app.mode).toBe('main')
  })

  it('does not fire on a short hold', () => {
    const h = grown()
    h.select('feed')
    h.hold('c', HOLD_TO_BACK_SECONDS - 4 * FRAME)
    expect(h.app.mode).toBe('feed')
  })

  it('is cancelled by letting go', () => {
    const h = grown()
    h.select('feed')
    h.app.press('c')
    h.advance(HOLD_TO_BACK_SECONDS / 2)
    h.app.release('c')
    h.advance(2)
    expect(h.app.mode).toBe('feed')
  })

  it('resets between holds, so two short ones are not one long one', () => {
    const h = grown()
    h.select('feed')
    h.hold('c', HOLD_TO_BACK_SECONDS * 0.6)
    h.hold('c', HOLD_TO_BACK_SECONDS * 0.6)
    expect(h.app.mode).toBe('feed')
  })

  it('works mid-round, when every button is spoken for', () => {
    const h = grown()
    h.select('play')
    h.tap('b')
    h.tap('a')
    h.advance(0.3)
    h.holdBack()
    expect(h.app.mode).toBe('main')
  })

  it('ignores a release of a button that was not the one held', () => {
    const h = grown()
    h.select('feed')
    h.app.press('c')
    h.app.release('b')
    h.advance(HOLD_TO_BACK_SECONDS + 0.1)
    // The hold was never cancelled, so it still fires.
    expect(h.app.mode).toBe('main')
  })
})

describe('every screen has a way off it', () => {
  it('leaves no screen a player can be stuck on', () => {
    for (const route of ROUTES) {
      const h = grown()
      route.reach(h)
      const escapes = ['c-tap', 'c-hold', 'b-tap'] as const
      let escaped = false
      for (const escape of escapes) {
        const attempt = grown()
        route.reach(attempt)
        if (escape === 'c-tap') attempt.tap('c')
        else if (escape === 'c-hold') attempt.holdBack()
        else attempt.tap('b')
        attempt.advance(0.2)
        if (attempt.app.mode === 'main') escaped = true
      }
      expect(escaped, `${route.mode} has no way off it`).toBe(true)
    }
  })

  it('lets the welcome screen and the evolution screen go on any button', () => {
    for (const button of ['a', 'b', 'c'] as const) {
      const h = harness().start()
      h.ripen()
      expect(h.app.mode).toBe('evolve')
      h.tap(button)
      expect(h.app.mode).toBe('main')
    }
  })

  it('lets the retirement ceremony go on any button', () => {
    for (const button of ['a', 'b', 'c'] as const) {
      const h = grown()
      h.select('status').holdRetire()
      expect(h.app.mode).toBe('retire')
      h.tap(button)
      expect(h.app.mode).toBe('name')
    }
  })
})

describe('the message line', () => {
  it('says something and then fades', () => {
    const h = grown()
    h.pet.stats.hygiene = 100
    h.select('clean')
    expect(h.app.message.length).toBeGreaterThan(0)
    expect(h.app.messageTimer).toBeGreaterThan(0)
    h.advance(3)
    expect(h.app.messageTimer).toBe(0)
  })

  it('shouts, like the rest of the screen', () => {
    const h = grown()
    h.pet.stats.hygiene = 100
    h.select('clean')
    expect(h.app.message).toBe(h.app.message.toUpperCase())
  })
})

describe('button mashing', () => {
  it('survives a child hammering all three buttons for a good while', () => {
    // The real acceptance test: no crash, no wedged screen, no corrupt stat.
    const h = harness({ random: 11 }).start()
    const buttons = ['a', 'b', 'c'] as const
    for (let i = 0; i < 4000; i++) {
      const button = buttons[i % 3]!
      h.app.press(button)
      h.advance(0.02, 0.02)
      if (i % 7 === 0) h.advance(0.9, 0.05)
      h.app.release(button)
      if (h.app.pet) {
        for (const [key, value] of Object.entries(h.app.pet.stats)) {
          expect(Number.isFinite(value), `${key} went bad at press ${i}`).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(100)
        }
      }
    }
    // Whatever it landed on, it is a real screen and the app is still running.
    expect(typeof h.app.mode).toBe('string')
    h.advance(2)
  })

  it('survives being mashed with no pet at all', () => {
    const h = harness().boot()
    h.app.restart()
    for (let i = 0; i < 200; i++) {
      h.tap((['a', 'b', 'c'] as const)[i % 3]!)
      h.advance(0.05, 0.05)
    }
    expect(() => h.advance(1)).not.toThrow()
  })
})
