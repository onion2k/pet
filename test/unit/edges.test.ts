import { afterEach, describe, expect, it } from 'vitest'
import { beat } from '../../src/data/journey'
import { pickWeather } from '../../src/game/world'
import { SPECIES_LIST, speciesOf } from '../../src/data/species'
import { voice } from '../../src/data/voice'
import { resetRandom, setRandom } from '../../src/engine/random'
import { MINIGAMES } from '../../src/game/minigames'
import { fakeHud } from '../fake-hud'
import { newPet, resetIdSource, setIdSource } from '../../src/game/save'
import type { Metrics } from '../../src/game/metrics'
import type { Season, SeasonId } from '../../src/data/seasons'
import type { GroundId } from '../../src/data/grounds'
import type { ButtonId } from '../../src/render/shell'

/**
 * The edges: the paths a normal session does not take, but which the game would
 * take if the data ever changed underneath it. A ground added without lines, a
 * season with no weather, a save naming a form this build has never heard of --
 * none of these should be a crash, and none of them can be reached through the
 * ordinary flows, so they get their own tests.
 */

afterEach(() => {
  resetRandom()
  resetIdSource()
})

describe('a ground with no lines of its own', () => {
  const ctx = (ground: GroundId) => ({
    ground,
    season: 'spring' as SeasonId,
    weather: 'clear' as const,
    night: false,
    speciesId: 'blob',
  })

  it('still tells the trip, from the shared pool', () => {
    for (const leg of ['out', 'middle', 'home'] as const) {
      const line = beat(leg, ctx('quarry' as GroundId))
      expect(line.length).toBeGreaterThan(0)
    }
  })

  it('does not throw, which is what it used to do', () => {
    expect(() => beat('out', ctx('nowhere' as GroundId))).not.toThrow()
  })
})

describe('a season the journey has no lines for', () => {
  it('still tells the middle of the trip', () => {
    const line = beat('middle', {
      ground: 'wall',
      season: 'monsoon' as SeasonId,
      weather: 'clear',
      night: false,
      speciesId: 'blob',
    })
    expect(line.length).toBeGreaterThan(0)
  })
})

describe('pickWeather', () => {
  const season = (weather: Season['weather']): Season =>
    ({ id: 'spring', name: 'Spring', weather } as Season)

  it('picks by weight', () => {
    const s = season({ clear: 1, rain: 1 })
    expect(pickWeather(s, 0)).toBe('clear')
    expect(pickWeather(s, 0.9)).toBe('rain')
  })

  it('comes out clear for a season with no weather listed at all', () => {
    // Not reachable through the seasons the game ships, but every caller paints
    // a sky from the answer, so it has to be a weather rather than undefined.
    expect(pickWeather(season({}), 0.5)).toBe('clear')
  })

  it('comes out clear for a roll that walks off the end', () => {
    expect(pickWeather(season({ clear: 1, rain: 1 }), 1.5)).toBe('clear')
  })
})

describe('every branch score is a number', () => {
  const reading: Metrics = {
    care: 0.5,
    diet: { sweet: 0.25, protein: 0.25, veg: 0.25, junk: 0.25 },
    dietLean: null,
    play: 0.5,
    playAxes: { chase: 0.33, romp: 0.33, quiet: 0.33 },
    playLean: null,
    sleep: 0.5,
  }

  it('scores every branch of every form, in every season', () => {
    // `chooseBranch` never calls the score of a lone open branch -- the reduce
    // has nothing to compare it against -- so the elder scores are only ever
    // exercised here. A score that threw would strand a pet at the moment it
    // came of age.
    setIdSource(() => 'test-pet')
    for (const species of SPECIES_LIST) {
      const pet = Object.assign(newPet('PIP', 0), {
        speciesId: species.id,
        stage: species.stage,
      })
      for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
        for (const branch of species.branches) {
          const score = branch.score(reading, pet, { season, lineage: null })
          expect(Number.isFinite(score), `${species.id} -> ${branch.to}`).toBe(true)
        }
      }
    }
  })

  it('scores the hatch, which is the one branch a player never chooses', () => {
    setIdSource(() => 'test-pet')
    const egg = speciesOf('egg')
    const pet = newPet('PIP', 0)
    expect(egg.branches[0]!.score(reading, pet, { season: 'spring', lineage: null })).toBe(1)
  })
})

describe('the species voice packs', () => {
  it('draws every line each pack has, given enough goes', () => {
    // A pack line is only drawn about 60% of the time, so a single call per
    // species leaves some of them never spoken. This is the test that makes
    // sure none of them throws when it finally is.
    const species = SPECIES_LIST.map((s) => s.id)
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      for (const id of species) {
        seen.add(voice.fed('cake', id))
        seen.add(voice.welcome(false, id))
        seen.add(voice.cleaned(id))
        seen.add(voice.medicine(id))
        seen.add(voice.game(true, id))
        seen.add(voice.game(false, id))
        seen.add(voice.goodnight(id))
        seen.add(voice.morning(id))
      }
    }
    for (const line of seen) {
      expect(typeof line).toBe('string')
      expect(line.length).toBeGreaterThan(0)
    }
    // A pack line that ignores the food it was handed is still a thank you.
    expect([...seen]).toContain('IT WAS... ADEQUATE. THANKS.')
  })
})

describe('the recall game"s verdict', () => {
  /** Plays one round of the memory game to its result phase. */
  function toResult(correct: boolean) {
    setRandom(() => 0)
    const session = MINIGAMES.find((g) => g.id === 'memory')!.create()
    const { fake, hud } = fakeHud()
    for (let i = 0; i < 600; i++) {
      session.update(1 / 60)
      fake.clear()
      session.draw(hud)
      if (fake.said().includes('YOUR TURN')) break
    }
    // With every roll at zero the sequence is always 'a'.
    session.press(correct ? 'a' : ('b' as ButtonId))
    fake.clear()
    session.draw(hud)
    return fake.said()
  }

  it('says GOOD after a correct repeat', () => {
    expect(toResult(true)).toContain('GOOD')
  })

  it('says WRONG after a wrong one', () => {
    expect(toResult(false)).toContain('WRONG')
  })
})
