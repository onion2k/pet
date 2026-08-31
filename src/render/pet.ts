import { Geometry, Mesh, Plane, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { LAMP_COUNT } from '../data/biome'
import type { VoxelModel } from '../data/voxel-format'
import {
  buildVoxelGeometry,
  geometryFrom,
  modelSource,
  mergeArrays,
  voxelArrays,
  type VoxelGeometry,
} from './voxel-mesh'
import { buildFace, faceAnchors } from './face'
import { buildWorn, kitAnchors } from './worn'
import type { KitId } from '../data/kit'

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 color;
  attribute float ao;
  attribute float part;
  attribute float emissive;
  attribute float faceKind;
  attribute vec3 faceLocal;
  attribute float faceParam;

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
  uniform float uHeight;
  uniform vec2 uGaze;
  uniform float uGazeRange;
  uniform float uEyeOpen;
  uniform float uSmile;
  uniform float uBrow;
  uniform float uBrowTilt;
  uniform float uBrowLift;
  uniform float uMouthHalf;
  uniform float uDroop;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vEmissive;
  varying vec3 vViewPos;

  void main() {
    vec3 p = position;

    // The face is part of this mesh, so it is posed here in model space and
    // then carried through every body deformation below exactly as the head is.
    if (faceKind > 0.5) {
      vec3 centre = position - faceLocal;
      vec3 offset = faceLocal;
      if (faceKind < 1.5) {
        // Whites: squashed toward the eye's middle to blink.
        offset.y *= uEyeOpen;
      } else if (faceKind < 2.5) {
        // Pupils: blink with the whites, and travel with the gaze.
        offset.y *= uEyeOpen;
        centre.xy += uGaze * uGazeRange;
      } else if (faceKind < 3.5) {
        // Mouth: the corners lift for a smile and drop for a frown, so the
        // run of blocks bends into a curve.
        float k = clamp(faceParam, -1.0, 1.0);
        centre.y += uSmile * k * k * uMouthHalf * 0.55;
      } else {
        // Brows: raised or knitted, and tilted in opposite directions so the
        // pair reads as cross, worried or delighted rather than merely moved.
        float a = uBrowTilt * faceParam;
        float sa = sin(a);
        float ca = cos(a);
        offset.xy = mat2(ca, -sa, sa, ca) * offset.xy;
        centre.y += uBrow * uBrowLift;
      }
      p = centre + offset;
    }

    // Stretch on the way up, plus a slow breath while standing. Scaling about
    // the model's base keeps the feet planted.
    float stretch = 1.0 + uLift * 0.55 + uBreath;
    p.y *= stretch;
    p.xz *= 1.0 - (stretch - 1.0) * 0.45;

    // Sleeping settles the pet rather than shrinking it: it loses a little
    // height but spreads to match, so its bulk is unchanged. Scaling height
    // alone reads as the pet getting smaller. It must not translate downward
    // either — there is ground underneath now, and it would sink into it.
    float settle = uAsleep * 0.10;
    p.y *= 1.0 - settle;
    p.xz *= 1.0 + settle * 0.7;
    p.x += uAsleep * p.y * 0.22;

    // The idle look-around is a twist, not a rigid head rotation: the turn
    // ramps smoothly with height, so neighbouring voxels move all but
    // identically and no seam can open — rigid head-vs-body rotation tore
    // visible gaps around the eyes, where head and body parts interleave.
    float turn = sin(uTime * 0.55) * 0.14 * (1.0 - uAsleep);
    float span = max(uHeight - uHipY, 0.001);
    if (part < 1.5) {
      float w = clamp((p.y - uHipY) / span, 0.0, 1.0);
      float a = turn * w * w;
      float sa = sin(a);
      float ca = cos(a);
      p.xz = mat2(ca, -sa, sa, ca) * p.xz;
    } else if (part > 2.5) {
      // Arms follow the twist their shoulder socket makes, evaluated at the
      // socket's own height, so the whole arm moves rigidly with its mount.
      float w = clamp((uShoulderY - uHipY) / span, 0.0, 1.0);
      float a = turn * w * w;
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

    // Sadness bows everything above the hips forward and down. The legs are
    // left out of it so the feet stay where they were put.
    if (uDroop > 0.001 && (part < 1.5 || part > 2.5)) {
      float bow = uDroop * 0.3;
      float cb = cos(bow);
      float sb = sin(bow);
      vec2 qb = vec2(p.y - uHipY, p.z);
      p.y = uHipY + cb * qb.x - sb * qb.y;
      p.z = sb * qb.x + cb * qb.y;
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
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  #define LAMP_COUNT ${LAMP_COUNT}

  uniform float uSick;
  uniform float uPulse;
  uniform vec3 uTint;
  uniform vec3 uLightDir;
  uniform vec3 uLightColour;
  uniform float uLightIntensity;
  uniform vec3 uAmbientColour;
  uniform float uAmbientIntensity;
  uniform vec3 uLampPos[LAMP_COUNT];
  uniform vec3 uLampColour;
  uniform float uLampIntensity;
  uniform float uLampRadius;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vEmissive;
  varying vec3 vViewPos;

  void main() {
    vec3 N = normalize(vNormal);
    // Sun or moon as the key, sky as the fill. Both come from the world clock,
    // so the pet is lit by the same light as the ground it stands on.
    float key = max(dot(N, uLightDir), 0.0);
    float fill = max(dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5, 0.0);

    vec3 lit = vColor * uLightColour * (key * uLightIntensity);
    lit += vColor * uAmbientColour * (fill * uAmbientIntensity);
    lit *= vAo;

    // The pet is lit by the lanterns too, so walking up to one after dark
    // actually does something.
    vec3 lampSum = vec3(0.0);
    for (int i = 0; i < LAMP_COUNT; i++) {
      vec3 toLamp = uLampPos[i] - vViewPos;
      float lampDist = length(toLamp);
      float falloff = clamp(1.0 - lampDist / uLampRadius, 0.0, 1.0);
      falloff *= falloff;
      float lampKey = max(dot(N, normalize(toLamp)), 0.0) * 0.75 + 0.25;
      lampSum += uLampColour * (lampKey * falloff);
    }
    lit += vColor * lampSum * uLampIntensity;

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

/** Whether two lists of kit hold the same things, order aside. */
const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

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
  /** Out looking for something, which means genuinely out of the yard. */
  foraging: boolean
}

/** World units per second at an amble. The meadow is wide, so this is a
 *  purposeful walk rather than the old shuffle. */
const WALK_SPEED = 0.7
/** Stride cycles per second. */
const STRIDE_RATE = 1.15

/** Roughly the pet's half-width, used to keep it clear of the shelter walls. */
const PET_RADIUS = 0.8
/** How much faster the pet moves when it is on its way somewhere. */
const FORAGE_TROT = 3
/** The lantern post's footprint, for walking round rather than through. */
const LAMP_RADIUS = 0.3

/** Where the shelter is, so the pet can walk into it. */
export interface ShelterTarget {
  centre: { x: number; z: number }
  half: { x: number; z: number }
  inside: { x: number; z: number }
  /** Every lantern in the yard, all of which the pet has to walk around. */
  lamps: readonly { x: number; z: number }[]
}

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
  /** How far the pet may roam: half-extents, wide in x and shallow in z. */
  private bounds = { x: 1.2, z: 1.0 }
  private shelter: ShelterTarget | null = null
  /** Something in the yard worth walking over to, when there is one. */
  private plaything: { x: number; z: number } | null = null
  private hasFace = false
  /** What the pet has on, and the form it was last built onto. */
  private worn: KitId[] = []
  private form: VoxelModel | null = null
  /** Where the glow is on whatever it is carrying, in the pet's own space. */
  private wornLight: { x: number; y: number; z: number } | null = null
  /** Where the eyes are looking, and how far they have got there. */
  private gaze = { x: 0, y: 0, toX: 0, toY: 0, timer: 0 }
  private blink = { timer: 2, open: 1 }
  private smile = 0
  private brow = 0
  /** False until the first update, so a pet loaded asleep starts indoors. */
  private started = false
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
    where: 'out' as
      | 'out'
      | 'heading-in'
      | 'in'
      | 'heading-out'
      | 'leaving'
      | 'gone'
      // Walking off to forage, away over the hill, and walking back again.
      | 'away-out'
      | 'away'
      | 'away-back',
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
        uHeight: { value: PET_HEIGHT },
        uGaze: { value: [0, 0] },
        uGazeRange: { value: 0 },
        uEyeOpen: { value: 1 },
        uSmile: { value: 0 },
        uBrow: { value: 0 },
        uBrowTilt: { value: 0 },
        uBrowLift: { value: 0 },
        uMouthHalf: { value: 0 },
        uDroop: { value: 0 },
        uLightDir: { value: [0.4, 0.8, 0.45] },
        uLightColour: { value: [1, 1, 1] },
        uLightIntensity: { value: 1 },
        uAmbientColour: { value: [0.5, 0.6, 0.8] },
        uAmbientIntensity: { value: 0.3 },
        uLampPos: { value: new Float32Array(LAMP_COUNT * 3) },
        uLampColour: { value: [1, 0.82, 0.5] },
        uLampIntensity: { value: 0 },
        uLampRadius: { value: 4.5 },
        uTint: { value: [1, 1, 1] },
      },
      cullFace: gl.BACK,
    })
    // An empty shell to begin with: setModel builds the real geometry, and it
    // is the only place that knows to attach the face attributes the program
    // declares. A geometry missing them cannot be drawn at all.
    this.mesh = new Mesh(gl, { geometry: new Geometry(gl), program: this.program })
    this.mesh.setParent(this.root)
    this.setModel(model, false)

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
    this.program.uniforms.uHeight.value = built.height
  }

  /**
   * What the pet is wearing.
   *
   * Kit turns with the weather, so this is called far more often than the form
   * changes and does nothing at all when the answer has not moved. When it has,
   * the body is rebuilt: worn kit is part of the one mesh rather than a mesh of
   * its own, which is what buys it every deformation in the shader for free and
   * costs it a rebuild to change.
   */
  setWorn(worn: KitId[]): void {
    if (same(this.worn, worn)) return
    this.worn = [...worn]
    // No reveal wipe: putting a hat on is not hatching.
    if (this.form) this.setModel(this.form, false)
  }

  setModel(model: VoxelModel, animate = true): void {
    // PET_HEIGHT is not optional here: without it this falls back to the
    // builder's default and every form after the egg comes out oversized.
    const built = buildVoxelGeometry(this.gl, model, PET_HEIGHT)
    const source = modelSource(model)
    const scale = PET_HEIGHT / source.h
    const body = voxelArrays(source, {
      scale,
      origin: [(-source.w / 2) * scale, 0, (-source.d / 2) * scale],
    })
    // The face joins the body in one mesh, so the shader's stretching,
    // settling, twisting and hopping carry it along with the head.
    const anchors = faceAnchors(model, PET_HEIGHT)
    const face = anchors ? buildFace(anchors) : null
    // Kit rides on the body in the same way the face does, and only on a
    // creature with a face: the one form without one is the egg, which has no
    // head to put a hat on and has never been out to earn one either.
    const worn = anchors ? buildWorn(this.worn, kitAnchors(model, PET_HEIGHT)) : null
    this.wornLight = worn?.light ?? null
    const withKit = worn ? mergeArrays(body, worn.arrays) : body
    const bodyVerts = withKit.position.length / 3

    const merged = face ? mergeArrays(withKit, face.arrays) : withKit

    const geometry = geometryFrom(this.gl, merged)
    // Every pet carries these, faceless ones included: the program declares the
    // attributes, and a geometry missing them cannot be drawn at all.
    const zeros = (n: number) => new Array(n).fill(0)
    geometry.addAttribute('faceKind', {
      size: 1,
      data: new Float32Array(zeros(bodyVerts).concat(face ? face.face.kind : [])),
    })
    geometry.addAttribute('faceLocal', {
      size: 3,
      data: new Float32Array(zeros(bodyVerts * 3).concat(face ? face.face.local : [])),
    })
    geometry.addAttribute('faceParam', {
      size: 1,
      data: new Float32Array(zeros(bodyVerts).concat(face ? face.face.param : [])),
    })

    this.mesh.geometry.remove()
    this.mesh.geometry = geometry
    built.geometry.remove()

    this.form = model
    this.hasFace = face !== null
    const u = this.program.uniforms
    u.uGazeRange.value = face ? face.gazeRange : 0
    u.uMouthHalf.value = face ? face.mouthHalf : 0
    u.uBrowLift.value = face ? face.browLift : 0

    this.applyJoints(built)
    if (animate) this.hatch = 0
  }

  /**
   * Where the pet's own light is, in world space, or null when it is carrying
   * nothing lit.
   *
   * The kit is drawn inside the pet's mesh and bent about by the vertex
   * shader, so where a voxel truly ends up is only known on the card. This is
   * the resting place of the glow, turned and moved with the pet -- near
   * enough for a light with a soft falloff, and the alternative is reading
   * geometry back off the GPU every frame to move a lamp by a few
   * hundredths.
   */
  lightAt(): { x: number; y: number; z: number } | null {
    const local = this.wornLight
    if (!local) return null
    const facing = this.walk.facing
    const sin = Math.sin(facing)
    const cos = Math.cos(facing)
    return {
      x: this.root.position.x + local.x * cos + local.z * sin,
      y: this.root.position.y + local.y,
      z: this.root.position.z - local.x * sin + local.z * cos,
    }
  }

  /** Limits the roaming to the level ground of the lane. */
  setBounds(halfX: number, halfZ: number): void {
    this.bounds = { x: Math.max(0, halfX), z: Math.max(0, halfZ) }
  }

  /** Applies the current sky and sun, shared with the terrain. */
  setLighting(lighting: {
    direction: [number, number, number]
    colour: [number, number, number]
    intensity: number
    ambientColour: [number, number, number]
    ambientIntensity: number
  }): void {
    const u = this.program.uniforms
    u.uLightDir.value = lighting.direction
    u.uLightColour.value = lighting.colour
    u.uLightIntensity.value = lighting.intensity
    u.uAmbientColour.value = lighting.ambientColour
    u.uAmbientIntensity.value = lighting.ambientIntensity
  }

  /**
   * Drives the face. Everything here is a mood read off the same numbers the
   * rest of the pet uses, so the expression can never disagree with the pet.
   */
  private expression(dt: number): void {
    if (!this.hasFace) return
    const u = this.program.uniforms

    // --- looking about ------------------------------------------------------
    const g = this.gaze
    g.timer -= dt
    if (g.timer <= 0) {
      // Mostly a glance somewhere, occasionally straight down the lens.
      const outward = Math.random()
      if (outward < 0.3) {
        g.toX = 0
        g.toY = 0
      } else {
        g.toX = (Math.random() * 2 - 1) * 0.9
        g.toY = (Math.random() * 2 - 1) * 0.55
      }
      g.timer = 0.7 + Math.random() * 2.4
    }
    // A sad pet looks down and keeps looking down.
    const low = (1 - this.smoothMood) * 0.9
    const wantX = g.toX * (1 - this.smoothAsleep)
    const wantY = g.toY * (1 - low) - low
    g.x += (wantX - g.x) * Math.min(1, dt * 7)
    g.y += (wantY - g.y) * Math.min(1, dt * 7)
    u.uGaze.value = [g.x, g.y]

    // --- blinking -----------------------------------------------------------
    const b = this.blink
    b.timer -= dt
    if (b.timer <= 0) {
      b.timer = 2.2 + Math.random() * 3.6
      b.open = -0.18
    }
    // Held negative for a moment, which is the shut part of the blink.
    b.open = Math.min(1, b.open + dt * 7)
    const asleepShut = 1 - this.smoothAsleep
    // Sickness leaves the eyes heavy.
    const heavy = 1 - this.smoothSick * 0.45
    u.uEyeOpen.value = Math.max(0, Math.min(1, b.open)) * asleepShut * heavy

    // --- mouth and brows ----------------------------------------------------
    // Mood runs 0..1; the mouth runs frown to smile across it.
    const wantSmile = this.smoothAsleep > 0.5 ? 0.15 : this.smoothMood * 2 - 1
    this.smile += (wantSmile - this.smile) * Math.min(1, dt * 3)
    u.uSmile.value = this.smile

    // Brows lift when happy, knit when unhappy or unwell.
    const wantBrow = this.smoothMood * 2 - 1 - this.smoothSick * 0.5
    this.brow += (wantBrow - this.brow) * Math.min(1, dt * 3)
    u.uBrow.value = this.brow
    // Knitted brows tilt inward; a delighted pet's tilt the other way.
    u.uBrowTilt.value = -this.brow * 0.38

    // And the whole pet stoops when it is miserable, which reads from across
    // the yard in a way that an eyebrow never will.
    u.uDroop.value = Math.max(0, 1 - this.smoothMood * 1.6) * (1 - this.smoothAsleep)
  }

  /** True while the pet is cheerful enough to be humming to itself. */
  get cheerful(): boolean {
    return this.smoothMood > 0.72 && this.smoothAsleep < 0.2
  }


  /** The lanterns, as view-space positions packed xyz, and one shared strength. */
  setLamps(positions: Float32Array, intensity: number): void {
    const u = this.program.uniforms
    u.uLampPos.value = positions
    u.uLampIntensity.value = intensity
  }

  /** A ball or the like, which the pet will wander over to more often than not. */
  setPlaything(target: { x: number; z: number } | null): void {
    this.plaything = target
  }

  /** Tells the pet where its shelter is, so it can take itself to bed. */
  setShelter(shelter: ShelterTarget | null): void {
    this.shelter = shelter
  }

  /** True while the pet is out of the yard entirely, off foraging. */
  get away(): boolean {
    return this.walk.where === 'away'
  }

  /** True while the pet is settled inside its shelter. */
  get sheltered(): boolean {
    return this.walk.where === 'in'
  }

  /**
   * Sends the pet walking off into the haze -- to retire, or to move house. It
   * keeps going until it vanishes, and *only* `resetPosition` brings the stage
   * back: nothing else in here undoes it, and a caller that means the pet to
   * return has to say so.
   */
  walkOff(): void {
    const w = this.walk
    w.where = 'leaving'
    w.walking = true
    w.targetX = 3.4
    w.targetZ = -3.6
  }

  /** Returns the stage to the clearing, for a new egg or a pet arriving home. */
  resetPosition(): void {
    const w = this.walk
    w.x = 0
    w.z = 0
    w.facing = 0
    w.walking = false
    w.where = 'out'
    w.timer = 1.5
    w.blend = 0
    this.mesh.visible = true
    this.shadow.visible = true
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
  /** A spot inside the shelter is off limits to ordinary wandering. */
  /**
   * Pushes the walk direction away from the lantern when the pet gets close to
   * it. The pet steers rather than plans, so a straight line to the door that
   * happens to run through the post becomes a curve around it.
   */
  private steerRoundLamp(x: number, z: number, dx: number, dz: number): [number, number] {
    const sh = this.shelter
    if (!sh) return [dx, dz]
    const clear = LAMP_RADIUS + PET_RADIUS * 0.7
    let nx = dx
    let nz = dz
    for (const lamp of sh.lamps) {
      const ox = x - lamp.x
      const oz = z - lamp.z
      const distance = Math.hypot(ox, oz)
      if (distance > clear || distance < 1e-4) continue
      const push = ((clear - distance) / clear) * 3.2
      nx += (ox / distance) * push
      nz += (oz / distance) * push
    }
    if (nx === dx && nz === dz) return [dx, dz]
    const length = Math.hypot(nx, nz) || 1
    return [nx / length, nz / length]
  }

  private blockedByShelter(x: number, z: number): boolean {
    const sh = this.shelter
    if (!sh) return false
    // The lanterns are solid posts, so they are dodged like the walls.
    for (const lamp of sh.lamps) {
      if (Math.hypot(x - lamp.x, z - lamp.z) < LAMP_RADIUS + PET_RADIUS) return true
    }
    return (
      Math.abs(x - sh.centre.x) < sh.half.x + PET_RADIUS &&
      Math.abs(z - sh.centre.z) < sh.half.z + PET_RADIUS
    )
  }

  /** Somewhere in the clearing that is not inside the shelter. */
  private pickRoamTarget(): { x: number; z: number } | null {
    for (let attempt = 0; attempt < 12; attempt++) {
      // Somewhere in the lane's ellipse. Biased away from where it already is
      // so it strikes out across the meadow rather than shuffling on the spot.
      const angle = Math.random() * Math.PI * 2
      const reach = 0.35 + Math.random() * 0.65
      const x = Math.cos(angle) * reach * this.bounds.x
      const z = Math.sin(angle) * reach * this.bounds.z
      if (!this.blockedByShelter(x, z)) return { x, z }
    }
    return null
  }

  /**
   * Where to amble next. A ball in the yard pulls the pet over about a third of
   * the time, which is enough to read as playing with it without the pet
   * standing over it all day.
   */
  private nextTarget(): { x: number; z: number } | null {
    const toy = this.plaything
    if (toy && Math.random() < 0.35) {
      // Stopping a short way off, so the pet noses at it rather than standing in it.
      const angle = Math.random() * Math.PI * 2
      const x = toy.x + Math.cos(angle) * 0.75
      const z = toy.z + Math.sin(angle) * 0.4
      if (
        Math.abs(x) < this.bounds.x &&
        Math.abs(z) < this.bounds.z &&
        !this.blockedByShelter(x, z)
      ) {
        return { x, z }
      }
    }
    return this.pickRoamTarget()
  }

  /**
   * Ambles around the clearing, and takes itself into the shelter to sleep.
   * Targets are biased across the frame rather than into it, so the pet spends
   * most of its time showing its face.
   */
  private roam(dt: number, state: PetMood): void {
    const w = this.walk
    const sh = this.shelter

    // A retiring pet walks out of the world and nothing interrupts it.
    if (w.where === 'leaving' || w.where === 'gone') {
      if (w.where === 'leaving') {
        const dx = w.targetX - w.x
        const dz = w.targetZ - w.z
        const distance = Math.hypot(dx, dz)
        if (distance < 0.06) {
          w.where = 'gone'
          w.walking = false
          this.mesh.visible = false
          this.shadow.visible = false
        } else {
          const step = Math.min(distance, WALK_SPEED * 1.6 * dt)
          w.x += (dx / distance) * step
          w.z += (dz / distance) * step
          w.facing = approachAngle(w.facing, Math.atan2(dx, dz), dt * 4)
          w.phase = (w.phase + dt * STRIDE_RATE) % 1
        }
      }
      w.blend += ((w.walking ? 1 : 0) - w.blend) * Math.min(1, dt * 6)
      return
    }

    if (!state.mobile) {
      w.walking = false
      return
    }

    // --- off foraging -------------------------------------------------------
    // Sent out, the pet walks to the edge of the yard and over it. "Off it
    // goes" ought to mean it went somewhere.
    if (state.foraging && w.where !== 'away-out' && w.where !== 'away') {
      w.where = 'away-out'
      // Always off to the right, so the leaving and the coming back read as the
      // same journey each time rather than depending on where it happened to be.
      w.targetX = this.bounds.x + 1.5
      w.targetZ = w.z
      w.walking = true
      this.mesh.visible = true
      this.shadow.visible = true
    } else if (!state.foraging && (w.where === 'away' || w.where === 'away-out')) {
      // Back over the hill, from the side it left by.
      w.where = 'away-back'
      w.x = this.bounds.x + 1.5
      const next = this.pickRoamTarget()
      w.targetX = next?.x ?? 0
      w.targetZ = next?.z ?? 0
      w.walking = true
      this.mesh.visible = true
      this.shadow.visible = true
    }

    if (w.where === 'away') {
      w.walking = false
      w.blend += ((w.walking ? 1 : 0) - w.blend) * Math.min(1, dt * 6)
      return
    }

    // Going to bed, and getting up again, take priority over wandering.
    // An 'away' pet has already returned above, so only the two legs remain.
    if (sh && w.where !== 'away-out' && w.where !== 'away-back') {
      if (state.asleep && w.where === 'out') {
        w.where = 'heading-in'
        w.targetX = sh.inside.x
        w.targetZ = sh.inside.z
        w.walking = true
      } else if (!state.asleep && w.where === 'in') {
        const next = this.nextTarget()
        w.where = 'heading-out'
        w.targetX = next?.x ?? 0
        w.targetZ = next?.z ?? 0
        w.walking = true
      }
    }

    if (w.walking) {
      const dx = w.targetX - w.x
      const dz = w.targetZ - w.z
      const distance = Math.hypot(dx, dz)
      if (distance < 0.04) {
        w.walking = false
        w.timer = 2.5 + Math.random() * 4.5
        if (w.where === 'heading-in') w.where = 'in'
        else if (w.where === 'heading-out') w.where = 'out'
        else if (w.where === 'away-out') {
          // Over the hill and out of sight until it is due back.
          w.where = 'away'
          this.mesh.visible = false
          this.shadow.visible = false
        } else if (w.where === 'away-back') w.where = 'out'
      } else {
        // A pet with somewhere to be moves like it: the walk out of the yard
        // and back is a trot, not the amble it uses to potter about.
        const hurrying = w.where === 'away-out' || w.where === 'away-back'
        const step = Math.min(distance, WALK_SPEED * (hurrying ? FORAGE_TROT : 1) * dt)
        const [sx, sz] = this.steerRoundLamp(w.x, w.z, dx / distance, dz / distance)
        w.x += sx * step
        w.z += sz * step
        w.facing = approachAngle(w.facing, Math.atan2(sx, sz), dt * 4)
        w.phase = (w.phase + dt * STRIDE_RATE) % 1
      }
    } else {
      // Settled: face the viewer, and only set off again if awake and outdoors.
      w.facing = approachAngle(w.facing, 0, dt * 2)
      if (w.where === 'out') {
        w.timer -= dt
        if (w.timer <= 0) {
          const next = this.nextTarget()
          if (next) {
            w.targetX = next.x
            w.targetZ = next.z
            w.walking = true
          } else {
            w.timer = 2
          }
        }
      }
    }

    w.blend += ((w.walking ? 1 : 0) - w.blend) * Math.min(1, dt * 6)
  }

  update(dt: number, time: number, state: PetMood): void {
    // Ease every visual input so stat changes never snap.
    const ease = (from: number, to: number, rate: number) => from + (to - from) * Math.min(1, dt * rate)
    this.smoothMood = ease(this.smoothMood, state.mood, 2)
    // Curl up only once it has arrived: a pet shuffling to bed should still be
    // walking, not hunched over mid-stride.
    const settled = state.asleep && (!this.shelter || this.walk.where === 'in')
    this.smoothAsleep = ease(this.smoothAsleep, settled ? 1 : 0, 3)
    this.smoothSick = ease(this.smoothSick, state.sick ? 1 : 0, 2)
    this.pulse = Math.max(0, this.pulse - dt * 2.6)
    this.hatch = Math.min(1, this.hatch + dt * 0.9)
    this.expression(dt)

    // A pet loaded from a save while asleep is already indoors.
    if (!this.started) {
      this.started = true
      if (state.asleep && state.mobile && this.shelter) {
        this.walk.x = this.shelter.inside.x
        this.walk.z = this.shelter.inside.z
        this.walk.where = 'in'
      }
    }
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
