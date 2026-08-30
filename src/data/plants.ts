import { rows, type VoxelModel } from './voxel-format'

/**
 * Things the pet brings home as a seed and that then live in the yard.
 *
 * Everything else in the world is either scenery stamped into the terrain when
 * the pet changes, or a visitor rolled fresh each world day. A planting is
 * neither: it is put somewhere on purpose, it grows, and it outlives the pet
 * that carried the seed back. It is the one way the yard ends up being about
 * the family rather than about the seed the terrain was built from.
 */

export type PlantId = 'sapling' | 'bramble' | 'moonflower'

export interface GrowthStage {
  model: VoxelModel
  /** World height the model is scaled to. */
  height: number
}

export interface Plant {
  id: PlantId
  /** What the pet is said to have brought back. */
  seedName: string
  /** What it is once it is grown, for the ticker. */
  name: string
  /** Smallest first. The last is full grown. */
  stages: GrowthStage[]
}

const SPROUT: VoxelModel = {
  palette: { g: '#7ac74f' },
  layers: [
    rows(`
      ...
      .g.
      ...`),
  ],
}

const sapling: Plant = {
  id: 'sapling',
  seedName: 'a hard little seed',
  name: 'a young tree',
  stages: [
    { model: SPROUT, height: 0.16 },
    {
      height: 0.62,
      model: {
        palette: { t: '#8a6141', g: '#5fae43' },
        layers: [
          rows(`
            ...
            .t.
            ...`),
          rows(`
            .g.
            ggg
            .g.`),
        ],
      },
    },
    {
      height: 1.45,
      model: {
        palette: { t: '#8a6141', g: '#4f9e3a', d: '#3f8f2f' },
        layers: [
          rows(`
            .....
            ..t..
            .....`),
          rows(`
            .....
            ..t..
            .....`),
          rows(`
            .ggg.
            ggtgg
            .ggg.`),
          rows(`
            .ddd.
            ddddd
            .ddd.`),
          rows(`
            .....
            .ddd.
            .....`),
        ],
      },
    },
  ],
}

const bramble: Plant = {
  id: 'bramble',
  seedName: 'a bramble cutting',
  name: 'a bramble',
  stages: [
    { model: SPROUT, height: 0.16 },
    {
      height: 0.4,
      model: {
        palette: { g: '#4a7f38' },
        layers: [
          rows(`
            .g.
            ggg
            .g.`),
        ],
      },
    },
    {
      height: 0.72,
      model: {
        palette: { g: '#4a7f38', d: '#3c6b2d', b: '#7a2f5e' },
        layers: [
          rows(`
            .ggg.
            ggggg
            .ggg.`),
          rows(`
            .d.d.
            dbgbd
            .d.d.`),
        ],
      },
    },
  ],
}

const moonflower: Plant = {
  id: 'moonflower',
  seedName: 'a pale seed',
  name: 'a moonflower',
  stages: [
    { model: SPROUT, height: 0.16 },
    {
      height: 0.44,
      model: {
        palette: { g: '#5a8f6a' },
        layers: [rows(`.g.`), rows(`.g.`)],
      },
    },
    {
      height: 0.8,
      model: {
        // The one planting that makes its own light, so a yard with one in it
        // is worth looking at after dark.
        palette: { g: '#5a8f6a', p: '#dfe7ff', w: '#fff6c9' },
        emissive: ['w'],
        layers: [
          rows(`
            ...
            .g.
            ...`),
          rows(`
            ...
            .g.
            ...`),
          rows(`
            .p.
            pwp
            .p.`),
        ],
      },
    },
  ],
}

export const PLANTS: Plant[] = [sapling, bramble, moonflower]

export const plantById = (id: PlantId): Plant | undefined => PLANTS.find((p) => p.id === id)

/** How many growth stages every plant has. They all grow at the same pace. */
export const GROWTH_STAGES = 3
