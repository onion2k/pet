import type { Metrics } from '../game/metrics'
import type { PetState, Stage } from '../game/types'
import { BLOB, EGG, PUDGE, SPIKE, SPROUT } from './models'
import { AURORA, BLAZE, GLOOP, GRUMP, LUMEN, MOCHI, VERDANT } from './models-adult'
import { SOMNIX, WARDEN, ZEPHYRIX } from './models-elder'
import type { TemperamentId } from '../game/temperament'
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
  /**
   * A gate, for branches that are not merely unlikely but unavailable. Scoring
   * alone cannot express this: the highest score always wins, so a branch
   * scoring zero is still taken when it is the only one there.
   */
  available?(pet: PetState): boolean
  /** Higher wins. Scores are unbounded but rules keep them roughly 0..2. */
  score(m: Metrics, pet: PetState, ctx: BranchContext): number
}

export interface Species {
  id: string
  name: string
  stage: Stage
  /** 8x8 artwork for the album, in the same format as the menu icons. */
  glyph: string
  model: VoxelModel
  blurb: string
  branches: Branch[]
}

const list: Species[] = [
  {
    id: 'egg',
    name: 'Egg',
    stage: 'egg',
    glyph: '...##.../..####../.######./.######./########/########/.######./..####..',
    model: EGG,
    blurb: 'Something is moving in there.',
    branches: [{ to: 'blob', because: 'it hatched', score: () => 1 }],
  },
  {
    id: 'blob',
    name: 'Blobbit',
    stage: 'baby',
    glyph: '......../..####../.######./##.##.##/########/########/.######./.#....#.',
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
    glyph: '......../.######./##.##.##/########/########/########/########/.##..##.',
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
    glyph: '#..##..#/.#.##.#./.######./##.##.##/########/########/.######./.#....#.',
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
    glyph: '...##.../..##..../.######./##.##.##/########/########/.######./.#....#.',
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
  { id: 'mochi', name: 'Mochimo', stage: 'adult', glyph: '.#....#./.######./########/##.##.##/########/########/.######./..#..#..', model: MOCHI, blurb: 'Adored, and knows it.', branches: [] },
  {
    id: 'aurora',
    name: 'Aurorix',
    stage: 'adult',
    glyph: '..#..#../...##.../.######./########/##.##.##/########/.######./..####..',
    model: AURORA,
    blurb: 'Hums faintly, like distant lights.',
    branches: [],
  },
  { id: 'gloop', name: 'Gloopus', stage: 'adult', glyph: '..####../.######./########/##.##.##/########/########/########/#.#..#.#', model: GLOOP, blurb: 'Faintly sticky. Faintly resentful.', branches: [] },
  { id: 'blaze', name: 'Blazeon', stage: 'adult', glyph: '...#..../..###.../.#####../.######./##.##.##/########/.######./.#....#.', model: BLAZE, blurb: 'Undefeated. Ask it about that.', branches: [] },
  { id: 'grump', name: 'Grumphal', stage: 'adult', glyph: '......../########/########/##.##.##/########/########/########/##....##', model: GRUMP, blurb: 'Has seen things. Mostly ceilings.', branches: [] },
  { id: 'verdant', name: 'Verdantis', stage: 'adult', glyph: '..#..#../.##..##./..####../.######./##.##.##/########/.######./.##..##.', model: VERDANT, blurb: 'In full bloom, and well rested.', branches: [] },
  { id: 'lumen', name: 'Lumenox', stage: 'adult', glyph: '#.#..#.#/.#.##.#./..####../.######./########/.######./..####../.#....#.', model: LUMEN, blurb: 'Glows softly at 3am. Always has.', branches: [] },
  {
    id: 'warden',
    name: 'Wardenor',
    stage: 'adult',
    glyph: '..#..#../.######./########/##.##.##/########/########/.######./.##..##.',
    model: WARDEN,
    blurb: 'Has kept watch a long while.',
    branches: [],
  },
  {
    id: 'zephyrix',
    name: 'Zephyrix',
    stage: 'adult',
    glyph: '#..##..#/.#.##.#./..####../.######./##.##.##/.######./..####../.#....#.',
    model: ZEPHYRIX,
    blurb: 'Still has not sat down.',
    branches: [],
  },
  {
    id: 'somnix',
    name: 'Somnix',
    stage: 'adult',
    glyph: '....##../...###../..####../.######./##.##.##/########/.######./..####..',
    model: SOMNIX,
    blurb: 'Dreaming of something good.',
    branches: [],
  }
]

const ELDER_IDS = new Set(['warden', 'zephyrix', 'somnix'])

/**
 * What a long adulthood can still lead to. One elder per temperament, so how a
 * pet was raised decides not only what it grew into but what it can become
 * after that -- and an easygoing pet, having settled on nothing in particular,
 * stays as it is.
 */
const ELDERS: { to: string; because: string; needs: TemperamentId }[] = [
  { to: 'warden', because: 'a long life spent close by', needs: 'devoted' },
  { to: 'zephyrix', because: 'years of never sitting still', needs: 'lively' },
  { to: 'somnix', because: 'a lifetime of good hours kept', needs: 'restful' },
]

/** The same three branches hang off every adult, gated on its temperament. */
const elderBranches = (): Branch[] =>
  ELDERS.map(({ to, because, needs }) => ({
    to,
    because,
    available: (pet) => pet.temperament === needs,
    // Only one is ever available, so the score is simply a positive constant.
    score: () => 1,
  }))

for (const species of list) {
  if (species.stage === 'adult' && species.branches.length === 0 && !ELDER_IDS.has(species.id)) {
    species.branches = elderBranches()
  }
}

export const SPECIES: ReadonlyMap<string, Species> = new Map(list.map((s) => [s.id, s]))

/** Every form in album order: egg, baby, the children, then the adults. */
export const SPECIES_LIST: readonly Species[] = list

export function speciesOf(id: string): Species {
  const found = SPECIES.get(id)
  if (!found) throw new Error(`Unknown species: ${id}`)
  return found
}

/** The total number of forms, for the collection counter. */
export const SPECIES_COUNT = list.length

/** Picks the branch this pet has earned. Returns null for terminal adult forms. */
export function chooseBranch(pet: PetState, m: Metrics, ctx: BranchContext): Branch | null {
  const open = speciesOf(pet.speciesId).branches.filter((b) => b.available?.(pet) ?? true)
  if (open.length === 0) return null
  return open.reduce((best, b) => (b.score(m, pet, ctx) > best.score(m, pet, ctx) ? b : best))
}
