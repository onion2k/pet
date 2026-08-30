/**
 * The game's source of chance, behind a seam.
 *
 * Everything that rolls a die -- what the forage found, which line the pet
 * says, where the marker starts in a minigame -- goes through here rather than
 * calling `Math.random` directly. In play it is `Math.random`; under test it is
 * a seeded generator or a scripted list, so a trip that comes home muddy and
 * empty handed can be reproduced exactly rather than waited for.
 */

export type RandomFn = () => number

let impl: RandomFn = Math.random

/** A roll in [0, 1). */
export const random: RandomFn = () => impl()

/** Swaps the generator. Tests use this; nothing in the game does. */
export function setRandom(fn: RandomFn): void {
  impl = fn
}

/** Back to the real thing. */
export function resetRandom(): void {
  impl = Math.random
}

/**
 * mulberry32: small, fast, and good enough for a toy. The point is that the
 * same seed gives the same sequence on every machine and every run.
 */
export function seeded(seed: number): RandomFn {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Plays back a fixed list of rolls, repeating the last one once it runs out --
 * so a test states only the rolls it cares about and is not broken by a call
 * added after the ones it is pinning down.
 */
export function scripted(rolls: number[]): RandomFn {
  let i = 0
  return () => rolls[Math.min(i++, rolls.length - 1)] ?? 0
}

/** One of a list, chosen by the current generator. Empty gives undefined. */
export function pickFrom<T>(pool: readonly T[]): T | undefined {
  if (pool.length === 0) return undefined
  return pool[Math.floor(random() * pool.length) % pool.length]
}
