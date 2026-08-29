/**
 * A voxel model is a stack of ASCII layers, bottom layer first. Within a layer,
 * the first row is the back of the pet and the last row is its face; within a
 * row, characters run left to right. `.` is empty air, anything else indexes
 * into the model's palette.
 *
 * Most creatures are bilaterally symmetric, so a model may instead give only
 * the left half of each row plus the centre column and set `mirror`. That
 * halves the data and makes symmetry structural rather than something to get
 * right by hand.
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
  /** Rows hold the left half plus the centre column, mirrored to full width. */
  mirror?: boolean
  layers: string[][]
}

/** Turns an indented template literal into rows, so models stay readable in source. */
export function rows(block: string): string[] {
  return block
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
}

/**
 * Expands a half-row to full width. The last character is the centre column and
 * is not duplicated, so `abcdef` becomes `abcdefedcba`.
 */
export function mirrorRow(half: string): string {
  if (half.length === 0) return half
  let out = half
  for (let i = half.length - 2; i >= 0; i--) out += half[i]
  return out
}

/** The model's layers at full width, with any mirroring already applied. */
export function expandLayers(model: VoxelModel): string[][] {
  if (!model.mirror) return model.layers
  return model.layers.map((layer) => layer.map(mirrorRow))
}
