import { Mesh, Program, Transform } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import {
  TERRAIN_BASE,
  TERRAIN_CLEARING,
  TERRAIN_RELIEF,
  TERRAIN_SIZE,
  TERRAIN_VOXEL,
  type Biome,
} from '../data/biome'
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

export interface TerrainShape {
  size: number
  /** Column height in voxels. */
  heightAt(x: number, z: number): number
  /** World Y the pet stands on. */
  groundY: number
}

export function terrainShape(seed: string): TerrainShape {
  const s = seedFrom(seed)
  const half = TERRAIN_SIZE / 2
  const clearing = TERRAIN_CLEARING / TERRAIN_VOXEL

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

      const height = Math.round(TERRAIN_BASE + (value - 0.5) * 2 * TERRAIN_RELIEF)
      cache[z * TERRAIN_SIZE + x] = Math.max(1, height)
    }
  }

  return {
    size: TERRAIN_SIZE,
    heightAt: (x, z) =>
      x < 0 || z < 0 || x >= TERRAIN_SIZE || z >= TERRAIN_SIZE
        ? 0
        : cache[z * TERRAIN_SIZE + x]!,
    groundY: TERRAIN_BASE * TERRAIN_VOXEL,
  }
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
      // In view depth: the near ground is crisp, and the patch is fully hazed
      // before its far edge at a depth of about 16.
      uFog: { value: [9.0, 15.0] },
      uSick: { value: 0 },
    },
    cullFace: gl.BACK,
  })

  let mesh: Mesh | null = null
  let shape = terrainShape(seed)
  let faces = 0

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

    const source: VoxelSource = {
      w: TERRAIN_SIZE,
      h: maxHeight,
      d: TERRAIN_SIZE,
      at(x, y, z) {
        if (x < 0 || z < 0 || x >= TERRAIN_SIZE || z >= TERRAIN_SIZE) return null
        // Anything below the patch counts as solid so the underside is culled.
        if (y < 0) return voxel(rock, 'rock')
        const height = shape.heightAt(x, z)
        if (y >= height) return null
        if (y === height - 1) {
          // Dither the two surface shades so the ground is not a flat colour.
          const tint = hash2(x, z, s ^ 0x5bf0) > 0.62 ? 1 : 0
          return voxel(surface[tint]!, `surface${tint}`)
        }
        if (y >= height - 3) return voxel(soil, 'soil')
        return voxel(rock, 'rock')
      },
    }

    const origin: [number, number, number] = [
      (-TERRAIN_SIZE / 2) * TERRAIN_VOXEL,
      0,
      (-TERRAIN_SIZE / 2) * TERRAIN_VOXEL,
    ]
    const built = buildVoxels(gl, source, { scale: TERRAIN_VOXEL, origin })
    faces = built.faces

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
    rebuild: build,
    setSick(amount) {
      program.uniforms.uSick.value = amount
    },
  }
}
