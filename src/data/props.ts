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
 * What lies about on the ground wherever the pet lives -- a stone is a stone,
 * on a beach or a hilltop or a village green. Biomes are told apart by what
 * stands up out of the ground, not by what lies about on it.
 */
const STONES: Prop[] = [
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
]

/**
 * Grass, and what grows in it. Shared by the places that have any -- which is
 * not a beach, and not much of a hilltop.
 */
const GRASS: Prop[] = [
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


/**
 * A beach: nothing that needs soil. Marram holds the dunes together, the sea
 * leaves the rest. No grass and no ferns, which is most of why the ground reads
 * as sand even before the colours say so.
 */
const BEACH_ONLY: Prop[] = [
  {
    id: 'marram',
    weight: 30,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          ...
          .f.
          ...`),
        rows(`
          f.f
          .f.
          f.f`),
        rows(`
          e.e
          ...
          e.e`),
      ],
    },
  },
  {
    id: 'driftwood',
    weight: 22,
    spacing: 3,
    model: {
      palette,
      layers: [
        rows(`
          .....
          wwwww
          .ww..
          .....
          .....`),
        rows(`
          .....
          ..w..
          .....
          .....
          .....`),
      ],
    },
  },
  {
    id: 'shell',
    weight: 34,
    spacing: 1,
    model: {
      palette,
      layers: [
        rows(`
          .t.
          ttt
          .t.`),
        rows(`
          ...
          .t.
          ...`),
      ],
    },
  },
  {
    id: 'seaweed',
    weight: 16,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          .f.
          fff
          .ff`),
        rows(`
          ...
          .f.
          ...`),
      ],
    },
  },
]

/**
 * A hilltop: bones of rock coming through, and the two things that will grow in
 * the wind. Sparse on purpose -- what makes a hill a hill is how much of it is
 * bare.
 */
const HILL_ONLY: Prop[] = [
  {
    id: 'outcrop',
    weight: 40,
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
          ..ss.
          .ssss
          .ssss
          .sss.
          .....`),
        rows(`
          .....
          ..tt.
          ..tt.
          .....
          .....`),
      ],
    },
  },
  {
    id: 'gorse',
    weight: 30,
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
          .fpf.
          fpppf
          .fpf.
          .....`),
        rows(`
          .....
          ..p..
          .ppp.
          ..p..
          .....`),
      ],
    },
  },
  {
    id: 'cairn',
    weight: 18,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          sss
          sss
          sss`),
        rows(`
          .ss
          sss
          ss.`),
        rows(`
          ...
          .tt
          .t.`),
        rows(`
          ...
          .t.
          ...`),
      ],
    },
  },
  {
    id: 'heath',
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
          .p.
          ...`),
      ],
    },
  },
]

/**
 * A village: the pet's own shelter is still its own shelter, and these are the
 * neighbours. It needs no materials the shelter did not already need -- a roof
 * is a roof -- which is why a village costs a prop set rather than a palette.
 */
const VILLAGE_ONLY: Prop[] = [
  {
    id: 'cottage',
    weight: 26,
    spacing: 4,
    // Tall rather than wide. A wider footprint is rejected more often -- the
    // scatter will not stamp anything across ground that steps -- and height is
    // what actually reads from a camera at the pet's eye level. Four courses of
    // wall put the eaves well above the hedges, which is the difference between
    // a village and a green with sheds on it.
    model: {
      palette,
      layers: [
        rows(`
          sssss
          sssss
          sssss
          sssss
          sssss`),
        rows(`
          wwwww
          wnnnw
          wnnnw
          wnnnw
          wwwww`),
        rows(`
          wwnww
          wnnnw
          wnnnw
          wnnnw
          wwnww`),
        rows(`
          wwwww
          wnnnw
          wnnnw
          wnnnw
          wwwww`),
        rows(`
          wwwww
          wnnnw
          wnnnw
          wnnnw
          wwwww`),
        rows(`
          rrrrr
          rrrrr
          rrrrr
          rrrrr
          rrrrr`),
        rows(`
          .rrr.
          rrrrr
          rrrrr
          rrrrr
          .rrr.`),
        rows(`
          .....
          .rrr.
          .rrr.
          .rrr.
          .....`),
        rows(`
          .....
          ..r..
          ..r..
          ..r..
          .....`),
        rows(`
          .....
          ....s
          .....
          .....
          .....`),
      ],
    },
  },
  {
    id: 'drystone',
    weight: 40,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          sss
          sss
          ...`),
        rows(`
          tst
          sts
          ...`),
        rows(`
          .s.
          s.s
          ...`),
      ],
    },
  },
  {
    id: 'well',
    weight: 10,
    spacing: 3,
    model: {
      palette,
      layers: [
        rows(`
          .sss.
          ststs
          stnts
          ststs
          .sss.`),
        rows(`
          .....
          s...s
          s.n.s
          s...s
          .....`),
        rows(`
          .....
          w...w
          .....
          w...w
          .....`),
        rows(`
          .....
          rrrrr
          rrrrr
          rrrrr
          .....`),
      ],
    },
  },
  {
    id: 'hedge',
    weight: 34,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          fff
          fff
          fff`),
        rows(`
          fef
          eee
          fef`),
        rows(`
          .e.
          eee
          .e.`),
      ],
    },
  },
  {
    id: 'paling',
    weight: 26,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          w.w
          ...
          ...`),
        rows(`
          w.w
          ...
          ...`),
        rows(`
          www
          ...
          ...`),
      ],
    },
  },
]

/** The meadow's scatter pool: stones and grass, plus what the meadow grows. */
export const MEADOW_PROPS: Prop[] = [...STONES, ...GRASS, ...MEADOW_ONLY]

/** The wood's. */
export const WOODLAND_PROPS: Prop[] = [...STONES, ...GRASS, ...WOODLAND_ONLY]

/** The beach's. No grass at all: sand does not grow any. */
export const BEACH_PROPS: Prop[] = [...STONES, ...BEACH_ONLY]

/**
 * The same prop, turning up more or less often than it does elsewhere.
 *
 * Weights are relative within a pool, so how much loose stone and grass a place
 * has is as much a part of its character as what grows there. A village green
 * has had the stones picked off it; a hilltop has less grass than a meadow and
 * more bone showing through. Without this the shared cover outweighs everything
 * distinctive and all five places read as a recoloured meadow.
 */
const asOften = (prop: Prop, weight: number): Prop => ({ ...prop, weight })

const tussock = GRASS.find((p) => p.id === 'tuft')!
const scarce = (pool: Prop[], weight: number) => pool.map((p) => asOften(p, weight))

/** The hill's. Bone showing through, and the two things that grow in wind. */
export const HILL_PROPS: Prop[] = [...STONES, asOften(tussock, 16), ...HILL_ONLY]

/** The village's. Grass, but somebody has picked the stones off the green. */
export const VILLAGE_PROPS: Prop[] = [...scarce(STONES, 6), ...GRASS, ...VILLAGE_ONLY]

/** Every scatterable prop in the world, for the tests that check them all. */
export const PROPS: Prop[] = [
  ...STONES,
  ...GRASS,
  ...MEADOW_ONLY,
  ...WOODLAND_ONLY,
  ...BEACH_ONLY,
  ...HILL_ONLY,
  ...VILLAGE_ONLY,
]

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
