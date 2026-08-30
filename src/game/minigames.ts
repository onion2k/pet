import type { PixelCanvas } from '../render/pixels'
import type { ButtonId } from '../render/shell'
import type { Burst } from '../render/particles'
import type { SoundId } from '../engine/audio'
import { random } from '../engine/random'
import type { YardGameId } from '../data/yardgames'

export interface GameFeedback {
  sound: SoundId
  burst?: Burst
}

export interface GameSession {
  readonly id: string
  readonly title: string
  /** Rounds won so far, used for the pet's streak record. */
  streak: number
  /** Rounds decided so far. A quit before any round resolves costs nothing. */
  resolved: number
  done: boolean
  won: boolean
  press(button: ButtonId): GameFeedback | null
  update(dt: number): GameFeedback | null
  draw(hud: PixelCanvas): void
}

export interface Minigame {
  id: string
  title: string
  hint: string
  create(): GameSession
}

const ROUNDS = 5
const NEEDED = 3

const centre = (hud: PixelCanvas) => hud.width / 2

const PANEL = '#080810'

/** Solid backing, so game elements stay readable over the 3D pet behind them. */
function panel(hud: PixelCanvas, x: number, y: number, w: number, h: number): void {
  hud.rect(x, y, w, h, PANEL)
  hud.frame(x, y, w, h, '#242438')
}

function drawHeader(hud: PixelCanvas, title: string, round: number, wins: number): void {
  hud.rect(0, 0, hud.width, 12, PANEL)
  // Keep the header clear of the screen's rounded top corners.
  const inset = Math.round(hud.safeInset(5)) + 2
  hud.text(inset, 5, title, '#8fe36a')
  hud.text(hud.width - inset - 27, 5, `${round}/${ROUNDS}`, '#7fd6ff')
  // Won-round pips sit in the header rather than at the very bottom edge, where
  // the barrel distortion eats them.
  for (let i = 0; i < ROUNDS; i++) {
    hud.rect(hud.width / 2 - 14 + i * 6, 5, 4, 4, i < wins ? '#ffd93d' : '#2a2a38')
  }
}

/** The standing instruction line every game shares. */
/** Sits above the shared hold-to-back strip along the bottom edge. */
function drawFooter(hud: PixelCanvas, hint: string): void {
  hud.rect(0, hud.height - 27, hud.width, 13, PANEL)
  hud.textCentered(centre(hud), hud.height - 24, hint, '#6a6a86')
}

/**
 * The bookkeeping every game shares: five rounds, a beat after each to show how
 * it went, three of them to win. Written once here because there are eight
 * games now and the pattern was being copied out each time.
 *
 * The three original games predate this and are left as they are -- rewriting
 * working, tested game logic to match a helper is a poor trade.
 */
interface Scoreboard {
  round: number
  wins: number
  /** Seconds left of the beat showing how the round went. */
  reveal: number
  hit: boolean
}

const scoreboard = (): Scoreboard => ({ round: 0, wins: 0, reveal: 0, hit: false })

/** How long the verdict on a round stays up before the next one begins. */
const REVEAL = 0.85

/** Called the moment a round is decided. Returns what to play for it. */
function settle(
  session: GameSession,
  board: Scoreboard,
  hit: boolean,
  burst: Burst = 'heart',
): GameFeedback {
  board.hit = hit
  if (hit) {
    board.wins++
    session.streak++
  } else {
    session.streak = 0
  }
  board.reveal = REVEAL
  return { sound: hit ? 'win' : 'lose', burst: hit ? burst : undefined }
}

/**
 * Runs the beat between rounds, and ends the game after the last one. `next`
 * sets up the round after and is not called once there are none left.
 */
function betweenRounds(
  session: GameSession,
  board: Scoreboard,
  dt: number,
  next: () => void,
): GameFeedback | null {
  board.reveal -= dt
  if (board.reveal > 0) return null
  board.round++
  session.resolved = board.round
  if (board.round >= ROUNDS) {
    session.done = true
    session.won = board.wins >= NEEDED
    return { sound: session.won ? 'win' : 'lose', burst: session.won ? 'star' : undefined }
  }
  next()
  return null
}

/** The round number to put in the header, which stops at the last one. */
const showing = (board: Scoreboard) => Math.min(board.round + 1, ROUNDS)

/** Left or right. The original, and still the one that feels like the real thing. */
const guessGame: Minigame = {
  id: 'guess',
  title: 'GUESS',
  hint: 'A LEFT   C RIGHT',
  create(): GameSession {
    let round = 0
    let wins = 0
    let target: -1 | 1 = random() < 0.5 ? -1 : 1
    let reveal = 0
    let lastCorrect = false
    let pick: -1 | 1 | 0 = 0

    return {
      id: 'guess',
      title: 'GUESS',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        if (reveal > 0) return null
        if (button !== 'a' && button !== 'c') return null
        pick = button === 'a' ? -1 : 1
        lastCorrect = pick === target
        if (lastCorrect) {
          wins++
          this.streak++
        } else {
          this.streak = 0
        }
        reveal = 0.9
        return { sound: lastCorrect ? 'win' : 'lose', burst: lastCorrect ? 'heart' : undefined }
      },
      update(dt) {
        if (reveal <= 0) return null
        reveal -= dt
        if (reveal > 0) return null
        round++
        this.resolved = round
        pick = 0
        if (round >= ROUNDS) {
          this.done = true
          this.won = wins >= NEEDED
          return { sound: this.won ? 'win' : 'lose', burst: this.won ? 'star' : undefined }
        }
        target = random() < 0.5 ? -1 : 1
        return null
      },
      draw(hud) {
        drawHeader(hud, 'GUESS', Math.min(round + 1, ROUNDS), wins)
        const cx = centre(hud)
        panel(hud, 8, 108, hud.width - 16, 22)
        if (reveal > 0) {
          // The arrow shows which way it actually went; the verdict says whether
          // the player called it.
          hud.text(cx + target * 46 - 6, 112, target < 0 ? '<<' : '>>', '#ffd93d', 2)
          hud.textCentered(cx, 114, lastCorrect ? 'HIT!' : 'MISS', lastCorrect ? '#8fe36a' : '#ff6b4a', 2)
        } else {
          hud.textCentered(cx, 116, 'WHICH WAY?', '#e8e8f2')
          hud.text(14, 114, '<', '#7fd6ff', 2)
          hud.text(hud.width - 22, 114, '>', '#7fd6ff', 2)
        }
        drawFooter(hud, 'A LEFT   C RIGHT')
      },
    }
  },
}

/** A sweeping marker and a target zone. Pure timing. */
const rhythmGame: Minigame = {
  id: 'rhythm',
  title: 'TIMING',
  hint: 'B TO STOP',
  create(): GameSession {
    let round = 0
    let wins = 0
    let position = 0
    let direction = 1
    let speed = 1.1
    let zoneCentre = 0.5
    let zoneWidth = 0.22
    let reveal = 0
    let lastCorrect = false

    const nextRound = () => {
      zoneCentre = 0.2 + random() * 0.6
      zoneWidth = Math.max(0.09, 0.22 - round * 0.025)
      speed = 1.1 + round * 0.28
      position = 0
      direction = 1
    }
    nextRound()

    return {
      id: 'rhythm',
      title: 'TIMING',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        if (reveal > 0 || button !== 'b') return null
        lastCorrect = Math.abs(position - zoneCentre) <= zoneWidth / 2
        if (lastCorrect) {
          wins++
          this.streak++
        } else {
          this.streak = 0
        }
        reveal = 0.8
        return { sound: lastCorrect ? 'win' : 'lose', burst: lastCorrect ? 'sparkle' : undefined }
      },
      update(dt) {
        if (reveal > 0) {
          reveal -= dt
          if (reveal > 0) return null
          round++
          this.resolved = round
          if (round >= ROUNDS) {
            this.done = true
            this.won = wins >= NEEDED
            return { sound: this.won ? 'win' : 'lose', burst: this.won ? 'star' : undefined }
          }
          nextRound()
          return null
        }
        position += direction * speed * dt
        if (position > 1) {
          position = 1
          direction = -1
        } else if (position < 0) {
          position = 0
          direction = 1
        }
        return null
      },
      draw(hud) {
        drawHeader(hud, 'TIMING', Math.min(round + 1, ROUNDS), wins)
        // The track lives below the pet so the two never overlap.
        panel(hud, 6, 104, hud.width - 12, 30)
        const trackX = 14
        const trackW = hud.width - 28
        const y = 122

        hud.rect(trackX, y, trackW, 8, '#1b1b28')
        const zoneX = trackX + (zoneCentre - zoneWidth / 2) * trackW
        hud.rect(zoneX, y, zoneWidth * trackW, 8, lastCorrect && reveal > 0 ? '#8fe36a' : '#3a5f8f')
        hud.rect(trackX + position * trackW - 1, y - 4, 3, 16, '#ffd93d')

        hud.textCentered(
          centre(hud),
          109,
          reveal > 0 ? (lastCorrect ? 'PERFECT' : 'MISSED') : 'STOP IT',
          '#e8e8f2',
        )
        drawFooter(hud, 'B TO STOP')
      },
    }
  },
}

/** Repeat the flashed sequence. Gets one longer each round. */

/** Lead-in before playback, so the first symbol is never missed. */
const RECALL_READY = 0.9
/** How long each symbol stays lit. */
const RECALL_LIT = 0.5
/** Dark gap after each symbol. Long enough that two identical symbols in a row
 *  read as two flashes rather than one. */
const RECALL_GAP = 0.28

const TONES: Record<ButtonId, SoundId> = { a: 'toneA', b: 'toneB', c: 'toneC' }

const memoryGame: Minigame = {
  id: 'memory',
  title: 'RECALL',
  hint: 'REPEAT IT',
  create(): GameSession {
    const buttons: ButtonId[] = ['a', 'b', 'c']
    let sequence: ButtonId[] = []
    let showIndex = 0
    /** Counts down through one symbol's lit-then-dark slot. */
    let slotTimer = 0
    let readyTimer = RECALL_READY
    let inputIndex = 0
    let phase: 'ready' | 'show' | 'input' | 'result' = 'ready'
    let wins = 0
    let round = 0
    let lastCorrect = false
    let flash: ButtonId | null = null
    let flashTimer = 0
    let resultTimer = 0

    const extend = () => {
      sequence.push(buttons[Math.floor(random() * 3)]!)
      showIndex = 0
      slotTimer = 0
      readyTimer = RECALL_READY
      phase = 'ready'
      inputIndex = 0
      flash = null
      flashTimer = 0
    }
    extend()

    return {
      id: 'memory',
      title: 'RECALL',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        if (phase !== 'input') return null
        // Echo the player's own input so entering a sequence sounds like playback.
        flash = button
        flashTimer = 0.18

        if (sequence[inputIndex] === button) {
          inputIndex++
          if (inputIndex >= sequence.length) {
            wins++
            this.streak++
            lastCorrect = true
            phase = 'result'
            resultTimer = 0.8
            return { sound: 'win', burst: 'sparkle' }
          }
          return { sound: TONES[button] }
        }
        this.streak = 0
        lastCorrect = false
        phase = 'result'
        resultTimer = 0.8
        return { sound: 'lose' }
      },
      update(dt) {
        if (flashTimer > 0) {
          flashTimer -= dt
          if (flashTimer <= 0 && phase === 'input') flash = null
        }

        if (phase === 'ready') {
          readyTimer -= dt
          if (readyTimer > 0) return null
          phase = 'show'
          showIndex = 0
          slotTimer = RECALL_LIT + RECALL_GAP
          return { sound: TONES[sequence[0]!] }
        }

        if (phase === 'show') {
          slotTimer -= dt
          if (slotTimer > 0) return null
          showIndex++
          if (showIndex >= sequence.length) {
            // Straight into the player's turn: no dead beat at the end.
            phase = 'input'
            flash = null
            return null
          }
          slotTimer = RECALL_LIT + RECALL_GAP
          return { sound: TONES[sequence[showIndex]!] }
        }

        if (phase === 'result') {
          resultTimer -= dt
          if (resultTimer > 0) return null
          round++
          this.resolved = round
          if (round >= ROUNDS) {
            this.done = true
            this.won = wins >= NEEDED
            return { sound: this.won ? 'win' : 'lose', burst: this.won ? 'star' : undefined }
          }
          // A miss restarts the sequence; a hit makes it longer.
          if (!lastCorrect) sequence = []
          extend()
          return { sound: 'ready' }
        }
        return null
      },
      draw(hud) {
        drawHeader(hud, 'RECALL', Math.min(round + 1, ROUNDS), wins)
        panel(hud, 6, 88, hud.width - 12, 46)

        // During playback the lamp is lit for RECALL_LIT of its slot, then dark.
        const playing = phase === 'show' && slotTimer > RECALL_GAP
        // `playing` is only true mid-playback, where showIndex is in range.
        const lit = playing ? sequence[showIndex]! : phase === 'show' ? null : flash

        const labels: ButtonId[] = ['a', 'b', 'c']
        labels.forEach((id, i) => {
          const x = 24 + i * 50
          const on = lit === id
          hud.rect(x, 106, 34, 24, on ? '#ffd93d' : '#20202e')
          hud.frame(x, 106, 34, 24, on ? '#fff3a0' : '#3a3a52')
          hud.text(x + 14, 113, id.toUpperCase(), on ? '#141420' : '#8a8aa8', 2)
        })

        const status =
          phase === 'ready'
            ? 'GET READY'
            : phase === 'show'
              ? 'WATCH'
              : phase === 'input'
                ? 'YOUR TURN'
                : lastCorrect
                  ? 'GOOD'
                  : 'WRONG'
        hud.textCentered(centre(hud), 92, status, phase === 'input' ? '#ffd93d' : '#e8e8f2')

        // One pip per symbol, filled as the sequence plays or as the player enters it.
        const done = phase === 'show' ? showIndex : phase === 'input' ? inputIndex : sequence.length
        const pipsWidth = sequence.length * 6 - 2
        for (let i = 0; i < sequence.length; i++) {
          hud.rect(centre(hud) - pipsWidth / 2 + i * 6, 100, 4, 3, i < done ? '#7fd6ff' : '#2a2a38')
        }

        drawFooter(hud, phase === 'input' ? `${inputIndex}/${sequence.length}` : `LENGTH ${sequence.length}`)
      },
    }
  },
}

/**
 * The yard games. Each asks for something the others do not: a ball wants
 * effort, a butterfly wants a guess at where it is going, a leaf pile wants you
 * to keep your eye on something, a sled wants steering and fireflies want quick
 * hands. That is the whole point of them -- a game tied to what turned up today
 * is only worth having if it plays differently from the three that are always
 * on the menu.
 */

/** FETCH -- effort. Tap to wind up the kick; it sags if you stop. */
const fetchGame: Minigame = {
  id: 'fetch',
  title: 'FETCH',
  hint: 'B TO WIND UP',
  create(): GameSession {
    const board = scoreboard()
    /** How hard the kick is shaping up to be, 0..1. */
    let power = 0
    /** Seconds until it goes, whatever it has by then. */
    let timer = 0
    /** Where it ended up, kept so the verdict can show the miss. */
    let landed = 0

    /** Where the pet is standing, and how much of the yard it covers. */
    const bandAt = (r: number) => {
      // Further off each round, and a tighter target for it.
      const middle = 0.42 + r * 0.1
      const half = 0.17 - r * 0.02
      return { from: middle - half, to: middle + half }
    }
    /** What one tap is worth, and how fast an untended wind-up sags. */
    const TAP = 0.115
    const SAG = 0.42

    const nextRound = () => {
      power = 0
      timer = 2.4
    }
    nextRound()

    return {
      id: 'fetch',
      title: 'FETCH',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        if (board.reveal > 0 || button !== 'b') return null
        power = Math.min(1, power + TAP)
        return { sound: 'toneB' }
      },
      update(dt) {
        if (board.reveal > 0) return betweenRounds(this, board, dt, nextRound)
        // It sags while you are not winding it, so the round is a rate rather
        // than a count -- five slow taps are not the same as five quick ones.
        power = Math.max(0, power - SAG * dt)
        timer -= dt
        if (timer > 0) return null
        const band = bandAt(board.round)
        landed = power
        return settle(this, board, power >= band.from && power <= band.to)
      },
      draw(hud) {
        drawHeader(hud, 'FETCH', showing(board), board.wins)
        const cx = centre(hud)
        const band = bandAt(Math.min(board.round, ROUNDS - 1))
        const left = 14
        const width = hud.width - 28
        panel(hud, 8, 102, hud.width - 16, 30)
        // The yard as a line, with the stretch the pet is standing in picked out.
        hud.rect(left, 118, width, 6, '#1b1b28')
        hud.rect(left + band.from * width, 118, (band.to - band.from) * width, 6, '#2f5a3a')
        if (board.reveal > 0) {
          hud.rect(left + landed * width - 1, 114, 3, 14, board.hit ? '#8fe36a' : '#ff6b4a')
          hud.textCentered(cx, 106, board.hit ? 'GOOD BALL!' : 'OFF IT WENT', board.hit ? '#8fe36a' : '#ff6b4a')
        } else {
          hud.rect(left, 118, power * width, 6, '#ffd93d')
          hud.textCentered(cx, 106, 'WIND IT UP', '#e8e8f2')
          // How long is left, so the tapping has something to race.
          hud.rect(left, 128, (timer / 2.4) * width, 2, '#3a5f8f')
        }
        drawFooter(hud, 'B TO WIND UP')
      },
    }
  },
}

/** How many perches the flitting games use. Three fits the three buttons. */
const PERCHES = 3

/** CHASE -- prediction. It leans one way; back your guess before it goes. */
const chaseGame: Minigame = {
  id: 'chase',
  title: 'CHASE',
  hint: 'A/C MOVE',
  create(): GameSession {
    const board = scoreboard()
    let at = 1
    /** Which way it is leaning, and whether that lean is a lie. */
    let lean: -1 | 1 = 1
    let feint = false
    let you = 1
    let timer = 0
    let landedOn = 1

    const nextRound = () => {
      at = Math.floor(random() * PERCHES)
      lean = random() < 0.5 ? -1 : 1
      // It learns to sell the dummy as the game goes on, so reading the lean
      // stops being enough on its own.
      feint = random() < 0.15 + board.round * 0.12
      you = at
      timer = 1.9 - board.round * 0.16
    }
    nextRound()

    return {
      id: 'chase',
      title: 'CHASE',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        if (board.reveal > 0) return null
        if (button === 'a') you = (you + PERCHES - 1) % PERCHES
        else if (button === 'c') you = (you + 1) % PERCHES
        else return null
        return { sound: 'move' }
      },
      update(dt) {
        if (board.reveal > 0) return betweenRounds(this, board, dt, nextRound)
        timer -= dt
        if (timer > 0) return null
        const way = feint ? -lean : lean
        landedOn = (at + way + PERCHES) % PERCHES
        return settle(this, board, you === landedOn, 'sparkle')
      },
      draw(hud) {
        drawHeader(hud, 'CHASE', showing(board), board.wins)
        const cx = centre(hud)
        panel(hud, 8, 96, hud.width - 16, 36)
        const span = hud.width - 48
        const spot = (i: number) => 24 + (span * i) / (PERCHES - 1)
        for (let i = 0; i < PERCHES; i++) {
          const x = spot(i)
          // Bright enough to count at a glance: three perches that cannot be
          // told apart make the lean impossible to read against them.
          hud.rect(x - 5, 118, 10, 2, '#40465e')
          const on = board.reveal > 0 ? i === landedOn : i === at
          if (on) hud.rect(x - 3, 110, 6, 6, '#ffb84d')
          // Where you have committed to, drawn under the perch so the two
          // never sit on top of one another.
          if (i === you) hud.rect(x - 4, 124, 8, 3, board.reveal > 0 ? (board.hit ? '#8fe36a' : '#ff6b4a') : '#7fd6ff')
        }
        if (board.reveal > 0) {
          hud.textCentered(cx, 100, board.hit ? 'CAUGHT IT!' : 'GONE', board.hit ? '#8fe36a' : '#ff6b4a')
        } else {
          hud.textCentered(cx, 100, 'WHERE NEXT?', '#e8e8f2')
          // The lean, which is a hint and not a promise.
          hud.text(spot(at) + lean * 10 - 2, 110, lean < 0 ? '<' : '>', '#8fe36a')
        }
        drawFooter(hud, 'A/C MOVE')
      },
    }
  },
}

/** DIVE IN -- tracking. Keep your eye on the deep drift while they swirl. */
const diveGame: Minigame = {
  id: 'dive',
  title: 'DIVE IN',
  hint: 'A/B/C PICK',
  create(): GameSession {
    const board = scoreboard()
    /** Which drift is the deep one, by position. */
    let deep = 0
    /** Swaps left to play out, and how long each takes. */
    let swapsLeft = 0
    let swapTimer = 0
    /** The pair being swapped, so the drawing can show them changing places. */
    let swapping: [number, number] | null = null
    let picked = -1
    let watching = 0
    /**
     * How long there is to answer once the leaves settle. Without it a player
     * who looks away leaves the round open for ever, and a game that never ends
     * is a pet that can no longer be fed.
     */
    let deciding = 0

    const nextRound = () => {
      deep = Math.floor(random() * PERCHES)
      swapsLeft = 3 + board.round
      swapTimer = 0
      swapping = null
      picked = -1
      // A beat to see where it went in before anything moves.
      watching = 0.9
      deciding = 3.5
    }
    nextRound()

    const swapSpeed = () => 0.42 - board.round * 0.04

    return {
      id: 'dive',
      title: 'DIVE IN',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        // Only once the leaves have settled: picking mid-swirl would be
        // answering a question that has not finished being asked.
        if (board.reveal > 0 || swapsLeft > 0 || watching > 0) return null
        const choice = button === 'a' ? 0 : button === 'b' ? 1 : 2
        picked = choice
        return settle(this, board, choice === deep, 'star')
      },
      update(dt) {
        if (board.reveal > 0) return betweenRounds(this, board, dt, nextRound)
        if (watching > 0) {
          watching -= dt
          return null
        }
        if (swapsLeft <= 0) {
          deciding -= dt
          // Not choosing is choosing wrong, as it is when a firefly fades.
          if (deciding <= 0) return settle(this, board, false, 'star')
          return null
        }
        swapTimer -= dt
        if (swapTimer > 0) return null
        if (swapping) {
          // Land the swap that was in flight.
          const [x, y] = swapping
          if (deep === x) deep = y
          else if (deep === y) deep = x
          swapping = null
          swapsLeft--
          swapTimer = swapSpeed() * 0.4
          return null
        }
        let x = Math.floor(random() * PERCHES)
        let y = Math.floor(random() * PERCHES)
        if (x === y) y = (y + 1) % PERCHES
        swapping = [x, y]
        swapTimer = swapSpeed()
        return null
      },
      draw(hud) {
        drawHeader(hud, 'DIVE IN', showing(board), board.wins)
        const cx = centre(hud)
        panel(hud, 8, 96, hud.width - 16, 36)
        const span = hud.width - 48
        const spot = (i: number) => 24 + (span * i) / (PERCHES - 1)
        for (let i = 0; i < PERCHES; i++) {
          const x = spot(i)
          const moving = swapping?.includes(i)
          // A drift lifts while it is changing places, which is what makes the
          // swap something you can follow rather than a jump.
          const y = moving ? 108 : 114
          const known = watching > 0 || board.reveal > 0
          const isDeep = known && i === deep
          hud.rect(x - 7, y, 14, 8, isDeep ? '#d8842f' : '#6b4a2c')
          if (board.reveal > 0 && i === picked) {
            hud.rect(x - 8, y + 10, 16, 3, board.hit ? '#8fe36a' : '#ff6b4a')
          }
          if (!known && board.reveal <= 0 && swapsLeft <= 0) {
            hud.text(x - 2, y + 10, ['A', 'B', 'C'][i]!, '#7fd6ff')
          }
        }
        const line =
          board.reveal > 0
            ? board.hit
              ? 'RIGHT IN!'
              : 'ALL LEAVES'
            : watching > 0
              ? 'THE DEEP ONE'
              : swapsLeft > 0
                ? 'KEEP WATCHING'
                : 'WHICH ONE?'
        hud.textCentered(cx, 100, line, board.reveal > 0 ? (board.hit ? '#8fe36a' : '#ff6b4a') : '#e8e8f2')
        // How long is left to answer, so the pause has a visible end.
        if (board.reveal <= 0 && swapsLeft <= 0 && watching <= 0) {
          hud.rect(14, 128, (deciding / 3.5) * (hud.width - 28), 2, '#3a5f8f')
        }
        drawFooter(hud, swapsLeft > 0 || watching > 0 ? 'WATCH' : 'A/B/C PICK')
      },
    }
  },
}

/** How wide the hill is, in lanes. */
const LANES = 3

/** THE HILL -- avoidance. Steer past what is coming, all the way down. */
const hillGame: Minigame = {
  id: 'hill',
  title: 'THE HILL',
  hint: 'A/C STEER',
  create(): GameSession {
    const board = scoreboard()
    let lane = 1
    /** Where the obstacle is, 0 at the top of the hill and 1 at the sled. */
    let obstacleAt = 0
    let obstacleLane = 0

    const nextRound = () => {
      obstacleAt = 0
      // Never straight at the sled to begin with, so there is always a way out.
      do obstacleLane = Math.floor(random() * LANES)
      while (obstacleLane === lane && board.round === 0)
    }
    const speedAt = () => 0.55 + board.round * 0.14
    nextRound()

    return {
      id: 'hill',
      title: 'THE HILL',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        if (board.reveal > 0) return null
        if (button === 'a') lane = Math.max(0, lane - 1)
        else if (button === 'c') lane = Math.min(LANES - 1, lane + 1)
        else return null
        return { sound: 'move' }
      },
      update(dt) {
        if (board.reveal > 0) return betweenRounds(this, board, dt, nextRound)
        obstacleAt += speedAt() * dt
        if (obstacleAt < 1) return null
        obstacleAt = 1
        return settle(this, board, obstacleLane !== lane, 'sparkle')
      },
      draw(hud) {
        drawHeader(hud, 'THE HILL', showing(board), board.wins)
        const cx = centre(hud)
        // The hill wants height, so this one takes the whole screen rather
        // than the strip along the bottom the others use.
        panel(hud, 8, 20, hud.width - 16, 112)
        const top = 30
        const bottom = 116
        const laneX = (i: number) => 34 + ((hud.width - 68) * i) / (LANES - 1)
        for (let i = 0; i < LANES; i++) {
          hud.rect(laneX(i) - 1, top, 2, bottom - top, '#22283c')
        }
        hud.rect(laneX(obstacleLane) - 6, top + (bottom - top) * obstacleAt - 4, 12, 8, '#4f7a35')
        hud.rect(laneX(lane) - 5, bottom, 10, 6, board.reveal > 0 && !board.hit ? '#ff6b4a' : '#9aa3ad')
        hud.textCentered(
          cx,
          24,
          board.reveal > 0 ? (board.hit ? 'CLEAR!' : 'OOF') : 'MIND OUT',
          board.reveal > 0 ? (board.hit ? '#8fe36a' : '#ff6b4a') : '#e8e8f2',
        )
        drawFooter(hud, 'A/C STEER')
      },
    }
  },
}

/** CATCH THEM -- reaction. Whichever lights up, press its button. */
const catchGame: Minigame = {
  id: 'catch',
  title: 'CATCH THEM',
  hint: 'A/B/C CATCH',
  create(): GameSession {
    const board = scoreboard()
    let lit = -1
    /** Time before one lights, then how long it stays lit. */
    let waiting = 0
    let alight = 0

    const nextRound = () => {
      lit = -1
      // A varying wait, so the round cannot be answered by rhythm alone.
      waiting = 0.5 + random() * 1.1
      alight = 0
    }
    nextRound()

    /** How long there is to answer, which shortens as the game goes on. */
    const windowAt = () => 0.85 - board.round * 0.1

    return {
      id: 'catch',
      title: 'CATCH THEM',
      streak: 0,
      resolved: 0,
      done: false,
      won: false,
      press(button) {
        if (board.reveal > 0) return null
        const choice = button === 'a' ? 0 : button === 'b' ? 1 : 2
        // Pressing before anything lights is a miss: the round is about
        // waiting for it as much as answering it.
        if (lit < 0) return settle(this, board, false, 'sparkle')
        return settle(this, board, choice === lit, 'sparkle')
      },
      update(dt) {
        if (board.reveal > 0) return betweenRounds(this, board, dt, nextRound)
        if (lit < 0) {
          waiting -= dt
          if (waiting > 0) return null
          lit = Math.floor(random() * PERCHES)
          alight = windowAt()
          return { sound: 'toneA' }
        }
        alight -= dt
        // Letting it fade is a miss, so hanging back is not a way to be safe.
        if (alight <= 0) return settle(this, board, false, 'sparkle')
        return null
      },
      draw(hud) {
        drawHeader(hud, 'CATCH THEM', showing(board), board.wins)
        const cx = centre(hud)
        panel(hud, 8, 96, hud.width - 16, 36)
        const span = hud.width - 48
        for (let i = 0; i < PERCHES; i++) {
          const x = 24 + (span * i) / (PERCHES - 1)
          const on = i === lit
          hud.rect(x - 4, 112, 8, 8, on ? '#fff2a0' : '#2a2a38')
          hud.text(x - 2, 124, ['A', 'B', 'C'][i]!, on ? '#e8e8f2' : '#40465e')
        }
        hud.textCentered(
          cx,
          100,
          board.reveal > 0 ? (board.hit ? 'GOT ONE!' : 'MISSED IT') : lit < 0 ? 'WAIT...' : 'NOW!',
          board.reveal > 0 ? (board.hit ? '#8fe36a' : '#ff6b4a') : '#e8e8f2',
        )
        drawFooter(hud, 'A/B/C CATCH')
      },
    }
  },
}

/** The games that need nothing out in the yard, and so are always available. */
export const MINIGAMES: Minigame[] = [guessGame, rhythmGame, memoryGame]

/** Yard games, by the id on their table entry. */
export const YARD_SESSIONS: Record<YardGameId, Minigame> = {
  fetch: fetchGame,
  chase: chaseGame,
  dive: diveGame,
  hill: hillGame,
  catch: catchGame,
}
