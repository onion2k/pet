import { describe, expect, it } from 'vitest'
import { draw, openScreen, SCREENS } from '../screens'
import { textWidth } from '../../src/data/font'
import type { DrawnText } from '../fake-hud'
import { speciesOf } from '../../src/data/species'

/**
 * What is on each screen, and where.
 *
 * The suite is very good at asking the game about its own state and, until a
 * player reported a dead button that was not dead, asked almost nothing about
 * what reached the glass. `app.message` was right. `messageTimer` was running.
 * Nothing drew it, and every test passed.
 *
 * These are the questions a person would ask if they were looking at it: is the
 * thing I need to see actually there, does it fit on the screen, and is anything
 * sitting on top of anything else. None of them need a browser -- the game draws
 * through a hud interface, so a hud that writes things down instead of painting
 * them is the whole apparatus.
 *
 * What it still cannot see: colour, legibility, whether a layout is any good.
 * Those need eyes.
 */

/** The box a string occupies, in the screen's own pixels. */
function box(t: DrawnText) {
  const w = textWidth(t.text) * t.scale
  return {
    x1: t.centred ? t.x - w / 2 : t.x,
    x2: (t.centred ? t.x - w / 2 : t.x) + w,
    y1: t.y,
    y2: t.y + 5 * t.scale,
  }
}

const overlaps = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2

describe('every screen', () => {
  for (const mode of SCREENS) {
    describe(mode, () => {
      it('can be drawn at all', () => {
        const fake = draw(openScreen(mode))
        expect(fake.begun, 'a frame was begun').toBe(1)
        expect(fake.committed, 'and committed').toBe(1)
        expect(fake.rects.length + fake.texts.length).toBeGreaterThan(0)
      })

      it('stays on the glass', () => {
        // 192x172 of pixels and no more. Anything past the edge is a line the
        // player simply never sees, which is the quietest way to lose one.
        //
        // The ticker is the exception and the only one: it is a marquee, so it
        // starts off the right-hand edge on purpose and crawls in.
        const h = openScreen(mode)
        const crawling = h.app.tickerText
        const fake = draw(h)
        for (const r of fake.rects) {
          expect(r.x, `rect at ${r.x},${r.y}`).toBeGreaterThanOrEqual(0)
          expect(r.y, `rect at ${r.x},${r.y}`).toBeGreaterThanOrEqual(0)
          expect(r.x + r.w).toBeLessThanOrEqual(fake.width)
          expect(r.y + r.h).toBeLessThanOrEqual(fake.height)
        }
        for (const t of fake.texts) {
          if (crawling && t.text === crawling) continue
          const b = box(t)
          expect(b.x1, `"${t.text}"`).toBeGreaterThanOrEqual(0)
          expect(b.x2, `"${t.text}"`).toBeLessThanOrEqual(fake.width)
          expect(b.y1, `"${t.text}"`).toBeGreaterThanOrEqual(0)
          expect(b.y2, `"${t.text}"`).toBeLessThanOrEqual(fake.height)
        }
      })

      it('puts nothing on top of anything else', () => {
        // Rows that fit today and collide once a name gets longer or a list
        // gains an entry. The toast is the one thing allowed to sit over the
        // rest, and it is not up here -- it has its own test below.
        const fake = draw(openScreen(mode))
        const boxes = fake.texts.map((t) => ({ t, b: box(t) }))
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!
            const c = boxes[j]!
            // The same string drawn twice in a place is the renderer being
            // asked for it twice, not two things fighting.
            if (a.t.text === c.t.text && a.b.x1 === c.b.x1 && a.b.y1 === c.b.y1) continue
            expect(
              overlaps(a.b, c.b),
              `"${a.t.text}" sits on "${c.t.text}" at y=${a.b.y1}`,
            ).toBe(false)
          }
        }
      })
    })
  }
})

describe('the toast', () => {
  /**
   * The one thing that is allowed on top of the rest, because it is an answer
   * to a press and answers interrupt. What it is not allowed to be is illegible
   * or invisible.
   */
  const withMessage = (mode: (typeof SCREENS)[number]) => {
    const h = openScreen(mode)
    h.app.message = 'TOO TIRED FOR THAT'
    h.app.messageTimer = 2
    return draw(h)
  }

  for (const mode of SCREENS) {
    it(`is on the ${mode} screen when there is something to say`, () => {
      expect(withMessage(mode).said()).toContain('TOO TIRED FOR THAT')
    })
  }

  it('has something solid behind it wherever it lands', () => {
    // It overlaps whatever is under it on purpose; a panel is what makes that
    // read as a toast rather than as two lines printed on each other.
    for (const mode of SCREENS) {
      const fake = withMessage(mode)
      const said = fake.texts.find((t) => t.text === 'TOO TIRED FOR THAT')!
      const b = box(said)
      const behind = fake.rects.some(
        (r) => r.x <= b.x1 && r.y <= b.y1 && r.x + r.w >= b.x2 && r.y + r.h >= b.y2,
      )
      expect(behind, `nothing behind the toast on ${mode}`).toBe(true)
    }
  })

  it('is gone once it has had its moment', () => {
    const h = openScreen('main')
    h.app.message = 'TOO TIRED FOR THAT'
    h.app.messageTimer = 0
    expect(draw(h).said()).not.toContain('TOO TIRED FOR THAT')
  })
})

describe('what a screen is for', () => {
  /**
   * One fact per screen: the thing it exists to tell you. A screen that draws
   * its furniture and loses its content still passes everything above.
   */
  const shows = (mode: (typeof SCREENS)[number], ...must: string[]) =>
    it(`the ${mode} screen shows ${must.join(', ')}`, () => {
      const said = draw(openScreen(mode)).said()
      for (const text of must) expect(said).toContain(text)
    })

  shows('boot', 'PETZ', '9000')
  shows('name', 'NAME YOUR PET', 'B HATCH')
  shows('welcome', 'WELCOME BACK')
  shows('feed', 'FEED', 'B EAT')
  shows('grounds', 'WHERE TO?', 'B GO')
  shows('curios', 'CURIOS')
  shows('status', 'ADULT', 'FULL', 'HAPPY', 'ENERGY', 'CLEAN', 'HEALTH')
  shows('games', 'GAMES', 'B START')
  shows('retire', 'FAREWELL')
  shows('move', 'MOVE HOUSE', 'YOU LIVE HERE', 'B GO')

  it('the status screen names the pet and the form it took', () => {
    const h = openScreen('status')
    const said = draw(h).said()
    expect(said).toContain(h.pet.name)
    expect(said.toUpperCase()).toContain(speciesOf(h.pet.speciesId).name.toUpperCase())
  })

  it('the move screen names every place the family could live', () => {
    const h = openScreen('move')
    const said = draw(h).said()
    for (const biome of h.app.homes) expect(said).toContain(biome.name.toUpperCase())
  })

  it('the main screen keeps the pet in view rather than a menu', () => {
    const fake = draw(openScreen('main'))
    // Four pips down the left edge -- hunger, cheer, energy and hygiene. Health
    // is not one of them: it is shown by the pet looking ill rather than by a
    // fifth bar, so the meters stay a row of things the player can act on.
    expect(fake.meters).toHaveLength(4)
    const h = openScreen('main')
    h.pet.stats.hunger = 12
    expect(draw(h).meters.map((m) => m.value)).toContain(12)
  })
})
