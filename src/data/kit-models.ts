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

/** Only the kit that has a picture yet. The rest is drawn on the board alone. */
export const KIT_MODELS: Partial<Record<KitId, VoxelModel>> = {
  hat: BOBBLE_HAT,
}
