import { describe, expect, it } from 'vitest'
import type { Metrics } from '../../src/game/metrics'
import {
  legacyOf,
  lineageOf,
  LINEAGE_NUDGE,
  TEMPERAMENTS,
  temperamentFrom,
  temperamentOf,
  withLineage,
  type TemperamentId,
} from '../../src/game/temperament'
import { newPet, resetIdSource, setIdSource } from '../../src/game/save'
import { STAGE_DURATION } from '../../src/game/tuning'
import type { AlbumEntry, PetState } from '../../src/game/types'

/**
 * How a pet turns out, and what that is worth to the pet after it. The
 * temperament is read once and kept for a whole life, so getting it wrong is
 * not a wrong frame -- it is a wrong pet, for hours.
 */

setIdSource(() => 'test-pet')

const ADULT_FROM = STAGE_DURATION.egg + STAGE_DURATION.baby + STAGE_DURATION.child

const reading = (m: Partial<Metrics> = {}): Metrics => ({
  care: 0.78,
  diet: { sweet: 0, protein: 0, veg: 0, junk: 0 },
  dietLean: null,
  play: 0.52,
  sleep: 0.55,
  ...m,
})

describe('TEMPERAMENTS', () => {
  it('has an entry for every id, each with a name and a blurb', () => {
    const ids: TemperamentId[] = ['devoted', 'lively', 'restful', 'easygoing']
    for (const id of ids) {
      expect(TEMPERAMENTS[id].id).toBe(id)
      expect(TEMPERAMENTS[id].name.length).toBeGreaterThan(0)
      expect(TEMPERAMENTS[id].blurb.length).toBeGreaterThan(0)
    }
  })

  it('keeps every blurb inside the two lines of sixteen the status screen has', () => {
    for (const t of Object.values(TEMPERAMENTS)) {
      expect(t.blurb.length).toBeLessThanOrEqual(32)
    }
  })
})

describe('temperamentFrom', () => {
  it('is easygoing for a pet raised entirely unremarkably', () => {
    expect(temperamentFrom(reading())).toBe('easygoing')
  })

  it('is easygoing when nothing stands out by enough', () => {
    // Care is ahead, but by less than the margin a character needs.
    expect(temperamentFrom(reading({ care: 0.83 }))).toBe('easygoing')
  })

  it('is devoted for a pet kept notably well', () => {
    expect(temperamentFrom(reading({ care: 1 }))).toBe('devoted')
  })

  it('is lively for a pet played with notably often', () => {
    expect(temperamentFrom(reading({ play: 1 }))).toBe('lively')
  })

  it('is restful for a pet kept to notably good hours', () => {
    expect(temperamentFrom(reading({ sleep: 1 }))).toBe('restful')
  })

  it('measures standing out against what is normal for that axis, not raw', () => {
    // Care sits high for anyone half attentive: a raw comparison would call
    // this devoted, when it is the play score that is actually exceptional.
    expect(temperamentFrom(reading({ care: 0.8, play: 0.95 }))).toBe('lively')
  })

  it('picks the leader when two axes are both strong but one is clearly ahead', () => {
    expect(temperamentFrom(reading({ care: 0.95, sleep: 0.95 }))).toBe('restful')
  })

  it('falls back to easygoing when two strong axes are neck and neck', () => {
    // care 0.98 - 0.78 = 0.20; sleep 0.75 - 0.55 = 0.20. A dead heat.
    expect(temperamentFrom(reading({ care: 0.98, sleep: 0.75 }))).toBe('easygoing')
  })

  it('is easygoing for a pet that was raised badly on every axis', () => {
    expect(temperamentFrom(reading({ care: 0, play: 0, sleep: 0 }))).toBe('easygoing')
  })
})

describe('temperamentOf', () => {
  const pet = (overrides: Partial<PetState>): PetState =>
    Object.assign(newPet('PIP', 0), overrides)

  it('is null while the pet is still growing', () => {
    expect(temperamentOf(pet({ stage: 'child', temperament: 'lively' }))).toBeNull()
  })

  it('is null for an adult saved before temperaments existed', () => {
    expect(temperamentOf(pet({ stage: 'adult' }))).toBeNull()
  })

  it('is the temperament for a grown pet that has one', () => {
    expect(temperamentOf(pet({ stage: 'adult', temperament: 'restful' }))).toBe(
      TEMPERAMENTS.restful,
    )
  })

  it('is null rather than undefined for an id that is not one of ours', () => {
    expect(temperamentOf(pet({ stage: 'adult', temperament: 'grumpy' as never }))).toBeNull()
  })
})

describe('legacyOf', () => {
  const grown = (ageMs: number, care = 1): PetState => {
    const p = newPet('PIP', 0)
    p.stage = 'adult'
    p.ageMs = ageMs
    p.care.thrivingSeconds = care * 1000
    p.care.neglectSeconds = (1 - care) * 1000
    return p
  }

  it('is nothing for a pet retired the moment it came of age', () => {
    expect(legacyOf(grown(ADULT_FROM))).toBe(0)
  })

  it('is nothing for a pet that never even grew up', () => {
    expect(legacyOf(grown(0))).toBe(0)
  })

  it('is 0.9 for a doted-on pet allowed a full grown life', () => {
    expect(legacyOf(grown(ADULT_FROM + STAGE_DURATION.adult, 1))).toBeCloseTo(0.9, 6)
  })

  it('reaches 1 when the board was filled too', () => {
    expect(legacyOf(grown(ADULT_FROM + STAGE_DURATION.adult, 1), 1)).toBeCloseTo(1, 6)
  })

  it('rises with the time the pet was allowed to be grown up', () => {
    const half = legacyOf(grown(ADULT_FROM + STAGE_DURATION.adult / 2))
    const full = legacyOf(grown(ADULT_FROM + STAGE_DURATION.adult))
    expect(full).toBeGreaterThan(half)
    expect(half).toBeGreaterThan(0)
  })

  it('rises with how well the pet was kept', () => {
    const age = ADULT_FROM + STAGE_DURATION.adult
    expect(legacyOf(grown(age, 1))).toBeGreaterThan(legacyOf(grown(age, 0)))
  })

  it('gates every term on having lived, so exploring alone is worth nothing', () => {
    expect(legacyOf(grown(ADULT_FROM), 1)).toBe(0)
  })

  it('gives no bonus for outliving a full grown life', () => {
    const full = legacyOf(grown(ADULT_FROM + STAGE_DURATION.adult, 1), 1)
    const ancient = legacyOf(grown(ADULT_FROM + 10 * STAGE_DURATION.adult, 1), 1)
    expect(ancient).toBe(full)
  })

  it('never exceeds one', () => {
    expect(legacyOf(grown(1e12, 1), 5)).toBeLessThanOrEqual(1)
  })

  it('treats an unexplored board as the default', () => {
    expect(legacyOf(grown(ADULT_FROM + STAGE_DURATION.adult, 1))).toBe(
      legacyOf(grown(ADULT_FROM + STAGE_DURATION.adult, 1), 0),
    )
  })
})

describe('lineageOf', () => {
  const entry = (temperament: TemperamentId | undefined, legacy?: number): AlbumEntry => ({
    speciesId: 'mochi',
    name: 'PIP',
    retiredAt: 0,
    temperament,
    legacy,
  })

  it('is null for an empty album', () => {
    expect(lineageOf([])).toBeNull()
  })

  it('is null for a single half-lived ancestor, which is a coincidence', () => {
    expect(lineageOf([entry('restful', 0.5)])).toBeNull()
  })

  it('is the leaning once the family weight is there', () => {
    expect(lineageOf([entry('restful', 1)])).toBe('restful')
  })

  it('adds up across a family', () => {
    expect(lineageOf([entry('lively', 0.6), entry('lively', 0.5)])).toBe('lively')
  })

  it('picks the heaviest leaning, not the commonest', () => {
    const album = [entry('devoted', 0.4), entry('devoted', 0.4), entry('lively', 1)]
    expect(lineageOf(album)).toBe('lively')
  })

  it('ignores ancestors with no temperament recorded', () => {
    expect(lineageOf([entry(undefined, 1), entry('restful', 1)])).toBe('restful')
  })

  it('is null when every ancestor lacks a temperament', () => {
    expect(lineageOf([entry(undefined, 1), entry(undefined, 1)])).toBeNull()
  })

  it('treats an ancestor with no legacy recorded as a modest middling life', () => {
    // Three at the default 0.4 clears the threshold; two do not.
    expect(lineageOf([entry('devoted'), entry('devoted')])).toBeNull()
    expect(lineageOf([entry('devoted'), entry('devoted'), entry('devoted')])).toBe('devoted')
  })

  it('is null when no leaning reaches the threshold on its own', () => {
    expect(lineageOf([entry('devoted', 0.5), entry('lively', 0.5)])).toBeNull()
  })
})

describe('withLineage', () => {
  it('changes nothing when the family leans no particular way', () => {
    const m = reading()
    expect(withLineage(m, null)).toBe(m)
  })

  it('nudges care for a devoted family', () => {
    const m = withLineage(reading({ care: 0.5 }), 'devoted')
    expect(m.care).toBeCloseTo(0.5 + LINEAGE_NUDGE, 6)
    expect(m.play).toBe(0.52)
  })

  it('nudges play for a lively family', () => {
    expect(withLineage(reading({ play: 0.5 }), 'lively').play).toBeCloseTo(0.5 + LINEAGE_NUDGE, 6)
  })

  it('nudges sleep for a restful family', () => {
    expect(withLineage(reading({ sleep: 0.5 }), 'restful').sleep).toBeCloseTo(0.5 + LINEAGE_NUDGE, 6)
  })

  it('nudges nothing for an easygoing family, which settled on nothing', () => {
    const m = reading()
    expect(withLineage(m, 'easygoing')).toEqual(m)
  })

  it('never pushes a reading past one', () => {
    expect(withLineage(reading({ care: 0.98 }), 'devoted').care).toBe(1)
  })

  it('leaves the original reading alone, so the status screen stays about this pet', () => {
    const m = reading({ care: 0.5 })
    withLineage(m, 'devoted')
    expect(m.care).toBe(0.5)
  })

  it('tips a pet that was raised without a character of its own', () => {
    // The whole point of the nudge: a family of restful pets makes the next
    // unremarkable one restful too. This is the strategy, not a bug.
    const flat = reading()
    expect(temperamentFrom(flat)).toBe('easygoing')
    expect(temperamentFrom(withLineage(flat, 'restful'))).toBe('restful')
  })

  it('does not overrule a pet that was clearly raised one way', () => {
    const clear = reading({ play: 1 })
    expect(temperamentFrom(withLineage(clear, 'restful'))).toBe('lively')
    expect(temperamentFrom(withLineage(clear, 'devoted'))).toBe('lively')
  })
})

resetIdSource()
