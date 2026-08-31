import { describe, expect, it } from 'vitest'
import { LANTERN, PROPS, PROP_KEYS, SHELTER, type Prop } from '../../src/data/props'
import { expandLayers } from '../../src/data/voxel-format'
import { PROP_MATERIAL } from '../../src/data/seasons'
import { PROP_SPACING, SHELTER_COLUMNS, TERRAIN_VOXEL } from '../../src/data/biome'
import { PET_HEIGHT } from '../../src/render/pet'

/**
 * The scenery. It is only ever read by the terrain mesher, which this suite
 * does not run -- but a prop with a palette character the resolver has no
 * colour for is a black hole in the meadow, and that is worth catching here
 * rather than by looking at it.
 */

const everyProp: Prop[] = [...PROPS, LANTERN, SHELTER]

describe('the prop list', () => {
  it('is not empty, or the meadow would be bare', () => {
    expect(PROPS.length).toBeGreaterThan(0)
  })

  it('gives every prop a unique id', () => {
    const ids = everyProp.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every scattered prop a positive weight, so none is unreachable', () => {
    for (const prop of PROPS) expect(prop.weight, prop.id).toBeGreaterThan(0)
  })

  it('gives every prop a model with something in it', () => {
    for (const prop of everyProp) {
      expect(prop.model.layers.length, prop.id).toBeGreaterThan(0)
      const filled = expandLayers(prop.model)
        .flat()
        .join('')
        .split('')
        .filter((ch) => ch !== '.')
      expect(filled.length, prop.id).toBeGreaterThan(0)
    }
  })

  it('gives every layer of every prop rows of one width', () => {
    for (const prop of everyProp) {
      for (const layer of expandLayers(prop.model)) {
        const widths = new Set(layer.map((row) => row.length))
        expect(widths.size, `${prop.id} has ragged rows`).toBe(1)
      }
    }
  })

  it('gives every layer of a prop the same footprint, so the stamp is a box', () => {
    for (const prop of everyProp) {
      const layers = expandLayers(prop.model)
      const shapes = new Set(layers.map((layer) => `${layer.length}x${layer[0]!.length}`))
      expect(shapes.size, `${prop.id} changes footprint between layers`).toBe(1)
    }
  })

  it('only uses palette characters the resolver has a material for', () => {
    for (const prop of everyProp) {
      for (const layer of expandLayers(prop.model)) {
        for (const row of layer) {
          for (const ch of row) {
            if (ch === '.') continue
            expect(PROP_KEYS, `${prop.id} uses '${ch}'`).toContain(ch)
            expect(PROP_MATERIAL[ch], `${prop.id} uses '${ch}'`).toBeDefined()
          }
        }
      }
    }
  })

  it('declares a palette entry for every character it draws with', () => {
    for (const prop of everyProp) {
      for (const layer of expandLayers(prop.model)) {
        for (const row of layer) {
          for (const ch of row) {
            if (ch === '.') continue
            expect(prop.model.palette[ch], `${prop.id} missing '${ch}'`).toBeDefined()
          }
        }
      }
    }
  })

  it('asks for spacing it can actually be given', () => {
    for (const prop of everyProp) {
      expect(prop.spacing, prop.id).toBeGreaterThanOrEqual(0)
    }
    // A scattered prop wanting more room than the scatter grid leaves would
    // never be placed at all, which reads as a prop that simply does not exist.
    for (const prop of PROPS) {
      expect(prop.spacing, prop.id).toBeLessThanOrEqual(PROP_SPACING * 4)
    }
  })

  it('maps every declared key onto a material', () => {
    for (const key of PROP_KEYS) expect(PROP_MATERIAL[key], key).toBeDefined()
  })
})

describe('the fixed pieces', () => {
  it('has a lantern and a shelter, which the yard is laid out around', () => {
    expect(LANTERN.id.length).toBeGreaterThan(0)
    expect(SHELTER.id.length).toBeGreaterThan(0)
  })

  it('gives the lantern something that glows', () => {
    const drawn = expandLayers(LANTERN.model).flat().join('')
    expect(drawn).toContain('g')
  })

  it('gives the shelter walls and a roof', () => {
    const drawn = expandLayers(SHELTER.model).flat().join('')
    expect(drawn).toContain('w')
    expect(drawn).toContain('r')
  })

  it('builds the shelter to the footprint the yard is laid out around', () => {
    // The clearing levels ground for exactly this many columns; a model that
    // outgrew them would have its corners standing on a slope. Every course,
    // not just the first: it is the roof that is most tempting to overhang.
    for (const layer of expandLayers(SHELTER.model)) {
      expect(layer.length).toBe(SHELTER_COLUMNS.d)
      for (const row of layer) expect(row.length).toBe(SHELTER_COLUMNS.w)
    }
  })

  it('stands the shelter on stone rather than starting it out of the grass', () => {
    const layers = expandLayers(SHELTER.model)
    expect(layers[0]!.join('')).toContain('s')
  })

  it('leaves the front open to the height of the pet, or it walls the pet in', () => {
    // The one thing about this model that is load-bearing. The pet walks in to
    // sleep and is meant to stay visible just inside the doorway; a front that
    // filled in, or a header beam hung too low, would take it off the screen
    // and look like a bug in the walking rather than in a wall.
    const layers = expandLayers(SHELTER.model)
    const front = (layer: string[]) => layer[layer.length - 1]!
    const clear = layers.filter((layer) => front(layer).includes('.')).length
    expect(clear * TERRAIN_VOXEL).toBeGreaterThan(PET_HEIGHT)
  })

  it('caps the doorway with something, so the front reads as a door', () => {
    // Above the opening, the front row fills in. Without it the front is not a
    // doorway, it is a missing wall.
    const layers = expandLayers(SHELTER.model)
    const front = (layer: string[]) => layer[layer.length - 1]!
    const open = layers.findIndex((layer) => front(layer).includes('.'))
    const capped = layers.findIndex(
      (layer, i) => i > open && !front(layer).includes('.') && front(layer).includes('w'),
    )
    expect(capped, 'nothing spans the top of the doorway').toBeGreaterThan(open)
  })

  it('keeps the fixed pieces out of the random scatter', () => {
    // Weight zero: they are placed on purpose, not rolled for.
    expect(LANTERN.weight).toBe(0)
    expect(SHELTER.weight).toBe(0)
    expect(PROPS).not.toContain(SHELTER)
    expect(PROPS).not.toContain(LANTERN)
  })
})
