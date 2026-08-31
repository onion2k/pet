import type { SaveFile } from '../game/types'
import { CURIO_COUNT } from './curios'

/**
 * How the plastic is decorated. The numbers are what the shell's shader
 * switches on; the names are what reads sensibly in the table below.
 */
export const PATTERNS = { plain: 0, swirl: 1, dot: 2, stripe: 3 } as const

export type ShellPattern = keyof typeof PATTERNS

export interface ShellColour {
  id: string
  name: string
  /** Linear-space plastic colour, fed straight to the shell's uniform. */
  colour: [number, number, number]
  /** Moulded in rather than printed on. Left out, the shell is one solid colour. */
  pattern?: ShellPattern
  /**
   * The second colour the pattern is swirled, dotted or striped in. Kept close
   * to `colour` on purpose: it should read as something in the plastic, not as
   * livery painted over it.
   */
  accent?: [number, number, number]
  /** What earns it. The default is always available. */
  unlocked(save: SaveFile): boolean
  hint: string
}

/** A shell as the renderer wants it, with the plain ones' blanks filled in. */
export function shellStyle(shell: ShellColour): {
  colour: [number, number, number]
  accent: [number, number, number]
  pattern: number
} {
  return {
    colour: shell.colour,
    // A plain shell is its own accent, so the mix has nothing to do.
    accent: shell.accent ?? shell.colour,
    pattern: PATTERNS[shell.pattern ?? 'plain'],
  }
}

/**
 * Shell colours, unlocked by lineage milestones. Personalisation as a reward:
 * the device itself becomes a record of what the family has done.
 */
export const SHELLS: ShellColour[] = [
  {
    id: 'plum',
    name: 'Plum',
    colour: [0.42, 0.28, 0.72],
    unlocked: () => true,
    hint: '',
  },
  {
    id: 'teal',
    name: 'Teal',
    colour: [0.14, 0.52, 0.5],
    unlocked: (save) => save.streak.days >= 3,
    hint: 'a 3-day streak',
  },
  {
    id: 'rose',
    name: 'Rose',
    colour: [0.78, 0.36, 0.48],
    unlocked: (save) => save.album.length >= 1,
    hint: 'retire a pet',
  },
  {
    id: 'gold',
    name: 'Gold',
    colour: [0.72, 0.55, 0.18],
    unlocked: (save) => Object.keys(save.curios).length >= 5,
    hint: 'collect 5 curios',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colour: [0.14, 0.15, 0.26],
    unlocked: (save) => save.discovered.length >= 8,
    hint: 'discover 8 forms',
  },
  {
    id: 'humbug',
    name: 'Humbug',
    colour: [0.11, 0.12, 0.15],
    pattern: 'stripe',
    accent: [0.18, 0.19, 0.23],
    unlocked: (save) => save.streak.days >= 14,
    hint: 'a 14-day streak',
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    colour: [0.78, 0.40, 0.54],
    pattern: 'dot',
    accent: [0.84, 0.48, 0.60],
    unlocked: (save) => save.counters.retirements >= 3,
    hint: 'raise three generations',
  },
  {
    id: 'marble',
    name: 'Marble',
    colour: [0.20, 0.28, 0.54],
    pattern: 'swirl',
    accent: [0.34, 0.44, 0.70],
    unlocked: (save) => Object.keys(save.curios).length >= CURIO_COUNT,
    hint: 'collect every curio',
  },
]

export function shellById(id: string): ShellColour {
  return SHELLS.find((s) => s.id === id) ?? SHELLS[0]!
}
