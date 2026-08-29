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

/** Columns across the terrain patch. Wide enough that its far edge is fully
 *  swallowed by haze before it can be seen. */
export const TERRAIN_SIZE = 80
/** World size of one terrain voxel. Slightly coarser than a pet's. */
export const TERRAIN_VOXEL = 0.18
/** Height, in voxels, of the flat ground the pet stands on. */
export const TERRAIN_BASE = 4
/** How far the ground rises and falls either side of the base. */
export const TERRAIN_RELIEF = 3
/** Radius, in world units, kept level for the pet to move around in. */
export const TERRAIN_CLEARING = 2.2
/** How far in from the clearing's edge the pet keeps, so its feet stay level. */
export const ROAM_INSET = 0.95
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
/** Extra columns of clear ground kept around the pet's clearing. */
export const PROP_CLEARING_MARGIN = 2
