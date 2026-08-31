import { expect } from 'vitest'
import { harness, type Harness } from './harness'
import { emptySave } from '../src/game/save'
import { drawScreen } from '../src/ui/draw'
import { worldAt } from '../src/game/world'
import { fakeHud } from './fake-hud'
import type { Mode } from '../src/game/app'

/**
 * Getting to a screen, and reading what is on it.
 *
 * Shared because two files want the same fourteen fixtures and neither should
 * own them: one asks what the buttons do there, the other asks what is drawn.
 * Every screen is reached the way a player reaches it -- real presses, real
 * frames -- so a screen that becomes unreachable fails here rather than being
 * quietly tested from a state nobody can get into.
 */

/** A fixed sky, so a drawn screen never depends on the weather. */
export const WORLD = worldAt(0)

/** A grown pet in a known place, with the energy for anything. */
export function grownUp(): Harness {
  const h = harness({ random: 1, save: emptySave() }).start().growTo('adult')
  h.pet.stats.energy = 100
  return h
}

/** Puts a pet in front of the named screen, and insists it got there. */
export function openScreen(mode: Mode): Harness {
  const h = reach(mode)
  expect(h.app.mode, `should have reached the ${mode} screen`).toBe(mode)
  return h
}

function reach(mode: Mode): Harness {
  switch (mode) {
    case 'boot':
      return harness({ random: 1, save: emptySave() })
    case 'name':
      return harness({ random: 1, save: emptySave() }).boot()
    case 'welcome':
      // Long enough to count as an absence, short enough not to age the pet
      // into an evolution -- an egg is forty-five seconds old when it hatches.
      return grownUp().closeFor(6 * 60_000).frame()
    case 'main':
      return grownUp()
    case 'feed':
      return grownUp().select('feed')
    case 'grounds':
      return grownUp().select('forage')
    case 'forage': {
      const h = grownUp().select('forage')
      h.tap('b')
      return h.until('the trip to be asking', () => h.app.forageChoosing, 60)
    }
    case 'curios':
      return grownUp().select('status').tap('a')
    case 'status':
      return grownUp().select('status')
    case 'games':
      return grownUp().select('play')
    case 'playing': {
      const h = grownUp().select('play')
      h.tap('b')
      return h
    }
    case 'evolve': {
      // The one screen that arrives rather than being opened.
      const h = harness({ random: 1, save: emptySave() }).start()
      h.ripen()
      return h
    }
    case 'retire': {
      const h = grownUp().select('status')
      h.holdRetire()
      return h
    }
    case 'move': {
      const h = grownUp().select('status')
      h.holdMove()
      return h
    }
  }
}

/** Every screen there is, so a sweep cannot quietly miss one. */
export const SCREENS: Mode[] = [
  'boot',
  'name',
  'welcome',
  'main',
  'feed',
  'grounds',
  'forage',
  'curios',
  'status',
  'games',
  'playing',
  'evolve',
  'retire',
  'move',
]

/** One frame of a screen, recorded rather than drawn. */
export function draw(h: Harness): ReturnType<typeof fakeHud>['fake'] {
  const { fake, hud } = fakeHud()
  drawScreen(hud, h.app, WORLD)
  return fake
}
