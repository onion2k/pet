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
 * An electric torch, which is what the word means here -- not a burning brand.
 * It is held pointing forward and down rather than up, because that is how you
 * carry one and because the beam has somewhere to land.
 *
 * The lens is the only emissive voxel in the whole kit. That alone makes it
 * read after dark and feeds the bloom pass; lighting the ground it is pointed
 * at is a separate job.
 */
const TORCH: VoxelModel = {
  palette: { t: '#4a5568', g: '#2f3646', l: '#fff3c4' },
  emissive: ['l'],
  mirror: true,
  layers: [
    rows(`
      ..
      .g
      .t
      .t
      .l`),
    rows(`
      .t
      tt
      tt
      tt
      ll`),
    rows(`
      ..
      .g
      .t
      .t
      .l`),
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

/**
 * Kit as it stands in the yard rather than on the pet.
 *
 * Two of them are better off leaning by the door than carried. A snowboard is
 * bigger than the pet and cannot be held convincingly, and it has no worn form
 * at all -- so on a snowy day it stands ready by the shelter, which is the
 * whole of what it has to say. And the umbrella is furled when it is not up:
 * one object that moves with the weather, in the pet's hand when it is wet and
 * against the wall when it is not, so the yard says which without a word.
 *
 * These carry their own world height, since they stand on the ground rather
 * than on a creature and have nothing to take a voxel size from.
 */
const SNOWBOARD_STANDING: VoxelModel = {
  palette: { b: '#5fd0e8', d: '#3fa8bf', s: '#2b3a52' },
  mirror: true,
  layers: [
    // Tail, then the length of it, then a nose. The two dark bands are the
    // bindings, which is what stops it reading as a surfboard.
    rows(`
      ...
      .db
      ...`),
    rows(`
      .db
      .bb
      .db`),
    rows(`
      .db
      .bb
      .db`),
    rows(`
      .ds
      .ss
      .ds`),
    rows(`
      .db
      .bb
      .db`),
    rows(`
      .ds
      .ss
      .ds`),
    rows(`
      .db
      .bb
      .db`),
    rows(`
      .db
      .bb
      .db`),
    rows(`
      ...
      .db
      ...`),
  ],
}

const FURLED_UMBRELLA: VoxelModel = {
  palette: { u: '#4f7fc4', h: '#5b4636' },
  mirror: true,
  layers: [
    rows(`
      ..h
      ...`),
    rows(`
      ..h
      ...`),
    rows(`
      ..u
      ...`),
    rows(`
      .uu
      ...`),
    rows(`
      .uu
      ...`),
    rows(`
      .uu
      ...`),
    rows(`
      ..u
      ...`),
    rows(`
      ..h
      ...`),
  ],
}

/** What stands in the yard, and how tall it stands. */
export const KIT_STANDING: Partial<Record<KitId, { model: VoxelModel; height: number }>> = {
  // Taller than the pet, which is the point: it is not a thing to be carried.
  snowboard: { model: SNOWBOARD_STANDING, height: 1.15 },
  umbrella: { model: FURLED_UMBRELLA, height: 0.9 },
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
