import type { PetState, SaveFile, Stats } from './types'
import { SPECIES } from '../data/species'
import { TEMPERAMENTS, type TemperamentId } from './temperament'
import { HEALTH_FLOOR } from './tuning'
import { now as clockNow } from '../engine/clock'
import { BIOMES, knownBiome, type BiomeId } from '../data/biome'
import type { PlayAxis } from '../data/yardgames'
import { emptyYard, type Planting } from './yard'

const KEY = 'petz9000.save'
export const SAVE_VERSION = 7

/**
 * The slice of `localStorage` the save needs, behind a seam. A test supplies a
 * plain object; the browser supplies the real thing. Storage that is missing
 * altogether -- a headless run, a locked-down browser -- is a supported state
 * rather than a crash, so the game boots either way.
 */
export interface SaveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): SaveStorage | null {
  try {
    const store = (globalThis as { localStorage?: SaveStorage }).localStorage
    return store ?? null
  } catch {
    // Merely reading `localStorage` throws in some privacy modes.
    return null
  }
}

let storage: SaveStorage | null | undefined

function currentStorage(): SaveStorage | null {
  if (storage === undefined) storage = defaultStorage()
  return storage
}

/** Swaps the backing store. Tests use this; nothing in the game does. */
export function setStorage(store: SaveStorage | null): void {
  storage = store
}

/** Back to the browser's own storage. */
export function resetStorage(): void {
  storage = undefined
}

/** An in-memory store, for tests and for browsers that will not give us one. */
export function memoryStorage(initial: Record<string, string> = {}): SaveStorage & {
  data: Record<string, string>
} {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

/**
 * A store that throws on every operation, which is what a private-mode browser
 * with storage disabled looks like from in here.
 */
export function brokenStorage(): SaveStorage {
  const fail = (): never => {
    throw new Error('storage unavailable')
  }
  return { getItem: fail, setItem: fail, removeItem: fail }
}

/**
 * Ids for new pets, behind a seam so a test can pin one down. `randomUUID` is
 * missing in insecure contexts and in a few embedded browsers, and a pet with
 * no id is a pet the terrain cannot be seeded from -- so there is a fallback.
 */
const browserId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `pet-${Math.random().toString(36).slice(2)}`

let nextId: () => string = browserId

export function setIdSource(fn: () => string): void {
  nextId = fn
}

export function resetIdSource(): void {
  nextId = browserId
}

/**
 * Migrations run in order for every version below the current one. Adding a
 * field means adding a migration here rather than wiping anyone's pet.
 */
const MIGRATIONS: Record<number, (raw: any) => any> = {
  // 0 -> 1 is the initial format; nothing to do.
  // 1 -> 2 adds the world clock offset. Existing pets start in step with the
  // wall clock, which is where they already were.
  1: (raw) => ({ ...raw, worldOffset: 0 }),
  // 2 -> 3 adds the lineage: album, curios, streak, counters and shell. What
  // the current pet has already discovered seeds the lineage-wide list.
  2: (raw) => ({
    ...raw,
    discovered: raw.pet?.discovered ?? [],
    album: [],
    curios: {},
    streak: { days: 0, lastDay: '' },
    counters: { sessions: 0, retirements: 0 },
    shell: 'plum',
  }),
  // 3 -> 4 adds the yard: what the pet has planted and what it has befriended.
  // An existing save starts with an empty one, which is where it already was.
  3: (raw) => ({ ...raw, yard: { plantings: [], strays: [] } }),
  // 4 -> 5 adds the larder. Nothing has been foraged yet, so it starts bare.
  4: (raw) => ({ ...raw, larder: {} }),
  // 5 -> 6 counts play by axis. An existing pet was played with, but never out
  // in the yard, so it leans nowhere -- which is what a zeroed count means.
  5: (raw) => ({
    ...raw,
    pet: raw.pet ? { ...raw.pet, play: { ...raw.pet.play, byAxis: emptyPlayAxes() } } : raw.pet,
  }),
  // 6 -> 7 lets the family move house. Everyone who already has a pet has been
  // living in the meadow, so that is where their garden stays -- the yard's one
  // flat list of plantings becomes the meadow's, and every other place is bare.
  6: (raw) => ({
    ...raw,
    home: 'meadow',
    yard: {
      gardens: { meadow: raw.yard?.plantings ?? [] },
      strays: raw.yard?.strays ?? [],
    },
  }),
}

/** A pet that has never been played with out in the yard. */
export const emptyPlayAxes = (): Record<PlayAxis, number> => ({ chase: 0, romp: 0, quiet: 0 })

export function newPet(name: string, at: number): PetState {
  return {
    id: nextId(),
    name,
    speciesId: 'egg',
    stage: 'egg',
    bornAt: at,
    lastTick: at,
    ageMs: 0,
    stats: { hunger: 70, happiness: 70, energy: 90, hygiene: 90, health: 100 },
    asleep: false,
    sick: false,
    care: { neglectSeconds: 0, thrivingSeconds: 0, sicknessCount: 0 },
    diet: { sweet: 0, protein: 0, veg: 0, junk: 0, meals: 0 },
    play: { gamesPlayed: 0, gamesWon: 0, bestStreak: 0, byAxis: emptyPlayAxes() },
    sleep: { onTimeSleeps: 0, lateSleeps: 0, overtiredSeconds: 0 },
    discovered: ['egg'],
  }
}

export function emptySave(): SaveFile {
  return {
    version: SAVE_VERSION,
    pet: null,
    muted: false,
    worldOffset: 0,
    discovered: [],
    album: [],
    curios: {},
    streak: { days: 0, lastDay: '' },
    counters: { sessions: 0, retirements: 0 },
    shell: 'plum',
    home: 'meadow',
    yard: emptyYard(),
    larder: {},
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback
const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
const rec = <T>(v: unknown, fallback: Record<string, T>): Record<string, T> =>
  isRecord(v) ? (v as Record<string, T>) : fallback

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** A tally: a finite number that has never been below zero. */
const count = (v: unknown): number => Math.max(0, num(v, 0))

/** The plantings at one place, dropping anything that is not a list of them. */
const gardens = (v: unknown): Partial<Record<BiomeId, Planting[]>> => {
  if (!isRecord(v)) return {}
  const out: Partial<Record<BiomeId, Planting[]>> = {}
  for (const biome of BIOMES) {
    const found = v[biome.id]
    if (Array.isArray(found)) out[biome.id] = found as Planting[]
  }
  return out
}

/**
 * A pet, field by field.
 *
 * This is the one the rest of the file exists for. Every other field in a save
 * is a setting, and a setting that comes back wrong costs the player a colour
 * or a streak; the pet is the game. It was also, for a while, the one field
 * `repair` did not touch -- it went through as a cast, on the reasoning that a
 * file at the current version must have been written by the current code. A
 * save with a `pet` of `{}` in it disproved that in about a second: the first
 * frame walked `pet.discovered` and threw before anything reached the screen.
 *
 * So: nothing here is trusted, and nothing here can fail. What cannot be read
 * falls back to what a newly laid egg would have had, which is a pet that has
 * lost some of its history rather than a pet that cannot be opened.
 */
function repairPet(v: unknown): PetState | null {
  if (!isRecord(v)) return null

  const stats = isRecord(v.stats) ? v.stats : {}
  const care = isRecord(v.care) ? v.care : {}
  const diet = isRecord(v.diet) ? v.diet : {}
  const play = isRecord(v.play) ? v.play : {}
  const byAxis = isRecord(play.byAxis) ? play.byAxis : {}
  const sleep = isRecord(v.sleep) ? v.sleep : {}

  // The species names the form, and the form knows which stage it belongs to,
  // so the stage is read off it rather than trusted separately: a save cannot
  // then claim to be a child and draw itself as an adult. A form this build
  // has never heard of -- a save from a branch, or one rolled back past a
  // species being added -- starts over as an egg, because a pet we cannot draw
  // is not one we can put on the screen.
  const species = SPECIES.get(str(v.speciesId, '')) ?? SPECIES.get('egg')!
  const born = num(v.bornAt, clockNow())

  const discovered = arr<unknown>(v.discovered, [])
    .filter((id): id is string => typeof id === 'string')
    .filter((id) => SPECIES.has(id))
  if (!discovered.includes(species.id)) discovered.push(species.id)

  return {
    id: str(v.id, '') || nextId(),
    name: str(v.name, 'PET'),
    speciesId: species.id,
    stage: species.stage,
    temperament: temperament(v.temperament),
    bornAt: born,
    lastTick: num(v.lastTick, born),
    ageMs: count(v.ageMs),
    stats: repairStats(stats),
    asleep: bool(v.asleep, false),
    sick: bool(v.sick, false),
    warm: typeof v.warm === 'boolean' ? v.warm : undefined,
    care: {
      neglectSeconds: count(care.neglectSeconds),
      thrivingSeconds: count(care.thrivingSeconds),
      sicknessCount: count(care.sicknessCount),
    },
    diet: {
      sweet: count(diet.sweet),
      protein: count(diet.protein),
      veg: count(diet.veg),
      junk: count(diet.junk),
      meals: count(diet.meals),
    },
    play: {
      gamesPlayed: count(play.gamesPlayed),
      gamesWon: count(play.gamesWon),
      bestStreak: count(play.bestStreak),
      byAxis: {
        chase: count(byAxis.chase),
        romp: count(byAxis.romp),
        quiet: count(byAxis.quiet),
      },
    },
    sleep: {
      onTimeSleeps: count(sleep.onTimeSleeps),
      lateSleeps: count(sleep.lateSleeps),
      overtiredSeconds: count(sleep.overtiredSeconds),
    },
    // Deduplicated: the collection screen counts what is in here.
    discovered: [...new Set(discovered)],
  }
}

/** The five stats, inside the bounds the simulation would have kept them in. */
function repairStats(v: Record<string, unknown>): Stats {
  return {
    hunger: clamp(num(v.hunger, 70), 0, 100),
    happiness: clamp(num(v.happiness, 70), 0, 100),
    energy: clamp(num(v.energy, 90), 0, 100),
    hygiene: clamp(num(v.hygiene, 90), 0, 100),
    // The floor is the simulation's, not zero: this game has no death in it.
    health: clamp(num(v.health, 100), HEALTH_FLOOR, 100),
  }
}

/** A temperament this build still has a name and a blurb for, or none. */
const temperament = (v: unknown): TemperamentId | undefined =>
  typeof v === 'string' && v in TEMPERAMENTS ? (v as TemperamentId) : undefined

/**
 * Fills in anything a hand-edited or half-written save is missing.
 *
 * Migrations assume the file they are handed is the shape the previous version
 * wrote. A file that is not -- truncated by a full disk, edited by a curious
 * child, written by a build that has since been rolled back -- would otherwise
 * boot into a crash on the first frame that read the missing field, which for
 * this game means a pet that cannot be reached rather than an error message.
 * Anything unreadable falls back to what an empty save would have had, so the
 * worst case is a lost setting rather than a lost pet.
 */
function repair(data: Record<string, unknown>): SaveFile {
  const base = emptySave()
  const streak = isRecord(data.streak) ? data.streak : {}
  const counters = isRecord(data.counters) ? data.counters : {}
  const yard = isRecord(data.yard) ? data.yard : {}
  return {
    version: SAVE_VERSION,
    pet: repairPet(data.pet),
    muted: bool(data.muted, base.muted),
    worldOffset: num(data.worldOffset, base.worldOffset),
    discovered: arr(data.discovered, base.discovered),
    album: arr(data.album, base.album),
    curios: rec(data.curios, base.curios),
    streak: { days: num(streak.days, 0), lastDay: str(streak.lastDay, '') },
    counters: {
      sessions: num(counters.sessions, 0),
      retirements: num(counters.retirements, 0),
    },
    shell: str(data.shell, base.shell),
    home: knownBiome(data.home),
    yard: { gardens: gardens(yard.gardens), strays: arr(yard.strays, []) },
    larder: rec(data.larder, base.larder),
  }
}

export function load(): SaveFile {
  let raw: unknown
  try {
    const store = currentStorage()
    if (!store) return emptySave()
    const text = store.getItem(KEY)
    if (!text) return emptySave()
    raw = JSON.parse(text)
  } catch {
    // Corrupt or unavailable storage should never stop the app from booting.
    return emptySave()
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptySave()
  let data = raw as Record<string, unknown>
  const from = typeof data.version === 'number' ? data.version : 0
  if (from > SAVE_VERSION) return emptySave()

  for (let v = from; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (migrate) data = migrate(data)
  }
  return repair(data)
}

let pending: ReturnType<typeof setTimeout> | null = null
let pendingFile: SaveFile | null = null

export function save(file: SaveFile): void {
  try {
    currentStorage()?.setItem(KEY, JSON.stringify(file))
  } catch {
    // Private-mode storage failures are not worth interrupting play for.
  }
}

/** Coalesces the many small state changes a session makes into one write per second. */
export function saveSoon(file: SaveFile): void {
  pendingFile = file
  if (pending) return
  pending = setTimeout(() => {
    pending = null
    const queued = pendingFile
    pendingFile = null
    if (queued) save(queued)
  }, 1000)
}

/** Writes any coalesced save immediately. Tests use this; so could a shutdown. */
export function flushSave(): void {
  if (pending) {
    clearTimeout(pending)
    pending = null
  }
  const queued = pendingFile
  pendingFile = null
  if (queued) save(queued)
}

/** Drops a coalesced save without writing it, so tests do not leak timers. */
export function cancelPendingSave(): void {
  if (pending) {
    clearTimeout(pending)
    pending = null
  }
  pendingFile = null
}

/** Whether a coalesced write is still outstanding. */
export const savePending = (): boolean => pending !== null

export function wipe(): void {
  cancelPendingSave()
  try {
    currentStorage()?.removeItem(KEY)
  } catch {
    /* nothing we can do */
  }
}
