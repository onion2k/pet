import { MINIGAMES, type GameSession } from '../game/minigames'
import { iconRows, type IconId } from '../data/icons'
import { PixelCanvas } from '../render/pixels'

/**
 * Pictures of the screen, drawn by the screen's own code.
 *
 * A minigame in the booklet is a real `GameSession`, wound forward a few frames
 * and asked to draw itself onto a canvas the same 192x172 as the glass. So the
 * illustration cannot drift from the game: change the game and the instructions
 * change with it.
 */

const SCREEN_W = 192
const SCREEN_H = 172

/** The meadow behind the panels, in the few flat bands it reads as at this size. */
function meadow(screen: PixelCanvas): void {
  screen.rect(0, 0, SCREEN_W, SCREEN_H, '#8ed8f0')
  screen.rect(0, 40, SCREEN_W, 14, '#a7e4f5')
  screen.rect(0, 54, SCREEN_W, SCREEN_H - 54, '#6fbf52')
  screen.rect(0, 54, SCREEN_W, 6, '#8ade60')
  // A scatter of grass, so the ground is not a flat slab behind the panels.
  for (let i = 0; i < 46; i++) {
    const x = (i * 37 + 11) % SCREEN_W
    const y = 62 + ((i * 23) % 70)
    screen.rect(x, y, 2, 3, i % 3 === 0 ? '#5aa843' : '#7ecf58')
  }
  // The sun, sitting where the backdrop puts it on a clear morning.
  screen.rect(150, 22, 10, 10, '#ffe9a0')
  screen.rect(152, 20, 6, 14, '#ffe9a0')
}

/** Scales a screen canvas up on the page without smoothing away its pixels. */
function present(screen: PixelCanvas, scale: number): HTMLCanvasElement {
  const canvas = screen.canvas
  canvas.style.width = `${SCREEN_W * scale}px`
  canvas.style.height = `${SCREEN_H * scale}px`
  canvas.className = 'screenshot'
  return canvas
}

/** How each game is wound on, so its picture catches it mid-play rather than
 *  on a blank first frame. */
const REHEARSALS: Record<string, (session: GameSession) => void> = {
  guess: (session) => {
    // Two rounds called correctly or not, then caught in the third, asking.
    session.press('a')
    session.update(1)
    session.press('c')
    session.update(1)
  },
  rhythm: (session) => {
    // Far enough along that the marker is out over the middle of the track.
    for (let i = 0; i < 26; i++) session.update(1 / 60)
  },
  memory: (session) => {
    // Past the lead-in, so a lamp is lit and the sequence is playing.
    for (let i = 0; i < 66; i++) session.update(1 / 60)
  },
}

/** One game's screen, mid-play. */
export function gameScreen(id: string, scale = 2): HTMLCanvasElement {
  const game = MINIGAMES.find((g) => g.id === id)
  const screen = new PixelCanvas(SCREEN_W, SCREEN_H)
  meadow(screen)
  if (game) {
    const session = game.create()
    REHEARSALS[id]?.(session)
    session.draw(screen)
  }
  return present(screen, scale)
}

/** An 8x8 piece of the game's own artwork — a menu icon or a curio — blown up. */
export function artTile(rows: string[], colour: string, scale = 6): HTMLCanvasElement {
  const tile = new PixelCanvas(8, 8)
  tile.glyph(0, 0, rows, colour)
  const canvas = tile.canvas
  canvas.style.width = `${8 * scale}px`
  canvas.style.height = `${8 * scale}px`
  canvas.className = 'art-tile'
  return canvas
}

export const iconTile = (id: IconId, colour: string, scale = 6): HTMLCanvasElement =>
  artTile(iconRows(id), colour, scale)

/** Words in the game's own 3x5 font, for headings that should look like the screen. */
export function pixelWord(text: string, colour: string, scale = 1, display = 6): HTMLCanvasElement {
  const width = text.length * 4 * scale
  const surface = new PixelCanvas(width, 5 * scale + 1)
  surface.text(0, 0, text, colour, scale)
  const canvas = surface.canvas
  canvas.style.width = `${width * display}px`
  canvas.style.height = `${(5 * scale + 1) * display}px`
  canvas.className = 'pixel-word'
  return canvas
}
