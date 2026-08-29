import type { SaveFile } from '../game/types'

/**
 * Shell colours, unlocked by lineage milestones. Personalisation as a reward:
 * the device itself becomes a record of what the family has done.
 */
export interface ShellColour {
  id: string
  name: string
  /** Linear-space plastic colour, fed straight to the shell's uniform. */
  colour: [number, number, number]
  /** What earns it. The default is always available. */
  unlocked(save: SaveFile): boolean
  hint: string
}

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
]

export function shellById(id: string): ShellColour {
  return SHELLS.find((s) => s.id === id) ?? SHELLS[0]!
}
