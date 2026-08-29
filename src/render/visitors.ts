import { Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { LAMP_COUNT, VERGE_SLOTS, VERGE_Z } from '../data/biome'
import { VISITORS, type Visitor, type VisitorId } from '../data/visitors'
import type { SeasonId } from '../data/seasons'
import { buildVoxelGeometry } from './voxel-mesh'

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 color;
  attribute float ao;
  attribute float emissive;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vEmissive;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalMatrix * normal;
    vColor = color;
    vAo = ao;
    vEmissive = emissive;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  #define LAMP_COUNT ${LAMP_COUNT}

  uniform vec3 uLightDir;
  uniform vec3 uLightColour;
  uniform float uLightIntensity;
  uniform vec3 uAmbientColour;
  uniform float uAmbientIntensity;
  uniform vec3 uLampPos[LAMP_COUNT];
  uniform vec3 uLampColour;
  uniform float uLampIntensity;
  uniform float uLampRadius;
  uniform float uFade;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vEmissive;
  varying vec3 vViewPos;

  void main() {
    vec3 N = normalize(vNormal);
    float key = max(dot(N, uLightDir), 0.0);
    float fill = max(dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5, 0.0);

    vec3 lit = vColor * uLightColour * (key * uLightIntensity);
    lit += vColor * uAmbientColour * (fill * uAmbientIntensity);
    lit *= vAo;

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

    // A carved lantern lights up with everything else, and goes out with it.
    lit = mix(lit, vColor * 1.35, vEmissive * uLampIntensity);

    float luma = dot(lit, vec3(0.2126, 0.7152, 0.0722));
    float glow = clamp(vEmissive * uLampIntensity + max(luma - 0.8, 0.0) * 2.0, 0.0, 1.0);
    gl_FragColor = vec4(lit * uFade, glow * uFade);
  }
`

export interface VisitorLighting {
  direction: [number, number, number]
  colour: [number, number, number]
  intensity: number
  ambientColour: [number, number, number]
  ambientIntensity: number
}

/** A visitor that is currently in the yard. */
export interface ActiveVisitor {
  id: VisitorId
  name: string
  x: number
  z: number
}

interface Entry {
  visitor: Visitor
  mesh: Mesh
  /** Where it settled, before any motion is applied. */
  home: { x: number; z: number }
  /** Motion state, meaning whatever its motion kind needs. */
  phase: number
  timer: number
  hop: { fromX: number; fromZ: number; toX: number; toZ: number; t: number; resting: number }
  fade: number
  present: boolean
}

export interface Visitors {
  root: Transform
  update(dt: number, context: VisitorContext): void
  setLighting(lighting: VisitorLighting): void
  setLamps(positions: Float32Array, intensity: number): void
  /** Where the pumpkin is, so it can be given a lamp of its own. Null when away. */
  pumpkinAt(): { x: number; y: number; z: number } | null
  /** The ball, if there is one out, for the pet to go and play with. */
  playthingAt(): { x: number; z: number } | null
  /** Everything currently in the yard. */
  active(): ActiveVisitor[]
}

export interface VisitorContext {
  season: SeasonId
  /** Which world day it is, so a visitor stays put for the day. */
  day: number
  groundY: number
  /** Where the pet is, so a ball knows to bounce and a rabbit knows to bolt. */
  pet: { x: number; z: number }
  /** Bounds of the band the pet roams. */
  roam: { x: number; z: number }
  /** Beside the shelter door. */
  door: { x: number; z: number }
  /** Called when something new turns up, so it can be put on the ticker. */
  announce(name: string): void
}

/** Deterministic 0..1 from a pair of integers. Same shape as the terrain's. */
function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

const idSeed = (id: VisitorId): number => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return h >>> 0
}

export function createVisitors(gl: OGLRenderingContext, groundY: number): Visitors {
  const root = new Transform()
  const program = new Program(gl, {
    vertex,
    fragment,
    transparent: false,
    cullFace: gl.BACK,
    uniforms: {
      uLightDir: { value: [0.4, 0.8, 0.45] },
      uLightColour: { value: [1, 1, 1] },
      uLightIntensity: { value: 1 },
      uAmbientColour: { value: [0.5, 0.6, 0.8] },
      uAmbientIntensity: { value: 0.3 },
      uLampPos: { value: new Float32Array(LAMP_COUNT * 3) },
      uLampColour: { value: [1, 0.82, 0.5] },
      uLampIntensity: { value: 0 },
      uLampRadius: { value: 4.5 },
      uFade: { value: 1 },
    },
  })

  const entries: Entry[] = VISITORS.map((visitor) => {
    const built = buildVoxelGeometry(gl, visitor.model, visitor.height)
    const mesh = new Mesh(gl, { geometry: built.geometry, program })
    mesh.position.y = groundY
    mesh.visible = false
    mesh.setParent(root)
    // They share one program, so each hands it its own fade on the way past.
    mesh.onBeforeRender(() => {
      program.uniforms.uFade.value = entry.fade
    })
    const entry: Entry = {
      visitor,
      mesh,
      home: { x: 0, z: 0 },
      phase: 0,
      timer: 0,
      hop: { fromX: 0, fromZ: 0, toX: 0, toZ: 0, t: 1, resting: 0 },
      fade: 0,
      present: false,
    }
    return entry
  })

  let lastDay = Number.NaN
  let lastSeason: SeasonId | null = null
  /** Who was here last time round, so arrivals can be announced once each. */
  let announced = new Set<VisitorId>()

  /** Settles which visitors are in the yard today, and where they stand. */
  const roll = (context: VisitorContext): void => {
    const takenSlots = new Set<number>()
    for (const entry of entries) {
      const { visitor } = entry
      const seed = idSeed(visitor.id)
      const here =
        visitor.seasons.includes(context.season) && hash2(context.day, seed) < visitor.chance
      entry.present = here
      if (!here) continue

      const a = hash2(context.day, seed ^ 0x1111)
      const b = hash2(context.day, seed ^ 0x2222)
      if (visitor.spot === 'door') {
        // Just to the side of the doorway, clear of the lantern already there.
        entry.home.x = context.door.x + (a < 0.5 ? -0.66 : 0.66)
        entry.home.z = context.door.z + 0.36
      } else if (visitor.spot === 'roam') {
        // Inside the roaming ellipse, so the pet can actually get to it.
        const angle = a * Math.PI * 2
        const reach = 0.3 + b * 0.5
        entry.home.x = Math.cos(angle) * reach * context.roam.x
        entry.home.z = Math.sin(angle) * reach * context.roam.z
      } else {
        // The verge: one of a set of pitches that are known to be level, clear
        // of the lantern row and clear of the shelter.
        let slot = Math.floor(a * VERGE_SLOTS.length) % VERGE_SLOTS.length
        for (let i = 0; i < VERGE_SLOTS.length && takenSlots.has(slot); i++) {
          slot = (slot + 1) % VERGE_SLOTS.length
        }
        takenSlots.add(slot)
        entry.home.x = VERGE_SLOTS[slot]!
        entry.home.z = VERGE_Z
      }
      entry.hop.fromX = entry.home.x
      entry.hop.fromZ = entry.home.z
      entry.hop.toX = entry.home.x
      entry.hop.toZ = entry.home.z
      entry.hop.t = 1
      entry.hop.resting = 0.6 + a * 1.4
      entry.phase = a * Math.PI * 2
    }
  }

  return {
    root,
    setLighting(lighting) {
      const u = program.uniforms
      u.uLightDir.value = lighting.direction
      u.uLightColour.value = lighting.colour
      u.uLightIntensity.value = lighting.intensity
      u.uAmbientColour.value = lighting.ambientColour
      u.uAmbientIntensity.value = lighting.ambientIntensity
    },
    setLamps(positions, intensity) {
      const u = program.uniforms
      u.uLampPos.value = positions
      u.uLampIntensity.value = intensity
    },
    pumpkinAt() {
      const entry = entries.find((e) => e.visitor.id === 'pumpkin')
      if (!entry || !entry.present || entry.fade < 0.2) return null
      return { x: entry.mesh.position.x, y: 0.34, z: entry.mesh.position.z }
    },
    playthingAt() {
      const entry = entries.find((e) => e.visitor.id === 'ball')
      if (!entry || !entry.present || entry.fade < 0.5) return null
      return { x: entry.mesh.position.x, z: entry.mesh.position.z }
    },
    active() {
      return entries
        .filter((e) => e.present)
        .map((e) => ({
          id: e.visitor.id,
          name: e.visitor.name,
          x: e.mesh.position.x,
          z: e.mesh.position.z,
        }))
    },
    update(dt, context) {
      if (context.day !== lastDay || context.season !== lastSeason) {
        const first = Number.isNaN(lastDay)
        lastDay = context.day
        lastSeason = context.season
        roll(context)
        const here = new Set(entries.filter((e) => e.present).map((e) => e.visitor.id))
        // Only genuine arrivals are worth a line, and not the ones that were
        // already standing there when the app opened.
        if (!first) {
          for (const entry of entries) {
            if (entry.present && !announced.has(entry.visitor.id)) {
              context.announce(entry.visitor.name)
            }
          }
        }
        announced = here
      }

      for (const entry of entries) {
        // Everything fades rather than popping, including a visitor whose day
        // has ended while the player is watching.
        const wanted = entry.present ? 1 : 0
        entry.fade += (wanted - entry.fade) * Math.min(1, dt * 2.2)
        if (entry.fade < 0.004 && wanted === 0) {
          entry.fade = 0
          entry.mesh.visible = false
          continue
        }
        entry.mesh.visible = true
        entry.phase += dt

        const p = entry.mesh.position
        p.x = entry.home.x
        p.z = entry.home.z
        p.y = context.groundY
        entry.mesh.rotation.y = 0

        switch (entry.visitor.motion) {
          case 'hop': {
            // Grazes for a while, then hops somewhere else nearby.
            const hop = entry.hop
            if (hop.t >= 1) {
              hop.resting -= dt
              if (hop.resting <= 0) {
                hop.fromX = hop.toX
                hop.fromZ = hop.toZ
                const angle = Math.random() * Math.PI * 2
                const reach = 0.3 + Math.random() * 0.9
                // Kept within a pace of its pitch, which keeps it on the level.
                hop.toX = Math.max(
                  entry.home.x - 1.1,
                  Math.min(entry.home.x + 1.1, entry.home.x + Math.cos(angle) * reach),
                )
                hop.toZ = Math.max(-1.62, Math.min(-1.22, entry.home.z + Math.sin(angle) * reach * 0.4))
                hop.t = 0
                hop.resting = 0.7 + Math.random() * 2.2
              }
            } else {
              hop.t = Math.min(1, hop.t + dt * 1.9)
            }
            const t = hop.t
            p.x = hop.fromX + (hop.toX - hop.fromX) * t
            p.z = hop.fromZ + (hop.toZ - hop.fromZ) * t
            // A hop arc, and a nose-down graze between hops.
            p.y = context.groundY + (t < 1 ? Math.sin(t * Math.PI) * 0.22 : 0)
            entry.mesh.rotation.y = Math.atan2(hop.toX - hop.fromX, hop.toZ - hop.fromZ)
            if (t >= 1) entry.mesh.rotation.x = Math.sin(entry.phase * 2.2) * 0.12 - 0.1
            else entry.mesh.rotation.x = 0
            break
          }
          case 'flutter': {
            // Wanders a slow loop, bobbing, never settling.
            p.x = entry.home.x + Math.sin(entry.phase * 0.7) * 1.5
            p.z = entry.home.z + Math.cos(entry.phase * 0.53) * 0.5
            p.y = context.groundY + 0.85 + Math.sin(entry.phase * 3.1) * 0.22
            entry.mesh.rotation.y = Math.sin(entry.phase * 0.7 + Math.PI / 2)
            entry.mesh.rotation.z = Math.sin(entry.phase * 9.0) * 0.5
            break
          }
          case 'roll': {
            // Sits still until the pet comes near, then bounces about.
            const near = Math.hypot(context.pet.x - entry.home.x, context.pet.z - entry.home.z)
            const excited = Math.max(0, 1 - near / 2.2)
            entry.timer += dt * (1.5 + excited * 7)
            p.y = context.groundY + Math.abs(Math.sin(entry.timer)) * 0.45 * excited
            entry.mesh.rotation.x = entry.timer * excited * 1.4
            // Nudged away from the pet, as though it had just been shoved.
            if (near < 1.2 && near > 0.001) {
              const away = (1.2 - near) * 0.35
              p.x += ((entry.home.x - context.pet.x) / near) * away
              p.z += ((entry.home.z - context.pet.z) / near) * away
            }
            break
          }
          default:
            break
        }
      }
    },
  }
}
