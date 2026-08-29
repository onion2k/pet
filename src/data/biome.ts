/**
 * A patch of ground for the pet to live on, and the scenery scattered over it.
 * Shelter will follow as further props on the same grid.
 */
export interface Biome {
  id: string
  name: string
  /** Chance a given scatter slot grows something. Colours come from the season. */
  propDensity: number
}

export const MEADOW: Biome = {
  id: 'meadow',
  name: 'Meadow',
  propDensity: 0.66,
}

export const BIOMES: Biome[] = [MEADOW]

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
 * How many lanterns the yard holds, the shelter's own included. The shaders
 * carry a fixed-size array and every slot is lit, so this has to be exact --
 * a spare slot would sit at the camera and light whatever came near it.
 */
export const LAMP_COUNT = LAMP_ROW_X.length + 1
/** Extra columns of clear ground kept around the pet's clearing. */
export const PROP_CLEARING_MARGIN = 2
