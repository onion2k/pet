import { describe, expect, it } from 'vitest'
import { harness, type Harness } from '../harness'
import { emptySave } from '../../src/game/save'
import { drawScreen } from '../../src/ui/draw'
import { worldAt } from '../../src/game/world'
import { fakeHud } from '../fake-hud'
import type { Mode } from '../../src/game/app'

/**
 * What the game says back.
 *
 * A refusal is an answer to a press. `say` sets the line and plays the refusing
 * blip, and for a long time the line was only ever drawn on the main screen --
 * the one with the fewest refusals in it. Everywhere else the press registered,
 * the blip played, and the screen did not change by one pixel.
 *
 * The move menu is where that finally got reported, and it is the worst case of
 * it: the cursor opens on the place the family already lives, so the very first
 * press of B -- under a line that says B GO -- is refused, silently, every time.
 * The bug report was "the B button doesn't work", which is exactly what it looks
 * like from the sofa.
 */

const world = worldAt(0)

const grownUp = (): Harness => {
  const h = harness({ random: 1, save: emptySave() }).start().growTo('adult')
  h.pet.stats.energy = 100
  return h
}

/** Everything the screen puts up, this frame. */
const onScreen = (h: Harness): string => {
  const { fake, hud } = fakeHud()
  drawScreen(hud, h.app, world)
  return fake.said()
}

describe('a refusal on the move menu', () => {
  it('is on the screen, not just in the speaker', () => {
    const h = grownUp()
    h.select('status').holdMove()
    expect(h.app.mode).toBe('move')
    // No cursor movement: this is the first thing a player presses.
    h.tap('b')
    expect(h.app.mode, 'the menu stays open on a refusal').toBe('move')
    expect(onScreen(h)).toContain('ALREADY HOME')
  })

  it('still lets the move happen once the cursor is somewhere else', () => {
    // The other half of the report: B was never broken, only unanswered.
    const h = grownUp()
    h.select('status').holdMove()
    h.tap('c')
    h.tap('b')
    h.advance(4)
    expect(h.app.biome.id).not.toBe('meadow')
  })
})

describe('a refusal anywhere else', () => {
  /**
   * Every screen a message can be set on. Driving a real refusal on each would
   * be seven setups testing one thing; what matters is that no screen drops the
   * line on the floor, so the line is put there and the screen is asked.
   */
  const SCREENS: Mode[] = ['main', 'feed', 'grounds', 'curios', 'games', 'move', 'forage']

  it('is drawn whatever screen it was said on', () => {
    const h = grownUp()
    for (const mode of SCREENS) {
      h.app.mode = mode
      h.app.message = 'TOO TIRED FOR THAT'
      h.app.messageTimer = 2
      expect(onScreen(h), mode).toContain('TOO TIRED FOR THAT')
    }
  })

  it('is gone once it has had its moment', () => {
    const h = grownUp()
    h.app.mode = 'move'
    h.app.message = 'ALREADY HOME'
    h.app.messageTimer = 0
    expect(onScreen(h)).not.toContain('ALREADY HOME')
  })
})
