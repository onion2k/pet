import { rows, type VoxelModel } from './voxel-format'
import type { KitId } from './kit'

/**
 * What a piece of kit looks like on the pet.
 *
 * Authored on the same grid the creatures are, and mirrored the same way -- a
 * row is the left half plus the centre column -- because a hat is as
 * symmetrical as the head it goes on. Layers run bottom to top.
 *
 * These are drawn at whatever size the wearer's own voxels are, so a hat is
 * built of the blocks the head is built of and its grain lines up. That is not
 * quite the same as being the same size on everyone: the forms are normalised
 * to one world height but are not all the same number of voxels tall, so a
 * voxel is a shade bigger on a shorter creature and its hat is too. It is the
 * same hat either way -- nine voxels across, whatever nine voxels comes to --
 * rather than one scaled to the head, which would stop reading as a thing the
 * pet is carrying and start reading as a marking it was born with.
 */

const BOBBLE_HAT: VoxelModel = {
  palette: { b: '#c94f3f', c: '#e2604f', w: '#f4ece0' },
  mirror: true,
  layers: [
    // A brim wider than the head it goes on, so the thing grips rather than
    // perches. Narrower than this and it reads as a party hat.
    rows(`
      ...bb
      ..bbb
      .bbbb
      bbbbb
      bbbbb
      bbbbb
      .bbbb
      ..bbb
      ...bb`),
    rows(`
      .....
      ...cc
      ..ccc
      .cccc
      .cccc
      .cccc
      ..ccc
      ...cc
      .....`),
    rows(`
      .....
      .....
      ...cc
      ..ccc
      ..ccc
      ..ccc
      ...cc
      .....
      .....`),
    // And the bobble, which is the whole reason it is this hat and not a cap.
    rows(`
      .....
      .....
      .....
      ....w
      ...ww
      ....w
      .....
      .....
      .....`),
  ],
}

/**
 * Held up rather than carried: the canopy is most of it, on a handle short
 * enough that the whole thing clears the pet's head from the hand it hangs on.
 */
const UMBRELLA: VoxelModel = {
  palette: { u: '#6f9ee8', d: '#4f7fc4', h: '#5b4636' },
  mirror: true,
  layers: [
    // A long handle, because the hand it hangs from is down at the pet's waist
    // and the canopy has to clear its head. Held at this height it reads as an
    // umbrella; any shorter and it is a blue box carried under one arm.
    ...Array.from({ length: 7 }, () =>
      rows(`
        ....
        ....
        ....
        ...h
        ....
        ....
        ....`),
    ),
    // The canopy, scalloped along its rim the way the board's glyph is.
    rows(`
      ....
      ..dd
      .ddd
      dddd
      .ddd
      ..dd
      ....`),
    rows(`
      ....
      ....
      ..uu
      .uuu
      ..uu
      ....
      ....`),
    rows(`
      ....
      ....
      ....
      ...u
      ....
      ....
      ....`),
  ],
}

/**
 * Short, and the only piece of kit that gives off any light of its own. The
 * flame is emissive, which is enough to make it read after dark and to feed
 * the bloom pass; making it actually light the ground is its own job.
 */
const TORCH: VoxelModel = {
  palette: { t: '#5b4636', r: '#8a6242', f: '#ffb03a' },
  emissive: ['f'],
  mirror: true,
  layers: [
    rows(`
      ...
      ..t
      ...`),
    rows(`
      ...
      ..t
      ...`),
    rows(`
      ...
      ..r
      ...`),
    rows(`
      ..f
      .ff
      ..f`),
    rows(`
      ...
      ..f
      ...`),
  ],
}

/**
 * A pair, drawn once at each foot. The sole runs forward of the ankle so the
 * thing reads as a boot with a toe rather than as a block round the leg.
 */
const BOOTS: VoxelModel = {
  palette: { b: '#8a6242', s: '#5b4636' },
  mirror: true,
  layers: [
    rows(`
      ..
      ss
      ss
      ss
      ss`),
    rows(`
      ..
      ..
      bb
      bb
      bb`),
    rows(`
      ..
      ..
      bb
      bb
      ..`),
  ],
}

/** The same last, pulled up the leg: what a boot is when it means business. */
const WADERS: VoxelModel = {
  palette: { w: '#4f8f6a', s: '#3a6b50' },
  mirror: true,
  layers: [
    rows(`
      ..
      ss
      ss
      ss
      ss`),
    rows(`
      ..
      ..
      ww
      ww
      ww`),
    rows(`
      ..
      ..
      ww
      ww
      ..`),
    rows(`
      ..
      ..
      ww
      ww
      ..`),
    rows(`
      ..
      ..
      ww
      ww
      ..`),
  ],
}

/** Slung on the back, with a lid, and woven like the one on the board. */
const BASKET: VoxelModel = {
  palette: { k: '#c69a5a', d: '#a97f43' },
  mirror: true,
  layers: [
    rows(`
      .dd
      ddd
      .dd`),
    rows(`
      .kk
      k.k
      .kk`),
    rows(`
      .kk
      k.k
      .kk`),
    rows(`
      .dd
      ddd
      .dd`),
  ],
}

/** Only the kit that has a picture yet. The rest is drawn on the board alone. */
export const KIT_MODELS: Partial<Record<KitId, VoxelModel>> = {
  hat: BOBBLE_HAT,
  umbrella: UMBRELLA,
  torch: TORCH,
  boots: BOOTS,
  waders: WADERS,
  basket: BASKET,
}
