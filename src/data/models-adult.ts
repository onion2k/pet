import { rows, type VoxelModel } from './voxel-format'

/** Adult forms. Two per child branch, chosen by how the pet was actually raised. */

export const MOCHI: VoxelModel = {
  palette: { b: '#ffd9ec', d: '#ffaad4', k: '#14121a', m: '#ff6fae', g: '#fff3a0', l: '#ffaad4' },
  emissive: ['g'],
  head: ['k', 'm'],
  limbs: ['l'],
  layers: [
    rows(`
      .......
      .......
      .......
      .......
      .ll.ll.
      .......
      .......`),
    rows(`
      ..ddd..
      .ddddd.
      ddddddd
      ddddddd
      ddddddd
      .ddddd.
      ..ddd..`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .bbbbb.
      ..bbb..`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .bbbbb.
      ..bbb..`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .mbbbm.
      ..kbk..`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbbbb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      .......
      ..g.g..
      ...g...
      .......
      .......
      .......`),
  ],
}

export const GLOOP: VoxelModel = {
  palette: { b: '#a89ac9', d: '#6f628f', k: '#14121a', o: '#c9ff6b', l: '#6f628f' },
  emissive: ['o'],
  head: ['k'],
  limbs: ['l'],
  layers: [
    rows(`
      .......
      .ddddd.
      ddddddd
      ddddddd
      ddddddd
      .ddddd.
      ..ddd..`),
    rows(`
      ..ddd..
      .ddddd.
      ddddddd
      dddoddd
      ddddddd
      .ddddd.
      ..ddd..`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .bbbbb.
      ..bbb..`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .bbbbb.
      ..kbk..`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbobb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      .......
      ...b...
      ..bbb..
      ...b...
      .......
      .......`),
  ],
}

export const BLAZE: VoxelModel = {
  palette: { b: '#ff5a3c', d: '#b52a18', k: '#14121a', s: '#ffcf3d', l: '#b52a18' },
  emissive: ['s'],
  head: ['k'],
  limbs: ['l'],
  layers: [
    rows(`
      .......
      .......
      .......
      ..l.l..
      ..l.l..
      .......
      .......`),
    rows(`
      .......
      ..ddd..
      .ddddd.
      .ddddd.
      .ddddd.
      ..ddd..
      .......`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      sbbbbbs
      bbbbbbb
      .bbbbb.
      ..bbb..`),
    rows(`
      ..sss..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .bbbbb.
      ..bbb..`),
    rows(`
      ...s...
      ..bbb..
      .bbbbb.
      .bbbbb.
      .bbbbb.
      ..kbk..
      .......`),
    rows(`
      ...s...
      ..sbs..
      ..bbb..
      ..bbb..
      ..bbb..
      .......
      .......`),
    rows(`
      .......
      ...s...
      ..s.s..
      ...s...
      .......
      .......
      .......`),
  ],
}

export const GRUMP: VoxelModel = {
  palette: { b: '#b8563c', d: '#7a3324', k: '#14121a', s: '#8c7a55', l: '#7a3324' },
  head: ['k'],
  limbs: ['l'],
  layers: [
    rows(`
      .......
      .......
      .......
      .ll.ll.
      .ll.ll.
      .......
      .......`),
    rows(`
      ..ddd..
      .ddddd.
      ddddddd
      ddddddd
      ddddddd
      .ddddd.
      ..ddd..`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      sbbbbbs
      bbbbbbb
      .bbbbb.
      ..bbb..`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .sssss.
      ..kbk..`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbbbb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      .......
      ..s.s..
      .......
      .......
      .......
      .......`),
  ],
}

export const VERDANT: VoxelModel = {
  palette: { b: '#9be870', d: '#3f8f2f', k: '#14121a', v: '#6fe04a', f: '#ffd166', l: '#3f8f2f' },
  emissive: ['f'],
  head: ['k'],
  limbs: ['l'],
  layers: [
    rows(`
      .......
      .......
      .......
      .......
      ..l.l..
      .......
      .......`),
    rows(`
      .......
      ..ddd..
      .ddddd.
      .ddddd.
      .ddddd.
      ..ddd..
      .......`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbbbb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbbbb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbbbb.
      .bbbbb.
      ..kbk..
      .......`),
    rows(`
      .......
      .......
      ..bbb..
      ..bbb..
      ..bbb..
      .......
      .......`),
    rows(`
      ...v...
      ..vvv..
      .vvvvv.
      vvvdvvv
      .vvvvv.
      ..vvv..
      ...v...`),
    rows(`
      .......
      ...f...
      ..v.v..
      .f...f.
      ..v.v..
      ...f...
      .......`),
  ],
}

export const LUMEN: VoxelModel = {
  palette: { b: '#7fd6ff', d: '#3a86b8', k: '#14121a', g: '#e6fbff', l: '#3a86b8' },
  emissive: ['g'],
  head: ['k'],
  limbs: ['l'],
  layers: [
    rows(`
      .......
      .......
      .......
      .......
      ..l.l..
      .......
      .......`),
    rows(`
      .......
      .......
      ..ddd..
      ..ddd..
      ..ddd..
      .......
      .......`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbgbb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bgggb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbgbb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      ..bbb..
      .bbbbb.
      bbbbbbb
      bbbbbbb
      bbbbbbb
      .bbbbb.
      ..kbk..`),
    rows(`
      .......
      ..bbb..
      .bbbbb.
      .bbbbb.
      .bbbbb.
      ..bbb..
      .......`),
    rows(`
      .......
      .......
      ..g.g..
      ...g...
      ..g.g..
      .......
      .......`),
  ],
}
