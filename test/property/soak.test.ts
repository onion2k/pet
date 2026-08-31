import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Harness, FRAME } from '../harness'
import { HEALTH_FLOOR } from '../../src/game/tuning'
import { LARDER_CAP } from '../../src/game/larder'
import { load, flushSave } from '../../src/game/save'
import type { ButtonId } from '../../src/render/shell'
import type { Stage } from '../../src/game/types'
import type { IconId } from '../../src/data/icons'

/**
 * The suite next door plays out the situations we thought of: a weekend away, a
 * night skipped, a game quit halfway. This one plays out the ones we did not.
 *
 * It presses buttons at random -- taps, holds, hours away, frames of nothing --
 * and after every single one asks the same short list of questions. Not "did
 * the pet eat", which depends on which screen the dice put us on, but the
 * things that must hold no matter what happened: stats inside their bounds, no
 * number gone to NaN, a stage that never walks backwards, a save file that
 * survives being read back. Answers we would never think to check by hand
 * because the situations that break them are not situations anyone would think
 * to write down.
 *
 * When it does find one, fast-check shrinks the run: a failure forty thousand
 * presses deep comes back as the three presses that actually matter, with a
 * seed to reproduce it. That shrunk sequence is the point. It belongs in one of
 * the hand-written files afterwards, as a test with a name.
 */

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env

/** Longer soaks on demand: `SOAK_RUNS=5000 npm test`. */
const RUNS = Number(env?.SOAK_RUNS ?? 100)

/**
 * The dice are pinned here for the same reason they are pinned everywhere else
 * in this suite. Left to itself fast-check seeds from the wall clock, which
 * would make the run that fails on someone's machine one nobody else can
 * reproduce -- and would move the coverage number a little on every run. A
 * different sweep is a different seed, said out loud: `SOAK_SEED=7 npm test`.
 */
const SEED = Number(env?.SOAK_SEED ?? 20240603)

const params = { numRuns: RUNS, seed: SEED } as const

/**
 * Room for the sweep. The default hundred runs are done in a tenth of a second
 * and would never come near vitest's five, but a run costs about a millisecond
 * and `SOAK_RUNS=8000` walks straight through it -- and a timeout reads exactly
 * like a hang in the game, which is the one failure this file must not invent.
 */
const TIMEOUT = 30_000 + RUNS * 10

const STAGE_ORDER: Stage[] = ['egg', 'baby', 'child', 'adult']

/**
 * What the fuzzer remembers between commands, so it can spot a step backwards.
 *
 * Keyed on the pet's id, because "backwards" only means anything within one
 * life: retiring an adult and starting again puts an egg on the screen, which
 * is the game working rather than the game breaking.
 */
interface Model {
  /** Whose growth the two figures below are about. */
  id: string
  /** The furthest stage seen so far. A pet grows up; it does not grow down. */
  stage: number
  /** The greatest age seen so far, in simulated ms. */
  ageMs: number
}

/**
 * Assertion for the hot path. `expect` builds a matcher object per call, which
 * at a few hundred thousand calls is most of the run; this is a comparison and
 * a string that is only ever built when something has already gone wrong.
 */
function require(ok: boolean, message: () => string): void {
  if (!ok) throw new Error(message())
}

/** Every number in reach is a real number. NaN spreads silently; it is worth
 *  the walk to catch it at the step that made it rather than an hour later. */
function noBadNumbers(value: unknown, path: string): void {
  if (typeof value === 'number') {
    require(Number.isFinite(value), () => `${path} is ${value}`)
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    noBadNumbers(child, `${path}.${key}`)
  }
}

/**
 * The questions asked after every command. `played` marks a pet the game has
 * actually been running: a save that has just been loaded is only answerable
 * for what `load` promises to repair, not for counts the game keeps as it goes.
 */
function assertSane(h: Harness, m: Model, played = true): void {
  const app = h.app
  const pet = app.pet
  if (!pet) return

  noBadNumbers(pet, 'pet')

  // A new life resets what counts as backwards.
  if (pet.id !== m.id) {
    m.id = pet.id
    m.stage = 0
    m.ageMs = 0
  }

  for (const key of ['hunger', 'happiness', 'energy', 'hygiene'] as const) {
    const v = pet.stats[key]
    require(v >= 0 && v <= 100, () => `${key} out of bounds: ${v}`)
  }
  // Health has a floor rather than a zero: this game has no death in it, and a
  // pet that fell through the floor would be one the player could not rescue.
  require(
    pet.stats.health >= HEALTH_FLOOR && pet.stats.health <= 100,
    () => `health out of bounds: ${pet.stats.health}`,
  )

  const stage = STAGE_ORDER.indexOf(pet.stage)
  require(stage >= 0, () => `unknown stage ${pet.stage}`)
  require(stage >= m.stage, () => `stage went backwards: ${STAGE_ORDER[m.stage]} -> ${pet.stage}`)
  m.stage = stage

  require(pet.ageMs >= m.ageMs, () => `age went backwards: ${m.ageMs} -> ${pet.ageMs}`)
  m.ageMs = pet.ageMs

  require(pet.ageMs >= 0, () => `negative age: ${pet.ageMs}`)
  require(pet.name.length > 0, () => 'pet lost its name')
  require(pet.discovered.length > 0, () => 'discovered list emptied')
  require(
    new Set(pet.discovered).size === pet.discovered.length,
    () => `duplicate discoveries: ${pet.discovered.join(',')}`,
  )

  // A menu index that has drifted past its list is how a screen ends up with
  // its highlight on a row that is not there. Only the screen showing the list
  // has to hold this: an index left over behind a running game is invisible,
  // and is clamped again on the way back in.
  if (app.mode === 'feed') {
    require(
      app.foodIndex >= 0 && (app.feedMenu.length === 0 || app.foodIndex < app.feedMenu.length),
      () => `food cursor ${app.foodIndex} of ${app.feedMenu.length}`,
    )
  }
  if (app.mode === 'games') {
    require(
      app.gameIndex >= 0 && app.gameIndex < app.playMenu.length,
      () => `game cursor ${app.gameIndex} of ${app.playMenu.length}`,
    )
  }

  if (!played) return

  // Counts the game keeps for itself. A save that arrived with worse in it is a
  // question for `load`, not for the frame that has just been drawn.
  for (const [id, count] of Object.entries(app.larder)) {
    require(
      Number.isInteger(count) && count >= 0 && count <= LARDER_CAP,
      () => `larder ${id} holds ${count}`,
    )
  }
  for (const [id, count] of Object.entries(app.curioCounts)) {
    require(Number.isInteger(count) && count >= 0, () => `curio ${id} counts ${count}`)
  }
}

abstract class Step implements fc.Command<Model, Harness> {
  check(): boolean {
    return true
  }
  run(m: Model, h: Harness): void {
    this.act(h)
    assertSane(h, m)
  }
  abstract act(h: Harness): void
  abstract toString(): string
}

/** A press and its release: the ordinary way anything happens. */
class Tap extends Step {
  constructor(readonly button: ButtonId) {
    super()
  }
  act(h: Harness): void {
    h.tap(this.button)
    h.frame()
  }
  toString(): string {
    return `tap(${this.button})`
  }
}

/**
 * A button held down. The three durations are the ones the game distinguishes:
 * shorter than a back-hold, long enough to back out, and long enough to retire
 * a pet or move house. Generating arbitrary durations would spend the run
 * rediscovering those thresholds.
 */
class Hold extends Step {
  constructor(
    readonly button: ButtonId,
    readonly seconds: number,
  ) {
    super()
  }
  act(h: Harness): void {
    h.hold(this.button, this.seconds)
    h.frame()
  }
  toString(): string {
    return `hold(${this.button}, ${this.seconds}s)`
  }
}

/** Time passing with the player watching. Kept short: these are real frames. */
class Advance extends Step {
  constructor(readonly seconds: number) {
    super()
  }
  act(h: Harness): void {
    h.advance(this.seconds)
  }
  toString(): string {
    return `advance(${this.seconds}s)`
  }
}

/**
 * The app closed. This is the cheap way to age a pet -- the catch-up runs in
 * five-minute chunks rather than frames -- and it is also where the awkward
 * states live: the welcome screen, a sleep wound past its sunrise, a stage
 * boundary crossed while nobody was looking.
 */
class CloseFor extends Step {
  constructor(readonly minutes: number) {
    super()
  }
  act(h: Harness): void {
    h.closeFor(this.minutes * 60_000)
    h.frame()
  }
  toString(): string {
    return `closeFor(${this.minutes}min)`
  }
}

/**
 * Walking the cursor round to an icon and pressing it. Everything this does a
 * run of raw taps could do too, eventually -- but only eventually, and the
 * screens worth reaching are the ones behind an icon. Left to chance the
 * fuzzer spends its budget on the main screen; given this it spends it on
 * foraging, the yard and the status screen instead.
 */
class Select extends Step {
  constructor(readonly icon: IconId) {
    super()
  }
  act(h: Harness): void {
    // Only the main screen has a cursor ring; anywhere else a, b and c mean
    // other things, and walking the ring would never terminate.
    if (h.app.mode !== 'main') return
    h.select(this.icon)
    h.frame()
  }
  toString(): string {
    return `select(${this.icon})`
  }
}

const BUTTONS: ButtonId[] = ['a', 'b', 'c']
const ICONS: IconId[] = ['feed', 'play', 'clean', 'forage', 'medicine', 'sleep', 'status']

const commands = fc.commands(
  [
    fc.constantFrom(...BUTTONS).map((b) => new Tap(b)),
    fc
      .tuple(fc.constantFrom(...BUTTONS), fc.constantFrom(0.4, 1.0, 1.8))
      .map(([b, s]) => new Hold(b, s)),
    fc.constantFrom(FRAME, 0.25, 1, 5).map((s) => new Advance(s)),
    fc.constantFrom(1, 6, 30, 120, 600).map((min) => new CloseFor(min)),
    fc.constantFrom(...ICONS).map((i) => new Select(i)),
  ],
  // fast-check's default sizing generates a handful of commands per run, which
  // is the right bias for a data structure and the wrong one for a game: the
  // states worth reaching are twenty presses in. `xlarge` asks for sequences
  // that actually get there, and shrinking still reports the short prefix that
  // broke.
  { maxCommands: 60, size: 'xlarge' },
)

/**
 * Whatever screen the fuzzer left us on, a player with a thumb can get home.
 * Backing out and dismissing are the only two moves available on a real device,
 * so those are the only two this is allowed to use. `name` counts as home: it
 * is where a family that has just retired its last pet legitimately ends up.
 */
function findsTheWayHome(h: Harness): boolean {
  for (let i = 0; i < 16; i++) {
    if (atHome(h)) return true
    h.holdBack()
    if (atHome(h)) return true
    h.tap('b')
    h.advance(0.25)
  }
  return atHome(h)
}

/** Read through a widened local: the mode changes under us on every press,
 *  which is the one thing the compiler's narrowing cannot see. */
function atHome(h: Harness): boolean {
  const mode: string = h.app.mode
  return mode === 'main' || mode === 'name'
}

describe('a pet left with someone who presses everything', () => {
  it('survives any sequence of presses, holds and absences', () => {
    fc.assert(
      fc.property(fc.integer(), commands, (seed, cmds) => {
        const h = new Harness({ random: seed })
        try {
          fc.modelRun(() => ({ model: { id: '', stage: 0, ageMs: 0 }, real: h.start() }), cmds)

          require(findsTheWayHome(h), () => `stranded on the ${h.app.mode} screen`)

          // The save the session leaves behind must be one the next session can
          // read: loading it and writing it straight back has to come out the
          // same. Anything else is a migration or a repair quietly rewriting
          // state every time the game boots.
          flushSave()
          const first = JSON.stringify(load())
          const second = JSON.stringify(load())
          require(first === second, () => `save does not settle:\n${first}\n${second}`)
        } finally {
          h.dispose()
        }
      }),
      params,
    )
  }, TIMEOUT)
})

describe('a save file that has been got at', () => {
  /** Valid-ish saves: the shape is right, the values are anything at all. */
  const corrupted = fc.record(
    {
      version: fc.oneof(fc.integer({ min: -5, max: 12 }), fc.constant(undefined)),
      pet: fc.oneof(fc.constant(null), fc.constant(undefined), fc.object({ maxDepth: 2 })),
      muted: fc.oneof(fc.boolean(), fc.constant(undefined), fc.string()),
      worldOffset: fc.oneof(fc.double(), fc.constant(undefined), fc.string()),
      discovered: fc.oneof(fc.array(fc.string()), fc.constant(undefined), fc.string()),
      album: fc.oneof(fc.array(fc.object({ maxDepth: 1 })), fc.constant(undefined)),
      curios: fc.oneof(fc.dictionary(fc.string(), fc.integer()), fc.constant(undefined)),
      streak: fc.oneof(fc.object({ maxDepth: 1 }), fc.constant(undefined)),
      counters: fc.oneof(fc.object({ maxDepth: 1 }), fc.constant(undefined)),
      shell: fc.oneof(fc.string(), fc.constant(undefined)),
      home: fc.oneof(fc.string(), fc.constant(undefined)),
      yard: fc.oneof(fc.object({ maxDepth: 2 }), fc.constant(undefined)),
      larder: fc.oneof(fc.dictionary(fc.string(), fc.integer()), fc.constant(undefined)),
    },
    { requiredKeys: [] },
  )

  it('boots into something playable, whatever is in it', () => {
    fc.assert(
      fc.property(corrupted, fc.integer(), (file, seed) => {
        const h = new Harness({ raw: JSON.stringify(file), random: seed })
        try {
          h.start()
          h.advance(2)
          assertSane(h, { id: '', stage: 0, ageMs: 0 }, false)
          require(
            h.app.mode !== 'boot',
            () => `stuck on the boot screen with ${JSON.stringify(file)}`,
          )
        } finally {
          h.dispose()
        }
      }),
      { ...params, numRuns: RUNS * 2 },
    )
  }, TIMEOUT)

  it('never throws on text that is not a save file at all', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const h = new Harness({ raw })
        try {
          expect(() => h.start().advance(1)).not.toThrow()
        } finally {
          h.dispose()
        }
      }),
      params,
    )
  }, TIMEOUT)
})
