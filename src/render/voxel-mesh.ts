import { Geometry } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import type { VoxelModel } from '../data/voxel-format'

export const PART_BODY = 0
export const PART_HEAD = 1
export const PART_LIMB = 2

/** Layers at or above this fraction of the model's height animate as the head. */
const HEAD_FRACTION = 0.55

interface Grid {
  w: number
  h: number
  d: number
  /** Palette character at each cell, or null for air. */
  at(x: number, y: number, z: number): string | null
}

function toGrid(model: VoxelModel): Grid {
  const h = model.layers.length
  const d = Math.max(...model.layers.map((l) => l.length))
  const w = Math.max(...model.layers.flatMap((l) => l.map((r) => r.length)))
  return {
    w,
    h,
    d,
    at(x, y, z) {
      if (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= d) return null
      const ch = model.layers[y]?.[z]?.[x]
      return ch === undefined || ch === '.' ? null : ch
    },
  }
}

const hexToRgb = (hex: string): [number, number, number] => {
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
  grid: Grid,
  x: number,
  y: number,
  z: number,
  n: number[],
  u: number[],
  v: number[],
  du: number,
  dv: number,
): number {
  const solid = (ax: number, ay: number, az: number) => (grid.at(ax, ay, az) ? 1 : 0)
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

export interface VoxelGeometry {
  geometry: Geometry
  /** Height of the model in world units after the mesh is centred and scaled. */
  height: number
  /** Number of drawn faces, useful when budgeting for phones. */
  faces: number
}

/**
 * Builds a centred, unit-scaled mesh from a voxel model. Interior faces are
 * skipped, so a solid body costs only its surface.
 */
export function buildVoxelGeometry(
  gl: OGLRenderingContext,
  model: VoxelModel,
  targetHeight = 2.2,
): VoxelGeometry {
  const grid = toGrid(model)
  const emissiveSet = new Set(model.emissive ?? [])
  const headSet = new Set(model.head ?? [])
  const limbSet = new Set(model.limbs ?? [])
  const headStart = Math.floor(grid.h * HEAD_FRACTION)

  const position: number[] = []
  const normal: number[] = []
  const color: number[] = []
  const ao: number[] = []
  const part: number[] = []
  const emissive: number[] = []

  const scale = targetHeight / grid.h
  const ox = (grid.w - 1) / 2
  const oz = (grid.d - 1) / 2
  let faces = 0

  for (let y = 0; y < grid.h; y++) {
    for (let z = 0; z < grid.d; z++) {
      for (let x = 0; x < grid.w; x++) {
        const ch = grid.at(x, y, z)
        if (!ch) continue

        const rgb = hexToRgb(model.palette[ch] ?? '#ff00ff')
        const isEmissive = emissiveSet.has(ch) ? 1 : 0
        const partId = limbSet.has(ch)
          ? PART_LIMB
          : headSet.has(ch) || y >= headStart
            ? PART_HEAD
            : PART_BODY

        for (const n of FACES) {
          if (grid.at(x + n[0], y + n[1], z + n[2])) continue
          faces++
          const [u, v] = basis(n)
          // Voxel centre in world units: x/z centred, y sitting on the ground.
          const cx = (x - ox) * scale
          const cy = (y + 0.5) * scale
          const cz = (z - oz) * scale
          const half = scale / 2

          const verts: number[][] = []
          const shades: number[] = []
          for (const [du, dv] of CORNERS) {
            verts.push([
              cx + (n[0] + du * u[0]! + dv * v[0]!) * half,
              cy + (n[1] + du * u[1]! + dv * v[1]!) * half,
              cz + (n[2] + du * u[2]! + dv * v[2]!) * half,
            ])
            shades.push(cornerAo(grid, x, y, z, n, u, v, du, dv))
          }

          // Flip the split so the AO gradient never creases across the quad.
          const order =
            shades[0]! + shades[2]! > shades[1]! + shades[3]!
              ? [0, 1, 2, 0, 2, 3]
              : [1, 2, 3, 1, 3, 0]

          for (const i of order) {
            position.push(verts[i]![0]!, verts[i]![1]!, verts[i]![2]!)
            normal.push(n[0], n[1], n[2])
            color.push(rgb[0], rgb[1], rgb[2])
            ao.push(shades[i]!)
            part.push(partId)
            emissive.push(isEmissive)
          }
        }
      }
    }
  }

  const geometry = new Geometry(gl, {
    position: { size: 3, data: new Float32Array(position) },
    normal: { size: 3, data: new Float32Array(normal) },
    color: { size: 3, data: new Float32Array(color) },
    ao: { size: 1, data: new Float32Array(ao) },
    part: { size: 1, data: new Float32Array(part) },
    emissive: { size: 1, data: new Float32Array(emissive) },
  })

  return { geometry, height: grid.h * scale, faces }
}
