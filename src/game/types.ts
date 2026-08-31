import type { BiomeId } from '../data/biome'
import type { KitId } from '../data/kit'
import type { PlayAxis } from '../data/yardgames'
import type { TemperamentId } from './temperament'
import type { Larder } from './larder'
import type { YardState } from './yard'
/** All persistent game state. Anything not in here is derived or ephemeral. */

export type StatKey = 'hunger' | 'happiness' | 'energy' | 'hygiene' | 'health'

/** The four axes a diet can push a pet along. */
export type DietAxis = 'sweet' | 'protein' | 'veg' | 'junk'

export type Stage = 'egg' | 'baby' | 'child' | 'adult'

export interface Stats {
  /** 100 = full, 0 = starving. */
  hunger: number
  happiness: number
  /** 100 = rested, 0 = exhausted. */
  energy: number
  hygiene: number
  health: number
}

export interface CareRecord {
  /** Seconds spent with any stat at rock bottom. The neglect meter. */
  neglectSeconds: number
  /** Seconds spent with every stat comfortable. */
  thrivingSeconds: number
  /** Times the player let the pet get sick. */
  sicknessCount: number
}

export interface DietRecord {
  sweet: number
  protein: number
  veg: number
  junk: number
  /** Total meals, including medicine and treats which have no axis. */
  meals: number
}

export interface PlayRecord {
  gamesPlayed: number
  gamesWon: number
  bestStreak: number
  /**
   * Rounds played of each sort of yard game, counted the way meals are counted
   * against the diet axes. Only yard games score here: the abstract three are
   * the same game whatever the day, so they say nothing about how a pet was
   * raised beyond how often it was played with.
   */
  byAxis: Record<PlayAxis, number>
}

export interface SleepRecord {
  /** Sleeps that began during the pet's night window. */
  onTimeSleeps: number
  /** Sleeps that began outside it, or wakings the player forced. */
  lateSleeps: number
  /** Seconds the pet was awake while its energy was bottomed out. */
  overtiredSeconds: number
}

export interface PetState {
  /** Stable id for the current life. Changes if the pet is ever restarted. */
  id: string
  name: string
  speciesId: string
  stage: Stage
  /**
   * How it turned out, settled on reaching adulthood. Absent while growing, and
   * on any pet saved before temperaments existed.
   */
  temperament?: TemperamentId

  /** Wall-clock ms the egg was laid. */
  bornAt: number
  /** Wall-clock ms of the last simulated tick. Drives offline decay. */
  lastTick: number
  /** Ms of simulated life, excluding time the app was closed beyond the catch-up cap. */
  ageMs: number
  stats: Stats
  asleep: boolean
  sick: boolean
  care: CareRecord
  /**
   * Sleeping by a banked fire. Set when the pet turns in with kindling to
   * spend, cleared when it wakes, and the reason a warm night costs it less.
   */
  warm?: boolean
  diet: DietRecord
  play: PlayRecord
  sleep: SleepRecord
  /** Species ids this save has ever reached, for a collection screen. */
  discovered: string[]
}

/** A pet that lived a full life and was retired with honours. */
export interface AlbumEntry {
  speciesId: string
  name: string
  retiredAt: number
  /**
   * What this life is worth to the next one, 0..1. Absent on pets retired
   * before it was recorded, which are treated as a modest middling life.
   */
  legacy?: number
  /** How it turned out, so the family can lean the way its forebears did. */
  temperament?: TemperamentId
}

export interface SaveFile {
  version: number
  pet: PetState | null
  muted: boolean
  /**
   * Milliseconds the world clock runs ahead of the wall clock. Sleeping pushes
   * it forward; nothing ever winds it back.
   */
  worldOffset: number
  /** Species ever reached across every generation, not just the current life. */
  discovered: string[]
  /** Retired pets, oldest first. */
  album: AlbumEntry[]
  /** Curios the pet brought back from time away, id -> count. */
  curios: Record<string, number>
  /** Days-visited streak. `lastDay` is a local YYYY-MM-DD. */
  streak: { days: number; lastDay: string }
  counters: { sessions: number; retirements: number }
  /** Shell colour id. */
  shell: string
  /**
   * Where the family lives. On the save rather than on the pet: a house
   * outlives the pet in it, the same way the yard does.
   */
  home: BiomeId
  /** What has been planted and befriended. Outlives the pet that brought it home. */
  yard: YardState
  /** Foraged food and fuel, id -> count. The adult's supply line. */
  larder: Larder
  /**
   * Kit the family owns. A list rather than a tally: a second umbrella is not
   * worth anything, so there is nothing to count.
   */
  kit: KitId[]
}
