import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInput, type ButtonHitTest } from '../../src/engine/input'
import type { ButtonId } from '../../src/render/shell'

/**
 * The wire between a finger and a button press.
 *
 * Everything else in this suite starts at `app.press`, which is the right place
 * to test a game from and the wrong place to find out that the press never
 * arrived. This file is the other side of that seam, and it is all edge cases:
 * a pointer that drifts mid-hold, a browser that takes capture away, a tab that
 * loses focus with a button down, a keyboard repeating a held key. Every one of
 * them is a button that sticks or a press that vanishes, and neither shows up
 * as anything but "it didn't work".
 *
 * It needs no browser. `createInput` takes a canvas and two callbacks, and the
 * only thing it asks of either is `addEventListener` -- so Node's own
 * `EventTarget` is the whole fixture.
 */

/** The half of an HTMLCanvasElement this code actually touches. */
function fakeCanvas(): EventTarget & { captured: number[]; captureThrows: boolean } {
  const target = new EventTarget() as EventTarget & { captured: number[]; captureThrows: boolean }
  target.captured = []
  target.captureThrows = false
  Object.assign(target, {
    setPointerCapture(id: number) {
      if (target.captureThrows) throw new Error('no capture here')
      target.captured.push(id)
    },
  })
  return target
}

let canvas: ReturnType<typeof fakeCanvas>
let realWindow: unknown
let teardown: () => void
let pressed: ButtonId[]
let released: ButtonId[]
let gestures: number

/** The buttons, laid out left to right, so a hit test is a bit of arithmetic. */
const hit: ButtonHitTest = (x) => (x < 100 ? 'a' : x < 200 ? 'b' : x < 300 ? 'c' : null)

function pointer(type: string, x: number, pointerId = 1): Event {
  const event = new Event(type, { cancelable: true })
  Object.assign(event, { clientX: x, clientY: 0, pointerId })
  return event
}

function key(type: string, k: string, extra: Record<string, unknown> = {}): Event {
  const event = new Event(type, { cancelable: true })
  Object.assign(event, { key: k, repeat: false, metaKey: false, ctrlKey: false, altKey: false, ...extra })
  return event
}

const on = (target: EventTarget, event: Event) => target.dispatchEvent(event)

beforeEach(() => {
  canvas = fakeCanvas()
  realWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = new EventTarget()
  pressed = []
  released = []
  gestures = 0
  teardown = createInput({
    canvas: canvas as unknown as HTMLCanvasElement,
    hit,
    onPress: (id) => pressed.push(id),
    onRelease: (id) => released.push(id),
    onGesture: () => gestures++,
  })
})

afterEach(() => {
  teardown()
  ;(globalThis as { window?: unknown }).window = realWindow
})

const win = () => (globalThis as unknown as { window: EventTarget }).window

describe('a finger on a button', () => {
  it('presses on the way down and releases on the way up', () => {
    // Down rather than up, so the button answers under the finger rather than
    // after it: a handheld that waits for the lift feels broken.
    on(canvas, pointer('pointerdown', 50))
    expect(pressed).toEqual(['a'])
    expect(released).toEqual([])
    on(win(), pointer('pointerup', 50))
    expect(released).toEqual(['a'])
  })

  it('presses the button it landed on', () => {
    for (const [x, id] of [[50, 'a'], [150, 'b'], [250, 'c']] as const) {
      on(canvas, pointer('pointerdown', x))
      on(win(), pointer('pointerup', x))
      expect(pressed.at(-1)).toBe(id)
    }
  })

  it('ignores a press that landed on no button at all', () => {
    // The rest of the glass belongs to the orbit controller, which is why this
    // returns rather than swallowing the event.
    on(canvas, pointer('pointerdown', 900))
    expect(pressed).toEqual([])
  })

  it('takes the pointer, so a drifting finger keeps its hold', () => {
    on(canvas, pointer('pointerdown', 50, 7))
    expect(canvas.captured).toEqual([7])
  })

  it('presses anyway when capture is refused', () => {
    // Capture is a nicety. A browser that will not give it should cost the
    // player a stray hold at worst, not the button.
    canvas.captureThrows = true
    on(canvas, pointer('pointerdown', 50))
    expect(pressed).toEqual(['a'])
  })

  it('lets go when the browser takes the pointer away mid-hold', () => {
    // Otherwise the button is held for ever and the next hold-to-back fires
    // the moment the player touches anything.
    on(canvas, pointer('pointerdown', 150, 3))
    on(canvas, pointer('lostpointercapture', 150, 3))
    expect(released).toEqual(['b'])
  })

  it('ignores an up from some other finger', () => {
    on(canvas, pointer('pointerdown', 150, 1))
    on(win(), pointer('pointerup', 150, 2))
    expect(released).toEqual([])
    on(win(), pointer('pointerup', 150, 1))
    expect(released).toEqual(['b'])
  })

  it('lets go of the first button when a second finger arrives', () => {
    // Two buttons held at once is not a thing this device can do, and the one
    // left behind would never be released.
    on(canvas, pointer('pointerdown', 50, 1))
    on(canvas, pointer('pointerdown', 250, 2))
    expect(pressed).toEqual(['a', 'c'])
    expect(released).toEqual(['a'])
  })

  it('treats a cancelled pointer as a release', () => {
    on(canvas, pointer('pointerdown', 50, 4))
    on(win(), pointer('pointercancel', 50, 4))
    expect(released).toEqual(['a'])
  })

  it('swallows the press, so a tap does not also swing the camera', () => {
    const event = pointer('pointerdown', 50)
    on(canvas, event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves a press somewhere else for the camera to have', () => {
    const event = pointer('pointerdown', 900)
    on(canvas, event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('stops the long-press menu, which would otherwise land mid-hold', () => {
    const event = new Event('contextmenu', { cancelable: true })
    on(canvas, event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('the keyboard', () => {
  it('maps every key the device answers to', () => {
    const map: [string, ButtonId][] = [
      ['a', 'a'], ['ArrowLeft', 'a'],
      ['b', 'b'], ['Enter', 'b'], [' ', 'b'],
      ['c', 'c'], ['ArrowRight', 'c'], ['Escape', 'c'],
    ]
    for (const [k, id] of map) {
      on(win(), key('keydown', k))
      on(win(), key('keyup', k))
      expect(pressed.at(-1), k).toBe(id)
      expect(released.at(-1), k).toBe(id)
    }
  })

  it('is not case sensitive, since shift is not a modifier here', () => {
    on(win(), key('keydown', 'B'))
    expect(pressed).toEqual(['b'])
  })

  it('reads a held key as one press rather than a burst of them', () => {
    // Auto-repeat fires keydown over and over. Counted as taps, a held key
    // would never reach a hold and would rattle through a menu instead.
    on(win(), key('keydown', 'b'))
    on(win(), key('keydown', 'b', { repeat: true }))
    on(win(), key('keydown', 'b'))
    expect(pressed).toEqual(['b'])
    on(win(), key('keyup', 'b'))
    expect(released).toEqual(['b'])
  })

  it('leaves the browser its own shortcuts', () => {
    for (const modifier of ['metaKey', 'ctrlKey', 'altKey']) {
      on(win(), key('keydown', 'c', { [modifier]: true }))
    }
    expect(pressed).toEqual([])
  })

  it('ignores a key the device has no button for', () => {
    on(win(), key('keydown', 'q'))
    on(win(), key('keyup', 'q'))
    expect(pressed).toEqual([])
    expect(released).toEqual([])
  })

  it('ignores an up for a key that was never down', () => {
    on(win(), key('keyup', 'b'))
    expect(released).toEqual([])
  })

  it('swallows a key it acted on, and leaves the rest alone', () => {
    const mine = key('keydown', 'b')
    on(win(), mine)
    expect(mine.defaultPrevented).toBe(true)
    const theirs = key('keydown', 'q')
    on(win(), theirs)
    expect(theirs.defaultPrevented).toBe(false)
  })
})

describe('losing focus mid-hold', () => {
  it('lets go of a held button', () => {
    // Alt-tabbing away with B down and coming back to a retired pet is the
    // failure this prevents.
    on(canvas, pointer('pointerdown', 150))
    on(win(), new Event('blur'))
    expect(released).toEqual(['b'])
  })

  it('lets go of every held key, not just the last one', () => {
    on(win(), key('keydown', 'a'))
    on(win(), key('keydown', 'c'))
    on(win(), new Event('blur'))
    expect(released.sort()).toEqual(['a', 'c'])
  })

  it('does not let go twice when the key comes up afterwards', () => {
    on(win(), key('keydown', 'b'))
    on(win(), new Event('blur'))
    on(win(), key('keyup', 'b'))
    expect(released).toEqual(['b'])
  })
})

describe('the first touch of all', () => {
  it('counts as a gesture, so the speaker can be woken', () => {
    // Browsers will not start audio until the player has touched something.
    on(canvas, pointer('pointerdown', 900))
    expect(gestures).toBe(1)
    on(win(), key('keydown', 'b'))
    expect(gestures).toBe(2)
  })

  it('is not counted again for a key that was already down', () => {
    on(win(), key('keydown', 'b'))
    on(win(), key('keydown', 'b', { repeat: true }))
    expect(gestures).toBe(1)
  })
})

describe('taking the wire out again', () => {
  it('stops listening to everything it was listening to', () => {
    teardown()
    on(canvas, pointer('pointerdown', 50))
    on(win(), key('keydown', 'b'))
    on(win(), new Event('blur'))
    expect(pressed).toEqual([])
    expect(gestures).toBe(0)
    // Torn down twice is what a hot reload does.
    expect(() => teardown()).not.toThrow()
  })
})
