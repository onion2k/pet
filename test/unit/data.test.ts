import { afterEach, describe, expect, it } from 'vitest'
import {
  groundById,
  GROUNDS,
  groundsFor,
  luckOf,
  prospectOf,
  PROSPECT_LABEL,
  type GroundId,
  type Prospect,
} from '../../src/data/grounds'
import { foodById, FOODS } from '../../src/data/foods'
import { visitorFor, YARD_GAMES, yardGameById, type YardGameId } from '../../src/data/yardgames'
import { CURIOS } from '../../src/data/curios'
import { KIT, kitPowers, NO_KIT, type Day, type KitId } from '../../src/data/kit'
import { MINIGAMES, YARD_SESSIONS } from '../../src/game/minigames'
import { PLAY_MIN_ENERGY } from '../../src/game/app'
import { beat, type JourneyContext, type Leg } from '../../src/data/journey'
import { blend, EGG_LINES, pick, SICK_LINE, voice } from '../../src/data/voice'
import { GROWTH_STAGES, plantById, PLANTS } from '../../src/data/plants'
import { UNIVERSAL_VISITORS, VISITORS, type VisitorRole } from '../../src/data/visitors'
import { SHELLS, shellById } from '../../src/data/shells'
import { ICON_LABEL, ICON_ORDER, ICON_SIZE, iconRows } from '../../src/data/icons'
import { glyph, textWidth } from '../../src/data/font'
import { expandLayers, mirrorRow, rows } from '../../src/data/voxel-format'
import {
  MATERIALS,
  MATERIAL_INDEX,
  PROP_MATERIAL,
  SEASONS,
  SEASON_BY_ID,
  type SeasonId,
  type WeatherId,
} from '../../src/data/seasons'
import {
  biomeById,
  BIOMES,
  LAMP_COUNT,
  LAMP_ROW_X,
  MEADOW,
  VERGE_SLOTS,
  type BiomeId,
} from '../../src/data/biome'
import { emptySave } from '../../src/game/save'
import { resetRandom, setRandom } from '../../src/engine/random'
import type { Stage } from '../../src/game/types'

/**
 * The data tables. Most of these are lists rather than logic, but a list with a
 * hole in it fails at the exact moment the game reaches for the missing entry
 * -- which is to say in front of a player, hours in. So the tables are checked
 * for completeness as well as the few functions among them for correctness.
 */

afterEach(() => resetRandom())

const SEASON_IDS = SEASONS.map((s) => s.id)
const WEATHERS: WeatherId[] = ['clear', 'rain', 'snow', 'mist']

describe('grounds', () => {
  it('gives every ground a unique id, a name and a note', () => {
    expect(new Set(GROUNDS.map((g) => g.id)).size).toBe(GROUNDS.length)
    for (const ground of GROUNDS) {
      expect(ground.name.length).toBeGreaterThan(0)
      expect(ground.note.length).toBeGreaterThan(0)
      expect(ground.energy).toBeGreaterThan(0)
      expect(ground.luck).toBeGreaterThan(0)
      expect(ground.luck).toBeLessThanOrEqual(1)
    }
  })

  it('only favours curios that exist, and only names real seasons and weather', () => {
    for (const ground of GROUNDS) {
      for (const season of ground.seasons ?? []) expect(SEASON_IDS).toContain(season)
      for (const weather of ground.weather ?? []) expect(WEATHERS).toContain(weather)
    }
  })

  it('opens exactly one ground to a child, wherever it lives', () => {
    for (const biome of BIOMES) {
      const open = groundsFor(biome.grounds, 'child')
      expect(open, biome.id).toHaveLength(1)
      expect(open[0]!.role, biome.id).toBe('near')
    }
  })

  it('opens every ground to an adult', () => {
    for (const biome of BIOMES) {
      expect(groundsFor(biome.grounds, 'adult')).toEqual(biome.grounds)
    }
  })

  it('opens none to an egg or a baby, which cannot be sent anywhere', () => {
    for (const stage of ['egg', 'baby'] as Stage[]) {
      expect(groundsFor(MEADOW.grounds, stage)).toEqual([])
    }
  })

  it('gives every biome one ground of each role, so nowhere is a trap', () => {
    for (const biome of BIOMES) {
      const roles = biome.grounds.map((g) => g.role).sort()
      expect(roles, biome.id).toEqual(['far', 'near', 'sheltered', 'wet'])
    }
  })

  it('writes every place as a phrase a journey line can swallow', () => {
    // "ambles down to the old wall" -- lower case, and no leading article
    // missing, since the line does not supply one.
    for (const ground of GROUNDS) {
      expect(ground.place, ground.id).toBe(ground.place.toLowerCase())
      expect(ground.place.startsWith('the '), ground.id).toBe(true)
    }
  })

  it('gives every curio somewhere that favours it', () => {
    // A curio favoured nowhere can still be found, but only by accident, and it
    // would sit on the board for a whole family with nothing a player could do
    // about it. Sunpetals were exactly that until the beach and the village
    // turned up -- which is now the reason those two are worth the walk.
    const favoured = new Set(GROUNDS.flatMap((g) => g.favours))
    for (const curio of CURIOS) expect(favoured, curio.id).toContain(curio.id)
  })

  it('keeps ground ids unique across biomes, since the larder keys off them', () => {
    const ids = GROUNDS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('makes the near ground the cheapest, so it is the sensible fallback', () => {
    // Per biome, since the near ground is only a fallback against the three
    // the pet could go to instead of it.
    for (const biome of BIOMES) {
      const near = biome.grounds.find((g) => g.role === 'near')!
      for (const ground of biome.grounds) {
        if (ground.role === 'near') continue
        expect(ground.energy, `${biome.id}/${ground.id}`).toBeGreaterThan(near.energy)
      }
    }
  })

  describe('groundById', () => {
    it('finds a ground', () => {
      expect(groundById('hill').name).toBe('The Long Hill')
    })

    it('throws on one that does not exist', () => {
      expect(() => groundById('moon' as GroundId)).toThrow('Unknown ground: moon')
    })
  })

  describe('prospectOf', () => {
    it('is always fair for a ground with no preference', () => {
      const wall = groundById('wall')
      for (const season of SEASON_IDS) {
        for (const weather of WEATHERS) {
          expect(prospectOf(wall, season, weather)).toBe('fair')
        }
      }
    })

    it('is good when a ground gets the weather it wants', () => {
      expect(prospectOf(groundById('creek'), 'spring', 'rain')).toBe('good')
      expect(prospectOf(groundById('hill'), 'spring', 'clear')).toBe('good')
    })

    it('is poor when it does not', () => {
      expect(prospectOf(groundById('creek'), 'spring', 'clear')).toBe('poor')
      expect(prospectOf(groundById('hill'), 'spring', 'snow')).toBe('poor')
    })

    it('is good when a ground gets the season it wants', () => {
      expect(prospectOf(groundById('hollow'), 'autumn', 'clear')).toBe('good')
    })

    it('is poor out of season', () => {
      expect(prospectOf(groundById('hollow'), 'spring', 'clear')).toBe('poor')
    })

    it('has a label for every prospect', () => {
      for (const p of ['good', 'fair', 'poor'] as Prospect[]) {
        expect(PROSPECT_LABEL[p].length).toBeGreaterThan(0)
      }
    })
  })

  /**
   * What the kit is for. Each of these is a day a player would have skipped,
   * turned into one they can do something with -- which is the whole design:
   * kit does not make a good day better, it makes a bad day playable.
   */
  describe('prospectOf, with kit', () => {
    const powers = (owned: KitId[], day: Day) => kitPowers(owned, day)
    const wet: Day = { season: 'spring', weather: 'rain', night: false }
    const dry: Day = { season: 'spring', weather: 'clear', night: false }

    it('changes nothing at all for a family with none', () => {
      for (const ground of GROUNDS) {
        for (const season of SEASON_IDS) {
          for (const weather of WEATHERS) {
            const bare = prospectOf(ground, season, weather)
            expect(prospectOf(ground, season, weather, NO_KIT)).toBe(bare)
            expect(prospectOf(ground, season, weather, powers([], { season, weather, night: false }))).toBe(bare)
          }
        }
      }
    })

    it('takes the rain out of the reckoning, for a pet with an umbrella', () => {
      const hill = groundById('hill')
      expect(prospectOf(hill, 'spring', 'rain')).toBe('poor')
      expect(prospectOf(hill, 'spring', 'rain', powers(['umbrella'], wet))).toBe('fair')
    })

    it('leaves an umbrella in the cupboard on a dry day', () => {
      // Nothing to forgive: the hill is poor in snow because it wanted clear,
      // and an umbrella has nothing to say about snow.
      expect(prospectOf(groundById('hill'), 'winter', 'snow')).toBe('poor')
      const snowy: Day = { season: 'winter', weather: 'snow', night: false }
      expect(prospectOf(groundById('hill'), 'winter', 'snow', powers(['umbrella'], snowy))).toBe(
        'poor',
      )
    })

    it('lets waders stand in a creek that never got its rain', () => {
      const creek = groundById('creek')
      expect(prospectOf(creek, 'spring', 'clear')).toBe('poor')
      expect(prospectOf(creek, 'spring', 'clear', powers(['waders'], dry))).toBe('fair')
    })

    it('does not let waders speak for a ground that wanted a clear day', () => {
      // The mirror of the umbrella, and only the mirror: waders are for a wet
      // place, not for wet weather.
      expect(prospectOf(groundById('hill'), 'spring', 'rain', powers(['waders'], wet))).toBe('poor')
    })

    it('takes winter out of the reckoning, for a pet in a bobble hat', () => {
      const hollow = groundById('hollow')
      const cold: Day = { season: 'winter', weather: 'clear', night: false }
      expect(prospectOf(hollow, 'winter', 'clear')).toBe('poor')
      expect(prospectOf(hollow, 'winter', 'clear', powers(['hat'], cold))).toBe('fair')
    })

    it('leaves the hat for the cold: it says nothing about a spring afternoon', () => {
      expect(prospectOf(groundById('hollow'), 'spring', 'clear', powers(['hat'], dry))).toBe('poor')
    })

    it('never makes a day better than fair out of a day that was wrong', () => {
      // Forgiving a miss is not the same as manufacturing a hit. If a full kit
      // could make any old day promising, the sky would stop being worth
      // reading -- which is the one thing this game asks of a player.
      const all = KIT.map((k) => k.id)
      for (const ground of GROUNDS) {
        for (const season of SEASON_IDS) {
          for (const weather of WEATHERS) {
            const bare = prospectOf(ground, season, weather)
            const kitted = prospectOf(ground, season, weather, powers(all, { season, weather, night: false }))
            if (bare === 'poor') expect(kitted, `${ground.id} ${season} ${weather}`).not.toBe('good')
            // And it can never make a day worse than it already was.
            if (bare === 'good') expect(kitted, `${ground.id} ${season} ${weather}`).toBe('good')
          }
        }
      }
    })
  })

  describe('luckOf, with kit', () => {
    it('pays out the better read the kit just bought', () => {
      const hill = groundById('hill')
      const wet: Day = { season: 'spring', weather: 'rain', night: false }
      const bare = luckOf(hill, 'spring', 'rain')
      const kitted = luckOf(hill, 'spring', 'rain', kitPowers(['umbrella'], wet))
      expect(kitted).toBeGreaterThan(bare)
    })

    it('still never promises more than 0.95, however much kit is carried', () => {
      const all = KIT.map((k) => k.id)
      for (const ground of GROUNDS) {
        for (const season of SEASON_IDS) {
          for (const weather of WEATHERS) {
            const luck = luckOf(ground, season, weather, kitPowers(all, { season, weather, night: false }))
            expect(luck).toBeLessThanOrEqual(0.95)
          }
        }
      }
    })
  })

  describe('luckOf', () => {
    it('is better on a good day than a fair one, and worse on a poor one', () => {
      const creek = groundById('creek')
      const good = luckOf(creek, 'spring', 'rain')
      const poor = luckOf(creek, 'spring', 'clear')
      expect(good).toBeGreaterThan(poor)
    })

    it('never promises more than 0.95', () => {
      for (const ground of GROUNDS) {
        for (const season of SEASON_IDS) {
          for (const weather of WEATHERS) {
            const luck = luckOf(ground, season, weather)
            expect(luck).toBeLessThanOrEqual(0.95)
            expect(luck).toBeGreaterThan(0)
          }
        }
      }
    })

    it('leaves a poor day still worth something, so no trip is pointless', () => {
      expect(luckOf(groundById('hill'), 'spring', 'snow')).toBeGreaterThan(0.3)
    })
  })
})

describe('foods', () => {
  it('gives every food a unique id, a name, a note and a colour', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length)
    for (const food of FOODS) {
      expect(food.name.length).toBeGreaterThan(0)
      expect(food.note.length).toBeGreaterThan(0)
      expect(food.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('gives every food an effect worth pressing the button for', () => {
    for (const food of FOODS) {
      expect(Object.keys(food.effect).length).toBeGreaterThan(0)
    }
  })

  it('feeds every food but medicine, so nothing on the menu is a trick', () => {
    for (const food of FOODS) {
      if (food.axis === null) continue
      expect(food.effect.hunger, food.id).toBeGreaterThan(0)
    }
  })

  it('covers all four diet axes, so every branch can actually be aimed at', () => {
    const axes = new Set(FOODS.map((f) => f.axis).filter(Boolean))
    expect([...axes].sort()).toEqual(['junk', 'protein', 'sweet', 'veg'])
  })

  it('has exactly one food with no axis, and it is the medicine', () => {
    const none = FOODS.filter((f) => f.axis === null)
    expect(none.map((f) => f.id)).toEqual(['medicine'])
  })

  it('gives medicine no season, so it never gets a seasonal bonus', () => {
    expect(foodById('medicine').served).toBeUndefined()
  })

  it('offers at least one bought food per axis, so the menu is never empty', () => {
    for (const axis of ['sweet', 'protein', 'veg', 'junk'] as const) {
      expect(FOODS.some((f) => f.axis === axis && !f.gathered), axis).toBe(true)
    }
  })

  describe('foodById', () => {
    it('finds a food', () => {
      expect(foodById('cake').name).toBe('Cake')
    })

    it('throws on one that does not exist', () => {
      expect(() => foodById('soup')).toThrow('Unknown food: soup')
    })
  })
})

describe('journey', () => {
  const ctx = (overrides: Partial<JourneyContext> = {}): JourneyContext => ({
    role: 'near',
    place: 'the old wall',
    season: 'spring',
    weather: 'clear',
    night: false,
    speciesId: 'blob',
    ...overrides,
  })

  const LEGS: Leg[] = ['out', 'middle', 'home']

  it('says something for every leg, ground, season and weather', () => {
    for (const ground of GROUNDS) {
      for (const season of SEASON_IDS) {
        for (const weather of WEATHERS) {
          for (const night of [false, true]) {
            for (const leg of LEGS) {
              const line = beat(leg, ctx({ role: ground.role, place: ground.place, season, weather, night }))
              expect(line.length, `${leg}/${ground.id}/${season}/${weather}`).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })

  it('leaves no placeholder unfilled, whichever ground the pet went to', () => {
    for (const ground of GROUNDS) {
      for (const leg of LEGS) {
        for (let i = 0; i < 60; i++) {
          const line = beat(leg, ctx({ role: ground.role, place: ground.place }))
          expect(line, `${leg}/${ground.id}`).not.toContain('{place}')
        }
      }
    }
  })

  it('narrates in the third person, lower case, unlike the pet"s own voice', () => {
    setRandom(() => 0)
    for (const leg of LEGS) {
      const line = beat(leg, ctx())
      expect(line[0]).toBe(line[0]!.toLowerCase())
    }
  })

  it('replaces the generic pool with the ground"s own lines, rather than joining it', () => {
    // Having chosen where to send the pet, the player should be told it went
    // there -- so 'sets off up the lane' must never appear for the creek.
    const generic = ['sets off up the lane', 'takes the path past the wall', 'heads for the far hedgerow']
    for (const ground of GROUNDS) {
      const lines = new Set<string>()
      for (let i = 0; i < 400; i++) {
        lines.add(beat('out', ctx({ role: ground.role, place: ground.place })))
      }
      for (const line of generic) expect(lines.has(line), `${ground.id}: ${line}`).toBe(false)
    }
  })

  it('names the place for grounds whose lines say so', () => {
    const lines = new Set<string>()
    for (let i = 0; i < 400; i++) {
      lines.add(beat('out', ctx({ role: 'wet', place: 'the creek' })))
    }
    expect([...lines].every((l) => l.includes('creek') || l.includes('water'))).toBe(true)
  })

  it('tells the two biomes" wet grounds apart, since only the place differs', () => {
    const named = (place: string) => {
      const lines = new Set<string>()
      for (let i = 0; i < 400; i++) lines.add(beat('out', ctx({ role: 'wet', place })))
      return [...lines]
    }
    expect(named('the creek').some((l) => l.includes('the creek'))).toBe(true)
    expect(named('the streambed').some((l) => l.includes('the streambed'))).toBe(true)
  })

  it('adds weather lines to the pool rather than replacing it', () => {
    const lines = new Set<string>()
    for (let i = 0; i < 400; i++) lines.add(beat('out', ctx({ weather: 'rain' })))
    expect([...lines].some((l) => l.includes('drizzle'))).toBe(true)
    expect(lines.size).toBeGreaterThan(1)
  })

  it('has something extra to say after dark', () => {
    const day = new Set<string>()
    const night = new Set<string>()
    for (let i = 0; i < 400; i++) {
      day.add(beat('out', ctx({ night: false })))
      night.add(beat('out', ctx({ night: true })))
    }
    expect(night.size).toBeGreaterThan(day.size)
  })

  it('colours the middle beat with the season, and only the middle', () => {
    const middles = new Set<string>()
    const outs = new Set<string>()
    for (let i = 0; i < 400; i++) {
      middles.add(beat('middle', ctx({ season: 'autumn' })))
      outs.add(beat('out', ctx({ season: 'autumn' })))
    }
    expect([...middles].some((l) => l.includes('leaf litter'))).toBe(true)
    expect([...outs].some((l) => l.includes('leaf litter'))).toBe(false)
  })

  it('gives each grown form its own way of going about the middle', () => {
    const middles = new Set<string>()
    for (let i = 0; i < 400; i++) middles.add(beat('middle', ctx({ speciesId: 'grump' })))
    expect([...middles].some((l) => l.includes('sighs at the state of the path'))).toBe(true)
  })

  it('falls back to the shared pool for a species with no pack', () => {
    const line = beat('middle', ctx({ speciesId: 'nobody' }))
    expect(line.length).toBeGreaterThan(0)
  })
})

describe('voice', () => {
  it('picks from a pool', () => {
    setRandom(() => 0)
    expect(pick(['a', 'b', 'c'])).toBe('a')
    setRandom(() => 0.99)
    expect(pick(['a', 'b', 'c'])).toBe('c')
  })

  describe('blend', () => {
    it('falls back to the base pool when a species has no lines', () => {
      setRandom(() => 0)
      expect(blend(['base'], undefined)).toBe('base')
      expect(blend(['base'], [])).toBe('base')
    })

    it('favours the species" own lines when it has some', () => {
      setRandom(() => 0)
      expect(blend(['base'], ['own'])).toBe('own')
    })

    it('still lets the shared voice through', () => {
      setRandom(() => 0.99)
      expect(blend(['base'], ['own'])).toBe('base')
    })
  })

  it('has something to say for every occasion, for every species', () => {
    const species = ['blob', 'pudge', 'spike', 'sprout', 'mochi', 'gloop', 'blaze', 'grump', 'verdant', 'lumen', 'aurora', 'warden', 'nobody']
    for (const id of species) {
      for (const longAway of [false, true]) {
        expect(voice.welcome(longAway, id).length).toBeGreaterThan(0)
      }
      expect(voice.fed('cake', id).length).toBeGreaterThan(0)
      expect(voice.cleaned(id).length).toBeGreaterThan(0)
      expect(voice.medicine(id).length).toBeGreaterThan(0)
      expect(voice.game(true, id).length).toBeGreaterThan(0)
      expect(voice.game(false, id).length).toBeGreaterThan(0)
      expect(voice.goodnight(id).length).toBeGreaterThan(0)
      expect(voice.morning(id).length).toBeGreaterThan(0)
      for (const weather of WEATHERS) {
        for (const night of [false, true]) {
          expect(voice.monologue(night, weather, id).length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('shouts, because the ticker does', () => {
    setRandom(() => 0)
    const lines = [
      voice.welcome(false, 'blob'),
      voice.cleaned('mochi'),
      voice.goodnight('lumen'),
      voice.egg(),
      SICK_LINE,
    ]
    for (const line of lines) expect(line).toBe(line.toUpperCase())
  })

  it('names the food it is thanking you for, at least some of the time', () => {
    // Not every line mentions the meal -- 'CHOMP CHOMP CHOMP' is a fine thank
    // you -- but the ones that do must get the name, and get it shouted.
    const lines = new Set<string>()
    for (let i = 0; i < 400; i++) lines.add(voice.fed('cake', 'nobody'))
    expect([...lines].some((l) => l.includes('CAKE'))).toBe(true)
    expect([...lines].some((l) => l.includes('cake'))).toBe(false)
  })

  it('has a first-person line for every need a pet can have', () => {
    for (const need of ['hunger', 'hygiene', 'energy', 'happiness'] as const) {
      expect(voice.need(need, 'nobody')).toBeDefined()
    }
  })

  it('has no line for health, which the sick line covers instead', () => {
    expect(voice.need('health', 'nobody')).toBeUndefined()
  })

  it('lets a species have its own way of asking', () => {
    expect(voice.need('hunger', 'grump')).toBe('A CREATURE COULD STARVE OUT HERE')
    expect(voice.need('hygiene', 'grump')).toBe(voice.need('hygiene', 'nobody'))
  })

  it('has more to muse about at night', () => {
    setRandom(() => 0.99)
    const day = new Set<string>()
    const night = new Set<string>()
    for (let i = 0; i < 200; i++) {
      setRandom(() => Math.random())
      day.add(voice.monologue(false, 'clear', 'nobody'))
      night.add(voice.monologue(true, 'clear', 'nobody'))
    }
    expect(night.size).toBeGreaterThan(day.size)
  })

  it('gives the egg lines of its own', () => {
    expect(EGG_LINES.length).toBeGreaterThan(0)
    expect(EGG_LINES).toContain(voice.egg())
  })

  it('keeps every line short enough to finish its crawl', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 3000; i++) {
      seen.add(voice.monologue(true, 'rain', 'lumen'))
      seen.add(voice.welcome(i % 2 === 0, 'gloop'))
      seen.add(voice.fed('honeycomb', 'pudge'))
    }
    for (const line of seen) expect(line.length, line).toBeLessThanOrEqual(48)
  })
})

describe('plants', () => {
  it('gives every plant a unique id, names and the same number of stages', () => {
    expect(new Set(PLANTS.map((p) => p.id)).size).toBe(PLANTS.length)
    for (const plant of PLANTS) {
      expect(plant.seedName.length).toBeGreaterThan(0)
      expect(plant.name.length).toBeGreaterThan(0)
      expect(plant.stages, plant.id).toHaveLength(GROWTH_STAGES)
    }
  })

  it('grows each plant taller at every stage', () => {
    for (const plant of PLANTS) {
      for (let i = 1; i < plant.stages.length; i++) {
        expect(plant.stages[i]!.height, plant.id).toBeGreaterThan(plant.stages[i - 1]!.height)
      }
    }
  })

  it('gives every stage a model whose palette covers what it draws', () => {
    for (const plant of PLANTS) {
      for (const stage of plant.stages) {
        expect(stage.model.layers.length).toBeGreaterThan(0)
        for (const layer of expandLayers(stage.model)) {
          for (const row of layer) {
            for (const ch of row) {
              if (ch === '.') continue
              expect(stage.model.palette[ch], `${plant.id} missing '${ch}'`).toBeDefined()
            }
          }
        }
      }
    }
  })

  describe('plantById', () => {
    it('finds a plant', () => {
      expect(plantById('bramble')?.name).toBe('a bramble')
    })

    it('is undefined for one that does not exist', () => {
      expect(plantById('oak' as never)).toBeUndefined()
    })
  })
})

describe('visitors', () => {
  it('gives every visitor a unique id, an arrival line and a season', () => {
    expect(new Set(VISITORS.map((v) => v.id)).size).toBe(VISITORS.length)
    for (const visitor of VISITORS) {
      expect(visitor.arrival.length).toBeGreaterThan(0)
      expect(visitor.seasons.length).toBeGreaterThan(0)
      for (const season of visitor.seasons) expect(SEASON_IDS).toContain(season)
      expect(visitor.chance).toBeGreaterThan(0)
      expect(visitor.chance).toBeLessThanOrEqual(1)
      expect(visitor.height).toBeGreaterThan(0)
    }
  })

  it('gives every season somebody to turn up', () => {
    for (const season of SEASON_IDS) {
      expect(VISITORS.some((v) => v.seasons.includes(season)), season).toBe(true)
    }
  })

  it('gives every visitor with a time window something to say beforehand', () => {
    for (const visitor of VISITORS) {
      if (visitor.hours) expect(visitor.expected, visitor.id).toBeDefined()
    }
  })

  it('keeps every time window inside the clock', () => {
    for (const visitor of VISITORS) {
      if (!visitor.hours) continue
      for (const hour of visitor.hours) {
        expect(hour).toBeGreaterThanOrEqual(0)
        expect(hour).toBeLessThan(24)
      }
    }
  })

  it('only lets the living ones be befriended', () => {
    // Written as which things are *not* alive rather than which are, so that a
    // new place bringing four new creatures costs nothing here and a new object
    // -- which is the case worth catching -- has to be thought about.
    const objects = ['snowman', 'pumpkin', 'leafpile', 'sled']
    for (const id of objects) {
      const visitor = VISITORS.find((v) => v.id === id)!
      expect(visitor.friend, id).toBeUndefined()
    }
    // A sled cannot be befriended however far the pet walks, and the things
    // somebody left out are exactly the ones that turn up everywhere. What the
    // pet plays with is not among them any more: a toy is a role its biome
    // fills, so the beach gets a beach ball and the wood gets a cone.
    expect([...objects].sort()).toEqual([...UNIVERSAL_VISITORS].sort())
  })

  it('leaves at least one visitor befriendable per season it appears in', () => {
    const friendly = VISITORS.filter((v) => v.friend)
    expect(friendly.length).toBeGreaterThan(0)
    for (const visitor of friendly) expect(visitor.friend!.length).toBeGreaterThan(0)
  })

  it('gives every visitor a model whose palette covers what it draws', () => {
    for (const visitor of VISITORS) {
      for (const layer of expandLayers(visitor.model)) {
        for (const row of layer) {
          for (const ch of row) {
            if (ch === '.') continue
            expect(visitor.model.palette[ch], `${visitor.id} missing '${ch}'`).toBeDefined()
          }
        }
      }
    }
  })
})

describe('shells', () => {
  it('gives every shell a unique id, a name and a linear colour', () => {
    expect(new Set(SHELLS.map((s) => s.id)).size).toBe(SHELLS.length)
    for (const shell of SHELLS) {
      expect(shell.name.length).toBeGreaterThan(0)
      expect(shell.colour).toHaveLength(3)
      for (const channel of shell.colour) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
    }
  })

  it('has exactly one shell available from the very start', () => {
    const free = SHELLS.filter((s) => s.unlocked(emptySave()))
    expect(free).toHaveLength(1)
    expect(free[0]!.id).toBe('plum')
  })

  it('gives every locked shell a hint that says how to earn it', () => {
    for (const shell of SHELLS) {
      if (shell.unlocked(emptySave())) continue
      expect(shell.hint.length, shell.id).toBeGreaterThan(0)
    }
  })

  it('unlocks each shell on the milestone its hint names', () => {
    const teal = { ...emptySave(), streak: { days: 3, lastDay: '' } }
    expect(shellById('teal').unlocked(teal)).toBe(true)

    const rose = { ...emptySave(), album: [{ speciesId: 'mochi', name: 'PIP', retiredAt: 0 }] }
    expect(shellById('rose').unlocked(rose)).toBe(true)

    const gold = { ...emptySave(), curios: { a: 1, b: 1, c: 1, d: 1, e: 1 } }
    expect(shellById('gold').unlocked(gold)).toBe(true)

    const midnight = { ...emptySave(), discovered: ['1', '2', '3', '4', '5', '6', '7', '8'] }
    expect(shellById('midnight').unlocked(midnight)).toBe(true)
  })

  it('keeps each shell locked one short of its milestone', () => {
    expect(shellById('teal').unlocked({ ...emptySave(), streak: { days: 2, lastDay: '' } })).toBe(false)
    expect(shellById('gold').unlocked({ ...emptySave(), curios: { a: 1, b: 1, c: 1, d: 1 } })).toBe(false)
    expect(
      shellById('midnight').unlocked({ ...emptySave(), discovered: ['1', '2', '3', '4', '5', '6', '7'] }),
    ).toBe(false)
  })

  describe('shellById', () => {
    it('finds a shell', () => {
      expect(shellById('gold').name).toBe('Gold')
    })

    it('falls back to the default rather than throwing, since the save names one', () => {
      expect(shellById('chartreuse').id).toBe('plum')
    })
  })
})

describe('icons', () => {
  it('orders every icon exactly once', () => {
    expect(new Set(ICON_ORDER).size).toBe(ICON_ORDER.length)
    expect(ICON_ORDER).toHaveLength(7)
  })

  it('labels every icon in the order', () => {
    for (const id of ICON_ORDER) expect(ICON_LABEL[id].length).toBeGreaterThan(0)
  })

  it('draws every icon at the stated size', () => {
    for (const id of ICON_ORDER) {
      const grid = iconRows(id)
      expect(grid, id).toHaveLength(ICON_SIZE)
      for (const row of grid) expect(row, id).toHaveLength(ICON_SIZE)
    }
  })

  it('leaves no icon blank', () => {
    for (const id of ICON_ORDER) {
      expect(iconRows(id).join('').includes('#'), id).toBe(true)
    }
  })
})

describe('font', () => {
  it('draws a five-row glyph for every character it knows', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const g = glyph(ch)
      expect(g, ch).toHaveLength(5)
      for (const row of g) expect(row, ch).toHaveLength(3)
    }
  })

  it('is case insensitive, since the screen shouts anyway', () => {
    expect(glyph('a')).toEqual(glyph('A'))
  })

  it('draws a visible box for a character it does not know', () => {
    const missing = glyph('é')
    expect(missing).toHaveLength(5)
    expect(missing.join('')).toContain('#')
  })

  it('draws the punctuation the game actually uses', () => {
    for (const ch of " .,:!?'-/%<>*=()") {
      expect(glyph(ch), ch).toHaveLength(5)
    }
  })

  describe('textWidth', () => {
    it('is nothing for nothing', () => {
      expect(textWidth('')).toBe(0)
    })

    it('grows with the text and with the scale', () => {
      expect(textWidth('AB')).toBeGreaterThan(textWidth('A'))
      expect(textWidth('AB', 2)).toBe(textWidth('AB') * 2)
    })

    it('excludes the trailing gap, so text sits flush', () => {
      // One glyph is its own width with no gap after it.
      expect(textWidth('A')).toBe(3)
      expect(textWidth('AA')).toBe(7)
    })
  })
})

describe('voxel-format', () => {
  describe('rows', () => {
    it('turns an indented block into trimmed rows', () => {
      expect(rows(`
        .g.
        ggg
        .g.`)).toEqual(['.g.', 'ggg', '.g.'])
    })

    it('drops blank lines rather than emitting empty rows', () => {
      expect(rows('\n\n  ab  \n\n  cd\n')).toEqual(['ab', 'cd'])
    })

    it('is empty for an empty block', () => {
      expect(rows('')).toEqual([])
      expect(rows('   \n  \n')).toEqual([])
    })
  })

  describe('mirrorRow', () => {
    it('mirrors around the last character, which is the centre column', () => {
      expect(mirrorRow('abcdef')).toBe('abcdefedcba')
    })

    it('leaves a single character alone, it being the whole centre', () => {
      expect(mirrorRow('a')).toBe('a')
    })

    it('leaves an empty row empty', () => {
      expect(mirrorRow('')).toBe('')
    })

    it('always produces an odd width', () => {
      for (const half of ['a', 'ab', 'abc', 'abcd']) {
        expect(mirrorRow(half).length % 2).toBe(1)
      }
    })
  })

  describe('expandLayers', () => {
    it('leaves an unmirrored model as it is', () => {
      const model = { palette: { a: '#fff' }, layers: [['aa', 'aa']] }
      expect(expandLayers(model)).toBe(model.layers)
    })

    it('mirrors every row of every layer of a mirrored model', () => {
      const model = { palette: { a: '#fff', b: '#000' }, mirror: true, layers: [['ab', 'ba']] }
      expect(expandLayers(model)).toEqual([['aba', 'bab']])
    })
  })
})

describe('seasons', () => {
  it('indexes every material', () => {
    MATERIALS.forEach((name, i) => expect(MATERIAL_INDEX[name]).toBe(i))
  })

  it('paints every material in every season', () => {
    for (const season of SEASONS) {
      for (const material of MATERIALS) {
        expect(season.palette[material], `${season.id}/${material}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('gives every season a full set of skies and a sun', () => {
    for (const season of SEASONS) {
      for (const sky of [season.daySky, season.nightSky, season.duskSky]) {
        expect(sky.top).toMatch(/^#[0-9a-f]{6}$/i)
        expect(sky.bottom).toMatch(/^#[0-9a-f]{6}$/i)
      }
      expect(season.sunLight).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('gives every season weather that adds up to something', () => {
    for (const season of SEASONS) {
      const total = Object.values(season.weather).reduce((a, b) => a + b, 0)
      expect(total, season.id).toBeGreaterThan(0)
      for (const [id, weight] of Object.entries(season.weather)) {
        expect(WEATHERS, `${season.id}/${id}`).toContain(id)
        expect(weight).toBeGreaterThan(0)
      }
    }
  })

  it('gives every season daylight hours inside a day', () => {
    for (const season of SEASONS) {
      expect(season.daylightHours).toBeGreaterThan(0)
      expect(season.daylightHours).toBeLessThan(12)
    }
  })

  it('makes winter the shortest day and summer the longest', () => {
    const by = (id: SeasonId) => SEASON_BY_ID.get(id)!.daylightHours
    expect(by('winter')).toBeLessThan(by('spring'))
    expect(by('summer')).toBeGreaterThan(by('spring'))
  })

  it('lets it snow in winter and nowhere else', () => {
    for (const season of SEASONS) {
      const snows = 'snow' in season.weather
      expect(snows, season.id).toBe(season.id === 'winter')
    }
  })

  it('finds every season by id', () => {
    for (const season of SEASONS) expect(SEASON_BY_ID.get(season.id)).toBe(season)
  })

  it('maps every prop palette character onto a real material', () => {
    for (const [ch, material] of Object.entries(PROP_MATERIAL)) {
      expect(MATERIALS, ch).toContain(material)
    }
  })
})

describe('biome', () => {
  it('has a meadow, and it is on the list', () => {
    expect(BIOMES).toContain(MEADOW)
  })

  it('scatters something, but not everything, wherever the pet lives', () => {
    for (const biome of BIOMES) {
      expect(biome.propDensity, biome.id).toBeGreaterThan(0)
      expect(biome.propDensity, biome.id).toBeLessThanOrEqual(1)
      expect(biome.props.length, biome.id).toBeGreaterThan(0)
    }
  })

  it('finds every place by its own id', () => {
    for (const biome of BIOMES) expect(biomeById(biome.id)).toBe(biome)
  })

  it('refuses an id for a place that does not exist', () => {
    // `knownBiome` is the forgiving door, for ids off a save file; this one is
    // the strict door, for ids the code chose. A name that got this far and is
    // still wrong is a bug in the caller, and returning the meadow instead
    // would hide it behind a house the player never moved to.
    expect(() => biomeById('atlantis' as BiomeId)).toThrow(/Unknown biome: atlantis/)
  })

  it('keeps biome ids unique, since the save keys the gardens off them', () => {
    const ids = BIOMES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('fills every living role everywhere, with visitors that exist', () => {
    const known = new Set(VISITORS.map((v) => v.id))
    for (const biome of BIOMES) {
      for (const role of ['flitter', 'glow', 'grazer', 'bloom'] as VisitorRole[]) {
        const filled = biome.visitors[role]
        expect(filled, `${biome.id}/${role}`).toBeTruthy()
        expect(known.has(filled), `${biome.id}/${role}: ${filled}`).toBe(true)
      }
    }
  })

  it('only tints materials that exist, or the shader would sample a hole', () => {
    for (const biome of BIOMES) {
      for (const name of Object.keys(biome.materials ?? {})) {
        expect(MATERIALS, biome.id).toContain(name)
      }
    }
  })

  it('fits the move menu on the glass, however many places there are to live', () => {
    // Same shape as the games menu: 24px in, one tall row of 27 and the rest a
    // line each, above the standing line about the garden at 138.
    expect(24 + 27 + (BIOMES.length - 1) * 10).toBeLessThanOrEqual(138)
  })

  it('names every place twice over: shouted for the ticker, plain for the menu', () => {
    for (const biome of BIOMES) {
      expect(biome.prose, biome.id).toBe(biome.prose.toUpperCase())
      expect(biome.name[0], biome.id).toBe(biome.name[0]!.toUpperCase())
      expect(biome.note.length, biome.id).toBeGreaterThan(0)
    }
  })

  it('gives each place its own scenery, or moving would only change the paint', () => {
    for (const a of BIOMES) {
      for (const b of BIOMES) {
        if (a.id === b.id) continue
        const mine = new Set(a.props.map((p) => p.id))
        expect([...b.props].some((p) => !mine.has(p.id)), `${a.id} vs ${b.id}`).toBe(true)
      }
    }
  })

  it('carries one light slot per lantern, plus the shelter"s and one spare', () => {
    expect(LAMP_COUNT).toBe(LAMP_ROW_X.length + 2)
  })

  it('gives the yard more standing room than plants can take, so seeds always fit', () => {
    // Every planting needs its own verge slot; the yard capacity must not
    // exceed the slots available, or a seed would be silently dropped.
    expect(VERGE_SLOTS.length).toBeGreaterThanOrEqual(4)
    expect(new Set(VERGE_SLOTS).size).toBe(VERGE_SLOTS.length)
  })
})

describe('the yard games', () => {
  it('each name something that exists, wherever the pet lives', () => {
    const known = VISITORS.map((v) => v.id)
    for (const game of YARD_GAMES) {
      for (const biome of BIOMES) {
        expect(known, `${game.id}/${biome.id}`).toContain(visitorFor(game, biome.visitors))
      }
    }
  })

  it('finds every game by its own id, and refuses one that does not exist', () => {
    for (const game of YARD_GAMES) expect(yardGameById(game.id)).toBe(game)
    expect(() => yardGameById('hopscotch' as YardGameId)).toThrow(/Unknown yard game: hopscotch/)
  })

  it('is playable in every biome, so moving house never closes a game', () => {
    // Three of the five are already scarce by season. Gating them by place as
    // well would leave a player with a healthy adult and nothing to do.
    for (const game of YARD_GAMES) {
      for (const biome of BIOMES) {
        const visitor = VISITORS.find((v) => v.id === visitorFor(game, biome.visitors))!
        expect(visitor.seasons.length, `${game.id}/${biome.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('gives the same game the same seasons wherever it is played', () => {
    // A moth has to stand in for a butterfly exactly, or moving house would
    // quietly move when a game is available rather than only who is in it.
    for (const game of YARD_GAMES) {
      const seasons = BIOMES.map((biome) =>
        [...VISITORS.find((v) => v.id === visitorFor(game, biome.visitors))!.seasons].sort().join(),
      )
      expect(new Set(seasons).size, game.id).toBe(1)
    }
  })

  it('never restate the season their visitor already carries', () => {
    // Whether the thing is out there already carries the season. Saying it
    // again would make the read on the menu a tautology.
    for (const game of YARD_GAMES) {
      expect(Object.keys(game)).not.toContain('seasons')
    }
  })

  it('want weather the seasons their visitor comes in can actually bring', () => {
    // A game wanting snow off a summer visitor would read as NOT TODAY every
    // day it was ever on the menu.
    for (const game of YARD_GAMES) {
      if (!game.weather) continue
      const visitor = VISITORS.find((v) => v.id === visitorFor(game, MEADOW.visitors))!
      const possible = new Set(
        visitor.seasons.flatMap((id) =>
          Object.entries(SEASONS.find((s) => s.id === id)!.weather)
            .filter(([, odds]) => (odds ?? 0) > 0)
            .map(([w]) => w),
        ),
      )
      for (const wanted of game.weather) expect([...possible]).toContain(wanted)
    }
  })

  it('cost less than the PLAY icon insists a pet has', () => {
    // The icon refuses a pet under that; a game costing more could be offered,
    // asked for on the ticker, and then never started.
    for (const game of YARD_GAMES) expect(game.energy).toBeLessThan(PLAY_MIN_ENERGY)
  })

  it('have a session behind every row', () => {
    for (const game of YARD_GAMES) expect(YARD_SESSIONS[game.id]).toBeDefined()
  })

  it('have something for the pet to say about every one of them', () => {
    // A game with no line is a row on the menu nobody is ever told about.
    for (const game of YARD_GAMES) {
      const line = voice.yard(game.id, 'blob')
      expect(line.length).toBeGreaterThan(0)
      expect(line).toBe(line.toUpperCase())
    }
  })

  it('say the same thing on the menu as in the game', () => {
    // The title and the hint exist in both places; drift between them shows up
    // as a game that renames itself the moment you start it.
    for (const game of YARD_GAMES) {
      const session = YARD_SESSIONS[game.id]!
      expect(session.title).toBe(game.title)
      expect(session.hint).toBe(game.hint)
    }
  })

  it('ask for something different in each one', () => {
    // A yard game earns its place by playing unlike the three that are always
    // there. Two games sharing a hint are two games sharing a verb.
    const hints = [...YARD_GAMES.map((g) => g.hint), ...MINIGAMES.map((g) => g.hint)]
    expect(new Set(hints).size).toBe(hints.length)
  })

  it('never fill the menu past the bottom of the screen', () => {
    // The selected row is the tall one and the rest are a line each, so what
    // bounds the menu is how many rows there can be at once. A summer night is
    // the worst case: the ball, the butterfly and the fireflies all at home.
    const mostAtOnce = Math.max(
      ...SEASONS.map(
        (season) =>
          YARD_GAMES.filter((game) => {
            const visitor = VISITORS.find((v) => v.id === visitorFor(game, MEADOW.visitors))!
            return visitor.seasons.includes(season.id)
          }).length,
      ),
    )
    // 22px in, a tall row of 27 and the rest at 10, above the record line at 130.
    const rows = mostAtOnce + MINIGAMES.length
    expect(22 + 27 + (rows - 1) * 10).toBeLessThanOrEqual(130)
  })
})
