/**
 * The wall clock, behind a seam.
 *
 * Almost everything the pet is depends on what time it is: how much it has
 * decayed, whether it is old enough to evolve, whether today counts toward the
 * streak. Tests need to move that clock rather than sleep against it, so the
 * game reads the time from here instead of from `Date` directly.
 */

export type ClockFn = () => number

const wallClock: ClockFn = () => Date.now()

let impl: ClockFn = wallClock

/** Wall-clock milliseconds. */
export const now: ClockFn = () => impl()

/** Swaps the clock. Tests use this; nothing in the game does. */
export function setClock(fn: ClockFn): void {
  impl = fn
}

/** Back to the real thing. */
export function resetClock(): void {
  impl = wallClock
}

/** A clock a test can wind by hand. */
export function manualClock(start = 0): { now: ClockFn; advance(ms: number): void; set(ms: number): void } {
  let t = start
  return {
    now: () => t,
    advance(ms: number) {
      t += ms
    },
    set(ms: number) {
      t = ms
    },
  }
}
