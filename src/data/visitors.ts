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

export const VISITORS: Visitor[] = [
  {
    id: 'fireflies',
    friend: 'the fireflies',
    arrival: 'fireflies are out over the meadow',
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
]
