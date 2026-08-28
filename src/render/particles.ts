import { Geometry, Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'

const MAX = 320

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 color;
  attribute float size;
  attribute float life;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uScale;

  varying vec3 vColor;
  varying float vLife;

  void main() {
    vColor = color;
    vLife = life;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Dead particles are collapsed to a zero-size point rather than branching.
    gl_PointSize = size * uScale * step(0.001, life) / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vLife;

  void main() {
    if (vLife <= 0.0) discard;
    // Square sprites, quantised alpha: particles should look like lit pixels.
    float fade = smoothstep(0.0, 0.35, vLife);
    gl_FragColor = vec4(vColor * (0.7 + 0.6 * fade), fade);
  }
`

export type Burst = 'crumb' | 'heart' | 'sparkle' | 'zzz' | 'bubble' | 'star'

interface Style {
  color: [number, number, number]
  size: number
  gravity: number
  spread: number
  rise: number
  life: number
}

const STYLES: Record<Burst, Style> = {
  crumb: { color: [1.0, 0.72, 0.3], size: 90, gravity: -3.2, spread: 1.5, rise: 1.6, life: 0.9 },
  heart: { color: [1.0, 0.35, 0.6], size: 120, gravity: -0.4, spread: 0.7, rise: 1.4, life: 1.5 },
  sparkle: { color: [1.0, 0.95, 0.55], size: 110, gravity: -0.2, spread: 2.2, rise: 1.1, life: 1.8 },
  zzz: { color: [0.55, 0.75, 1.0], size: 100, gravity: 0.0, spread: 0.25, rise: 0.7, life: 2.4 },
  bubble: { color: [0.6, 0.9, 1.0], size: 95, gravity: 0.2, spread: 1.0, rise: 1.2, life: 1.6 },
  star: { color: [1.0, 0.85, 0.2], size: 140, gravity: -1.0, spread: 2.0, rise: 2.4, life: 1.3 },
}

/** A single fixed-size point cloud recycled across every effect in the game. */
export class Particles {
  readonly root = new Transform()
  private position = new Float32Array(MAX * 3)
  private color = new Float32Array(MAX * 3)
  private size = new Float32Array(MAX)
  private life = new Float32Array(MAX)
  private velocity = new Float32Array(MAX * 3)
  private maxLife = new Float32Array(MAX)
  private gravity = new Float32Array(MAX)
  private cursor = 0
  private geometry: Geometry

  constructor(gl: OGLRenderingContext) {
    this.geometry = new Geometry(gl, {
      position: { size: 3, data: this.position },
      color: { size: 3, data: this.color },
      size: { size: 1, data: this.size },
      life: { size: 1, data: this.life },
    })
    const program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      depthWrite: false,
    })
    program.uniforms.uScale = { value: 1 }
    const mesh = new Mesh(gl, { geometry: this.geometry, program, mode: gl.POINTS })
    mesh.frustumCulled = false
    mesh.setParent(this.root)
  }

  emit(kind: Burst, origin: [number, number, number], count = 8): void {
    const style = STYLES[kind]
    for (let i = 0; i < count; i++) {
      const idx = this.cursor
      this.cursor = (this.cursor + 1) % MAX

      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * style.spread
      this.position[idx * 3] = origin[0] + Math.cos(angle) * radius * 0.2
      this.position[idx * 3 + 1] = origin[1] + (Math.random() - 0.5) * 0.2
      this.position[idx * 3 + 2] = origin[2] + Math.sin(angle) * radius * 0.2

      this.velocity[idx * 3] = Math.cos(angle) * radius * 0.5
      this.velocity[idx * 3 + 1] = style.rise * (0.6 + Math.random() * 0.8)
      this.velocity[idx * 3 + 2] = Math.sin(angle) * radius * 0.5

      const jitter = 0.85 + Math.random() * 0.3
      this.color[idx * 3] = style.color[0] * jitter
      this.color[idx * 3 + 1] = style.color[1] * jitter
      this.color[idx * 3 + 2] = style.color[2] * jitter

      this.size[idx] = style.size * (0.7 + Math.random() * 0.6)
      this.maxLife[idx] = style.life
      this.life[idx] = style.life
      this.gravity[idx] = style.gravity
    }
  }

  update(dt: number): void {
    let alive = false
    for (let i = 0; i < MAX; i++) {
      if (this.life[i]! <= 0) continue
      alive = true
      this.life[i] = Math.max(0, this.life[i]! - dt)
      this.velocity[i * 3 + 1] = this.velocity[i * 3 + 1]! + this.gravity[i]! * dt
      // Air drag, so bursts settle instead of flying off screen.
      const drag = 1 - Math.min(1, dt * 1.2)
      for (let a = 0; a < 3; a++) {
        this.velocity[i * 3 + a] = this.velocity[i * 3 + a]! * drag
        this.position[i * 3 + a] = this.position[i * 3 + a]! + this.velocity[i * 3 + a]! * dt
      }
    }
    // Skip the upload entirely when nothing is moving.
    if (!alive) return
    for (const name of ['position', 'color', 'size', 'life'] as const) {
      const attr = this.geometry.attributes[name]
      if (attr) attr.needsUpdate = true
    }
  }

  /** Point sizes are in screen pixels, so they must track the render target height. */
  setScale(pixelHeight: number): void {
    const mesh = this.root.children[0] as Mesh | undefined
    if (mesh) mesh.program.uniforms.uScale.value = pixelHeight / 400
  }
}
