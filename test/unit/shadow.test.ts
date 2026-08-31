import { describe, expect, it } from 'vitest'
import { footprintOf, liftFade } from '../../src/render/contact-shadow'
import { SPECIES_LIST } from '../../src/data/species'
import { PLANTS } from '../../src/data/plants'
import { VISITORS } from '../../src/data/visitors'
import { KIT_STANDING } from '../../src/data/kit-models'
import { modelSource } from '../../src/render/voxel-mesh'
import type { KitId } from '../../src/data/kit'
import type { VoxelModel } from '../../src/data/voxel-format'

/**
 * The dark patch under a thing standing on the ground.
 *
 * Nothing is cast and the sun is ignored entirely, so there is no geometry to
 * check -- only that every patch is the size of the thing above it and fades
 * out as that thing leaves the ground. The rest needs eyes.
 */

/** Everything in the yard that now gets one. */
const casters: { id: string; model: VoxelModel; height: number }[] = [
  ...SPECIES_LIST.map((s) => ({ id: s.id, model: s.model, height: 1.85 })),
  ...PLANTS.flatMap((p) => p.stages.map((s, i) => ({ id: `${p.id}:${i}`, model: s.model, height: s.height }))),
  ...VISITORS.map((v) => ({ id: v.id, model: v.model, height: v.height })),
  ...Object.entries(KIT_STANDING).map(([id, s]) => ({
    id: id as KitId,
    model: s!.model,
    height: s!.height,
  })),
]

describe('how wide a patch is', () => {
  it('covers whatever is standing on it, for everything in the yard', () => {
    for (const { id, model, height } of casters) {
      const source = modelSource(model)
      const scale = height / source.h
      const width = footprintOf(model, height)
      // Wide enough for the wider of the two footprint axes: a patch narrower
      // than its caster reads as the thing hovering over the edge of it.
      expect(width, id).toBeGreaterThanOrEqual(source.w * scale - 1e-9)
      expect(width, id).toBeGreaterThanOrEqual(source.d * scale - 1e-9)
    }
  })

  it('never draws a patch for nothing, or one the size of the yard', () => {
    for (const { id, model, height } of casters) {
      const width = footprintOf(model, height)
      expect(width, id).toBeGreaterThan(0)
      // Nothing in the yard is wider than the band the pet potters about in.
      expect(width, id).toBeLessThan(4)
    }
  })

  it('scales with the thing rather than being one size for everyone', () => {
    // A sapling and a grown tree do not share a shadow.
    const stages = PLANTS[0]!.stages
    const widths = stages.map((stage) => footprintOf(stage.model, stage.height))
    expect(new Set(widths).size).toBeGreaterThan(1)
  })
})

describe('how dark a patch is off the ground', () => {
  it('is full strength on the grass', () => {
    expect(liftFade(0)).toBe(1)
  })

  it('thins as the thing above it rises', () => {
    expect(liftFade(0.3)).toBeLessThan(1)
    expect(liftFade(0.6)).toBeLessThan(liftFade(0.3))
  })

  it('is gone rather than negative for anything properly airborne', () => {
    // A gull wheels well above the yard; there is nothing to draw under it,
    // and a negative strength would turn the patch into a bright spot.
    for (const height of [1.5, 3, 12, 400]) {
      expect(liftFade(height), `${height}`).toBe(0)
    }
  })

  it('still shows something under a rabbit mid-hop', () => {
    // The hop arc peaks at 0.22, which has to keep most of its shadow or the
    // thing reads as taking off rather than hopping.
    expect(liftFade(0.22)).toBeGreaterThan(0.5)
  })
})
