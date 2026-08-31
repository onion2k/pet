import { Texture } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { GLYPH_GAP, GLYPH_H, GLYPH_W, glyph, textWidth } from '../data/font'

/**
 * Height map for the mouldings on the shell's front face. Mid grey is the flat
 * plastic, brighter is proud of it, darker is drilled into it. The plastic
 * shader reads this as a bump map, so the brand and grille catch the key light
 * instead of looking painted on.
 */
const WIDTH = 512
/**
 * Tall enough to reach from below the screen to under the button row, so the
 * buttons can be labelled. Without the labels every on-screen hint ("A/C PICK",
 * "HOLD C") is meaningless to anyone not on a keyboard.
 */
const HEIGHT = 328
const FLAT = 128

/**
 * Softens the height field so the relief has moulded edges, not stamped ones.
 *
 * Across, then down, with the window slid rather than re-added at every pixel:
 * a box blur that keeps a running total costs the same whatever its radius, and
 * this one runs on every cold start.
 */
function blur(data: Uint8ClampedArray, radius: number): void {
  const span = radius * 2 + 1
  // The map is grey and fully opaque, so one channel carries all of it.
  const grey = new Uint8Array(WIDTH * HEIGHT)
  for (let i = 0, p = 0; i < grey.length; i++, p += 4) grey[i] = data[p] ?? FLAT
  // Clamped rather than kept in floats, so the two passes round between them
  // exactly as they did when each wrote itself back into the image.
  const across = new Uint8ClampedArray(WIDTH * HEIGHT)

  for (let y = 0; y < HEIGHT; y++) {
    const row = y * WIDTH
    // The window starts half off the left edge, and the edge pixel stands in
    // for everything beyond it.
    let sum = grey[row]! * (radius + 1)
    for (let k = 1; k <= radius; k++) sum += grey[row + Math.min(k, WIDTH - 1)]!
    for (let x = 0; x < WIDTH; x++) {
      across[row + x] = sum / span
      sum -= grey[row + Math.max(0, x - radius)]!
      sum += grey[row + Math.min(WIDTH - 1, x + radius + 1)]!
    }
  }

  // A running total per column, carried down a row at a time. Walking the
  // columns one at a time would be the obvious way round and is much the
  // slower: every step of it jumps a whole row through memory.
  const column = new Float32Array(WIDTH)
  for (let x = 0; x < WIDTH; x++) column[x] = across[x]! * (radius + 1)
  for (let k = 1; k <= radius; k++) {
    const row = Math.min(k, HEIGHT - 1) * WIDTH
    for (let x = 0; x < WIDTH; x++) column[x]! += across[row + x]!
  }

  for (let y = 0; y < HEIGHT; y++) {
    const row = y * WIDTH
    const leaving = Math.max(0, y - radius) * WIDTH
    const entering = Math.min(HEIGHT - 1, y + radius + 1) * WIDTH
    for (let x = 0; x < WIDTH; x++) {
      const i = (row + x) * 4
      const v = column[x]! / span
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      column[x]! += across[entering + x]! - across[leaving + x]!
    }
  }
}

/** Draws `text` with its centre at `centreX`. */
function stamp(
  ctx: CanvasRenderingContext2D,
  text: string,
  scale: number,
  top: number,
  centreX = WIDTH / 2,
): void {
  let x = Math.round(centreX - textWidth(text, scale) / 2)
  for (const ch of text) {
    const rows = glyph(ch)
    for (let ry = 0; ry < GLYPH_H; ry++) {
      const row = rows[ry] ?? ''
      for (let rx = 0; rx < GLYPH_W; rx++) {
        if (row[rx] === '#') ctx.fillRect(x + rx * scale, top + ry * scale, scale, scale)
      }
    }
    x += (GLYPH_W + GLYPH_GAP) * scale
  }
}

export const DECAL_SIZE: [number, number] = [WIDTH, HEIGHT]

export function createFrontDecal(gl: OGLRenderingContext): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  // The height field is read straight back out to be blurred, which on a
  // GPU-backed canvas means waiting on a readback.
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')

  ctx.fillStyle = `rgb(${FLAT},${FLAT},${FLAT})`
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Brand, engraved. A 3x5 font's strokes are too thin to hold a flat raised
  // top at this size — as a groove it reads properly, and matches the grille.
  ctx.fillStyle = 'rgb(74,74,74)'
  stamp(ctx, 'PETZ-9000', 4, 26)

  // Speaker grille, drilled deeper than the lettering.
  ctx.fillStyle = '#000000'
  // Fewer, larger holes read as a speaker at phone size; a fine dot grid reads
  // as noise.
  const columns = 9
  const spacing = 17
  const startX = WIDTH / 2 - ((columns - 1) * spacing) / 2
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < columns; column++) {
      ctx.beginPath()
      ctx.arc(startX + column * spacing, 76 + row * 19, 4.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Button labels, engraved under each button. World x of the buttons maps to
  // canvas x through the decal rect, which spans -1..1 in local space.
  const toCanvasX = (worldX: number) => (worldX + 1) * (WIDTH / 2)
  ctx.fillStyle = 'rgb(74,74,74)'
  for (const [label, worldX] of [
    ['A', -0.68],
    ['B', 0],
    ['C', 0.68],
  ] as const) {
    stamp(ctx, label, 4, 298, toCanvasX(worldX))
  }

  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT)
  blur(image.data, 1)
  ctx.putImageData(image, 0, 0)

  return new Texture(gl, {
    image: canvas,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    flipY: true,
  })
}
