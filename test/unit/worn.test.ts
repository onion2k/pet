import { describe, expect, it } from 'vitest'
import { KIT, kitById, wornToday, type Day, type KitId } from '../../src/data/kit'
import { KIT_MODELS } from '../../src/data/kit-models'
import { SPECIES_LIST } from '../../src/data/species'
import { expandLayers, rows, type VoxelModel } from '../../src/data/voxel-format'
import { buildWorn, kitAnchors, wornKinds } from '../../src/render/worn'
import { modelSource, PART_HEAD } from '../../src/render/voxel-mesh'
import { SEASONS, type WeatherId } from '../../src/data/seasons'

/**
 * Kit on the pet.
 *
 * None of this can be looked at without a browser, and the part that most
 * wants looking at -- whether a hat sits on a head or floats over it -- is
 * exactly the part a test cannot judge. What a test can do is hold the
 * measurement to the model: the crown has to be inside the creature, on top of
 * it, and on the head rather than on whatever the head is wearing already.
 *
 * That last one is not hypothetical. Mochimo has a tuft of four sparkles above
 * its head and the hatchling an antenna, and the first version of this put the
 * hat on the sparkles.
 */

const HEIGHT = 1.85
const WEATHERS: WeatherId[] = ['clear', 'rain', 'snow', 'mist']

/** Every creature the game can put on the screen. */
const forms = SPECIES_LIST.map((species) => ({ id: species.id, model: species.model }))

describe('where a hat goes', () => {
  it('finds a crown on every form, inside the creature and on top of it', () => {
    for (const { id, model } of forms) {
      const source = modelSource(model)
      const scale = HEIGHT / source.h
      const { crown, voxel } = kitAnchors(model, HEIGHT)
      expect(voxel, id).toBeCloseTo(scale)
      // Within the model's own footprint, and above its middle.
      expect(Math.abs(crown.x), id).toBeLessThanOrEqual((source.w / 2) * scale)
      expect(Math.abs(crown.z), id).toBeLessThanOrEqual((source.d / 2) * scale)
      expect(crown.y, id).toBeGreaterThan(HEIGHT / 2)
      expect(crown.y, id).toBeLessThanOrEqual(HEIGHT)
    }
  })

  it('sits on the head rather than on the tuft growing out of it', () => {
    // A body eight voxels square with a single spike on a stalk above it. The
    // crown belongs on the body: a hat balanced on the spike would float.
    const spiky: VoxelModel = {
      palette: { b: '#8899aa' },
      layers: [
        ...Array.from({ length: 4 }, () =>
          rows(`
            bbbb
            bbbb
            bbbb
            bbbb`),
        ),
        rows(`
          ....
          ..b.
          ....
          ....`),
        rows(`
          ....
          ..b.
          ....
          ....`),
      ],
    }
    const source = modelSource(spiky)
    const scale = HEIGHT / source.h
    // The body's top surface is the top of layer 3, not of layer 5.
    expect(kitAnchors(spiky, HEIGHT).crown.y).toBeCloseTo(4 * scale)
  })

  it('leaves room above the crown for the thing that goes there', () => {
    // Nothing may be measured so high that a hat would be drawn off the top of
    // the world, and nothing so low it would be drawn inside the creature.
    for (const { id, model } of forms) {
      const layers = expandLayers(model)
      const source = modelSource(model)
      const scale = HEIGHT / source.h
      const { crown } = kitAnchors(model, HEIGHT)
      expect(crown.y, id).toBeGreaterThanOrEqual(layers.length * 0.5 * scale)
    }
  })
})

describe('building what is worn', () => {
  const anchors = kitAnchors(forms[0]!.model, HEIGHT)

  it('draws nothing at all for a pet wearing nothing', () => {
    expect(buildWorn([], anchors)).toBeNull()
  })

  it('draws nothing for kit this build has no picture of', () => {
    const withoutPictures = KIT.map((item) => item.id).filter((id) => !wornKinds().includes(id))
    expect(withoutPictures.length, 'nothing left to draw').toBeGreaterThan(0)
    expect(buildWorn(withoutPictures, anchors)).toBeNull()
  })

  it('tags every vertex as the head, which is what animates it', () => {
    // The whole trick. A hat merged as part of the head twists with the idle
    // look-around, settles when the pet sleeps and rises with each stride,
    // without one line of the shader knowing it is there.
    const built = buildWorn(['hat'], anchors)!
    expect(built.faces).toBeGreaterThan(0)
    expect(new Set(built.part)).toEqual(new Set([PART_HEAD]))
  })

  it('puts it on the crown rather than anywhere else on the creature', () => {
    const built = buildWorn(['hat'], anchors)!
    const ys: number[] = []
    const xs: number[] = []
    for (let i = 0; i < built.position.length; i += 3) {
      xs.push(built.position[i]!)
      ys.push(built.position[i + 1]!)
    }
    // Sunk by a voxel so the brim grips, and rising from there.
    expect(Math.min(...ys)).toBeCloseTo(anchors.crown.y - anchors.voxel)
    expect(Math.max(...ys)).toBeGreaterThan(anchors.crown.y)
    // And centred on the crown, give or take the odd half voxel of rounding.
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2
    expect(Math.abs(middle - anchors.crown.x)).toBeLessThan(anchors.voxel)
  })

  it('builds the hat out of the blocks the creature is built of', () => {
    // Not "the same size on everyone": the forms are drawn to one world height
    // but are not all the same number of voxels tall, so a voxel is a shade
    // bigger on a shorter one. The hat is the same *hat* -- nine voxels across
    // on every form -- built at whatever size that form's voxels are, which is
    // what keeps its blocks lined up with the head's.
    const across = 9
    for (const { id, model } of forms) {
      const anchors = kitAnchors(model, HEIGHT)
      const built = buildWorn(['hat'], anchors)!
      const xs: number[] = []
      for (let i = 0; i < built.position.length; i += 3) xs.push(built.position[i]!)
      expect(Math.max(...xs) - Math.min(...xs), id).toBeCloseTo(across * anchors.voxel)
    }
  })
})

describe('what the pet has about it today', () => {
  const day = (season: (typeof SEASONS)[number]['id'], weather: WeatherId): Day => ({
    season,
    weather,
    night: false,
  })

  it('shows nothing a family does not own', () => {
    for (const season of SEASONS) {
      expect(wornToday([], day(season.id, 'clear'))).toEqual([])
    }
  })

  it('puts the hat on for winter and takes it off again', () => {
    for (const season of SEASONS) {
      const worn = wornToday(['hat'], day(season.id, 'clear'))
      expect(worn, season.id).toEqual(season.id === 'winter' ? ['hat'] : [])
    }
  })

  it('shows nothing for the kit that has no look yet', () => {
    // Owning the lot must not put seven invisible things on the pet: what is
    // not drawn is not worn, and this is the line that changes as each gets
    // its picture.
    const owned = KIT.map((item) => item.id)
    for (const season of SEASONS) {
      for (const weather of WEATHERS) {
        for (const id of wornToday(owned, day(season.id, weather))) {
          expect(KIT_MODELS[id], id).toBeDefined()
        }
      }
    }
  })
})

describe('the pictures themselves', () => {
  it('gives every drawable piece a model the mesher can read', () => {
    for (const [id, model] of Object.entries(KIT_MODELS) as [KitId, VoxelModel][]) {
      expect(kitById(id), id).toBeDefined()
      const layers = expandLayers(model)
      expect(layers.length, id).toBeGreaterThan(0)
      // Every layer the same shape, and every character a colour: a palette
      // with a hole in it is a magenta block on the pet's head.
      const depth = layers[0]!.length
      for (const layer of layers) {
        expect(layer.length, id).toBe(depth)
        for (const row of layer) {
          expect(row.length, id).toBe(layers[0]![0]!.length)
          for (const ch of row) {
            if (ch !== '.') expect(model.palette[ch], `${id} has no colour for ${ch}`).toBeDefined()
          }
        }
      }
    }
  })

  it('draws something in every picture', () => {
    for (const [id, model] of Object.entries(KIT_MODELS) as [KitId, VoxelModel][]) {
      const source = modelSource(model)
      let filled = 0
      for (let y = 0; y < source.h; y++) {
        for (let z = 0; z < source.d; z++) {
          for (let x = 0; x < source.w; x++) if (source.at(x, y, z)) filled++
        }
      }
      expect(filled, id).toBeGreaterThan(0)
    }
  })
})
