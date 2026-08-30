import { describe, expect, it } from 'vitest'
import { DEFAULT_START, harness, type Harness } from '../harness'
import { emptySave, flushSave } from '../../src/game/save'
import { STAGE_DURATION } from '../../src/game/tuning'
import { speciesOf, SPECIES_COUNT } from '../../src/data/species'

/**
 * A whole life, and the one after it. This is the loop the game is: an egg
 * hatches, is raised into something, is seen off, and leaves the next egg a
 * little better provisioned. Every step of it is hours long in play and a few
 * milliseconds here, which is the whole reason for the harness.
 */

const ADULT_FROM = STAGE_DURATION.egg + STAGE_DURATION.baby + STAGE_DURATION.child

describe('growing up', () => {
  it('hatches the egg once it has waited out its stage', () => {
    const h = harness().start()
    expect(h.pet.stage).toBe('egg')
    h.clearCalls().ripen()
    expect(h.app.mode).toBe('evolve')
    expect(h.pet.speciesId).toBe('blob')
    expect(h.app.evolution).toMatchObject({ fromName: 'Egg', toName: 'Blobbit' })
  })

  it('makes a hatching sound the first time and an evolving one after', () => {
    const h = harness().start()
    h.clearCalls().ripen()
    expect(h.soundsPlayed()).toContain('hatch')
    h.tap('b').clearCalls().ripen()
    expect(h.soundsPlayed()).toContain('evolve')
  })

  it('tells the renderer to swap the model', () => {
    const h = harness().start()
    h.clearCalls().ripen()
    expect(h.calls).toContainEqual({ kind: 'form', speciesId: 'blob', animate: true })
  })

  it('announces the change on the ticker', () => {
    const h = harness().start()
    h.ripen()
    h.until('the evolution line', () => h.app.tickerText.includes('BECAME BLOBBIT'))
  })

  it('interrupts whatever screen is up, since it is the payoff', () => {
    const h = harness().start()
    h.select('status')
    expect(h.app.mode).toBe('status')
    h.ripen()
    expect(h.app.mode).toBe('evolve')
  })

  it('waits for a game to finish rather than cutting it short', () => {
    const h = harness().start().growTo('child')
    h.select('play')
    h.tap('b')
    expect(h.app.mode).toBe('playing')
    h.pet.ageMs = ADULT_FROM
    h.frame()
    expect(h.app.mode).toBe('playing')
  })

  it('is dismissed by any button, back to the pet', () => {
    const h = harness().start()
    h.ripen()
    h.tap('b')
    expect(h.app.mode).toBe('main')
  })

  it('records each form in the pet and in the lineage', () => {
    const h = harness().start().growTo('child')
    expect(h.pet.discovered).toContain('blob')
    expect(h.app.discoveredIds).toContain('blob')
    expect(h.app.discoveredCount).toBeGreaterThan(1)
  })

  it('never counts a form beyond the total the collection screen shows', () => {
    const h = harness().start().growTo('adult')
    expect(h.app.discoveredCount).toBeLessThanOrEqual(SPECIES_COUNT)
  })

  it('goes egg to baby to child to adult, in that order', () => {
    const h = harness().start()
    const stages = [h.pet.stage]
    for (let i = 0; i < 3; i++) {
      h.ripen()
      if (h.app.mode === 'evolve') h.tap('b')
      stages.push(h.pet.stage)
    }
    expect(stages).toEqual(['egg', 'baby', 'child', 'adult'])
  })

  it('settles a temperament on growing up, and keeps it', () => {
    const h = harness().start().growTo('adult')
    expect(h.pet.temperament).toBeDefined()
    expect(h.app.temperament).not.toBeNull()
    const settled = h.pet.temperament
    h.advance(30)
    expect(h.pet.temperament).toBe(settled)
  })

  it('has no temperament to report while the pet is still growing', () => {
    const h = harness().start().growTo('child')
    expect(h.app.temperament).toBeNull()
  })

  it('says what the pet is currently earning, so the stakes are visible', () => {
    const h = harness().start().growTo('baby')
    expect(h.app.leaning).not.toBeNull()
    expect(typeof h.app.leaning).toBe('string')
  })

  it('has nothing to say about an egg"s leaning', () => {
    expect(harness().start().app.leaning).toBeNull()
  })

  it('has nothing to say about a form with nowhere left to go', () => {
    const h = harness().start().growTo('adult')
    h.pet.speciesId = 'somnix'
    expect(h.app.leaning).toBeNull()
  })

  it('lives a whole life in real frames, not just in fast-forwarded ages', () => {
    // The one test that actually sits through it, with coarse frames. It
    // proves the stages are reached by time passing rather than by a helper.
    const h = harness().start()
    h.advance(STAGE_DURATION.egg / 1000 + 1, 1)
    expect(h.pet.stage).toBe('baby')
    expect(h.app.mode).toBe('evolve')
    h.tap('b')
    h.advance(STAGE_DURATION.baby / 1000 + 1, 5)
    expect(h.pet.stage).toBe('child')
  })
})

describe('the status screen', () => {
  it('opens and closes on a tap', () => {
    const h = harness().start()
    h.select('status')
    expect(h.app.mode).toBe('status')
    h.tap('c')
    expect(h.app.mode).toBe('main')
  })

  it('closes on a tap of b that started on the screen itself', () => {
    const h = harness().start().growTo('adult')
    h.select('status')
    expect(h.app.mode).toBe('status')
    h.tap('b')
    expect(h.app.mode).toBe('main')
  })

  it('does not close on the release of the press that opened it', () => {
    // `select` is a press and a release, exactly as a tap is. The release
    // arrives with the status screen already up, and must not close it again.
    const h = harness().start().growTo('adult')
    h.select('status')
    expect(h.app.mode).toBe('status')
  })

  it('opens the collection board with a', () => {
    const h = harness().start()
    h.select('status')
    h.tap('a')
    expect(h.app.mode).toBe('curios')
  })

  it('reports the metrics for a pet and nothing for none', () => {
    const h = harness().start()
    expect(h.app.metrics).not.toBeNull()
    h.app.restart()
    expect(h.app.metrics).toBeNull()
  })
})

describe('retiring', () => {
  /** Grows a pet up and gives it a life worth passing on. */
  function grownAndLived(): Harness {
    const h = harness().start().growTo('adult')
    // A hair short of the elder threshold: a full life"s worth of legacy, but
    // not so far that the pet evolves out from under the retirement hold.
    h.pet.ageMs = ADULT_FROM + STAGE_DURATION.adult - 60_000
    h.pet.care.thrivingSeconds = 10_000
    h.pet.care.neglectSeconds = 0
    return h
  }

  it('is offered only to a grown pet', () => {
    const child = harness().start().growTo('child')
    child.select('status')
    child.app.press('b')
    child.advance(2)
    expect(child.app.retireProgress).toBe(0)
    expect(child.app.mode).toBe('main')
  })

  it('needs a long hold, not a tap', () => {
    const h = grownAndLived()
    h.select('status')
    h.app.press('b')
    h.advance(0.5)
    expect(h.app.retireProgress).toBeGreaterThan(0)
    expect(h.app.retireProgress).toBeLessThan(1)
    h.app.release('b')
    expect(h.app.mode).toBe('main')
  })

  it('has no progress to show when b is not the button being held', () => {
    const h = grownAndLived()
    h.select('status')
    h.app.press('a')
    expect(h.app.retireProgress).toBe(0)
  })

  it('sees the pet off on a full hold', () => {
    const h = grownAndLived()
    const name = h.pet.name
    h.select('status')
    h.clearCalls().holdRetire()
    expect(h.app.mode).toBe('retire')
    expect(h.app.retiring).toEqual({ name, speciesName: speciesOf(h.pet.speciesId).name })
    expect(h.calls).toContainEqual({ kind: 'depart' })
  })

  it('adds the pet to the album with what its life was worth', () => {
    const h = grownAndLived()
    h.select('status').holdRetire()
    flushSave()
    const album = h.stored()!.album
    expect(album).toHaveLength(1)
    expect(album[0]!.name).toBe('PIP')
    expect(album[0]!.legacy).toBeGreaterThan(0.5)
    expect(album[0]!.temperament).toBe(h.pet.temperament)
  })

  it('counts the retirement', () => {
    const h = grownAndLived()
    h.select('status').holdRetire()
    flushSave()
    expect(h.stored()!.counters.retirements).toBe(1)
  })

  it('clears the way for the next egg once the ceremony is dismissed', () => {
    const h = grownAndLived()
    h.select('status').holdRetire()
    h.tap('b')
    expect(h.app.mode).toBe('name')
    expect(h.app.pet).toBeNull()
    expect(h.app.retiring).toBeNull()
  })

  it('keeps the lineage: the album, the discoveries and the yard all outlive the pet', () => {
    const h = grownAndLived()
    const discovered = [...h.app.discoveredIds]
    h.select('status').holdRetire()
    h.tap('b')
    expect(h.app.discoveredIds).toEqual(expect.arrayContaining(discovered))
    h.tap('b')
    expect(h.app.pet).not.toBeNull()
    expect(h.app.discoveredIds).toEqual(expect.arrayContaining(discovered))
  })

  it('makes retiring the instant a pet grows up worth almost nothing', () => {
    const h = harness().start().growTo('adult')
    // Not aged past coming of age, and so worth nothing to pass on.
    h.select('status').holdRetire()
    flushSave()
    expect(h.stored()!.album[0]!.legacy).toBeLessThan(0.05)
  })

  it('provisions the next egg from the life that was actually lived', () => {
    const h = grownAndLived()
    h.select('status').holdRetire()
    h.tap('b')
    h.tap('b')
    expect(h.pet.stats.happiness).toBeGreaterThan(70)
  })
})

describe('the elders', () => {
  /** An adult of a stated temperament, old enough to become an elder. */
  function elderly(temperament: 'devoted' | 'lively' | 'restful' | 'easygoing') {
    const h = harness().start().growTo('adult')
    h.pet.temperament = temperament
    h.pet.ageMs = ADULT_FROM + STAGE_DURATION.adult
    return h
  }

  it('turns a devoted adult into a Wardenor after a full grown life', () => {
    const h = elderly('devoted')
    h.frame()
    expect(h.pet.speciesId).toBe('warden')
    expect(h.app.mode).toBe('evolve')
  })

  it('turns a lively one into a Zephyrix and a restful one into a Somnix', () => {
    expect(elderly('lively').frame().pet.speciesId).toBe('zephyrix')
    expect(elderly('restful').frame().pet.speciesId).toBe('somnix')
  })

  it('leaves an easygoing adult as it is, having settled on nothing', () => {
    const h = elderly('easygoing')
    h.advance(2)
    expect(h.app.mode).toBe('main')
    expect(['mochi', 'aurora', 'gloop', 'blaze', 'grump', 'verdant', 'lumen']).toContain(
      h.pet.speciesId,
    )
  })

  it('does not tip an adult into an elder before it has earned the time', () => {
    const h = harness().start().growTo('adult')
    h.pet.temperament = 'devoted'
    h.pet.ageMs = ADULT_FROM + STAGE_DURATION.adult - 1000
    h.advance(0.5)
    expect(h.pet.speciesId).not.toBe('warden')
  })

  it('leaves an elder as the end of the line', () => {
    const h = elderly('restful')
    h.frame().tap('b')
    h.pet.ageMs = ADULT_FROM + 10 * STAGE_DURATION.adult
    h.advance(2)
    expect(h.pet.speciesId).toBe('somnix')
    expect(h.app.mode).toBe('main')
  })
})

describe('a family', () => {
  it('leans the way its forebears did, once there is enough of a line', () => {
    const h = harness({
      save: {
        ...emptySave(),
        album: [
          { speciesId: 'somnix', name: 'A', retiredAt: 0, legacy: 0.9, temperament: 'restful' },
          { speciesId: 'somnix', name: 'B', retiredAt: 0, legacy: 0.9, temperament: 'restful' },
        ],
      },
    }).start()
    expect(h.app.lineage).toBe('restful')
  })

  it('leans no particular way from a single half-lived ancestor', () => {
    const h = harness({
      save: {
        ...emptySave(),
        album: [{ speciesId: 'mochi', name: 'A', retiredAt: 0, legacy: 0.4, temperament: 'lively' }],
      },
    }).start()
    expect(h.app.lineage).toBeNull()
  })

  it('has no leaning at all with an empty album', () => {
    expect(harness().start().app.lineage).toBeNull()
  })

  it('does not overrule a pet raised clearly the other way', () => {
    const h = harness({
      start: DEFAULT_START,
      save: {
        ...emptySave(),
        album: [
          { speciesId: 'somnix', name: 'A', retiredAt: 0, legacy: 1, temperament: 'restful' },
          { speciesId: 'somnix', name: 'B', retiredAt: 0, legacy: 1, temperament: 'restful' },
        ],
      },
    }).start()
    h.growTo('child')
    // A pet played with constantly is lively however restful its family is.
    h.pet.play.gamesPlayed = 40
    h.pet.play.gamesWon = 40
    h.pet.sleep.lateSleeps = 10
    h.growTo('adult')
    expect(h.pet.temperament).toBe('lively')
  })
})
