import { describe, expect, it } from 'vitest'
import { terrainShape } from '../../src/render/terrain'
import {
  BEACH,
  BIOMES,
  LANE_HALF_X,
  LANE_HALF_Z,
  MEADOW,
  ROAM_HALF_X,
  ROAM_HALF_Z,
  TERRAIN_COLS,
  TERRAIN_ROWS,
  TERRAIN_VOXEL,
  VERGE_SLOTS,
  VERGE_Z,
  type Biome,
} from '../../src/data/biome'

/**
 * The water at the back of the shore.
 *
 * The shape of a patch is the part of the renderer that is pure arithmetic, and
 * it is also the part that can drown a pet -- so it is tested here rather than
 * left to a screenshot. What matters is not that the sea looks right, which no
 * test can say, but that everything the pet stands on stays well above it.
 */

const SEEDS = ['a', 'seed-two', 'pet-1234', 'x:beach', 'zzz', '0']

/** Columns, from a world coordinate. */
const col = (world: number, span: number) => Math.round(span / 2 + world / TERRAIN_VOXEL)

describe('a patch with no shore', () => {
  it('is unchanged by the shore code existing at all', () => {
    // Every place but one has no water, and none of them should have paid for
    // it. Read at the back edge, which is the only place a shore would show.
    for (const biome of BIOMES.filter((b) => !b.shore)) {
      const shape = terrainShape('seed', biome)
      let lowest = Infinity
      for (let x = 0; x < TERRAIN_COLS; x++) lowest = Math.min(lowest, shape.heightAt(x, 2))
      expect(lowest, biome.id).toBeGreaterThan(1)
    }
  })

  it('has no waterline to report', () => {
    expect(terrainShape('seed', MEADOW).seaY).toBeNull()
  })
})

describe('a patch with a shore', () => {
  const shore = BEACH.shore!

  it('reports its waterline, below the ground the pet stands on', () => {
    const shape = terrainShape('seed', BEACH)
    expect(shape.seaY).toBe(shore.level * TERRAIN_VOXEL)
    expect(shape.seaY!).toBeLessThan(shape.groundY)
  })

  it('keeps every seed"s roaming band dry, which is the whole of the point', () => {
    // A pet does not sample the ground as it walks: it is placed at `groundY`
    // wherever it goes. If the band it roams in ever fell to the waterline the
    // pet would be standing in the sea and never know it.
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      const fromX = col(-ROAM_HALF_X, TERRAIN_COLS)
      const toX = col(ROAM_HALF_X, TERRAIN_COLS)
      const fromZ = col(-ROAM_HALF_Z, TERRAIN_ROWS)
      const toZ = col(ROAM_HALF_Z, TERRAIN_ROWS)
      for (let z = fromZ; z <= toZ; z++) {
        for (let x = fromX; x <= toX; x++) {
          expect(shape.heightAt(x, z), `${seed} at ${x},${z}`).toBeGreaterThan(shore.level)
        }
      }
    }
  })

  it('leaves the whole level lane above the water, not just the roaming band', () => {
    // The lane is what is flattened; the band is what is walked. Scenery, the
    // verge and the lantern row all sit in the difference.
    //
    // The lane is an ellipse, so this walks the ellipse rather than the box
    // around it -- the corners of the box are ordinary relief that was never
    // levelled and was never meant to be.
    const laneX = LANE_HALF_X / TERRAIN_VOXEL
    const laneZ = LANE_HALF_Z / TERRAIN_VOXEL
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      for (let z = 0; z < TERRAIN_ROWS; z++) {
        for (let x = 0; x < TERRAIN_COLS; x++) {
          const reach = Math.hypot((x - TERRAIN_COLS / 2) / laneX, (z - TERRAIN_ROWS / 2) / laneZ)
          if (reach > 1) continue
          expect(shape.heightAt(x, z), `${seed} at ${x},${z}`).toBeGreaterThan(shore.level)
        }
      }
    }
  })

  it('keeps the shelter out of the water whichever side it lands on', () => {
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      const { ox, oz, w, d } = shape.shelter
      for (let z = oz - 1; z < oz + d + 1; z++) {
        for (let x = ox - 1; x < ox + w + 1; x++) {
          expect(shape.heightAt(x, z), `${seed} at ${x},${z}`).toBeGreaterThan(shore.level)
        }
      }
    }
  })

  it('keeps the verge dry, since seeds are planted along it', () => {
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      const z = col(VERGE_Z, TERRAIN_ROWS)
      for (const slot of VERGE_SLOTS) {
        const x = col(slot, TERRAIN_COLS)
        expect(shape.heightAt(x, z), `${seed} at ${slot}`).toBeGreaterThan(shore.level)
      }
    }
  })

  it('actually gets the ground under the water somewhere, or there is no sea', () => {
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      let wet = 0
      for (let z = 0; z < TERRAIN_ROWS; z++) {
        for (let x = 0; x < TERRAIN_COLS; x++) {
          if (shape.heightAt(x, z) <= shore.level) wet++
        }
      }
      // A good part of the back of the patch, not a puddle in a dip.
      expect(wet, seed).toBeGreaterThan(TERRAIN_COLS * 8)
    }
  })

  it('leaves no island out in the water', () => {
    // The shore damps the noise as it descends precisely so that the sea has
    // one edge rather than a scatter of sandbanks in it. Right at the top of
    // the beach the noise still has a say, and should -- a hummock the water
    // has not quite taken is what makes the edge wander instead of ruling a
    // line across the frame. Out past the halfway mark it should be water and
    // nothing else.
    const backCol = col(shore.from, TERRAIN_ROWS)
    const halfway = Math.round(backCol - (backCol - 4) * 0.5)
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      for (let z = 0; z <= halfway; z++) {
        for (let x = 0; x < TERRAIN_COLS; x++) {
          expect(shape.heightAt(x, z), `${seed} at ${x},${z}`).toBeLessThanOrEqual(shore.level)
        }
      }
    }
  })

  it('starts the water behind the shelter rather than through it', () => {
    expect(BEACH.shore!.from).toBeLessThan(-2.45)
  })
})

describe('every shore', () => {
  it('puts its floor under its waterline', () => {
    for (const biome of BIOMES.filter((b): b is Biome & { shore: NonNullable<Biome['shore']> } => !!b.shore)) {
      expect(biome.shore.floor, biome.id).toBeLessThan(biome.shore.level)
    }
  })
})
