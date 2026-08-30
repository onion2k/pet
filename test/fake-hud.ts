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

  /** Frames begun and committed, so a draw that forgets one is visible. */
  begun = 0
  committed = 0
  glyphs: { x: number; y: number; rows: string[]; colour: string }[] = []
  meters: { x: number; y: number; value: number }[] = []
  icons: { x: number; y: number; id: string; colour: string }[] = []

  begin(): void {
    this.begun++
  }

  commit(): void {
    this.committed++
  }

  safeInset(y: number): number {
    // The real screen has rounded corners; the shape of the curve does not
    // matter here, only that a number comes back.
    return Math.max(0, 6 - y * 0.2)
  }

  safeHalfWidth(y: number): number {
    return this.width / 2 - this.safeInset(y)
  }

  icon(x: number, y: number, id: string, colour: string): void {
    this.icons.push({ x, y, id, colour })
  }

  meter(x: number, y: number, _w: number, value: number, _on: string, _off: string): void {
    this.meters.push({ x, y, value })
  }

  glyph(x: number, y: number, rows: string[], colour: string): void {
    this.glyphs.push({ x, y, rows, colour })
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
    this.glyphs = []
    this.meters = []
    this.icons = []
    this.begun = 0
    this.committed = 0
  }
}

/**
 * The subset of `Hud` the game's own drawing actually uses. Asserted structurally rather
 * than by declaring `implements Hud`, so a Hud method a game never calls does
 * not have to be faked.
 */
export const asHud = (fake: FakeHud): Hud => fake as unknown as Hud

/** A fresh recorder, wearing the Hud"s type. */
export function fakeHud(): { fake: FakeHud; hud: Hud } {
  const fake = new FakeHud()
  return { fake, hud: asHud(fake) }
}
