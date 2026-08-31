import { describe, expect, it } from 'vitest'
import { type Harness } from '../harness'
import { openScreen, SCREENS } from '../screens'
import { NAMES, type Mode } from '../../src/game/app'
import { CURIOS } from '../../src/data/curios'
import type { ButtonId } from '../../src/render/shell'

/**
 * The whole control scheme, on one page.
 *
 * The device has three buttons and fourteen screens, and what a button does
 * depends entirely on which screen you are looking at. Those forty-two answers
 * were spread across the suite in the places somebody happened to test, which
 * covers the ones anybody thought of and says nothing at all about the rest --
 * and "the B button doesn't work" is a bug report about exactly the ones nobody
 * thought of.
 *
 * So they are written down here instead, as a table. The table is a
 * `Record<Mode, ...>`, which means a new screen does not compile until every
 * one of its buttons has been given an answer, and a binding that changes
 * without this file changing is a failing test rather than a surprise.
 *
 * Nothing here is about how a press feels or where it is drawn. It is only the
 * claim that pressing this button on that screen does that thing.
 */

type Binding =
  /** What the press does, and how to tell that it did. */
  | { does: string; check(h: Harness): void }
  /** A press this screen deliberately ignores, and why it is allowed to. */
  | { ignores: string }

type Controls = Record<Mode, Record<ButtonId, Binding>>

const CONTROLS: Controls = {
  boot: {
    // The press stops the timer; the frame after it is where that shows.
    a: { does: 'skips the power-on wipe', check: (h) => expect(h.frame().app.mode).not.toBe('boot') },
    b: { does: 'skips the power-on wipe', check: (h) => expect(h.frame().app.mode).not.toBe('boot') },
    c: { does: 'skips the power-on wipe', check: (h) => expect(h.frame().app.mode).not.toBe('boot') },
  },
  name: {
    a: {
      does: 'walks back through the names',
      check: (h) => expect(h.app.nameIndex).toBe(NAMES.length - 1),
    },
    b: {
      does: 'hatches the egg with the name on screen',
      check: (h) => expect(h.app.pet?.name).toBe(NAMES[0]),
    },
    c: { does: 'walks on through the names', check: (h) => expect(h.app.nameIndex).toBe(1) },
  },
  welcome: {
    a: { does: 'puts the welcome away', check: (h) => expect(h.app.mode).toBe('main') },
    b: { does: 'puts the welcome away', check: (h) => expect(h.app.mode).toBe('main') },
    c: { does: 'puts the welcome away', check: (h) => expect(h.app.mode).toBe('main') },
  },
  evolve: {
    a: { does: 'accepts the new form', check: (h) => expect(h.app.mode).toBe('main') },
    b: { does: 'accepts the new form', check: (h) => expect(h.app.mode).toBe('main') },
    c: { does: 'accepts the new form', check: (h) => expect(h.app.mode).toBe('main') },
  },
  main: {
    a: {
      does: 'walks the cursor back round the ring',
      check: (h) => expect(h.app.selectedIcon).toBe('status'),
    },
    b: {
      does: 'uses the icon under the cursor',
      check: (h) => expect(h.app.mode).toBe('feed'),
    },
    c: { does: 'walks the cursor on round the ring', check: (h) => expect(h.app.selectedIcon).toBe('play') },
  },
  feed: {
    a: {
      does: 'walks back through the food',
      check: (h) => expect(h.app.foodIndex).toBe(h.app.feedMenu.length - 1),
    },
    b: { does: 'feeds what is on screen', check: (h) => expect(h.app.message).not.toBe('') },
    c: { does: 'walks on through the food', check: (h) => expect(h.app.foodIndex).toBe(1) },
  },
  grounds: {
    a: {
      does: 'walks back through the places',
      check: (h) => expect(h.app.groundIndex).toBe(h.app.grounds.length - 1),
    },
    b: {
      does: 'sends the pet to the place on screen',
      check: (h) => expect(h.app.visual.foraging).toBe(true),
    },
    c: { does: 'walks on through the places', check: (h) => expect(h.app.groundIndex).toBe(1) },
  },
  forage: {
    a: {
      ignores: 'the trip is being told; only the prompt takes an answer, and only B or C',
    },
    b: { does: 'pushes on one more leg when asked', check: (h) => expect(h.app.forageBeats.length).toBeGreaterThan(1) },
    c: { does: 'calls the pet home when asked', check: (h) => expect(h.app.forageChoosing).toBe(false) },
  },
  curios: {
    a: {
      does: 'walks back round the board',
      check: (h) => expect(h.app.curioIndex).toBe(CURIOS.length - 1),
    },
    b: { does: 'trades four of a kind up', check: (h) => expect(h.app.message).not.toBe('') },
    c: { does: 'walks on round the board', check: (h) => expect(h.app.curioIndex).toBe(1) },
  },
  status: {
    a: { does: 'opens the collection board', check: (h) => expect(h.app.mode).toBe('curios') },
    b: {
      does: 'arms the hold that retires an adult',
      check: (h) => expect(h.app.retireProgress).toBeGreaterThanOrEqual(0),
    },
    c: {
      does: 'arms the hold that moves house',
      check: (h) => expect(h.app.moveProgress).toBeGreaterThanOrEqual(0),
    },
  },
  games: {
    a: {
      does: 'walks back through the games',
      check: (h) => expect(h.app.gameIndex).toBe(h.app.playMenu.length - 1),
    },
    b: { does: 'starts the game on screen', check: (h) => expect(h.app.mode).toBe('playing') },
    c: { does: 'walks on through the games', check: (h) => expect(h.app.gameIndex).toBe(1) },
  },
  playing: {
    a: { does: 'is handed to the game being played', check: (h) => expect(h.app.session).not.toBeNull() },
    b: { does: 'is handed to the game being played', check: (h) => expect(h.app.session).not.toBeNull() },
    c: { does: 'is handed to the game being played', check: (h) => expect(h.app.session).not.toBeNull() },
  },
  retire: {
    a: { does: 'dismisses the ceremony', check: (h) => expect(h.app.pet).toBeNull() },
    b: { does: 'dismisses the ceremony', check: (h) => expect(h.app.pet).toBeNull() },
    c: { does: 'dismisses the ceremony', check: (h) => expect(h.app.pet).toBeNull() },
  },
  move: {
    a: {
      does: 'walks back through the places',
      check: (h) => expect(h.app.moveIndex).toBe(h.app.homes.length - 1),
    },
    b: {
      does: 'goes to the place on screen, or says why not',
      check: (h) => expect(h.app.message).toBe('ALREADY HOME'),
    },
    c: { does: 'walks on through the places', check: (h) => expect(h.app.moveIndex).toBe(1) },
  },
}

const BUTTONS: ButtonId[] = ['a', 'b', 'c']

describe('what each button does on each screen', () => {
  for (const [mode, bindings] of Object.entries(CONTROLS) as [Mode, Record<ButtonId, Binding>][]) {
    describe(mode, () => {
      for (const button of BUTTONS) {
        const binding = bindings[button]
        if ('ignores' in binding) {
          it(`${button.toUpperCase()} does nothing: ${binding.ignores}`, () => {
            const h = openScreen(mode)
            const before = JSON.stringify(h.app.pet)
            h.clearCalls()
            h.tap(button)
            expect(h.app.mode).toBe(mode)
            expect(JSON.stringify(h.app.pet)).toBe(before)
            expect(h.calls).toEqual([])
          })
          continue
        }
        it(`${button.toUpperCase()} ${binding.does}`, () => {
          const h = openScreen(mode)
          h.tap(button)
          binding.check(h)
        })
      }
    })
  }
})

describe('the scheme as a whole', () => {
  it('has an answer written down for every screen and every button', () => {
    // The type already forces this at compile time; asserting it as well means
    // the count is visible in the run rather than only in the type checker.
    const answers = Object.values(CONTROLS).flatMap((b) => BUTTONS.map((k) => b[k]))
    expect(answers).toHaveLength(SCREENS.length * 3)
    expect(answers.every((a) => 'does' in a || 'ignores' in a)).toBe(true)
  })

  it('leaves at most a handful of presses doing nothing', () => {
    // A three-button device should not have dead buttons on it. The one
    // exception is the trip being told, which is deliberately uninterruptible.
    const dead = Object.entries(CONTROLS).flatMap(([mode, b]) =>
      BUTTONS.filter((k) => 'ignores' in b[k]).map((k) => `${mode}/${k}`),
    )
    expect(dead).toEqual(['forage/a'])
  })
})
