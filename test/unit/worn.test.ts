import { describe, expect, it } from 'vitest'
import { KIT, kitById, stowedToday, wornToday, type Day, type KitId } from '../../src/data/kit'
import { KIT_MODELS, KIT_STANDING } from '../../src/data/kit-models'
import { SPECIES_LIST } from '../../src/data/species'
import { expandLayers, rows, type VoxelModel } from '../../src/data/voxel-format'
import { buildWorn, kitAnchors, wornKinds } from '../../src/render/worn'
import {
  modelSource,
  PART_ARM,
  PART_BODY,
  PART_HEAD,
  PART_LEG,
} from '../../src/render/voxel-mesh'
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

describe('where the rest of it goes', () => {
  it('finds a pair of hands and a pair of feet on everything with limbs', () => {
    for (const { id, model } of forms) {
      const source = modelSource(model)
      const { hands, feet, voxel } = kitAnchors(model, HEIGHT)
      const limbless = id === 'egg'
      expect(hands === null, id).toBe(limbless)
      expect(feet === null, id).toBe(limbless)
      if (!hands || !feet) continue
      // Ordered left of the screen first, so a thing meant for one hand is
      // always in the same hand.
      expect(hands[0].x, id).toBeLessThan(hands[1].x)
      expect(feet[0].x, id).toBeLessThan(feet[1].x)
      // A hand is somewhere up the body; a foot is on the ground the pet
      // stands on, which is where a boot has to start.
      expect(hands[0].y, id).toBeGreaterThan(0)
      expect(feet[0].y, id).toBe(0)
      expect(feet[1].y, id).toBe(0)
      // And both stay inside the creature's own footprint.
      for (const spot of [...hands, ...feet]) {
        expect(Math.abs(spot.x), id).toBeLessThanOrEqual((source.w / 2) * voxel)
      }
    }
  })

  it('puts the back behind the creature, and up where a strap would cross', () => {
    for (const { id, model } of forms) {
      const { back } = kitAnchors(model, HEIGHT)
      expect(back.z, id).toBeLessThan(0)
      expect(back.y, id).toBeGreaterThan(0)
      expect(back.y, id).toBeLessThan(HEIGHT)
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
    const built = buildWorn(['hat'], anchors)!.arrays
    expect(built.faces).toBeGreaterThan(0)
    expect(new Set(built.part)).toEqual(new Set([PART_HEAD]))
  })

  it('puts it on the crown rather than anywhere else on the creature', () => {
    const built = buildWorn(['hat'], anchors)!.arrays
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
      const built = buildWorn(['hat'], anchors)!.arrays
      const xs: number[] = []
      for (let i = 0; i < built.position.length; i += 3) xs.push(built.position[i]!)
      expect(Math.max(...xs) - Math.min(...xs), id).toBeCloseTo(across * anchors.voxel)
    }
  })
})

describe('carrying more than a hat', () => {
  const anchors = kitAnchors(forms[1]!.model, HEIGHT)

  const bounds = (worn: KitId[]) => {
    const built = buildWorn(worn, anchors)!.arrays
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < built.position.length; i += 3) {
      xs.push(built.position[i]!)
      ys.push(built.position[i + 1]!)
    }
    return { built, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys) }
  }

  it('animates each piece with the limb that carries it', () => {
    // The part is the whole of it, and each is chosen so the thing moves the
    // way the thing would: a held torch swings with the arm, a boot pivots
    // from the hip and stays planted, a basket rides on the body.
    const parts: [KitId, number][] = [
      ['hat', PART_HEAD],
      ['umbrella', PART_ARM],
      ['torch', PART_ARM],
      ['boots', PART_LEG],
      ['waders', PART_LEG],
      ['basket', PART_BODY],
    ]
    for (const [id, part] of parts) {
      expect(new Set(buildWorn([id], anchors)!.arrays.part), id).toEqual(new Set([part]))
    }
  })

  it('puts a boot on each foot, not one on the pair of them', () => {
    const boots = bounds(['boots'])
    expect(boots.minX).toBeLessThan(anchors.feet![0].x + anchors.voxel * 2)
    expect(boots.maxX).toBeGreaterThan(anchors.feet![1].x - anchors.voxel * 2)
    // Standing on the ground, since that is where the foot is.
    expect(boots.minY).toBeCloseTo(0)
    // Wider than one boot could be on its own, which is what says there are
    // two of them rather than one stretched across the gap.
    const oneBoot = 3 * anchors.voxel
    expect(boots.maxX - boots.minX).toBeGreaterThan(oneBoot)
  })

  it('holds a torch clear of the body, or it disappears behind the head', () => {
    const hand = anchors.hands![1]!
    const torch = bounds(['torch'])
    // Further out than the hand it hangs from: an arm ends at the body's own
    // edge, and a torch tall enough to matter is head height.
    expect(torch.maxX).toBeGreaterThan(hand.x + anchors.voxel)
    // And rising from the hand rather than from the floor.
    expect(torch.minY).toBeCloseTo(hand.y)
  })

  it('holds the umbrella high enough to be over the pet rather than beside it', () => {
    const built = buildWorn(['umbrella'], anchors)!.arrays
    const ys: number[] = []
    for (let i = 1; i < built.position.length; i += 3) ys.push(built.position[i]!)
    // The canopy has to reach past the top of the head, or the whole thing
    // reads as a blue box carried under one arm.
    expect(Math.max(...ys)).toBeGreaterThan(anchors.crown.y)
  })

  it('hangs the basket off the back rather than through it', () => {
    const built = buildWorn(['basket'], anchors)!.arrays
    const zs: number[] = []
    for (let i = 2; i < built.position.length; i += 3) zs.push(built.position[i]!)
    expect(Math.max(...zs)).toBeLessThanOrEqual(anchors.back.z + 1e-6)
  })

  it('lights up wherever the bright part of the thing is', () => {
    // The torch is the only kit with an emissive voxel in it, and its lens is
    // what the light follows. Worked out from the glow rather than written
    // down, so a lamp cannot end up somewhere the glow is not.
    const built = buildWorn(['torch'], anchors)!
    expect(built.light).not.toBeNull()
    const xs: number[] = []
    const ys: number[] = []
    const zs: number[] = []
    for (let i = 0; i < built.arrays.position.length; i += 3) {
      xs.push(built.arrays.position[i]!)
      ys.push(built.arrays.position[i + 1]!)
      zs.push(built.arrays.position[i + 2]!)
    }
    // Inside the torch itself, and out at the lens end of it rather than in
    // the middle of the barrel.
    expect(built.light!.x).toBeGreaterThanOrEqual(Math.min(...xs))
    expect(built.light!.x).toBeLessThanOrEqual(Math.max(...xs))
    expect(built.light!.y).toBeGreaterThanOrEqual(Math.min(...ys))
    expect(built.light!.y).toBeLessThanOrEqual(Math.max(...ys))
    expect(built.light!.z).toBeGreaterThan((Math.min(...zs) + Math.max(...zs)) / 2)
  })

  it('carries no light for kit that does not glow', () => {
    for (const id of wornKinds()) {
      const built = buildWorn([id], anchors)!
      const glows = built.arrays.emissive.some((e) => e > 0)
      expect(built.light === null, id).toBe(!glows)
    }
  })

  it('lights up for the torch and nothing else, which is the only lit thing', () => {
    const lit = wornKinds().filter((id) => buildWorn([id], anchors)!.light !== null)
    expect(lit).toEqual(['torch'])
  })

  it('gives every picture somewhere to hang, and every hanger a picture', () => {
    // Two lists that have to agree: a model with nowhere to hang is never
    // drawn, and a hanger with no model would ask for one that is not there.
    for (const id of Object.keys(KIT_MODELS) as KitId[]) {
      expect(wornKinds(), `${id} has nowhere to hang`).toContain(id)
    }
    for (const id of wornKinds()) expect(KIT_MODELS[id], id).toBeDefined()
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

  it('puts the umbrella up in the wet and the torch out after dark', () => {
    const owned: KitId[] = ['umbrella', 'torch']
    expect(wornToday(owned, day('spring', 'rain'))).toEqual(['umbrella'])
    expect(wornToday(owned, day('spring', 'mist'))).toEqual(['umbrella'])
    expect(wornToday(owned, day('spring', 'clear'))).toEqual([])
    expect(wornToday(owned, { ...day('spring', 'clear'), night: true })).toEqual(['torch'])
    // A wet night is both, which is why they are in different hands.
    expect(wornToday(owned, { ...day('spring', 'rain'), night: true })).toEqual([
      'umbrella',
      'torch',
    ])
  })

  it('wears the boots whatever the day, since they are not for the weather', () => {
    for (const season of SEASONS) {
      for (const weather of WEATHERS) {
        expect(wornToday(['boots'], day(season.id, weather))).toEqual(['boots'])
      }
    }
  })

  it('swaps the boots for waders in the wet, since there is one pair of feet', () => {
    const owned: KitId[] = ['boots', 'waders']
    expect(wornToday(owned, day('spring', 'clear'))).toEqual(['boots'])
    expect(wornToday(owned, day('spring', 'rain'))).toEqual(['waders'])
    // And waders alone are still waders.
    expect(wornToday(['waders'], day('spring', 'rain'))).toEqual(['waders'])
  })

  it('never puts two things on the same feet', () => {
    const owned = KIT.map((item) => item.id)
    for (const season of SEASONS) {
      for (const weather of WEATHERS) {
        for (const night of [false, true]) {
          const worn = wornToday(owned, { season: season.id, weather, night })
          const onFeet = worn.filter((id) => id === 'boots' || id === 'waders')
          expect(onFeet.length, `${season.id} ${weather}`).toBeLessThanOrEqual(1)
        }
      }
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

describe('what stands in the yard', () => {
  const day = (season: (typeof SEASONS)[number]['id'], weather: WeatherId): Day => ({
    season,
    weather,
    night: false,
  })

  it('stands nothing about for a family that owns nothing', () => {
    for (const season of SEASONS) {
      for (const weather of WEATHERS) {
        expect(stowedToday([], day(season.id, weather))).toEqual([])
      }
    }
  })

  it('leans the board by the door on the day it would be ridden', () => {
    const owned: KitId[] = ['snowboard']
    expect(stowedToday(owned, day('winter', 'snow'))).toEqual(['snowboard'])
    expect(stowedToday(owned, day('winter', 'clear'))).toEqual([])
    expect(stowedToday(owned, day('spring', 'rain'))).toEqual([])
  })

  it('never carries the board, since it is bigger than the pet', () => {
    for (const season of SEASONS) {
      for (const weather of WEATHERS) {
        for (const night of [false, true]) {
          const there = { season: season.id, weather, night }
          expect(wornToday(['snowboard'], there), `${season.id} ${weather}`).toEqual([])
        }
      }
    }
  })

  it('keeps the umbrella somewhere on every single day', () => {
    // The one object that moves with the weather: up in the pet's hand when it
    // is wet and furled against the wall when it is not, so where it is says
    // which. Nowhere at all would just look like it had been lost.
    for (const season of SEASONS) {
      for (const weather of WEATHERS) {
        for (const night of [false, true]) {
          const there = { season: season.id, weather, night }
          const carried = wornToday(['umbrella'], there).length
          const leaning = stowedToday(['umbrella'], there).length
          expect(carried + leaning, `${season.id} ${weather}`).toBe(1)
        }
      }
    }
  })

  it('gives everything it stands up something to stand there as', () => {
    const day = { season: 'winter', weather: 'snow', night: false } as const
    for (const id of stowedToday(KIT.map((item) => item.id), day)) {
      expect(KIT_STANDING[id], `${id} has nothing to stand as`).toBeDefined()
    }
  })

  it('gives every standing picture a height to stand at', () => {
    for (const [id, standing] of Object.entries(KIT_STANDING) as [
      KitId,
      { model: VoxelModel; height: number },
    ][]) {
      expect(kitById(id), id).toBeDefined()
      expect(standing.height, id).toBeGreaterThan(0)
      const layers = expandLayers(standing.model)
      const depth = layers[0]!.length
      for (const layer of layers) {
        expect(layer.length, id).toBe(depth)
        for (const row of layer) {
          for (const ch of row) {
            if (ch !== '.') expect(standing.model.palette[ch], `${id}: ${ch}`).toBeDefined()
          }
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
