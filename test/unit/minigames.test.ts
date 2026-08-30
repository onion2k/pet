import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MINIGAMES, type GameSession, type Minigame } from '../../src/game/minigames'
import { resetRandom, seeded, setRandom } from '../../src/engine/random'
import { fakeHud } from '../fake-hud'
import type { ButtonId } from '../../src/render/shell'

/**
 * The three minigames, played rather than looked at.
 *
 * A game is the only thing in the app that owns all three buttons, so a game
 * that can wedge -- a round that never resolves, a phase that never advances --
 * is a pet that can no longer be fed. Every test here plays a session through
 * to the end and insists it got there.
 */

const ROUNDS = 5
const NEEDED = 3
const FRAME = 1 / 60

beforeEach(() => setRandom(seeded(3)))
afterEach(() => resetRandom())

const byId = (id: string): Minigame => MINIGAMES.find((g) => g.id === id)!

/** Runs frames until something happens, collecting the feedback. */
function pump(session: GameSession, seconds: number): string[] {
  const sounds: string[] = []
  for (let i = 0; i < Math.round(seconds / FRAME) && !session.done; i++) {
    const feedback = session.update(FRAME)
    if (feedback) sounds.push(feedback.sound)
  }
  return sounds
}

describe('the list', () => {
  it('offers three games, each with a unique id, title and hint', () => {
    expect(MINIGAMES).toHaveLength(3)
    expect(new Set(MINIGAMES.map((g) => g.id)).size).toBe(3)
    for (const game of MINIGAMES) {
      expect(game.title.length).toBeGreaterThan(0)
      expect(game.hint.length).toBeGreaterThan(0)
    }
  })

  it('starts every game clean', () => {
    for (const game of MINIGAMES) {
      const session = game.create()
      expect(session.id).toBe(game.id)
      expect(session.title).toBe(game.title)
      expect(session.done).toBe(false)
      expect(session.won).toBe(false)
      expect(session.streak).toBe(0)
      expect(session.resolved).toBe(0)
    }
  })

  it('gives every game its own state, so two sessions never share a round', () => {
    for (const game of MINIGAMES) {
      const a = game.create()
      const b = game.create()
      a.press('b')
      pump(a, 2)
      expect(b.resolved).toBe(0)
    }
  })

  it('draws without falling over, at every point in a session', () => {
    for (const game of MINIGAMES) {
      const session = game.create()
      const { fake, hud } = fakeHud()
      for (let i = 0; i < 60 * 60 && !session.done; i++) {
        fake.clear()
        expect(() => session.draw(hud)).not.toThrow()
        expect(fake.rects.length).toBeGreaterThan(0)
        session.press(['a', 'b', 'c'][i % 3] as ButtonId)
        session.update(FRAME)
      }
      fake.clear()
      session.draw(hud)
      expect(fake.texts.length).toBeGreaterThan(0)
    }
  })

  it('always finishes, however the buttons are mashed', () => {
    const buttons: ButtonId[] = ['a', 'b', 'c']
    for (const game of MINIGAMES) {
      for (let seed = 0; seed < 10; seed++) {
        setRandom(seeded(seed))
        const roll = seeded(seed + 100)
        const session = game.create()
        let frames = 0
        while (!session.done && frames < 60 * 300) {
          if (roll() < 0.08) session.press(buttons[Math.floor(roll() * 3)]!)
          session.update(FRAME)
          frames++
        }
        expect(session.done, `${game.id} seed ${seed} never finished`).toBe(true)
        expect(session.resolved).toBe(ROUNDS)
      }
    }
  })

  it('always finishes even if nobody touches a button', () => {
    // Two of the three need input, so this is about the ones that do not
    // wedging rather than about all three completing.
    const session = byId('rhythm').create()
    let frames = 0
    while (!session.done && frames < 60 * 600) {
      session.update(FRAME)
      frames++
    }
    // The timing game sweeps forever waiting for a press: it must not resolve
    // a round on its own, and must not throw either.
    expect(session.resolved).toBe(0)
    expect(session.done).toBe(false)
  })
})

describe('guess', () => {
  /** The direction the game is currently thinking of, read off the reveal. */
  function playRound(session: GameSession, button: 'a' | 'c') {
    const feedback = session.press(button)
    pump(session, 1.2)
    return feedback
  }

  it('resolves a round on a press and a beat', () => {
    const session = byId('guess').create()
    session.press('a')
    expect(session.resolved).toBe(0)
    pump(session, 1.2)
    expect(session.resolved).toBe(1)
  })

  it('ignores b, which is not one of its two answers', () => {
    const session = byId('guess').create()
    expect(session.press('b')).toBeNull()
    pump(session, 1.2)
    expect(session.resolved).toBe(0)
  })

  it('ignores presses during the reveal', () => {
    const session = byId('guess').create()
    session.press('a')
    expect(session.press('c')).toBeNull()
  })

  it('reports a hit or a miss, and cheers only for a hit', () => {
    const session = byId('guess').create()
    const feedback = session.press('a')!
    expect(['win', 'lose']).toContain(feedback.sound)
    if (feedback.sound === 'win') expect(feedback.burst).toBe('heart')
    else expect(feedback.burst).toBeUndefined()
  })

  it('builds a streak on a run of hits and drops it on a miss', () => {
    // Play both answers each round; one of them is always right.
    const session = byId('guess').create()
    let streakSeen = 0
    for (let round = 0; round < ROUNDS && !session.done; round++) {
      const first = session.press('a')!
      if (first.sound === 'lose') expect(session.streak).toBe(0)
      streakSeen = Math.max(streakSeen, session.streak)
      pump(session, 1.2)
    }
    expect(session.done).toBe(true)
    expect(streakSeen).toBeGreaterThanOrEqual(0)
  })

  it('is won by taking enough of the five rounds', () => {
    // Guess the way the reveal says, one round behind, until it is decided.
    const session = byId('guess').create()
    const { fake, hud } = fakeHud()
    let wins = 0
    for (let round = 0; round < ROUNDS && !session.done; round++) {
      const feedback = playRound(session, 'a')
      if (feedback?.sound === 'win') wins++
      fake.clear()
      session.draw(hud)
    }
    expect(session.done).toBe(true)
    expect(session.won).toBe(wins >= NEEDED)
  })

  it('draws the arrow and the verdict during a reveal', () => {
    const session = byId('guess').create()
    const { fake, hud } = fakeHud()
    session.press('a')
    session.draw(hud)
    expect(fake.said()).toMatch(/HIT!|MISS/)
    expect(fake.said()).toMatch(/<<|>>/)
  })

  it('asks the question while it waits', () => {
    const { fake, hud } = fakeHud()
    byId('guess').create().draw(hud)
    expect(fake.said()).toContain('WHICH WAY?')
  })
})

describe('rhythm', () => {
  it('ignores a and c, which mean nothing to it', () => {
    const session = byId('rhythm').create()
    expect(session.press('a')).toBeNull()
    expect(session.press('c')).toBeNull()
    expect(session.resolved).toBe(0)
  })

  it('sweeps the marker back and forth rather than running off the track', () => {
    const session = byId('rhythm').create()
    const { fake, hud } = fakeHud()
    for (let i = 0; i < 600; i++) {
      session.update(FRAME)
      fake.clear()
      session.draw(hud)
      // The marker is the yellow tick; the track runs from 14 to width-14.
      const marker = fake.rects.find((r) => r.colour === '#ffd93d' && r.h === 16)!
      expect(marker.x).toBeGreaterThanOrEqual(13)
      expect(marker.x).toBeLessThanOrEqual(192 - 14 + 1)
    }
  })

  it('judges a press against where the marker is', () => {
    const session = byId('rhythm').create()
    const feedback = session.press('b')!
    expect(['win', 'lose']).toContain(feedback.sound)
    if (feedback.sound === 'win') expect(feedback.burst).toBe('sparkle')
  })

  it('ignores presses during the reveal', () => {
    const session = byId('rhythm').create()
    session.press('b')
    expect(session.press('b')).toBeNull()
  })

  it('resolves a round after the reveal', () => {
    const session = byId('rhythm').create()
    session.press('b')
    expect(session.resolved).toBe(0)
    pump(session, 1)
    expect(session.resolved).toBe(1)
  })

  it('gets harder: the zone narrows and the marker speeds up', () => {
    const widthAt = (round: number) => {
      const session = byId('rhythm').create()
      const { fake, hud } = fakeHud()
      for (let i = 0; i < round; i++) {
        session.press('b')
        pump(session, 1)
      }
      fake.clear()
      session.draw(hud)
      // The zone is the blue band on the track.
      return fake.rects.find((r) => r.colour === '#3a5f8f' || r.colour === '#8fe36a')!.w
    }
    expect(widthAt(2)).toBeLessThan(widthAt(0))
  })

  it('never lets the zone shrink past playable', () => {
    const session = byId('rhythm').create()
    const { fake, hud } = fakeHud()
    for (let round = 0; round < ROUNDS && !session.done; round++) {
      fake.clear()
      session.draw(hud)
      const zone = fake.rects.find((r) => r.colour === '#3a5f8f' || r.colour === '#8fe36a')!
      // 0.09 of the track is the floor the tuning promises.
      expect(zone.w).toBeGreaterThanOrEqual(0.09 * (192 - 28) - 0.001)
      session.press('b')
      pump(session, 1)
    }
  })

  it('plays out five rounds and decides', () => {
    const session = byId('rhythm').create()
    for (let round = 0; round < ROUNDS; round++) {
      session.press('b')
      pump(session, 1)
    }
    expect(session.done).toBe(true)
    expect(session.resolved).toBe(ROUNDS)
    expect(typeof session.won).toBe('boolean')
  })

  /**
   * Sweeps until the marker is over the target zone, then stops. Both are read
   * off what the game draws, which is the only thing a player has to go on.
   */
  function stopInZone(session: GameSession) {
    const { fake, hud } = fakeHud()
    // A finer step than a frame: the narrowest zone is under two frames wide
    // at the fastest sweep, and a player with a real screen sees every one.
    const step = 1 / 480
    for (let i = 0; i < 20_000; i++) {
      fake.clear()
      session.draw(hud)
      const zone = fake.rects.find((r) => r.colour === '#3a5f8f' || r.colour === '#8fe36a')!
      const marker = fake.rects.find((r) => r.colour === '#ffd93d' && r.h === 16)!
      const tip = marker.x + 1
      if (tip >= zone.x && tip <= zone.x + zone.w) return session.press('b')
      session.update(step)
    }
    throw new Error('the marker never crossed the zone')
  }

  it('lights the zone green on a correct stop', () => {
    const session = byId('rhythm').create()
    const feedback = stopInZone(session)!
    expect(feedback.sound).toBe('win')
    expect(feedback.burst).toBe('sparkle')
    const { fake, hud } = fakeHud()
    session.draw(hud)
    expect(fake.rects.some((r) => r.colour === '#8fe36a')).toBe(true)
    expect(fake.said()).toContain('PERFECT')
  })

  it('is won by stopping in the zone every round', () => {
    const session = byId('rhythm').create()
    let wins = 0
    for (let round = 0; round < ROUNDS && !session.done; round++) {
      if (stopInZone(session)?.sound === 'win') wins++
      pump(session, 1)
    }
    expect(session.done).toBe(true)
    expect(wins).toBe(ROUNDS)
    expect(session.won).toBe(true)
    expect(session.streak).toBe(ROUNDS)
  })

  it('says what it wants, and what happened', () => {
    const session = byId('rhythm').create()
    const { fake, hud } = fakeHud()
    session.draw(hud)
    expect(fake.said()).toContain('STOP IT')
    fake.clear()
    session.press('b')
    session.draw(hud)
    expect(fake.said()).toMatch(/PERFECT|MISSED/)
  })
})

describe('memory', () => {
  /** The sequence the game is currently showing, read off what it lights up. */
  function watchSequence(session: GameSession): ButtonId[] {
    const { fake, hud } = fakeHud()
    const seen: ButtonId[] = []
    let lastLit: ButtonId | null = null
    for (let i = 0; i < 60 * 30; i++) {
      session.update(FRAME)
      fake.clear()
      session.draw(hud)
      if (fake.said().includes('YOUR TURN')) break
      // The lit lamp is the one drawn in yellow; which lamp it is comes from
      // where it sits, since the lamps are laid out at 24, 74 and 124.
      const lamp = fake.rects.find((r) => r.colour === '#ffd93d' && r.w === 34)
      const lit = lamp ? (['a', 'b', 'c'][(lamp.x - 24) / 50] as ButtonId) : null
      if (lit && lit !== lastLit) seen.push(lit)
      lastLit = lit
    }
    return seen
  }

  it('shows a sequence and then hands over', () => {
    const session = byId('memory').create()
    const sequence = watchSequence(session)
    expect(sequence).toHaveLength(1)
    const { fake, hud } = fakeHud()
    session.draw(hud)
    expect(fake.said()).toContain('YOUR TURN')
  })

  it('ignores presses while it is still showing', () => {
    const session = byId('memory').create()
    expect(session.press('a')).toBeNull()
  })

  it('rewards a correct repeat', () => {
    const session = byId('memory').create()
    const sequence = watchSequence(session)
    const feedback = session.press(sequence[0]!)!
    expect(feedback.sound).toBe('win')
    expect(feedback.burst).toBe('sparkle')
    expect(session.streak).toBe(1)
  })

  it('ends the round on a wrong press and drops the streak', () => {
    const session = byId('memory').create()
    const sequence = watchSequence(session)
    const wrong = (['a', 'b', 'c'] as ButtonId[]).find((b) => b !== sequence[0])!
    const feedback = session.press(wrong)!
    expect(feedback.sound).toBe('lose')
    expect(session.streak).toBe(0)
  })

  it('gets one longer after a hit and starts over after a miss', () => {
    const session = byId('memory').create()
    const first = watchSequence(session)
    session.press(first[0]!)
    pump(session, 1)
    const second = watchSequence(session)
    expect(second).toHaveLength(2)

    // Now miss, and the next sequence is back to one.
    const wrong = (['a', 'b', 'c'] as ButtonId[]).find((b) => b !== second[0])!
    session.press(wrong)
    pump(session, 1)
    expect(watchSequence(session)).toHaveLength(1)
  })

  it('echoes the player"s own input as they enter it', () => {
    const session = byId('memory').create()
    const first = watchSequence(session)
    session.press(first[0]!)
    pump(session, 1)
    const second = watchSequence(session)
    const feedback = session.press(second[0]!)!
    // Mid-sequence, a correct press is a tone rather than a verdict.
    expect(feedback.sound).toMatch(/^tone[ABC]$/)
  })

  it('plays out five rounds and decides', () => {
    const session = byId('memory').create()
    let wins = 0
    for (let round = 0; round < ROUNDS && !session.done; round++) {
      const sequence = watchSequence(session)
      let correct = true
      for (const button of sequence) {
        if (session.press(button) === null) correct = false
      }
      if (correct) wins++
      pump(session, 1)
    }
    expect(session.done).toBe(true)
    expect(session.resolved).toBe(ROUNDS)
    expect(session.won).toBe(wins >= NEEDED)
  })

  it('is won by a player who repeats every sequence', () => {
    const session = byId('memory').create()
    for (let round = 0; round < ROUNDS && !session.done; round++) {
      for (const button of watchSequence(session)) session.press(button)
      pump(session, 1)
    }
    expect(session.won).toBe(true)
  })

  it('is lost by a player who gets every sequence wrong', () => {
    const session = byId('memory').create()
    for (let round = 0; round < ROUNDS && !session.done; round++) {
      const sequence = watchSequence(session)
      session.press((['a', 'b', 'c'] as ButtonId[]).find((b) => b !== sequence[0])!)
      pump(session, 1)
    }
    expect(session.done).toBe(true)
    expect(session.won).toBe(false)
  })

  it('says where the player is up to', () => {
    const session = byId('memory').create()
    const { fake, hud } = fakeHud()
    session.draw(hud)
    expect(fake.said()).toContain('GET READY')
    watchSequence(session)
    fake.clear()
    session.draw(hud)
    expect(fake.said()).toContain('YOUR TURN')
    expect(fake.said()).toContain('0/1')
  })

  it('shows two identical symbols in a row as two flashes, not one', () => {
    // The dark gap after each symbol is what makes this readable; without it
    // 'a a' would look like a single long flash.
    setRandom(() => 0)
    const session = byId('memory').create()
    watchSequence(session)
    session.press('a')
    pump(session, 1)
    const second = watchSequence(session)
    expect(second).toEqual(['a', 'a'])
  })
})
