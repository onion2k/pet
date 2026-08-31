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
  /**
   * Whether this thing was built rather than grown, and so brings its own
   * footing: the scatter levels the ground under it instead of refusing the
   * slot for being uneven.
   *
   * Without it nothing large can ever be scattered. The rule that a stamp needs
   * ground level to within one voxel is right for a bush and fatal for a
   * building -- a seven-column footprint almost never finds that much flat
   * ground in open relief, so every attempt at a bigger house came out as a
   * house that was never placed. Somebody putting up a wall digs the ground
   * flat first, which is all this is.
   */
  foundation?: boolean
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
  /**
   * The wood's canopy: a pine and an oak, both of them twice the height of the
   * pet and better than twice the height of what used to stand here.
   *
   * The old wood was eight voxels of trunk-and-blob, which at the camera's
   * eye level topped out about level with the shelter roof -- a wood you look
   * over rather than into. Trees are the one prop where height is the whole of
   * the read: the trunk has to leave the canopy off the top of the frame, so
   * that what the player sees between the branches is more wood behind.
   *
   * They are also the reason the wood scatters on a tighter grid than anywhere
   * else. One of these on its own is a tree; three deep with their crowns
   * overlapping is cover.
   */
  {
    id: 'pine',
    weight: 34,
    spacing: 1,
    model: {
      palette,
      layers: [
        rows(`
          .....
          .....
          ..w..
          .....
          .....`),
        rows(`
          .....
          .....
          ..w..
          .....
          .....`),
        rows(`
          .....
          .....
          ..w..
          .....
          .....`),
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
          .fff.
          fffff
          .fff.
          .....`),
        rows(`
          .....
          ..f..
          .fwf.
          ..f..
          .....`),
        rows(`
          ..e..
          .eee.
          eeeee
          .eee.
          ..e..`),
        rows(`
          .....
          .eff.
          .fff.
          .ffe.
          .....`),
        rows(`
          .....
          ..f..
          .fwf.
          ..f..
          .....`),
        rows(`
          .....
          ..e..
          .eee.
          ..e..
          .....`),
        rows(`
          .....
          ..e..
          .eee.
          ..e..
          .....`),
        rows(`
          .....
          .....
          ..f..
          .....
          .....`),
        rows(`
          .....
          .....
          ..e..
          .....
          .....`),
      ],
    },
  },
  {
    id: 'oak',
    weight: 26,
    spacing: 2,
    model: {
      palette,
      layers: [
        rows(`
          .......
          .......
          ..www..
          ..www..
          ..www..
          .......
          .......`),
        rows(`
          .......
          .......
          ..www..
          ..www..
          ..www..
          .......
          .......`),
        rows(`
          .......
          .......
          ...w...
          ..www..
          ...w...
          .......
          .......`),
        rows(`
          .......
          .......
          ...w...
          ..www..
          ...w...
          .......
          .......`),
        rows(`
          .......
          ...w...
          ..fwf..
          .fwwwf.
          ..fwf..
          ...w...
          .......`),
        rows(`
          ..fff..
          .fffff.
          fffwfff
          fffwfff
          fffwfff
          .fffff.
          ..fff..`),
        rows(`
          ..fef..
          .eefee.
          feeeeef
          feeweef
          feeeeef
          .eefee.
          ..fef..`),
        rows(`
          ..eee..
          .eeeee.
          eeeeeee
          eeeweee
          eeeeeee
          .eeeee.
          ..eee..`),
        rows(`
          ...f...
          ..fff..
          .fffff.
          .fffff.
          .fffff.
          ..fff..
          ...f...`),
        rows(`
          .......
          ..eee..
          .eeeee.
          .eeeee.
          .eeeee.
          ..eee..
          .......`),
        rows(`
          .......
          ...f...
          ..fff..
          ..fff..
          ..fff..
          ...f...
          .......`),
        rows(`
          .......
          .......
          ...e...
          ..eee..
          ...e...
          .......
          .......`),
      ],
    },
  },
  // What is coming up under them. Kept for the floor of the wood, at a fraction
  // of its old weight now that there are grown trees for it to stand beneath.
  {
    id: 'sapling',
    weight: 14,
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
  /**
   * The village is the one place with buildings in it, so the buildings have
   * to be worth walking to. Both of these are stone, seven columns across and
   * roofed a good two lengths up -- against a pet a length tall, that is a
   * house rather than a shed, and it is what the place is named for.
   *
   * They can only exist because they bring their own footing. A seven-column
   * stamp needs seven columns of ground level to within a voxel, which open
   * relief almost never offers; every one of these would have been rejected and
   * the green would have come out empty. See `Prop.foundation`.
   */
  {
    id: 'cottage',
    weight: 30,
    spacing: 3,
    foundation: true,
    model: {
      palette,
      layers: [
        // A course of footings proud of the wall, which is what stops a stone
        // house looking like a box someone set down on the grass.
        rows(`
          sssssss
          sssssss
          sssssss
          sssssss
          sssssss
          sssssss
          sssssss`),
        rows(`
          .sssss.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .sssss.`),
        // The doorway, through the gable end that faces the yard, and a window
        // on the wall opposite it.
        rows(`
          .sssss.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .ssnss.`),
        rows(`
          .ssnss.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .ssnss.`),
        rows(`
          .sssss.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .sssss.`),
        rows(`
          .sssss.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .snnns.
          .sssss.`),
        rows(`
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr`),
        rows(`
          .rrrrr.
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr
          .rrrrr.`),
        rows(`
          .......
          .rrrrr.
          .rrrrr.
          .rrrrr.
          .rrrrr.
          .rrrrr.
          .......`),
        rows(`
          .......
          ..rrr..
          ..rrr..
          ..rrr..
          ..rrr..
          ..rrr..
          .......`),
        rows(`
          .......
          ...r...
          ...r...
          s..r...
          ...r...
          ...r...
          .......`),
        rows(`
          .......
          .......
          .......
          s......
          .......
          .......
          .......`),
      ],
    },
  },
  {
    id: 'barn',
    weight: 16,
    spacing: 3,
    foundation: true,
    // Longer and lower than the cottage, with the doorway through the gable
    // end. Two shapes of building is what turns a row of identical houses into
    // somewhere people actually put things.
    model: {
      palette,
      layers: [
        rows(`
          sssssss
          sssssss
          sssssss
          sssssss
          sssssss`),
        rows(`
          sssssss
          snnnnns
          snnnnns
          snnnnns
          sssnsss`),
        rows(`
          sssssss
          snnnnns
          snnnnns
          snnnnns
          sssnsss`),
        rows(`
          sstssss
          snnnnns
          snnnnns
          snnnnns
          sssnsss`),
        rows(`
          sssssss
          snnnnns
          snnnnns
          snnnnns
          sssssss`),
        rows(`
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr
          rrrrrrr`),
        rows(`
          .rrrrr.
          .rrrrr.
          .rrrrr.
          .rrrrr.
          .rrrrr.`),
        rows(`
          ...r...
          ..rrr..
          ..rrr..
          ..rrr..
          ...r...`),
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

/**
 * The wood's. Little loose stone and less grass than open ground: a wood floor
 * is leaf litter, bracken and what has fallen off the trees. The pool is
 * weighted this way as much as the density is, because a wood scattered from
 * the shared pool comes out as a meadow with trees standing about in it.
 */
export const WOODLAND_PROPS: Prop[] = [
  ...scarce(STONES, 7),
  ...scarce(GRASS, 8),
  ...WOODLAND_ONLY,
]

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
      // Two courses of stone, so the thing stands on something rather than
      // starting out of the grass. It also gives the walls a line to break
      // them up, which at this size is most of what reads as construction.
      ...Array.from({ length: 2 }, () => [
        'sssssss',
        's......',
        's......',
        's......',
        's......',
        's......',
        's......',
        's......',
        's......',
        's......',
        's......',
      ]),
      // Wood above that: a solid back, two sides, and an open front. Nine
      // courses of it, so the header below clears the pet's head -- at eight
      // the beam came down across the top of it when it went in to sleep.
      ...Array.from({ length: 9 }, () => [
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
      // A header across the front ties the two door posts together. Without it
      // the front is not a doorway, it is a missing wall -- and a beam is the
      // cheapest thing that tells the eye which.
      [
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
        'wwwwwww',
      ],
      // And a roof in three steps rather than two flat slabs, which is enough
      // of a pitch to catch the light differently on each course.
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
      [
        '.......',
        '.......',
        '..rrrrr',
        '..rrrrr',
        '..rrrrr',
        '..rrrrr',
        '..rrrrr',
        '..rrrrr',
        '..rrrrr',
        '.......',
        '.......',
      ],
    ],
  },
}
