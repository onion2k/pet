import { Camera, Renderer, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'

/** Phone GPUs get no benefit from rendering a plastic toy at 3x. */
const MAX_DPR = 2

export interface Stage {
  renderer: Renderer
  gl: OGLRenderingContext
  camera: Camera
  scene: Transform
  /** Canvas size in CSS pixels. */
  width: number
  height: number
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new Renderer({
    canvas,
    dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
    alpha: false,
    antialias: true,
    powerPreference: 'high-performance',
  })
  const gl = renderer.gl
  gl.clearColor(0.043, 0.043, 0.055, 1)

  const camera = new Camera(gl, { fov: 28, near: 0.1, far: 100 })
  camera.position.set(0, 0.2, 9.2)
  camera.lookAt([0, 0, 0])

  const stage: Stage = { renderer, gl, camera, scene: new Transform(), width: 0, height: 0 }
  resize(stage)
  return stage
}

/**
 * The shell is a tall handheld, so we fit it to height on wide screens and to
 * width on narrow ones, keeping the whole device on screen either way.
 */
export function resize(stage: Stage): void {
  const width = window.innerWidth
  const height = window.innerHeight
  stage.width = width
  stage.height = height
  stage.renderer.setSize(width, height)

  const aspect = width / height
  stage.camera.perspective({ aspect })

  const SHELL_ASPECT = 0.56
  // Pull the camera back when the viewport is narrower than the shell.
  const fit = aspect < SHELL_ASPECT ? SHELL_ASPECT / aspect : 1
  stage.camera.position.z = 9.2 * fit
}

export function watchResize(stage: Stage): () => void {
  const onResize = () => resize(stage)
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  return () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
  }
}
