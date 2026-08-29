import { rows, type VoxelModel } from './voxel-format'

/**
 * Things the yard accumulates. Visitors come and go with the seasons; these
 * stay, so the meadow slowly becomes a record of what has happened in it
 * rather than a backdrop that resets.
 *
 * Colours come from the curio each one stands for, so one shape serves for all
 * of them and nothing has to be authored twice.
 */
export interface Keepsake {
  model: VoxelModel
  height: number
}

const PALETTE = { a: '#ffffff', b: '#b0b0b0' }

/** A found curio, set out on a little plinth. */
export const TRINKET: Keepsake = {
  height: 0.34,
  model: {
    palette: PALETTE,
    layers: [
      rows(`
        .bbb.
        bbbbb
        bbbbb
        bbbbb
        .bbb.`),
      rows(`
        .....
        ..a..
        .aaa.
        ..a..
        .....`),
      rows(`
        .....
        .....
        ..a..
        .....
        .....`),
    ],
  },
}
