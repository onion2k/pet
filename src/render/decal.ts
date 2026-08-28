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

/** Softens the height field so the relief has moulded edges, not stamped ones. */
function blur(data: Uint8ClampedArray, radius: number): void {
  const line = new Float32Array(Math.max(WIDTH, HEIGHT))
  const read = (x: number, y: number) => data[(y * WIDTH + x) * 4] ?? FLAT
  const write = (x: number, y: number, v: number) => {
    const i = (y * WIDTH + x) * 4
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
  const span = radius * 2 + 1

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        sum += read(Math.min(WIDTH - 1, Math.max(0, x + k)), y)
      }
      line[x] = sum / span
    }
    for (let x = 0; x < WIDTH; x++) write(x, y, line[x]!)
  }
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        sum += read(x, Math.min(HEIGHT - 1, Math.max(0, y + k)))
      }
      line[y] = sum / span
    }
    for (let y = 0; y < HEIGHT; y++) write(x, y, line[y]!)
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
  const ctx = canvas.getContext('2d')
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
