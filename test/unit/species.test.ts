import { describe, expect, it } from 'vitest'
import {
  chooseBranch,
  speciesOf,
  SPECIES,
  SPECIES_COUNT,
  SPECIES_LIST,
  type BranchContext,
} from '../../src/data/species'
import type { Metrics } from '../../src/game/metrics'
import { newPet, resetIdSource, setIdSource } from '../../src/game/save'
import { expandLayers } from '../../src/data/voxel-format'
import type { PetState } from '../../src/game/types'

/**
 * The branching table: what a pet becomes, and why. Every rule here is a
 * promise made to a player who spent hours on it, so the tests are less about
 * the arithmetic than about the promises -- greens and early nights really do
 * get you a Sproutling, and no combination of care leaves a pet stuck.
 */

setIdSource(() => 'test-pet')

const reading = (m: Partial<Metrics> = {}): Metrics => ({
  care: 0.5,
  diet: { sweet: 0, protein: 0, veg: 0, junk: 0 },
  dietLean: null,
  play: 0.5,
  sleep: 0.5,
  ...m,
})

const pet = (speciesId: string, overrides: Partial<PetState> = {}): PetState => {
  const p = newPet('PIP', 0)
  p.speciesId = speciesId
  p.stage = speciesOf(speciesId).stage
  return Object.assign(p, overrides)
}

const SPRING: BranchContext = { season: 'spring', lineage: null }
const WINTER: BranchContext = { season: 'winter', lineage: null }

describe('the table', () => {
  it('counts every form', () => {
    expect(SPECIES_COUNT).toBe(SPECIES_LIST.length)
    expect(SPECIES.size).toBe(SPECIES_COUNT)
  })

  it('gives every form a unique id', () => {
    const ids = SPECIES_LIST.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every form a name, a blurb and a model', () => {
    for (const species of SPECIES_LIST) {
      expect(species.name.length).toBeGreaterThan(0)
      expect(species.blurb.length).toBeGreaterThan(0)
      expect(species.model.layers.length).toBeGreaterThan(0)
    }
  })

  it('gives every form an 8x8 album glyph', () => {
    for (const species of SPECIES_LIST) {
      const rows = species.glyph.split('/')
      expect(rows, species.id).toHaveLength(8)
      for (const row of rows) expect(row, species.id).toHaveLength(8)
    }
  })

  it('gives every model a palette entry for every character it uses', () => {
    for (const species of SPECIES_LIST) {
      for (const layer of expandLayers(species.model)) {
        for (const row of layer) {
          for (const ch of row) {
            if (ch === '.') continue
            expect(species.model.palette[ch], `${species.id} missing '${ch}'`).toBeDefined()
          }
        }
      }
    }
  })

  it('only ever branches to a form that exists', () => {
    for (const species of SPECIES_LIST) {
      for (const branch of species.branches) {
        expect(() => speciesOf(branch.to), `${species.id} -> ${branch.to}`).not.toThrow()
      }
    }
  })

  it('gives every branch a reason short enough for the evolution screen', () => {
    for (const species of SPECIES_LIST) {
      for (const branch of species.branches) {
        expect(branch.because.length).toBeGreaterThan(0)
        expect(branch.because.length).toBeLessThanOrEqual(40)
      }
    }
  })

  it('never branches backwards down the stages', () => {
    const order = { egg: 0, baby: 1, child: 2, adult: 3 }
    for (const species of SPECIES_LIST) {
      for (const branch of species.branches) {
        expect(order[speciesOf(branch.to).stage]).toBeGreaterThanOrEqual(order[species.stage])
      }
    }
  })

  it('leaves the elders themselves terminal', () => {
    for (const id of ['warden', 'zephyrix', 'somnix']) {
      expect(speciesOf(id).branches).toEqual([])
    }
  })

  it('hangs the elder branches off every ordinary adult', () => {
    const adults = SPECIES_LIST.filter(
      (s) => s.stage === 'adult' && !['warden', 'zephyrix', 'somnix'].includes(s.id),
    )
    expect(adults.length).toBeGreaterThan(0)
    for (const adult of adults) {
      expect(adult.branches.map((b) => b.to).sort()).toEqual(['somnix', 'warden', 'zephyrix'])
    }
  })

  it('has every form reachable from the egg', () => {
    const seen = new Set<string>(['egg'])
    const queue = ['egg']
    while (queue.length > 0) {
      const id = queue.shift()!
      for (const branch of speciesOf(id).branches) {
        if (seen.has(branch.to)) continue
        seen.add(branch.to)
        queue.push(branch.to)
      }
    }
    const unreachable = SPECIES_LIST.filter((s) => !seen.has(s.id)).map((s) => s.id)
    expect(unreachable).toEqual([])
  })
})

describe('speciesOf', () => {
  it('finds a form by id', () => {
    expect(speciesOf('blob').name).toBe('Blobbit')
  })

  it('throws loudly on an id that does not exist', () => {
    expect(() => speciesOf('dragon')).toThrow('Unknown species: dragon')
  })
})

describe('chooseBranch', () => {
  it('hatches an egg, whatever the raising', () => {
    expect(chooseBranch(pet('egg'), reading(), SPRING)?.to).toBe('blob')
  })

  it('is null for a form with nowhere to go', () => {
    expect(chooseBranch(pet('somnix'), reading(), SPRING)).toBeNull()
  })

  it('is null for an adult whose temperament opens nothing', () => {
    expect(chooseBranch(pet('mochi', { temperament: 'easygoing' }), reading(), SPRING)).toBeNull()
  })

  it('is null for an adult with no temperament at all', () => {
    expect(chooseBranch(pet('mochi'), reading(), SPRING)).toBeNull()
  })

  describe('from a blobbit', () => {
    it('makes a sweet tooth and a quiet life into a Pudgeling', () => {
      const m = reading({ diet: { sweet: 1, protein: 0, veg: 0, junk: 0 }, play: 0 })
      expect(chooseBranch(pet('blob'), m, SPRING)?.to).toBe('pudge')
    })

    it('makes hearty meals and constant play into a Spikelet', () => {
      const m = reading({ diet: { sweet: 0, protein: 1, veg: 0, junk: 0 }, play: 1 })
      expect(chooseBranch(pet('blob'), m, SPRING)?.to).toBe('spike')
    })

    it('makes greens and early nights into a Sproutling', () => {
      const m = reading({ diet: { sweet: 0, protein: 0, veg: 1, junk: 0 }, sleep: 1, play: 0 })
      expect(chooseBranch(pet('blob'), m, SPRING)?.to).toBe('sprout')
    })

    it('still picks something for a pet raised on nothing in particular', () => {
      expect(chooseBranch(pet('blob'), reading(), SPRING)).not.toBeNull()
    })
  })

  describe('from a child', () => {
    it('makes attentive care into a Mochimo', () => {
      const m = reading({ care: 1, diet: { sweet: 1, protein: 0, veg: 0, junk: 0 }, sleep: 1 })
      expect(chooseBranch(pet('pudge'), m, SPRING)?.to).toBe('mochi')
    })

    it('makes junk food and long silences into a Gloopus', () => {
      const m = reading({ care: 0, diet: { sweet: 0, protein: 0, veg: 0, junk: 1 } })
      expect(chooseBranch(pet('pudge'), m, SPRING)?.to).toBe('gloop')
    })

    it('makes a winning streak into a Blazeon', () => {
      const m = reading({ play: 1, care: 1, diet: { sweet: 0, protein: 1, veg: 0, junk: 0 } })
      expect(chooseBranch(pet('spike'), m, SPRING)?.to).toBe('blaze')
    })

    it('makes boredom and neglect into a Grumphal', () => {
      const m = reading({ care: 0, play: 0 })
      expect(chooseBranch(pet('spike'), m, SPRING)?.to).toBe('grump')
    })

    it('makes greens and a steady bedtime into a Verdantis', () => {
      const m = reading({ diet: { sweet: 0, protein: 0, veg: 1, junk: 0 }, sleep: 1, play: 0 })
      expect(chooseBranch(pet('sprout'), m, SPRING)?.to).toBe('verdant')
    })

    it('makes devoted care and very late nights into a Lumenox', () => {
      const m = reading({ care: 1, sleep: 0, play: 1 })
      expect(chooseBranch(pet('sprout'), m, SPRING)?.to).toBe('lumen')
    })
  })

  describe('the winter branch', () => {
    it('is unavailable outside winter, whatever the care', () => {
      for (const from of ['pudge', 'spike', 'sprout']) {
        const m = reading({ care: 1 })
        for (const season of ['spring', 'summer', 'autumn'] as const) {
          expect(chooseBranch(pet(from), m, { season, lineage: null })?.to).not.toBe('aurora')
        }
      }
    })

    it('is what devotion through a long winter earns', () => {
      for (const from of ['pudge', 'spike', 'sprout']) {
        expect(chooseBranch(pet(from), reading({ care: 1 }), WINTER)?.to).toBe('aurora')
      }
    })

    it('does not simply win winter: a neglected pet still goes its own way', () => {
      const neglected = reading({ care: 0, play: 0 })
      expect(chooseBranch(pet('spike'), neglected, WINTER)?.to).toBe('grump')
    })
  })

  describe('the elders', () => {
    it('gates each on the temperament it belongs to', () => {
      const cases = [
        ['devoted', 'warden'],
        ['lively', 'zephyrix'],
        ['restful', 'somnix'],
      ] as const
      for (const [temperament, to] of cases) {
        expect(chooseBranch(pet('mochi', { temperament }), reading(), SPRING)?.to).toBe(to)
      }
    })

    it('opens exactly one, so the score never has to decide', () => {
      for (const temperament of ['devoted', 'lively', 'restful'] as const) {
        const open = speciesOf('grump').branches.filter(
          (b) => b.available?.(pet('grump', { temperament })) ?? true,
        )
        expect(open).toHaveLength(1)
      }
    })
  })

  it('never returns a branch that its own gate refuses', () => {
    for (const species of SPECIES_LIST) {
      for (const temperament of [undefined, 'devoted', 'lively', 'restful', 'easygoing'] as const) {
        const p = pet(species.id, { temperament })
        const branch = chooseBranch(p, reading(), SPRING)
        if (branch?.available) expect(branch.available(p)).toBe(true)
      }
    }
  })

  it('always finds a way forward for a pet that is not yet grown', () => {
    // A child or baby with nowhere to go would be stuck for good, which is the
    // one failure a player could never recover from.
    const growing = SPECIES_LIST.filter((s) => s.stage !== 'adult')
    for (const species of growing) {
      for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
        for (const m of [reading(), reading({ care: 0, play: 0, sleep: 0 }), reading({ care: 1, play: 1, sleep: 1 })]) {
          expect(chooseBranch(pet(species.id), m, { season, lineage: null }), species.id).not.toBeNull()
        }
      }
    }
  })
})

resetIdSource()
