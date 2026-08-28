import { Vec3 } from 'ogl'
import type { Camera, Mesh } from 'ogl'
import type { ButtonId } from '../render/shell'

export interface InputTarget {
  id: ButtonId
  mesh: Mesh
  /** Radius in world units, used to size the hit area to the drawn button. */
  radius: number
}

/** How far past the drawn button edge a tap still counts. Kept just under the
 *  button spacing so neighbouring targets never overlap. */
const TOUCH_MARGIN = 1.12
/** Floor on the hit target, in CSS pixels, for accessibility on small screens. */
const MIN_TOUCH_PX = 48

export type ButtonHitTest = (clientX: number, clientY: number) => ButtonId | null

/**
 * Buttons are hit-tested by projecting their centres to the screen rather than
 * raycasting the geometry, which keeps the targets finger-sized at any zoom.
 */
export function createButtonHitTest(
  canvas: HTMLCanvasElement,
  camera: Camera,
  targets: InputTarget[],
): ButtonHitTest {
  const centre = new Vec3()
  const edge = new Vec3()
  const facing = new Vec3()
  const toCamera = new Vec3()
  const worldPos = new Vec3()

  return (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect()
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1)
    // Compensate for aspect so the radius is a circle on screen, not an ellipse.
    const aspect = rect.width / rect.height
    // Normalised-device units span 2 over the viewport height.
    const minRadius = MIN_TOUCH_PX / rect.height

    let best: ButtonId | null = null
    // Compare how far into each button the tap landed, so neighbouring targets
    // of different sizes resolve sensibly.
    let bestScore = 1

    for (const { id, mesh, radius } of targets) {
      // Once the shell is turned away, a button's projected position is still on
      // screen but behind the case. Skip anything not facing the viewer.
      worldPos.set(0, 0, 0).applyMatrix4(mesh.worldMatrix)
      facing.set(0, 0, 1).applyMatrix4(mesh.worldMatrix).sub(worldPos)
      toCamera.copy(camera.position).sub(worldPos)
      if (facing.dot(toCamera) <= 0) continue

      centre.copy(worldPos).applyMatrix4(camera.projectionViewMatrix)
      // Project a point on the button's rim to get its on-screen radius, so the
      // hit area tracks the drawn size at any zoom or viewport.
      edge.set(radius, 0, 0).applyMatrix4(mesh.worldMatrix).applyMatrix4(camera.projectionViewMatrix)
      const drawn = Math.abs(edge.x - centre.x) * aspect
      const threshold = Math.max(drawn * TOUCH_MARGIN, minRadius)

      const dx = (nx - centre.x) * aspect
      const dy = ny - centre.y
      const score = Math.hypot(dx, dy) / threshold
      if (score < bestScore) {
        bestScore = score
        best = id
      }
    }
    return best
  }
}

const KEYS: Record<string, ButtonId> = {
  a: 'a',
  arrowleft: 'a',
  b: 'b',
  enter: 'b',
  ' ': 'b',
  arrowright: 'c',
  c: 'c',
  escape: 'c',
}

export interface InputOptions {
  canvas: HTMLCanvasElement
  hit: ButtonHitTest
  onPress(id: ButtonId): void
  /** Fired when a held button is let go, so the UI can time a hold. */
  onRelease?(id: ButtonId): void
  /** Fired for any interaction, so audio can be unlocked on the first gesture. */
  onGesture?(): void
}

export function createInput(options: InputOptions): () => void {
  const { canvas, hit, onPress, onRelease, onGesture } = options

  let heldPointer: number | null = null
  let heldByPointer: ButtonId | null = null
  const heldByKey = new Set<ButtonId>()

  const releasePointer = () => {
    if (heldByPointer) onRelease?.(heldByPointer)
    heldByPointer = null
    heldPointer = null
  }

  const onPointerDown = (event: PointerEvent) => {
    onGesture?.()
    // Presses fire on pointerdown so the buttons stay instant; drags that start
    // anywhere else are left for the orbit controller.
    const id = hit(event.clientX, event.clientY)
    if (!id) return
    event.preventDefault()
    releasePointer()
    heldByPointer = id
    heldPointer = event.pointerId
    // Capture so a finger drifting a few pixels during a long press doesn't
    // retarget the pointer and silently drop the hold.
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Capture is a nicety; the hold still works without it.
    }
    onPress(id)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === heldPointer) releasePointer()
  }

  /** A long press can still lose capture to the browser; treat that as a release. */
  const onLostCapture = (event: PointerEvent) => {
    if (event.pointerId === heldPointer) releasePointer()
  }

  /** Long-press on Android otherwise raises a context menu mid-hold. */
  const onContextMenu = (event: Event) => event.preventDefault()

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const id = KEYS[event.key.toLowerCase()]
    if (!id) return
    event.preventDefault()
    // Auto-repeat would otherwise read as a burst of taps rather than a hold.
    if (event.repeat || heldByKey.has(id)) return
    onGesture?.()
    heldByKey.add(id)
    onPress(id)
  }

  const onKeyUp = (event: KeyboardEvent) => {
    const id = KEYS[event.key.toLowerCase()]
    if (!id || !heldByKey.delete(id)) return
    onRelease?.(id)
  }

  /** Losing focus mid-hold must not leave a button stuck down. */
  const onBlur = () => {
    releasePointer()
    for (const id of heldByKey) onRelease?.(id)
    heldByKey.clear()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('lostpointercapture', onLostCapture)
  canvas.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('lostpointercapture', onLostCapture)
    canvas.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  }
}
