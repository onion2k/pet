import { GLYPH_GAP, GLYPH_H, GLYPH_W, glyph, textWidth } from '../data/font'
import { ICON_SIZE, iconRows, type IconId } from '../data/icons'

/**
 * Superellipse exponent of the lit screen area. Content is laid out against it
 * so nothing is ever clipped by the rounded glass corners. It lives here rather
 * than beside the shell that shapes the glass, so anything that draws a screen
 * -- the game, and the instructions booklet -- can reach it without dragging in
 * the renderer.
 */
export const SCREEN_ROUNDNESS = 0.15
export const SCREEN_CORNER_POWER = 1 / SCREEN_ROUNDNESS

/**
 * A screen's worth of pixels, drawn at its native low resolution with
 * pixel-snapped rectangles. Nothing here knows about WebGL: the game hands the
 * finished canvas to a texture (`Hud`), and the booklet scales the same canvas
 * up on the page, so a screen shown in the instructions is drawn by the code
 * that draws it in the game rather than by a picture of it.
 */
export class PixelCanvas {
  readonly canvas: HTMLCanvasElement
  protected ctx: CanvasRenderingContext2D

  constructor(
    readonly width: number,
    readonly height: number,
    /** Superellipse exponent of the lit area, so layout can dodge the corners. */
    private readonly cornerPower: number = SCREEN_CORNER_POWER,
  ) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    const ctx = this.canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
  }

  begin(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  /** Hook for subclasses that have somewhere to send the finished frame. */
  commit(): void {}

  /**
   * Half-width of the lit area at row `y`. The screen is a superellipse, so
   * rows near the top and bottom edges are narrower than the full width.
   */
  safeHalfWidth(y: number): number {
    // Measured at the pixel's centre, which is what actually gets sampled.
    const normalised = Math.abs(1 - (2 * (y + 0.5)) / this.height)
    const remainder = 1 - Math.pow(Math.min(1, normalised), this.cornerPower)
    if (remainder <= 0) return 0
    return Math.pow(remainder, 1 / this.cornerPower) * (this.width / 2)
  }

  /** Leftmost drawable x at row `y`. Mirrored on the right. */
  safeInset(y: number): number {
    return this.width / 2 - this.safeHalfWidth(y)
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  frame(x: number, y: number, w: number, h: number, color: string): void {
    this.rect(x, y, w, 1, color)
    this.rect(x, y + h - 1, w, 1, color)
    this.rect(x, y, 1, h, color)
    this.rect(x + w - 1, y, 1, h, color)
  }

  /** Draws text with the top-left at (x, y). Returns the width consumed. */
  text(x: number, y: number, value: string, color: string, scale = 1): number {
    let cursor = Math.round(x)
    const top = Math.round(y)
    this.ctx.fillStyle = color
    for (const ch of value) {
      const rows = glyph(ch)
      for (let ry = 0; ry < GLYPH_H; ry++) {
        const row = rows[ry] ?? ''
        for (let rx = 0; rx < GLYPH_W; rx++) {
          if (row[rx] === '#') {
            this.ctx.fillRect(cursor + rx * scale, top + ry * scale, scale, scale)
          }
        }
      }
      cursor += (GLYPH_W + GLYPH_GAP) * scale
    }
    return textWidth(value, scale)
  }

  textCentered(centerX: number, y: number, value: string, color: string, scale = 1): void {
    this.text(centerX - textWidth(value, scale) / 2, y, value, color, scale)
  }

  icon(x: number, y: number, id: IconId, color: string, scale = 1): void {
    this.glyph(x, y, iconRows(id), color, scale)
  }

  /** Draws 8x8 artwork from '#'-and-'.' rows. The menu icons and the curios share it. */
  glyph(x: number, y: number, rows: string[], color: string, scale = 1): void {
    this.ctx.fillStyle = color
    for (let ry = 0; ry < ICON_SIZE; ry++) {
      const row = rows[ry] ?? ''
      for (let rx = 0; rx < ICON_SIZE; rx++) {
        if (row[rx] === '#') {
          this.ctx.fillRect(Math.round(x) + rx * scale, Math.round(y) + ry * scale, scale, scale)
        }
      }
    }
  }

  /** A chunky segmented meter. Segments read better than a smooth bar at this size. */
  meter(x: number, y: number, w: number, value: number, color: string, dim: string): void {
    const segments = Math.max(1, Math.floor(w / 3))
    const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments)
    for (let i = 0; i < segments; i++) {
      this.rect(x + i * 3, y, 2, 4, i < filled ? color : dim)
    }
  }
}
