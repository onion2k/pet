import { expandLayers, type VoxelModel } from '../data/voxel-format'

/**
 * Draws a creature for the instructions booklet.
 *
 * The pictures in the booklet are not screenshots and not hand-drawn art: they
 * are the game's own voxel models, projected. A creature redrawn by hand would
 * be a promise the game had to keep; a creature drawn from `models.ts` cannot
 * disagree with the one that hatches.
 *
 * The projection is a three-quarter view from the pet's front-left, so the face
 * the models paint on their last row is the facet turned toward the reader.
 */

interface Voxel {
  x: number
  y: number
  z: number
  colour: string
  glow: boolean
}

/** `#rrggbb` to its three channels. */
function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mixes toward white for `amount > 0` and toward black for `amount < 0`. */
function shade(hex: string, amount: number): string {
  const [r, g, b] = channels(hex)
  const target = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  const mix = (c: number) => Math.round(c + (target - c) * t)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function voxelsOf(model: VoxelModel): Voxel[] {
  const glowing = new Set(model.emissive ?? [])
  const out: Voxel[] = []
  expandLayers(model).forEach((layer, y) => {
    layer.forEach((row, z) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]!
        if (ch === '.') continue
        const colour = model.palette[ch]
        if (!colour) continue
        out.push({ x, y, z, colour, glow: glowing.has(ch) })
      }
    })
  })
  return out
}

export interface SpriteOptions {
  /** Pixels across one voxel. The whole picture is sized from it. */
  unit?: number
  /** Drawn under the creature so it stands on something rather than floating. */
  shadow?: boolean
}

/**
 * A creature on its own transparent canvas, sized to whatever it turned out to
 * need. The canvas is drawn at the device's own pixel density and given a CSS
 * size in points, so the cubes stay crisp on a retina screen.
 */
export function creatureSprite(model: VoxelModel, options: SpriteOptions = {}): HTMLCanvasElement {
  const unit = options.unit ?? 9
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
  const voxels = voxelsOf(model)

  // Half-width, half-depth and height of one cube on the page.
  const w = unit
  const h = unit / 2
  const e = unit

  // Nearer voxels have more z, less x and more y, so that sum is the draw order.
  voxels.sort((a, b) => a.z - a.x + a.y - (b.z - b.x + b.y))

  const project = (v: Voxel) => ({ px: (v.z - v.x) * w, py: (v.x + v.z) * h - v.y * e })
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const v of voxels) {
    const { px, py } = project(v)
    minX = Math.min(minX, px - w)
    maxX = Math.max(maxX, px + w)
    minY = Math.min(minY, py)
    maxY = Math.max(maxY, py + 2 * h + e)
  }

  const pad = unit
  const width = Math.ceil(maxX - minX) + pad * 2
  const height = Math.ceil(maxY - minY) + pad * 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(dpr, dpr)
  ctx.translate(pad - minX, pad - minY)

  if (options.shadow !== false) {
    // A soft pool on the ground, so the creature is standing rather than hanging.
    ctx.save()
    ctx.fillStyle = 'rgba(60, 40, 80, 0.16)'
    ctx.beginPath()
    ctx.ellipse((minX + maxX) / 2, maxY - h, (maxX - minX) * 0.34, h * 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const face = (points: [number, number][], colour: string) => {
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.moveTo(points[0]![0], points[0]![1])
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]![0], points[i]![1])
    ctx.closePath()
    ctx.fill()
  }

  for (const v of voxels) {
    const { px, py } = project(v)
    if (v.glow) {
      ctx.shadowColor = v.colour
      ctx.shadowBlur = unit * 1.6
    }
    const lift = v.glow ? 0.35 : 0
    // Top, then the two facets a viewer at the front-left can see.
    face(
      [
        [px, py],
        [px + w, py + h],
        [px, py + 2 * h],
        [px - w, py + h],
      ],
      shade(v.colour, 0.2 + lift),
    )
    face(
      [
        [px + w, py + h],
        [px + w, py + h + e],
        [px, py + 2 * h + e],
        [px, py + 2 * h],
      ],
      shade(v.colour, lift),
    )
    face(
      [
        [px - w, py + h],
        [px, py + 2 * h],
        [px, py + 2 * h + e],
        [px - w, py + h + e],
      ],
      shade(v.colour, -0.28 + lift),
    )
    ctx.shadowBlur = 0
  }

  return canvas
}

/** The colour a form reads as: the commonest voxel in its model. Used for the
 *  cards' trim, exactly as the album takes its colours from the same place. */
export function bodyColour(model: VoxelModel): string {
  const counts = new Map<string, number>()
  for (const v of voxelsOf(model)) counts.set(v.colour, (counts.get(v.colour) ?? 0) + 1)
  let best = '#8ade60'
  let most = 0
  for (const [colour, count] of counts) {
    if (count > most) {
      most = count
      best = colour
    }
  }
  return best
}
