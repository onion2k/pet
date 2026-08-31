import type { WeatherId } from './seasons'
import type { VisitorId, VisitorRole } from './visitors'
import type { Stage } from '../game/types'

/**
 * Games that need something to be out there.
 *
 * PLAY was the one lever that read nothing. Feeding swings with the season and
 * steers the diet axes; foraging reads the ground against the day. Playing was
 * the same three abstract games in July and January, and the yard it happened
 * in went unmentioned -- visitors were announced on the ticker and then were
 * scenery. A yard game is the fix: what is out there today is what there is to
 * do today.
 *
 * A game must not restate its visitor's season. Whether the toy is in the yard
 * already carries the months it turns up in, so saying so again would make the
 * read on the menu a tautology that always looks promising. What a game wants
 * is the part presence does not already settle: the weather, and the hour.
 */

export type YardGameId = 'fetch' | 'chase' | 'dive' | 'hill' | 'catch'

/**
 * What sort of play it is. Counted like the diet axes, so how a pet was played
 * with can lean the same way what it was fed does.
 */
export type PlayAxis = 'chase' | 'romp' | 'quiet'

/**
 * What has to be out there for a game to be on the menu: either one particular
 * thing, or whoever fills a role here.
 *
 * Three of the five are already scarce by season -- leaves in autumn, a sled in
 * winter, something flitting in spring and summer. Gating them by place as well
 * would leave a player with a healthy adult and nothing to do, so a game that
 * wants a creature asks for the *role* and lets the biome say who fills it. The
 * wood has a moth where the meadow has a butterfly, and CHASE is playable in
 * both. It is the same trick the props play with their palette characters.
 */
export type YardGameNeed = { visitor: VisitorId } | { role: VisitorRole }

export interface YardGame {
  id: YardGameId
  /** What has to be in the yard for this to be on the menu. */
  needs: YardGameNeed
  title: string
  /** Shown under the title, in the feed and forage menus' voice. */
  note: string
  /** The hint line the session carries along its footer. */
  hint: string
  /** The stage the pet has to have reached to play it. */
  from: Stage
  /** What a run costs in energy. */
  energy: number
  /** The weather it wants. Absent means it does not mind. */
  weather?: WeatherId[]
  axis: PlayAxis
}

export const YARD_GAMES: YardGame[] = [
  {
    id: 'fetch',
    needs: { role: 'toy' },
    title: 'FETCH',
    note: 'Send it, and call it back.',
    hint: 'B TO WIND UP',
    // A baby can be played with; the ball only needs a shove.
    from: 'baby',
    energy: 4,
    axis: 'chase',
  },
  {
    id: 'chase',
    needs: { role: 'flitter' },
    title: 'CHASE',
    note: 'It will not sit still.',
    hint: 'A/C MOVE',
    from: 'child',
    energy: 6,
    // A butterfly is not out in the rain, and a mist is no good for following
    // one about either.
    weather: ['clear'],
    axis: 'chase',
  },
  {
    id: 'dive',
    needs: { visitor: 'leafpile' },
    title: 'DIVE IN',
    note: 'Best while they are dry.',
    hint: 'A/B/C PICK',
    from: 'baby',
    energy: 5,
    weather: ['clear', 'mist'],
    axis: 'romp',
  },
  {
    id: 'hill',
    needs: { visitor: 'sled' },
    title: 'THE HILL',
    note: 'A climb, then the quick way down.',
    hint: 'A/C STEER',
    from: 'child',
    energy: 8,
    weather: ['snow'],
    axis: 'romp',
  },
  {
    id: 'catch',
    needs: { role: 'glow' },
    title: 'CATCH THEM',
    note: 'Only while they are out.',
    hint: 'A/B/C CATCH',
    from: 'child',
    energy: 5,
    weather: ['clear', 'mist'],
    // No hour of its own: the fireflies keep one already, and `inTheYard`
    // will not offer a game for something that cannot be seen.
    axis: 'quiet',
  },
]

/** Who this game needs in the yard, given who fills each role where the pet lives. */
export const visitorFor = (game: YardGame, roles: Record<VisitorRole, VisitorId>): VisitorId =>
  'visitor' in game.needs ? game.needs.visitor : roles[game.needs.role]

export const yardGameById = (id: YardGameId): YardGame => {
  const found = YARD_GAMES.find((g) => g.id === id)
  if (!found) throw new Error(`Unknown yard game: ${id}`)
  return found
}
