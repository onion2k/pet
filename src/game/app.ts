import { FOODS, type Food } from '../data/foods'
import { ICON_ORDER, type IconId } from '../data/icons'
import { chooseBranch, speciesOf } from '../data/species'
import type { Burst } from '../render/particles'
import type { ButtonId } from '../render/shell'
import type { SoundId } from '../engine/audio'
import { clean, evolve, feed, readyToEvolve, recordPlay, toggleSleep, type Evolution } from './actions'
import { MINIGAMES, type GameSession } from './minigames'
import { legacyOf, lineageOf, temperamentOf, type TemperamentId } from './temperament'
import { metrics, type Metrics } from './metrics'
import { load, newPet, save, saveSoon, wipe } from './save'
import { reconcile, sleepThrough, tick, mood, urgentNeeds } from './sim'
import { Forage } from './forage'
import { growthOf, plantableKind, type Planting } from './yard'
import { findSupply, gatheredFoods, KINDLING, LARDER_CAP } from './larder'
import { plantById } from '../data/plants'
import { VISITORS, type VisitorId } from '../data/visitors'
import { VERGE_SLOTS, VERGE_Z } from '../data/biome'
import type { PlantedThing } from '../render/visitors'
import { groundsFor, prospectOf, type Ground, type Prospect } from '../data/grounds'
import { hoursUntilSunrise, isNight, seasonIdAt, worldAt, WORLD_HOUR_MS } from './world'
import {
  COMMON_CURIOS,
  completedSets,
  CURIOS,
  CURIO_COUNT,
  tradeTarget,
  TRADE_COST,
  type Curio,
  type CurioSet,
} from '../data/curios'
import { textWidth } from '../data/font'
import { SPECIES_COUNT } from '../data/species'
import type { SeasonId, WeatherId } from '../data/seasons'
import { SHELLS, shellById, type ShellColour } from '../data/shells'
import { SICK_LINE, voice } from '../data/voice'
import type { PetState, SaveFile, StatKey, Stats } from './types'

export type Mode =
  | 'boot'
  | 'name'
  | 'welcome'
  | 'main'
  | 'feed'
  | 'grounds'
  | 'forage'
  | 'curios'
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
/**
 * Chance a long enough absence turns something up. Deliberately worse than a
 * forage, and limited to the common curios: coming back should still hold a
 * little anticipation, but the adult's job is the good way to fill the board.
 */
const CURIO_CHANCE = 0.25

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

/**
 * The news ticker. It crawls across the width of the screen; this matches
 * SCREEN_PX in main and is only needed to know when a line has fully left the
 * glass.
 */
const TICKER_VIEW_PX = 192
/** Crawl speed, in screen pixels per second. */
const TICKER_SPEED = 22

/** How long C must be held to back out of a submenu or a game. */
export const HOLD_TO_BACK_SECONDS = 0.8
/** How long B must be held on the status screen to retire an adult. Longer
 *  than the back-hold: this one ends a life, gently. */
export const RETIRE_HOLD_SECONDS = 1.6
/** Starting-stat bonus per retired ancestor, and its cap. */
const HEIRLOOM_PER_ANCESTOR = 5
const HEIRLOOM_CAP = 15
/** Screens that C can be held to escape from. */
const ESCAPABLE: Mode[] = ['feed', 'games', 'grounds', 'curios', 'playing']

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
  groundIndex = 0
  curioIndex = 0
  nameIndex = 0
  session: GameSession | null = null
  evolution: Evolution | null = null
  /** Who is being seen off, while the retirement screen is up. */
  retiring: { name: string; speciesName: string } | null = null
  /** What the pet found while the player was away, for the welcome screen. */
  found: Curio | null = null
  /** The line currently crawling across the ticker, and how far it has come. */
  tickerText = ''
  tickerOffset = 0
  private tickerRotation = 0
  private tickerQueue: string[] = []
  /**
   * A single slot rather than a queue: rapid actions replace the pending line
   * instead of backing up, so five quick meals thank you once, not five times.
   */
  private pendingVoice: string | null = null
  private lastSeasonId: SeasonId | null = null
  message = ''
  messageTimer = 0
  awayMs = 0
  /** When the page was last hidden, or 0 while it is on screen. */
  private hiddenAt = 0
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
      this.syncDiscovered()
      this.returned(result.awayMs)
    }
    saveSoon(this.save)
  }

  /**
   * Called whenever the player comes back from an absence, whether that was a
   * closed tab or a backgrounded one. `awayMs` is how long they were actually
   * gone, which is not always how far the simulation had to catch up: a hidden
   * tab may have been ticking along at a trickle the whole time.
   */
  private returned(awayMs: number): void {
    const pet = this.pet
    if (!pet) return
    this.awayMs = awayMs
    if (awayMs < WELCOME_THRESHOLD_MS) return
    this.rollCurio()
    // The pet is pleased to see you, and says so — more pleased the longer
    // you were gone.
    if (pet.stage !== 'egg') {
      this.sayAsPet(voice.welcome(awayMs >= 3 * 3_600_000, pet.speciesId))
    }
    // Boot puts the welcome screen up itself, once the splash has cleared.
    // Mid-session, only interrupt someone who is not in the middle of anything.
    if (this.mode === 'main') this.mode = 'welcome'
  }

  /**
   * The page going away is the player going away. A hidden tab keeps getting
   * the odd frame in some browsers, which is enough to keep `lastTick` current
   * and make an eight-hour absence look like the minute since the last one —
   * so how long they were gone is measured here rather than inferred from the
   * simulation's own catch-up.
   */
  setVisible(visible: boolean): void {
    if (!visible) {
      this.hiddenAt = Date.now()
      // Persist now: the tab may never get another frame.
      save(this.save)
      return
    }
    const hiddenAt = this.hiddenAt
    this.hiddenAt = 0
    if (!hiddenAt || !this.pet) return
    const now = Date.now()
    reconcile(this.pet, now, this.daylight)
    this.returned(Math.max(0, now - hiddenAt))
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
    if (this.found) return
    if (Math.random() > CURIO_CHANCE) return
    // Whatever it turned up while nobody was watching is one of the ordinary
    // things. The seasonal and the deep finds are walked to, not waited for.
    const curio = COMMON_CURIOS[Math.floor(Math.random() * COMMON_CURIOS.length)]
    if (!curio) return
    this.save.curios[curio.id] = (this.save.curios[curio.id] ?? 0) + 1
    this.found = curio
    this.pushTicker(`${pet.name} found a ${curio.name}`)
  }

  /**
   * What the pet can carry back that changes the yard rather than the board.
   * A stray needs the longest trip there is; a seed needs only a pushed one.
   * Either way the yard has to have room, and something has to be left to find.
   */
  private bringHome(legs: number): { what: string; announce: string } | null {
    const pet = this.pet
    if (!pet) return null
    if (legs >= 3) {
      const friend = this.befriendable()
      if (friend) {
        this.save.yard.strays.push(friend.id)
        return {
          what: `${friend.friend} in tow`,
          announce: `${pet.name} has made friends with ${friend.friend}`,
        }
      }
    }
    const planted = this.plantSeed()
    if (!planted) return null
    return {
      what: `${planted.seedName}, and puts it straight in the ground`,
      announce: `${pet.name} has planted ${planted.seedName}`,
    }
  }

  /** Something living, in season, that the pet has not already won over. */
  private befriendable() {
    const season = seasonIdAt(this.worldNow())
    const already = this.save.yard.strays
    const pool = VISITORS.filter(
      (v) => v.friend && v.seasons.includes(season) && !already.includes(v.id),
    )
    return pool[Math.floor(Math.random() * pool.length)] ?? null
  }

  /**
   * Puts a seed in the ground on one of the verge pitches, which are the spots
   * already known to be level and out of the pet's way. Null once the yard is
   * planted up.
   */
  private plantSeed(): { seedName: string } | null {
    const yard = this.save.yard
    const kind = plantableKind(yard, Math.random())
    if (!kind) return null
    const taken = new Set(yard.plantings.map((p) => p.x))
    const spot = VERGE_SLOTS.find((x) => !taken.has(x))
    if (spot === undefined) return null
    const planting: Planting = { kind, x: spot, z: VERGE_Z, plantedAt: this.worldNow() }
    yard.plantings.push(planting)
    return { seedName: plantById(kind)?.seedName ?? 'a seed' }
  }

  /**
   * What the trip picked up on the way. The larder holds only so much of any
   * one thing, so a pet that keeps foraging without being fed stops bringing
   * home more of what it already has.
   */
  private gather(ground: Ground, legs: number): string | null {
    const supply = findSupply(ground.id, legs, Math.random())
    if (!supply) return null
    const held = this.save.larder[supply.id] ?? 0
    if (held >= LARDER_CAP) return null
    this.save.larder[supply.id] = held + 1
    return supply.what
  }

  /**
   * Spends a bundle of kindling on the night ahead, if the pet fetched any.
   * Automatic rather than a choice: the pet gathered it, and there is nothing
   * else to do with it -- the decision was made out on the hill.
   */
  private bankTheFire(): void {
    const pet = this.pet
    if (!pet) return
    const held = this.save.larder[KINDLING] ?? 0
    if (held <= 0) {
      pet.warm = false
      return
    }
    if (held > 1) this.save.larder[KINDLING] = held - 1
    else delete this.save.larder[KINDLING]
    pet.warm = true
    this.pushTicker(`${pet.name} banks the fire for the night`)
  }

  /** What is in the larder, for the feed menu and the status screen. */
  get larder(): Record<string, number> {
    return this.save.larder
  }

  /**
   * The feed menu: everything the device can conjure, plus whatever the pet has
   * actually carried home. Gathered food only appears while there is some.
   */
  get feedMenu(): Food[] {
    const bought = FOODS.filter((f) => f.axis !== null && !f.gathered)
    return [...bought, ...gatheredFoods(this.save.larder)]
  }

  /** What is in the ground and how grown it is, for the renderer. */
  get planted(): PlantedThing[] {
    const now = this.worldNow()
    return this.save.yard.plantings.map((p) => ({
      kind: p.kind,
      x: p.x,
      z: p.z,
      growth: growthOf(p, now),
    }))
  }

  /** Visitors the pet has won over, which now come whenever their season does. */
  get regulars(): VisitorId[] {
    return this.save.yard.strays
  }

  /** Queues a one-off announcement; it runs after the current line finishes. */
  pushTicker(text: string): void {
    this.tickerQueue.push(text.toUpperCase())
  }

  /**
   * Says something now, cutting whatever is scrolling. Returns how long the
   * line will take to cross, so a thought bubble can stay up for exactly as
   * long as the words explaining it -- queued, the line would arrive a minute
   * after the bubble it belongs to had gone.
   */
  speakNow(text: string): number {
    this.tickerText = text.toUpperCase()
    this.tickerOffset = 0
    return (TICKER_VIEW_PX + textWidth(this.tickerText)) / TICKER_SPEED
  }

  /** The pet says something, in its own voice, after the current line. */
  private sayAsPet(text: string): void {
    if (!this.pet) return
    this.pendingVoice = `${this.pet.name}: ${text}`
  }

  /**
   * The ambient news rotation: the sky, the pet, the lineage's standing goals.
   * Rebuilt fresh each time a line is needed, so everything reads current.
   */
  private tickerCandidates(): string[] {
    const world = worldAt(this.worldNow())
    const pet = this.pet
    const out: string[] = []

    if (world.seasonBlend > 0) out.push(`${world.nextSeason.name.toUpperCase()} IS COMING`)
    const weatherLines: Record<WeatherId, string> = {
      clear: 'CLEAR SKIES OVER THE MEADOW',
      rain: 'RAIN ON THE MEADOW',
      snow: 'SNOW IS FALLING',
      mist: 'MIST LIES LOW',
    }
    out.push(weatherLines[world.weather])

    const night = isNight(this.worldNow())
    if (pet && pet.stage === 'egg') {
      out.push(voice.egg())
    } else if (pet && !pet.asleep) {
      // Needs and musings come from the pet itself, in the first person.
      if (pet.sick) {
        out.push(`${pet.name}: ${SICK_LINE}`)
      } else {
        const need = urgentNeeds(pet)[0]
        const line = need ? voice.need(need, pet.speciesId) : undefined
        if (line) out.push(`${pet.name}: ${line}`)
      }
      out.push(`${pet.name}: ${voice.monologue(night, world.weather, pet.speciesId)}`)
      if (night) out.push('THE SUN IS DOWN... BEDTIME?')
    }

    if (this.save.streak.days > 1) out.push(`CARE STREAK: ${this.save.streak.days} DAYS`)
    out.push(`FORMS FOUND: ${this.save.discovered.length}/${SPECIES_COUNT}`)
    const kinds = Object.keys(this.save.curios).length
    if (kinds < CURIO_COUNT) out.push(`CURIOS: ${kinds}/${CURIO_COUNT}`)
    const locked = SHELLS.find((shell) => !shell.unlocked(this.save))
    if (locked) out.push(`EARN THE ${locked.name.toUpperCase()} SHELL: ${locked.hint.toUpperCase()}`)
    out.push('PETZ-9000 NEWS')
    return out
  }

  private advanceTicker(dt: number): void {
    // A season turning over is breaking news.
    const seasonNow = seasonIdAt(this.worldNow())
    if (this.lastSeasonId && seasonNow !== this.lastSeasonId) {
      this.pushTicker(`${seasonNow} has arrived`)
    }
    this.lastSeasonId = seasonNow

    if (this.tickerText) {
      this.tickerOffset += dt * TICKER_SPEED
      if (this.tickerOffset <= TICKER_VIEW_PX + textWidth(this.tickerText)) return
    }
    const queued = this.tickerQueue.shift() ?? this.pendingVoice
    if (queued) {
      if (queued === this.pendingVoice) this.pendingVoice = null
      this.tickerText = queued
    } else {
      const candidates = this.tickerCandidates()
      this.tickerText = candidates[this.tickerRotation++ % candidates.length] ?? ''
    }
    this.tickerOffset = 0
  }

  /** Species reached across every generation, for the collection counter. */
  /**
   * Which branch the pet is currently earning, in the words the evolution
   * screen would use. The stakes of every meal and every bedtime were real
   * already, but the player could not see them until the moment they were
   * spent; this is that same reasoning, shown while it can still be steered.
   * The destination is deliberately withheld -- knowing you are heading
   * somewhere is the useful part, knowing exactly where would end the surprise.
   */
  /**
   * Sends a grown pet off to look for something. The whole decision is when to
   * send it: what can be found is gated on the season and the weather, so the
   * knowledge the player has built up about the year becomes a thing they can
   * act on rather than wait for.
   */
  /**
   * Opens the list of places to be sent. A child has one ground and an adult
   * has all four, so the menu is what the pet's age looks like from outside.
   */
  private openGrounds(): void {
    const pet = this.pet
    if (!pet) return
    if (this.grounds.length === 0) return this.say('not old enough', 'refuse')
    if (pet.asleep) return this.say(`${pet.name} is asleep`, 'refuse')
    if (pet.sick) return this.say('too poorly', 'refuse')
    if (this.forage.active) return this.say('already out', 'refuse')
    this.groundIndex = Math.min(this.groundIndex, this.grounds.length - 1)
    this.mode = 'grounds'
    this.hooks.sound('confirm')
  }

  /** The grounds this pet is old enough to be sent to. */
  get grounds(): Ground[] {
    return this.pet ? groundsFor(this.pet.stage) : []
  }

  /**
   * How a ground looks today. The one piece of information that makes the
   * choice a choice, so it is read off the live world rather than cached.
   */
  prospect(ground: Ground): Prospect {
    const world = worldAt(this.worldNow())
    return prospectOf(ground, world.season.id, world.weather)
  }

  /**
   * The only two buttons that mean anything while the pet is out: send it on,
   * or call it home. Anything else is left alone rather than skipping the trip.
   */
  private pressForage(button: ButtonId): void {
    if (!this.forage.choosing) return
    if (button === 'b') {
      if (this.forage.pushOn()) this.hooks.sound('confirm')
      else this.say('too tired to go on', 'refuse')
      return
    }
    if (button === 'c' && this.forage.headHome()) this.hooks.sound('cancel')
  }

  private pressGrounds(button: ButtonId): void {
    const menu = this.grounds
    if (button === 'a') {
      this.groundIndex = (this.groundIndex + menu.length - 1) % menu.length
      this.hooks.sound('move')
      return
    }
    if (button === 'c') {
      this.groundIndex = (this.groundIndex + 1) % menu.length
      this.hooks.sound('move')
      return
    }
    const ground = menu[this.groundIndex]
    if (ground) this.sendForaging(ground)
  }

  private sendForaging(ground: Ground): void {
    const pet = this.pet
    if (!pet) return
    if (pet.stats.energy < ground.energy + 10) return this.say('too tired for that', 'refuse')

    this.mode = 'main'
    this.forage.begin(ground)
    this.applyStats({ energy: -ground.energy })
    this.say('off it goes', 'confirm')
    // Said now, not queued. A queued line waits for whatever is scrolling to
    // finish -- a quarter of a minute at worst -- and the whole forage is over
    // in ten seconds, so it would have arrived long after the pet was home.
    this.speakNow(`${pet.name} has gone looking`)
    this.persist()
  }

  /**
   * Runs the forage and puts its screen up while the pet is out of sight. The
   * mode follows the trip rather than the trip following the mode, so a forage
   * that is interrupted -- by an evolution, say -- still finishes its walk home.
   */
  private advanceForage(dt: number): void {
    const telling = this.forage.telling
    this.forage.advance(dt)
    if (this.forage.telling && !telling && this.mode === 'main') this.mode = 'forage'
    else if (!this.forage.telling && telling && this.mode === 'forage') this.mode = 'main'
  }

  /** Adds stat deltas, clamped, the same way the actions do. */
  private applyStats(delta: Partial<Stats>): void {
    const pet = this.pet
    if (!pet) return
    for (const [key, amount] of Object.entries(delta) as [StatKey, number][]) {
      pet.stats[key] = Math.max(0, Math.min(100, pet.stats[key] + amount))
    }
  }

  /**
   * The forage, which is a short piece of theatre rather than saved state: if
   * the app closes midway the pet is simply home again.
   */
  private forage = new Forage({
    isPetAway: () => this.petAway,
    journeyContext: (ground) => {
      const world = worldAt(this.worldNow())
      return {
        ground: ground.id,
        season: world.season.id,
        weather: world.weather,
        night: isNight(this.worldNow()),
        speciesId: this.pet?.speciesId ?? 'blob',
      }
    },
    petName: () => this.pet?.name ?? '',
    energy: () => this.pet?.stats.energy ?? 0,
    boons: () => this.boons,
    addWorldTime: (ms) => {
      this.save.worldOffset += ms
    },
    addCurio: (curio) => {
      this.save.curios[curio.id] = (this.save.curios[curio.id] ?? 0) + 1
    },
    bringHome: (legs) => this.bringHome(legs),
    gather: (ground, legs) => this.gather(ground, legs),
    applyStats: (delta) => this.applyStats(delta),
    speakNow: (text) => {
      this.speakNow(text)
    },
    burst: (kind, count) => this.hooks.burst(kind, count),
    persist: () => this.persist(),
  })

  /** Set each frame by the renderer: true while the pet is over the hill. */
  petAway = false

  /** How black the picture is, 0..1. */
  get forageDim(): number {
    return this.forage.dim
  }

  /** The trip so far, for the screen that tells it. */
  get forageBeats(): string[] {
    return this.forage.beats
  }

  /**
   * What the current trip came home with, for the trip screen. Separate from
   * `found`, which belongs to the welcome screen and is about time away.
   */
  get forageFound(): Curio | null {
    return this.forage.found
  }

  /** Whether the trip is waiting on go-on-or-come-home, and how long is left. */
  get forageChoosing(): boolean {
    return this.forage.choosing
  }

  get forageChooseProgress(): number {
    return this.forage.chooseProgress
  }

  get foragePushCost(): number {
    return this.forage.pushCost
  }

  /** Which way the family leans, from the pets already seen off. */
  get lineage(): TemperamentId | null {
    return lineageOf(this.save.album)
  }

  /** How the grown pet turned out, or null while it is still growing. */
  get temperament(): { name: string; blurb: string } | null {
    const pet = this.pet
    return pet ? temperamentOf(pet) : null
  }

  get leaning(): string | null {
    const pet = this.pet
    if (!pet || pet.stage === 'egg') return null
    const branch = chooseBranch(pet, metrics(pet), { season: seasonIdAt(this.worldNow()), lineage: this.lineage })
    return branch ? branch.because : null
  }

  /** Games played, won and the best run, for the games screen. */
  get playRecord(): { gamesPlayed: number; gamesWon: number; bestStreak: number } {
    return this.pet?.play ?? { gamesPlayed: 0, gamesWon: 0, bestStreak: 0 }
  }

  /** Which forms the lineage has met, for the album. */
  get discoveredIds(): string[] {
    return this.save.discovered
  }

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

  /** How many of each curio the lineage has found, for the collection board. */
  get curioCounts(): Record<string, number> {
    return this.save.curios
  }

  /**
   * Which sets the lineage has finished, and so what the pet is quietly better
   * at. Read off the counts rather than stored, so trading recomputes it.
   */
  get boons(): CurioSet[] {
    return completedSets(this.save.curios)
  }

  /** What three spares would buy right now, or null with the board complete. */
  get tradeFor(): Curio | null {
    return tradeTarget(this.save.curios)
  }

  /** Whether the curio under the cursor has spares to trade. */
  get canTrade(): boolean {
    const curio = CURIOS[this.curioIndex]
    if (!curio) return false
    return (this.save.curios[curio.id] ?? 0) > TRADE_COST - 1 && !!this.tradeFor
  }

  /**
   * Three spares for one of whatever the board is still missing. The year comes
   * round slowly, and a shelf of spare pebbles ought to be able to buy the
   * snowdrop that keeps not turning up.
   */
  private trade(): void {
    const curio = CURIOS[this.curioIndex]
    const want = this.tradeFor
    if (!curio || !want) return this.say('nothing left to want', 'refuse')
    const held = this.save.curios[curio.id] ?? 0
    if (held <= TRADE_COST) {
      return this.say(`needs ${TRADE_COST + 1} ${curio.name.toLowerCase()}s`, 'refuse')
    }
    this.save.curios[curio.id] = held - TRADE_COST
    this.save.curios[want.id] = (this.save.curios[want.id] ?? 0) + 1
    this.say(`traded up for a ${want.name.toLowerCase()}`, 'evolve')
    this.hooks.burst('sparkle', 16)
    this.persist()
  }

  private pressCurios(button: ButtonId): void {
    if (button === 'a') {
      this.curioIndex = (this.curioIndex + CURIOS.length - 1) % CURIOS.length
      this.hooks.sound('move')
      return
    }
    if (button === 'c') {
      this.curioIndex = (this.curioIndex + 1) % CURIOS.length
      this.hooks.sound('move')
      return
    }
    this.trade()
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
      case 'grounds':
        return this.pressGrounds(button)
      case 'forage':
        return this.pressForage(button)
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
        // A opens the board, which is the one screen in the game with anything
        // to do on it; C still closes, as every other screen's C does.
        if (button === 'a') {
          this.mode = 'curios'
          this.hooks.sound('confirm')
          return
        }
        this.mode = 'main'
        this.hooks.sound('cancel')
        return
      case 'curios':
        return this.pressCurios(button)
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
    this.save.album.push({
      speciesId: pet.speciesId,
      name: pet.name,
      retiredAt: Date.now(),
      // How much of the board this life helped fill counts toward what it
      // leaves the next egg: a life spent looking is worth passing on.
      legacy: legacyOf(pet, this.curioTally.kinds / CURIO_COUNT),
      temperament: pet.temperament,
    })
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
      // What the ancestors are worth, not how many there were. Counting them
      // made retiring the instant a pet grew up the best move available: it
      // advanced the album, advanced the heirloom, and restarted the only
      // system in the game where choices accumulate. A life now has to have
      // been lived to be worth passing on.
      const inherited = this.save.album.reduce((sum, entry) => sum + (entry.legacy ?? 0.4), 0)
      const boost = Math.min(HEIRLOOM_CAP, inherited * HEIRLOOM_PER_ANCESTOR)
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
          this.sayAsPet(voice.cleaned(pet.speciesId))
        }
        this.persist()
        return
      }
      case 'forage': {
        this.openGrounds()
        return
      }
      case 'medicine': {
        const result = feed(pet, 'medicine', seasonIdAt(this.worldNow()))
        this.say(result.message, result.ok ? 'eat' : 'refuse')
        if (result.ok) {
          this.hooks.burst('sparkle', 12)
          this.hooks.pop(0.8)
          this.sayAsPet(voice.medicine(pet.speciesId))
        }
        this.persist()
        return
      }
      case 'sleep': {
        const wasAwake = !pet.asleep
        const result = toggleSleep(pet, this.worldNow())
        if (result.ok && wasAwake) this.bankTheFire()
        // Woken early: the fire is spent either way, but it stops working.
        else if (result.ok) pet.warm = false
        this.say(result.message, result.ok ? 'sleep' : 'refuse')
        if (result.ok && pet.asleep) {
          this.hooks.burst('zzz', 5)
          this.sayAsPet(voice.goodnight(pet.speciesId))
        }
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
    const menu = this.feedMenu
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

    const result = feed(pet, food.id, seasonIdAt(this.worldNow()))
    this.say(result.message, result.ok ? 'eat' : 'refuse')
    if (result.ok) {
      // Gathered food is spent rather than conjured, so the menu shortens as
      // the pet eats its way through what it carried home.
      if (food.gathered) {
        const left = (this.save.larder[food.id] ?? 1) - 1
        if (left > 0) this.save.larder[food.id] = left
        else delete this.save.larder[food.id]
        this.foodIndex = Math.min(this.foodIndex, this.feedMenu.length - 1)
      }
      this.hooks.burst('crumb', 12)
      this.hooks.pop(1)
      this.sayAsPet(voice.fed(food.name, pet.speciesId))
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
    if (this.skipRemaining > 0) {
      pet.asleep = true
    } else {
      pet.asleep = false
      pet.warm = false
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

    this.advanceForage(dt)
    this.advanceTicker(dt)

    const pet = this.pet
    if (!pet) return

    const wasAsleep = pet.asleep
    // A gap big enough to reconcile is a gap the player was away for, even if
    // the tab never reported itself hidden.
    const caught = tick(pet, now, this.daylight)
    if (caught) this.returned(caught.awayMs)
    this.advanceSleep(dt)
    // Waking on its own is worth a word, but only when the player is here to
    // see it — a pet that woke while the app was closed already did so above.
    if (wasAsleep && !pet.asleep && !this.skipping) {
      this.say(`${pet.name} wakes up`, 'confirm')
      this.sayAsPet(voice.morning(pet.speciesId))
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
        this.sayAsPet(voice.game(this.session.won, pet.speciesId))
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
      const result = evolve(pet, { season: seasonIdAt(this.worldNow()), lineage: this.lineage })
      if (result) {
        this.evolution = result
        this.syncDiscovered()
        this.pushTicker(`${pet.name} became ${result.toName}`)
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
  get visual(): {
    mood: number
    asleep: boolean
    sick: boolean
    mobile: boolean
    foraging: boolean
  } {
    const pet = this.pet
    if (!pet) return { mood: 0.5, asleep: false, sick: false, mobile: false, foraging: false }
    return {
      mood: mood(pet),
      asleep: pet.asleep,
      sick: pet.sick,
      foraging: this.forage.outOfSight,
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
