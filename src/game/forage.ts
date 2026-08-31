import { beat, type JourneyContext, type Leg } from '../data/journey'
import { findCurio, type Curio } from '../data/curios'
import type { KitDay, KitItem } from '../data/kit'
import { luckOf, type Ground } from '../data/grounds'
import type { CurioSet } from '../data/curios'
import { random } from '../engine/random'
import type { Burst } from '../render/particles'
import type { Stats } from './types'

/**
 * The forage: the pet walks off, and what happens out there is told rather than
 * waited out.
 *
 * The picture still cuts to black for the walk over the hill, because that part
 * is worth watching. The middle used to stay black for three seconds -- and the
 * screen shader blacks the HUD along with the scene, so nothing could be said
 * during it. Now the black hands over to a screen of its own, the trip arrives a
 * beat at a time, and once it is halfway through it asks whether to keep going.
 */

/** Real seconds each beat is held before the next arrives. */
const BEAT_SECONDS = 2.6
/** How long the player has to answer before the pet heads home on its own. */
const PROMPT_SECONDS = 4.5
/** How quickly the picture cuts out and back. */
const FADE_RATE = 3.5
/** What the world clock gains per leg walked. */
const WORLD_MS_PER_LEG = 2 * 60_000
/** How far the pet can be pushed. Three legs is a long way from the yard. */
const MAX_LEGS = 3
/** What each extra leg costs, as a share of the trip's own price. */
const PUSH_COST = 0.7
/** How much likelier a find gets with each leg past the first. */
const LUCK_PER_LEG = 0.12
/** How likely something goes wrong, per leg past the first. */
const MISHAP_PER_LEG = 0.22
/** How often a deep trip brings back something for the yard instead of the board. */
const YARD_CHANCE = 0.35
/** How often a trip picks up supplies alongside whatever else it found. */
const SUPPLY_CHANCE = 0.55
/** What a completed set of stones does to the odds of a mishap. */
const STONES_MISHAP = 0.55
/** What a completed set of blooms adds to the odds of finding anything. */
const BLOOMS_LUCK = 0.08
/** And what reading the sky is worth on top of that. */
const WEATHER_LUCK = 0.08

export type ForagePhase = 'idle' | 'leaving' | 'fading' | 'journey' | 'returning'

/** Where the telling has got to. */
type Stage = 'out' | 'middle' | 'prompt' | 'home' | 'result' | 'done'

/** What the forage needs from the game around it. */
export interface ForageHost {
  /** True while the pet is over the hill entirely; set by the renderer. */
  isPetAway(): boolean
  /** The world as the trip happens in it. Told which ground it is happening on. */
  journeyContext(ground: Ground): JourneyContext
  petName(): string
  /** How much the pet has left to spend on going further. */
  energy(): number
  /** Which collection sets the lineage has completed, and so what it is good at. */
  boons(): CurioSet[]
  /** Winds the world on by the time the trip took. */
  addWorldTime(ms: number): void
  addCurio(curio: Curio): void
  /**
   * Tries to bring home something that changes the yard -- a seed to plant, or
   * a stray won over -- rather than something for the collection board. Null
   * when the yard is full or there is nothing left out there to befriend, in
   * which case the trip settles into an ordinary find.
   */
  bringHome(legs: number): { what: string; announce: string } | null
  /**
   * Tries to turn up a piece of kit. Null when there is nothing out there for
   * this kind of day, or when the family already owns everything that is --
   * which is most trips, most of the time. The host rolls it, as it rolls the
   * yard and the supplies; the trip only decides whether to look.
   */
  takeKit(day: KitDay): KitItem | null
  /**
   * Picks up food and fuel on the way. Unlike a curio this is not the point of
   * the trip -- it happens alongside whatever else did -- so it returns what to
   * add to the end of the line, or null when the pet's arms were full.
   */
  gather(ground: Ground, legs: number): string | null
  applyStats(delta: Partial<Stats>): void
  speakNow(text: string): void
  burst(kind: Burst, count: number): void
  persist(): void
}

/**
 * What can go wrong out there. Only reachable by pushing on, so the risk is
 * always something the player chose rather than something the game did to them.
 */
const MISHAPS: { line: string; effect: Partial<Stats>; spoils: boolean }[] = [
  { line: 'comes home caked to the eyes in mud', effect: { hygiene: -20 }, spoils: false },
  { line: 'limps home, footsore', effect: { energy: -14 }, spoils: false },
  { line: 'comes home late, and with nothing', effect: { happiness: -4 }, spoils: true },
  { line: 'got caught out, and looks it', effect: { health: -6, hygiene: -10 }, spoils: true },
]

export class Forage {
  phase: ForagePhase = 'idle'
  /** How black the picture is, 0..1. */
  dim = 0
  /** What has been told so far, oldest first. The screen draws all of them. */
  beats: string[] = []
  /** What it came home with, once it is home. Null until then, and on no luck. */
  found: Curio | null = null
  /** Kit it came home with, which is a different and rarer kind of find. */
  foundKit: KitItem | null = null
  /** How many legs it has walked. One is a there-and-back; three is a long way. */
  legs = 1

  private stage: Stage = 'out'
  private timer = 0
  private ctx: JourneyContext | null = null
  private ground: Ground | null = null

  constructor(private host: ForageHost) {}

  /** True from the moment it is sent until it is back in the yard. */
  get active(): boolean {
    return this.phase !== 'idle'
  }

  /**
   * Whether the pet should be out of the yard. True from the walk out until the
   * trip is told; the renderer walks it home on the way back down.
   */
  get outOfSight(): boolean {
    return this.phase === 'leaving' || this.phase === 'fading' || this.phase === 'journey'
  }

  /** True while the trip itself is on screen, rather than the yard. */
  get telling(): boolean {
    return this.phase === 'journey'
  }

  /** True while the trip is waiting on an answer. */
  get choosing(): boolean {
    return this.phase === 'journey' && this.stage === 'prompt'
  }

  /** How much of the answering time is left, 1..0, for the bar under the prompt. */
  get chooseProgress(): number {
    return this.choosing ? Math.max(0, this.timer / PROMPT_SECONDS) : 0
  }

  /** What going on from here would cost. */
  get pushCost(): number {
    return Math.round((this.ground?.energy ?? 0) * PUSH_COST)
  }

  begin(ground: Ground): void {
    this.phase = 'leaving'
    this.beats = []
    this.found = null
    this.foundKit = null
    this.legs = 1
    this.stage = 'out'
    this.timer = 0
    this.ground = ground
    this.ctx = this.host.journeyContext(ground)
  }

  /**
   * Drops the trip on the floor, wherever it had got to.
   *
   * Everything a trip does from here on is done to a pet: it comes home tired,
   * it says what it found, it puts something in the larder. When the pet that
   * went on it is gone -- a retirement dismissed while it was still out over
   * the hill, or the whole lineage started over -- there is nobody for any of
   * that to happen to, and the walk home was reading its stats to work out how
   * the walk went. So this ends the trip without telling it: the host is not
   * touched at all, and what the pet was carrying goes with the pet.
   */
  abandon(): void {
    this.phase = 'idle'
    this.dim = 0
    this.beats = []
    this.found = null
    this.foundKit = null
    this.legs = 1
    this.stage = 'out'
    this.timer = 0
    this.ctx = null
    this.ground = null
  }

  /** Sends it on for one more leg. Ignored unless the trip is actually asking. */
  pushOn(): boolean {
    if (!this.choosing) return false
    if (this.host.energy() < this.pushCost) return false
    this.legs += 1
    this.host.applyStats({ energy: -this.pushCost })
    this.say('middle')
    this.stage = 'middle'
    return true
  }

  /** Calls it home. Also what happens if nobody answers. */
  headHome(): boolean {
    if (!this.choosing) return false
    this.say('home')
    this.stage = 'home'
    return true
  }

  advance(dt: number): void {
    const to = (target: number) => {
      this.dim += (target - this.dim) * Math.min(1, dt * FADE_RATE)
    }
    switch (this.phase) {
      case 'idle':
        to(0)
        return
      case 'leaving':
        // Nothing happens until it is actually over the hill.
        if (this.host.isPetAway()) this.phase = 'fading'
        return
      case 'fading':
        to(1)
        if (this.dim > 0.985) {
          // The trip screen is opaque, so handing over from a black picture to
          // a black panel in one frame is a change of what is being drawn
          // rather than anything the eye can catch.
          this.dim = 0
          this.phase = 'journey'
          this.say('out')
          this.stage = 'out'
        }
        return
      case 'journey':
        this.timer -= dt
        if (this.timer > 0) return
        this.next()
        return
      case 'returning':
        to(0)
        // Held until the pet is properly back in the yard, so the picture never
        // opens on an empty one.
        if (this.dim < 0.015 && !this.host.isPetAway()) {
          this.dim = 0
          this.phase = 'idle'
          this.beats = []
        }
        return
    }
  }

  /** Moves the telling on one step, once the current beat has had its time. */
  private next(): void {
    switch (this.stage) {
      case 'out':
        this.say('middle')
        this.stage = 'middle'
        return
      case 'middle':
        // Only offer to go further while there is somewhere further to go and
        // the pet could actually walk it.
        if (this.legs < MAX_LEGS && this.host.energy() >= this.pushCost) {
          this.stage = 'prompt'
          this.timer = PROMPT_SECONDS
          return
        }
        this.say('home')
        this.stage = 'home'
        return
      case 'prompt':
        // Nobody answered, so it comes home. An idle player is never blocked,
        // and never punished for looking away either.
        this.headHome()
        return
      case 'home':
        this.settle()
        this.stage = 'result'
        return
      case 'result':
      case 'done':
        this.stage = 'done'
        this.host.addWorldTime(WORLD_MS_PER_LEG * this.legs)
        this.dim = 1
        this.phase = 'returning'
        return
    }
  }

  /**
   * Tells one beat of the walk and starts its clock. A pushed trip asks for
   * several middles in a row, and the same sentence twice reads as a bug rather
   * than as the pet doing the same thing twice, so a repeat is redrawn.
   */
  private say(leg: Leg): void {
    this.timer = BEAT_SECONDS
    // Both are set by `begin`, and nothing tells a trip anything before it has
    // begun, so a beat always has a world to happen in.
    const ctx = this.ctx!
    let line = beat(leg, ctx)
    for (let tries = 0; tries < 5 && this.beats.includes(line); tries++) {
      line = beat(leg, ctx)
    }
    this.beats.push(line)
  }

  /**
   * What it found out there, judged on the ground it was sent to, the day it
   * was sent on, and how far it was pushed -- so the read the menu gave before
   * it left is the same one the trip is settled against.
   */
  private settle(): void {
    this.timer = BEAT_SECONDS
    const ctx = this.ctx!
    const ground = this.ground!
    const name = this.host.petName()

    const extra = this.legs - 1
    // What the collection is worth. Every set makes the pet better at the job
    // that fills the board, so finishing one pays out every trip after it.
    const boons = this.host.boons()
    const mishapOdds = extra * MISHAP_PER_LEG * (boons.includes('stones') ? STONES_MISHAP : 1)
    const mishap = random() < mishapOdds ? pickMishap() : null
    const bonus =
      (boons.includes('blooms') ? BLOOMS_LUCK : 0) + (boons.includes('weather') ? WEATHER_LUCK : 0)
    const luck = Math.min(
      0.95,
      luckOf(ground, ctx.season, ctx.weather) + extra * LUCK_PER_LEG + bonus,
    )
    const curio = findCurio(ctx.season, ctx.weather, random(), ground.favours, this.legs)

    this.host.applyStats({ happiness: 6 })
    if (mishap) this.host.applyStats(mishap.effect)

    // A deep trip can turn up something that changes the yard rather than the
    // board. Tried before the curio, and falls straight through to it when the
    // yard is full or there is nothing left to win over.
    if (extra > 0 && !mishap?.spoils && random() < YARD_CHANCE) {
      const brought = this.host.bringHome(this.legs)
      if (brought) {
        this.beats.push(
          mishap ? `${mishap.line}, with ${brought.what}` : `comes home with ${brought.what}`,
        )
        this.host.speakNow(brought.announce)
        this.host.burst('sparkle', 12)
        this.host.persist()
        return
      }
    }

    // Kit is the rarest thing out there and, when it happens, it is the whole
    // story of the trip: the umbrella turns up on the day the pet wanted one.
    // So it is tried before the find and comes home in place of it, supplies
    // and all -- a trip that brought back a torch does not also need to
    // mention the brambles. The odds live with the host, along with the roll:
    // most days have no kit on them at all, and asking on those days must not
    // cost the trip a die.
    if (!mishap?.spoils) {
      const item = this.host.takeKit({
        season: ctx.season,
        weather: ctx.weather,
        night: ctx.night,
        role: ground.role,
        depth: this.legs,
      })
      if (item) {
        this.foundKit = item
        this.beats.push(
          mishap ? `${mishap.line}, carrying ${item.what}` : `comes home with ${item.what}`,
        )
        this.host.speakNow(`${name} came back with ${item.what}`)
        this.host.burst('sparkle', 16)
        this.host.persist()
        return
      }
    }

    // Supplies are picked up on the way rather than looked for, so they ride
    // along with whatever the trip was actually about -- including a bad one.
    const supply =
      !mishap?.spoils && random() < SUPPLY_CHANCE
        ? this.host.gather(ground, this.legs)
        : null

    const empty = mishap?.spoils || !curio || random() >= luck
    if (empty) {
      const line = mishap ? mishap.line : 'comes home empty handed'
      this.beats.push(supply ? `${line}, but with ${supply}` : line)
      this.host.speakNow(supply ? `${name} brought back ${supply}` : `${name} came back with nothing`)
      this.host.persist()
      return
    }

    this.found = curio
    this.host.addCurio(curio)
    const what = curio.name.toLowerCase()
    // A mishap that did not spoil the find is worth saying alongside it: the
    // whole point of pushing on is coming back muddy and pleased with yourself.
    const line = mishap ? `${mishap.line}, holding a ${what}` : `comes home with a ${what}`
    this.beats.push(supply ? `${line}, and ${supply}` : line)
    this.host.speakNow(`${name} came back with a ${what}`)
    this.host.burst('sparkle', 12)
    this.host.persist()
  }
}

const pickMishap = () => MISHAPS[Math.floor(random() * MISHAPS.length)]!
