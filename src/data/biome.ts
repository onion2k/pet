import type { PropKey } from './props'

/**
 * A patch of ground for the pet to live on, and the scenery scattered over it.
 * Shelter will follow as further props on the same grid.
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
  /** Resolves the props' placeholder palette against this biome. */
  props: Record<PropKey, string>
  /** Chance a given scatter slot grows something. */
  propDensity: number
}

export const MEADOW: Biome = {
  id: 'meadow',
  name: 'Meadow',
  surface: ['#6fbf4a', '#5da83c'],
  soil: '#8a6242',
  rock: '#5f5a54',
  sky: { top: [0.10, 0.14, 0.28], bottom: [0.04, 0.06, 0.11] },
  haze: [0.06, 0.09, 0.16],
  props: {
    // Plants read against the grass by being bluer and deeper, not just darker.
    s: '#6b655c',
    t: '#8c8478',
    f: '#2f7d4a',
    e: '#8ce06b',
    w: '#6b5334',
    p: '#ffe27a',
    r: '#a8523a',
    n: '#3f3227',
  },
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
