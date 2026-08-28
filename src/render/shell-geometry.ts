import { Geometry } from 'ogl'
import type { OGLRenderingContext } from 'ogl'

export interface PebbleOptions {
  /** Half-extents on x, y, z. */
  size: [number, number, number]
  /** 1 is a sphere; lower values square the silhouette off. 0.6-0.8 reads as moulded plastic. */
  roundness: number
  /** Flattens the +z face to this depth, giving the device a front to mount a screen on. */
  flattenFront?: number
  segments?: number
}

const signPow = (value: number, exponent: number): number =>
  Math.sign(value) * Math.pow(Math.abs(value), exponent)

/**
 * A superellipsoid. It is the single most useful shape here: at different
 * exponents and scales it is the shell, the bezel, and the rubber buttons.
 */
export function pebbleGeometry(gl: OGLRenderingContext, options: PebbleOptions): Geometry {
  const { size, roundness, flattenFront, segments = 48 } = options
  const segU = segments
  const segV = Math.max(8, Math.floor(segments * 0.7))

  const points: [number, number, number][] = []

  for (let iv = 0; iv <= segV; iv++) {
    const v = (iv / segV) * Math.PI - Math.PI / 2
    const cv = signPow(Math.cos(v), roundness)
    const sv = signPow(Math.sin(v), roundness)
    for (let iu = 0; iu <= segU; iu++) {
      const u = (iu / segU) * Math.PI * 2
      let x = size[0] * cv * signPow(Math.cos(u), roundness)
      const y = size[1] * sv
      let z = size[2] * cv * signPow(Math.sin(u), roundness)

      if (flattenFront !== undefined && z > 0) {
        // Soft clamp, so the flat face meets the curved sides without a crease.
        z = flattenFront * Math.tanh(z / flattenFront)
      }
      // Guard against the poles collapsing to NaN at low roundness.
      if (!Number.isFinite(x)) x = 0
      points.push([x, y, z])
    }
  }

  const stride = segU + 1
  const index: number[] = []
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu
      const b = a + 1
      const c = a + stride
      const d = c + 1
      index.push(a, c, b, b, c, d)
    }
  }

  // Smooth normals by accumulating face normals per vertex.
  const normals = new Float32Array(points.length * 3)
  for (let i = 0; i < index.length; i += 3) {
    const p0 = points[index[i]!]!
    const p1 = points[index[i + 1]!]!
    const p2 = points[index[i + 2]!]!
    const ux = p1[0] - p0[0]
    const uy = p1[1] - p0[1]
    const uz = p1[2] - p0[2]
    const vx = p2[0] - p0[0]
    const vy = p2[1] - p0[1]
    const vz = p2[2] - p0[2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (let k = 0; k < 3; k++) {
      const target = index[i + k]! * 3
      normals[target] = normals[target]! + nx
      normals[target + 1] = normals[target + 1]! + ny
      normals[target + 2] = normals[target + 2]! + nz
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) || 1
    normals[i] = normals[i]! / len
    normals[i + 1] = normals[i + 1]! / len
    normals[i + 2] = normals[i + 2]! / len
  }

  const position = new Float32Array(points.length * 3)
  points.forEach((p, i) => {
    position[i * 3] = p[0]
    position[i * 3 + 1] = p[1]
    position[i * 3 + 2] = p[2]
  })

  return new Geometry(gl, {
    position: { size: 3, data: position },
    normal: { size: 3, data: normals },
    index: { size: 1, data: new Uint16Array(index) },
  })
}
