import type { Hud } from '../src/render/hud'

/**
 * A Hud that records instead of drawing.
 *
 * The real one owns a canvas and a texture; a minigame only ever asks it for
 * its size and tells it about rectangles and text. Recording those is enough to
 * assert that a game puts its pieces where it says it does, and it means the
 * games can be tested at the same speed as everything else.
 */

export interface DrawnRect {
  x: number
  y: number
  w: number
  h: number
  colour: string
}

export interface DrawnText {
  x: number
  y: number
  text: string
  colour: string
  scale: number
  centred: boolean
}

export class FakeHud {
  readonly width = 192
  readonly height = 172
  rects: DrawnRect[] = []
  frames: DrawnRect[] = []
  texts: DrawnText[] = []

  safeInset(y: number): number {
    // The real screen has rounded corners; the shape of the curve does not
    // matter here, only that a number comes back.
    return Math.max(0, 6 - y * 0.2)
  }

  rect(x: number, y: number, w: number, h: number, colour: string): void {
    this.rects.push({ x, y, w, h, colour })
  }

  frame(x: number, y: number, w: number, h: number, colour: string): void {
    this.frames.push({ x, y, w, h, colour })
  }

  text(x: number, y: number, text: string, colour: string, scale = 1): void {
    this.texts.push({ x, y, text, colour, scale, centred: false })
  }

  textCentered(x: number, y: number, text: string, colour: string, scale = 1): void {
    this.texts.push({ x, y, text, colour, scale, centred: true })
  }

  /** Every string drawn this frame, for a simple "is it saying X" assertion. */
  said(): string {
    return this.texts.map((t) => t.text).join(' ')
  }

  clear(): void {
    this.rects = []
    this.frames = []
    this.texts = []
  }
}

/**
 * The subset of `Hud` the minigames actually use. Asserted structurally rather
 * than by declaring `implements Hud`, so a Hud method a game never calls does
 * not have to be faked.
 */
export const asHud = (fake: FakeHud): Hud => fake as unknown as Hud

/** A fresh recorder, wearing the Hud"s type. */
export function fakeHud(): { fake: FakeHud; hud: Hud } {
  const fake = new FakeHud()
  return { fake, hud: asHud(fake) }
}
