type Wave = 'square' | 'triangle' | 'sawtooth'

interface Note {
  /** Hz. */
  hz: number
  /** Seconds. */
  dur: number
  wave?: Wave
  gain?: number
}

const SONGS: Record<string, Note[]> = {
  click: [{ hz: 880, dur: 0.03, gain: 0.18 }],
  move: [{ hz: 660, dur: 0.035, gain: 0.15 }],
  confirm: [
    { hz: 784, dur: 0.05 },
    { hz: 1175, dur: 0.07 },
  ],
  cancel: [
    { hz: 400, dur: 0.05 },
    { hz: 260, dur: 0.08 },
  ],
  refuse: [{ hz: 180, dur: 0.14, wave: 'sawtooth', gain: 0.16 }],
  eat: [
    { hz: 520, dur: 0.04 },
    { hz: 700, dur: 0.04 },
    { hz: 900, dur: 0.06 },
  ],
  clean: [
    { hz: 1200, dur: 0.04, wave: 'triangle' },
    { hz: 1600, dur: 0.05, wave: 'triangle' },
    { hz: 2000, dur: 0.06, wave: 'triangle' },
  ],
  sleep: [
    { hz: 500, dur: 0.09, wave: 'triangle' },
    { hz: 380, dur: 0.12, wave: 'triangle' },
    { hz: 280, dur: 0.18, wave: 'triangle' },
  ],
  win: [
    { hz: 660, dur: 0.06 },
    { hz: 880, dur: 0.06 },
    { hz: 1100, dur: 0.12 },
  ],
  lose: [
    { hz: 400, dur: 0.09 },
    { hz: 320, dur: 0.09 },
    { hz: 200, dur: 0.16 },
  ],
  hatch: [
    { hz: 440, dur: 0.07 },
    { hz: 587, dur: 0.07 },
    { hz: 740, dur: 0.07 },
    { hz: 880, dur: 0.16 },
  ],
  evolve: [
    { hz: 523, dur: 0.08 },
    { hz: 659, dur: 0.08 },
    { hz: 784, dur: 0.08 },
    { hz: 1047, dur: 0.1 },
    { hz: 784, dur: 0.06 },
    { hz: 1047, dur: 0.26 },
  ],
  alert: [
    { hz: 1000, dur: 0.06 },
    { hz: 0, dur: 0.05 },
    { hz: 1000, dur: 0.06 },
  ],
  // One pitch per button, so a recalled sequence can be heard as well as seen.
  toneA: [{ hz: 523, dur: 0.17, gain: 0.14 }],
  toneB: [{ hz: 659, dur: 0.17, gain: 0.14 }],
  toneC: [{ hz: 784, dur: 0.17, gain: 0.14 }],
  ready: [
    { hz: 330, dur: 0.07, wave: 'triangle' },
    { hz: 0, dur: 0.07 },
    { hz: 330, dur: 0.07, wave: 'triangle' },
  ],
}

export type SoundId = keyof typeof SONGS

/**
 * A tiny square-wave beeper. Everything is synthesised, so there are no audio
 * assets to load and the whole thing weighs nothing.
 */
export class Beeper {
  private ctx: AudioContext | null = null
  muted = false

  constructor(muted: boolean) {
    this.muted = muted
  }

  /** Browsers only allow audio after a gesture, so the context is made lazily. */
  private ensure(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  play(id: SoundId): void {
    const ctx = this.ensure()
    if (!ctx) return
    const notes = SONGS[id]
    if (!notes) return

    let at = ctx.currentTime
    for (const note of notes) {
      if (note.hz > 0) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = note.wave ?? 'square'
        osc.frequency.setValueAtTime(note.hz, at)
        const peak = (note.gain ?? 0.12) * 0.8
        // Hard attack, exponential tail: the shape of a piezo buzzer.
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.004)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.dur)
        osc.connect(gain).connect(ctx.destination)
        osc.start(at)
        osc.stop(at + note.dur + 0.02)
      }
      at += note.dur
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted && this.ctx) void this.ctx.suspend()
  }
}
