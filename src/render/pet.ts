import { Mesh, Plane, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import type { VoxelModel } from '../data/voxel-format'
import { buildVoxelGeometry, type VoxelGeometry } from './voxel-mesh'

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
  uniform float uLift;
  uniform float uBreath;
  uniform float uWalk;
  uniform float uWalkBlend;
  uniform float uHipY;
  uniform float uShoulderY;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vEmissive;

  void main() {
    vec3 p = position;

    // Stretch on the way up, plus a slow breath while standing. Scaling about
    // the model's base keeps the feet planted.
    float stretch = 1.0 + uLift * 0.55 + uBreath;
    p.y *= stretch;
    p.xz *= 1.0 - (stretch - 1.0) * 0.45;

    // Sleeping compresses and leans the pet. It must not translate downward:
    // there is ground underneath now, and it would sink into it.
    p.y *= 1.0 - uAsleep * 0.16;
    p.x += uAsleep * p.y * 0.22;

    // The head turns rather than sliding sideways. A rotation is rigid, so the
    // model never shears apart the way a translation of one part does.
    if (part > 0.5 && part < 1.5) {
      float a = sin(uTime * 0.55) * 0.10 * (1.0 - uAsleep);
      float sa = sin(a);
      float ca = cos(a);
      p.xz = mat2(ca, -sa, sa, ca) * p.xz;
    }
    // Walk cycle. Limbs are rotated about their joint rather than translated,
    // so an arm or leg stays attached to the body instead of shearing off it.
    // The side is read from the original attribute, before any lean moves x.
    float side = position.x < 0.0 ? 3.14159265 : 0.0;
    float swing = sin(uWalk * 6.2831853 + side) * uWalkBlend;

    if (part > 1.5 && part < 2.5) {
      float ang = swing * 0.5;
      float ca = cos(ang);
      float sa = sin(ang);
      vec2 q = vec2(p.y - uHipY, p.z);
      p.y = uHipY + ca * q.x - sa * q.y;
      p.z = sa * q.x + ca * q.y;
    } else if (part > 2.5) {
      // Arms counter-swing, which is what makes a walk read as a walk.
      float ang = -swing * 0.42;
      float ca = cos(ang);
      float sa = sin(ang);
      vec2 q = vec2(p.y - uShoulderY, p.z);
      p.y = uShoulderY + ca * q.x - sa * q.y;
      p.z = sa * q.x + ca * q.y;
    } else {
      // Everything above the hips rises and falls with each stride. Legs are
      // excluded so the feet stay planted on the ground.
      p.y += abs(sin(uWalk * 6.2831853)) * 0.03 * uWalkBlend;
    }

    // Feet splay on an idle hop, which the walk cycle replaces while moving.
    if (part > 1.5 && part < 2.5) {
      p.z += uLift * 0.5 * sign(position.x + 0.0001);
    }

    p.y += uLift;

    // Action pop, outward and up only so it never drives voxels into the ground.
    p.xz += normalize(p.xz + vec2(0.0001)) * uPulse * 0.10;
    p.y += uPulse * 0.05;

    // Nothing may sink through the ground the pet is standing on.
    p.y = max(p.y, 0.0);

    // Hatching wipes the new body upward out of the shell. Applied after the
    // floor clamp, or the hidden half would pile up at ground level.
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
/** Fraction of the hop cycle spent in the air. The rest is stood on the ground. */
const HOP_WINDOW = 0.38

const shadowVert = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const shadowFrag = /* glsl */ `
  precision highp float;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    // Soft round contact patch. Without it the pet reads as floating above the
    // ground rather than standing on it. Blended over the ground, the result is
    // roughly grass * (1 - alpha), so alpha is what controls how dark it gets.
    float d = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.45, 1.0, d)) * uStrength;
    gl_FragColor = vec4(0.02, 0.03, 0.02, a);
  }
`

export type PetMood = {
  mood: number
  asleep: boolean
  sick: boolean
  /** False for an egg, which has nothing to walk with. */
  mobile: boolean
}

/** World units per second at an amble. */
const WALK_SPEED = 0.42
/** Stride cycles per second. */
const STRIDE_RATE = 1.15

/** Shortest-path approach between two angles. */
function approachAngle(from: number, to: number, t: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * Math.min(1, t)
}

export class PetView {
  readonly root = new Transform()
  private mesh: Mesh
  private program: Program
  private pulse = 0
  private hatch = 1
  private smoothMood = 0.6
  private smoothAsleep = 0
  private smoothSick = 0
  /** Position within the hop cycle. Accumulated so changing pace never jumps. */
  private phase = 0
  private shadow: Mesh
  /** How far from the centre of the clearing the pet may roam. */
  private bounds = 1.2
  private walk = {
    x: 0,
    z: 0,
    targetX: 0,
    targetZ: 0,
    facing: 0,
    walking: false,
    timer: 1.5,
    phase: 0,
    blend: 0,
  }

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
        uLift: { value: 0 },
        uBreath: { value: 0 },
        uWalk: { value: 0 },
        uWalkBlend: { value: 0 },
        uHipY: { value: 0 },
        uShoulderY: { value: 0 },
        uTint: { value: [1, 1, 1] },
      },
      cullFace: gl.BACK,
    })
    const built = buildVoxelGeometry(gl, model, PET_HEIGHT)
    this.mesh = new Mesh(gl, { geometry: built.geometry, program: this.program })
    this.mesh.setParent(this.root)
    this.applyJoints(built)

    this.shadow = new Mesh(gl, {
      geometry: new Plane(gl, { width: PET_HEIGHT * 1.15, height: PET_HEIGHT * 1.15 }),
      program: new Program(gl, {
        vertex: shadowVert,
        fragment: shadowFrag,
        uniforms: { uStrength: { value: 0.78 } },
        transparent: true,
        depthWrite: false,
      }),
    })
    this.shadow.rotation.x = -Math.PI / 2
    // Just clear of the ground, so it never z-fights with the terrain surface.
    this.shadow.position.y = 0.012
    this.shadow.setParent(this.root)
  }

  /** Swaps in a new form. Pass `animate` to play the reveal wipe. */
  /** Joints must be refreshed with the geometry, or limbs swing about the floor. */
  private applyJoints(built: VoxelGeometry): void {
    this.program.uniforms.uHipY.value = built.hipY
    this.program.uniforms.uShoulderY.value = built.shoulderY
  }

  setModel(model: VoxelModel, animate = true): void {
    // PET_HEIGHT is not optional here: without it this falls back to the
    // builder's default and every form after the egg comes out oversized.
    const built = buildVoxelGeometry(this.gl, model, PET_HEIGHT)
    this.mesh.geometry.remove()
    this.mesh.geometry = built.geometry
    this.applyJoints(built)
    if (animate) this.hatch = 0
  }

  /** Limits the roaming to the level ground of the clearing. */
  setBounds(radius: number): void {
    this.bounds = Math.max(0, radius)
  }

  /** Where the pet currently is, so effects can be emitted at it. */
  get position(): { x: number; z: number } {
    return { x: this.walk.x, z: this.walk.z }
  }

  /** A one-off pop, for eating, winning, or evolving. */
  pop(strength = 1): void {
    this.pulse = Math.max(this.pulse, strength)
  }

  /**
   * Ambles around the clearing: pick somewhere to go, walk there, pause, then
   * turn back to face the viewer. Targets are biased across the frame rather
   * than into it, so the pet spends most of its time showing its face.
   */
  private roam(dt: number, state: PetMood): void {
    const w = this.walk
    const canWalk = state.mobile && !state.asleep

    if (!canWalk) {
      w.walking = false
    } else if (w.walking) {
      const dx = w.targetX - w.x
      const dz = w.targetZ - w.z
      const distance = Math.hypot(dx, dz)
      if (distance < 0.04) {
        w.walking = false
        w.timer = 2.5 + Math.random() * 4.5
      } else {
        const step = Math.min(distance, WALK_SPEED * dt)
        w.x += (dx / distance) * step
        w.z += (dz / distance) * step
        w.facing = approachAngle(w.facing, Math.atan2(dx, dz), dt * 4)
        w.phase = (w.phase + dt * STRIDE_RATE) % 1
      }
    } else {
      w.timer -= dt
      w.facing = approachAngle(w.facing, 0, dt * 2)
      if (w.timer <= 0) {
        const angle = Math.random() * Math.PI * 2
        const radius = this.bounds * (0.35 + Math.random() * 0.65)
        w.targetX = Math.cos(angle) * radius
        // Flattened in z: wandering toward or away from the camera reads badly
        // on a screen this small.
        w.targetZ = Math.sin(angle) * radius * 0.45
        w.walking = true
      }
    }

    w.blend += ((w.walking ? 1 : 0) - w.blend) * Math.min(1, dt * 6)
  }

  update(dt: number, time: number, state: PetMood): void {
    // Ease every visual input so stat changes never snap.
    const ease = (from: number, to: number, rate: number) => from + (to - from) * Math.min(1, dt * rate)
    this.smoothMood = ease(this.smoothMood, state.mood, 2)
    this.smoothAsleep = ease(this.smoothAsleep, state.asleep ? 1 : 0, 3)
    this.smoothSick = ease(this.smoothSick, state.sick ? 1 : 0, 2)
    this.pulse = Math.max(0, this.pulse - dt * 2.6)
    this.hatch = Math.min(1, this.hatch + dt * 0.9)

    this.roam(dt, state)

    // A hop is a short arc followed by a long beat standing still, not a
    // continuous bob: `abs(sin())` leaves the pet airborne almost always, which
    // reads as floating now that there is ground under it. It gives way to the
    // walk cycle while the pet is on the move.
    const rate = 0.5 + this.smoothMood * 0.55
    this.phase = (this.phase + dt * rate) % 1
    const arc = Math.min(this.phase / HOP_WINDOW, 1)
    const lift =
      Math.sin(arc * Math.PI) *
      (0.05 + 0.13 * this.smoothMood) *
      (1 - this.smoothAsleep) *
      (1 - this.walk.blend)
    const breath = Math.sin(time * 1.4) * 0.014 * (1 - this.smoothAsleep * 0.5)

    const u = this.program.uniforms
    u.uTime.value = time
    u.uMood.value = this.smoothMood
    u.uAsleep.value = this.smoothAsleep
    u.uSick.value = this.smoothSick
    u.uPulse.value = this.pulse * this.pulse
    u.uHatch.value = this.hatch
    u.uLift.value = lift
    u.uBreath.value = breath
    u.uWalk.value = this.walk.phase
    u.uWalkBlend.value = this.walk.blend

    // Facing comes from the stroll; the idle sway only applies while stopped.
    this.root.position.x = this.walk.x
    this.root.position.z = this.walk.z
    this.root.rotation.y = this.walk.facing + Math.sin(time * 0.22) * 0.09 * (1 - this.walk.blend)

    // Shadow and body read the same lift, so they can never disagree.
    const tighten = 1 - lift * 1.6
    this.shadow.scale.set(tighten, 1, tighten)
    this.shadow.program.uniforms.uStrength.value =
      (0.78 - lift * 1.3) * (1 - this.smoothAsleep * 0.3)
  }
}
