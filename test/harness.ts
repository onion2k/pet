import { afterEach } from 'vitest'
import { manualClock, resetClock, setClock } from '../src/engine/clock'
import { resetRandom, scripted, seeded, setRandom, type RandomFn } from '../src/engine/random'
import {
  App,
  HOLD_TO_BACK_SECONDS,
  MOVE_HOLD_SECONDS,
  RETIRE_HOLD_SECONDS,
  type AppHooks,
} from '../src/game/app'
import { STAGE_DURATION } from '../src/game/tuning'
import {
  cancelPendingSave,
  memoryStorage,
  resetIdSource,
  resetStorage,
  setIdSource,
  setStorage,
  type SaveStorage,
} from '../src/game/save'
import type { ButtonId } from '../src/render/shell'
import type { Burst } from '../src/render/particles'
import type { SoundId } from '../src/engine/audio'
import type { SaveFile, Stage } from '../src/game/types'

/**
 * A whole game with the shell taken off.
 *
 * The App is already free of the renderer -- it talks to it through five
 * callbacks and reads nothing back except two flags. So the fastest, most
 * honest way to test how the game behaves is to drive that same interface: real
 * button presses, real frames, real save file, and no canvas anywhere. A pet's
 * entire life runs in a few milliseconds, which means the tests can afford to
 * play out the situations that actually worry a player -- a weekend away, a
 * night skipped, a game quit halfway -- rather than assert on fragments of them.
 *
 * Everything non-deterministic is pinned: the clock is wound by hand, the dice
 * are seeded or scripted, and storage is a plain object the test can read.
 */

/** One thing the app asked the renderer or the speaker to do. */
export type HookCall =
  | { kind: 'sound'; id: SoundId }
  | { kind: 'burst'; burst: Burst; count?: number }
  | { kind: 'pop'; strength?: number }
  | { kind: 'form'; speciesId: string; animate: boolean }
  | { kind: 'depart' }
  | { kind: 'arrive' }

/** The frame rate the harness pretends to run at. Fine enough that hold-to-back
 *  and the reveal timers land where they would on a real device. */
export const FRAME = 1 / 60

export interface HarnessOptions {
  /** Wall-clock ms the session starts at. Defaults to a fixed weekday noon. */
  start?: number
  /** A seed for the dice, or a scripted list of rolls, or a function. */
  random?: number | number[] | RandomFn
  /** A save file to boot from, as if it were already in storage. */
  save?: Partial<SaveFile> & { version: number }
  /** Raw text to put in storage instead, for testing corrupt or old files. */
  raw?: string
  /** Ids handed to new pets. Defaults to a counter, so they are reproducible. */
  ids?: () => string
}

/**
 * A fixed moment for tests to start from: 2024-06-03T12:00:00Z, a Monday.
 * Stated rather than derived so a test that turns on the date reads clearly.
 */
export const DEFAULT_START = Date.UTC(2024, 5, 3, 12, 0, 0)

const SAVE_KEY = 'petz9000.save'

export class Harness {
  readonly app: App
  readonly calls: HookCall[] = []
  readonly storage: SaveStorage & { data: Record<string, string> }
  private readonly clock: ReturnType<typeof manualClock>

  constructor(options: HarnessOptions = {}) {
    const initial: Record<string, string> = {}
    if (options.raw !== undefined) initial[SAVE_KEY] = options.raw
    else if (options.save) initial[SAVE_KEY] = JSON.stringify(options.save)
    this.storage = memoryStorage(initial)
    setStorage(this.storage)

    this.clock = manualClock(options.start ?? DEFAULT_START)
    setClock(this.clock.now)

    setRandom(resolveRandom(options.random))

    let n = 0
    setIdSource(options.ids ?? (() => `pet-${++n}`))

    this.app = new App(this.hooks)
  }

  private hooks: AppHooks = {
    sound: (id) => this.calls.push({ kind: 'sound', id }),
    burst: (burst, count) => this.calls.push({ kind: 'burst', burst, count }),
    pop: (strength) => this.calls.push({ kind: 'pop', strength }),
    form: (speciesId, animate) => this.calls.push({ kind: 'form', speciesId, animate }),
    depart: () => this.calls.push({ kind: 'depart' }),
    arrive: () => this.calls.push({ kind: 'arrive' }),
  }

  /** Wall-clock milliseconds, as the app sees them. */
  get now(): number {
    return this.clock.now()
  }

  /** Moves the clock without running any frames -- the app being closed. */
  closeFor(ms: number): this {
    this.clock.advance(ms)
    return this
  }

  /**
   * Stands in for the renderer, which is the app"s only source of two facts:
   * whether the pet has walked over the hill, and whether it has settled in
   * its shelter. A real renderer takes a moment over both; this one complies
   * at once, which is the behaviour that keeps the tests about the game.
   */
  private reflectRenderer(): void {
    this.app.petAway = this.app.visual.foraging
    this.app.petSheltered = this.app.visual.asleep
  }

  /**
   * Runs frames for `seconds`, advancing the clock in step. This is the normal
   * way to pass time: the clock and the frames stay consistent, so the
   * simulation catches up exactly the way it would in front of a player.
   */
  advance(seconds: number, step = FRAME): this {
    let left = seconds
    while (left > 1e-9) {
      const dt = Math.min(step, left)
      this.clock.advance(dt * 1000)
      this.reflectRenderer()
      this.app.update(dt, this.clock.now())
      left -= dt
    }
    return this
  }

  /** A single frame. */
  frame(dt = FRAME): this {
    return this.advance(dt, dt)
  }

  /**
   * Runs frames without moving the clock. Used to let time-free state settle --
   * a forage beat, a boot splash -- without ageing the pet as a side effect.
   */
  frames(count: number, dt = FRAME): this {
    for (let i = 0; i < count; i++) {
      this.reflectRenderer()
      this.app.update(dt, this.clock.now())
    }
    return this
  }

  /**
   * Runs frames until `until` holds, or fails the test loudly. Used for the
   * parts of the game that take an unspecified number of frames -- a forage
   * beat, a night being wound past -- so a test says what it is waiting for
   * rather than guessing at a duration.
   */
  until(what: string, until: () => boolean, limitSeconds = 60, step = FRAME): this {
    let elapsed = 0
    while (!until() && elapsed < limitSeconds) {
      this.advance(step, step)
      elapsed += step
    }
    if (!until()) throw new Error(`harness: gave up waiting for ${what} after ${limitSeconds}s`)
    return this
  }

  /**
   * Ages the pet to the point it has earned its next form and lets it happen.
   * A stage is hours long by design; a test about what comes after one should
   * not have to sit through it.
   */
  ripen(): this {
    const pet = this.pet
    const duration = STAGE_DURATION[pet.stage as keyof typeof STAGE_DURATION]
    if (duration === undefined) return this
    pet.ageMs = stageStart(pet.stage) + duration
    return this.frame()
  }

  /** Grows the pet on until it reaches the named stage. */
  growTo(stage: Stage): this {
    for (let guard = 0; guard < 8 && this.pet.stage !== stage; guard++) {
      this.ripen()
      // The evolution screen holds until it is dismissed.
      if (this.app.mode === 'evolve') this.tap('b')
    }
    if (this.pet.stage !== stage) throw new Error(`harness: could not reach ${stage}`)
    return this
  }

  /** A press and its release, which is what a tap actually is. */
  tap(button: ButtonId): this {
    this.app.press(button)
    this.app.release(button)
    return this
  }

  /** Holds a button down across real frames, then lets go. */
  hold(button: ButtonId, seconds: number): this {
    this.app.press(button)
    this.advance(seconds)
    this.app.release(button)
    return this
  }

  /** Long enough to back out of a submenu or abandon a game. */
  holdBack(): this {
    return this.hold('c', HOLD_TO_BACK_SECONDS + 4 * FRAME)
  }

  /** Long enough to see an adult off. */
  holdRetire(): this {
    return this.hold('b', RETIRE_HOLD_SECONDS + 4 * FRAME)
  }

  /** Long enough to open the move menu from an adult's status screen. */
  holdMove(): this {
    return this.hold('c', MOVE_HOLD_SECONDS + 4 * FRAME)
  }

  /** Steps past the power-on splash to whatever screen the save implies. */
  boot(): this {
    this.advance(1.5)
    return this
  }

  /** Boots, and names a pet if there is not one already. */
  start(): this {
    this.boot()
    if (this.app.mode === 'name') this.tap('b')
    return this
  }

  /** Puts the cursor on an icon and presses it. */
  select(icon: (typeof ICONS)[number]): this {
    const target = ICONS.indexOf(icon)
    while (this.app.selectedIcon !== icon) {
      const from = ICONS.indexOf(this.app.selectedIcon)
      this.tap(forwardIsShorter(from, target) ? 'c' : 'a')
    }
    this.tap('b')
    return this
  }

  /** Everything the app asked for, in order, of one kind. */
  soundsPlayed(): SoundId[] {
    return this.calls.filter((c) => c.kind === 'sound').map((c) => c.id)
  }

  burstsFired(): Burst[] {
    return this.calls.filter((c) => c.kind === 'burst').map((c) => c.burst)
  }

  /** Forgets what has been asked for so far, so an assertion is about one step. */
  clearCalls(): this {
    this.calls.length = 0
    return this
  }

  /** The save file as it currently sits in storage, parsed. */
  stored(): SaveFile | null {
    const text = this.storage.data[SAVE_KEY]
    return text ? (JSON.parse(text) as SaveFile) : null
  }

  /** The pet, asserted to exist -- almost every test wants one. */
  get pet() {
    const pet = this.app.pet
    if (!pet) throw new Error('harness: expected a pet')
    return pet
  }

  dispose(): void {
    cancelPendingSave()
  }
}

/** Cumulative age at which a pet enters each stage, mirroring `actions`. */
function stageStart(stage: Stage): number {
  switch (stage) {
    case 'egg':
      return 0
    case 'baby':
      return STAGE_DURATION.egg
    case 'child':
      return STAGE_DURATION.egg + STAGE_DURATION.baby
    default:
      return STAGE_DURATION.egg + STAGE_DURATION.baby + STAGE_DURATION.child
  }
}

const ICONS = ['feed', 'play', 'clean', 'forage', 'medicine', 'sleep', 'status'] as const

/** Whether stepping forward round the ring is the shorter way to an icon. */
function forwardIsShorter(from: number, to: number): boolean {
  const forward = (to - from + ICONS.length) % ICONS.length
  return forward <= ICONS.length - forward
}

function resolveRandom(spec: HarnessOptions['random']): RandomFn {
  if (typeof spec === 'function') return spec
  if (Array.isArray(spec)) return scripted(spec)
  return seeded(spec ?? 1)
}

let live: Harness[] = []

/** Builds a harness and tears it down after the test, whatever it did. */
export function harness(options: HarnessOptions = {}): Harness {
  const h = new Harness(options)
  live.push(h)
  return h
}

afterEach(() => {
  for (const h of live) h.dispose()
  live = []
  resetStorage()
  resetClock()
  resetRandom()
  resetIdSource()
})
