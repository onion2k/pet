/** 8x8 menu glyphs, printed around the screen bezel like a real handheld. */
export type IconId = 'feed' | 'play' | 'sleep' | 'clean' | 'medicine' | 'forage' | 'status'

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
  forage: [
    '...##...',
    '..####..',
    '.##..##.',
    '##....##',
    '##....##',
    '.##..##.',
    '..####..',
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

export const ICON_ORDER: IconId[] = ['feed', 'play', 'clean', 'forage', 'medicine', 'sleep', 'status']

export const ICON_LABEL: Record<IconId, string> = {
  feed: 'FEED',
  play: 'PLAY',
  sleep: 'SLEEP',
  clean: 'CLEAN',
  medicine: 'MEDS',
  forage: 'FORAGE',
  status: 'STATUS',
}

export function iconRows(id: IconId): string[] {
  return I[id].split('/')
}
