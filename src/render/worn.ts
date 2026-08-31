import type { VoxelModel } from '../data/voxel-format'
import { kitById, type KitId } from '../data/kit'
import { KIT_MODELS } from '../data/kit-models'
import type { Anchor } from './face'
import {
  mergeArrays,
  modelSource,
  PART_HEAD,
  voxelArrays,
  type Voxel,
  type VoxelArrays,
  type VoxelSource,
} from './voxel-mesh'

/**
 * Kit, on the pet.
 *
 * The board is where the collection lives; this is where it shows. A hat that
 * only exists as an 8x8 glyph on a screen the player opens twice a session is
 * a hat the game never really has -- and the yard is the one channel that has
 * never said what the weather is doing.
 *
 * The whole thing is the face's trick a second time. `buildFace` makes a
 * second set of vertex arrays, tags them with the head's `part`, and hands
 * them to `setModel` to concatenate onto the body -- after which every
 * deformation in the vertex shader carries them along for free. So does this:
 * a hat is a small voxel model merged in as `PART_HEAD`, and it then twists
 * with the idle look-around, settles when the pet sleeps, bows when it is sad
 * and rises with each stride, without one line of the shader changing.
 */

/**
 * Where a thing hangs, read off the model's own voxels.
 *
 * As with the face, and for the same reason: eight items across a dozen forms
 * is ninety-six placements to write down and ninety-six chances for one to
 * drift out of step the next time a model is edited. Measured, it is one pass
 * that cannot disagree with the creature it is measuring.
 */
export interface KitAnchors {
  /** The top of the head, at the middle of whatever the topmost layer is. */
  crown: Anchor
  /** World size of one of the pet's voxels, so kit keeps the model's grain. */
  voxel: number
}

export function kitAnchors(model: VoxelModel, targetHeight: number): KitAnchors {
  const source = modelSource(model)
  const scale = targetHeight / source.h
  const originX = (-source.w / 2) * scale
  const originZ = (-source.d / 2) * scale

  // The top of the head, which is not the top of the model. Plenty of these
  // creatures wear something above their heads already -- Mochimo has a tuft of
  // four sparkles, the hatchling an antenna three voxels wide -- and a hat
  // balanced on a wisp floats over the head rather than sitting on it.
  //
  // So a layer has to be a substantial share of the creature's fullest one to
  // count as somewhere to put a hat. A wisp is not a head.
  const filled = layerSizes(source)
  const widest = Math.max(...filled)
  let topY = 0
  for (let y = source.h - 1; y >= 0; y--) {
    if (filled[y]! >= widest * CROWN_SHARE) {
      topY = y
      break
    }
  }
  const top = rowsAt(source, topY)
  const mid = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

  return {
    crown: {
      x: originX + mid(top.map((v) => v.x + 0.5)) * scale,
      // The top surface rather than the top voxel's middle, so a hat sits on
      // the head instead of sinking half a voxel into it.
      y: (topY + 1) * scale,
      z: originZ + mid(top.map((v) => v.z + 0.5)) * scale,
    },
    voxel: scale,
  }
}

/**
 * How full a layer has to be, against the model's fullest, to be the head
 * rather than something growing out of it. A quarter clears every tuft and
 * antenna in the album while keeping every real crown.
 */
const CROWN_SHARE = 0.25

/** How many voxels each layer holds, bottom to top. */
function layerSizes(source: VoxelSource): number[] {
  const sizes: number[] = []
  for (let y = 0; y < source.h; y++) sizes.push(rowsAt(source, y).length)
  return sizes
}

/** Every filled cell of one layer. */
function rowsAt(source: VoxelSource, y: number): { x: number; z: number }[] {
  const found: { x: number; z: number }[] = []
  for (let z = 0; z < source.d; z++) {
    for (let x = 0; x < source.w; x++) {
      if (source.at(x, y, z)) found.push({ x, z })
    }
  }
  return found
}

/**
 * A kit model's voxels, forced onto one part of the body.
 *
 * The part is the whole point. `modelSource` works a part out from the shape
 * of the creature it is reading -- head chars, limb chars, height -- which is
 * exactly right for a creature and exactly wrong for a hat, whose own top half
 * is not its head. So the part is stated here and the shader does the rest.
 */
function wornSource(model: VoxelModel, part: number): VoxelSource {
  const base = modelSource(model)
  return {
    w: base.w,
    h: base.h,
    d: base.d,
    at(x, y, z): Voxel | null {
      const voxel = base.at(x, y, z)
      return voxel ? { ...voxel, part } : null
    },
  }
}

/** What the pet has on, and where each piece of it goes. */
const HANGS: Partial<Record<KitId, { anchor: 'crown'; part: number }>> = {
  hat: { anchor: 'crown', part: PART_HEAD },
}

/**
 * The vertex arrays for everything the pet is wearing, ready to be merged onto
 * the body. Null when it is wearing nothing this build knows how to draw.
 */
export function buildWorn(worn: KitId[], anchors: KitAnchors): VoxelArrays | null {
  const pieces = worn
    .map((id) => ({ id, hangs: HANGS[id], model: KIT_MODELS[id] }))
    .filter((piece) => piece.hangs && piece.model)
  if (pieces.length === 0) return null

  let merged: VoxelArrays | null = null
  for (const piece of pieces) {
    const source = wornSource(piece.model!, piece.hangs!.part)
    const spot = anchors[piece.hangs!.anchor]
    // Built of the wearer's own blocks rather than scaled to fit its head, so
    // the grain lines up. Nine voxels across is nine voxels across, whatever
    // that form's voxels happen to measure.
    const scale = anchors.voxel
    const arrays = voxelArrays(source, {
      scale,
      origin: [
        spot.x - (source.w / 2) * scale,
        // Sunk by a voxel so the brim grips rather than perching on top. A hat
        // resting exactly on the crown reads as a hat floating over a head.
        spot.y - scale,
        spot.z - (source.d / 2) * scale,
      ],
    })
    merged = merged ? mergeArrays(merged, arrays) : arrays
  }
  return merged
}

/** The kit this build can actually draw on the pet, for the tests to sweep. */
export const wornKinds = (): KitId[] =>
  (Object.keys(HANGS) as KitId[]).filter((id) => kitById(id) && KIT_MODELS[id])
