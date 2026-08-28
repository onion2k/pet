import type { Hud } from '../render/hud'
import type { ButtonId } from '../render/shell'
import type { Burst } from '../render/particles'
import type { SoundId } from '../engine/audio'

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
  draw(hud: Hud): void
}

export interface Minigame {
  id: string
  title: string
  hint: string
  create(): GameSession
}

const ROUNDS = 5
const NEEDED = 3

const centre = (hud: Hud) => hud.width / 2

const PANEL = '#080810'

/** Solid backing, so game elements stay readable over the 3D pet behind them. */
function panel(hud: Hud, x: number, y: number, w: number, h: number): void {
  hud.rect(x, y, w, h, PANEL)
  hud.frame(x, y, w, h, '#242438')
}

function drawHeader(hud: Hud, title: string, round: number, wins: number): void {
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
function drawFooter(hud: Hud, hint: string): void {
  hud.rect(0, hud.height - 27, hud.width, 13, PANEL)
  hud.textCentered(centre(hud), hud.height - 24, hint, '#6a6a86')
}

/** Left or right. The original, and still the one that feels like the real thing. */
const guessGame: Minigame = {
  id: 'guess',
  title: 'GUESS',
  hint: 'A LEFT   C RIGHT',
  create(): GameSession {
    let round = 0
    let wins = 0
    let target: -1 | 1 = Math.random() < 0.5 ? -1 : 1
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
        target = Math.random() < 0.5 ? -1 : 1
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
      zoneCentre = 0.2 + Math.random() * 0.6
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
      sequence.push(buttons[Math.floor(Math.random() * 3)]!)
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
        const lit = playing ? (sequence[showIndex] ?? null) : phase === 'show' ? null : flash

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

export const MINIGAMES: Minigame[] = [guessGame, rhythmGame, memoryGame]
