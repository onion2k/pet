/**
 * A patch of ground for the pet to live on. This is the first stage of the
 * environment: terrain and sky only. Shelter, plants and rocks will be props
 * placed onto the same grid.
 */
export interface Biome {
  id: string
  name: string
  /** Two shades of surface, dithered by the same noise that shapes the ground. */
  surface: [string, string]
  /** Exposed at height steps and around the edges. */
  soil: string
  /** Deeper still, visible where the ground cuts away. */
  rock: string
  sky: { top: [number, number, number]; bottom: [number, number, number] }
  /** Colour the terrain fades into at the horizon, matched to the sky's base. */
  haze: [number, number, number]
}

export const MEADOW: Biome = {
  id: 'meadow',
  name: 'Meadow',
  surface: ['#6fbf4a', '#5da83c'],
  soil: '#8a6242',
  rock: '#5f5a54',
  sky: { top: [0.10, 0.14, 0.28], bottom: [0.04, 0.06, 0.11] },
  haze: [0.06, 0.09, 0.16],
}

export const BIOMES: Biome[] = [MEADOW]

/** Columns across the terrain patch. */
export const TERRAIN_SIZE = 64
/** World size of one terrain voxel. Slightly coarser than a pet's. */
export const TERRAIN_VOXEL = 0.18
/** Height, in voxels, of the flat ground the pet stands on. */
export const TERRAIN_BASE = 4
/** How far the ground rises and falls either side of the base. */
export const TERRAIN_RELIEF = 3
/** Radius, in world units, kept level for the pet to move around in. */
export const TERRAIN_CLEARING = 1.5
