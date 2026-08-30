import { describe, expect, it } from 'vitest'
import { harness, DEFAULT_START } from '../harness'
import { emptySave } from '../../src/game/save'
import { isPresent, withinHours } from '../../src/game/visitors'
import { DAY_MS, seasonIdAt, worldHour } from '../../src/game/world'
import { YARD_GAMES, yardGameById } from '../../src/data/yardgames'
import { PLAY_MIN_ENERGY } from '../../src/game/app'

/**
 * Playing with what is out in the yard. The part worth testing is not the game
 * itself but the seam: a menu whose length depends on the weather, on a day the
 * player cannot choose, which has to stay navigable when the yard empties.
 */

const fetch = yardGameById('fetch')

/**
 * A world offset that puts the ball in the yard, and one that leaves nothing
 * out there at all. Stepping in whole days keeps the hour where it started,
 * which matters: a visitor that keeps to a window is only offered inside it.
 */
function offsetWith(ball: boolean): number {
  for (let day = 0; day < 4000; day++) {
    const offset = day * DAY_MS
    const at = DEFAULT_START + offset
    const worldDay = Math.floor(at / DAY_MS)
    const season = seasonIdAt(at)
    const hour = worldHour(at)
    const out = YARD_GAMES.filter(
      (g) => isPresent(g.visitor, worldDay, season, []) && withinHours(g.visitor, hour),
    )
    if (ball ? out.some((g) => g.id === 'fetch') : out.length === 0) return offset
  }
  throw new Error(`no day with ${ball ? 'the ball out' : 'an empty yard'}`)
}

const withBall = () =>
  harness({ save: { ...emptySave(), worldOffset: offsetWith(true) } })
    .start()
    .growTo('child')

const withEmptyYard = () =>
  harness({ save: { ...emptySave(), worldOffset: offsetWith(false) } })
    .start()
    .growTo('child')

describe('the play menu', () => {
  it('offers fetch when the ball is out there', () => {
    const h = withBall()
    expect(h.app.inTheYard).toContain('ball')
    expect(h.app.playMenu[0]).toMatchObject({ kind: 'yard', game: { id: 'fetch' } })
  })

  it('offers only the three when the yard is empty', () => {
    const h = withEmptyYard()
    expect(h.app.playMenu.every((o) => o.kind === 'plain')).toBe(true)
  })

  it('never leaves PLAY an empty menu', () => {
    expect(withEmptyYard().app.playMenu.length).toBeGreaterThan(0)
  })

  it('puts what will not be there tomorrow first', () => {
    const menu = withBall().app.playMenu
    const lastYard = menu.map((o) => o.kind).lastIndexOf('yard')
    const firstPlain = menu.map((o) => o.kind).indexOf('plain')
    expect(lastYard).toBeLessThan(firstPlain)
  })

  it('wraps on the menu it actually has, not on the three', () => {
    const h = withBall()
    h.select('play')
    const length = h.app.playMenu.length
    h.tap('a')
    expect(h.app.gameIndex).toBe(length - 1)
    h.tap('c')
    expect(h.app.gameIndex).toBe(0)
  })

  it('brings a selection left over from a busier day back inside the menu', () => {
    const h = withBall()
    h.select('play')
    // Right to the end of a full menu, then out to a yard with nothing in it.
    while (h.app.gameIndex < h.app.playMenu.length - 1) h.tap('c')
    const wasAt = h.app.gameIndex
    h.holdBack()
    h.app.debugWorldOffset = offsetWith(false) - h.app.worldOffset
    h.select('play')
    expect(h.app.gameIndex).toBeLessThan(h.app.playMenu.length)
    expect(h.app.gameIndex).toBeLessThanOrEqual(wasAt)
    expect(() => h.tap('b')).not.toThrow()
  })
})

describe('playing fetch', () => {
  const start = () => {
    const h = withBall()
    h.select('play')
    h.tap('b')
    return h
  }

  /**
   * Plays a game to the end, whichever game it is. What the rounds come out as
   * is not the point here -- only that they resolve, and what that is recorded
   * as. The three buttons are pressed in turn because a yard game answers to B
   * and the abstract ones to A and C.
   */
  const playOut = (h: ReturnType<typeof withBall>, limit = 80) => {
    for (let i = 0; i < limit && h.app.mode === 'playing'; i++) {
      h.frames(6)
      h.tap((['a', 'b', 'c'] as const)[i % 3]!)
      h.advance(1.2)
    }
    return h
  }

  it('starts the fetch session', () => {
    const h = start()
    expect(h.app.mode).toBe('playing')
    expect(h.app.session?.id).toBe('fetch')
  })

  it('counts toward the axis it is, and costs what it says', () => {
    const h = start()
    const before = h.pet.stats.energy
    playOut(h)
    expect(h.app.mode).toBe('main')
    expect(h.pet.play.byAxis.chase).toBe(1)
    expect(h.pet.play.gamesPlayed).toBe(1)
    // The ordinary tiring, plus the trip out to the ball.
    expect(before - h.pet.stats.energy).toBeGreaterThan(fetch.energy)
  })

  it('counts a game given up part-way, and still charges for it', () => {
    const h = start()
    h.frames(6).tap('b')
    h.until('a round to resolve', () => (h.app.session?.resolved ?? 0) > 0, 5, 0.05)
    h.holdBack()
    expect(h.pet.play.byAxis.chase).toBe(1)
    expect(h.pet.play.gamesWon).toBe(0)
  })

  it('leaves the abstract three out of the axes', () => {
    const h = withEmptyYard()
    h.select('play')
    h.tap('b')
    playOut(h)
    expect(h.app.mode).toBe('main')
    expect(h.pet.play.gamesPlayed).toBe(1)
    expect(h.pet.play.byAxis).toEqual({ chase: 0, romp: 0, quiet: 0 })
  })
})

describe('the read on the day', () => {
  it('is fair for a game that does not mind the weather', () => {
    // Fetch wants nothing in particular, so it is never a bad day for it --
    // which is what makes it the dependable one, as the near ground is.
    expect(withBall().app.playProspect(fetch)).toBe('fair')
  })
})

describe('the pet mentioning what is out there', () => {
  /** Every line the ticker shows over a good long stretch. */
  const linesOver = (h: ReturnType<typeof withBall>, seconds = 600) => {
    const seen = new Set<string>()
    for (let i = 0; i < seconds * 4; i++) {
      h.advance(0.25)
      if (h.app.tickerText) seen.add(h.app.tickerText)
    }
    return [...seen]
  }

  const mentionsBall = (lines: string[]) => lines.some((l) => l.includes('BALL'))

  it('asks about the ball while it is out there', () => {
    expect(mentionsBall(linesOver(withBall()))).toBe(true)
  })

  it('says nothing about a yard it has nothing in', () => {
    expect(mentionsBall(linesOver(withEmptyYard()))).toBe(false)
  })

  it('stops asking once you have taken the hint', () => {
    const h = withBall()
    h.select('play')
    h.tap('b')
    // Started and abandoned still counts: the pet asked and you went out.
    h.frames(6)
    h.holdBack()
    expect(mentionsBall(linesOver(h))).toBe(false)
  })

  it('never asks for a game the PLAY icon would refuse', () => {
    // The pet asking for something it is then told it is too tired for is the
    // one way this line can actively mislead.
    const h = withBall()
    h.pet.stats.energy = PLAY_MIN_ENERGY - 1
    expect(mentionsBall(linesOver(h))).toBe(false)
  })

  it('says nothing while the pet is asleep', () => {
    // Held asleep rather than set once: the simulation rightly wakes a pet put
    // to bed in broad daylight with a full tank, within a couple of seconds.
    const h = withBall()
    const seen = new Set<string>()
    for (let i = 0; i < 2400; i++) {
      h.pet.asleep = true
      h.advance(0.25)
      if (h.app.tickerText) seen.add(h.app.tickerText)
    }
    expect(mentionsBall([...seen])).toBe(false)
  })

  it('leaves room for everything else the ticker has to say', () => {
    // One line even when the yard is full, or a busy day buries the weather,
    // the streak and the pet's own thoughts under a run of invitations.
    const lines = linesOver(withBall())
    const invitations = lines.filter((l) => mentionsBall([l]))
    expect(invitations.length).toBeLessThan(lines.length / 2)
  })
})
