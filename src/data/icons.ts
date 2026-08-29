/** 8x8 menu glyphs, printed around the screen bezel like a real handheld. */
export type IconId = 'feed' | 'play' | 'sleep' | 'clean' | 'medicine' | 'status'

const I: Record<IconId, string> = {
  feed: [
    '...#....',
    '..##....',
    '.######.',
    '########',
    '########',
    '########',
    '.######.',
    '..####..',
  ].join('/'),
  play: [
    '.######.',
    '.#.#..#.',
    '.#....#.',
    '.#....#.',
    '.#..#.#.',
    '.######.',
    '........',
    '........',
  ].join('/'),
  sleep: [
    '.######.',
    '.....##.',
    '....##..',
    '...##...',
    '..##....',
    '.##.....',
    '.######.',
    '........',
  ].join('/'),
  clean: [
    '...##...',
    '...##...',
    '...##...',
    '..####..',
    '.######.',
    '.#.##.#.',
    '.#.##.#.',
    '........',
  ].join('/'),
  medicine: [
    '...##...',
    '...##...',
    '.######.',
    '.######.',
    '...##...',
    '...##...',
    '........',
    '........',
  ].join('/'),
  status: [
    '.##..##.',
    '########',
    '########',
    '.######.',
    '..####..',
    '...##...',
    '........',
    '........',
  ].join('/'),
}

export const ICON_SIZE = 8

export const ICON_ORDER: IconId[] = ['feed', 'play', 'clean', 'medicine', 'sleep', 'status']

export const ICON_LABEL: Record<IconId, string> = {
  feed: 'FEED',
  play: 'PLAY',
  sleep: 'SLEEP',
  clean: 'CLEAN',
  medicine: 'MEDS',
  status: 'STATUS',
}

export function iconRows(id: IconId): string[] {
  return I[id].split('/')
}
