/**
 * A voxel model is a stack of ASCII layers, bottom layer first. Within a layer,
 * the first row is the back of the pet and the last row is its face; within a
 * row, characters run left to right. `.` is empty air, anything else indexes
 * into the model's palette.
 */
export interface VoxelModel {
  /** Palette character -> `#rrggbb`. */
  palette: Record<string, string>
  /** Characters that should glow and feed the bloom pass. */
  emissive?: string[]
  /** Characters belonging to the head, which animates independently of the body. */
  head?: string[]
  /** Characters belonging to limbs, which get the walk cycle. */
  limbs?: string[]
  layers: string[][]
}

/** Turns an indented template literal into rows, so models stay readable in source. */
export function rows(block: string): string[] {
  return block
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
}
