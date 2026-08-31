import { Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import {
  PROP_CLEARING_MARGIN,
  PROP_SPACING,
  LAMP_COUNT,
  LAMP_ROW_X,
  LAMP_ROW_Z,
  SHELTER_CENTRE,
  SHELTER_COLUMNS,
  TERRAIN_BASE,
  LANE_HALF_X,
  LANE_HALF_Z,
  TERRAIN_RELIEF,
  TERRAIN_COLS,
  TERRAIN_ROWS,
  TERRAIN_VOXEL,
  type Biome,
} from '../data/biome'
import { LANTERN, SHELTER, type Prop, type PropKey } from '../data/props'
import type { Relief } from '../data/biome'
import { MATERIAL_INDEX, PROP_MATERIAL } from '../data/seasons'
import { expandLayers } from '../data/voxel-format'
import type { PaletteTexture } from './palette'
import { buildVoxels, PART_BODY, type Voxel, type VoxelSource } from './voxel-mesh'

/** Deterministic hash in 0..1. The terrain must rebuild identically every load. */
function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Value noise over the column grid. */
function noise(x: number, y: number, frequency: number, seed: number): number {
  const fx = x * frequency
  const fy = y * frequency
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = smooth(fx - ix)
  const ty = smooth(fy - iy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
}

function seedFrom(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Where the shelter sits, in both columns and world units. */
export interface ShelterPlacement {
  ox: number
  oz: number
  w: number
  d: number
  centre: { x: number; z: number }
  half: { x: number; z: number }
  /** Where the pet stands when it has gone inside. */
  inside: { x: number; z: number }
  /** The lantern outside the front, in columns and in world units. */
  lamp: LampPlacement
}

export interface TerrainShape {
  size: number
  /** Column height in voxels. */
  heightAt(x: number, z: number): number
  /**
   * Digs a column to a given height. Only the scatter uses this, and only for
   * the footing under something built: everything else reads the ground.
   */
  levelAt(x: number, z: number, height: number): void
  /** World Y the pet stands on. */
  groundY: number
  /** World Y the water sits at, or null where there is none. */
  seaY: number | null
  shelter: ShelterPlacement
  /** Every lantern in the yard, the shelter's own first. */
  lamps: LampPlacement[]
}

export interface LampPlacement {
  ox: number
  oz: number
  x: number
  /** Height of the glass above the ground. */
  y: number
  z: number
}

function placeShelter(seed: number): ShelterPlacement {
  // Mirrored either side of the clearing depending on the seed, so the yard is
  // laid out differently from one pet to the next.
  const flip = hash2(7, 13, seed) > 0.5 ? 1 : -1
  const centre = { x: SHELTER_CENTRE.x * flip, z: SHELTER_CENTRE.z }
  const half = {
    x: (SHELTER_COLUMNS.w / 2) * TERRAIN_VOXEL,
    z: (SHELTER_COLUMNS.d / 2) * TERRAIN_VOXEL,
  }
  const middleX = TERRAIN_COLS / 2
  const middleZ = TERRAIN_ROWS / 2
  return {
    ox: Math.round(middleX + centre.x / TERRAIN_VOXEL - SHELTER_COLUMNS.w / 2),
    oz: Math.round(middleZ + centre.z / TERRAIN_VOXEL - SHELTER_COLUMNS.d / 2),
    w: SHELTER_COLUMNS.w,
    d: SHELTER_COLUMNS.d,
    centre,
    half,
    // Standing just inside the open front, where it stays visible.
    inside: { x: centre.x, z: centre.z + half.z * 0.35 },
    // Beside the doorway, on the side facing the middle of the yard, so it
    // lights the way in without standing in it.
    lamp: lampAt(centre, half, flip),
  }
}

/** The lantern's spot: clear of the doorway, a little in front of the wall. */
function lampAt(
  centre: { x: number; z: number },
  half: { x: number; z: number },
  flip: number,
): LampPlacement {
  const x = centre.x - (half.x + 0.34) * flip
  const z = centre.z + half.z + 0.16
  return {
    ox: Math.round(TERRAIN_COLS / 2 + x / TERRAIN_VOXEL) - 1,
    oz: Math.round(TERRAIN_ROWS / 2 + z / TERRAIN_VOXEL) - 1,
    x,
    // The glass sits six voxels up the post.
    y: 6.5 * TERRAIN_VOXEL,
    z,
  }
}

/**
 * How much of the depth in front of the fall line the ground takes to get all
 * the way down. The rest is flat: seabed under a shore, low ground under a
 * hill.
 *
 * Short, because the frame is what it is: the camera sits low and looks
 * slightly down, so the near edge of the picture is only a length and a half
 * of ground beyond the fall line. Every unit the slope spends falling is a
 * unit of whatever lies below it that never gets on screen.
 */
const FALL_RUN = 0.2

/** Layers above which a prop counts as tall, and is kept out of the foreground. */
const TALL_PROP = 6

/**
 * The most a built thing will dig through. Past this it is not a slope with a
 * house on it, it is a house halfway up a cliff.
 */
const FOUNDATION_STEP = 3

/** A voxel height as the 0..1 value the noise field is written in. */
const heightValue = (height: number): number => (height - TERRAIN_BASE) / (2 * TERRAIN_RELIEF) + 0.5

/** Smoothstep on an already-clamped 0..1. */
const ease = (t: number): number => t * t * (3 - 2 * t)

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * How far down the fall a column is: 0 at the line where the ground breaks and
 * 1 out where it has levelled off again.
 *
 * It grows with z, which is to say the ground falls away *toward the camera*.
 * On a shore that is what the sea is for -- two lengths off, a swell is
 * something you can watch travelling and the surf is a line that runs up the
 * sand and slides back, where twenty lengths off, behind the pet, all of it was
 * four hazed pixels. On a hill it is what tells you that you are on top of one:
 * ground that goes out of sight downward, and ridges beyond it in the sky.
 */
function fallAt(z: number, relief: Relief): number {
  if (!relief.fall) return 0
  const fromCol = TERRAIN_ROWS / 2 + relief.fall.from / TERRAIN_VOXEL
  const run = (TERRAIN_ROWS - fromCol) * FALL_RUN
  if (run <= 0) return 0
  // Straight, rather than eased at both ends.
  //
  // The weight does two jobs at once: it drops the ground and it damps the
  // noise, and this is the near foreground, so both have to be got right in
  // about a length. Eased in, the band standing one voxel proud of a waterline
  // came out half a length deep, which at this angle is a white stripe ruled
  // across the frame rather than a line of foam. Eased out, the noise is gone
  // by the first column and the waterline is a ruler.
  //
  // Straight, the mean is already under the water a fifth of the way in while
  // four fifths of the relief is still there to wander it. What is left is a
  // beach with a berm at the top and an edge that wanders -- and, on dry
  // ground, a brow that breaks rather than rolling gently over.
  return clamp01((z - fromCol) / run)
}

/**
 * How far up the rise a column is, 0 on the flat and 1 at the back edge.
 *
 * Dunes behind a beach, and the shoulder of the hill behind a hilltop. Without
 * it a place that falls away in front is a strip of ground with sky behind it;
 * with it the patch reads bottom to top -- what is below, the flat the pet
 * walks, and the ground going on up out of the frame.
 *
 * Eased, unlike the fall: this is the far distance, where a break in the slope
 * would read as a fault rather than as a brow. It starts behind the shelter,
 * which stands on its own level pad and would be tilted by ground that climbed
 * out from under it.
 */
function riseAt(z: number, relief: Relief): number {
  if (!relief.rise) return 0
  const fromCol = TERRAIN_ROWS / 2 + relief.rise.from / TERRAIN_VOXEL
  if (fromCol <= 0) return 0
  return ease(clamp01((fromCol - z) / fromCol))
}

export function terrainShape(seed: string, biome: Biome): TerrainShape {
  const s = seedFrom(seed)
  const shore = biome.shore
  const relief = biome.relief
  const halfX = TERRAIN_COLS / 2
  const halfZ = TERRAIN_ROWS / 2
  const laneX = LANE_HALF_X / TERRAIN_VOXEL
  const laneZ = LANE_HALF_Z / TERRAIN_VOXEL
  const shelter = placeShelter(s)

  const cache = new Int8Array(TERRAIN_COLS * TERRAIN_ROWS)
  for (let z = 0; z < TERRAIN_ROWS; z++) {
    for (let x = 0; x < TERRAIN_COLS; x++) {
      // Two octaves: broad swells with a little local roughness.
      const broad = noise(x, z, 0.055, s)
      const fine = noise(x, z, 0.17, s ^ 0x9e37)
      let value = broad * 0.75 + fine * 0.25

      // Level the lane the pet walks in. An ellipse, not a disc: the pet
      // ranges right across the meadow but only a little in depth, so the
      // relief survives in front of the lane and behind it.
      const ex = (x - halfX) / laneX
      const ez = (z - halfZ) / laneZ
      const reach = Math.hypot(ex, ez)
      let flatten = 1 - Math.min(1, Math.max(0, (reach - 1) / 0.5))
      // The lane's skirt reaches a good way in front of the lane itself, which
      // on a shore is the whole of the beach. Left alone it levelled the sand
      // the water breaks on, and the waterline came out ruled straight across
      // the frame rather than wandering. So the falling ground takes the skirt
      // away with it: past the top of the beach the relief is the beach's own.
      const fall = relief ? fallAt(z, relief) : 0
      if (fall > 0) flatten *= Math.max(0, 1 - fall * 3)
      value = value * (1 - flatten) + 0.5 * flatten

      // Behind, the ground climbs. Pulled toward the height rather than added
      // to, for the same reason the ground ahead is pulled down: the noise
      // thins as it goes, so the ridge reads as one bank of sand or one
      // shoulder of hill with a wandering top, and not as the ordinary relief
      // shifted upward. Before the shelter's pad, which is levelled afterwards
      // and has to stay level.
      if (relief?.rise) {
        const rise = riseAt(z, relief)
        value = value * (1 - rise) + heightValue(relief.rise.to) * rise
      }

      // The shelter gets its own level pad rather than a wider clearing, which
      // would push all the scenery out of the foreground. The pad runs forward
      // to meet the clearing, so the walk to bed is over flat ground the whole
      // way — the pet does not sample terrain height as it moves.
      // Wide enough to take in the lantern standing beside the doorway, which
      // sits a little outside the wall and needs the same level footing.
      const padMinX = Math.min(shelter.ox - 1, shelter.lamp.ox - 1)
      const padMaxX = Math.max(shelter.ox + shelter.w + 1, shelter.lamp.ox + 4)
      const onPad = x >= padMinX && x < padMaxX && z >= shelter.oz - 1 && z < halfZ + 2
      if (onPad) value = 0.5

      // Out past the lane the ground falls away -- under water on a shore, into
      // the low country under a hill. Pulling the height toward a single value
      // rather than subtracting from it damps the noise as it goes, which is
      // what keeps a waterline one line rather than a scatter of islands --
      // while leaving enough of it near the brow for the edge to wander the way
      // an edge should.
      if (relief?.fall) {
        value = value * (1 - fall) + heightValue(relief.fall.to) * fall
      }

      const height = Math.round(TERRAIN_BASE + (value - 0.5) * 2 * TERRAIN_RELIEF)
      cache[z * TERRAIN_COLS + x] = Math.max(1, height)
    }
  }

  return {
    size: TERRAIN_COLS,
    shelter,
    // The shelter's lantern leads, then the row standing behind the pet's
    // roaming band, where the ground is level and nothing walks into them.
    lamps: [
      shelter.lamp,
      ...LAMP_ROW_X.map((x) => ({
        ox: Math.round(TERRAIN_COLS / 2 + x / TERRAIN_VOXEL) - 1,
        oz: Math.round(TERRAIN_ROWS / 2 + LAMP_ROW_Z / TERRAIN_VOXEL) - 1,
        x,
        y: 6.5 * TERRAIN_VOXEL,
        z: LAMP_ROW_Z,
      })),
    ],
    heightAt: (x, z) =>
      x < 0 || z < 0 || x >= TERRAIN_COLS || z >= TERRAIN_ROWS ? 0 : cache[z * TERRAIN_COLS + x]!,
    levelAt: (x, z, height) => {
      if (x < 0 || z < 0 || x >= TERRAIN_COLS || z >= TERRAIN_ROWS) return
      cache[z * TERRAIN_COLS + x] = Math.max(1, height)
    },
    groundY: TERRAIN_BASE * TERRAIN_VOXEL,
    seaY: shore ? shore.level * TERRAIN_VOXEL : null,
  }
}

export interface Scenery {
  voxels: Map<number, Voxel>
  /** Highest voxel any prop reaches, so the field can be sized to fit. */
  top: number
  count: number
}

/**
 * Deterministic scatter over a coarse grid of candidate slots, jittered within
 * each slot. Props keep clear of the pet's clearing and of each other, and only
 * sit on ground level enough to stand on.
 */
/**
 * Exported for the tests, which have no GL context and so cannot build the
 * mesh, but do need to know that a place is not coming out bare -- a prop rule
 * that rejects everything looks exactly like a prop rule that works.
 */
export function scatterProps(
  shape: TerrainShape,
  biome: Biome,
  seed: number,
  cache: Map<string, Voxel>,
): Scenery {
  const voxels = new Map<number, Voxel>()
  const taken = new Set<number>()
  const halfX = TERRAIN_COLS / 2
  const halfZ = TERRAIN_ROWS / 2
  const laneX = LANE_HALF_X / TERRAIN_VOXEL
  const laneZ = LANE_HALF_Z / TERRAIN_VOXEL + PROP_CLEARING_MARGIN
  const pool = biome.props
  const totalWeight = pool.reduce((sum, prop) => sum + prop.weight, 0)
  let top = 0
  let count = 0

  const colour = (key: PropKey): Voxel => {
    const cached = cache.get(`prop${key}`)
    if (cached) return cached
    const made: Voxel = {
      color: [1, 0, 1],
      // The lantern's glass is the one piece of scenery that makes its own light.
      emissive: key === 'g' ? 1 : 0,
      part: PART_BODY,
      material: MATERIAL_INDEX[PROP_MATERIAL[key] ?? 'rock'],
    }
    cache.set(`prop${key}`, made)
    return made
  }

  const pick = (roll: number): Prop => {
    let remaining = roll * totalWeight
    for (const prop of pool) {
      remaining -= prop.weight
      if (remaining <= 0) return prop
    }
    return pool[pool.length - 1]!
  }

  /** Writes a prop's voxels into the field with its base at `baseY`. */
  const stamp = (prop: Prop, ox: number, oz: number, baseY: number) => {
    const layers = expandLayers(prop.model)
    for (let y = 0; y < layers.length; y++) {
      const layer = layers[y]!
      for (let z = 0; z < layer.length; z++) {
        const row = layer[z]!
        for (let x = 0; x < row.length; x++) {
          const ch = row[x]
          if (!ch || ch === '.') continue
          const wy = baseY + y
          voxels.set((wy * TERRAIN_ROWS + (oz + z)) * TERRAIN_COLS + (ox + x), colour(ch as PropKey))
          top = Math.max(top, wy)
        }
      }
    }
  }

  // The shelter goes down first, on its own levelled pad, and its surroundings
  // are reserved so nothing is scattered against its walls or in its doorway.
  const sh = shape.shelter
  stamp(SHELTER, sh.ox, sh.oz, TERRAIN_BASE)
  for (const lamp of shape.lamps) {
    stamp(LANTERN, lamp.ox, lamp.oz, TERRAIN_BASE)
    count++
  }
  // Reserve the shelter and the path back to the clearing, so nothing is
  // scattered against its walls or left standing in the pet's way.
  const reserveMinX = Math.min(sh.ox - 2, sh.lamp.ox - 2)
  const reserveMaxX = Math.max(sh.ox + sh.w + 2, sh.lamp.ox + 5)
  for (let z = sh.oz - 2; z < halfZ + 2; z++) {
    for (let x = reserveMinX; x < reserveMaxX; x++) {
      if (x < 0 || z < 0 || x >= TERRAIN_COLS || z >= TERRAIN_ROWS) continue
      taken.add(z * TERRAIN_COLS + x)
    }
  }

  // Each lantern keeps its own patch clear too, or a shrub grows through it.
  for (const lamp of shape.lamps) {
    for (let z = lamp.oz - 1; z < lamp.oz + 4; z++) {
      for (let x = lamp.ox - 1; x < lamp.ox + 4; x++) {
        if (x < 0 || z < 0 || x >= TERRAIN_COLS || z >= TERRAIN_ROWS) continue
        taken.add(z * TERRAIN_COLS + x)
      }
    }
  }

  // How far apart the candidate slots are here. A wood closes the grid up; a
  // hill and a village open it out.
  const spacing = biome.propSpacing ?? PROP_SPACING

  // Two passes over the same slots: what was built goes up first, and
  // everything that grew is scattered around it afterwards.
  //
  // One pass put the buildings last in practice. A cottage needs seven columns
  // clear in both directions, and by the time a hundred and fifty tufts and
  // stones have each reserved their own breathing room the green is a lace of
  // holes too small to take one -- so a village came out with two houses on it
  // and no way to tell why.
  for (const built of [true, false]) {
    for (let cz = 0; cz < TERRAIN_ROWS; cz += spacing) {
      for (let cx = 0; cx < TERRAIN_COLS; cx += spacing) {
        if (hash2(cx, cz, seed ^ 0x1111) > biome.propDensity) continue

        const prop = pick(hash2(cx, cz, seed ^ 0x4444))
        if (!!prop.foundation !== built) continue
        const layers = expandLayers(prop.model)
        const depth = layers[0]!.length
        const width = layers[0]![0]!.length
        const ox = cx + Math.floor(hash2(cx, cz, seed ^ 0x2222) * spacing) - (width >> 1)
        const oz = cz + Math.floor(hash2(cx, cz, seed ^ 0x3333) * spacing) - (depth >> 1)

        // Nothing tall stands between the camera and the pet.
        //
        // The lane is kept clear already, but the ground in front of it is the
        // nearest thing to the lens, and a fourteen-voxel pine two lengths from
        // the camera is a trunk filling a third of the frame with the pet behind
        // it. Low scenery there is what gives the foreground depth; anything
        // with a crown on it belongs behind the pet.
        if (layers.length > TALL_PROP && oz + depth > halfZ + laneZ) continue

        // Must fit on the patch, clear of the pet's ground, on level enough footing.
        if (ox < 1 || oz < 1 || ox + width >= TERRAIN_COLS || oz + depth >= TERRAIN_ROWS) continue
        let lowest = Infinity
        let highest = -Infinity
        let blocked = false
        for (let z = oz; z < oz + depth && !blocked; z++) {
          for (let x = ox; x < ox + width; x++) {
            if (Math.hypot((x - halfX) / laneX, (z - halfZ) / laneZ) < 1) {
              blocked = true
              break
            }
            if (taken.has(z * TERRAIN_COLS + x)) {
              blocked = true
              break
            }
            const h = shape.heightAt(x, z)
            lowest = Math.min(lowest, h)
            highest = Math.max(highest, h)
          }
        }
        if (blocked) continue
        // Grown things take the ground as they find it and are refused a slot
        // that steps; built things dig their footing flat and are only refused a
        // hillside. Without the second rule nothing with a footprint bigger than
        // about five columns could ever be placed in open relief.
        if (prop.foundation) {
          if (highest - lowest > FOUNDATION_STEP) continue
        } else if (highest - lowest > 1) continue
        // Nothing stands in the surf. Read off the falling ground rather than off
        // the height, the same way the wet sand is: a marram tuft pitched at the
        // waterline is worse than a bare beach, and the deepest column of the
        // footprint is the one that decides it.
        if (biome.shore && biome.relief && fallAt(oz + depth, biome.relief) > 0) continue

        // A foundation is dug to the middle of what it found, so a house sits
        // into a slope rather than perching on the high corner of it. The
        // levelling runs a column wider than the walls, which is the doorstep.
        let base = lowest
        if (prop.foundation) {
          base = Math.round((highest + lowest) / 2)
          for (let z = oz - 1; z < oz + depth + 1; z++) {
            for (let x = ox - 1; x < ox + width + 1; x++) shape.levelAt(x, z, base)
          }
        }

        stamp(prop, ox, oz, base)

        // Reserve the footprint plus the prop's own breathing room.
        const pad = prop.spacing
        for (let z = oz - pad; z < oz + depth + pad; z++) {
          for (let x = ox - pad; x < ox + width + pad; x++) {
            if (x < 0 || z < 0 || x >= TERRAIN_COLS || z >= TERRAIN_ROWS) continue
            taken.add(z * TERRAIN_COLS + x)
          }
        }
        count++
      }
    }
  }

  return { voxels, top, count }
}

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 normal;
  attribute float ao;
  attribute float material;
  attribute float emissive;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;

  varying vec3 vNormal;
  varying float vAo;
  varying float vMaterial;
  varying float vDepth;
  varying float vEmissive;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalMatrix * normal;
    vAo = ao;
    vMaterial = material;
    vEmissive = emissive;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    // Distance from the eye. Haze by depth rather than by distance from the
    // centre, so the near ground stays crisp right across the frame and only
    // the far ground melts into the sky.
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  #define LAMP_COUNT ${LAMP_COUNT}

  uniform sampler2D tPalette;
  uniform float uPaletteStep;
  uniform vec3 uHaze;
  uniform vec2 uFog;
  uniform float uSick;
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
  varying float vAo;
  varying float vMaterial;
  varying float vDepth;
  varying float vEmissive;
  varying vec3 vViewPos;

  void main() {
    // Sampled here rather than in the vertex stage: vertex texture units are
    // not guaranteed on every device.
    vec3 encoded = texture2D(tPalette, vec2((vMaterial + 0.5) * uPaletteStep, 0.5)).rgb;
    vec3 base = pow(encoded, vec3(2.2));

    vec3 N = normalize(vNormal);
    float key = max(dot(N, uLightDir), 0.0);
    // A soft wrap keeps unlit faces from going flat black at night.
    float fill = max(dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5, 0.0);

    vec3 lit = base * uLightColour * (key * uLightIntensity);
    lit += base * uAmbientColour * (fill * uAmbientIntensity);
    lit *= vAo;

    // The lanterns. Each is a point light with a smooth radius falloff, so the
    // ground around it picks up a pool of warm light after dark.
    vec3 lampSum = vec3(0.0);
    for (int i = 0; i < LAMP_COUNT; i++) {
      vec3 toLamp = uLampPos[i] - vViewPos;
      float lampDist = length(toLamp);
      float falloff = clamp(1.0 - lampDist / uLampRadius, 0.0, 1.0);
      falloff *= falloff;
      float lampKey = max(dot(N, normalize(toLamp)), 0.0) * 0.75 + 0.25;
      lampSum += uLampColour * (lampKey * falloff);
    }
    lit += base * lampSum * uLampIntensity;

    // The glass itself is the source, so while it is lit it ignores all of the
    // above. The lift is gentle on purpose: pushed harder it saturates to white
    // and the lantern stops reading as a warm light and starts reading as a
    // hole. Faded out by the same strength, so an unlit lantern is shaded like
    // any other scenery rather than staying a bright pane all day.
    lit = mix(lit, base * (1.0 + uLampIntensity * 0.35), vEmissive * uLampIntensity);

    // The ground sickens along with its occupant.
    lit = mix(lit, mix(vec3(dot(lit, vec3(0.33))), vec3(0.40, 0.44, 0.30), 0.5) * 0.8, uSick);

    // Fade into the sky so the patch's edge is never a visible boundary.
    float haze = smoothstep(uFog.x, uFog.y, vDepth);
    // Alpha is the bloom mask, so the lit lantern glows rather than just being
    // a bright square. It fades out with the haze along with everything else.
    float glow = vEmissive * clamp(uLampIntensity, 0.0, 1.0) * (1.0 - haze);
    gl_FragColor = vec4(mix(lit, uHaze, haze), glow);
  }
`

export interface Terrain {
  root: Transform
  shape: TerrainShape
  /** Number of scenery pieces on the patch. */
  props: number
  /** Rebuilds the patch for a different seed or biome. */
  rebuild(seed: string, biome: Biome): void
  setSick(amount: number): void
  /** Applies the current sky and sun. */
  setLighting(lighting: TerrainLighting): void
  /** The lantern, as a view-space position and a strength that rises at dusk. */
  /** All the lanterns, as view-space positions packed xyz, and one strength. */
  setLamps(positions: Float32Array, intensity: number): void
  faces: number
}

export interface TerrainLighting {
  direction: [number, number, number]
  colour: [number, number, number]
  intensity: number
  ambientColour: [number, number, number]
  ambientIntensity: number
  haze: [number, number, number]
}

export function createTerrain(
  gl: OGLRenderingContext,
  seed: string,
  biome: Biome,
  palette: PaletteTexture,
): Terrain {
  const root = new Transform()
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      tPalette: { value: palette.texture },
      uPaletteStep: { value: 1 / palette.width },
      uHaze: { value: [0.06, 0.09, 0.16] },
      // In view depth. Pushed out far enough that the shelter and the scenery
      // around it stay crisp, while the patch's far edge is still fully hazed.
      uFog: { value: [11.0, 18.0] },
      uSick: { value: 0 },
      uLightDir: { value: [0.4, 0.8, 0.45] },
      uLightColour: { value: [1, 1, 1] },
      uLightIntensity: { value: 1 },
      uAmbientColour: { value: [0.5, 0.6, 0.8] },
      uAmbientIntensity: { value: 0.3 },
      uLampPos: { value: new Float32Array(LAMP_COUNT * 3) },
      uLampColour: { value: [1, 0.82, 0.5] },
      uLampIntensity: { value: 0 },
      uLampRadius: { value: 4.5 },
    },
    cullFace: gl.BACK,
  })

  let mesh: Mesh | null = null
  let shape = terrainShape(seed, biome)
  let faces = 0
  let props = 0

  const build = (nextSeed: string, nextBiome: Biome) => {
    shape = terrainShape(nextSeed, nextBiome)
    const s = seedFrom(nextSeed)
    const cache = new Map<string, Voxel>()
    // Terrain stores a material index; the colour comes from the season palette
    // at draw time.
    const voxel = (material: number): Voxel => {
      const key = `m${material}`
      let found = cache.get(key)
      if (!found) {
        found = { color: [1, 0, 1], emissive: 0, part: PART_BODY, material }
        cache.set(key, found)
      }
      return found
    }

    let maxHeight = 1
    for (let z = 0; z < TERRAIN_ROWS; z++) {
      for (let x = 0; x < TERRAIN_COLS; x++) maxHeight = Math.max(maxHeight, shape.heightAt(x, z))
    }

    const scenery = scatterProps(shape, nextBiome, s, cache)
    const propKey = (x: number, y: number, z: number) => (y * TERRAIN_ROWS + z) * TERRAIN_COLS + x

    // What is where, answered one cell at a time. Every answer is a height
    // lookup, a hash and a map probe, and the mesher asks about twenty times per
    // solid voxel -- so it is read through once, below, rather than repeatedly.
    const field: VoxelSource = {
      w: TERRAIN_COLS,
      h: Math.max(maxHeight, scenery.top + 1),
      d: TERRAIN_ROWS,
      at(x, y, z) {
        if (x < 0 || z < 0 || x >= TERRAIN_COLS || z >= TERRAIN_ROWS) return null
        // Anything below the patch counts as solid so the underside is culled.
        if (y < 0) return voxel(MATERIAL_INDEX.rock)
        const height = shape.heightAt(x, z)
        if (y < height) {
          if (y === height - 1) {
            // Sand the water reaches is not the sand above it. The band is read
            // off the height rather than off where the water plane happens to
            // be drawn, so the foam follows every wander of the waterline
            // instead of ruling a straight line across it.
            //
            // Gated on being out on the shore as well, and not on the height
            // alone: the clearing is levelled to exactly the height a foam line
            // wants, so by height alone the whole lane the pet walks in came up
            // white.
            const beach = nextBiome.shore
            if (beach && nextBiome.relief && fallAt(z, nextBiome.relief) > 0) {
              if (height <= beach.level) return voxel(MATERIAL_INDEX.wet)
              if (height === beach.level + 1) return voxel(MATERIAL_INDEX.foam)
            }
            // Dither the two surface shades so the ground is not a flat colour.
            const tint = hash2(x, z, s ^ 0x5bf0) > 0.62
            return voxel(tint ? MATERIAL_INDEX.surfaceB : MATERIAL_INDEX.surfaceA)
          }
          if (y >= height - 3) return voxel(MATERIAL_INDEX.soil)
          return voxel(MATERIAL_INDEX.rock)
        }
        // Scenery lives in the same field as the ground, so it culls and
        // occludes against it rather than floating as a separate mesh.
        return scenery.voxels.get(propKey(x, y, z)) ?? null
      },
    }

    // The patch, read out once into a flat grid. The mesher walks it many times
    // over -- once to cull each face, and twelve more to shade each corner --
    // and against the grid every one of those is an array index.
    const { w: gw, h: gh, d: gd } = field
    const cells: (Voxel | null)[] = new Array(gw * gh * gd)
    for (let y = 0; y < gh; y++)
      for (let z = 0; z < gd; z++)
        for (let x = 0; x < gw; x++) cells[(y * gd + z) * gw + x] = field.at(x, y, z)

    // Below the patch is solid, as it was before, so the underside is culled.
    const bedrock = voxel(MATERIAL_INDEX.rock)
    const source: VoxelSource = {
      w: gw,
      h: gh,
      d: gd,
      at(x, y, z) {
        if (x < 0 || z < 0 || x >= gw || z >= gd) return null
        if (y < 0) return bedrock
        if (y >= gh) return null
        return cells[(y * gd + z) * gw + x]!
      },
    }

    const origin: [number, number, number] = [
      (-TERRAIN_COLS / 2) * TERRAIN_VOXEL,
      0,
      (-TERRAIN_ROWS / 2) * TERRAIN_VOXEL,
    ]
    const built = buildVoxels(gl, source, { scale: TERRAIN_VOXEL, origin })
    faces = built.faces
    props = scenery.count

    if (mesh) {
      mesh.geometry.remove()
      mesh.geometry = built.geometry
    } else {
      mesh = new Mesh(gl, { geometry: built.geometry, program })
      mesh.frustumCulled = false
      mesh.setParent(root)
    }
  }

  build(seed, biome)

  return {
    root,
    get shape() {
      return shape
    },
    get faces() {
      return faces
    },
    get props() {
      return props
    },
    rebuild: build,
    setSick(amount) {
      program.uniforms.uSick.value = amount
    },
    setLighting(lighting) {
      const u = program.uniforms
      u.uLightDir.value = lighting.direction
      u.uLightColour.value = lighting.colour
      u.uLightIntensity.value = lighting.intensity
      u.uAmbientColour.value = lighting.ambientColour
      u.uAmbientIntensity.value = lighting.ambientIntensity
      u.uHaze.value = lighting.haze
    },
    setLamps(positions, intensity) {
      const u = program.uniforms
      u.uLampPos.value = positions
      u.uLampIntensity.value = intensity
    },
  }
}
