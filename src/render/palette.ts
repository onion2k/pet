import { Texture } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { MATERIALS } from '../data/seasons'
import type { Rgb } from '../game/world'

/** Padded to a power of two; the extra entries are never sampled. */
const WIDTH = 16

/**
 * The season palette as a one-row texture, looked up by material index in the
 * shader. Uploading sixteen pixels a frame is far cheaper than rebuilding the
 * terrain whenever the light or the season moves, and it lets the world change
 * colour smoothly rather than in a jump.
 */
export class PaletteTexture {
  readonly texture: Texture
  readonly width = WIDTH
  private data = new Uint8Array(WIDTH * 4)

  constructor(gl: OGLRenderingContext) {
    this.texture = new Texture(gl, {
      image: this.data,
      width: WIDTH,
      height: 1,
      generateMipmaps: false,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      flipY: false,
    })
  }

  /** Colours are linear; they are stored gamma-encoded to survive eight bits. */
  update(palette: Rgb[]): void {
    for (let i = 0; i < MATERIALS.length; i++) {
      const colour = palette[i] ?? [1, 0, 1]
      for (let c = 0; c < 3; c++) {
        const encoded = Math.pow(Math.max(0, Math.min(1, colour[c]!)), 1 / 2.2)
        this.data[i * 4 + c] = Math.round(encoded * 255)
      }
      this.data[i * 4 + 3] = 255
    }
    this.texture.image = this.data
    this.texture.needsUpdate = true
  }
}
