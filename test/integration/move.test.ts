import { describe, expect, it } from 'vitest'
import { harness, type Harness } from '../harness'
import { MEADOW_GROUNDS, WOODLAND_GROUNDS } from '../../src/data/grounds'
import { BIOMES } from '../../src/data/biome'
import { emptySave, flushSave } from '../../src/game/save'
import type { Planting } from '../../src/game/yard'
import type { SaveFile } from '../../src/game/types'

/**
 * Moving house.
 *
 * The point of these is not that the colours change -- it is that the grounds
 * and the visitors come with the house, that the garden does not, and that the
 * friends do. Everything below is one of those three claims.
 */

const grownUp = (save?: Partial<SaveFile>): Harness =>
  harness({ random: 1, save: { ...emptySave(), ...save } })
    .start()
    .growTo('adult')

/** A tree, on one of the verge pitches a real planting would land on. */
const TREE: Planting = { kind: 'sapling', x: -6.1, z: -1.42, plantedAt: 0 }

/** Opens the move menu from an adult's status screen and picks a place by name. */
function moveTo(h: Harness, name: string): Harness {
  h.select('status')
  h.holdMove()
  expect(h.app.mode, 'the move menu should be open').toBe('move')
  for (let step = 0; step < h.app.homes.length; step++) {
    if (h.app.homes[h.app.moveIndex]!.id === name) {
      h.tap('b')
      // The pet walks off while the new ground is built; wait for it to arrive.
      return h.advance(3)
    }
    h.tap('c')
  }
  throw new Error(`no ${name} on the move menu`)
}

describe('opening the move menu', () => {
  it('is reached by holding C on an adult"s status screen', () => {
    const h = grownUp()
    h.select('status')
    expect(h.app.mode).toBe('status')
    h.holdMove()
    expect(h.app.mode).toBe('move')
  })

  it('reports the hold as it runs, so it never fires by surprise', () => {
    const h = grownUp()
    h.select('status')
    h.app.press('c')
    h.advance(0.4)
    expect(h.app.moveProgress).toBeGreaterThan(0)
    expect(h.app.moveProgress).toBeLessThan(1)
    h.app.release('c')
    expect(h.app.moveProgress).toBe(0)
  })

  it('closes the status screen on a short tap of C, as it always did', () => {
    const h = grownUp()
    h.select('status')
    h.tap('c')
    expect(h.app.mode).toBe('main')
  })

  it('stays shut for a child, which has no business moving house', () => {
    const h = harness({ random: 1 }).start().growTo('child')
    h.select('status')
    h.holdMove()
    expect(h.app.mode).not.toBe('move')
  })

  it('opens on the place the family already lives', () => {
    const h = grownUp()
    h.select('status')
    h.holdMove()
    expect(h.app.homes[h.app.moveIndex]!.id).toBe('meadow')
  })

  it('backs out without moving anyone', () => {
    const h = grownUp()
    h.select('status')
    h.holdMove()
    h.holdBack()
    expect(h.app.mode).not.toBe('move')
    expect(h.app.biome.id).toBe('meadow')
  })

  it('refuses to move somewhere the family already is', () => {
    const h = grownUp()
    h.select('status')
    h.holdMove()
    h.tap('b')
    h.advance(3)
    expect(h.app.biome.id).toBe('meadow')
  })
})

describe('moving', () => {
  it('changes where the family lives, and says so', () => {
    const h = moveTo(grownUp(), 'woodland')
    expect(h.app.biome.id).toBe('woodland')
  })

  it('takes the pet out of sight while the new ground is built', () => {
    const h = grownUp()
    h.select('status')
    h.holdMove()
    h.tap('c')
    h.tap('b')
    expect(h.app.isSettling).toBe(true)
    expect(h.calls.some((c) => c.kind === 'depart')).toBe(true)
    h.advance(3)
    expect(h.app.isSettling).toBe(false)
  })

  it('costs the pet a day"s walking and leaves it unsettled', () => {
    const h = grownUp()
    const before = { ...h.pet.stats }
    moveTo(h, 'woodland')
    expect(h.pet.stats.energy).toBeLessThan(before.energy)
    expect(h.pet.stats.happiness).toBeLessThan(before.happiness)
  })

  it('refuses to move a pet with no walk left in it', () => {
    const h = grownUp()
    h.pet.stats.energy = 5
    h.select('status')
    h.holdMove()
    h.tap('c')
    h.tap('b')
    h.advance(3)
    expect(h.app.biome.id).toBe('meadow')
  })

  it('survives the trip in storage, so the family is still there next session', () => {
    const h = moveTo(grownUp(), 'woodland')
    flushSave()
    expect(h.stored()!.home).toBe('woodland')
  })
})

describe('what moving changes', () => {
  it('hands the pet a whole new set of grounds', () => {
    const h = grownUp()
    expect(h.app.grounds).toEqual(MEADOW_GROUNDS)
    moveTo(h, 'woodland')
    expect(h.app.grounds).toEqual(WOODLAND_GROUNDS)
  })

  it('changes who could turn up in the yard', () => {
    const h = grownUp()
    expect(h.app.roster).toContain('butterfly')
    moveTo(h, 'woodland')
    expect(h.app.roster).toContain('moth')
    expect(h.app.roster).not.toContain('butterfly')
  })

  it('still has something to play with wherever it goes', () => {
    // The whole reason a game asks for a role rather than a named visitor.
    for (const biome of BIOMES) {
      const h = grownUp()
      if (biome.id !== 'meadow') moveTo(h, biome.id)
      expect(h.app.playMenu.length, biome.id).toBeGreaterThan(0)
    }
  })
})

describe('the garden and the friends', () => {
  const withGarden = () => grownUp({ yard: { gardens: { meadow: [TREE] }, strays: [] } })

  it('leaves the garden standing where it was planted', () => {
    const h = withGarden()
    expect(h.app.planted).toHaveLength(1)
    moveTo(h, 'woodland')
    expect(h.app.planted).toHaveLength(0)
  })

  it('finds it still standing on the way back', () => {
    const h = withGarden()
    moveTo(h, 'woodland')
    moveTo(h, 'meadow')
    expect(h.app.planted).toHaveLength(1)
  })

  it('keeps the trees in storage rather than only in memory', () => {
    const h = withGarden()
    moveTo(h, 'woodland')
    flushSave()
    expect(h.stored()!.yard.gardens.meadow).toHaveLength(1)
  })

  it('brings the friends along, even where they do not belong', () => {
    const h = grownUp({ yard: { gardens: {}, strays: ['rabbit'] } })
    moveTo(h, 'woodland')
    expect(h.app.regulars).toContain('rabbit')
    expect(h.app.roster).toContain('rabbit')
  })
})

describe('a save from before anyone could move', () => {
  it('finds the family in the meadow with its garden intact', () => {
    const h = harness({
      raw: JSON.stringify({
        ...emptySave(),
        version: 6,
        home: undefined,
        yard: { plantings: [TREE], strays: ['rabbit'] },
      }),
    }).boot()
    expect(h.app.biome.id).toBe('meadow')
    expect(h.app.planted).toHaveLength(1)
    expect(h.app.regulars).toEqual(['rabbit'])
  })

  it('can move the migrated family on, garden and all', () => {
    const h = harness({
      random: 1,
      raw: JSON.stringify({
        ...emptySave(),
        version: 6,
        home: undefined,
        yard: { plantings: [TREE], strays: ['rabbit'] },
      }),
    })
      .start()
      .growTo('adult')
    moveTo(h, 'woodland')
    expect(h.app.biome.id).toBe('woodland')
    expect(h.app.planted).toHaveLength(0)
    expect(h.app.regulars).toContain('rabbit')
  })
})
