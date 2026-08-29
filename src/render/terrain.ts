import { Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import {
  PROP_CLEARING_MARGIN,
  PROP_SPACING,
  SHELTER_CENTRE,
  SHELTER_COLUMNS,
  TERRAIN_BASE,
  TERRAIN_CLEARING,
  TERRAIN_RELIEF,
  TERRAIN_SIZE,
  TERRAIN_VOXEL,
  type Biome,
} from '../data/biome'
import { PROPS, SHELTER, type Prop, type PropKey } from '../data/props'
import { expandLayers } from '../data/voxel-format'
import { buildVoxels, hexToLinear, PART_BODY, type Voxel, type VoxelSource } from './voxel-mesh'

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
}

export interface TerrainShape {
  size: number
  /** Column height in voxels. */
  heightAt(x: number, z: number): number
  /** World Y the pet stands on. */
  groundY: number
  shelter: ShelterPlacement
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
  const middle = TERRAIN_SIZE / 2
  return {
    ox: Math.round(middle + centre.x / TERRAIN_VOXEL - SHELTER_COLUMNS.w / 2),
    oz: Math.round(middle + centre.z / TERRAIN_VOXEL - SHELTER_COLUMNS.d / 2),
    w: SHELTER_COLUMNS.w,
    d: SHELTER_COLUMNS.d,
    centre,
    half,
    // Standing just inside the open front, where it stays visible.
    inside: { x: centre.x, z: centre.z + half.z * 0.35 },
  }
}

export function terrainShape(seed: string): TerrainShape {
  const s = seedFrom(seed)
  const half = TERRAIN_SIZE / 2
  const clearing = TERRAIN_CLEARING / TERRAIN_VOXEL
  const shelter = placeShelter(s)

  const cache = new Int8Array(TERRAIN_SIZE * TERRAIN_SIZE)
  for (let z = 0; z < TERRAIN_SIZE; z++) {
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      // Two octaves: broad swells with a little local roughness.
      const broad = noise(x, z, 0.055, s)
      const fine = noise(x, z, 0.17, s ^ 0x9e37)
      let value = broad * 0.75 + fine * 0.25

      // Level the middle so the pet always has somewhere flat to stand.
      const distance = Math.hypot(x - half, z - half)
      const flatten = 1 - Math.min(1, Math.max(0, (distance - clearing) / (clearing * 1.4)))
      value = value * (1 - flatten) + 0.5 * flatten

      // The shelter gets its own level pad rather than a wider clearing, which
      // would push all the scenery out of the foreground. The pad runs forward
      // to meet the clearing, so the walk to bed is over flat ground the whole
      // way — the pet does not sample terrain height as it moves.
      const onPad =
        x >= shelter.ox - 1 &&
        x < shelter.ox + shelter.w + 1 &&
        z >= shelter.oz - 1 &&
        z < half + 2
      if (onPad) value = 0.5

      const height = Math.round(TERRAIN_BASE + (value - 0.5) * 2 * TERRAIN_RELIEF)
      cache[z * TERRAIN_SIZE + x] = Math.max(1, height)
    }
  }

  return {
    size: TERRAIN_SIZE,
    shelter,
    heightAt: (x, z) =>
      x < 0 || z < 0 || x >= TERRAIN_SIZE || z >= TERRAIN_SIZE
        ? 0
        : cache[z * TERRAIN_SIZE + x]!,
    groundY: TERRAIN_BASE * TERRAIN_VOXEL,
  }
}

interface Scenery {
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
function scatterProps(
  shape: TerrainShape,
  biome: Biome,
  seed: number,
  cache: Map<string, Voxel>,
): Scenery {
  const voxels = new Map<number, Voxel>()
  const taken = new Set<number>()
  const half = TERRAIN_SIZE / 2
  const clearing = TERRAIN_CLEARING / TERRAIN_VOXEL + PROP_CLEARING_MARGIN
  const totalWeight = PROPS.reduce((sum, prop) => sum + prop.weight, 0)
  let top = 0
  let count = 0

  const colour = (key: PropKey): Voxel => {
    const cached = cache.get(`prop${key}`)
    if (cached) return cached
    const made: Voxel = { color: hexToLinear(biome.props[key]), emissive: 0, part: PART_BODY }
    cache.set(`prop${key}`, made)
    return made
  }

  const pick = (roll: number): Prop => {
    let remaining = roll * totalWeight
    for (const prop of PROPS) {
      remaining -= prop.weight
      if (remaining <= 0) return prop
    }
    return PROPS[PROPS.length - 1]!
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
          voxels.set((wy * TERRAIN_SIZE + (oz + z)) * TERRAIN_SIZE + (ox + x), colour(ch as PropKey))
          top = Math.max(top, wy)
        }
      }
    }
  }

  // The shelter goes down first, on its own levelled pad, and its surroundings
  // are reserved so nothing is scattered against its walls or in its doorway.
  const sh = shape.shelter
  stamp(SHELTER, sh.ox, sh.oz, TERRAIN_BASE)
  count++
  // Reserve the shelter and the path back to the clearing, so nothing is
  // scattered against its walls or left standing in the pet's way.
  for (let z = sh.oz - 2; z < half + 2; z++) {
    for (let x = sh.ox - 2; x < sh.ox + sh.w + 2; x++) {
      if (x < 0 || z < 0 || x >= TERRAIN_SIZE || z >= TERRAIN_SIZE) continue
      taken.add(z * TERRAIN_SIZE + x)
    }
  }

  for (let cz = 0; cz < TERRAIN_SIZE; cz += PROP_SPACING) {
    for (let cx = 0; cx < TERRAIN_SIZE; cx += PROP_SPACING) {
      if (hash2(cx, cz, seed ^ 0x1111) > biome.propDensity) continue

      const prop = pick(hash2(cx, cz, seed ^ 0x4444))
      const layers = expandLayers(prop.model)
      const depth = layers[0]!.length
      const width = layers[0]![0]!.length
      const ox = cx + Math.floor(hash2(cx, cz, seed ^ 0x2222) * PROP_SPACING) - (width >> 1)
      const oz = cz + Math.floor(hash2(cx, cz, seed ^ 0x3333) * PROP_SPACING) - (depth >> 1)

      // Must fit on the patch, clear of the pet's ground, on level enough footing.
      if (ox < 1 || oz < 1 || ox + width >= TERRAIN_SIZE || oz + depth >= TERRAIN_SIZE) continue
      let lowest = Infinity
      let highest = -Infinity
      let blocked = false
      for (let z = oz; z < oz + depth && !blocked; z++) {
        for (let x = ox; x < ox + width; x++) {
          if (Math.hypot(x - half, z - half) < clearing) {
            blocked = true
            break
          }
          if (taken.has(z * TERRAIN_SIZE + x)) {
            blocked = true
            break
          }
          const h = shape.heightAt(x, z)
          lowest = Math.min(lowest, h)
          highest = Math.max(highest, h)
        }
      }
      if (blocked || highest - lowest > 1) continue

      stamp(prop, ox, oz, lowest)

      // Reserve the footprint plus the prop's own breathing room.
      const pad = prop.spacing
      for (let z = oz - pad; z < oz + depth + pad; z++) {
        for (let x = ox - pad; x < ox + width + pad; x++) {
          if (x < 0 || z < 0 || x >= TERRAIN_SIZE || z >= TERRAIN_SIZE) continue
          taken.add(z * TERRAIN_SIZE + x)
        }
      }
      count++
    }
  }

  return { voxels, top, count }
}

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 color;
  attribute float ao;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vDepth;

  void main() {
    vNormal = normalMatrix * normal;
    vColor = color;
    vAo = ao;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Distance from the eye. Haze by depth rather than by distance from the
    // centre, so the near ground stays crisp right across the frame and only
    // the far ground melts into the sky.
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  uniform vec3 uHaze;
  uniform vec2 uFog;
  uniform float uSick;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vAo;
  varying float vDepth;

  void main() {
    vec3 N = normalize(vNormal);
    float key = max(dot(N, normalize(vec3(0.55, 0.9, 0.6))), 0.0);
    float fill = max(dot(N, normalize(vec3(-0.6, 0.15, -0.55))), 0.0);

    vec3 lit = vColor * (0.34 + 0.72 * key);
    lit += vColor * vec3(0.35, 0.45, 0.7) * fill * 0.3;
    lit *= vAo;

    // The ground sickens along with its occupant.
    lit = mix(lit, mix(vec3(dot(lit, vec3(0.33))), vec3(0.40, 0.44, 0.30), 0.5) * 0.8, uSick);

    // Fade into the sky so the patch's edge is never a visible boundary.
    float haze = smoothstep(uFog.x, uFog.y, vDepth);
    gl_FragColor = vec4(mix(lit, uHaze, haze), 0.0);
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
  faces: number
}

export function createTerrain(gl: OGLRenderingContext, seed: string, biome: Biome): Terrain {
  const root = new Transform()
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uHaze: { value: biome.haze },
      // In view depth. Pushed out far enough that the shelter and the scenery
      // around it stay crisp, while the patch's far edge is still fully hazed.
      uFog: { value: [11.0, 18.0] },
      uSick: { value: 0 },
    },
    cullFace: gl.BACK,
  })

  let mesh: Mesh | null = null
  let shape = terrainShape(seed)
  let faces = 0
  let props = 0

  const build = (nextSeed: string, nextBiome: Biome) => {
    shape = terrainShape(nextSeed)
    const s = seedFrom(nextSeed)
    const surface = nextBiome.surface.map(hexToLinear)
    const soil = hexToLinear(nextBiome.soil)
    const rock = hexToLinear(nextBiome.rock)
    const cache = new Map<string, Voxel>()
    const voxel = (color: [number, number, number], key: string): Voxel => {
      let found = cache.get(key)
      if (!found) {
        found = { color, emissive: 0, part: PART_BODY }
        cache.set(key, found)
      }
      return found
    }

    let maxHeight = 1
    for (let z = 0; z < TERRAIN_SIZE; z++) {
      for (let x = 0; x < TERRAIN_SIZE; x++) maxHeight = Math.max(maxHeight, shape.heightAt(x, z))
    }

    const scenery = scatterProps(shape, nextBiome, s, cache)
    const propKey = (x: number, y: number, z: number) => (y * TERRAIN_SIZE + z) * TERRAIN_SIZE + x

    const source: VoxelSource = {
      w: TERRAIN_SIZE,
      h: Math.max(maxHeight, scenery.top + 1),
      d: TERRAIN_SIZE,
      at(x, y, z) {
        if (x < 0 || z < 0 || x >= TERRAIN_SIZE || z >= TERRAIN_SIZE) return null
        // Anything below the patch counts as solid so the underside is culled.
        if (y < 0) return voxel(rock, 'rock')
        const height = shape.heightAt(x, z)
        if (y < height) {
          if (y === height - 1) {
            // Dither the two surface shades so the ground is not a flat colour.
            const tint = hash2(x, z, s ^ 0x5bf0) > 0.62 ? 1 : 0
            return voxel(surface[tint]!, `surface${tint}`)
          }
          if (y >= height - 3) return voxel(soil, 'soil')
          return voxel(rock, 'rock')
        }
        // Scenery lives in the same field as the ground, so it culls and
        // occludes against it rather than floating as a separate mesh.
        return scenery.voxels.get(propKey(x, y, z)) ?? null
      },
    }

    const origin: [number, number, number] = [
      (-TERRAIN_SIZE / 2) * TERRAIN_VOXEL,
      0,
      (-TERRAIN_SIZE / 2) * TERRAIN_VOXEL,
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
    program.uniforms.uHaze.value = nextBiome.haze
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
  }
}
