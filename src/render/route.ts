/**
 * Getting about the yard without walking through it.
 *
 * The pet does not plan routes. It picks somewhere to go and walks at it, and
 * that is right for a creature pottering about a clearing -- the yard is one
 * open band with a shelter off to one side, and a straight line is almost
 * always fine.
 *
 * Almost. Bed is inside a building, and a building has three walls and an open
 * front. Aimed at straight from wherever it happened to be standing, a pet off
 * to one side walked in through the side of the shelter. So the one walk that
 * ends indoors is given a waypoint: out to the front step first, then straight
 * in. Two straight lines, no route-finding, and the pet uses the door.
 */

export interface Spot {
  x: number
  z: number
}

/** A building: a box, open along its front, which is the face at greater z. */
export interface Walls {
  centre: Spot
  half: Spot
}

/**
 * Just outside the doorway, on the building's centre line. Far enough out that
 * a pet standing on it is clear of the front wall it is about to walk past.
 */
export function doorstepOf(walls: Walls, clearance: number): Spot {
  return { x: walls.centre.x, z: walls.centre.z + walls.half.z + clearance }
}

/**
 * Whether walking straight from one spot to another would pass through a wall
 * -- crossing the building's surface anywhere but the open front.
 *
 * Both directions count. Going to bed, the pet must not enter through a side;
 * coming out again, it must not leave through the back.
 */
export function crossesWall(from: Spot, to: Spot, walls: Walls): boolean {
  const dx = to.x - from.x
  const dz = to.z - from.z

  // Clip the walk against the box, one axis at a time, keeping the last face
  // it entered by and the first it leaves by.
  let enter = 0
  let leave = 1
  let enterFace: Face | null = null
  let leaveFace: Face | null = null

  for (const axis of ['x', 'z'] as const) {
    const origin = from[axis]
    const delta = axis === 'x' ? dx : dz
    const low = walls.centre[axis] - walls.half[axis]
    const high = walls.centre[axis] + walls.half[axis]

    if (Math.abs(delta) < 1e-9) {
      // Parallel to this pair of walls: either always between them or never.
      if (origin < low || origin > high) return false
      continue
    }

    const near = ((delta > 0 ? low : high) - origin) / delta
    const far = ((delta > 0 ? high : low) - origin) / delta
    if (near > enter) {
      enter = near
      enterFace = { axis, side: delta > 0 ? -1 : 1 }
    }
    if (far < leave) {
      leave = far
      leaveFace = { axis, side: delta > 0 ? 1 : -1 }
    }
    if (enter > leave) return false
  }

  // Never touches it, or only grazes an end of the walk.
  if (enter > leave) return false
  // A face is only crossed if the crossing happens along the walk rather than
  // before it starts or after it ends -- a pet already indoors has not just
  // walked in through anything.
  if (enter > 0 && enterFace && !isFront(enterFace)) return true
  if (leave < 1 && leaveFace && !isFront(leaveFace)) return true
  return false
}

interface Face {
  axis: 'x' | 'z'
  /** -1 for the low side of that axis, 1 for the high side. */
  side: -1 | 1
}

/** The open one: the far side in z, which is what the yard looks at. */
const isFront = (face: Face): boolean => face.axis === 'z' && face.side === 1
