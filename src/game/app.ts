import { FOODS } from '../data/foods'
import { ICON_ORDER, type IconId } from '../data/icons'
import { speciesOf } from '../data/species'
import type { Burst } from '../render/particles'
import type { ButtonId } from '../render/shell'
import type { SoundId } from '../engine/audio'
import { clean, evolve, feed, readyToEvolve, recordPlay, toggleSleep, type Evolution } from './actions'
import { MINIGAMES, type GameSession } from './minigames'
import { metrics, type Metrics } from './metrics'
import { load, newPet, saveSoon, wipe } from './save'
import { reconcile, sleepThrough, tick, mood, urgentNeeds } from './sim'
import { hoursUntilSunrise, isNight, seasonIdAt, worldAt, WORLD_HOUR_MS } from './world'
import { findCurio, type Curio } from '../data/curios'
import { SHELLS, shellById, type ShellColour } from '../data/shells'
import type { PetState, SaveFile } from './types'

export type Mode =
  | 'boot'
  | 'name'
  | 'welcome'
  | 'main'
  | 'feed'
  | 'status'
  | 'games'
  | 'playing'
  | 'evolve'
  | 'retire'

export const NAMES = ['PIP', 'BOB', 'ZED', 'MOSS', 'NIM', 'TOFU', 'KIRA', 'DUSK']

/** Long absences get a summary screen rather than a silent stat drop. */
const WELCOME_THRESHOLD_MS = 5 * 60_000
/** How long the pet must have been alone before it can have found something. */
const CURIO_AWAY_MS = 20 * 60_000
/** Chance a long enough absence turns something up. */
const CURIO_CHANCE = 0.65

/**
 * A sleep runs to sunrise, however far off that is. Bedded down at dusk that is
 * most of a night; bedded down at noon it is most of a day, and the pet wakes
 * correspondingly ravenous.
 */
/** Real seconds a skip takes to play out, per world hour covered. */
const SKIP_SECONDS_PER_HOUR = 0.44
/** Bounds on that, so a short sleep does not flicker and a long one does not drag. */
const SKIP_SECONDS_MIN = 1.2
const SKIP_SECONDS_MAX = 6

/** How long C must be held to back out of a submenu or a game. */
export const HOLD_TO_BACK_SECONDS = 0.8
/** How long B must be held on the status screen to retire an adult. Longer
 *  than the back-hold: this one ends a life, gently. */
export const RETIRE_HOLD_SECONDS = 1.6
/** Starting-stat bonus per retired ancestor, and its cap. */
const HEIRLOOM_PER_ANCESTOR = 5
const HEIRLOOM_CAP = 15
/** Screens that C can be held to escape from. */
const ESCAPABLE: Mode[] = ['feed', 'games', 'playing']

export interface AppHooks {
  sound(id: SoundId): void
  burst(kind: Burst, count?: number): void
  pop(strength?: number): void
  /** Called when the pet's form changes so the renderer can swap geometry. */
  form(speciesId: string, animate: boolean): void
  /** Called when a pet retires, so the renderer can walk it off into the meadow. */
  depart(): void
}

export class App {
  mode: Mode = 'boot'
  private save: SaveFile
  pet: PetState | null
  iconIndex = 0
  /** True once an icon is selected and the ring is armed for B. */
  foodIndex = 0
  gameIndex = 0
  nameIndex = 0
  session: GameSession | null = null
  evolution: Evolution | null = null
  /** Who is being seen off, while the retirement screen is up. */
  retiring: { name: string; speciesName: string } | null = null
  /** What the pet found while the player was away, for the welcome screen. */
  found: Curio | null = null
  message = ''
  messageTimer = 0
  awayMs = 0
  bootTimer = 1.4
  /** Seconds the current game has been running, used to time the quit hint. */
  sessionElapsed = 0
  private heldButton: ButtonId | null = null
  private heldSeconds = 0
  /** World-clock milliseconds still to be wound forward by the current sleep. */
  private skipRemaining = 0
  /** How long this sleep is in total, for pacing and for the rest it grants. */
  private skipTotal = 0
  private skipSeconds = SKIP_SECONDS_MIN
  /** One skip per sleep, however long the pet stays in bed. */
  private skipSpent = false
  /** Set from the renderer once the pet has actually settled in its shelter. */
  petSheltered = false
  /** True only for a B press that began on the status screen itself, so the
   *  release of the press that opened the screen cannot close it. */
  private retireArmed = false
  /**
   * Extra world-clock offset, used only by the dev harness to scrub time. Kept
   * here rather than in the renderer so that scrubbing moves the pet's world
   * too, not just the picture of it.
   */
  debugWorldOffset = 0
  /** Blink phase for the selected icon, driven by update(). */
  blink = 0

  constructor(private hooks: AppHooks) {
    this.save = load()
    this.save.counters.sessions += 1
    this.updateStreak()
    this.pet = this.save.pet
    if (this.pet) {
      const result = reconcile(this.pet, Date.now(), this.daylight)
      this.awayMs = result.awayMs
      this.syncDiscovered()
      this.rollCurio()
    }
    saveSoon(this.save)
  }

  /**
   * A gentle streak: visiting on consecutive days builds it, and missing days
   * erodes it one per day missed rather than wiping it out. Rewarding presence
   * without punishing absence is the whole tone of the game.
   */
  private updateStreak(): void {
    const stamp = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today = stamp(new Date())
    const streak = this.save.streak
    if (streak.lastDay === today) return
    if (!streak.lastDay) {
      streak.days = 1
    } else {
      const [y, m, d] = streak.lastDay.split('-').map(Number)
      const then = new Date(y!, m! - 1, d!).getTime()
      const gap = Math.round((Date.now() - then) / 86_400_000)
      if (gap <= 1) streak.days += 1
      else streak.days = Math.max(1, streak.days - (gap - 1))
    }
    streak.lastDay = today
  }

  /** Folds the current pet's discoveries into the lineage-wide list. */
  private syncDiscovered(): void {
    if (!this.pet) return
    for (const id of this.pet.discovered) {
      if (!this.save.discovered.includes(id)) this.save.discovered.push(id)
    }
  }

  /**
   * The pet sometimes turns something up while the player is away — the
   * anticipation half of coming back, alongside the maintenance half. What it
   * finds depends on the season and the weather it was found in.
   */
  private rollCurio(): void {
    const pet = this.pet
    if (!pet || pet.stage === 'egg') return
    if (this.awayMs < CURIO_AWAY_MS) return
    if (Math.random() > CURIO_CHANCE) return
    const world = worldAt(this.worldNow())
    const curio = findCurio(world.season.id, world.weather, Math.random())
    if (!curio) return
    this.save.curios[curio.id] = (this.save.curios[curio.id] ?? 0) + 1
    this.found = curio
  }

  /** Species reached across every generation, for the collection counter. */
  get discoveredCount(): number {
    return this.save.discovered.length
  }

  get streakDays(): number {
    return this.save.streak.days
  }

  /** The shells this lineage has earned, default first. */
  get unlockedShells(): ShellColour[] {
    return SHELLS.filter((shell) => shell.unlocked(this.save))
  }

  get currentShell(): ShellColour {
    return shellById(this.save.shell)
  }

  /** Steps to the next earned shell colour and returns it. */
  cycleShell(): ShellColour {
    const unlocked = this.unlockedShells
    const index = unlocked.findIndex((shell) => shell.id === this.save.shell)
    const next = unlocked[(index + 1) % unlocked.length]!
    this.save.shell = next.id
    this.persist()
    return next
  }

  get curioTally(): { kinds: number; total: number } {
    const counts = Object.values(this.save.curios)
    return { kinds: counts.length, total: counts.reduce((a, b) => a + b, 0) }
  }

  get muted(): boolean {
    return this.save.muted
  }

  /** How far the world clock runs ahead of the wall clock. */
  get worldOffset(): number {
    return this.save.worldOffset
  }

  /** The time the world is showing, which is what the pet lives by. */
  worldNow(): number {
    return Date.now() + this.save.worldOffset + this.debugWorldOffset
  }

  /**
   * Whether the world's sun is up at a given wall-clock moment. Handed to the
   * simulation so it can decide when the pet has slept until morning.
   */
  private daylight = (at: number): boolean =>
    !isNight(at + this.save.worldOffset + this.debugWorldOffset)

  /** True while a night is being wound past. */
  get skipping(): boolean {
    return this.skipRemaining > 0
  }

  get metrics(): Metrics | null {
    return this.pet ? metrics(this.pet) : null
  }

  get selectedIcon(): IconId {
    return ICON_ORDER[this.iconIndex] ?? 'feed'
  }

  /** 0..1 while C is being held on a screen that can be escaped. */
  get backProgress(): number {
    if (this.heldButton !== 'c' || !ESCAPABLE.includes(this.mode)) return 0
    return Math.min(1, this.heldSeconds / HOLD_TO_BACK_SECONDS)
  }

  private say(text: string, sound: SoundId = 'click'): void {
    this.message = text.toUpperCase()
    this.messageTimer = 2.4
    this.hooks.sound(sound)
  }

  private persist(): void {
    this.save.pet = this.pet
    saveSoon(this.save)
  }

  toggleMute(): void {
    this.save.muted = !this.save.muted
    this.persist()
  }

  /** Wipes the save and returns to the naming screen. */
  restart(): void {
    wipe()
    this.pet = null
    this.save.pet = null
    this.mode = 'name'
  }

  press(button: ButtonId): void {
    this.heldButton = button
    this.heldSeconds = 0
    switch (this.mode) {
      case 'boot':
        // Any press skips the power-on wipe.
        this.bootTimer = 0
        return
      case 'name':
        return this.pressName(button)
      case 'welcome':
        this.mode = 'main'
        this.hooks.sound('confirm')
        return
      case 'evolve':
        this.mode = 'main'
        this.hooks.sound('confirm')
        return
      case 'main':
        return this.pressMain(button)
      case 'feed':
        return this.pressFeed(button)
      case 'games':
        return this.pressGames(button)
      case 'playing':
        return this.pressPlaying(button)
      case 'status':
        // B on an adult arms the retire hold; a short tap closes on release.
        if (button === 'b' && this.pet?.stage === 'adult') {
          this.retireArmed = true
          return
        }
        this.mode = 'main'
        this.hooks.sound('cancel')
        return
      case 'retire':
        this.finishRetirement()
        return
    }
  }

  release(button: ButtonId): void {
    if (this.heldButton !== button) return
    const held = this.heldSeconds
    this.heldButton = null
    this.heldSeconds = 0
    // A tap of B on an adult's status page closes it; only a hold retires.
    // Guarded by the arm flag so releasing the press that opened the screen
    // does not immediately close it again.
    if (this.retireArmed && this.mode === 'status' && button === 'b' && held < RETIRE_HOLD_SECONDS) {
      this.mode = 'main'
      this.hooks.sound('cancel')
    }
    if (button === 'b') this.retireArmed = false
  }

  /** 0..1 while B is being held on an adult's status screen. */
  get retireProgress(): number {
    if (!this.retireArmed || this.heldButton !== 'b' || this.mode !== 'status') return 0
    if (this.pet?.stage !== 'adult') return 0
    return Math.min(1, this.heldSeconds / RETIRE_HOLD_SECONDS)
  }

  /**
   * Sees an adult off into the meadow. The pet joins the album, its
   * discoveries fold into the lineage, and the next egg inherits an heirloom.
   */
  private beginRetirement(): void {
    const pet = this.pet
    if (!pet || pet.stage !== 'adult') return
    this.heldButton = null
    this.heldSeconds = 0
    this.save.album.push({ speciesId: pet.speciesId, name: pet.name, retiredAt: Date.now() })
    this.save.counters.retirements += 1
    this.syncDiscovered()
    this.retiring = { name: pet.name, speciesName: speciesOf(pet.speciesId).name }
    this.mode = 'retire'
    this.hooks.depart()
    this.hooks.sound('evolve')
    this.hooks.burst('sparkle', 30)
    this.persist()
  }

  /** Dismisses the ceremony and clears the way for the next egg. */
  private finishRetirement(): void {
    this.retiring = null
    this.pet = null
    this.save.pet = null
    this.mode = 'name'
    this.hooks.sound('confirm')
    this.persist()
  }

  /**
   * Backs out of a submenu, or abandons a game. Quitting after a round has been
   * decided counts as a loss, so a game can't be rage-quit to protect a win rate.
   */
  private back(): void {
    this.heldButton = null
    this.heldSeconds = 0

    const session = this.session
    if (session && this.pet) {
      if (session.resolved > 0) {
        recordPlay(this.pet, false, session.streak)
        this.say('gave up', 'lose')
      } else {
        this.say('never mind', 'cancel')
      }
      this.session = null
    } else {
      this.hooks.sound('cancel')
    }
    this.mode = 'main'
    this.persist()
  }

  private pressName(button: ButtonId): void {
    if (button === 'a') {
      this.nameIndex = (this.nameIndex + NAMES.length - 1) % NAMES.length
      this.hooks.sound('move')
    } else if (button === 'c') {
      this.nameIndex = (this.nameIndex + 1) % NAMES.length
      this.hooks.sound('move')
    } else {
      this.pet = newPet(NAMES[this.nameIndex]!, Date.now())
      // The heirloom: each retired ancestor leaves the next egg a little
      // better provisioned, capped so lineage helps but never trivialises.
      const boost = Math.min(HEIRLOOM_CAP, this.save.album.length * HEIRLOOM_PER_ANCESTOR)
      if (boost > 0) {
        this.pet.stats.happiness = Math.min(100, this.pet.stats.happiness + boost)
        this.pet.stats.hunger = Math.min(100, this.pet.stats.hunger + boost)
      }
      this.syncDiscovered()
      this.mode = 'main'
      this.hooks.form('egg', true)
      this.hooks.sound('confirm')
      this.persist()
    }
  }

  private pressMain(button: ButtonId): void {
    if (button === 'a') {
      this.iconIndex = (this.iconIndex + ICON_ORDER.length - 1) % ICON_ORDER.length
      this.hooks.sound('move')
      return
    }
    if (button === 'c') {
      this.iconIndex = (this.iconIndex + 1) % ICON_ORDER.length
      this.hooks.sound('move')
      return
    }
    this.activate(this.selectedIcon)
  }

  private activate(icon: IconId): void {
    const pet = this.pet
    if (!pet) return

    switch (icon) {
      case 'feed':
        this.mode = 'feed'
        this.hooks.sound('confirm')
        return
      case 'play': {
        if (pet.stage === 'egg') return this.say('not yet', 'refuse')
        if (pet.asleep) return this.say(`${pet.name} is asleep`, 'refuse')
        if (pet.stats.energy < 15) return this.say('too tired', 'refuse')
        this.mode = 'games'
        this.hooks.sound('confirm')
        return
      }
      case 'clean': {
        const result = clean(pet)
        this.say(result.message, result.ok ? 'clean' : 'refuse')
        if (result.ok) {
          this.hooks.burst('bubble', 14)
          this.hooks.pop(0.6)
        }
        this.persist()
        return
      }
      case 'medicine': {
        const result = feed(pet, 'medicine')
        this.say(result.message, result.ok ? 'eat' : 'refuse')
        if (result.ok) {
          this.hooks.burst('sparkle', 12)
          this.hooks.pop(0.8)
        }
        this.persist()
        return
      }
      case 'sleep': {
        const result = toggleSleep(pet, this.worldNow())
        this.say(result.message, result.ok ? 'sleep' : 'refuse')
        if (result.ok && pet.asleep) this.hooks.burst('zzz', 5)
        this.persist()
        return
      }
      case 'status':
        this.mode = 'status'
        this.hooks.sound('confirm')
        return
    }
  }

  private pressFeed(button: ButtonId): void {
    // Medicine has its own icon, so the food list here is the real meals only.
    const menu = FOODS.filter((f) => f.axis !== null)
    if (button === 'a') {
      this.foodIndex = (this.foodIndex + menu.length - 1) % menu.length
      this.hooks.sound('move')
      return
    }
    if (button === 'c') {
      this.foodIndex = (this.foodIndex + 1) % menu.length
      this.hooks.sound('move')
      return
    }
    const pet = this.pet
    const food = menu[this.foodIndex]
    if (!pet || !food) return

    const result = feed(pet, food.id)
    this.say(result.message, result.ok ? 'eat' : 'refuse')
    if (result.ok) {
      this.hooks.burst('crumb', 12)
      this.hooks.pop(1)
      this.mode = 'main'
    }
    this.persist()
  }

  private pressGames(button: ButtonId): void {
    if (button === 'a') {
      this.gameIndex = (this.gameIndex + MINIGAMES.length - 1) % MINIGAMES.length
      this.hooks.sound('move')
      return
    }
    if (button === 'c') {
      this.gameIndex = (this.gameIndex + 1) % MINIGAMES.length
      this.hooks.sound('move')
      return
    }
    this.session = MINIGAMES[this.gameIndex]!.create()
    this.sessionElapsed = 0
    this.mode = 'playing'
    this.hooks.sound('confirm')
  }

  private pressPlaying(button: ButtonId): void {
    const feedback = this.session?.press(button)
    if (feedback) {
      this.hooks.sound(feedback.sound)
      if (feedback.burst) this.hooks.burst(feedback.burst, 10)
    }
  }

  /**
   * Winds the world forward through the night once the pet is actually in bed,
   * resting it as the hours go by so the stat bars move while the sky does.
   */
  private advanceSleep(dt: number): void {
    const pet = this.pet
    if (!pet) return

    if (!pet.asleep && this.skipRemaining <= 0) {
      this.skipSpent = false
      return
    }
    // Wait until it has settled, so the night does not rush past while the pet
    // is still ambling to the shelter.
    if (!this.skipSpent && this.petSheltered) {
      this.skipSpent = true
      const hours = hoursUntilSunrise(this.worldNow())
      this.skipTotal = hours * WORLD_HOUR_MS
      this.skipRemaining = this.skipTotal
      // Longer nights take longer to wind past, within reason.
      this.skipSeconds = Math.min(
        SKIP_SECONDS_MAX,
        Math.max(SKIP_SECONDS_MIN, hours * SKIP_SECONDS_PER_HOUR),
      )
    }
    if (this.skipRemaining <= 0) return

    const total = this.skipTotal
    const step = Math.min(this.skipRemaining, (total / this.skipSeconds) * dt)
    this.skipRemaining -= step
    this.save.worldOffset += step

    // Put the pet back down *before* resting it, not after. Once its energy
    // bar fills, the simulation wakes it at the top of the frame; resting it
    // after that point charged it waking-rate hunger for the rest of the night.
    pet.asleep = true
    // The pet gets the rest it slept through, but not the age: see sleepThrough.
    sleepThrough(pet, step / WORLD_HOUR_MS)
    // Stays down for the next frame's tick too, so the night is not cut short.
    // When it runs out the night is over, so the pet is up whether or not the
    // sleep was long enough to fill its energy.
    if (this.skipRemaining > 0) pet.asleep = true
    else pet.asleep = false
  }

  update(dt: number, now: number): void {
    this.blink += dt

    // Hold C to back out. Checked before anything else so it still works while
    // a game is mid-round.
    if (this.heldButton === 'c' && ESCAPABLE.includes(this.mode)) {
      this.heldSeconds += dt
      if (this.heldSeconds >= HOLD_TO_BACK_SECONDS) {
        this.back()
        return
      }
    }
    // Hold B on an adult's status screen to retire it.
    if (
      this.retireArmed &&
      this.heldButton === 'b' &&
      this.mode === 'status' &&
      this.pet?.stage === 'adult'
    ) {
      this.heldSeconds += dt
      if (this.heldSeconds >= RETIRE_HOLD_SECONDS) {
        this.beginRetirement()
        return
      }
    }
    if (this.messageTimer > 0) this.messageTimer = Math.max(0, this.messageTimer - dt)

    if (this.mode === 'boot') {
      this.bootTimer -= dt
      if (this.bootTimer <= 0) {
        this.mode = !this.pet ? 'name' : this.awayMs >= WELCOME_THRESHOLD_MS ? 'welcome' : 'main'
        if (this.pet) this.hooks.form(this.pet.speciesId, false)
      }
      return
    }

    const pet = this.pet
    if (!pet) return

    const wasAsleep = pet.asleep
    tick(pet, now, this.daylight)
    this.advanceSleep(dt)
    // Waking on its own is worth a word, but only when the player is here to
    // see it — a pet that woke while the app was closed already did so above.
    if (wasAsleep && !pet.asleep && !this.skipping) {
      this.say(`${pet.name} wakes up`, 'confirm')
    }

    if (this.mode === 'playing' && this.session) {
      this.sessionElapsed += dt
      const feedback = this.session.update(dt)
      if (feedback) {
        this.hooks.sound(feedback.sound)
        if (feedback.burst) this.hooks.burst(feedback.burst, 14)
      }
      if (this.session.done) {
        recordPlay(pet, this.session.won, this.session.streak)
        this.say(this.session.won ? `${pet.name} won!` : 'better luck next time', this.session.won ? 'win' : 'lose')
        if (this.session.won) {
          this.hooks.burst('heart', 18)
          this.hooks.pop(1)
        }
        this.session = null
        this.mode = 'main'
        this.persist()
      }
    }

    // Evolution interrupts whatever screen is up; it is the payoff of the whole loop.
    if (readyToEvolve(pet) && this.mode !== 'evolve' && this.mode !== 'playing') {
      const result = evolve(pet, { season: seasonIdAt(this.worldNow()) })
      if (result) {
        this.evolution = result
        this.syncDiscovered()
        this.mode = 'evolve'
        this.hooks.form(result.toId, true)
        this.hooks.sound(result.toId === 'blob' ? 'hatch' : 'evolve')
        this.hooks.burst('sparkle', 40)
        this.hooks.pop(1)
        this.persist()
      }
    }

    this.persist()
  }

  /** Everything the renderer needs to reflect the pet's condition. */
  get visual(): { mood: number; asleep: boolean; sick: boolean; mobile: boolean } {
    const pet = this.pet
    if (!pet) return { mood: 0.5, asleep: false, sick: false, mobile: false }
    return {
      mood: mood(pet),
      asleep: pet.asleep,
      sick: pet.sick,
      // An egg has nothing to walk with, and a hatchling needs to finish
      // hatching before it wanders off.
      mobile: pet.stage !== 'egg',
    }
  }

  get needs(): string[] {
    return this.pet ? urgentNeeds(this.pet) : []
  }

  get speciesName(): string {
    return this.pet ? speciesOf(this.pet.speciesId).name : ''
  }
}
