import type { SeasonId } from './seasons'
import { rows, type VoxelModel } from './voxel-format'

/**
 * Things that turn up in the yard for a while: a ball to knock about, a rabbit
 * grazing at the verge, a snowman somebody built. They are not scenery, because
 * scenery is stamped into the terrain and the terrain is only meshed when the
 * pet changes -- a 40ms rebuild is too much to spend on the season turning.
 * Each of these is its own small mesh instead, shown and hidden as the year and
 * the dice decide.
 */
export type VisitorId =
  | 'fireflies'
  | 'ball'
  | 'rabbit'
  | 'snowman'
  | 'flowers'
  | 'pumpkin'
  | 'butterfly'
  | 'leafpile'
  | 'sled'
  | 'moth'
  | 'glowworms'
  | 'deer'
  | 'bluebells'
  | 'tern'
  | 'seafire'
  | 'crab'
  | 'seapinks'
  | 'skylark'
  | 'glowbeetles'
  | 'sheep'
  | 'heather'
  | 'sparrow'
  | 'lampmoths'
  | 'cat'
  | 'hollyhocks'

/**
 * The jobs a living visitor does, so a biome can fill them with its own.
 *
 * Objects are not in here: a ball is a ball wherever the pet lives, and a sled
 * is left out by whoever leaves sleds out. It is the creatures and the flowers
 * that make one place feel unlike another, and two of these roles carry a yard
 * game -- which is the point. A game asks for a role rather than for a named
 * visitor, so every biome can play all five while none of them looks alike.
 */
export type VisitorRole = 'flitter' | 'glow' | 'grazer' | 'bloom'

/** How a visitor moves, if at all. */
export type VisitorMotion = 'still' | 'hop' | 'flutter' | 'roll'

/** Where in the yard it stands. */
export type VisitorSpot =
  /** Inside the band the pet roams, so the pet can reach it. */
  | 'roam'
  /** On the verge behind the roaming band, where it will not be walked into. */
  | 'verge'
  /** Beside the shelter door. */
  | 'door'

export interface Visitor {
  id: VisitorId
  /** Announced on the ticker when it turns up, written out in full. One shared
   * sentence frame made every arrival read as the same message, and could not
   * be made to agree with a plural name: "wildflowers is in the yard". */
  arrival: string
  seasons: SeasonId[]
  /** Chance of being there on any given world day. */
  chance: number
  /**
   * World hours it can be seen between, if it keeps to a time. A visitor with
   * a window is announced on the ticker before it opens, so there is a reason
   * to come back at a particular moment rather than merely at some point.
   */
  hours?: [number, number]
  /** What the ticker says while one is expected but not yet due. */
  expected?: string
  model: VoxelModel
  /** World height the model is scaled to. */
  height: number
  motion: VisitorMotion
  spot: VisitorSpot
  /**
   * What to call it in a sentence, if the pet can win it over on a long trip --
   * after which it turns up whenever its season does. Only the living ones: a
   * sled cannot be befriended however far the pet walks.
   */
  friend?: string
}

const ball: VoxelModel = {
  palette: { b: '#e8534a', a: '#f7f1e2' },
  layers: [
    rows(`
      .....
      .bbb.
      .bbb.
      .bbb.
      .....`),
    rows(`
      .bbb.
      bbbbb
      bbbbb
      bbbbb
      .bbb.`),
    rows(`
      .aaa.
      aaaaa
      aaaaa
      aaaaa
      .aaa.`),
    rows(`
      .bbb.
      bbbbb
      bbbbb
      bbbbb
      .bbb.`),
    rows(`
      .....
      .bbb.
      .bbb.
      .bbb.
      .....`),
  ],
}

const rabbit: VoxelModel = {
  palette: { w: '#e6ded2', p: '#f0a9b8', k: '#1b1720' },
  layers: [
    rows(`
      .....
      .www.
      .www.
      .www.
      .....`),
    rows(`
      .www.
      wwwww
      wwwww
      wwwww
      .www.`),
    rows(`
      .www.
      wwwww
      wwwww
      wwwww
      .www.`),
    rows(`
      .....
      .www.
      .www.
      wwwww
      .www.`),
    rows(`
      .....
      .....
      .....
      .www.
      .kwk.`),
    rows(`
      .....
      .....
      .....
      .p.p.
      .....`),
    rows(`
      .....
      .....
      .....
      .p.p.
      .....`),
  ],
}

const snowman: VoxelModel = {
  palette: { s: '#f7fbff', k: '#1b1720', o: '#e8892f', t: '#2b2733', c: '#d4453a' },
  layers: [
    rows(`
      .sss.
      sssss
      sssss
      sssss
      .sss.`),
    rows(`
      .sss.
      sssss
      sssss
      sssss
      .sss.`),
    rows(`
      .....
      .sss.
      sssss
      .sss.
      .....`),
    rows(`
      .....
      .sss.
      .sss.
      .sss.
      .....`),
    rows(`
      .....
      .sss.
      .sss.
      .sks.
      .....`),
    rows(`
      .....
      .ccc.
      .ccc.
      .ccc.
      .....`),
    rows(`
      .....
      .sss.
      .sss.
      .scs.
      .....`),
    rows(`
      .....
      .sss.
      .sss.
      .kok.
      .....`),
    rows(`
      .....
      .sss.
      .sss.
      .sss.
      .....`),
    rows(`
      .....
      ttttt
      ttttt
      ttttt
      .....`),
    rows(`
      .....
      .ttt.
      .ttt.
      .ttt.
      .....`),
    rows(`
      .....
      .ttt.
      .ttt.
      .ttt.
      .....`),
  ],
}

const flowers: VoxelModel = {
  palette: { g: '#4f9e3a', w: '#3f8f2f', p: '#f2a0c4', y: '#ffe066', v: '#c58ce8' },
  layers: [
    rows(`
      .....
      .g.g.
      ..g..
      .g.g.
      .....`),
    rows(`
      .....
      .w.w.
      ..w..
      .w.w.
      .....`),
    rows(`
      .....
      .p.y.
      ..w..
      .v.p.
      .....`),
    rows(`
      .....
      .....
      ..y..
      .....
      .....`),
  ],
}

const pumpkin: VoxelModel = {
  palette: { o: '#e8752a', g: '#ffb43c', s: '#4f7a35' },
  emissive: ['g'],
  layers: [
    rows(`
      .ooo.
      ooooo
      ooooo
      ooooo
      .ooo.`),
    rows(`
      ooooo
      ooooo
      ooooo
      ooooo
      ooooo`),
    rows(`
      ooooo
      ooooo
      ooooo
      ooooo
      .ggg.`),
    rows(`
      .ooo.
      ooooo
      ooooo
      ooooo
      .gog.`),
    rows(`
      .....
      ..o..
      .ooo.
      ..o..
      .....`),
    rows(`
      .....
      .....
      ..s..
      .....
      .....`),
  ],
}

const butterfly: VoxelModel = {
  palette: { b: '#3a3346', w: '#ffb84d', m: '#ff7ec4' },
  layers: [
    rows(`
      ..b..
      ..b..
      ..b..`),
    rows(`
      ww.ww
      mm.mm
      .....`),
  ],
}

const leafpile: VoxelModel = {
  palette: { r: '#a4552c', o: '#d8842f', y: '#e8b64a' },
  layers: [
    rows(`
      .rrr.
      rrorr
      rooor
      rrorr
      .rrr.`),
    rows(`
      .....
      .ryr.
      .yoy.
      .ryr.
      .....`),
    rows(`
      .....
      .....
      ..y..
      .....
      .....`),
  ],
}

const sled: VoxelModel = {
  palette: { w: '#8a5a33', m: '#9aa3ad' },
  layers: [
    rows(`
      .m.m.
      .m.m.
      .m.m.
      .m.m.
      .m.m.`),
    rows(`
      .www.
      .www.
      .www.
      .www.
      .www.`),
    rows(`
      .....
      .....
      .....
      .....
      .www.`),
  ],
}

const fireflies: VoxelModel = {
  palette: { g: '#fff2a0' },
  emissive: ['g'],
  layers: [rows(`g`)],
}

const moth: VoxelModel = {
  palette: { b: '#4a4038', w: '#cfc4a8', m: '#9c8f74' },
  layers: [
    rows(`
      ..b..
      ..b..
      ..b..`),
    rows(`
      ww.ww
      mm.mm
      .....`),
  ],
}

const glowworms: VoxelModel = {
  palette: { g: '#b6ff9a' },
  emissive: ['g'],
  layers: [rows(`g`)],
}

const deer: VoxelModel = {
  palette: { b: '#a97e4f', t: '#c9a273', k: '#1b1720', h: '#6f523a' },
  layers: [
    rows(`
      .....
      .b.b.
      .....
      .b.b.
      .....`),
    rows(`
      .bbb.
      bbbbb
      bbbbb
      bbbbb
      .bbb.`),
    rows(`
      .ttt.
      ttttt
      ttttt
      ttttt
      .ttt.`),
    rows(`
      .....
      ..b..
      ..b..
      .bbb.
      .....`),
    rows(`
      .....
      .....
      .....
      .bbb.
      .kbk.`),
    rows(`
      .....
      .....
      .....
      h...h
      .....`),
  ],
}

const bluebells: VoxelModel = {
  palette: { g: '#3f7f3a', w: '#356f30', b: '#7d8ce8', v: '#9a86e0' },
  layers: [
    rows(`
      .....
      .g.g.
      ..g..
      .g.g.
      .....`),
    rows(`
      .....
      .w.w.
      ..w..
      .w.w.
      .....`),
    rows(`
      .....
      .b.v.
      ..w..
      .v.b.
      .....`),
    rows(`
      .....
      .....
      ..b..
      .....
      .....`),
  ],
}


const tern: VoxelModel = {
  palette: { b: '#4a5468', w: '#f2f4f8', m: '#c9d2dd' },
  layers: [
    rows(`
      ..b..
      ..b..
      ..b..`),
    rows(`
      ww.ww
      mm.mm
      .....`),
  ],
}

const skylark: VoxelModel = {
  palette: { b: '#5c4a33', w: '#b79a6f', m: '#8f7550' },
  layers: [
    rows(`
      ..b..
      ..b..
      ..b..`),
    rows(`
      ww.ww
      mm.mm
      .....`),
  ],
}

const sparrow: VoxelModel = {
  palette: { b: '#4c3c2c', w: '#a88c66', m: '#6f5a41' },
  layers: [
    rows(`
      ..b..
      ..b..
      ..b..`),
    rows(`
      ww.ww
      mm.mm
      .....`),
  ],
}

const seafire: VoxelModel = {
  palette: { g: '#9ce8ff' },
  emissive: ['g'],
  layers: [rows(`g`)],
}

const glowbeetles: VoxelModel = {
  palette: { g: '#ffd48a' },
  emissive: ['g'],
  layers: [rows(`g`)],
}

const lampmoths: VoxelModel = {
  palette: { g: '#fff0c8' },
  emissive: ['g'],
  layers: [rows(`g`)],
}

const crab: VoxelModel = {
  palette: { r: '#d4623f', d: '#a4482c', k: '#1b1720' },
  layers: [
    rows(`
      d...d
      .....
      d...d
      .....
      d...d`),
    rows(`
      .rrr.
      rrrrr
      rrrrr
      rrrrr
      .rrr.`),
    rows(`
      .....
      .r.r.
      .....
      .k.k.
      .....`),
  ],
}

const sheep: VoxelModel = {
  palette: { w: '#efe9dc', d: '#cfc6b4', k: '#2a2430' },
  layers: [
    rows(`
      .....
      .d.d.
      .....
      .d.d.
      .....`),
    rows(`
      .www.
      wwwww
      wwwww
      wwwww
      .www.`),
    rows(`
      .www.
      wwwww
      wwwww
      wwwww
      .www.`),
    rows(`
      .....
      ..w..
      .www.
      .kwk.
      .....`),
  ],
}

const cat: VoxelModel = {
  palette: { g: '#5a5560', d: '#3d3944', y: '#e8c24a' },
  layers: [
    rows(`
      .....
      .d.d.
      .....
      .d.d.
      .....`),
    rows(`
      .ggg.
      ggggg
      ggggg
      ggggg
      .ggg.`),
    rows(`
      .....
      ..g..
      ..g..
      .ggg.
      .....`),
    rows(`
      .....
      .....
      .....
      .gyg.
      .g.g.`),
  ],
}

const seapinks: VoxelModel = {
  palette: { g: '#6f8f6a', w: '#5d7a58', p: '#f2a6c0', r: '#e888ac' },
  layers: [
    rows(`
      .....
      .g.g.
      ..g..
      .g.g.
      .....`),
    rows(`
      .....
      .w.w.
      ..w..
      .w.w.
      .....`),
    rows(`
      .....
      .p.r.
      ..w..
      .r.p.
      .....`),
    rows(`
      .....
      .....
      ..p..
      .....
      .....`),
  ],
}

const heather: VoxelModel = {
  palette: { g: '#5f7a4a', w: '#4e6a3d', p: '#b978d8', v: '#9a5fc4' },
  layers: [
    rows(`
      .....
      .g.g.
      ..g..
      .g.g.
      .....`),
    rows(`
      .....
      .w.w.
      ..w..
      .w.w.
      .....`),
    rows(`
      .....
      .p.v.
      ..w..
      .v.p.
      .....`),
  ],
}

const hollyhocks: VoxelModel = {
  palette: { g: '#4f9e3a', w: '#3f8f2f', p: '#f4b8d0', y: '#f6e39a', r: '#e3708f' },
  layers: [
    rows(`
      .....
      .g.g.
      ..g..
      .g.g.
      .....`),
    rows(`
      .....
      .w.w.
      ..w..
      .w.w.
      .....`),
    rows(`
      .....
      .p.y.
      ..w..
      .r.p.
      .....`),
    rows(`
      .....
      ..p..
      ..w..
      ..r..
      .....`),
    rows(`
      .....
      .....
      ..y..
      .....
      .....`),
  ],
}

export const VISITORS: Visitor[] = [
  {
    id: 'fireflies',
    friend: 'the fireflies',
    arrival: 'fireflies are out over the long grass',
    seasons: ['spring', 'summer'],
    chance: 0.5,
    hours: [20, 4],
    expected: 'something will be out after dark',
    model: fireflies,
    height: 0.14,
    motion: 'flutter',
    spot: 'roam',
  },
  { id: 'ball', arrival: 'a ball has turned up in the yard', seasons: ['summer', 'autumn'], chance: 0.5, model: ball, height: 0.44, motion: 'roll', spot: 'roam' },
  { id: 'rabbit', friend: 'a rabbit', arrival: 'a rabbit is grazing on the verge', seasons: ['spring', 'summer'], chance: 0.4, model: rabbit, height: 0.74, motion: 'hop', spot: 'verge' },
  { id: 'snowman', arrival: 'somebody has built a snowman', seasons: ['winter'], chance: 0.55, model: snowman, height: 1.4, motion: 'still', spot: 'verge' },
  { id: 'flowers', arrival: 'wildflowers have come up', seasons: ['spring'], chance: 0.65, model: flowers, height: 0.64, motion: 'still', spot: 'verge' },
  { id: 'pumpkin', arrival: 'a carved lantern sits by the door', seasons: ['autumn'], chance: 0.5, model: pumpkin, height: 0.64, motion: 'still', spot: 'door' },
  { id: 'butterfly', friend: 'a butterfly', arrival: 'a butterfly is doing the rounds', seasons: ['spring', 'summer'], chance: 0.45, model: butterfly, height: 0.32, motion: 'flutter', spot: 'roam' },
  { id: 'leafpile', arrival: 'the leaves have blown into a pile', seasons: ['autumn'], chance: 0.5, model: leafpile, height: 0.44, motion: 'still', spot: 'verge' },
  { id: 'sled', arrival: 'a sled has been left out', seasons: ['winter'], chance: 0.4, model: sled, height: 0.42, motion: 'still', spot: 'verge' },
  {
    id: 'glowworms',
    friend: 'the glow-worms',
    arrival: 'glow-worms are lit along the bank',
    seasons: ['spring', 'summer'],
    chance: 0.5,
    hours: [20, 4],
    expected: 'something will be out after dark',
    model: glowworms,
    height: 0.14,
    motion: 'flutter',
    spot: 'roam',
  },
  { id: 'moth', friend: 'a moth', arrival: 'a moth is blundering about', seasons: ['spring', 'summer'], chance: 0.45, model: moth, height: 0.32, motion: 'flutter', spot: 'roam' },
  { id: 'deer', friend: 'a deer', arrival: 'a deer has come down to the clearing', seasons: ['spring', 'summer'], chance: 0.4, model: deer, height: 1.1, motion: 'hop', spot: 'verge' },
  { id: 'bluebells', arrival: 'the bluebells are out', seasons: ['spring'], chance: 0.65, model: bluebells, height: 0.64, motion: 'still', spot: 'verge' },

  // The beach.
  {
    id: 'seafire',
    friend: 'the sea-fire',
    arrival: 'the water is lit up along the shore',
    seasons: ['spring', 'summer'],
    chance: 0.5,
    hours: [20, 4],
    expected: 'something will be out after dark',
    model: seafire,
    height: 0.14,
    motion: 'flutter',
    spot: 'roam',
  },
  { id: 'tern', friend: 'a tern', arrival: 'a tern is working the shoreline', seasons: ['spring', 'summer'], chance: 0.45, model: tern, height: 0.32, motion: 'flutter', spot: 'roam' },
  { id: 'crab', friend: 'a crab', arrival: 'a crab has come up the sand', seasons: ['spring', 'summer'], chance: 0.4, model: crab, height: 0.4, motion: 'hop', spot: 'verge' },
  { id: 'seapinks', arrival: 'the thrift is out on the bank', seasons: ['spring'], chance: 0.65, model: seapinks, height: 0.6, motion: 'still', spot: 'verge' },

  // The hill.
  {
    id: 'glowbeetles',
    friend: 'the glow-beetles',
    arrival: 'glow-beetles are out among the stones',
    seasons: ['spring', 'summer'],
    chance: 0.5,
    hours: [20, 4],
    expected: 'something will be out after dark',
    model: glowbeetles,
    height: 0.14,
    motion: 'flutter',
    spot: 'roam',
  },
  { id: 'skylark', friend: 'a skylark', arrival: 'a skylark is up over the tops', seasons: ['spring', 'summer'], chance: 0.45, model: skylark, height: 0.32, motion: 'flutter', spot: 'roam' },
  { id: 'sheep', friend: 'a sheep', arrival: 'a sheep has wandered in', seasons: ['spring', 'summer'], chance: 0.4, model: sheep, height: 0.86, motion: 'hop', spot: 'verge' },
  { id: 'heather', arrival: 'the heather is out', seasons: ['spring'], chance: 0.65, model: heather, height: 0.5, motion: 'still', spot: 'verge' },

  // The village.
  {
    id: 'lampmoths',
    friend: 'the lamp-moths',
    arrival: 'moths are gathering at the lamp',
    seasons: ['spring', 'summer'],
    chance: 0.5,
    hours: [20, 4],
    expected: 'something will be out after dark',
    model: lampmoths,
    height: 0.14,
    motion: 'flutter',
    spot: 'roam',
  },
  { id: 'sparrow', friend: 'a sparrow', arrival: 'a sparrow is hopping about the path', seasons: ['spring', 'summer'], chance: 0.45, model: sparrow, height: 0.32, motion: 'flutter', spot: 'roam' },
  { id: 'cat', friend: 'the cat from next door', arrival: 'the cat from next door is on the wall', seasons: ['spring', 'summer'], chance: 0.4, model: cat, height: 0.7, motion: 'hop', spot: 'verge' },
  { id: 'hollyhocks', arrival: 'the hollyhocks are out', seasons: ['spring'], chance: 0.65, model: hollyhocks, height: 0.8, motion: 'still', spot: 'verge' },
]

/**
 * The ones that turn up wherever the pet lives. Everything else is a role its
 * biome fills, so moving house changes who is out there without ever changing
 * what there is to do.
 */
export const UNIVERSAL_VISITORS: VisitorId[] = [
  'ball',
  'snowman',
  'pumpkin',
  'leafpile',
  'sled',
]
