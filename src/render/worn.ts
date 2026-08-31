import type { VoxelModel } from '../data/voxel-format'
import { kitById, type KitId } from '../data/kit'
import { KIT_MODELS } from '../data/kit-models'
import type { Anchor } from './face'
import {
  mergeArrays,
  modelSource,
  PART_ARM,
  PART_BODY,
  PART_HEAD,
  PART_LEG,
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
  /**
   * The end of each arm, left of the screen first -- where a hand would be if
   * these creatures had them. Null for anything armless, which is the egg.
   */
  hands: [Anchor, Anchor] | null
  /** The bottom of each leg, likewise, and likewise null for the egg. */
  feet: [Anchor, Anchor] | null
  /** The back of the body, at about the height a strap would cross it. */
  back: Anchor
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

  // Limbs are stubs at the far edges of the model -- arms at the leftmost and
  // rightmost columns, legs in the bottom layer or two -- so each pair is found
  // by splitting the voxels of that part about the model's middle. Every form
  // in the album is built that way, and the one that is not has no limbs at
  // all.
  const arms = partVoxels(source, PART_ARM)
  const legs = partVoxels(source, PART_LEG)
  const body = partVoxels(source, PART_BODY)

  const at = (group: Cell[], y: number): Anchor => ({
    x: originX + mid(group.map((v) => v.x + 0.5)) * scale,
    y,
    z: originZ + mid(group.map((v) => v.z + 0.5)) * scale,
  })

  /** The two ends of a limb, as an anchor each, ordered left of screen first. */
  const pair = (group: Cell[], height: (side: Cell[]) => number): [Anchor, Anchor] | null => {
    const middle = source.w / 2
    const left = group.filter((v) => v.x + 0.5 < middle)
    const right = group.filter((v) => v.x + 0.5 >= middle)
    if (left.length === 0 || right.length === 0) return null
    return [at(left, height(left)), at(right, height(right))]
  }

  return {
    crown: {
      x: originX + mid(top.map((v) => v.x + 0.5)) * scale,
      // The top surface rather than the top voxel's middle, so a hat sits on
      // the head instead of sinking half a voxel into it.
      y: (topY + 1) * scale,
      z: originZ + mid(top.map((v) => v.z + 0.5)) * scale,
    },
    // A hand is the bottom of an arm: whatever it is holding hangs from there
    // rather than growing out of the shoulder.
    hands: pair(arms, (side) => Math.min(...side.map((v) => v.y)) * scale),
    // And a foot is the bottom of a leg, which is the ground the pet stands on.
    // A boot drawn from there up encloses the foot rather than floating under
    // it -- and the shader's floor clamp means nothing can sink through anyway.
    feet: pair(legs, () => 0),
    back: {
      x: 0,
      // About where a strap would cross, which is the shoulder if the model
      // has arms to measure one from and its own middle if it has not.
      y: arms.length > 0 ? (Math.max(...arms.map((v) => v.y)) + 1) * scale : (source.h / 2) * scale,
      // The back surface, so a thing slung on it hangs off rather than through.
      z: body.length > 0 ? originZ + Math.min(...body.map((v) => v.z)) * scale : originZ,
    },
    voxel: scale,
  }
}

interface Cell {
  x: number
  y: number
  z: number
}

/** Every voxel belonging to one part of the body. */
function partVoxels(source: VoxelSource, part: number): Cell[] {
  const found: Cell[] = []
  for (let y = 0; y < source.h; y++) {
    for (let z = 0; z < source.d; z++) {
      for (let x = 0; x < source.w; x++) {
        if (source.at(x, y, z)?.part === part) found.push({ x, y, z })
      }
    }
  }
  return found
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

/**
 * Where each piece hangs, which part of the body carries it, and how far it
 * sits from the anchor -- in voxels, so an offset means the same thing on
 * every form.
 *
 * The part is the whole of the animation. Something on the head twists with
 * the look-around, something on an arm counter-swings with the walk, something
 * on a leg pivots from the hip and stays planted. None of that is written
 * anywhere but here.
 */
interface Hangs {
  on: 'crown' | 'hands' | 'feet' | 'back'
  /** Which hand, for the things held in one. Ignored elsewhere. */
  hand?: 0 | 1
  part: number
  /** Shifted from the anchor, in voxels: right, up, and forward. */
  offset?: [number, number, number]
  /**
   * Held clear of the body, in voxels, away from the model's middle -- which
   * is left on the pet's left and right on its right, so one number does for
   * both hands. Something at the end of an arm is at the body's own edge, and
   * anything tall enough to reach the head disappears behind it without this.
   */
  outward?: number
}

const HANGS: Partial<Record<KitId, Hangs>> = {
  // Sunk a voxel so the brim grips. A hat resting exactly on the crown reads
  // as a hat floating over a head.
  hat: { on: 'crown', part: PART_HEAD, offset: [0, -1, 0] },
  // One in each hand, so a wet night does not put them in the same fist.
  umbrella: { on: 'hands', hand: 0, part: PART_ARM },
  torch: { on: 'hands', hand: 1, part: PART_ARM, outward: 1.5 },
  boots: { on: 'feet', part: PART_LEG },
  waders: { on: 'feet', part: PART_LEG },
  // Pushed back by its own depth so it hangs off the back rather than through
  // it, and dropped a little so it rides on the shoulders instead of above.
  basket: { on: 'back', part: PART_BODY, offset: [0, -2, -3] },
}

/** The spots on one creature a piece of kit hangs from. Empty if it has none. */
function spotsFor(anchors: KitAnchors, hangs: Hangs): Anchor[] {
  switch (hangs.on) {
    case 'crown':
      return [anchors.crown]
    case 'back':
      return [anchors.back]
    case 'hands': {
      const hand = anchors.hands?.[hangs.hand ?? 0]
      return hand ? [hand] : []
    }
    case 'feet':
      // Both of them: a pet does not put one boot on.
      return anchors.feet ?? []
  }
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

  // Built of the wearer's own blocks rather than scaled to fit it, so the
  // grain lines up. Nine voxels across is nine voxels across, whatever that
  // form's voxels happen to measure.
  const scale = anchors.voxel
  let merged: VoxelArrays | null = null
  for (const piece of pieces) {
    const hangs = piece.hangs!
    const source = wornSource(piece.model!, hangs.part)
    const [dx, dy, dz] = hangs.offset ?? [0, 0, 0]
    for (const spot of spotsFor(anchors, hangs)) {
      // Away from the middle, whichever side of it this spot is on.
      const out = (hangs.outward ?? 0) * Math.sign(spot.x || 1)
      // Centred on the anchor and standing on it, which is what every one of
      // these wants before its own offset is applied: a hat rises from the
      // crown, a boot from the ground, an umbrella from the hand that holds it.
      const arrays = voxelArrays(source, {
        scale,
        origin: [
          spot.x + (dx + out - source.w / 2) * scale,
          spot.y + dy * scale,
          spot.z + (dz - source.d / 2) * scale,
        ],
      })
      merged = merged ? mergeArrays(merged, arrays) : arrays
    }
  }
  return merged
}

/** The kit this build can actually draw on the pet, for the tests to sweep. */
export const wornKinds = (): KitId[] =>
  (Object.keys(HANGS) as KitId[]).filter((id) => kitById(id) && KIT_MODELS[id])
