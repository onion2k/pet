import {
  BEACH_GROUNDS,
  HILL_GROUNDS,
  MEADOW_GROUNDS,
  VILLAGE_GROUNDS,
  WOODLAND_GROUNDS,
  type Ground,
} from './grounds'
import {
  BEACH_PROPS,
  HILL_PROPS,
  MEADOW_PROPS,
  VILLAGE_PROPS,
  WOODLAND_PROPS,
  type Prop,
} from './props'
import type { Material } from './seasons'
import type { VisitorId, VisitorRole } from './visitors'

export type BiomeId = 'meadow' | 'woodland' | 'beach' | 'hill' | 'village'

/**
 * A place for the pet to live: the scenery scattered over it, where it can be
 * sent to forage, and who turns up in the yard.
 *
 * It is deliberately not just a repaint. A biome that only changed the colours
 * would be wallpaper, and the player would pick one once and forget it. Because
 * the grounds and the visitors come with the house, moving somewhere is a
 * decision about what the next stretch of play is made of -- which is the same
 * reason PLAY was rebuilt to read the yard instead of ignoring it.
 */
export interface Biome {
  id: BiomeId
  name: string
  /** What the ticker calls it, shouted: 'THE MEADOW', 'THE WOOD'. */
  prose: string
  /** One line under the name when choosing where to move. */
  note: string
  /** Chance a given scatter slot grows something. */
  propDensity: number
  /** What gets scattered over it. */
  props: Prop[]
  /** Its four grounds, one per role. */
  grounds: Ground[]
  /** Who fills each living role here. Objects turn up everywhere regardless. */
  visitors: Record<VisitorRole, VisitorId>
  /**
   * Painted over the season's palette rather than replacing it, so a wood is
   * still recognisably wintry in winter. Four seasons times five places would
   * be twenty palettes to author and keep in step; this is one small override
   * per place, and it costs no geometry -- the materials are indices, and the
   * colours behind them are swapped on the texture every frame anyway.
   */
  materials?: Partial<Record<Material, string>>
}

export const MEADOW: Biome = {
  id: 'meadow',
  name: 'Meadow',
  prose: 'THE MEADOW',
  note: 'Open ground. Wide sky.',
  propDensity: 0.66,
  props: MEADOW_PROPS,
  grounds: MEADOW_GROUNDS,
  visitors: { flitter: 'butterfly', glow: 'fireflies', grazer: 'rabbit', bloom: 'flowers' },
}

export const WOODLAND: Biome = {
  id: 'woodland',
  name: 'Woodland',
  prose: 'THE WOOD',
  note: 'Close cover. Good for blooms.',
  // Denser than the meadow, which is what makes it read as a wood rather than
  // as a meadow with trees in it.
  propDensity: 0.82,
  props: WOODLAND_PROPS,
  grounds: WOODLAND_GROUNDS,
  visitors: { flitter: 'moth', glow: 'glowworms', grazer: 'deer', bloom: 'bluebells' },
  materials: {
    surfaceA: '#3f6b38',
    surfaceB: '#4a7a3e',
    soil: '#4a3a2a',
    foliageDark: '#2f5c2c',
    foliageLight: '#598a3d',
    wood: '#5c4530',
  },
}

export const BEACH: Biome = {
  id: 'beach',
  name: 'Beach',
  prose: 'THE SHORE',
  note: 'Open sand. Sun and salt.',
  // Sparse: an empty beach is the point of a beach, and marram in every slot
  // would read as a meadow that had been recoloured.
  propDensity: 0.42,
  props: BEACH_PROPS,
  grounds: BEACH_GROUNDS,
  visitors: { flitter: 'tern', glow: 'seafire', grazer: 'crab', bloom: 'seapinks' },
  materials: {
    surfaceA: '#e0cd9a',
    surfaceB: '#d4be86',
    soil: '#b8a071',
    rock: '#8a8071',
    rockLight: '#ada291',
    foliageDark: '#7f8a5c',
    foliageLight: '#a8b077',
    wood: '#9a8a72',
  },
}

export const HILL: Biome = {
  id: 'hill',
  name: 'Hillside',
  prose: 'THE HILL',
  note: 'High and bare. Stone country.',
  propDensity: 0.5,
  props: HILL_PROPS,
  grounds: HILL_GROUNDS,
  visitors: { flitter: 'skylark', glow: 'glowbeetles', grazer: 'sheep', bloom: 'heather' },
  materials: {
    // Drier and greyer than the meadow, with the rock a cold stone rather than
    // a warm one: what makes a hill read as a hill is how much of it is bare.
    surfaceA: '#87905c',
    surfaceB: '#96a06a',
    soil: '#6b6350',
    rock: '#83807a',
    rockLight: '#a5a29a',
    foliageDark: '#4f6b3c',
    foliageLight: '#7d9450',
    flower: '#e6c34a',
  },
}

export const VILLAGE: Biome = {
  id: 'village',
  name: 'Village',
  prose: 'THE VILLAGE',
  note: 'Neighbours. Gardens over the wall.',
  propDensity: 0.6,
  props: VILLAGE_PROPS,
  grounds: VILLAGE_GROUNDS,
  visitors: { flitter: 'sparrow', glow: 'lampmoths', grazer: 'cat', bloom: 'hollyhocks' },
  materials: {
    surfaceA: '#7fbe55',
    surfaceB: '#6faa48',
    rock: '#8f8b7e',
    rockLight: '#a9a698',
    wood: '#7a6144',
  },
}

export const BIOMES: Biome[] = [MEADOW, WOODLAND, BEACH, HILL, VILLAGE]

/**
 * A biome id this build actually knows, or the meadow. Both the save's repair
 * pass and the pre-boot ground seed need this: `home` picks a scatter pool and
 * keys a record, so a name from a newer build has to land somewhere real.
 */
export const knownBiome = (id: unknown): BiomeId =>
  BIOMES.some((b) => b.id === id) ? (id as BiomeId) : 'meadow'

export const biomeById = (id: BiomeId): Biome => {
  const found = BIOMES.find((b) => b.id === id)
  if (!found) throw new Error(`Unknown biome: ${id}`)
  return found
}

/**
 * Columns across the terrain patch. Twice as wide as it is deep: the camera
 * pans left and right to follow the pet, so the world has to extend much
 * further sideways than it does front to back.
 */
export const TERRAIN_COLS = 160
export const TERRAIN_ROWS = 80
/** World size of one terrain voxel. Slightly coarser than a pet's. */
export const TERRAIN_VOXEL = 0.18
/** Height, in voxels, of the flat ground the pet stands on. */
export const TERRAIN_BASE = 4
/** How far the ground rises and falls either side of the base. */
export const TERRAIN_RELIEF = 3
/**
 * The level lane the pet walks in: a broad ellipse rather than a disc, since
 * the pet ranges right across the meadow but only a little toward and away
 * from the camera. Relief and scenery live in front of it, behind it, and
 * beyond its ends.
 */
export const LANE_HALF_X = 10.6
export const LANE_HALF_Z = 1.8
/** How far the pet ranges, kept inside the lane so its feet stay level. */
export const ROAM_HALF_X = 9.5
export const ROAM_HALF_Z = 1.0
/** Columns between candidate scenery slots. */
export const PROP_SPACING = 3

/**
 * The shelter sits off to one side and behind the clearing: far enough back
 * that it never crowds the pet's wandering, near enough that the horizon haze
 * does not swallow it. The ground beneath it, and a path back to the clearing,
 * are levelled separately from the clearing itself, so scenery is not pushed
 * out of the foreground.
 */
export const SHELTER_CENTRE = { x: 1.22, z: -2.45 }
/** Footprint in columns, matching the shelter model. */
export const SHELTER_COLUMNS = { w: 13, d: 11 }

/**
 * Where the scattered lanterns stand: a row just behind the band the pet roams,
 * far enough back that nothing walks into them and near enough in that they are
 * still on the clearing's level ground.
 */
export const LAMP_ROW_Z = -1.15
export const LAMP_ROW_X = [-7.6, -5.0, -2.4, 2.6, 5.2, 7.6]
/**
 * How many lights the shaders carry: the lantern row, the shelter's own, and
 * one spare for a jack-o-lantern when there is one. Every slot is lit, so an
 * unused one has to be parked out of range -- left at the origin it would sit
 * at the camera and light whatever came near it.
 */
export const LAMP_COUNT = LAMP_ROW_X.length + 2
/** Where an unused light slot is parked: far enough that its falloff is zero. */
export const LAMP_PARKED: readonly [number, number, number] = [0, -10000, 0]

/**
 * Standing room on the verge, for whatever is visiting. Each slot is inside the
 * clearing's level ground and outside the band the pet roams, and they step
 * around both the lantern row and the shelter's frontage.
 */
export const VERGE_Z = -1.42
export const VERGE_SLOTS = [-6.1, -3.9, -1.8, 4.0, 6.1]
/** Extra columns of clear ground kept around the pet's clearing. */
export const PROP_CLEARING_MARGIN = 2
