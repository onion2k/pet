import { Texture } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { PixelCanvas } from './pixels'

/**
 * The screen overlay. Everything is drawn at the screen's native low resolution
 * with pixel-snapped rectangles, then sampled with NEAREST, so no antialiasing
 * ever creeps into the look.
 *
 * The drawing itself lives in `PixelCanvas`, which knows nothing about GL; this
 * is that canvas with somewhere to send each finished frame.
 */
export class Hud extends PixelCanvas {
  readonly texture: Texture

  constructor(
    gl: OGLRenderingContext,
    width: number,
    height: number,
    cornerPower: number,
  ) {
    super(width, height, cornerPower)
    this.texture = new Texture(gl, {
      image: this.canvas,
      generateMipmaps: false,
      magFilter: gl.NEAREST,
      minFilter: gl.NEAREST,
      flipY: true,
    })
  }

  override commit(): void {
    this.texture.needsUpdate = true
  }
}
