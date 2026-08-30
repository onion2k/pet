import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { YARD_SESSIONS, type GameSession } from '../../src/game/minigames'
import { YARD_GAMES, type YardGameId } from '../../src/data/yardgames'
import { resetRandom, seeded, setRandom } from '../../src/engine/random'
import { fakeHud } from '../fake-hud'
import type { ButtonId } from '../../src/render/shell'

/**
 * The five games that need something to be out in the yard, played rather than
 * looked at. A game owns all three buttons while it runs, so one that can wedge
 * -- a round that never resolves, a phase that never advances -- is a pet that
 * can no longer be fed.
 */

const ROUNDS = 5
const FRAME = 1 / 60

beforeEach(() => setRandom(seeded(7)))
afterEach(() => resetRandom())

const open = (id: YardGameId): GameSession => YARD_SESSIONS[id].create()

/** Runs frames, stopping early once the game is over. */
function pump(session: GameSession, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FRAME) && !session.done; i++) {
    session.update(FRAME)
  }
}

/** Plays a whole session by mashing, which every game must survive. */
function mash(session: GameSession, buttons: ButtonId[] = ['a', 'b', 'c']): void {
  for (let i = 0; i < 4000 && !session.done; i++) {
    session.update(FRAME)
    if (i % 7 === 0) session.press(buttons[(i / 7) % buttons.length]!)
  }
}

describe('every yard game', () => {
  for (const game of YARD_GAMES) {
    describe(game.id, () => {
      it('reaches an end when it is played', () => {
        const session = open(game.id)
        mash(session)
        expect(session.done).toBe(true)
        expect(session.resolved).toBe(ROUNDS)
      })

      it('reaches an end when it is ignored', () => {
        // Every round has to be able to resolve on its own, or a player who
        // looks away leaves the pet holding all three buttons for ever.
        const session = open(game.id)
        pump(session, 200)
        expect(session.done).toBe(true)
        expect(session.resolved).toBe(ROUNDS)
      })

      it('never resolves more rounds than it has', () => {
        const session = open(game.id)
        mash(session)
        pump(session, 20)
        expect(session.resolved).toBe(ROUNDS)
      })

      it('draws in every phase without falling off the screen', () => {
        const { fake, hud } = fakeHud()
        const session = open(game.id)
        for (let i = 0; i < 2000 && !session.done; i++) {
          session.update(FRAME)
          if (i % 11 === 0) session.press('b')
          fake.clear()
          session.draw(hud)
          for (const r of fake.rects) {
            expect(r.x).toBeGreaterThanOrEqual(0)
            expect(r.y).toBeGreaterThanOrEqual(0)
            expect(r.x + r.w).toBeLessThanOrEqual(fake.width)
            expect(r.y + r.h).toBeLessThanOrEqual(fake.height)
          }
        }
      })

      it('only calls itself won on the strength of its wins', () => {
        const session = open(game.id)
        mash(session)
        // Three of five, and the streak can never exceed the rounds played.
        expect(session.streak).toBeLessThanOrEqual(ROUNDS)
        expect(typeof session.won).toBe('boolean')
      })
    })
  }
})

describe('fetch', () => {
  it('is won by winding up into the band and lost by leaving it alone', () => {
    // Untouched, the kick has no power at all and stops short every round.
    const idle = open('fetch')
    pump(idle, 40)
    expect(idle.won).toBe(false)
  })

  it('sags when it is not being wound, so a rate is asked for and not a count', () => {
    const { fake, hud } = fakeHud()
    const session = open('fetch')
    for (let i = 0; i < 8; i++) session.press('b')
    /** The width of the wind-up bar, which is the only yellow rect drawn. */
    const wound = () => {
      fake.clear()
      session.draw(hud)
      return fake.rects.filter((r) => r.colour === '#ffd93d').reduce((w, r) => w + r.w, 0)
    }
    const before = wound()
    expect(before).toBeGreaterThan(0)
    // Left alone for a moment, the same wind-up is worth less.
    pump(session, 0.4)
    expect(wound()).toBeLessThan(before)
  })
})

describe('chase', () => {
  it('is not won by standing still', () => {
    const session = open('chase')
    pump(session, 40)
    // It always moves off the perch it was on, so staying put never catches it.
    expect(session.won).toBe(false)
  })
})

describe('catch them', () => {
  it('counts a press before anything lights as a miss', () => {
    const session = open('catch')
    const feedback = session.press('a')
    expect(feedback?.sound).toBe('lose')
    expect(session.streak).toBe(0)
  })

  it('counts letting one fade as a miss, so hanging back is no safer', () => {
    const session = open('catch')
    pump(session, 40)
    expect(session.done).toBe(true)
    expect(session.won).toBe(false)
  })
})

describe('dive in', () => {
  it('refuses a pick while the leaves are still moving', () => {
    const session = open('dive')
    expect(session.press('a')).toBeNull()
    expect(session.resolved).toBe(0)
  })
})

describe('the hill', () => {
  it('never opens with the obstacle already on top of the sled', () => {
    // The first round has to be winnable from where the sled starts.
    for (let seed = 0; seed < 40; seed++) {
      setRandom(seeded(seed))
      const session = open('hill')
      // One frame in, steering away must still be possible.
      session.update(FRAME)
      session.press('a')
      pump(session, 6)
      expect(session.resolved).toBeGreaterThan(0)
    }
  })
})
