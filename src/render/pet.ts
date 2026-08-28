import { Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import type { VoxelModel } from '../data/voxel-format'
import { buildVoxelGeometry } from './voxel-mesh'

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 color;
  attribute float ao;
  attribute float part;
  attribute float emissive;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;
  uniform float uTime;
  uniform float uMood;
  uniform float uAsleep;
  uniform float uPulse;
  uniform float uHatch;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vEmissive;

  void main() {
    vec3 p = position;

    // Squash and stretch about the pet's feet, so it never sinks through the floor.
    float speed = 1.5 + uMood * 1.7;
    float hop = abs(sin(uTime * speed)) * (0.02 + 0.09 * uMood) * (1.0 - uAsleep);
    float breath = sin(uTime * 1.6) * 0.018 * (1.0 - uAsleep * 0.5);
    float squash = 1.0 - hop * 0.9 + breath;
    p.y *= squash;
    p.xz *= 1.0 + (1.0 - squash) * 0.55;
    p.y += hop;

    // The head lags the body, which is what sells the whole thing as alive.
    if (part > 0.5 && part < 1.5) {
      float lag = sin(uTime * speed - 0.7) * 0.035 * (1.0 - uAsleep);
      p.x += lag;
      p.y += hop * 0.35;
    }
    // Limbs swing opposite each other.
    if (part > 1.5) {
      p.z += sin(uTime * speed * 2.0 + sign(p.x) * 3.14159) * 0.05 * (1.0 - uAsleep);
    }

    // Sleeping: sink, tilt, and go still.
    p.y -= uAsleep * 0.18;
    p.x += uAsleep * p.y * 0.25;

    // Action impulse: a quick pop outward from the centre.
    p += normalize(p + vec3(0.0, 0.001, 0.0)) * uPulse * 0.16;

    // Hatching wipes the new body upward out of the shell.
    float reveal = step(p.y, uHatch * 3.0);
    p.y = mix(p.y - 4.0, p.y, reveal);

    vNormal = normalMatrix * normal;
    vColor = color;
    vAo = ao;
    vEmissive = emissive;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragment = /* glsl */ `
  precision highp float;

  uniform float uSick;
  uniform float uPulse;
  uniform vec3 uTint;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vEmissive;

  void main() {
    vec3 N = normalize(vNormal);
    // Key from above-right, cool fill from behind-left. Two lights is plenty for cubes.
    float key = max(dot(N, normalize(vec3(0.55, 0.9, 0.6))), 0.0);
    float fill = max(dot(N, normalize(vec3(-0.6, 0.15, -0.55))), 0.0);

    vec3 lit = vColor * (0.30 + 0.80 * key);
    lit += vColor * vec3(0.35, 0.45, 0.7) * fill * 0.35;
    lit *= vAo;

    // Illness drains the colour toward a sallow green.
    vec3 ill = mix(vec3(dot(lit, vec3(0.33))), vec3(0.42, 0.52, 0.34), 0.55) * 0.85;
    lit = mix(lit, ill, uSick);

    lit *= uTint;
    lit += vColor * vEmissive * 1.9;
    lit += vColor * uPulse * 0.6;

    // Alpha carries the bloom mask: emissive voxels plus anything genuinely bright.
    float luma = dot(lit, vec3(0.2126, 0.7152, 0.0722));
    float bloomMask = clamp(vEmissive + max(luma - 0.75, 0.0) * 2.0 + uPulse * 0.5, 0.0, 1.0);

    gl_FragColor = vec4(lit, bloomMask);
  }
`

/** World height every form is normalised to, so framing never changes on evolution. */
const PET_HEIGHT = 1.85

export type PetMood = { mood: number; asleep: boolean; sick: boolean }

export class PetView {
  readonly root = new Transform()
  private mesh: Mesh
  private program: Program
  private pulse = 0
  private hatch = 1
  private smoothMood = 0.6
  private smoothAsleep = 0
  private smoothSick = 0

  constructor(
    private gl: OGLRenderingContext,
    model: VoxelModel,
  ) {
    this.program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uMood: { value: 0.6 },
        uAsleep: { value: 0 },
        uSick: { value: 0 },
        uPulse: { value: 0 },
        uHatch: { value: 1 },
        uTint: { value: [1, 1, 1] },
      },
      cullFace: gl.BACK,
    })
    this.mesh = new Mesh(gl, { geometry: buildVoxelGeometry(gl, model, PET_HEIGHT).geometry, program: this.program })
    this.mesh.setParent(this.root)
  }

  /** Swaps in a new form. Pass `animate` to play the reveal wipe. */
  setModel(model: VoxelModel, animate = true): void {
    const built = buildVoxelGeometry(this.gl, model)
    this.mesh.geometry.remove()
    this.mesh.geometry = built.geometry
    if (animate) this.hatch = 0
  }

  /** A one-off pop, for eating, winning, or evolving. */
  pop(strength = 1): void {
    this.pulse = Math.max(this.pulse, strength)
  }

  update(dt: number, time: number, state: PetMood): void {
    // Ease every visual input so stat changes never snap.
    const ease = (from: number, to: number, rate: number) => from + (to - from) * Math.min(1, dt * rate)
    this.smoothMood = ease(this.smoothMood, state.mood, 2)
    this.smoothAsleep = ease(this.smoothAsleep, state.asleep ? 1 : 0, 3)
    this.smoothSick = ease(this.smoothSick, state.sick ? 1 : 0, 2)
    this.pulse = Math.max(0, this.pulse - dt * 2.6)
    this.hatch = Math.min(1, this.hatch + dt * 0.9)

    const u = this.program.uniforms
    u.uTime.value = time
    u.uMood.value = this.smoothMood
    u.uAsleep.value = this.smoothAsleep
    u.uSick.value = this.smoothSick
    u.uPulse.value = this.pulse * this.pulse
    u.uHatch.value = this.hatch

    // A slow idle turn keeps the silhouette from reading as a flat sprite.
    this.root.rotation.y = Math.sin(time * 0.35) * 0.28
  }
}
