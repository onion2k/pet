import type { VoxelModel } from '../data/voxel-format'
import { hexToLinear, modelSource, PART_HEAD, type VoxelArrays } from './voxel-mesh'

/**
 * Where a creature's face is, worked out from its own voxels rather than
 * written down per species. The eyes of every pet are its darkest voxels, set
 * in the front of its head, so they can be found by looking rather than by
 * keeping a table of twelve faces in step with twelve models.
 */
export interface FaceAnchors {
  /** Eye centres in model space, sitting just proud of the face. */
  eyes: [Anchor, Anchor]
  /** Width and height of one eye, in world units. */
  eyeSize: { w: number; h: number }
  /** Just below and between the eyes, on the same plane. */
  mouth: Anchor
  /** World size of one voxel, so the overlay can match the model's grain. */
  voxel: number
  /** The head's own colour beside the eye, for painting the old eye out. */
  skin: [number, number, number]
  /** The muzzle the model paints between the eyes, if it has one. */
  nose: NoseAnchor | null
}

export interface NoseAnchor {
  x: number
  y: number
  z: number
  /** Half-extent of the painted nose, in world units. */
  halfW: number
  halfH: number
  colour: [number, number, number]
}

export interface Anchor {
  x: number
  y: number
  z: number
}

const luma = (c: [number, number, number]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

/** Null for anything faceless, which is to say the egg. */
export function faceAnchors(model: VoxelModel, targetHeight: number): FaceAnchors | null {
  const source = modelSource(model)
  const scale = targetHeight / source.h
  const originX = (-source.w / 2) * scale
  const originZ = (-source.d / 2) * scale
  // Eyes are up in the head, never down in the feet.
  const from = Math.floor(source.h * 0.45)

  let darkest = Infinity
  for (let y = from; y < source.h; y++) {
    for (let z = 0; z < source.d; z++) {
      for (let x = 0; x < source.w; x++) {
        const voxel = source.at(x, y, z)
        if (!voxel) continue
        darkest = Math.min(darkest, luma(voxel.color))
      }
    }
  }
  // Eyes are near-black. Anything lighter is just the creature's own colouring,
  // which is how the egg -- which has no face at all -- opts itself out.
  if (!Number.isFinite(darkest) || darkest > 0.05) return null

  // Everything sharing that darkest colour, and only what shows on the front.
  const found: { x: number; y: number; z: number }[] = []
  let frontZ = -1
  for (let y = from; y < source.h; y++) {
    for (let z = 0; z < source.d; z++) {
      for (let x = 0; x < source.w; x++) {
        const voxel = source.at(x, y, z)
        if (!voxel || Math.abs(luma(voxel.color) - darkest) > 1e-6) continue
        found.push({ x, y, z })
        frontZ = Math.max(frontZ, z)
      }
    }
  }
  const face = found.filter((v) => v.z === frontZ)
  if (face.length < 2) return null

  // Split into a left eye and a right eye about the model's middle.
  const middle = source.w / 2
  const left = face.filter((v) => v.x + 0.5 < middle)
  const right = face.filter((v) => v.x + 0.5 >= middle)
  if (!left.length || !right.length) return null

  const centre = (group: typeof face): Anchor => {
    let sx = 0
    let sy = 0
    for (const v of group) {
      sx += v.x + 0.5
      sy += v.y + 0.5
    }
    return {
      x: originX + (sx / group.length) * scale,
      y: (sy / group.length) * scale,
      // A quarter of a voxel proud of the face. Any less and the depth buffer
      // cannot separate the two at this range: at 0.02 of a voxel the eyes and
      // mouth came out striped with z-fighting against the head behind them.
      z: originZ + (frontZ + 1.25) * scale,
    }
  }

  const span = (group: typeof face, key: 'x' | 'y'): number => {
    const values = group.map((v) => v[key])
    return (Math.max(...values) - Math.min(...values) + 1) * scale
  }

  const eyeLeft = centre(left)
  const eyeRight = centre(right)

  // The head's colour next to the eye. The painted eye is covered over with
  // this, which is what frees the drawn eye from having to sit exactly where
  // the model put it, at exactly the size the model made it.
  const sample = left[0]!
  let skin: [number, number, number] | null = null
  for (const [dx, dy] of [
    [0, 1],
    [0, 2],
    [-1, 0],
    [1, 0],
    [0, -1],
  ] as const) {
    const voxel = source.at(sample.x + dx, sample.y + dy, frontZ)
    if (voxel && luma(voxel.color) > darkest + 0.01) {
      skin = voxel.color
      break
    }
  }

  const resolvedSkin = skin ?? [0.5, 0.5, 0.5]

  // The nose: a small run of front-face voxels just below the eyes, straddling
  // the middle. Candidates are grouped by colour first, because a model's
  // secondary shading colour also sits below the eyes and is also "not skin" --
  // ungrouped, a whole band of belly shading reads as an enormous muzzle.
  const eyeRowY = Math.min(...left.map((v) => v.y))
  const skinLuma = luma(resolvedSkin)
  const groups = new Map<string, { xs: number[]; ys: number[]; colour: [number, number, number] }>()
  for (let y = Math.max(0, eyeRowY - 3); y < eyeRowY; y++) {
    for (let x = 0; x < source.w; x++) {
      const voxel = source.at(x, y, frontZ)
      if (!voxel) continue
      const l = luma(voxel.color)
      if (Math.abs(l - darkest) < 1e-6 || Math.abs(l - skinLuma) < 1e-6) continue
      const key = voxel.color.join(',')
      const group = groups.get(key) ?? { xs: [], ys: [], colour: voxel.color }
      group.xs.push(x + 0.5)
      group.ys.push(y)
      groups.set(key, group)
    }
  }

  const middleX = source.w / 2
  let nose: NoseAnchor | null = null
  let bestRow = -1
  for (const group of groups.values()) {
    const minX = Math.min(...group.xs)
    const maxX = Math.max(...group.xs)
    // A muzzle straddles the middle and is a few voxels across. A band of
    // shading spans most of the body and is thrown out here.
    if (minX >= middleX || maxX <= middleX || maxX - minX > 4) continue
    const minY = Math.min(...group.ys)
    const maxY = Math.max(...group.ys)
    // And it sits right under the eyes. Further down the body it is a marking
    // of some other kind, not a muzzle.
    if (eyeRowY - maxY > 2) continue
    if (maxY <= bestRow) continue
    bestRow = maxY
    nose = {
      x: originX + ((minX + maxX) / 2) * scale,
      y: ((minY + maxY) / 2 + 0.5) * scale,
      z: originZ + (frontZ + 1.25) * scale,
      halfW: ((maxX - minX) / 2 + 0.5) * scale,
      halfH: ((maxY - minY) / 2 + 0.5) * scale,
      colour: group.colour,
    }
  }

  return {
    nose,
    skin: resolvedSkin,
    eyes: [eyeLeft, eyeRight],
    eyeSize: { w: span(left, 'x'), h: span(left, 'y') },
    mouth: mouthAnchor(
      source,
      (eyeLeft.x + eyeRight.x) / 2,
      (eyeLeft.y + eyeRight.y) / 2 - span(left, 'y') * 1.5,
      scale,
      originZ,
    ),
    voxel: scale,
  }
}

/**
 * The mouth sits well below the eyes, and by then the body may have bulged out
 * in front of the face -- on a creature with a chest, a mouth left on the eyes'
 * own depth plane is simply buried inside it. So the front is measured again at
 * the mouth's own height.
 */
function mouthAnchor(
  source: ReturnType<typeof modelSource>,
  x: number,
  y: number,
  scale: number,
  originZ: number,
): Anchor {
  const vy = Math.max(0, Math.min(source.h - 1, Math.floor(y / scale)))
  const middle = Math.floor(source.w / 2)
  let frontZ = -1
  // Only the columns the mouth actually spans, so a distant shoulder or a wing
  // cannot drag it forward.
  for (let dx = -1; dx <= 1; dx++) {
    const vx = middle + dx
    for (let z = source.d - 1; z >= 0; z--) {
      if (source.at(vx, vy, z)) {
        frontZ = Math.max(frontZ, z)
        break
      }
    }
  }
  if (frontZ < 0) frontZ = source.d - 1
  return { x, y, z: originZ + (frontZ + 1.25) * scale }
}

/** What a face vertex belongs to, matching the constants in the pet's shader. */
export const FACE_NONE = 0
export const FACE_SCLERA = 1
export const FACE_PUPIL = 2
export const FACE_MOUTH = 3
export const FACE_BROW = 4

/** The extra per-vertex channels the face needs on top of the usual voxel ones. */
export interface FaceArrays {
  kind: number[]
  /** Offset of this vertex from the centre of its own feature. */
  local: number[]
  /** Per-feature parameter: position across the mouth, or which brow this is. */
  param: number[]
}

export interface FaceBuild {
  arrays: VoxelArrays
  face: FaceArrays
  /** How far a pupil may travel from the middle of its eye. */
  gazeRange: number
  /** Half the mouth's width, for curving it. */
  mouthHalf: number
  browLift: number
}

const SCLERA = hexToLinear('#fbf7ef')
const INK = hexToLinear('#100e18')

/**
 * The face is built into the pet's own mesh rather than laid over it. The pet's
 * vertex shader bends the whole body -- it stretches, settles, twists, bobs
 * through a walk cycle and hops -- and a face on a separate mesh would have to
 * repeat every one of those exactly or slide off the head. Sharing the mesh
 * means it simply cannot come adrift.
 */
export function buildFace(anchors: FaceAnchors): FaceBuild {
  const position: number[] = []
  const normal: number[] = []
  const color: number[] = []
  const ao: number[] = []
  const part: number[] = []
  const emissive: number[] = []
  const material: number[] = []
  const kind: number[] = []
  const local: number[] = []
  const param: number[] = []
  let faces = 0

  /** One forward-facing quad, recorded with each vertex's offset from its centre. */
  const quad = (
    cx: number,
    cy: number,
    cz: number,
    hw: number,
    hh: number,
    rgb: [number, number, number],
    featureKind: number,
    featureParam: number,
  ): void => {
    const corners: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]
    for (const [dx, dy] of corners) {
      position.push(cx + dx, cy + dy, cz)
      normal.push(0, 0, 1)
      color.push(rgb[0], rgb[1], rgb[2])
      ao.push(1)
      part.push(PART_HEAD)
      emissive.push(0)
      material.push(0)
      kind.push(featureKind)
      local.push(dx, dy, 0)
      param.push(featureParam)
    }
    faces++
  }

  /**
   * A filled ellipse, as a fan. Recorded exactly like a quad -- each vertex
   * keeps its offset from the centre -- so the shader blinks and steers these
   * without knowing they are round.
   */
  const disc = (
    cx: number,
    cy: number,
    cz: number,
    hw: number,
    hh: number,
    rgb: [number, number, number],
    featureKind: number,
    featureParam: number,
  ): void => {
    const SEGMENTS = 16
    const push = (dx: number, dy: number): void => {
      position.push(cx + dx, cy + dy, cz)
      normal.push(0, 0, 1)
      color.push(rgb[0], rgb[1], rgb[2])
      ao.push(1)
      part.push(PART_HEAD)
      emissive.push(0)
      material.push(0)
      kind.push(featureKind)
      local.push(dx, dy, 0)
      param.push(featureParam)
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2
      const b = ((i + 1) / SEGMENTS) * Math.PI * 2
      push(0, 0)
      push(Math.cos(a) * hw, Math.sin(a) * hh)
      push(Math.cos(b) * hw, Math.sin(b) * hh)
      faces++
    }
  }

  const nose = anchors.nose
  if (nose) {
    // The painted muzzle is covered over and redrawn smaller, the same trick
    // the eyes use. A big blunt nose is the least cute thing on the face.
    quad(nose.x, nose.y, nose.z, nose.halfW * 1.25, nose.halfH * 1.4, anchors.skin, FACE_NONE, 0)
    disc(
      nose.x,
      nose.y,
      nose.z + anchors.voxel * 0.06,
      nose.halfW * 0.52,
      nose.halfH * 0.62,
      nose.colour,
      FACE_NONE,
      0,
    )
  }

  const [left, right] = anchors.eyes
  const eyeHalfW = anchors.eyeSize.w / 2
  const eyeHalfH = anchors.eyeSize.h / 2
  // Drawn a good deal smaller than the eye the model painted, and set closer
  // in. Both are only possible because the painted eye is covered over first:
  // while the drawn eye had to hide the old one, it could never be smaller
  // than it, nor sit anywhere but on top of it.
  // Round, so one radius rather than two: a painted eye is not always square,
  // and taking the smaller side keeps the circle inside the patch that hides it.
  const eyeR = Math.min(eyeHalfW, eyeHalfH) * 0.96
  const scleraW = eyeR
  const scleraH = eyeR
  const pupilW = eyeR * 0.52
  const pupilH = eyeR * 0.52
  const inset = 0.72

  for (const eye of [left, right]) {
    const x = eye.x * inset
    // The old eye, painted out in the head's own colour.
    quad(eye.x, eye.y, eye.z, eyeHalfW * 1.3, eyeHalfH * 1.3, anchors.skin, FACE_NONE, 0)
    // A dark rim behind the white. Several of these creatures are near-white
    // themselves -- a pale sclera on a pale head simply disappears, and the eye
    // reads as nothing but its pupil. The rim gives it an edge on any body.
    disc(x, eye.y, eye.z + anchors.voxel * 0.06, scleraW * 1.22, scleraH * 1.22, INK, FACE_SCLERA, 0)
    disc(x, eye.y, eye.z + anchors.voxel * 0.12, scleraW, scleraH, SCLERA, FACE_SCLERA, 0)
    // Pupils sit a hair proud of the whites, so they are never z-fought by them.
    disc(x, eye.y, eye.z + anchors.voxel * 0.2, pupilW, pupilH, INK, FACE_PUPIL, 0)
  }

  // The mouth is a run of small blocks, curved by the shader into a smile or a
  // frown. Segments rather than one quad, because a single quad cannot bend.
  const MOUTH_SEGMENTS = 7
  const mouthHalf = Math.abs(right.x - left.x) * inset * 0.34
  const segHalf = mouthHalf / MOUTH_SEGMENTS
  for (let i = 0; i < MOUTH_SEGMENTS; i++) {
    const t = (i / (MOUTH_SEGMENTS - 1)) * 2 - 1
    quad(
      anchors.mouth.x + t * mouthHalf,
      anchors.mouth.y,
      anchors.mouth.z,
      segHalf * 1.1,
      anchors.voxel * 0.3,
      INK,
      FACE_MOUTH,
      t,
    )
  }

  // Brows. Small, but they carry more of a mood than anything else on a face.
  const browLift = anchors.voxel * 0.5
  for (const [eye, side] of [
    [left, -1],
    [right, 1],
  ] as const) {
    quad(
      eye.x * inset,
      eye.y + scleraH + anchors.voxel * 0.62,
      eye.z + anchors.voxel * 0.12,
      scleraW * 1.15,
      anchors.voxel * 0.14,
      INK,
      FACE_BROW,
      side,
    )
  }

  return {
    arrays: { position, normal, color, ao, part, emissive, material, faces },
    face: { kind, local, param },
    gazeRange: (scleraW - pupilW) * 0.85,
    mouthHalf,
    browLift,
  }
}
