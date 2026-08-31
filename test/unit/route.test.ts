import { describe, expect, it } from 'vitest'
import { crossesWall, doorstepOf, type Walls } from '../../src/render/route'
import {
  ROAM_HALF_X,
  ROAM_HALF_Z,
  SHELTER_CENTRE,
  SHELTER_COLUMNS,
  TERRAIN_VOXEL,
} from '../../src/data/biome'
import { DOORSTEP_CLEARANCE, PET_RADIUS } from '../../src/render/pet'

/**
 * Walking to bed without going through a wall.
 *
 * The pet is not a route-finder and does not need to be: the yard is one open
 * band and a straight line is almost always fine. Bed is the exception, since
 * it is inside a building, and this is the arithmetic that says so.
 */

/** The shelter as the renderer places it, on whichever side the seed picked. */
const shelter = (flip: 1 | -1): Walls => ({
  centre: { x: SHELTER_CENTRE.x * flip, z: SHELTER_CENTRE.z },
  half: {
    x: (SHELTER_COLUMNS.w / 2) * TERRAIN_VOXEL,
    z: (SHELTER_COLUMNS.d / 2) * TERRAIN_VOXEL,
  },
})

/** Where the pet sleeps: just inside the open front. */
const bedIn = (walls: Walls) => ({ x: walls.centre.x, z: walls.centre.z + walls.half.z * 0.35 })

/** Everywhere in the band the pet potters about in. */
function acrossTheYard(): { x: number; z: number }[] {
  const spots: { x: number; z: number }[] = []
  for (let x = -ROAM_HALF_X; x <= ROAM_HALF_X; x += 0.5) {
    for (let z = -ROAM_HALF_Z; z <= ROAM_HALF_Z; z += 0.25) spots.push({ x, z })
  }
  return spots
}

describe('walking to bed', () => {
  for (const flip of [1, -1] as const) {
    describe(`with the shelter on the ${flip > 0 ? 'right' : 'left'}`, () => {
      const walls = shelter(flip)
      const bed = bedIn(walls)
      const step = doorstepOf(walls, PET_RADIUS * DOORSTEP_CLEARANCE)

      it('is a walk through the wall, aimed at straight from most of the yard', () => {
        // The bug this fixes. Not every spot -- a pet already in front of the
        // door walks in cleanly -- but most of the band, which is why it kept
        // being seen.
        const through = acrossTheYard().filter((from) => crossesWall(from, bed, walls))
        expect(through.length).toBeGreaterThan(acrossTheYard().length / 2)
      })

      it('touches no wall when it goes by the doorstep first', () => {
        for (const from of acrossTheYard()) {
          expect(crossesWall(from, step, walls), `${from.x},${from.z} -> step`).toBe(false)
        }
        expect(crossesWall(step, bed, walls), 'step -> bed').toBe(false)
      })

      it('comes out the same way it went in', () => {
        for (const to of acrossTheYard()) {
          expect(crossesWall(bed, step, walls), 'bed -> step').toBe(false)
          expect(crossesWall(step, to, walls), `step -> ${to.x},${to.z}`).toBe(false)
        }
      })

      it('puts the doorstep outside the building, in front of the door', () => {
        expect(step.x).toBe(walls.centre.x)
        expect(step.z).toBeGreaterThan(walls.centre.z + walls.half.z)
      })
    })
  }
})

describe('crossing a wall', () => {
  const walls: Walls = { centre: { x: 0, z: 0 }, half: { x: 1, z: 1 } }

  it('says nothing about a walk that never goes near it', () => {
    expect(crossesWall({ x: -5, z: 5 }, { x: 5, z: 5 }, walls)).toBe(false)
    expect(crossesWall({ x: -5, z: -5 }, { x: -3, z: -5 }, walls)).toBe(false)
  })

  it('catches a walk straight through the side of it', () => {
    expect(crossesWall({ x: -5, z: 0 }, { x: 5, z: 0 }, walls)).toBe(true)
  })

  it('catches a walk in through the back', () => {
    expect(crossesWall({ x: 0, z: -5 }, { x: 0, z: 0 }, walls)).toBe(true)
  })

  it('lets a walk in through the open front alone', () => {
    expect(crossesWall({ x: 0, z: 5 }, { x: 0, z: 0 }, walls)).toBe(false)
  })

  it('lets a walk out through the open front alone', () => {
    expect(crossesWall({ x: 0, z: 0 }, { x: 0, z: 5 }, walls)).toBe(false)
  })

  it('catches leaving by a side even when it entered by the door', () => {
    // In across the open front, out through the right-hand wall.
    expect(crossesWall({ x: -1, z: 2 }, { x: 2, z: -1 }, walls)).toBe(true)
  })

  it('is unbothered by a walk that runs alongside a wall without touching it', () => {
    expect(crossesWall({ x: -5, z: 1.5 }, { x: 5, z: 1.5 }, walls)).toBe(false)
    expect(crossesWall({ x: 1.5, z: -5 }, { x: 1.5, z: 5 }, walls)).toBe(false)
  })

  it('does not count a walk that stops short of it', () => {
    expect(crossesWall({ x: -5, z: 0 }, { x: -2, z: 0 }, walls)).toBe(false)
  })
})
