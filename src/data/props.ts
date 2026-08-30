import { rows, type VoxelModel } from './voxel-format'

/**
 * Scenery stamped into the terrain's voxel field. Because they share the field
 * with the ground, props get hidden-face culling and corner occlusion against
 * it — a rock sitting in the grass picks up real contact shading.
 *
 * Palette characters are placeholders resolved against the biome at build time:
 *   s / t  stone, dark and light      f / e  foliage, dark and light
 *   w      stem, twig or wall         p      flower
 *   r      roof                       n      shaded interior
 */
export interface Prop {
  id: string
  model: VoxelModel
  /** Relative likelihood when scattering. */
  weight: number
  /** Columns of clear ground needed around the stamp. */
  spacing: number
}

const palette = {
  s: '#000001',
  t: '#000002',
  f: '#000003',
  e: '#000004',
  w: '#000005',
  p: '#000006',
  r: '#000007',
  n: '#000008',
  l: '#000009',
  g: '#00000a',
}

/** Order matters: the resolver maps these characters onto biome colours. */
export const PROP_KEYS = ['s', 't', 'f', 'e', 'w', 'p', 'r', 'n', 'l', 'g'] as const
export type PropKey = (typeof PROP_KEYS)[number]

/**
 * Ground cover that turns up wherever the pet lives -- a stone is a stone.
 * Biomes are told apart by what stands up out of the grass, not by what lies
 * about in it, so these are shared and the tall things are not.
 */
const GROUND_COVER: Prop[] = [
  {
    id: 'pebble',
    weight: 26,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          .s.
          sss
          .s.`),
        rows(`
          ...
          .t.
          ...`),
      ],
    },
  },
  {
    id: 'rock',
    weight: 18,
    spacing: 3,
    model: {
      palette,
      layers: [
        rows(`
          .sss.
          sssss
          sssss
          ssss.
          .ss..`),
        rows(`
          ..ss.
          .ssss
          sssss
          .sss.
          .....`),
        rows(`
          .....
          ..tt.
          .ttt.
          ..t..
          .....`),
      ],
    },
  },
  {
    id: 'boulder',
    weight: 8,
    spacing: 4,
    model: {
      palette,
      layers: [
        rows(`
          .sss.
          sssss
          sssss
          sssss
          .sss.`),
        rows(`
          .sss.
          sssss
          sssss
          sssss
          .sss.`),
        rows(`
          ..s..
          .sss.
          sstss
          .sss.
          ..s..`),
        rows(`
          .....
          ..t..
          .ttt.
          ..t..
          .....`),
      ],
    },
  },
  {
    id: 'tuft',
    weight: 34,
    spacing: 1,
    model: {
      palette,
      layers: [
        rows(`
          .f.
          fff
          .f.`),
        rows(`
          ...
          e.e
          ...`),
        rows(`
          ...
          .e.
          ...`),
      ],
    },
  },
  {
    id: 'fern',
    weight: 16,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          ...
          .w.
          ...`),
        rows(`
          .f.
          fff
          .f.`),
        rows(`
          e.e
          .f.
          e.e`),
        rows(`
          ...
          .e.
          ...`),
      ],
    },
  },
]

/** What stands up out of the meadow: low, open, and mostly flowering. */
const MEADOW_ONLY: Prop[] = [
  {
    id: 'shrub',
    weight: 14,
    spacing: 3,
    model: {
      palette,
      layers: [
        rows(`
          .....
          ..w..
          .www.
          ..w..
          .....`),
        rows(`
          ..f..
          .fff.
          fffff
          .fff.
          ..f..`),
        rows(`
          .....
          .fef.
          feeef
          .fef.
          .....`),
        rows(`
          .....
          ..e..
          .eee.
          ..e..
          .....`),
      ],
    },
  },
  {
    id: 'bloom',
    weight: 12,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          ...
          .w.
          ...`),
        rows(`
          ...
          .w.
          ...`),
        rows(`
          .p.
          ppp
          .p.`),
        rows(`
          ...
          .p.
          ...`),
      ],
    },
  },
]

/**
 * What stands up out of a wood: trunks, and what grows in their shade. Taller
 * and denser than the meadow's, which is most of why the two read as different
 * places from the same terrain generator.
 */
const WOODLAND_ONLY: Prop[] = [
  {
    id: 'trunk',
    weight: 22,
    spacing: 4,
    model: {
      palette,
      layers: [
        rows(`
          .....
          .www.
          .www.
          .www.
          .....`),
        rows(`
          .....
          ..w..
          .www.
          ..w..
          .....`),
        rows(`
          .....
          ..w..
          ..w..
          ..w..
          .....`),
        rows(`
          .....
          ..w..
          ..w..
          ..w..
          .....`),
        rows(`
          ..f..
          .fff.
          fffff
          .fff.
          ..f..`),
        rows(`
          .fff.
          fffff
          fffff
          fffff
          .fff.`),
        rows(`
          .....
          .fef.
          feeef
          .fef.
          .....`),
        rows(`
          .....
          ..e..
          .eee.
          ..e..
          .....`),
      ],
    },
  },
  {
    id: 'stump',
    weight: 14,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          .www.
          wwwww
          wwwww
          wwwww
          .www.`),
        rows(`
          .www.
          wwwww
          wwnww
          wwwww
          .www.`),
        rows(`
          .....
          .wnw.
          .nnn.
          .wnw.
          .....`),
      ],
    },
  },
  {
    id: 'bracken',
    weight: 26,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          .f.
          fff
          .f.`),
        rows(`
          f.f
          .f.
          f.f`),
        rows(`
          e.e
          .e.
          e.e`),
        rows(`
          ...
          .e.
          ...`),
      ],
    },
  },
  {
    id: 'toadstools',
    weight: 12,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          ...
          w.w
          ...`),
        rows(`
          .p.
          ppp
          .p.`),
        rows(`
          ...
          .p.
          ...`),
      ],
    },
  },
]

/** The meadow's scatter pool: ground cover, plus what the meadow grows. */
export const MEADOW_PROPS: Prop[] = [...GROUND_COVER, ...MEADOW_ONLY]

/** The wood's. */
export const WOODLAND_PROPS: Prop[] = [...GROUND_COVER, ...WOODLAND_ONLY]

/** Every scatterable prop in the world, for the tests that check them all. */
export const PROPS: Prop[] = [...GROUND_COVER, ...MEADOW_ONLY, ...WOODLAND_ONLY]

/**
 * The pet's shelter. Placed at a fixed spot rather than scattered, on ground
 * levelled for it, with the front left open so the pet stays visible inside.
 * Thirteen columns wide and eleven deep, with an eleven-voxel interior — tall
 * enough for the pet to stand up in. The roof is kept to two steps so its ridge
 * stays clear of the screen's upper icon strip.
 */
/**
 * The lantern that stands outside the shelter. Its glass is emissive, so it
 * both glows and casts a small point light once the sun is down -- the yard
 * stays legible at night without the night having to be lit like day.
 */
export const LANTERN: Prop = {
  id: 'lantern',
  weight: 0,
  spacing: 1,
  model: {
    palette,
    layers: [
      // Post.
      ...Array.from({ length: 5 }, () => ['...', '.l.', '...']),
      // Glass.
      rows(`
        lgl
        ggg
        lgl`),
      rows(`
        lgl
        ggg
        lgl`),
      // Cap.
      rows(`
        lll
        lll
        lll`),
      ['...', '.l.', '...'],
    ],
  },
}

export const SHELTER: Prop = {
  id: 'shelter',
  weight: 0,
  spacing: 1,
  model: {
    palette,
    mirror: true,
    layers: [
      // Walls: a solid back, two sides, and an open front.
      ...Array.from({ length: 11 }, () => [
        'wwwwwww',
        'w......',
        'w......',
        'w......',
        'w......',
        'w......',
        'w......',
        'w......',
        'w......',
        'w......',
        'w......',
      ]),
      // Roof, stepped inward.
      [
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
        'rrrrrrr',
      ],
      [
        '.......',
        '.rrrrrr',
        '.rrrrrr',
        '.rrrrrr',
        '.rrrrrr',
        '.rrrrrr',
        '.rrrrrr',
        '.rrrrrr',
        '.rrrrrr',
        '.rrrrrr',
        '.......',
      ],
    ],
  },
}
