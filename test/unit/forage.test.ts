import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Forage, type ForageHost } from '../../src/game/forage'
import { groundById, type Ground } from '../../src/data/grounds'
import { resetRandom, scripted, seeded, setRandom } from '../../src/engine/random'
import type { Curio } from '../../src/data/curios'
import { kitById, kitPowers, NO_KIT, type KitPowers } from '../../src/data/kit'
import type { JourneyContext } from '../../src/data/journey'
import type { Stats } from '../../src/game/types'

/**
 * The forage, driven directly. It is a small state machine wrapped around a
 * pile of dice, and it is the one place the game takes something away from the
 * player -- so what matters here is that the machine always reaches its end,
 * whatever the dice say, and never leaves the pet over the hill.
 */

/** A recording host, so a trip can be inspected rather than watched. */
function stubHost(overrides: Partial<ForageHost> = {}) {
  const calls = {
    curios: [] as Curio[],
    stats: [] as Partial<Stats>[],
    spoken: [] as string[],
    bursts: [] as string[],
    worldTime: 0,
    persists: 0,
    /** How deep each trip looked, which a torch can raise without walking. */
    depths: [] as number[],
    broughtHome: 0,
    gathered: 0,
  }
  let away = false
  const host: ForageHost = {
    isPetAway: () => away,
    journeyContext: (ground): JourneyContext => ({
      role: ground.role,
      place: ground.place,
      season: 'spring',
      weather: 'clear',
      night: false,
      speciesId: 'blob',
    }),
    petName: () => 'PIP',
    energy: () => 100,
    boons: () => [],
    addWorldTime: (ms) => {
      calls.worldTime += ms
    },
    addCurio: (curio) => calls.curios.push(curio),
    // Nothing to find by default: kit is the rarest thing out there, and a
    // trip that keeps turning one up is not the trip most of these test.
    takeKit: () => null,
    // No kit, unless a test is about having some.
    kit: () => NO_KIT,
    bringHome: () => {
      calls.broughtHome++
      return null
    },
    gather: (_ground, depth) => {
      calls.gathered++
      calls.depths.push(depth)
      return null
    },
    applyStats: (delta) => calls.stats.push(delta),
    speakNow: (text) => calls.spoken.push(text),
    burst: (kind) => calls.bursts.push(kind),
    persist: () => {
      calls.persists++
    },
    ...overrides,
  }
  return {
    host,
    calls,
    setAway(value: boolean) {
      away = value
    },
  }
}

const WALL = groundById('wall')
const HILL = groundById('hill')
/** One piece of kit, for the trips that are about coming home carrying one. */
const TORCH = kitById('torch')!

/** Runs frames until the trip is idle again, or gives up loudly. */
function runToEnd(forage: Forage, away: { setAway(v: boolean): void }, maxSeconds = 120): number {
  let elapsed = 0
  const dt = 1 / 60
  while (forage.active && elapsed < maxSeconds) {
    // The renderer walks the pet out and back; stand in for it here.
    away.setAway(forage.outOfSight)
    forage.advance(dt)
    elapsed += dt
  }
  away.setAway(false)
  // One more frame so the return can settle now the pet is home.
  if (forage.active) {
    forage.advance(dt)
    elapsed += dt
  }
  return elapsed
}

beforeEach(() => setRandom(seeded(4)))
afterEach(() => resetRandom())

describe('a trip', () => {
  it('starts idle, with nothing to show', () => {
    const forage = new Forage(stubHost().host)
    expect(forage.active).toBe(false)
    expect(forage.telling).toBe(false)
    expect(forage.outOfSight).toBe(false)
    expect(forage.beats).toEqual([])
    expect(forage.found).toBeNull()
  })

  it('does nothing at all while idle', () => {
    const forage = new Forage(stubHost().host)
    forage.advance(10)
    expect(forage.active).toBe(false)
    expect(forage.dim).toBe(0)
  })

  it('leaves the yard when it begins, and waits until the pet is over the hill', () => {
    const { host, setAway } = stubHost()
    const forage = new Forage(host)
    forage.begin(WALL)
    expect(forage.phase).toBe('leaving')
    expect(forage.outOfSight).toBe(true)
    forage.advance(1)
    expect(forage.phase).toBe('leaving')
    setAway(true)
    forage.advance(1 / 60)
    expect(forage.phase).toBe('fading')
  })

  it('cuts the picture to black before handing over to the trip screen', () => {
    const { host, setAway } = stubHost()
    const forage = new Forage(host)
    forage.begin(WALL)
    setAway(true)
    forage.advance(1 / 60)
    for (let i = 0; i < 200 && forage.phase === 'fading'; i++) forage.advance(1 / 60)
    expect(forage.phase).toBe('journey')
    // The handover is a change of what is drawn, not a visible flash.
    expect(forage.dim).toBe(0)
    expect(forage.telling).toBe(true)
    expect(forage.beats).toHaveLength(1)
  })

  it('tells the trip a beat at a time', () => {
    const { host, setAway } = stubHost()
    const forage = new Forage(host)
    forage.begin(WALL)
    setAway(true)
    for (let i = 0; i < 200 && !forage.telling; i++) forage.advance(1 / 60)
    expect(forage.beats).toHaveLength(1)
    forage.advance(3)
    expect(forage.beats).toHaveLength(2)
  })

  it('gets home, from every ground, on any dice', () => {
    for (const ground of [WALL, HILL, groundById('creek'), groundById('hollow')]) {
      for (let seed = 0; seed < 12; seed++) {
        setRandom(seeded(seed))
        const stub = stubHost()
        const forage = new Forage(stub.host)
        forage.begin(ground)
        const seconds = runToEnd(forage, stub)
        expect(forage.active, `${ground.id} seed ${seed} never came home`).toBe(false)
        expect(forage.phase).toBe('idle')
        expect(forage.outOfSight).toBe(false)
        expect(seconds).toBeLessThan(60)
      }
    }
  })

  it('clears the beats once the pet is back in the yard', () => {
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(WALL)
    runToEnd(forage, stub)
    expect(forage.beats).toEqual([])
    expect(forage.dim).toBe(0)
  })

  it('never opens the picture on an empty yard', () => {
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(WALL)
    // Play it out with the pet held away: the trip must stay held, not idle.
    for (let i = 0; i < 60 * 60; i++) {
      stub.setAway(true)
      forage.advance(1 / 60)
      if (forage.phase === 'returning') break
    }
    for (let i = 0; i < 600; i++) forage.advance(1 / 60)
    expect(forage.phase).toBe('returning')
    // Once the pet is home it can finish.
    stub.setAway(false)
    forage.advance(1 / 60)
    expect(forage.phase).toBe('idle')
  })

  it('winds the world on by the time it took', () => {
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(WALL)
    runToEnd(forage, stub)
    expect(stub.calls.worldTime).toBe(2 * 60_000)
  })

  it('is always worth a little cheer, whatever it found', () => {
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(WALL)
    runToEnd(forage, stub)
    expect(stub.calls.stats).toContainEqual({ happiness: 6 })
  })

  it('says something out loud and saves, whatever the outcome', () => {
    for (let seed = 0; seed < 8; seed++) {
      setRandom(seeded(seed))
      const stub = stubHost()
      const forage = new Forage(stub.host)
      forage.begin(WALL)
      runToEnd(forage, stub)
      expect(stub.calls.spoken.length, `seed ${seed}`).toBeGreaterThan(0)
      expect(stub.calls.persists).toBeGreaterThan(0)
    }
  })

  it('never repeats a beat, so the same sentence twice never reads as a bug', () => {
    for (let seed = 0; seed < 30; seed++) {
      setRandom(seeded(seed))
      const stub = stubHost()
      const forage = new Forage(stub.host)
      forage.begin(HILL)
      const beats: string[] = []
      const dt = 1 / 60
      for (let i = 0; i < 60 * 60 && forage.active; i++) {
        stub.setAway(forage.outOfSight)
        forage.advance(dt)
        if (forage.choosing) forage.pushOn()
        for (const beat of forage.beats) if (!beats.includes(beat)) beats.push(beat)
      }
      // The narration beats -- everything before the result line.
      const narration = beats.filter((b) => !b.includes('comes home') && !b.includes('holding'))
      expect(new Set(narration).size, `seed ${seed}`).toBe(narration.length)
    }
  })

  it('resets everything when a second trip begins', () => {
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    runToEnd(forage, stub)
    forage.begin(WALL)
    expect(forage.legs).toBe(1)
    expect(forage.found).toBeNull()
    expect(forage.beats).toEqual([])
    expect(forage.phase).toBe('leaving')
  })
})

describe('the prompt', () => {
  /** Plays a trip up to the moment it asks whether to go on. */
  function toPrompt(ground: Ground, host = stubHost()) {
    const forage = new Forage(host.host)
    forage.begin(ground)
    for (let i = 0; i < 60 * 60 && !forage.choosing; i++) {
      host.setAway(forage.outOfSight)
      forage.advance(1 / 60)
    }
    return { forage, host }
  }

  it('asks after the middle of the trip', () => {
    const { forage } = toPrompt(HILL)
    expect(forage.choosing).toBe(true)
    expect(forage.beats.length).toBeGreaterThanOrEqual(2)
  })

  it('counts down while it waits', () => {
    const { forage } = toPrompt(HILL)
    expect(forage.chooseProgress).toBeCloseTo(1, 1)
    forage.advance(2)
    expect(forage.chooseProgress).toBeLessThan(1)
    expect(forage.chooseProgress).toBeGreaterThan(0)
  })

  it('has no progress to show when it is not asking', () => {
    const forage = new Forage(stubHost().host)
    expect(forage.chooseProgress).toBe(0)
  })

  it('sends the pet on for another leg, at a cost', () => {
    const { forage, host } = toPrompt(HILL)
    const cost = forage.pushCost
    expect(cost).toBeGreaterThan(0)
    expect(forage.pushOn()).toBe(true)
    expect(forage.legs).toBe(2)
    expect(host.calls.stats).toContainEqual({ energy: -cost })
    expect(forage.choosing).toBe(false)
  })

  it('calls the pet home', () => {
    const { forage } = toPrompt(HILL)
    expect(forage.headHome()).toBe(true)
    expect(forage.choosing).toBe(false)
  })

  it('brings the pet home on its own if nobody answers', () => {
    const { forage, host } = toPrompt(HILL)
    const before = forage.legs
    runToEnd(forage, host)
    expect(forage.legs).toBe(before)
    expect(forage.phase).toBe('idle')
  })

  it('ignores both answers when it is not asking', () => {
    const forage = new Forage(stubHost().host)
    expect(forage.pushOn()).toBe(false)
    expect(forage.headHome()).toBe(false)
    forage.begin(HILL)
    expect(forage.pushOn()).toBe(false)
    expect(forage.headHome()).toBe(false)
  })

  it('refuses to push a pet that cannot afford the walk', () => {
    const tired = stubHost({ energy: () => 1 })
    const { forage } = toPrompt(HILL, tired)
    // With no energy the trip never even offers, so force the case directly.
    expect(forage.choosing).toBe(false)
  })

  it('will not push when the pet is one short of the cost', () => {
    let energy = 100
    const host = stubHost({ energy: () => energy })
    const { forage } = toPrompt(HILL, host)
    expect(forage.choosing).toBe(true)
    energy = forage.pushCost - 1
    expect(forage.pushOn()).toBe(false)
    expect(forage.legs).toBe(1)
  })

  it('stops offering once the pet has walked as far as it can', () => {
    const { forage, host } = toPrompt(HILL)
    forage.pushOn()
    for (let i = 0; i < 60 * 60 && !forage.choosing && forage.active; i++) {
      host.setAway(forage.outOfSight)
      forage.advance(1 / 60)
    }
    expect(forage.legs).toBe(2)
    expect(forage.choosing).toBe(true)
    forage.pushOn()
    expect(forage.legs).toBe(3)
    // Three legs is the limit; it must now head home rather than ask again.
    runToEnd(forage, host)
    expect(forage.legs).toBe(3)
  })

  it('charges the world clock for every leg walked', () => {
    const { forage, host } = toPrompt(HILL)
    forage.pushOn()
    runToEnd(forage, host)
    expect(host.calls.worldTime).toBe(2 * 60_000 * forage.legs)
  })

  it('costs nothing to push a ground with no price on it', () => {
    const forage = new Forage(stubHost().host)
    expect(forage.pushCost).toBe(0)
  })
})

describe('what it comes home with', () => {
  /** Runs one trip on scripted dice and reports what happened. */
  function trip(rolls: number[], ground = WALL, overrides: Partial<ForageHost> = {}) {
    setRandom(scripted(rolls))
    const stub = stubHost(overrides)
    const forage = new Forage(stub.host)
    forage.begin(ground)
    const dt = 1 / 60
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(dt)
      if (forage.choosing) forage.headHome()
      if (forage.beats.length > 0 && !forage.telling) break
    }
    const beats = [...forage.beats]
    const found = forage.found
    runToEnd(forage, stub)
    return { beats, found, ...stub.calls }
  }

  it('comes home empty handed when the luck is against it', () => {
    // Every roll at the top of the range: no mishap, no yard find, no supply,
    // and a luck check that fails.
    const result = trip([0.999])
    expect(result.found).toBeNull()
    expect(result.spoken.join(' ')).toContain('came back with nothing')
  })

  it('comes home with a curio when the luck is with it', () => {
    const result = trip([0, 0, 0, 0, 0])
    expect(result.found).not.toBeNull()
    expect(result.curios).toHaveLength(1)
    expect(result.spoken.join(' ')).toContain('came back with a')
  })

  it('sparkles for a find and not for an empty trip', () => {
    expect(trip([0, 0, 0, 0, 0]).bursts).toContain('sparkle')
    expect(trip([0.999]).bursts).toEqual([])
  })

  it('never has a mishap on a there-and-back, so risk is always chosen', () => {
    for (let seed = 0; seed < 40; seed++) {
      setRandom(seeded(seed))
      const stub = stubHost()
      const forage = new Forage(stub.host)
      forage.begin(WALL)
      const dt = 1 / 60
      const seen: string[] = []
      for (let i = 0; i < 60 * 60 && forage.active; i++) {
        stub.setAway(forage.outOfSight)
        forage.advance(dt)
        if (forage.choosing) forage.headHome()
        for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
      }
      const mishaps = ['caked to the eyes in mud', 'limps home', 'comes home late', 'got caught out']
      for (const line of mishaps) {
        expect(seen.some((b) => b.includes(line)), `seed ${seed}: ${line}`).toBe(false)
      }
    }
  })

  it('can go wrong once the pet has been pushed on', () => {
    // Push to two legs, then a mishap roll that lands.
    setRandom(scripted([0]))
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const dt = 1 / 60
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(dt)
      if (forage.choosing) forage.pushOn()
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    // With every roll at zero the mishap check passes and the first mishap wins.
    expect(seen.some((b) => b.includes('caked to the eyes in mud'))).toBe(true)
  })

  it('says the mishap alongside the find, because that is the point of pushing on', () => {
    setRandom(scripted([0]))
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const dt = 1 / 60
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(dt)
      if (forage.choosing) forage.pushOn()
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    const result = seen.find((b) => b.includes('mud'))
    expect(result).toBeDefined()
  })

  it('applies the mishap"s own cost', () => {
    setRandom(scripted([0]))
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const dt = 1 / 60
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(dt)
      if (forage.choosing) forage.pushOn()
    }
    expect(stub.calls.stats).toContainEqual({ hygiene: -20 })
  })

  it('brings something home for the yard on a deep trip', () => {
    const brought = { what: 'a hard little seed, and puts it in', announce: 'PIP planted it' }
    setRandom(scripted([0.9, 0, 0]))
    const stub = stubHost({ bringHome: () => brought })
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const dt = 1 / 60
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(dt)
      if (forage.choosing) forage.pushOn()
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    expect(seen.some((b) => b.includes('hard little seed'))).toBe(true)
    expect(stub.calls.spoken).toContain('PIP planted it')
  })

  it('falls through to an ordinary find when the yard has no room', () => {
    // bringHome returns null by default, so the trip must not simply stop.
    setRandom(scripted([0.9, 0, 0]))
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const dt = 1 / 60
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(dt)
      if (forage.choosing) forage.pushOn()
    }
    expect(stub.calls.broughtHome).toBeGreaterThan(0)
    expect(stub.calls.spoken.length).toBeGreaterThan(0)
  })

  /**
   * A constant roll rather than a scripted list: the narration draws from the
   * same dice as the outcome, so counting calls is brittle. A single value
   * chosen against the ground"s own luck settles every branch at once.
   */
  function tripAt(roll: number, ground: Ground, overrides: Partial<ForageHost> = {}) {
    setRandom(() => roll)
    const stub = stubHost(overrides)
    const forage = new Forage(stub.host)
    forage.begin(ground)
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(1 / 60)
      if (forage.choosing) forage.headHome()
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    return { seen, found: forage.found, ...stub.calls }
  }

  it('picks up supplies alongside a find', () => {
    // The wall"s luck is 0.55 on an ordinary day, so a roll under it finds
    // something -- and 0.2 is also under the supply chance.
    const result = tripAt(0.2, WALL, { gather: () => 'an armful of kindling' })
    expect(result.found).not.toBeNull()
    expect(result.seen.some((b) => b.includes('kindling'))).toBe(true)
    expect(result.spoken.join(' ')).toContain('came back with a')
  })

  it('mentions the supply even on an otherwise empty trip', () => {
    // The creek in clear weather is a poor prospect: luck 0.35, so 0.4 comes
    // home empty -- but still under the supply chance on the way.
    const result = tripAt(0.4, groundById('creek'), { gather: () => 'an armful of kindling' })
    expect(result.found).toBeNull()
    expect(result.seen.some((b) => b.includes('empty handed, but with an armful of kindling'))).toBe(true)
    expect(result.spoken.join(' ')).toContain('brought back an armful of kindling')
  })

  it('makes a completed set of blooms and one of weather sharpen the eye', () => {
    // Both boons raise the odds of coming home with something, so a roll that
    // just misses without them lands with them. Wall luck is 0.55; blooms and
    // weather add 0.08 each, so 0.6 is empty bare and a find with both.
    const bare = tripAt(0.6, WALL, { boons: () => [] })
    const blessed = tripAt(0.6, WALL, { boons: () => ['blooms', 'weather'] })
    expect(bare.found).toBeNull()
    expect(blessed.found).not.toBeNull()
  })

  it('says a clean yard find on its own, with no mishap to mention', () => {
    // One push only: at two legs the odds of a mishap are 0.22 and the yard
    // chance is 0.35, so a roll of 0.3 falls between them.
    setRandom(() => 0.3)
    const brought = { what: 'a bramble cutting', announce: 'PIP planted a bramble' }
    const stub = stubHost({ bringHome: () => brought })
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const seen: string[] = []
    let pushed = false
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(1 / 60)
      if (forage.choosing) {
        if (!pushed) {
          forage.pushOn()
          pushed = true
        } else {
          forage.headHome()
        }
      }
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    expect(forage.legs).toBe(2)
    expect(seen).toContain('comes home with a bramble cutting')
    expect(stub.calls.spoken).toContain('PIP planted a bramble')
  })

  it('says what kit it came home with, in place of a find', () => {
    // Every roll at the top: no mishap, no yard find, and the luck check for a
    // curio fails -- so the only thing this trip can be about is the kit.
    setRandom(() => 0.99)
    const stub = stubHost({ takeKit: () => TORCH })
    const forage = new Forage(stub.host)
    forage.begin(WALL)
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(1 / 60)
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    expect(seen).toContain('comes home with a torch')
    expect(stub.calls.spoken).toContain('PIP came back with a torch')
    expect(forage.foundKit).toBe(TORCH)
    // The kit is the whole story of the trip, so nothing was added to the board.
    expect(stub.calls.curios).toEqual([])
  })

  it('says the mishap and the kit together, since one does not spoil the other', () => {
    // Rolls at zero: a mishap that does not spoil the trip, and kit anyway.
    setRandom(() => 0)
    const stub = stubHost({ bringHome: () => null, takeKit: () => TORCH })
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(1 / 60)
      if (forage.choosing) forage.pushOn()
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    expect(seen.some((b) => b.includes('mud, carrying a torch'))).toBe(true)
  })

  it('spares the mishap an umbrella is for, rather than swapping it for another', () => {
    // Every roll at zero: the mishap check passes and the first mishap wins,
    // which is the mud. With an umbrella that simply did not happen -- and
    // nothing else happened in its place.
    setRandom(() => 0)
    const powers: KitPowers = { ...NO_KIT, spares: ['mud'] }
    const stub = stubHost({ kit: () => powers })
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(1 / 60)
      if (forage.choosing) forage.pushOn()
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    for (const line of ['mud', 'footsore', 'and with nothing', 'caught out']) {
      expect(seen.some((b) => b.includes(line)), line).toBe(false)
    }
    // And the trip was not made worse in some other way to make up for it.
    expect(stub.calls.stats.some((d) => (d.hygiene ?? 0) < 0)).toBe(false)
  })

  it('settles the trip against the same kit the menu was read with', () => {
    // The hill wants a clear day. On a wet one it is a poor prospect and the
    // find usually fails; an umbrella takes the rain out of that reckoning, so
    // the same dice come home with something.
    const wet = { season: 'spring', weather: 'rain', night: false } as const
    const trip = (kit: KitPowers) => {
      setRandom(scripted([0.6]))
      const stub = stubHost({
        kit: () => kit,
        journeyContext: (ground) => ({
          role: ground.role,
          place: ground.place,
          season: wet.season,
          weather: wet.weather,
          night: false,
          speciesId: 'blob',
        }),
      })
      const forage = new Forage(stub.host)
      forage.begin(HILL)
      runToEnd(forage, stub)
      return stub.calls.curios.length
    }
    expect(trip(NO_KIT)).toBe(0)
    expect(trip(kitPowers(['umbrella'], wet))).toBe(1)
  })

  it('never looks for kit on a trip that was spoiled before it got anywhere', () => {
    // A spoiling mishap takes the whole trip with it, kit included: the pet did
    // not get where it was going, so there was nowhere to find anything. Run
    // over seeds rather than a scripted trip, because how many dice a trip
    // throws before it settles depends on the sentences it happened to pick.
    let spoiled = 0
    for (let seed = 0; seed < 40; seed++) {
      setRandom(seeded(seed))
      let asked = 0
      const stub = stubHost({
        takeKit: () => {
          asked++
          return TORCH
        },
      })
      const forage = new Forage(stub.host)
      forage.begin(HILL)
      const seen: string[] = []
      for (let i = 0; i < 60 * 120 && forage.active; i++) {
        stub.setAway(forage.outOfSight)
        forage.advance(1 / 60)
        if (forage.choosing) forage.pushOn()
        for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
      }
      const wasted = seen.some((b) => b.includes('and with nothing') || b.includes('caught out'))
      if (!wasted) continue
      spoiled++
      expect(asked, `seed ${seed}`).toBe(0)
      expect(forage.foundKit, `seed ${seed}`).toBeNull()
    }
    // Or the assertion above never ran and this test proved nothing.
    expect(spoiled).toBeGreaterThan(0)
  })

  it('says the mishap and the yard find together on a bad deep trip', () => {
    // Rolls at zero: a mishap that does not spoil the trip, and a seed anyway.
    setRandom(() => 0)
    const brought = { what: 'a hard little seed', announce: 'PIP planted a seed' }
    const stub = stubHost({ bringHome: () => brought })
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    const seen: string[] = []
    for (let i = 0; i < 60 * 120 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(1 / 60)
      if (forage.choosing) forage.pushOn()
      for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
    }
    expect(seen.some((b) => b.includes('mud, with a hard little seed'))).toBe(true)
  })

  /** How many of sixty seeded trips to the hill went wrong, given a world. */
  function mishapsOver(
    kit: KitPowers,
    ctx: Partial<JourneyContext> = {},
  ): number {
    let count = 0
    for (let seed = 0; seed < 60; seed++) {
      setRandom(seeded(seed))
      const stub = stubHost({
        kit: () => kit,
        journeyContext: (ground) => ({
          role: ground.role,
          place: ground.place,
          season: 'spring',
          weather: 'clear',
          night: false,
          speciesId: 'blob',
          ...ctx,
        }),
      })
      const forage = new Forage(stub.host)
      forage.begin(HILL)
      const seen: string[] = []
      for (let i = 0; i < 60 * 120 && forage.active; i++) {
        stub.setAway(forage.outOfSight)
        forage.advance(1 / 60)
        if (forage.choosing) forage.pushOn()
        for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
      }
      if (seen.some((b) => /mud|limps|late|caught out/.test(b))) count++
    }
    return count
  }

  it('makes the dark cost something, but only to a trip that pushed on', () => {
    // The one thing the kit takes away. It is a multiplier on the price of
    // being greedy rather than a risk of its own, so a there-and-back after
    // dark is exactly as safe as it always was -- risk is still always chosen.
    expect(mishapsOver(NO_KIT, { night: true })).toBeGreaterThan(mishapsOver(NO_KIT))
  })

  it('lets a torch put the dark back the way it was', () => {
    const lit = kitPowers(['torch'], { season: 'spring', weather: 'clear', night: true })
    expect(mishapsOver(lit, { night: true })).toBeLessThan(mishapsOver(NO_KIT, { night: true }))
  })

  it('keeps a pet in boots out of trouble', () => {
    const boots = kitPowers(['boots'], { season: 'spring', weather: 'clear', night: false })
    expect(mishapsOver(boots)).toBeLessThan(mishapsOver(NO_KIT))
  })

  it('sells one more leg cheap to a pet on a board, and charges what it quoted', () => {
    const snow = { season: 'winter', weather: 'snow', night: false } as const
    const cost = (kit: KitPowers) => {
      setRandom(seeded(3))
      const spent: number[] = []
      const stub = stubHost({
        kit: () => kit,
        applyStats: (delta) => {
          if (delta.energy !== undefined) spent.push(-delta.energy)
        },
      })
      const forage = new Forage(stub.host)
      forage.begin(HILL)
      let quoted = 0
      for (let i = 0; i < 60 * 120 && forage.active; i++) {
        stub.setAway(forage.outOfSight)
        forage.advance(1 / 60)
        if (forage.choosing) {
          quoted = forage.pushCost
          forage.pushOn()
        }
      }
      return { quoted, spent }
    }
    const bare = cost(NO_KIT)
    const board = cost(kitPowers(['snowboard'], snow))
    expect(board.quoted).toBeLessThan(bare.quoted)
    // The prompt offered a price; the push has to charge that one.
    expect(board.spent).toContain(board.quoted)
  })

  it('sees a leg further into the dark with a torch lit', () => {
    // Depth is what the trip looks for a find at, and a torch adds one --
    // without the pet having walked it.
    const found = (kit: KitPowers) => {
      setRandom(() => 0)
      const stub = stubHost({ kit: () => kit })
      const forage = new Forage(stub.host)
      forage.begin(WALL)
      runToEnd(forage, stub)
      return stub.calls.depths
    }
    expect(found(NO_KIT)).toEqual([1])
    const lit = kitPowers(['torch'], { season: 'spring', weather: 'clear', night: true })
    expect(found(lit)).toEqual([2])
  })

  it('comes home with supplies more often for a pet carrying a basket', () => {
    const gathersOver = (kit: KitPowers) => {
      let count = 0
      for (let seed = 0; seed < 60; seed++) {
        setRandom(seeded(seed))
        const stub = stubHost({ kit: () => kit })
        const forage = new Forage(stub.host)
        forage.begin(WALL)
        runToEnd(forage, stub)
        count += stub.calls.gathered
      }
      return count
    }
    const basket = kitPowers(['basket'], { season: 'spring', weather: 'clear', night: false })
    expect(gathersOver(basket)).toBeGreaterThan(gathersOver(NO_KIT))
  })

  it('makes a completed set of stones pay out on every trip after it', () => {
    // Stones cut the odds of a mishap, so the same dice go wrong less often.
    const mishapsWith = (boons: 'stones'[]) => {
      let count = 0
      for (let seed = 0; seed < 60; seed++) {
        setRandom(seeded(seed))
        const stub = stubHost({ boons: () => boons })
        const forage = new Forage(stub.host)
        forage.begin(HILL)
        const seen: string[] = []
        for (let i = 0; i < 60 * 120 && forage.active; i++) {
          stub.setAway(forage.outOfSight)
          forage.advance(1 / 60)
          if (forage.choosing) forage.pushOn()
          for (const b of forage.beats) if (!seen.includes(b)) seen.push(b)
        }
        if (seen.some((b) => /mud|limps|late|caught out/.test(b))) count++
      }
      return count
    }
    expect(mishapsWith(['stones'])).toBeLessThan(mishapsWith([]))
  })
})

describe('robustness', () => {
  it('settles harmlessly if it is somehow advanced with no context', () => {
    // Not reachable through the game, but a state machine that throws on an
    // unexpected order is a state machine that can strand the pet.
    const forage = new Forage(stubHost().host)
    expect(() => forage.advance(1)).not.toThrow()
    expect(forage.phase).toBe('idle')
  })

  it('survives being advanced with an enormous timestep', () => {
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(WALL)
    stub.setAway(true)
    expect(() => {
      for (let i = 0; i < 40; i++) {
        stub.setAway(forage.outOfSight)
        forage.advance(1000)
      }
    }).not.toThrow()
    stub.setAway(false)
    forage.advance(1000)
    expect(forage.phase).toBe('idle')
  })

  it('keeps the dim between 0 and 1 throughout', () => {
    const stub = stubHost()
    const forage = new Forage(stub.host)
    forage.begin(HILL)
    for (let i = 0; i < 60 * 60 && forage.active; i++) {
      stub.setAway(forage.outOfSight)
      forage.advance(1 / 60)
      expect(forage.dim).toBeGreaterThanOrEqual(0)
      expect(forage.dim).toBeLessThanOrEqual(1)
    }
  })
})
