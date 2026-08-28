/** How far the pitch can tip before the device stops reading as a device. */
const MAX_PITCH = 0.95
/** Full-width drag sweeps a little over half a turn. */
const YAW_PER_WIDTH = Math.PI * 1.2
const PITCH_PER_HEIGHT = Math.PI * 0.8
/** Spin-down rate once the pointer is released, per second. */
const DAMPING = 6
/** Below this the throw is treated as stopped. */
const REST_SPEED = 0.01
/**
 * Ceiling on throw speed, in radians per second. Pointer events can arrive
 * bunched — several in the same millisecond — which would otherwise divide a
 * normal drag by a near-zero interval and launch the device.
 */
const MAX_THROW = 6
/** Shortest interval trusted between two moves. */
const MIN_INTERVAL = 1 / 120

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

export interface OrbitOptions {
  canvas: HTMLCanvasElement
  /** True when the pointer is over a control, which takes priority over dragging. */
  isControl(clientX: number, clientY: number): boolean
  /** Inertia is dropped when the viewer prefers reduced motion. */
  reducedMotion(): boolean
}

/**
 * Drag-to-turn for the shell. This rotates the device rather than moving the
 * camera: the lights are fixed in view space, so turning the object is what
 * makes the highlight travel across the plastic.
 */
export class Orbit {
  yaw = 0
  pitch = 0
  dragging = false

  private velocityYaw = 0
  private velocityPitch = 0
  private lastX = 0
  private lastY = 0
  private lastTime = 0
  private recentring = false
  private pointer: number | null = null
  private readonly canvas: HTMLCanvasElement
  private readonly options: OrbitOptions

  constructor(options: OrbitOptions) {
    this.options = options
    this.canvas = options.canvas
    this.canvas.addEventListener('pointerdown', this.onDown)
    this.canvas.addEventListener('pointermove', this.onMove)
    this.canvas.addEventListener('pointerup', this.onUp)
    this.canvas.addEventListener('pointercancel', this.onUp)
    this.canvas.addEventListener('dblclick', this.recentre)
  }

  /** True when the device has been turned away from its resting pose. */
  get turned(): boolean {
    return Math.abs(this.wrappedYaw) > 0.02 || Math.abs(this.pitch) > 0.02
  }

  private get wrappedYaw(): number {
    const turn = Math.PI * 2
    const wrapped = ((this.yaw % turn) + turn + Math.PI) % turn - Math.PI
    return wrapped
  }

  recentre = (): void => {
    // Unwind by the shortest route rather than spinning back the long way.
    this.yaw = this.wrappedYaw
    this.recentring = true
    this.velocityYaw = 0
    this.velocityPitch = 0
  }

  private onDown = (event: PointerEvent): void => {
    // Buttons win: a press should never be swallowed by a stray drag.
    if (this.options.isControl(event.clientX, event.clientY)) return
    this.pointer = event.pointerId
    this.dragging = true
    this.recentring = false
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.lastTime = event.timeStamp
    this.velocityYaw = 0
    this.velocityPitch = 0
    this.canvas.setPointerCapture(event.pointerId)
    this.canvas.classList.add('grabbing')
  }

  private onMove = (event: PointerEvent): void => {
    if (!this.dragging || event.pointerId !== this.pointer) return
    const rect = this.canvas.getBoundingClientRect()
    const dx = ((event.clientX - this.lastX) / rect.width) * YAW_PER_WIDTH
    const dy = ((event.clientY - this.lastY) / rect.height) * PITCH_PER_HEIGHT

    this.yaw += dx
    this.pitch = clamp(this.pitch + dy, -MAX_PITCH, MAX_PITCH)

    const elapsed = Math.max(MIN_INTERVAL, (event.timeStamp - this.lastTime) / 1000)
    // Smoothed so a single jittery sample can't fling the device.
    this.velocityYaw += (dx / elapsed - this.velocityYaw) * 0.45
    this.velocityPitch += (dy / elapsed - this.velocityPitch) * 0.45
    this.velocityYaw = clamp(this.velocityYaw, -MAX_THROW, MAX_THROW)
    this.velocityPitch = clamp(this.velocityPitch, -MAX_THROW, MAX_THROW)

    this.lastX = event.clientX
    this.lastY = event.clientY
    this.lastTime = event.timeStamp
  }

  private onUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointer) return
    this.dragging = false
    this.pointer = null
    this.canvas.classList.remove('grabbing')
    if (this.options.reducedMotion()) {
      this.velocityYaw = 0
      this.velocityPitch = 0
    }
  }

  update(dt: number): void {
    if (this.recentring) {
      const ease = Math.min(1, dt * 6)
      this.yaw += (0 - this.yaw) * ease
      this.pitch += (0 - this.pitch) * ease
      if (Math.abs(this.yaw) < 0.002 && Math.abs(this.pitch) < 0.002) {
        this.yaw = 0
        this.pitch = 0
        this.recentring = false
      }
      return
    }
    if (this.dragging) return

    this.yaw += this.velocityYaw * dt
    this.pitch = clamp(this.pitch + this.velocityPitch * dt, -MAX_PITCH, MAX_PITCH)
    const decay = Math.exp(-DAMPING * dt)
    this.velocityYaw *= decay
    this.velocityPitch *= decay
    if (Math.abs(this.velocityYaw) < REST_SPEED) this.velocityYaw = 0
    if (Math.abs(this.velocityPitch) < REST_SPEED) this.velocityPitch = 0
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onUp)
    this.canvas.removeEventListener('dblclick', this.recentre)
  }
}
