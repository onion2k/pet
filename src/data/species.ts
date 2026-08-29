import type { Metrics } from '../game/metrics'
import type { PetState, Stage } from '../game/types'
import { BLOB, EGG, PUDGE, SPIKE, SPROUT } from './models'
import { AURORA, BLAZE, GLOOP, GRUMP, LUMEN, MOCHI, VERDANT } from './models-adult'
import type { SeasonId } from './seasons'
import type { VoxelModel } from './voxel-format'

/** The world the evolution happens in, for season-gated branches. */
export interface BranchContext {
  season: SeasonId
}

export interface Branch {
  to: string
  /** Short reason shown on the evolution screen, e.g. "a diet of greens". */
  because: string
  /** Higher wins. Scores are unbounded but rules keep them roughly 0..2. */
  score(m: Metrics, pet: PetState, ctx: BranchContext): number
}

export interface Species {
  id: string
  name: string
  stage: Stage
  model: VoxelModel
  blurb: string
  branches: Branch[]
}

const list: Species[] = [
  {
    id: 'egg',
    name: 'Egg',
    stage: 'egg',
    model: EGG,
    blurb: 'Something is moving in there.',
    branches: [{ to: 'blob', because: 'it hatched', score: () => 1 }],
  },
  {
    id: 'blob',
    name: 'Blobbit',
    stage: 'baby',
    model: BLOB,
    blurb: 'Newly hatched and extremely round.',
    branches: [
      {
        to: 'pudge',
        because: 'a sweet tooth and a quiet life',
        score: (m) => m.diet.sweet + m.diet.junk * 0.5 + (1 - m.play) * 0.35 + m.care * 0.15,
      },
      {
        to: 'spike',
        because: 'hearty meals and constant play',
        score: (m) => m.diet.protein + m.diet.junk * 0.6 + m.play * 0.6,
      },
      {
        to: 'sprout',
        because: 'greens and early nights',
        score: (m) => m.diet.veg * 1.2 + m.sleep * 0.5 + m.care * 0.2,
      },
    ],
  },
  {
    id: 'pudge',
    name: 'Pudgeling',
    stage: 'child',
    model: PUDGE,
    blurb: 'Soft, pink, and permanently peckish.',
    branches: [
      {
        to: 'aurora',
        because: 'devotion through the long winter',
        score: (m, _pet, ctx) => (ctx.season === 'winter' ? 0.95 + m.care * 0.8 : -1),
      },
      {
        to: 'mochi',
        because: 'attentive care',
        score: (m) => m.care + m.diet.sweet * 0.5 + m.sleep * 0.3,
      },
      {
        to: 'gloop',
        because: 'junk food and long silences',
        score: (m) => (1 - m.care) + m.diet.junk * 0.8,
      },
    ],
  },
  {
    id: 'spike',
    name: 'Spikelet',
    stage: 'child',
    model: SPIKE,
    blurb: 'Bristling with unearned confidence.',
    branches: [
      {
        to: 'aurora',
        because: 'devotion through the long winter',
        score: (m, _pet, ctx) => (ctx.season === 'winter' ? 0.95 + m.care * 0.8 : -1),
      },
      {
        to: 'blaze',
        because: 'a winning streak',
        score: (m) => m.play + m.care * 0.5 + m.diet.protein * 0.4,
      },
      {
        to: 'grump',
        because: 'boredom and neglect',
        score: (m) => (1 - m.care) + (1 - m.play) * 0.5,
      },
    ],
  },
  {
    id: 'sprout',
    name: 'Sproutling',
    stage: 'child',
    model: SPROUT,
    blurb: 'Photosynthesises when it thinks nobody is looking.',
    branches: [
      {
        to: 'aurora',
        because: 'devotion through the long winter',
        score: (m, _pet, ctx) => (ctx.season === 'winter' ? 0.95 + m.care * 0.8 : -1),
      },
      {
        to: 'verdant',
        because: 'greens and a steady bedtime',
        score: (m) => m.diet.veg * 0.9 + m.sleep * 0.7 + m.care * 0.3,
      },
      {
        to: 'lumen',
        because: 'devoted care and very late nights',
        score: (m) => m.care + (1 - m.sleep) * 0.5 + m.play * 0.3,
      },
    ],
  },
  { id: 'mochi', name: 'Mochimo', stage: 'adult', model: MOCHI, blurb: 'Adored, and knows it.', branches: [] },
  {
    id: 'aurora',
    name: 'Aurorix',
    stage: 'adult',
    model: AURORA,
    blurb: 'Hums faintly, like distant lights.',
    branches: [],
  },
  { id: 'gloop', name: 'Gloopus', stage: 'adult', model: GLOOP, blurb: 'Faintly sticky. Faintly resentful.', branches: [] },
  { id: 'blaze', name: 'Blazeon', stage: 'adult', model: BLAZE, blurb: 'Undefeated. Ask it about that.', branches: [] },
  { id: 'grump', name: 'Grumphal', stage: 'adult', model: GRUMP, blurb: 'Has seen things. Mostly ceilings.', branches: [] },
  { id: 'verdant', name: 'Verdantis', stage: 'adult', model: VERDANT, blurb: 'In full bloom, and well rested.', branches: [] },
  { id: 'lumen', name: 'Lumenox', stage: 'adult', model: LUMEN, blurb: 'Glows softly at 3am. Always has.', branches: [] },
]

export const SPECIES: ReadonlyMap<string, Species> = new Map(list.map((s) => [s.id, s]))

export function speciesOf(id: string): Species {
  const found = SPECIES.get(id)
  if (!found) throw new Error(`Unknown species: ${id}`)
  return found
}

/** The total number of forms, for the collection counter. */
export const SPECIES_COUNT = list.length

/** Picks the branch this pet has earned. Returns null for terminal adult forms. */
export function chooseBranch(pet: PetState, m: Metrics, ctx: BranchContext): Branch | null {
  const { branches } = speciesOf(pet.speciesId)
  if (branches.length === 0) return null
  return branches.reduce((best, b) => (b.score(m, pet, ctx) > best.score(m, pet, ctx) ? b : best))
}
