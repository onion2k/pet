import { Mesh, Program, Quat, Transform, Vec3 } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { LAMP_COUNT, VERGE_SLOTS, VERGE_Z } from '../data/biome'
import { VISITORS, type Visitor, type VisitorId } from '../data/visitors'
import { plantById, type PlantId } from '../data/plants'
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
  x: number
  z: number
}

interface Entry {
  visitor: Visitor
  mesh: Mesh
  /**
   * What actually gets moved. The mesh hangs off it, offset so that the node
   * sits at the point the visitor turns about -- for the ball, its centre,
   * which is what lets it roll rather than pivot on the grass.
   */
  node: Transform
  /** Where it settled, before any motion is applied. */
  home: { x: number; z: number }
  /** Motion state, meaning whatever its motion kind needs. */
  phase: number
  timer: number
  hop: { fromX: number; fromZ: number; toX: number; toZ: number; t: number; resting: number }
  /** Rolling state: where the ball is and how fast it is going. */
  ball: { x: number; z: number; vx: number; vz: number }
  radius: number
  fade: number
  /** Rolled for today. A visitor with a window is chosen but not yet due. */
  chosen: boolean
  present: boolean
  /** Whether its arrival has already been foretold today. */
  foretold: boolean
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
  /** The hour in the pet's world, for anything that keeps to a time. */
  hour: number
  groundY: number
  /** Where the pet is, so a ball knows to bounce and a rabbit knows to bolt. */
  pet: { x: number; z: number }
  /** Bounds of the band the pet roams. */
  roam: { x: number; z: number }
  /** Beside the shelter door. */
  door: { x: number; z: number }
  /** Called when something new turns up, so it can be put on the ticker. */
  announce(name: string): void
  /**
   * What has been planted, and how grown each one is. Plantings are not rolled
   * for and never leave, so they take the same meshes and lighting as the
   * visitors but none of the dice.
   */
  planted: PlantedThing[]
  /** Visitors the pet befriended: they turn up whenever their season comes round. */
  regulars: VisitorId[]
}

/** One planting, as the renderer needs it: what, where, and how far along. */
export interface PlantedThing {
  kind: PlantId
  x: number
  z: number
  /** Which growth stage's model to draw. */
  growth: number
}

/** How close the pet has to get to send the ball on its way. */
const KICK_REACH = 0.72
/** Speed of that shove, in world units a second. */
const KICK_SPEED = 2.1
/** Rolling friction: how quickly a loose ball gives up. */
const ROLL_DRAG = 1.35
/** How much speed survives a bounce off the edge of the roaming band. */
const BOUNCE = 0.55

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
  // Scratch, so rolling does not allocate every frame.
  const spinAxis = new Vec3()
  const spinStep = new Quat()
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
    const node = new Transform()
    node.position.y = groundY
    node.visible = false
    node.setParent(root)
    mesh.setParent(node)
    // A rolling thing turns about its middle, so its node sits at the centre
    // and the mesh hangs half a diameter below it.
    const radius = visitor.height / 2
    if (visitor.motion === 'roll') mesh.position.y = -radius
    // They share one program, so each hands it its own fade on the way past.
    mesh.onBeforeRender(() => {
      program.uniforms.uFade.value = entry.fade
    })
    const entry: Entry = {
      visitor,
      mesh,
      node,
      ball: { x: 0, z: 0, vx: 0, vz: 0 },
      radius,
      home: { x: 0, z: 0 },
      phase: 0,
      timer: 0,
      hop: { fromX: 0, fromZ: 0, toX: 0, toZ: 0, t: 1, resting: 0 },
      fade: 0,
      chosen: false,
      present: false,
      foretold: false,
    }
    return entry
  })

  /**
   * Plantings, which take the visitors' meshes and lighting but none of their
   * dice: they are where they were put, they never leave, and they only change
   * when something is planted or grows a stage. Rebuilt on that change rather
   * than per frame, so a yard full of trees costs nothing to keep standing.
   */
  interface PlantEntry {
    mesh: Mesh
    node: Transform
  }
  let plants: PlantEntry[] = []
  let plantedKey = ''

  const buildPlants = (things: PlantedThing[], groundY: number): void => {
    for (const entry of plants) {
      entry.node.setParent(null)
      entry.mesh.geometry.remove()
    }
    plants = []
    for (const thing of things) {
      const stage = plantById(thing.kind)?.stages[thing.growth]
      if (!stage) continue
      const built = buildVoxelGeometry(gl, stage.model, stage.height)
      const mesh = new Mesh(gl, { geometry: built.geometry, program })
      const node = new Transform()
      node.position.set(thing.x, groundY, thing.z)
      node.setParent(root)
      mesh.setParent(node)
      // Sharing the visitors' program means sharing its fade uniform, and a
      // planting is always fully there.
      mesh.onBeforeRender(() => {
        program.uniforms.uFade.value = 1
      })
      plants.push({ mesh, node })
    }
  }

  /** What the yard is planted with, as one string, to spot a change cheaply. */
  const keyOf = (things: PlantedThing[]): string =>
    things.map((t) => `${t.kind}:${t.growth}:${t.x.toFixed(2)}:${t.z.toFixed(2)}`).join('|')

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
      // A befriended stray is no longer a matter of luck: it comes whenever its
      // season does. That is what befriending it bought.
      const chance = context.regulars.includes(visitor.id) ? 1 : visitor.chance
      const here = visitor.seasons.includes(context.season) && hash2(context.day, seed) < chance
      entry.chosen = here
      entry.foretold = false
      // Anything without a window is simply here for the day.
      entry.present = here && !visitor.hours
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
      entry.ball.x = entry.home.x
      entry.ball.z = entry.home.z
      entry.ball.vx = 0
      entry.ball.vz = 0
      entry.node.quaternion.identity()
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
      return { x: entry.node.position.x, y: 0.34, z: entry.node.position.z }
    },
    playthingAt() {
      const entry = entries.find((e) => e.visitor.id === 'ball')
      if (!entry || !entry.present || entry.fade < 0.5) return null
      return { x: entry.node.position.x, z: entry.node.position.z }
    },
    active() {
      return entries
        .filter((e) => e.present)
        .map((e) => ({
          id: e.visitor.id,
          x: e.node.position.x,
          z: e.node.position.z,
        }))
    },
    update(dt, context) {
      const key = keyOf(context.planted)
      if (key !== plantedKey) {
        plantedKey = key
        buildPlants(context.planted, context.groundY)
      }

      if (context.day !== lastDay || context.season !== lastSeason) {
        const first = Number.isNaN(lastDay)
        lastDay = context.day
        lastSeason = context.season
        roll(context)
        const here = new Set(entries.filter((e) => e.present).map((e) => e.visitor.id))
        // Only genuine arrivals are worth a line, and not the ones that were
        // already standing there when the app opened.
        if (!first) {
          // One a day at most. A season turning brings several at once, and
          // announcing each of them buried everything else the ticker had to
          // say under a run of arrivals.
          const arrived = entries.find(
            (e) => !e.visitor.hours && e.present && !announced.has(e.visitor.id),
          )
          if (arrived) context.announce(arrived.visitor.arrival)
        }
        announced = here
      }

      for (const entry of entries) {
        const window = entry.visitor.hours
        if (window) {
          // A window may run through midnight, so the test wraps with it.
          const [from, to] = window
          const open =
            from <= to
              ? context.hour >= from && context.hour < to
              : context.hour >= from || context.hour < to
          const was = entry.present
          entry.present = entry.chosen && open
          // Foretold once, while it is still expected rather than here. That
          // gap is the whole point: it gives a reason to come back at a time.
          if (entry.chosen && !open && !entry.foretold && entry.visitor.expected) {
            entry.foretold = true
            context.announce(entry.visitor.expected)
          }
          // And said again when the window actually opens, so the forecast pays
          // off rather than being the only word about it.
          if (entry.present && !was && entry.foretold) {
            context.announce(entry.visitor.arrival)
          }
        }

        // Everything fades rather than popping, including a visitor whose day
        // has ended while the player is watching.
        const wanted = entry.present ? 1 : 0
        entry.fade += (wanted - entry.fade) * Math.min(1, dt * 2.2)
        if (entry.fade < 0.004 && wanted === 0) {
          entry.fade = 0
          entry.node.visible = false
          continue
        }
        entry.node.visible = true
        entry.phase += dt

        const p = entry.node.position
        if (entry.visitor.motion !== 'roll') {
          // A roller owns its own position and orientation: writing to
          // rotation here would sync Euler back into the quaternion and undo
          // the roll accumulated so far.
          p.x = entry.home.x
          p.z = entry.home.z
          p.y = context.groundY
          entry.node.rotation.y = 0
        }

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
            entry.node.rotation.y = Math.atan2(hop.toX - hop.fromX, hop.toZ - hop.fromZ)
            if (t >= 1) entry.node.rotation.x = Math.sin(entry.phase * 2.2) * 0.12 - 0.1
            else entry.node.rotation.x = 0
            break
          }
          case 'flutter': {
            // Wanders a slow loop, bobbing, never settling.
            p.x = entry.home.x + Math.sin(entry.phase * 0.7) * 1.5
            p.z = entry.home.z + Math.cos(entry.phase * 0.53) * 0.5
            p.y = context.groundY + 0.85 + Math.sin(entry.phase * 3.1) * 0.22
            entry.node.rotation.y = Math.sin(entry.phase * 0.7 + Math.PI / 2)
            entry.node.rotation.z = Math.sin(entry.phase * 9.0) * 0.5
            break
          }
          case 'roll': {
            const ball = entry.ball
            const radius = entry.radius

            // The pet shoves it along when it catches up with it. The ball is
            // put just clear of the pet first, so a pet standing over it pushes
            // once rather than shuddering against it every frame.
            const dx = ball.x - context.pet.x
            const dz = ball.z - context.pet.z
            const gap = Math.hypot(dx, dz)
            if (gap < KICK_REACH && gap > 1e-4) {
              const nx = dx / gap
              const nz = dz / gap
              ball.x = context.pet.x + nx * KICK_REACH
              ball.z = context.pet.z + nz * KICK_REACH
              // Never slows a ball that is already going faster than the kick.
              const speed = Math.max(KICK_SPEED, Math.hypot(ball.vx, ball.vz))
              ball.vx = nx * speed
              ball.vz = nz * speed
            }

            // Rolling friction, and a floor below which it is simply at rest.
            const damping = Math.exp(-ROLL_DRAG * dt)
            ball.vx *= damping
            ball.vz *= damping
            if (Math.hypot(ball.vx, ball.vz) < 0.03) {
              ball.vx = 0
              ball.vz = 0
            }

            const moveX = ball.vx * dt
            const moveZ = ball.vz * dt
            ball.x += moveX
            ball.z += moveZ

            // Kept inside the band the pet roams, so it can always be fetched.
            const boundX = context.roam.x * 0.92
            const boundZ = context.roam.z * 0.92
            const reach = Math.hypot(ball.x / boundX, ball.z / boundZ)
            if (reach > 1) {
              let nx = ball.x / (boundX * boundX)
              let nz = ball.z / (boundZ * boundZ)
              const length = Math.hypot(nx, nz) || 1
              nx /= length
              nz /= length
              const into = ball.vx * nx + ball.vz * nz
              if (into > 0) {
                ball.vx -= (1 + BOUNCE) * into * nx
                ball.vz -= (1 + BOUNCE) * into * nz
              }
              ball.x /= reach
              ball.z /= reach
            }

            p.x = ball.x
            p.z = ball.z
            p.y = context.groundY + radius

            // Rolling without slipping: the axis is horizontal and across the
            // direction of travel, and one radius of travel is one radian.
            const travelled = Math.hypot(moveX, moveZ)
            if (travelled > 1e-6) {
              spinAxis.set(ball.vz, 0, -ball.vx)
              spinAxis.normalize()
              spinStep.fromAxisAngle(spinAxis, travelled / radius)
              entry.node.quaternion.multiply(spinStep, entry.node.quaternion)
              entry.node.quaternion.normalize()
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
