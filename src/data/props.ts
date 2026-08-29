import { rows, type VoxelModel } from './voxel-format'

/**
 * Scenery stamped into the terrain's voxel field. Because they share the field
 * with the ground, props get hidden-face culling and corner occlusion against
 * it — a rock sitting in the grass picks up real contact shading.
 *
 * Palette characters are placeholders resolved against the biome at build time:
 *   s / t  stone, dark and light      f / e  foliage, dark and light
 *   w      stem or twig               p      flower
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
}

/** Order matters: the resolver maps these characters onto biome colours. */
export const PROP_KEYS = ['s', 't', 'f', 'e', 'w', 'p'] as const
export type PropKey = (typeof PROP_KEYS)[number]

export const PROPS: Prop[] = [
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
