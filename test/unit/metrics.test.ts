import { describe, expect, it } from 'vitest'
import { metrics } from '../../src/game/metrics'
import { newPet, resetIdSource, setIdSource } from '../../src/game/save'
import type { PetState } from '../../src/game/types'

/**
 * The four readings every branch rule scores itself against. They are the only
 * thing standing between "how the pet was raised" and "what it becomes", so a
 * reading that is subtly wrong shows up as a player who did everything right
 * and got the wrong pet -- the least explicable failure the game has.
 */

setIdSource(() => 'test-pet')

const pet = (build: (p: PetState) => void = () => {}): PetState => {
  const p = newPet('PIP', 0)
  p.stage = 'child'
  build(p)
  return p
}

describe('care', () => {
  it('is 1 for a pet that was never neglected', () => {
    expect(metrics(pet((p) => (p.care.thrivingSeconds = 1000))).care).toBe(1)
  })

  it('is 0 for a pet that was only ever neglected', () => {
    expect(metrics(pet((p) => (p.care.neglectSeconds = 1000))).care).toBe(0)
  })

  it('is the share of the lived time that went well', () => {
    const p = pet((q) => {
      q.care.neglectSeconds = 250
      q.care.thrivingSeconds = 750
    })
    expect(metrics(p).care).toBe(0.75)
  })

  it('is 1 for a pet with no history at all, rather than dividing by zero', () => {
    expect(metrics(pet()).care).toBe(1)
  })

  it('is docked for each illness the player let happen', () => {
    const well = pet((p) => (p.care.thrivingSeconds = 1000))
    const ill = pet((p) => {
      p.care.thrivingSeconds = 1000
      p.care.sicknessCount = 2
    })
    expect(metrics(ill).care).toBeCloseTo(metrics(well).care - 0.16, 6)
  })

  it('caps the illness penalty, so a bad patch is not unrecoverable', () => {
    const p = pet((q) => {
      q.care.thrivingSeconds = 1000
      q.care.sicknessCount = 50
    })
    expect(metrics(p).care).toBeCloseTo(0.6, 6)
  })

  it('never goes below zero', () => {
    const p = pet((q) => {
      q.care.neglectSeconds = 1000
      q.care.sicknessCount = 10
    })
    expect(metrics(p).care).toBe(0)
  })
})

describe('diet', () => {
  it('is all zero for a pet that has never been fed', () => {
    expect(metrics(pet()).diet).toEqual({ sweet: 0, protein: 0, veg: 0, junk: 0 })
  })

  it('is the share of each axis, summing to one', () => {
    const p = pet((q) => {
      q.diet.sweet = 3
      q.diet.veg = 1
      q.diet.meals = 4
    })
    const { diet } = metrics(p)
    expect(diet.sweet).toBe(0.75)
    expect(diet.veg).toBe(0.25)
    expect(diet.sweet + diet.protein + diet.veg + diet.junk).toBeCloseTo(1, 10)
  })

  it('ignores meals with no axis when working out shares', () => {
    // Medicine counts as a meal but toward nothing, so it must not dilute.
    const p = pet((q) => {
      q.diet.veg = 2
      q.diet.meals = 10
    })
    expect(metrics(p).diet.veg).toBe(1)
  })
})

describe('dietLean', () => {
  it('is null before there are enough meals to read anything into', () => {
    const p = pet((q) => {
      q.diet.veg = 5
      q.diet.meals = 5
    })
    expect(metrics(p).dietLean).toBeNull()
  })

  it('is the dominant axis once there is a sample worth reading', () => {
    const p = pet((q) => {
      q.diet.veg = 6
      q.diet.meals = 6
    })
    expect(metrics(p).dietLean).toBe('veg')
  })

  it('is null for a varied diet with no axis in front', () => {
    const p = pet((q) => {
      q.diet.sweet = 2
      q.diet.protein = 2
      q.diet.veg = 2
      q.diet.junk = 2
      q.diet.meals = 8
    })
    expect(metrics(p).dietLean).toBeNull()
  })

  it('needs a clear majority, not merely the largest slice', () => {
    // 3/8 is the biggest share here, and still not a lean.
    const p = pet((q) => {
      q.diet.sweet = 3
      q.diet.protein = 3
      q.diet.veg = 2
      q.diet.meals = 8
    })
    expect(metrics(p).dietLean).toBeNull()
  })

  it('reads a lean at exactly the threshold share', () => {
    const p = pet((q) => {
      q.diet.sweet = 4
      q.diet.protein = 3
      q.diet.veg = 3
      q.diet.meals = 10
    })
    expect(metrics(p).dietLean).toBe('sweet')
  })

  it('is null when the meal count is there but nothing had an axis', () => {
    const p = pet((q) => (q.diet.meals = 20))
    expect(metrics(p).dietLean).toBeNull()
  })
})

describe('play', () => {
  it('is 0 for a pet that has never played', () => {
    expect(metrics(pet()).play).toBe(0)
  })

  it('is 1 for a pet that plays often and wins', () => {
    const p = pet((q) => {
      q.play.gamesPlayed = 20
      q.play.gamesWon = 20
    })
    expect(metrics(p).play).toBe(1)
  })

  it('does not let one lucky win decide anything', () => {
    const lucky = pet((q) => {
      q.play.gamesPlayed = 1
      q.play.gamesWon = 1
    })
    const seasoned = pet((q) => {
      q.play.gamesPlayed = 20
      q.play.gamesWon = 14
    })
    expect(metrics(lucky).play).toBeLessThan(metrics(seasoned).play)
  })

  it('rewards volume even without a good record', () => {
    const few = pet((q) => {
      q.play.gamesPlayed = 2
      q.play.gamesWon = 0
    })
    const many = pet((q) => {
      q.play.gamesPlayed = 20
      q.play.gamesWon = 0
    })
    expect(metrics(many).play).toBeGreaterThan(metrics(few).play)
  })

  it('stops counting volume past the point it stops mattering', () => {
    const twenty = pet((q) => {
      q.play.gamesPlayed = 20
      q.play.gamesWon = 10
    })
    const hundred = pet((q) => {
      q.play.gamesPlayed = 100
      q.play.gamesWon = 50
    })
    expect(metrics(hundred).play).toBeCloseTo(metrics(twenty).play, 10)
  })
})

describe('sleep', () => {
  it('is a neutral half for a pet that has never been put to bed', () => {
    expect(metrics(pet()).sleep).toBe(0.5)
  })

  it('is 1 for a pet always put to bed on time', () => {
    const p = pet((q) => (q.sleep.onTimeSleeps = 10))
    expect(metrics(p).sleep).toBe(1)
  })

  it('is 0 for a pet never put to bed on time', () => {
    const p = pet((q) => (q.sleep.lateSleeps = 10))
    expect(metrics(p).sleep).toBe(0)
  })

  it('is the punctual share of bedtimes', () => {
    const p = pet((q) => {
      q.sleep.onTimeSleeps = 3
      q.sleep.lateSleeps = 1
    })
    expect(metrics(p).sleep).toBe(0.75)
  })

  it('is docked for time spent awake and exhausted', () => {
    const rested = pet((q) => (q.sleep.onTimeSleeps = 10))
    const worn = pet((q) => {
      q.sleep.onTimeSleeps = 10
      q.sleep.overtiredSeconds = 2 * 3600
    })
    expect(metrics(worn).sleep).toBeCloseTo(1 - 0.5 * 0.6, 6)
    expect(metrics(worn).sleep).toBeLessThan(metrics(rested).sleep)
  })

  it('caps the overtired penalty', () => {
    const p = pet((q) => {
      q.sleep.onTimeSleeps = 10
      q.sleep.overtiredSeconds = 400 * 3600
    })
    expect(metrics(p).sleep).toBeCloseTo(0.4, 6)
  })

  it('never goes below zero', () => {
    const p = pet((q) => {
      q.sleep.lateSleeps = 10
      q.sleep.overtiredSeconds = 100 * 3600
    })
    expect(metrics(p).sleep).toBe(0)
  })
})

describe('the whole reading', () => {
  it('keeps every axis inside 0..1 for a pet raised any which way', () => {
    const wild = pet((q) => {
      q.care.neglectSeconds = 5000
      q.care.thrivingSeconds = 100
      q.care.sicknessCount = 7
      q.diet.junk = 30
      q.diet.meals = 30
      q.play.gamesPlayed = 90
      q.play.gamesWon = 3
      q.sleep.lateSleeps = 40
      q.sleep.overtiredSeconds = 90 * 3600
    })
    const m = metrics(wild)
    for (const value of [m.care, m.play, m.sleep, ...Object.values(m.diet)]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('reads nothing off the pet it is not given', () => {
    const p = pet((q) => (q.care.thrivingSeconds = 100))
    const before = JSON.stringify(p)
    metrics(p)
    expect(JSON.stringify(p)).toBe(before)
  })
})

resetIdSource()

describe('playAxes', () => {
  const played = (chase: number, romp: number, quiet: number) =>
    metrics(pet((p) => (p.play.byAxis = { chase, romp, quiet })))

  it('is flat zero for a pet that has only played the standing three', () => {
    // The property that keeps this from disturbing anything that already
    // branched: a pet that never went outside scores nothing on every axis,
    // so every existing rule reads exactly what it read before.
    expect(played(0, 0, 0)).toMatchObject({
      playAxes: { chase: 0, romp: 0, quiet: 0 },
      playLean: null,
    })
  })

  it('gives a settled habit the whole of its axis', () => {
    expect(played(6, 0, 0).playAxes.chase).toBe(1)
  })

  it('splits an evenly played pet between the axes', () => {
    const m = played(2, 2, 2)
    expect(m.playAxes.chase).toBeCloseTo(1 / 3, 5)
    expect(m.playAxes.romp).toBeCloseTo(1 / 3, 5)
  })

  it('damps a single afternoon, which is not yet a disposition', () => {
    // One game would otherwise read as a pet wholly given over to chasing.
    expect(played(1, 0, 0).playAxes.chase).toBeCloseTo(0.25, 5)
    expect(played(4, 0, 0).playAxes.chase).toBe(1)
  })

  it('never scores an axis above what a whole habit is worth', () => {
    expect(played(50, 0, 0).playAxes.chase).toBe(1)
  })
})

describe('playLean', () => {
  const leaning = (chase: number, romp: number, quiet: number) =>
    metrics(pet((p) => (p.play.byAxis = { chase, romp, quiet }))).playLean

  it('leans nowhere on too small a sample, however lopsided', () => {
    expect(leaning(3, 0, 0)).toBeNull()
  })

  it('names the axis once it is a clear majority', () => {
    expect(leaning(4, 0, 0)).toBe('chase')
    expect(leaning(5, 3, 2)).toBe('chase')
  })

  it('names an axis that is not the first one on the list', () => {
    // The winner is picked by folding along a fixed order, so a lean that only
    // ever showed up on the axis that happens to be checked first would pass
    // whatever the fold did with the rest.
    expect(leaning(0, 5, 0)).toBe('romp')
    expect(leaning(0, 0, 5)).toBe('quiet')
    expect(leaning(1, 2, 5)).toBe('quiet')
  })

  it('leans nowhere when no axis has a majority', () => {
    // Three axes, so being merely ahead is not standing out.
    expect(leaning(3, 3, 2)).toBeNull()
  })

  it('is exactly at the line on a bare majority', () => {
    expect(leaning(5, 3, 2)).toBe('chase')
    expect(leaning(4, 3, 3)).toBeNull()
  })
})
