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
} from '../../src/data/biome'

/**
 * The water at the front of the shore.
 *
 * The shape of a patch is the part of the renderer that is pure arithmetic, and
 * it is also the part that can drown a pet -- so it is tested here rather than
 * left to a screenshot. What matters is not that the sea looks right, which no
 * test can say, but that everything the pet stands on stays well above it.
 */

const SEEDS = ['a', 'seed-two', 'pet-1234', 'x:beach', 'zzz', '0']

/** Columns, from a world coordinate. */
const col = (world: number, span: number) => Math.round(span / 2 + world / TERRAIN_VOXEL)

describe('every place', () => {
  it('builds a patch at all, whatever relief it declares or leaves out', () => {
    // Cheap, and it has already earned its keep: a place with a rise and no
    // fall read the missing half and threw, and every test in this file passed
    // regardless because none of them had built that particular patch.
    for (const biome of BIOMES) {
      for (const seed of SEEDS) {
        const shape = terrainShape(seed, biome)
        expect(shape.heightAt(0, 0), `${biome.id} ${seed}`).toBeGreaterThan(0)
        expect(shape.heightAt(TERRAIN_COLS - 1, TERRAIN_ROWS - 1)).toBeGreaterThan(0)
        expect(Number.isFinite(shape.groundY)).toBe(true)
      }
    }
  })
})

describe('flat country', () => {
  it('is unchanged by the relief code existing at all', () => {
    // A place that declares no relief is level ground with noise on it, and
    // should not have paid a voxel for the places that are not. Read at the
    // near edge, where a fall would show, and at the far one, where a rise
    // would.
    for (const biome of BIOMES.filter((b) => !b.relief)) {
      const shape = terrainShape('seed', biome)
      let lowest = Infinity
      let highest = -Infinity
      for (let x = 0; x < TERRAIN_COLS; x++) {
        lowest = Math.min(lowest, shape.heightAt(x, TERRAIN_ROWS - 3))
        highest = Math.max(highest, shape.heightAt(x, 2))
      }
      expect(lowest, biome.id).toBeGreaterThan(1)
      expect(highest, biome.id).toBeLessThan(6)
    }
  })

  it('has no waterline to report', () => {
    expect(terrainShape('seed', MEADOW).seaY).toBeNull()
  })
})

describe('a patch with dry relief', () => {
  // The hill: the same shape as a shore with nothing poured into it. What the
  // player is being told is that they are standing near the top of something,
  // and the two halves of that are the ground going out of sight downward in
  // front and the shoulder climbing behind.
  const hill = BIOMES.find((b) => b.id === 'hill')!

  it('is a hilltop at all, which is to say the ground goes out of sight in front', () => {
    // And only in front. A shoulder climbing behind the pet would stand between
    // it and the one thing a hill has to offer, so the hill declares a fall and
    // no rise -- unlike the beach, which needs its dunes.
    expect(hill.relief?.fall).toBeDefined()
    expect(hill.relief?.rise).toBeUndefined()
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, hill)
      let ahead = -Infinity
      for (let x = 0; x < TERRAIN_COLS; x++) {
        ahead = Math.max(ahead, shape.heightAt(x, TERRAIN_ROWS - 3))
      }
      expect(ahead, `${seed} ahead`).toBeLessThan(shape.groundY / TERRAIN_VOXEL)
    }
  })

  it('gives a place that falls away something in the sky to fall away toward', () => {
    // The patch is fourteen lengths deep and hazed out before its far edge, so
    // the distance a hill is supposed to have has to be painted on the
    // backdrop. A fall with no ridges behind it is a patch that stops.
    for (const biome of BIOMES) {
      if (!biome.relief?.fall || biome.shore) continue
      expect(biome.sky?.ridges, biome.id).toBeGreaterThan(0)
    }
  })

  it('leaves it dry, since a hilltop with a sea on it is a mistake', () => {
    expect(hill.shore).toBeUndefined()
    expect(terrainShape('seed', hill).seaY).toBeNull()
  })

  it('keeps the pet"s own ground level whichever way the hill runs', () => {
    const laneX = LANE_HALF_X / TERRAIN_VOXEL
    const laneZ = LANE_HALF_Z / TERRAIN_VOXEL
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, hill)
      for (let z = 0; z < TERRAIN_ROWS; z++) {
        for (let x = 0; x < TERRAIN_COLS; x++) {
          const reach = Math.hypot((x - TERRAIN_COLS / 2) / laneX, (z - TERRAIN_ROWS / 2) / laneZ)
          if (reach > 1) continue
          expect(shape.heightAt(x, z), `${seed} at ${x},${z}`).toBe(shape.groundY / TERRAIN_VOXEL)
        }
      }
    }
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
      // A good part of the front of the patch, not a puddle in a dip.
      expect(wet, seed).toBeGreaterThan(TERRAIN_COLS * 8)
    }
  })

  it('leaves no island out in the water', () => {
    // The shore damps the noise as it descends precisely so that the sea has
    // one edge rather than a scatter of sandbanks in it. Right at the top of
    // the beach the noise still has a say, and should -- a hummock the water
    // has not quite taken is what makes the edge wander instead of ruling a
    // line across the frame. Out past the halfway mark it should be water and
    // nothing else, which is the part of it the camera is closest to.
    const fromCol = col(BEACH.relief!.fall!.from, TERRAIN_ROWS)
    const halfway = Math.round(fromCol + (TERRAIN_ROWS - fromCol) * 0.5)
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      for (let z = halfway; z < TERRAIN_ROWS; z++) {
        for (let x = 0; x < TERRAIN_COLS; x++) {
          expect(shape.heightAt(x, z), `${seed} at ${x},${z}`).toBeLessThanOrEqual(shore.level)
        }
      }
    }
  })

  it('breaks the sand in front of the lane rather than in it', () => {
    expect(BEACH.relief!.fall!.from).toBeGreaterThan(LANE_HALF_Z)
  })

  it('raises dunes behind, so the sea has a beach above it and not just sky', () => {
    // The point of the arrangement: water at the bottom of the frame, the flat
    // the pet walks across the middle, rising ground behind it. Read along the
    // back edge, which is as far into the dunes as the patch goes.
    for (const seed of SEEDS) {
      const shape = terrainShape(seed, BEACH)
      let lowest = Infinity
      for (let x = 0; x < TERRAIN_COLS; x++) lowest = Math.min(lowest, shape.heightAt(x, 1))
      expect(lowest, seed).toBeGreaterThan(shape.groundY / TERRAIN_VOXEL)
    }
  })
})

describe('every shore', () => {
  it('has ground that falls under its waterline, or there is no water', () => {
    // A shore is two halves that have to agree: the water stands at `level`,
    // and the relief is what takes the ground below it. Declared without the
    // relief -- or with ground that never gets that low -- the sea would be a
    // plane lying on top of an unbroken beach.
    for (const biome of BIOMES.filter((b) => b.shore)) {
      expect(biome.relief, biome.id).toBeDefined()
      expect(biome.relief!.fall!.to, biome.id).toBeLessThan(biome.shore!.level)
    }
  })
})
