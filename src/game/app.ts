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
import { reconcile, tick, mood, urgentNeeds } from './sim'
import type { PetState, SaveFile } from './types'

export type Mode = 'boot' | 'name' | 'welcome' | 'main' | 'feed' | 'status' | 'games' | 'playing' | 'evolve'

export const NAMES = ['PIP', 'BOB', 'ZED', 'MOSS', 'NIM', 'TOFU', 'KIRA', 'DUSK']

/** Long absences get a summary screen rather than a silent stat drop. */
const WELCOME_THRESHOLD_MS = 5 * 60_000

/** How long C must be held to back out of a submenu or a game. */
export const HOLD_TO_BACK_SECONDS = 0.8
/** Screens that C can be held to escape from. */
const ESCAPABLE: Mode[] = ['feed', 'games', 'playing']

export interface AppHooks {
  sound(id: SoundId): void
  burst(kind: Burst, count?: number): void
  pop(strength?: number): void
  /** Called when the pet's form changes so the renderer can swap geometry. */
  form(speciesId: string, animate: boolean): void
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
  message = ''
  messageTimer = 0
  awayMs = 0
  bootTimer = 1.4
  /** Seconds the current game has been running, used to time the quit hint. */
  sessionElapsed = 0
  private heldButton: ButtonId | null = null
  private heldSeconds = 0
  /** Blink phase for the selected icon, driven by update(). */
  blink = 0

  constructor(private hooks: AppHooks) {
    this.save = load()
    this.pet = this.save.pet
    if (this.pet) {
      const result = reconcile(this.pet, Date.now())
      this.awayMs = result.awayMs
    }
  }

  get muted(): boolean {
    return this.save.muted
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
        this.mode = 'main'
        this.hooks.sound('cancel')
        return
    }
  }

  release(button: ButtonId): void {
    if (this.heldButton === button) {
      this.heldButton = null
      this.heldSeconds = 0
    }
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
        const result = toggleSleep(pet, Date.now())
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

    tick(pet, now)

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
      const result = evolve(pet)
      if (result) {
        this.evolution = result
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
