import { Geometry } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import { expandLayers, type VoxelModel } from '../data/voxel-format'

export const PART_BODY = 0
export const PART_HEAD = 1
export const PART_LEG = 2
export const PART_ARM = 3

/** Layers at or above this fraction of the model's height animate as the head. */
const HEAD_FRACTION = 0.55

export interface Voxel {
  /** Linear-space colour. Used directly by the pets. */
  color: [number, number, number]
  emissive: number
  part: number
  /**
   * Material index into the season palette. The terrain stores this instead of
   * a colour so the whole world can be repainted for the season without any
   * geometry being rebuilt.
   */
  material?: number
}

/**
 * Anything that can be turned into a mesh: a creature's ASCII layers, or a
 * patch of terrain. Sharing this means terrain gets the same hidden-face
 * culling and corner occlusion that makes the pets read at low resolution.
 */
export interface VoxelSource {
  w: number
  h: number
  d: number
  at(x: number, y: number, z: number): Voxel | null
}

export const hexToLinear = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  // Approximate sRGB -> linear so the lighting doesn't wash the palette out.
  const lin = (c: number) => Math.pow(c / 255, 2.2)
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)]
}

const FACES: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

/** A perpendicular axis for each face normal, so (u, v, n) comes out right-handed. */
function basis(n: [number, number, number]): [number[], number[]] {
  const u = n[0] !== 0 ? [0, 1, 0] : n[1] !== 0 ? [0, 0, 1] : [1, 0, 0]
  const v = [
    n[1] * u[2]! - n[2] * u[1]!,
    n[2] * u[0]! - n[0] * u[2]!,
    n[0] * u[1]! - n[1] * u[0]!,
  ]
  return [u, v]
}

const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

/** Classic voxel corner occlusion: darker where two or three neighbours crowd a corner. */
function cornerAo(
  source: VoxelSource,
  x: number,
  y: number,
  z: number,
  n: number[],
  u: number[],
  v: number[],
  du: number,
  dv: number,
): number {
  const solid = (ax: number, ay: number, az: number) => (source.at(ax, ay, az) ? 1 : 0)
  const bx = x + n[0]!
  const by = y + n[1]!
  const bz = z + n[2]!
  const side1 = solid(bx + du * u[0]!, by + du * u[1]!, bz + du * u[2]!)
  const side2 = solid(bx + dv * v[0]!, by + dv * v[1]!, bz + dv * v[2]!)
  const corner = solid(
    bx + du * u[0]! + dv * v[0]!,
    by + du * u[1]! + dv * v[1]!,
    bz + du * u[2]! + dv * v[2]!,
  )
  const level = side1 && side2 ? 0 : 3 - (side1 + side2 + corner)
  return 0.55 + (level / 3) * 0.45
}

export interface VoxelBuild {
  geometry: Geometry
  faces: number
}

export interface BuildOptions {
  /** World size of one voxel. */
  scale: number
  /** World position of the grid's (0, 0, 0) corner. */
  origin: [number, number, number]
}

/** The per-vertex arrays a voxel volume expands to, before they become a mesh. */
export interface VoxelArrays {
  position: Float32Array
  normal: Float32Array
  color: Float32Array
  ao: Float32Array
  part: Float32Array
  emissive: Float32Array
  material: Float32Array
  faces: number
}

/** Builds a mesh from any voxel source, skipping faces buried inside the volume. */
export function buildVoxels(
  gl: OGLRenderingContext,
  source: VoxelSource,
  options: BuildOptions,
): VoxelBuild {
  const arrays = voxelArrays(source, options)
  return { geometry: geometryFrom(gl, arrays), faces: arrays.faces }
}

/** The six bases, worked out once. There are only six, and a patch of terrain
 *  asks for tens of thousands of faces. */
const BASIS: [number[], number[]][] = FACES.map((n) => basis(n))

/** The two ways a quad splits into triangles. */
const SPLIT_A = [0, 1, 2, 0, 2, 3]
const SPLIT_B = [1, 2, 3, 1, 3, 0]

/** The same expansion, stopping short of the mesh so extra vertices can be added. */
export function voxelArrays(
  source: VoxelSource,
  { scale, origin }: BuildOptions,
): VoxelArrays {
  const { w, h, d } = source

  // Counted first, then filled. The alternative -- growing seven plain arrays a
  // number at a time and copying them out at the end -- spends more on the
  // copying and the garbage than the whole rest of the mesher does.
  let faces = 0
  for (let y = 0; y < h; y++)
    for (let z = 0; z < d; z++)
      for (let x = 0; x < w; x++) {
        const voxel = source.at(x, y, z)
        if (!voxel) continue
        for (let f = 0; f < 6; f++) {
          const n = FACES[f]!
          const neighbour = source.at(x + n[0], y + n[1], z + n[2])
          if (neighbour && neighbour.part === voxel.part) continue
          faces++
        }
      }

  const verts = faces * 6
  const position = new Float32Array(verts * 3)
  const normal = new Float32Array(verts * 3)
  const color = new Float32Array(verts * 3)
  const ao = new Float32Array(verts)
  const part = new Float32Array(verts)
  const emissive = new Float32Array(verts)
  const material = new Float32Array(verts)

  // One quad's four corners, reused by every face rather than allocated afresh.
  const vx = [0, 0, 0, 0]
  const vy = [0, 0, 0, 0]
  const vz = [0, 0, 0, 0]
  const shades = [0, 0, 0, 0]
  const half = scale / 2
  /** Write cursors into the three-wide arrays and the one-wide ones. */
  let wide = 0
  let narrow = 0

  for (let y = 0; y < h; y++) {
    for (let z = 0; z < d; z++) {
      for (let x = 0; x < w; x++) {
        const voxel = source.at(x, y, z)
        if (!voxel) continue
        const cx = origin[0] + (x + 0.5) * scale
        const cy = origin[1] + (y + 0.5) * scale
        const cz = origin[2] + (z + 0.5) * scale
        const col = voxel.color
        const vPart = voxel.part
        const vEm = voxel.emissive
        const vMat = voxel.material ?? 0

        for (let f = 0; f < 6; f++) {
          const n = FACES[f]!
          const neighbour = source.at(x + n[0], y + n[1], z + n[2])
          // A face between two different parts must be kept: parts move
          // independently in the pet shader, and a culled interface becomes a
          // see-through hole the moment a limb swings away from the body.
          if (neighbour && neighbour.part === vPart) continue
          const [u, v] = BASIS[f]!
          for (let c = 0; c < 4; c++) {
            const du = CORNERS[c]![0]
            const dv = CORNERS[c]![1]
            vx[c] = cx + (n[0] + du * u[0]! + dv * v[0]!) * half
            vy[c] = cy + (n[1] + du * u[1]! + dv * v[1]!) * half
            vz[c] = cz + (n[2] + du * u[2]! + dv * v[2]!) * half
            shades[c] = cornerAo(source, x, y, z, n, u, v, du, dv)
          }
          // Flip the split so the AO gradient never creases across the quad.
          const split =
            shades[0]! + shades[2]! > shades[1]! + shades[3]! ? SPLIT_A : SPLIT_B
          for (let k = 0; k < 6; k++) {
            const i = split[k]!
            position[wide] = vx[i]!
            position[wide + 1] = vy[i]!
            position[wide + 2] = vz[i]!
            normal[wide] = n[0]
            normal[wide + 1] = n[1]
            normal[wide + 2] = n[2]
            color[wide] = col[0]
            color[wide + 1] = col[1]
            color[wide + 2] = col[2]
            wide += 3
            ao[narrow] = shades[i]!
            part[narrow] = vPart
            emissive[narrow] = vEm
            material[narrow] = vMat
            narrow++
          }
        }
      }
    }
  }

  return { position, normal, color, ao, part, emissive, material, faces }
}

/** Two arrays end to end. */
const join = (a: Float32Array, b: Float32Array): Float32Array => {
  const out = new Float32Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

/** Two sets of vertex arrays as one mesh's worth. */
export function mergeArrays(a: VoxelArrays, b: VoxelArrays): VoxelArrays {
  return {
    position: join(a.position, b.position),
    normal: join(a.normal, b.normal),
    color: join(a.color, b.color),
    ao: join(a.ao, b.ao),
    part: join(a.part, b.part),
    emissive: join(a.emissive, b.emissive),
    material: join(a.material, b.material),
    faces: a.faces + b.faces,
  }
}

/** Turns expanded arrays into a mesh. */
export function geometryFrom(gl: OGLRenderingContext, arrays: VoxelArrays): Geometry {
  return new Geometry(gl, {
    position: { size: 3, data: arrays.position },
    normal: { size: 3, data: arrays.normal },
    color: { size: 3, data: arrays.color },
    ao: { size: 1, data: arrays.ao },
    part: { size: 1, data: arrays.part },
    emissive: { size: 1, data: arrays.emissive },
    material: { size: 1, data: arrays.material },
  })
}

/** Wraps a creature's ASCII layers as a voxel source. */
export function modelSource(model: VoxelModel): VoxelSource {
  const layers = expandLayers(model)
  const h = layers.length
  const d = Math.max(...layers.map((l) => l.length))
  const w = Math.max(...layers.flatMap((l) => l.map((r) => r.length)))

  const emissiveSet = new Set(model.emissive ?? [])
  const headSet = new Set(model.head ?? [])
  const legSet = new Set(model.legs ?? [])
  const armSet = new Set(model.arms ?? [])
  const headStart = Math.floor(h * HEAD_FRACTION)
  const cache = new Map<string, Voxel>()

  return {
    w,
    h,
    d,
    at(x, y, z) {
      if (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= d) return null
      const ch = layers[y]?.[z]?.[x]
      if (ch === undefined || ch === '.') return null

      const key = `${ch}:${y >= headStart ? 1 : 0}`
      let voxel = cache.get(key)
      if (!voxel) {
        // Limbs are tested first: an arm high on the body must not be swept up
        // by the head-height rule.
        const part = legSet.has(ch)
          ? PART_LEG
          : armSet.has(ch)
            ? PART_ARM
            : headSet.has(ch) || y >= headStart
              ? PART_HEAD
              : PART_BODY
        voxel = {
          color: hexToLinear(model.palette[ch] ?? '#ff00ff'),
          emissive: emissiveSet.has(ch) ? 1 : 0,
          part,
        }
        cache.set(key, voxel)
      }
      return voxel
    },
  }
}

export interface VoxelGeometry {
  geometry: Geometry
  /** Height of the model in world units after the mesh is centred and scaled. */
  height: number
  /** Height of the hip joint, so legs can be swung about it rather than slid. */
  hipY: number
  /** Height of the shoulder joint. */
  shoulderY: number
  faces: number
}

/** Builds a centred, unit-scaled mesh from a voxel model. */
export function buildVoxelGeometry(
  gl: OGLRenderingContext,
  model: VoxelModel,
  targetHeight = 2.2,
): VoxelGeometry {
  const source = modelSource(model)
  const scale = targetHeight / source.h
  // Centred on x/z, sitting on the ground at y = 0.
  const origin: [number, number, number] = [
    (-source.w / 2) * scale,
    0,
    (-source.d / 2) * scale,
  ]
  // Joints sit at the top of the topmost limb voxel, so a swing pivots from
  // where the limb meets the body.
  let topLeg = -1
  let topArm = -1
  for (let y = 0; y < source.h; y++) {
    for (let z = 0; z < source.d; z++) {
      for (let x = 0; x < source.w; x++) {
        const part = source.at(x, y, z)?.part
        if (part === PART_LEG) topLeg = Math.max(topLeg, y)
        else if (part === PART_ARM) topArm = Math.max(topArm, y)
      }
    }
  }

  const { geometry, faces } = buildVoxels(gl, source, { scale, origin })
  return {
    geometry,
    height: source.h * scale,
    hipY: (topLeg + 1) * scale,
    shoulderY: (topArm + 1) * scale,
    faces,
  }
}
