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
import type { Material, SeasonId } from './seasons'
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
/**
 * Water at the front of the patch, between the pet and the camera.
 *
 * The sea is in the foreground because that is the only place it can be seen
 * moving. The ground fades into the sky with depth -- by the patch's far edge
 * the haze is already eight parts in ten -- so water at the back was a band of
 * horizon four pixels tall, and a swell four pixels tall is a still picture.
 * Held a couple of lengths off the camera instead, the same swell travels, and
 * the surf is a line that runs up the sand and slides back down it.
 *
 * So the patch reads bottom to top: water, then the flat the pet walks, then
 * the dunes and the sky behind them.
 */
export interface Shore {
  /**
   * Height in voxels the water surface sits at. Below the clearing's, and
   * above the ground the biome's relief falls to -- where the two cross is the
   * waterline, and there is no waterline at all if they never do.
   */
  level: number
  /** Water over sand, and water over nothing. */
  shallow: string
  deep: string
}

/**
 * How the ground lies, beyond the noise every patch gets.
 *
 * The relief on its own is three voxels either way, which is all a meadow
 * wants and nowhere near enough for a hill: a hilltop has to *be* higher than
 * what is around it, and the way the player is told that is by the ground
 * falling away in front of them and climbing behind. Both are given here as a
 * height in voxels the noise is pulled toward, and a world z the pull starts
 * at, so a place can be a summit, a bank, a bowl, or -- by leaving this out
 * entirely -- flat country.
 */
export interface Relief {
  /** Ground falling away toward the camera: where it breaks, and how low it gets. */
  fall?: { from: number; to: number }
  /** Ground climbing away behind: where it starts, and how high it gets. */
  rise?: { from: number; to: number }
}

/**
 * What is in the sky over a place, drawn on the backdrop behind everything.
 *
 * Both of these are here for the same reason: a patch is fourteen lengths deep
 * and hazed out well before its far edge, so nothing in the scene itself can
 * say how far you can see from where you are standing. A hilltop with the same
 * sky as a wood is not a hilltop. Ridges give the distance and cloud gives the
 * height -- weather you are level with rather than under.
 */
export interface Sky {
  /**
   * Where the ground gives way to sky in this frame, 0 at the bottom of the
   * picture and 1 at the top.
   *
   * Measured rather than derived. Everything drawn on the backdrop has to sit
   * above the skyline or it is simply behind the ground and invisible, and
   * where the skyline falls depends on the relief, on what is standing on it,
   * and on where this place points the camera -- none of which the sky shader
   * has any way to know. Authoring it as one number per place keeps the thing
   * that has to agree in one place.
   */
  horizon: number
  /** How much cloud, 0 to 1. */
  cloud: number
  /** How strongly distant ridges show, 0 for country with nothing to see over. */
  ridges: number
}

export interface Biome {
  id: BiomeId
  name: string
  /** What the ticker calls it, shouted: 'THE MEADOW', 'THE WOOD'. */
  prose: string
  /** One line under the name when choosing where to move. */
  note: string
  /** Chance a given scatter slot grows something. */
  propDensity: number
  /**
   * Columns between candidate scatter slots here, if not the usual spacing.
   *
   * Density alone cannot make a wood: it is the chance a slot is taken, and on
   * a three-column grid a full wood is still a plantation with a metre between
   * every trunk. Closing the grid up is what puts trees behind trees.
   */
  propSpacing?: number
  /** What gets scattered over it. */
  props: Prop[]
  /** Its four grounds, one per role. */
  grounds: Ground[]
  /** Who fills each role here: four living, and whatever rolls. */
  visitors: Record<VisitorRole, VisitorId>
  /**
   * Local colour beyond the roles: things that turn up here and nowhere else,
   * and that no game asks for.
   *
   * The roles are a frame -- every place has exactly one flitter, so every
   * place plays CHASE -- and a frame with nothing outside it means five yards
   * with the same five slots filled differently. This is the room to give a
   * place something the frame has no hole for.
   */
  extras?: VisitorId[]
  /**
   * Painted over the season's palette rather than replacing it, so a wood is
   * still recognisably wintry in winter. Four seasons times five places would
   * be twenty palettes to author and keep in step; this is one small override
   * per place, and it costs no geometry -- the materials are indices, and the
   * colours behind them are swapped on the texture every frame anyway.
   */
  materials?: Partial<Record<Material, string>>
  /**
   * Overrides that hold for one season only, painted over the ones above.
   *
   * The flat overrides are what a place is made of -- sand is sand in April --
   * and they were being used for what a place is *wearing*, which is not the
   * same thing and does not last the year. A wood whose leaves were declared
   * green stayed green through October while the meadow beside it turned,
   * because the override outranked the season it was supposed to be dressed by.
   * Anything that changes with the year belongs here instead, and is blended
   * across the turn of the season exactly as the season's own colours are.
   */
  seasonMaterials?: Partial<Record<SeasonId, Partial<Record<Material, string>>>>
  /** Water at the front, if this place has any. */
  shore?: Shore
  /** How the ground lies, for a place that is not flat country. */
  relief?: Relief
  /** What is in the sky here. Absent is a plain sky with nothing in it. */
  sky?: Sky
}

export const MEADOW: Biome = {
  id: 'meadow',
  name: 'Meadow',
  prose: 'THE MEADOW',
  note: 'Open ground. Wide sky.',
  propDensity: 0.66,
  props: MEADOW_PROPS,
  grounds: MEADOW_GROUNDS,
  visitors: { flitter: 'butterfly', glow: 'fireflies', grazer: 'rabbit', bloom: 'flowers', toy: 'ball' },
  // Fair-weather cloud, high up and thin. The meadow is the plain one on
  // purpose -- it is what the others are told apart from.
  sky: { horizon: 0.70, cloud: 0.34, ridges: 0 },
}

export const WOODLAND: Biome = {
  id: 'woodland',
  name: 'Woodland',
  prose: 'THE WOOD',
  note: 'Close cover. Good for blooms.',
  // Denser than the meadow, and on a tighter grid than anywhere else. Density
  // is the chance a slot is taken; the grid is how close the slots are. At the
  // usual three columns a wood at full density is still a plantation with a
  // clear metre between every trunk, and what makes a wood is trees standing
  // behind other trees.
  propDensity: 0.94,
  propSpacing: 2,
  props: WOODLAND_PROPS,
  grounds: WOODLAND_GROUNDS,
  visitors: { flitter: 'moth', glow: 'glowworms', grazer: 'deer', bloom: 'bluebells', toy: 'pinecone' },
  materials: {
    soil: '#4a3a2a',
    wood: '#5c4530',
  },
  // Everything the wood wears rather than is. Leaf colour is the whole of what
  // a deciduous wood has to say about the month, and it was being declared flat
  // -- green in October, green under snow.
  seasonMaterials: {
    spring: {
      surfaceA: '#4a7a3e',
      surfaceB: '#578c46',
      foliageDark: '#3f7a33',
      foliageLight: '#7bb64a',
    },
    summer: {
      surfaceA: '#3f6b38',
      surfaceB: '#4a7a3e',
      foliageDark: '#2f5c2c',
      foliageLight: '#598a3d',
    },
    autumn: {
      surfaceA: '#6b5f34',
      surfaceB: '#7a6a3a',
      foliageDark: '#96522a',
      foliageLight: '#d08c30',
    },
    winter: {
      surfaceA: '#4f4c3e',
      surfaceB: '#5a5646',
      // Bare: what is left in the canopy is twig and the odd brown leaf, so the
      // two foliage slots come in close to the wood they hang on.
      foliageDark: '#4a4034',
      foliageLight: '#63563f',
    },
  },
  // The wood stands on a bank that climbs away behind the clearing.
  //
  // Not for the shape of the ground -- nobody would notice a slope under a
  // wood -- but for what stands on it. From a camera at the pet's eye level the
  // mid-ground is the only place a tree can be seen whole, and the middle of
  // that is taken up by the shelter. Ground that rises carries the trees behind
  // it up with it, so the wood goes on over the roof instead of stopping at it.
  relief: { rise: { from: -2.6, to: 7 } },
  // Little sky to see and no distance to see it over: a wood on rising ground
  // with its own canopy on top of that leaves a strip of sky and nothing else.
  // The cloud is for the gaps in the branches.
  sky: { horizon: 0.9, cloud: 0.24, ridges: 0 },
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
  visitors: { flitter: 'gull', glow: 'seafire', grazer: 'crab', bloom: 'seapinks', toy: 'beachball' },
  // The gull owns the beach's flitting role; the tern works the same shoreline
  // beside it and is asked for by nothing.
  extras: ['tern'],
  shore: {
    level: 3,
    shallow: '#4d8f9e',
    deep: '#1d4a63',
  },
  // The sand breaks as close in front of the level lane as it can -- the lane
  // reaches z 1.8, and the pet has to keep its feet dry. Any further out and
  // the water is a line along the bottom of the frame rather than something
  // the pet is standing beside. Behind, the dunes.
  relief: { fall: { from: 1.9, to: 1 }, rise: { from: -3.6, to: 6 } },
  // A coast has more sky in it than anywhere inland. It starts high up the
  // picture, though: the dunes stand tall in the frame and the camera is aimed
  // low to take in the water. No ridges -- what is behind a beach is its dunes.
  sky: { horizon: 0.86, cloud: 0.5, ridges: 0 },
  materials: {
    surfaceA: '#e0cd9a',
    surfaceB: '#d4be86',
    soil: '#b8a071',
    rock: '#8a8071',
    rockLight: '#ada291',
    wood: '#9a8a72',
  },
  // Marram is grey-green all summer and straw by the back end of the year. It
  // does not turn the way a wood does, but it does go over.
  seasonMaterials: {
    spring: { foliageDark: '#7f8a5c', foliageLight: '#a8b077' },
    summer: { foliageDark: '#7f8a5c', foliageLight: '#a8b077' },
    autumn: { foliageDark: '#8b8256', foliageLight: '#c0b177' },
    winter: { foliageDark: '#7d7660', foliageLight: '#9d9581' },
  },
}

export const HILL: Biome = {
  id: 'hill',
  name: 'Hillside',
  prose: 'THE HILL',
  note: 'High and bare. Long views.',
  propDensity: 0.5,
  // Wide apart. A hill is mostly ground, and what little stands up on it wants
  // room around it to read as a crag rather than as rubble.
  propSpacing: 4,
  props: HILL_PROPS,
  grounds: HILL_GROUNDS,
  visitors: { flitter: 'skylark', glow: 'glowbeetles', grazer: 'sheep', bloom: 'heather', toy: 'ball' },
  // The whole of what makes a hilltop a hilltop. The ground breaks away in
  // front of the pet and goes out of sight downward, and the shoulder of the
  // hill climbs behind it -- so the patch says, without a word of ticker, that
  // you are standing near the top of something. The ridges in the sky finish
  // the sentence: they are the far side of the valley the ground falls into.
  //
  // A fall and no rise, which is the opposite of the beach and the wood. Ground
  // climbing behind would be a shoulder standing between the pet and the view,
  // and the view is the whole of what a hill has to offer -- so the ground
  // breaks away in front and runs flat and bare to the back edge, and what is
  // past the back edge is the sky's business.
  relief: { fall: { from: 2.0, to: 1 } },
  sky: { horizon: 0.70, cloud: 0.6, ridges: 1 },
  materials: {
    // Drier and greyer than the meadow, with the rock a cold stone rather than
    // a warm one: what makes a hill read as a hill is how much of it is bare.
    surfaceA: '#87905c',
    surfaceB: '#96a06a',
    soil: '#6b6350',
    rock: '#83807a',
    rockLight: '#a5a29a',
  },
  // Heather: green most of the year and purple for the few weeks it is out,
  // which is the one thing a hillside does that anyone remembers.
  seasonMaterials: {
    spring: { foliageDark: '#4f6b3c', foliageLight: '#7d9450', flower: '#e6c34a' },
    summer: { foliageDark: '#4f6b3c', foliageLight: '#7d9450', flower: '#e6c34a' },
    autumn: { foliageDark: '#5f4a63', foliageLight: '#9a6f9c', flower: '#b25fa8' },
    winter: { foliageDark: '#4b4a42', foliageLight: '#6f6c5e', flower: '#8a8474' },
  },
}

export const VILLAGE: Biome = {
  id: 'village',
  name: 'Village',
  prose: 'THE VILLAGE',
  note: 'Neighbours. Gardens over the wall.',
  propDensity: 0.6,
  // Room for buildings. The scatter reserves a prop's own spacing around it,
  // but the grid is what decides whether two cottages can be offered adjacent
  // slots at all, and a village wants gardens between its houses.
  propSpacing: 4,
  props: VILLAGE_PROPS,
  grounds: VILLAGE_GROUNDS,
  visitors: { flitter: 'sparrow', glow: 'lampmoths', grazer: 'cat', bloom: 'hollyhocks', toy: 'football' },
  materials: {
    surfaceA: '#7fbe55',
    surfaceB: '#6faa48',
    // Stone, not cob: the walls are the same rock the field boundaries are,
    // which is what a village built out of its own ground looks like.
    rock: '#94908a',
    rockLight: '#b3afa6',
    roof: '#6b4a3e',
    wood: '#7a6144',
  },
  // Chimneys, and enough sky over a green to see them against.
  sky: { horizon: 0.70, cloud: 0.34, ridges: 0.4 },
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
